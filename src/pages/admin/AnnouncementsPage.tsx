import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Edit, Trash2, Loader2, Eye, EyeOff, Send, Bold, Italic, Strikethrough, Image as ImageIcon, List, ListOrdered, ArrowLeft } from 'lucide-react'; // ArrowLeft 추가
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSearchParams, useNavigate } from 'react-router-dom'; // useSearchParams, useNavigate 추가
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch"; // Switch 추가

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
// TipTap CSS (필요한 경우 전역 또는 컴포넌트 레벨에서 import)
// import './tiptap-styles.css'; // 예시 경로

type Announcement = Tables<'announcements'> & {
  // 필요한 경우 author 정보 조인 (예: profiles 테이블)
  // author_profile?: Tables<'profiles'> | null; 
};

const AnnouncementsPage = () => {
  const { user } = useAuth(); // 개발자/관리자 역할 확인 필요
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [centers, setCenters] = useState<Tables<'centers'>[]>([]);
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 페이지당 항목 수
  const [totalAnnouncements, setTotalAnnouncements] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'unpublished'>('all');
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState<Announcement | null>(null); // 상세 보기용 상태
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); // 상세 보기 로딩 상태
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newAnnouncement, setNewAnnouncement] = useState<Partial<TablesInsert<'announcements'>>>({
    title: '',
    content: '',
    is_published: false,
    target_audience_type: 'ALL',
  });

  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력을 위한 ref 추가

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image, // 이미지 확장 기능 추가
    ],
    content: newAnnouncement.content || '', // 초기 콘텐츠
    onUpdate: ({ editor: currentEditor }) => {
      setNewAnnouncement(prev => ({ ...prev, content: currentEditor.getHTML() }));
    },
  });

  useEffect(() => {
    // 편집 모드일 때 에디터 내용 설정
    if (editingAnnouncement && editor && editor.getHTML() !== editingAnnouncement.content) {
      editor.commands.setContent(editingAnnouncement.content || '');
    } else if (!editingAnnouncement && editor && editor.getHTML() !== '') {
      // 새 공지사항 작성 모드일 때 에디터 내용 초기화 (필요시)
      // editor.commands.setContent('');
    }
  }, [editingAnnouncement, editor]);


  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('announcements')
        .select('*', { count: 'exact' }); // count 옵션 추가

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      if (filterStatus === 'published') {
        query = query.eq('is_published', true);
      } else if (filterStatus === 'unpublished') {
        query = query.eq('is_published', false);
      }

      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      query = query.order('created_at', { ascending: false }).range(startIndex, endIndex);

      const { data, error, count } = await query;

      if (error) throw error;
      setAnnouncements(data || []);
      setTotalAnnouncements(count || 0);
    } catch (error: any) {
      toast({ title: "오류", description: `공지사항 로딩 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentPage, itemsPerPage, searchTerm, filterStatus]);

  useEffect(() => {
    const announcementIdFromUrl = searchParams.get('id');
    if (announcementIdFromUrl) {
      const fetchAnnouncementDetail = async (id: string) => {
        console.log('[AnnouncementsPage] Fetching detail for announcement ID:', id);
        setIsLoadingDetail(true);
        setSelectedAnnouncementDetail(null); // 이전 상세 내용 초기화
        try {
          const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('id', id)
            .single();
          if (error) throw error;
          setSelectedAnnouncementDetail(data);
        } catch (err: any) {
          toast({ title: "오류", description: "공지사항 상세 정보를 불러오는데 실패했습니다: " + err.message, variant: "destructive" });
          navigate('/admin/announcements', { replace: true }); // 오류 시 목록으로
        } finally {
          setIsLoadingDetail(false);
        }
      };
      fetchAnnouncementDetail(announcementIdFromUrl);
    } else {
      setSelectedAnnouncementDetail(null); // id 파라미터 없으면 상세 내용 없음
      fetchAnnouncements(); // 목록 조회
    }
  }, [searchParams, fetchAnnouncements, toast, navigate]);


  useEffect(() => {
    const fetchCenters = async () => {
      setIsLoadingCenters(true);
      try {
        const { data, error } = await supabase.from('centers').select('*').order('name'); // id, name 대신 모든 컬럼(*)을 가져오도록 수정
        if (error) throw error;
        setCenters(data || []);
      } catch (error: any) {
        toast({ title: "오류", description: `센터 목록 로딩 실패: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingCenters(false);
      }
    };
    fetchCenters();
  }, [toast]);

  const handleDialogOpen = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setNewAnnouncement({ // 편집 시 기존 데이터로 폼 채우기
        title: announcement.title,
        content: announcement.content,
        is_published: announcement.is_published,
        target_audience_type: announcement.target_audience_type,
        target_center_id: announcement.target_center_id,
        published_at: announcement.published_at ? new Date(announcement.published_at).toISOString().substring(0, 16) : undefined,
        image_urls: announcement.image_urls,
      });
      editor?.commands.setContent(announcement.content || '');
    } else {
      setEditingAnnouncement(null);
      setNewAnnouncement({ title: '', content: '', is_published: false, target_audience_type: 'ALL' });
      editor?.commands.setContent('');
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingAnnouncement(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement; // target을 HTMLInputElement로 먼저 단언
    const { name, value, type } = target; // target에서 name, value, type을 가져옴
    const valueToSet = type === 'checkbox' ? target.checked : value;
    setNewAnnouncement(prev => ({ ...prev, [name]: valueToSet }));
  };

  const handleTriggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []); // fileInputRef는 변경되지 않으므로 의존성 배열 비워도 됨

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !editor || !user) {
      return;
    }
    const file = event.target.files[0];
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const bucketName = 'announcement-images'; // Supabase Storage 버킷 이름

    setIsLoading(true);
    toast({ title: "알림", description: "이미지 업로드 중..." });

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);
      
      if (urlData.publicUrl) {
        editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
        toast({ title: "성공", description: "이미지가 성공적으로 업로드 및 삽입되었습니다." });
      } else {
        throw new Error("이미지 URL을 가져오지 못했습니다.");
      }
    } catch (error: any) {
      console.error("Image upload error:", error);
      toast({ title: "오류", description: `이미지 업로드 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [editor, user, toast, setIsLoading]);

  const handleSubmit = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast({ title: "오류", description: "제목과 내용을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!user) {
        toast({ title: "오류", description: "인증 정보가 없습니다.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      let error;
      if (editingAnnouncement) {
        // 수정
        const updateData: TablesUpdate<'announcements'> = {
          ...newAnnouncement,
          author_id: user.id, // 수정 시에도 author_id 업데이트 또는 최초 작성자 유지 정책 필요
          updated_at: new Date().toISOString(),
          published_at: newAnnouncement.published_at ? new Date(newAnnouncement.published_at).toISOString() : null,
        };
        ({ error } = await supabase.from('announcements').update(updateData).eq('id', editingAnnouncement.id));
      } else {
        // 생성
        // handleSubmit 상단에서 title과 content가 비어있지 않음을 확인했으므로, 여기서는 undefined가 아님을 단언합니다.
        const insertData: TablesInsert<'announcements'> = {
          ...newAnnouncement,
          title: newAnnouncement.title!,
          content: newAnnouncement.content!,
          author_id: user.id,
          published_at: newAnnouncement.published_at ? new Date(newAnnouncement.published_at).toISOString() : null,
        };
        ({ error } = await supabase.from('announcements').insert(insertData));
      }

      if (error) throw error;
      toast({ title: "성공", description: `공지사항이 성공적으로 ${editingAnnouncement ? '수정' : '저장'}되었습니다.` });
      fetchAnnouncements();
      handleDialogClose();
    } catch (error: any) {
      toast({ title: "오류", description: `공지사항 저장 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const openDeleteDialog = (announcementId: string) => {
    setDeletingAnnouncementId(announcementId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAnnouncementId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', deletingAnnouncementId);
      
      if (error) throw error;
      toast({ title: "성공", description: "공지사항이 삭제되었습니다." });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: "오류", description: `공지사항 삭제 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false);
      setDeletingAnnouncementId(null);
    }
  };

  const handleTogglePublish = async (announcement: Announcement) => {
    setIsLoading(true);
    try {
      const newPublishStatus = !announcement.is_published;
      const newPublishedAt = newPublishStatus ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('announcements')
        .update({
          is_published: newPublishStatus,
          published_at: newPublishedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', announcement.id);

      if (error) throw error;
      toast({ title: "성공", description: `공지사항이 ${newPublishStatus ? '게시' : '미게시'} 처리되었습니다.` });
      fetchAnnouncements(); // 목록 새로고침
    } catch (error: any) {
      toast({ title: "오류", description: `상태 변경 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPushNotification = async (announcementId: string) => {
    if (!announcementId) {
      toast({ title: "오류", description: "공지사항 ID가 없습니다.", variant: "destructive" });
      return;
    }
    setIsLoading(true); // 또는 별도의 isSendingPush 상태 사용
    toast({ title: "알림", description: "푸시 알림을 발송하고 있습니다..." });
    try {
      const { data, error } = await supabase.functions.invoke('send-announcement-push', {
        body: { announcementId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "성공", description: data.message || "푸시 알림이 성공적으로 발송 요청되었습니다." });
      } else {
        throw new Error(data?.error || "푸시 알림 발송에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("Error sending push notification:", error);
      toast({ title: "오류", description: `푸시 알림 발송 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    navigate('/admin/announcements'); // URL에서 id 파라미터 제거하여 목록으로
    // setSearchParams({}); // 이렇게 해도 URL에서 id가 제거되어 useEffect가 다시 실행됨
  };

  if (isLoadingDetail) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 md:px-6 flex justify-center items-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (selectedAnnouncementDetail) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 md:px-6">
          <Button variant="outline" onClick={handleBackToList} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> 목록으로 돌아가기
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{selectedAnnouncementDetail.title}</CardTitle>
              <CardDescription>
                게시일: {selectedAnnouncementDetail.published_at ? format(parseISO(selectedAnnouncementDetail.published_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko }) : (selectedAnnouncementDetail.is_published ? '즉시 게시됨' : '미게시')}
                <br />
                최종 수정일: {format(parseISO(selectedAnnouncementDetail.updated_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncementDetail.content || '' }}
              />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // 기본 목록 표시
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold">공지사항 관리</h1>
          <Button onClick={() => handleDialogOpen()}>
            <PlusCircle className="mr-2 h-4 w-4" /> 새 공지사항 작성
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>공지사항 목록</CardTitle>
            <CardDescription>전체 공지사항 ({totalAnnouncements}개)을 확인하고 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Input
                placeholder="제목 또는 내용 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // 검색 시 첫 페이지로
                }}
                className="max-w-sm"
              />
              <Select value={filterStatus} onValueChange={(value) => {
                setFilterStatus(value as 'all' | 'published' | 'unpublished');
                setCurrentPage(1); // 필터 변경 시 첫 페이지로
              }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="게시 상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="published">게시됨</SelectItem>
                  <SelectItem value="unpublished">미게시</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading && <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {!isLoading && announcements.length === 0 && <p className="text-center text-muted-foreground py-4">{searchTerm || filterStatus !== 'all' ? '검색/필터 결과가 없습니다.' : '등록된 공지사항이 없습니다.'}</p>}
            {!isLoading && announcements.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>게시 상태</TableHead>
                    <TableHead>게시(예약)일</TableHead>
                    <TableHead>최종 수정일</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((ann) => (
                    <TableRow key={ann.id}>
                      <TableCell className="font-medium">{ann.title}</TableCell>
                      <TableCell>
                        {ann.is_published ? (
                          <span className="text-green-600 flex items-center"><Eye className="mr-1 h-4 w-4" /> 게시됨</span>
                        ) : (
                          <span className="text-yellow-600 flex items-center"><EyeOff className="mr-1 h-4 w-4" /> 미게시</span>
                        )}
                      </TableCell>
                      <TableCell>{ann.published_at ? format(parseISO(ann.published_at), 'yy.MM.dd HH:mm', { locale: ko }) : '-'}</TableCell>
                      <TableCell>{format(parseISO(ann.updated_at), 'yy.MM.dd HH:mm', { locale: ko })}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(ann)} className="mr-1" aria-label="수정">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(ann)} aria-label={ann.is_published ? "미게시로 변경" : "게시하기"} className="mr-1">
                          {ann.is_published ? <EyeOff className="h-4 w-4 text-yellow-600" /> : <Eye className="h-4 w-4 text-green-600" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendPushNotification(ann.id)} // ann.title 인자 제거
                          aria-label="푸시 알림 발송"
                          className="mr-1"
                          disabled={isLoading || !ann.is_published}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <AlertDialog open={deletingAnnouncementId === ann.id && isDeleteDialogOpen} onOpenChange={(open) => {
                            if (!open) {
                                setDeletingAnnouncementId(null);
                            }
                            setIsDeleteDialogOpen(open);
                        }}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="삭제" onClick={() => openDeleteDialog(ann.id)} disabled={isLoading}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>공지사항 삭제 확인</AlertDialogTitle>
                              <AlertDialogDescription>
                                정말로 '{ann.title}' 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setDeletingAnnouncementId(null); }}>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={handleConfirmDelete} disabled={isLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "삭제"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {totalAnnouncements > itemsPerPage && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {/* 페이지 번호 목록 동적 생성 (간단한 버전) */}
                    {[...Array(Math.ceil(totalAnnouncements / itemsPerPage))].map((_, i) => (
                       <PaginationItem key={i + 1}>
                         <PaginationLink
                           href="#"
                           isActive={currentPage === i + 1}
                           onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1);}}
                         >
                           {i + 1}
                         </PaginationLink>
                       </PaginationItem>
                     ))}
                    {/* TODO: 페이지가 많을 경우 Ellipsis 처리 추가 */}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage(prev => Math.min(Math.ceil(totalAnnouncements / itemsPerPage), prev + 1)); }}
                        aria-disabled={currentPage === Math.ceil(totalAnnouncements / itemsPerPage)}
                        className={currentPage === Math.ceil(totalAnnouncements / itemsPerPage) ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {isDialogOpen && (
          // Shadcn UI Dialog 사용 예시
          // <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          //   <DialogContent className="sm:max-w-[600px]">
          //     <DialogHeader>
          //       <DialogTitle>{editingAnnouncement ? '공지사항 수정' : '새 공지사항 작성'}</DialogTitle>
          //     </DialogHeader>
          //     <div className="grid gap-4 py-4">
          //       <div>
          //         <Label htmlFor="title">제목</Label>
          //         <Input id="title" name="title" value={newAnnouncement.title || ''} onChange={handleInputChange} />
          //       </div>
          //       <div>
          //         <Label>내용</Label>
          //         {editor && (
          //           <>
          //             <div className="flex flex-wrap gap-1 border rounded-md p-1 mb-1">
          //               <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}><Bold className="h-4 w-4"/></Button>
          //               <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}><Italic className="h-4 w-4"/></Button>
          //               <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''}><Strikethrough className="h-4 w-4"/></Button>
          //               <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}><List className="h-4 w-4"/></Button>
          //               <Button variant="outline" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}><ListOrdered className="h-4 w-4"/></Button>
          //               <Button variant="outline" size="sm" onClick={handleImageUpload}><ImageIcon className="h-4 w-4"/></Button>
          //             </div>
          //             <EditorContent editor={editor} className="border rounded-md min-h-[200px] p-2"/>
          //           </>
          //         )}
          //       </div>
          //       {/* TODO: 게시 여부, 대상, 예약 시간 등 필드 추가 */}
          //     </div>
          //     <DialogFooter>
          //       <Button variant="outline" onClick={handleDialogClose}>취소</Button>
          //       <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (editingAnnouncement ? '수정하기' : '작성하기')}</Button>
          //     </DialogFooter>
          //   </DialogContent>
          // </Dialog>
          // 임시로 간단한 폼으로 대체, 추후 Dialog/Sheet로 개선
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={handleDialogClose}>
            <Card className="w-full max-w-2xl z-50" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>{editingAnnouncement ? '공지사항 수정' : '새 공지사항 작성'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <Label htmlFor="title">제목</Label>
                  <Input id="title" name="title" value={newAnnouncement.title || ''} onChange={handleInputChange} />
                </div>
                <div>
                  <Label>내용</Label>
                  {editor && (
                    <>
                      <div className="flex flex-wrap gap-1 border rounded-md p-1 mb-1">
                        <Button variant={editor.isActive('bold') ? 'default' : 'outline'} size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()}><Bold className="h-4 w-4"/></Button>
                        <Button variant={editor.isActive('italic') ? 'default' : 'outline'} size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()}><Italic className="h-4 w-4"/></Button>
                        <Button variant={editor.isActive('strike') ? 'default' : 'outline'} size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4"/></Button>
                        <Button variant={editor.isActive('bulletList') ? 'default' : 'outline'} size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4"/></Button>
                        <Button variant={editor.isActive('orderedList') ? 'default' : 'outline'} size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4"/></Button>
                        <Button variant="outline" size="sm" onClick={handleTriggerImageUpload}><ImageIcon className="h-4 w-4"/></Button>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                      <EditorContent editor={editor} className="border rounded-md min-h-[200px] p-2 prose dark:prose-invert max-w-none"/>
                    </>
                  )}
                </div>
                {/* TODO: 게시 여부, 대상, 예약 시간 등 필드 추가 */}
                 <div>
                  <Label htmlFor="is_published">게시 여부</Label>
                  <input type="checkbox" id="is_published" name="is_published" checked={newAnnouncement.is_published || false} onChange={handleInputChange} className="ml-2"/>
                </div>
                <div>
                  <Label htmlFor="target_audience_type">게시 대상</Label>
                  <select id="target_audience_type" name="target_audience_type" value={newAnnouncement.target_audience_type || 'ALL'} onChange={handleInputChange} className="w-full p-2 border rounded-md">
                    <option value="ALL">전체</option>
                    <option value="CENTER">특정 센터</option>
                  </select>
                </div>
                {newAnnouncement.target_audience_type === 'CENTER' && (
                  <div>
                    <Label htmlFor="target_center_id">대상 센터</Label>
                    <Select
                      name="target_center_id"
                      value={newAnnouncement.target_center_id || ''}
                      onValueChange={(value) => setNewAnnouncement(prev => ({ ...prev, target_center_id: value === 'ALL_CENTERS_PLACEHOLDER' ? null : value }))}
                    >
                      <SelectTrigger id="target_center_id">
                        <SelectValue placeholder={isLoadingCenters ? "센터 로딩 중..." : "센터를 선택하세요"} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingCenters ? (
                          <SelectItem value="loading" disabled>로딩 중...</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="ALL_CENTERS_PLACEHOLDER">센터 선택 안함 (또는 전체)</SelectItem>
                            {/* 실제로는 target_audience_type이 ALL일때 이 필드가 안보이거나,
                                target_center_id를 null로 저장해야 함.
                                여기서는 사용자가 명시적으로 "선택 안함"을 고를 수 있도록 임시 플레이스홀더 추가 */}
                            {centers.map(center => (
                              <SelectItem key={center.id} value={center.id}>
                                {center.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="published_at">게시(예약) 시간 (선택)</Label>
                  <Input type="datetime-local" id="published_at" name="published_at" value={newAnnouncement.published_at || ''} onChange={handleInputChange} />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleDialogClose}>취소</Button>
                <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (editingAnnouncement ? '수정하기' : '작성하기')}</Button>
              </CardFooter>
            </Card>
          </div>
        )}

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>공지사항 삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>
                이 공지사항을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {setIsDeleteDialogOpen(false); setDeletingAnnouncementId(null);}}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={isLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AnnouncementsPage;