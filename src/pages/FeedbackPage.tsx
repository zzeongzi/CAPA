import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"; // AlertDialog components
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Paperclip, XCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'; // Added Trash2 icon
import { format, parseISO } from 'date-fns'; // parseISO 추가
import type { Tables, Json, TablesInsert } from '@/integrations/supabase/types'; // TablesInsert 추가
import { Badge } from '@/components/ui/badge'; // Badge 추가

const feedbackSchema = z.object({
  feedback_type: z.string().min(1, "피드백 유형을 선택해주세요."),
  title: z.string().min(3, "제목을 3자 이상 입력해주세요.").max(100, "제목은 100자를 넘을 수 없습니다."),
  content: z.string().min(10, "내용을 10자 이상 입력해주세요.").max(2000, "내용은 2000자를 넘을 수 없습니다."),
  email: z.string().email("올바른 이메일 형식이 아닙니다.").optional().or(z.literal('')),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

type FeedbackWithReplies = Tables<'feedbacks'> & {
  feedback_replies: Tables<'feedback_replies'>[];
};

const FeedbackPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackWithReplies[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Lightbox state for "My Feedbacks" tab
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState<number | null>(null);
  const [currentFeedbackAttachments, setCurrentFeedbackAttachments] = useState<Json[] | null>(null);

  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [feedbackToDeleteId, setFeedbackToDeleteId] = useState<string | null>(null);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedback_type: '',
      title: '',
      content: '',
      email: user?.email || '',
    },
  });

  const fetchMyFeedbacks = async () => {
    if (!user) return;
    setIsLoadingFeedbacks(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select(`
          *,
          feedback_replies (
            id,
            content,
            created_at,
            replier_id
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyFeedbacks(data as FeedbackWithReplies[] || []);
    } catch (error: any) {
      console.error("Error fetching feedbacks:", error);
      toast({ title: "오류", description: "내 피드백 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyFeedbacks();
    }
  }, [user, toast]); // toast를 의존성 배열에 추가

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(files);
      const newPreviews: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          newPreviews.push(URL.createObjectURL(file));
        }
      }
      // 기존 미리보기 해제
      filePreviews.forEach(preview => URL.revokeObjectURL(preview));
      setFilePreviews(newPreviews);
    } else {
      setSelectedFiles(null);
      filePreviews.forEach(preview => URL.revokeObjectURL(preview));
      setFilePreviews([]);
    }
  };

  const removeFile = (index: number) => {
    if (selectedFiles) {
      const newFilesArray = Array.from(selectedFiles);
      newFilesArray.splice(index, 1);
      
      const dt = new DataTransfer();
      newFilesArray.forEach(file => dt.items.add(file));
      setSelectedFiles(dt.files.length > 0 ? dt.files : null);

      const newPreviews = [...filePreviews];
      if (selectedFiles[index]?.type.startsWith('image/')) {
         const previewToRemove = filePreviews.find(p => p.includes(selectedFiles[index].name)); // 좀 더 정확한 매칭 필요
         if(previewToRemove) URL.revokeObjectURL(previewToRemove);
         // 실제로는 index기반으로 preview를 제거해야함. 아래는 임시방편
         newPreviews.splice(index,1); // 이부분은 selectedFiles의 이미지 순서와 filePreviews 순서가 같다고 가정
      }
      setFilePreviews(newPreviews);
       // input value 초기화하여 동일 파일 재선택 가능하도록
      const fileInput = document.getElementById('attachments') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };


  const uploadFiles = async (): Promise<Json[] | null> => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return null;
    }
    setIsUploading(true);
    const uploadedFilePaths: { path: string; publicURL: string; name: string; type: string; size: number }[] = [];
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        // 파일 이름에서 공백을 '_'로 바꾸고, 그 외 안전하지 않은 문자 제거 (알파벳, 숫자, 점, 밑줄, 하이픈만 허용)
        const sanitizedOriginalName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        const fileName = `${Date.now()}-${sanitizedOriginalName}`;
        // filePath에서 버킷 이름과 유사한 경로 중복 제거. 사용자 ID 또는 anonymous로 시작하는 경로 사용.
        const filePath = `${user?.id || 'anonymous'}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feedback-attachments')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(`파일 업로드 실패 (${file.name}): ${uploadError.message}`);
        }

        if (uploadData) {
          const { data: urlData } = supabase.storage.from('feedback-attachments').getPublicUrl(uploadData.path);
          uploadedFilePaths.push({
            path: uploadData.path,
            publicURL: urlData.publicUrl,
            name: file.name,
            type: file.type,
            size: file.size,
          });
        }
      }
      return uploadedFilePaths as Json[]; // Json[] 타입으로 캐스팅
    } catch (error: any) {
      toast({ title: "파일 업로드 오류", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    let attachmentsData: Json | null = null;

    if (selectedFiles && selectedFiles.length > 0) {
      const uploaded = await uploadFiles();
      if (uploaded) {
        attachmentsData = uploaded;
      } else {
        // 파일 업로드 실패 시 제출 중단 또는 사용자에게 알림
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const feedbackData: TablesInsert<'feedbacks'> = {
        feedback_type: data.feedback_type,
        title: data.title,
        content: data.content,
        status: '접수됨',
        user_id: user?.id,
        email: user ? undefined : data.email || null,
        attachments: attachmentsData, // 업로드된 파일 정보 추가
        app_version: '1.0.0', // 예시 버전, 실제 앱 버전 관리 로직 필요
        user_agent: navigator.userAgent,
      };

      const { error } = await supabase.from('feedbacks').insert([feedbackData]);
      if (error) throw error;

      toast({ title: "피드백 제출 성공", description: "소중한 의견 감사합니다." });
      form.reset();
      setSelectedFiles(null);
      filePreviews.forEach(preview => URL.revokeObjectURL(preview));
      setFilePreviews([]);
      fetchMyFeedbacks();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({ title: "오류 발생", description: `피드백 제출 중 오류: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lightbox handlers for "My Feedbacks" tab
  const handleMyFeedbackImageClick = (src: string, index: number, attachments: Json[] | null) => {
    if (!Array.isArray(attachments)) return;
    setLightboxImageSrc(src);
    setCurrentLightboxIndex(index);
    setCurrentFeedbackAttachments(attachments);
    setLightboxOpen(true);
  };

  const handleMyFeedbackLightboxClose = () => {
    setLightboxOpen(false);
    setLightboxImageSrc(null);
    setCurrentLightboxIndex(null);
    setCurrentFeedbackAttachments(null);
  };

  const handleMyFeedbackLightboxNavigate = (direction: 'prev' | 'next') => {
    if (currentFeedbackAttachments && Array.isArray(currentFeedbackAttachments) && currentLightboxIndex !== null) {
      const imageAttachments = currentFeedbackAttachments.filter(att => att && typeof att === 'object' && (att as any).type?.startsWith('image/'));
      if (!imageAttachments.length) return;

      let newIndex = currentLightboxIndex;
      if (direction === 'prev') {
        newIndex = (currentLightboxIndex - 1 + imageAttachments.length) % imageAttachments.length;
      } else {
        newIndex = (currentLightboxIndex + 1) % imageAttachments.length;
      }
      
      const newAttachment = imageAttachments[newIndex] as any;
      if (newAttachment && newAttachment.publicURL) {
        setLightboxImageSrc(newAttachment.publicURL);
        setCurrentLightboxIndex(newIndex);
      }
    }
  };

  const openDeleteDialog = (id: string) => {
    setFeedbackToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setFeedbackToDeleteId(null);
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteFeedback = async () => {
    if (!feedbackToDeleteId) return;
    try {
      // Optionally, delete related feedback_replies first if not handled by CASCADE
      // For now, just deleting the feedback entry.
      const { error } = await supabase
        .from('feedbacks')
        .delete()
        .eq('id', feedbackToDeleteId);

      if (error) throw error;

      toast({ title: "성공", description: "피드백이 삭제되었습니다." });
      fetchMyFeedbacks(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting feedback:", error);
      toast({ title: "오류", description: `피드백 삭제 중 오류: ${error.message}`, variant: "destructive" });
    } finally {
      closeDeleteDialog();
    }
  };

  return (
    <React.Fragment>
    <AppLayout>
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Tabs defaultValue="new-feedback">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="new-feedback">새 피드백 작성</TabsTrigger>
            <TabsTrigger value="my-feedbacks">내 피드백 확인</TabsTrigger>
          </TabsList>

          <TabsContent value="new-feedback">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">피드백 보내기</CardTitle>
                <CardDescription>앱 사용 중 발견하신 문제점, 개선사항, 또는 문의사항을 알려주세요.</CardDescription>
              </CardHeader>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                  {!user && (
                    <div className="space-y-2">
                      <Label htmlFor="email">이메일 주소 (선택)</Label>
                      <Input id="email" type="email" placeholder="답변을 받으실 이메일 주소를 입력해주세요." {...form.register('email')} />
                      {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="feedback_type">피드백 유형</Label>
                    <Select onValueChange={(value) => form.setValue('feedback_type', value)} defaultValue={form.getValues('feedback_type')}>
                      <SelectTrigger id="feedback_type"><SelectValue placeholder="유형을 선택해주세요" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="문의">문의사항</SelectItem>
                        <SelectItem value="기능요청">기능 요청</SelectItem>
                        <SelectItem value="버그리포트">버그 리포트</SelectItem>
                        <SelectItem value="기타">기타 의견</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.feedback_type && <p className="text-sm text-destructive">{form.formState.errors.feedback_type.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">제목</Label>
                    <Input id="title" placeholder="제목을 입력해주세요." {...form.register('title')} />
                    {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">내용</Label>
                    <Textarea id="content" placeholder="자세한 내용을 입력해주세요." rows={6} {...form.register('content')} />
                    {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attachments-button">첨부파일 (사진/동영상)</Label>
                    <Input
                      id="attachments" // 실제 파일 입력을 위한 id
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="hidden" // 실제 input은 숨김
                    />
                    <Button
                      id="attachments-button"
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('attachments')?.click()}
                      className="w-full sm:w-auto py-3 px-4 h-12 flex items-center justify-center" // 버튼 스타일 및 정렬
                    >
                      <Paperclip className="mr-2 h-4 w-4" />
                      파일 선택
                    </Button>
                    {selectedFiles && selectedFiles.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm font-medium">선택된 파일 ({selectedFiles.length}개):</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {Array.from(selectedFiles).map((file, index) => (
                            <li key={index} className="flex items-center justify-between">
                              <span>
                                <Paperclip className="inline-block mr-1 h-4 w-4" />
                                {file.name} ({ (file.size / 1024 / 1024).toFixed(2) } MB)
                              </span>
                              <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="text-destructive hover:text-destructive-hover">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                        {filePreviews.length > 0 && (
                          <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {filePreviews.map((preview, index) => (
                              <img key={index} src={preview} alt={`미리보기 ${index + 1}`} className="h-24 w-24 rounded-md object-cover border" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {isUploading && (
                      <div className="flex items-center text-sm text-muted-foreground mt-2">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        파일 업로드 중...
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUploading ? '업로드 중...' : (isSubmitting ? '제출 중...' : '제출하기')}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="my-feedbacks">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">내 피드백 목록</CardTitle>
                <CardDescription>내가 제출한 피드백과 처리 상태를 확인할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingFeedbacks ? (
                  <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : myFeedbacks.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {myFeedbacks.map((fb) => (
                      <AccordionItem value={fb.id} key={fb.id}>
                        {/* AccordionContent로 삭제 버튼 이동하지 않고, Trigger 오른쪽에 별도 버튼으로 배치 시도 */}
                        {/* 이는 AccordionItem의 자식으로 Trigger와 Button을 나란히 두는 구조가 필요하나, shadcn 기본 구조와 다름 */}
                        {/* 요청은 "토글 아이콘 오른쪽"이므로, AccordionTrigger의 기본 동작을 유지하면서 오른쪽에 버튼을 추가하는 것은 어려움. */}
                        {/* 대신, AccordionTrigger 내부의 가장 오른쪽에 배치하고 항상 보이도록 수정 */}
                        {/* AccordionTrigger 내부의 div를 수정하여 삭제 버튼을 포함시키고, flex로 정렬 */}
                        {/* 수정된 AccordionTrigger 구조: */}
                        {/* <AccordionTrigger>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-medium truncate pr-2 flex-1">{fb.title}</span>
                                <div className="flex items-center space-x-2">
                                  <Badge>{fb.status}</Badge>
                                  <span>{date}</span>
                                  <Button>삭제</Button>
                                  // 여기에 기본 토글 아이콘이 shadcn에 의해 추가됨
                                </div>
                              </div>
                           </AccordionTrigger> */}
                        {/* 위 구조에서 삭제 버튼이 토글 아이콘보다 왼쪽에 오게 됨. */}
                        {/* 요청대로 토글 아이콘 오른쪽에 배치하려면, AccordionTrigger의 기본 아이콘을 커스텀하거나,
                            AccordionItem 자체에 position relative를 주고 삭제 버튼을 absolute로 배치해야 함.
                            가장 간단한 방법은 AccordionContent 상단에 두는 것이나, 사용자는 Trigger 영역을 원함.
                            일단 삭제 버튼을 항상 보이게 하고, 기존 위치(날짜 오른쪽)를 유지하되 간격을 조정.
                         */}
                         {/* 이전 코드에서 삭제 버튼은 AccordionTrigger의 자식으로 바로 있었음. */}
                         {/* AccordionTrigger 내부의 마지막 요소로 삭제 버튼을 옮기고 항상 보이도록 함. */}
                         {/* <AccordionTrigger>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-medium truncate pr-2 flex-1">{fb.title}</span>
                                <div className="flex items-center space-x-2">
                                  <Badge variant={fb.status === '완료됨' ? 'default' : 'secondary'} className="text-xs">{fb.status}</Badge>
                                  <span className="text-xs text-muted-foreground">{format(parseISO(fb.created_at), "yy/MM/dd")}</span>
                                </div>
                              </div>
                              // 여기에 기본 토글 아이콘이 렌더링됨
                              <Button // 이 버튼이 토글 아이콘 오른쪽에 오도록 해야 함.
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive-hover ml-2" // 항상 보이도록 opacity 제거, ml-2로 간격
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteDialog(fb.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AccordionTrigger> */}
                        {/* 위 방식은 AccordionTrigger의 기본 구조를 변경해야 해서 복잡. */}
                        {/* 기존처럼 AccordionTrigger 내부의 오른쪽 요소 그룹에 포함시키되, 항상 보이도록 하고 간격만 조정 */}
                        {/* AccordionTrigger 내부의 div를 수정 */}
                        {/* <AccordionTrigger>
                          <div className="flex justify-between items-center w-full">
                            <span className="font-medium truncate pr-2 flex-1">{fb.title}</span>
                            <div className="flex items-center space-x-2"> // 이 space-x-2를 늘리거나, 삭제 버튼에 ml 추가
                              <Badge variant={fb.status === '완료됨' ? 'default' : 'secondary'} className="text-xs">{fb.status}</Badge>
                              <span className="text-xs text-muted-foreground">{format(parseISO(fb.created_at), "yy/MM/dd")}</span>
                              <Button // 이 버튼과 토글 아이콘(자동생성) 사이 간격 필요
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive-hover" // opacity 제거
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteDialog(fb.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </AccordionTrigger> */}
                        <AccordionTrigger className="relative group pr-[4.5rem] hover:bg-muted/50 transition-colors"> {/* 오른쪽 패딩 증가, 호버 효과 추가 */}
                          <div className="flex justify-between items-center w-full">
                            <span className="font-medium truncate pr-2 flex-1 group-hover:text-primary transition-colors">{fb.title}</span>
                            <div className="flex items-center space-x-2">
                              <Badge variant={fb.status === '완료됨' ? 'default' : 'secondary'} className="text-xs">{fb.status}</Badge>
                              <span className="text-xs text-muted-foreground">{format(parseISO(fb.created_at), "yy/MM/dd")}</span>
                            </div>
                          </div>
                          {/* 삭제 버튼: 오른쪽 끝에 위치. 기본 토글 아이콘은 이 버튼 왼쪽에 렌더링됨. */}
                          <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1/2 right-2 transform -translate-y-1/2 h-7 w-7 p-1 text-destructive hover:text-destructive-hover z-10" // 버튼 크기 h-7 w-7로 수정
                              onClick={(e) => {
                                e.stopPropagation(); // Accordion 토글 방지
                                openDeleteDialog(fb.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> {/* 아이콘 크기 h-4 w-4로 수정 */}
                          </Button>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fb.content}</p>
                          {fb.feedback_replies && fb.feedback_replies.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-semibold mb-2">개발자 답변:</h4>
                              {fb.feedback_replies.map(reply => (
                                <div key={reply.id} className="p-3 bg-muted/50 rounded-md mb-2">
                                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                                  <p className="text-xs text-muted-foreground mt-1 text-right">
                                    {format(parseISO(reply.created_at), "yyyy년 MM월 dd일 HH:mm")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                           {(!fb.feedback_replies || fb.feedback_replies.length === 0) && fb.status !== '완료됨' && (
                            <p className="text-xs text-muted-foreground mt-2">아직 답변이 등록되지 않았습니다.</p>
                          )}
                          {/* Display attachments in "My Feedbacks" tab */}
                          {fb.attachments && Array.isArray(fb.attachments) && fb.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-semibold mb-2">첨부파일:</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"> {/* 그리드 레이아웃 및 gap 조정 */}
                                {fb.attachments.map((att, idx) => {
                                  const attachment = att as any;
                                  if (attachment && typeof attachment === 'object' && attachment.publicURL) {
                                    if (attachment.type?.startsWith('image/')) {
                                      return (
                                        <div key={idx} className="my-1 text-center">
                                          <img
                                            src={attachment.publicURL}
                                            alt={attachment.name || `첨부 이미지 ${idx + 1}`}
                                            className="w-full h-36 sm:h-40 md:h-48 rounded-md border object-cover mx-auto mb-1 cursor-pointer hover:opacity-80 transition-opacity" // 그리드에 맞게, object-cover
                                            onClick={() => {
                                              if (Array.isArray(fb.attachments)) {
                                                const imageAttachments = fb.attachments.filter(a => a && typeof a === 'object' && (a as any).type?.startsWith('image/'));
                                                const imageIndex = imageAttachments.findIndex(imgAtt => imgAtt && typeof imgAtt === 'object' && (imgAtt as any).publicURL === attachment.publicURL);
                                                if (imageIndex !== -1) {
                                                  handleMyFeedbackImageClick(attachment.publicURL, imageIndex, fb.attachments);
                                                }
                                              }
                                            }}
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">{attachment.name}</p>
                                        </div>
                                      );
                                    } else if (attachment.type?.startsWith('video/')) {
                                      return (
                                        <div key={idx} className="my-1 text-center">
                                          <video src={attachment.publicURL} controls className="w-full h-36 sm:h-40 md:h-48 rounded-md border object-cover mx-auto mb-1" /> {/* 그리드에 맞게, object-cover */}
                                          <p className="text-xs text-muted-foreground mt-1">{attachment.name}</p>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div key={idx} className="my-1">
                                          <a href={attachment.publicURL} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                            <Paperclip className="inline-block mr-1 h-4 w-4" />{attachment.name || `첨부파일 ${idx + 1} 다운로드`}
                                          </a>
                                        </div>
                                      );
                                    }
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">제출한 피드백이 없습니다.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
    <ImageLightboxComponent
      attachments={currentFeedbackAttachments || []}
      currentIndex={currentLightboxIndex}
      isOpen={lightboxOpen}
      onClose={handleMyFeedbackLightboxClose}
      onNavigate={handleMyFeedbackLightboxNavigate}
    />
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>피드백 삭제 확인</AlertDialogTitle>
          <AlertDialogDescription>
            이 피드백을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={closeDeleteDialog}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteFeedback} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </React.Fragment>
  );
};

// Lightbox Dialog Component (Copied from FeedbackDetailModal and renamed)
interface ImageLightboxComponentProps {
  attachments: Json[];
  currentIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

const ImageLightboxComponent: React.FC<ImageLightboxComponentProps> = ({ attachments, currentIndex, isOpen, onClose, onNavigate }) => {
  if (currentIndex === null || !Array.isArray(attachments) || attachments.length === 0) return null;

  const imageAttachments = attachments.filter(att => att && typeof att === 'object' && (att as any).type?.startsWith('image/'));
  if (!imageAttachments.length || currentIndex >= imageAttachments.length) return null;
  
  const currentImage = imageAttachments[currentIndex] as any;
  if (!currentImage || !currentImage.publicURL) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none p-4 flex flex-col items-center justify-center bg-black/95 border-none rounded-none z-[100]"> {/* z-index 추가됨 */}
        {/* Visually hidden title and description for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>첨부 이미지 확대 보기</DialogTitle>
          <DialogDescription>선택한 첨부 이미지를 크게 보여줍니다. 좌우 버튼으로 다른 이미지를 볼 수 있습니다.</DialogDescription>
        </DialogHeader>
        <img src={currentImage.publicURL} alt={currentImage.name || "Enlarged feedback attachment"} className="max-w-full max-h-full object-contain" />
        
        {imageAttachments.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="lg"
              className="absolute left-5 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full cursor-pointer w-12 h-12" // 명시적 크기 추가
              onClick={() => onNavigate('prev')}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="absolute right-5 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full cursor-pointer w-12 h-12" // 명시적 크기 추가
              onClick={() => onNavigate('next')}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-lg bg-black/60 px-4 py-2 rounded-lg shadow-xl"> {/* 폰트/위치/배경 조정 */}
              {currentIndex + 1} / {imageAttachments.length}
            </div>
          </>
        )}
        
        <DialogClose asChild>
          <Button variant="ghost" size="lg" className="absolute top-6 right-6 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full cursor-pointer w-12 h-12"> {/* 명시적 크기 추가 */}
            <XCircle className="h-8 w-8" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackPage;