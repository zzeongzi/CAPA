import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import type { Tables, Json } from '@/integrations/supabase/types';
import { Loader2, MessageSquareText, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

// DeveloperFeedbackPage에서 사용하는 FeedbackEntry 타입과 유사하게 정의
// 필요시 DeveloperFeedbackPage의 타입을 import하여 사용 가능
type FeedbackEntry = Tables<'feedbacks'> & {
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  feedback_replies: Tables<'feedback_replies'>[];
};

interface FeedbackDetailModalProps {
  feedback: FeedbackEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onReplySubmitted: () => void; // 답변 제출 후 호출될 콜백
}

const FeedbackDetailModal: React.FC<FeedbackDetailModalProps> = ({ feedback, isOpen, onClose, onReplySubmitted }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replies, setReplies] = useState<Tables<'feedback_replies'>[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (feedback) {
      setReplies(feedback.feedback_replies || []);
    }
  }, [feedback]);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !feedback || !user) {
      toast({ title: "오류", description: "답변 내용을 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert({
          feedback_id: feedback.id,
          replier_id: user.id, // 현재 로그인한 개발자/관리자 ID
          content: replyContent,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setReplies(prevReplies => [...prevReplies, data]);
      }
      toast({ title: "성공", description: "답변이 성공적으로 제출되었습니다." });
      setReplyContent('');
      onReplySubmitted(); // 부모 컴포넌트에 알림
    } catch (error: any) {
      console.error("Error submitting reply:", error);
      toast({ title: "오류", description: `답변 제출 중 오류 발생: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageClick = (src: string, index: number) => {
    setLightboxImageSrc(src);
    setCurrentLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setLightboxOpen(false);
    setLightboxImageSrc(null);
    setCurrentLightboxIndex(null);
  };

  const handleLightboxNavigate = (direction: 'prev' | 'next') => {
    if (feedback && Array.isArray(feedback.attachments) && currentLightboxIndex !== null) {
      const imageAttachments = feedback.attachments.filter(att => att && typeof att === 'object' && (att as any).type?.startsWith('image/'));
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

  if (!feedback) return null;

  const getSubmitterName = () => {
    const firstName = feedback.profiles?.first_name;
    const lastName = feedback.profiles?.last_name;
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || '정보 없음';
    const emailToDisplay = feedback.email || '정보 없음';
    
    let userIdDisplay = 'ID 정보 없음';
    if (feedback.user_id) {
      userIdDisplay = `ID: ${feedback.user_id.slice(0, 6)}...`;
    }

    return `${userIdDisplay}, 이름: ${fullName}, 이메일: ${emailToDisplay}`;
  };

  return (
    <React.Fragment>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">피드백 상세 및 답변</DialogTitle>
          <DialogDescription>피드백 내용을 확인하고 답변을 작성할 수 있습니다.</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(100vh-250px)] pr-6">
          <div className="space-y-4 py-4">
            <div>
              <h3 className="font-medium mb-1">제목</h3>
              <p className="text-sm p-3 bg-muted rounded-md">{feedback.title}</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">제출자</h3>
              <p className="text-sm p-3 bg-muted rounded-md">{getSubmitterName()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-1">제출일</h3>
                <p className="text-sm p-3 bg-muted rounded-md">{format(parseISO(feedback.created_at), "yyyy년 MM월 dd일 HH:mm:ss")}</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">유형</h3>
                <div className="text-sm p-3 bg-muted rounded-md"><Badge variant="outline">{feedback.feedback_type}</Badge></div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-1">상태</h3>
              <div className="text-sm p-3 bg-muted rounded-md"><Badge>{feedback.status}</Badge></div>
            </div>
            <div>
              <h3 className="font-medium mb-1">내용</h3>
              <div className="text-sm p-3 bg-muted rounded-md min-h-[100px] whitespace-pre-wrap">
                {feedback.content}
              </div>
            </div>

            {feedback.attachments && (
              <div>
                <h3 className="font-medium mb-1">첨부파일</h3>
                {Array.isArray(feedback.attachments) && feedback.attachments.length > 0 ? (
                  <div className="p-3 bg-muted rounded-md grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"> {/* 그리드 레이아웃 및 gap 조정 */}
                    {feedback.attachments.map((att, index) => {
                      const attachment = att as any;
                      if (attachment && typeof attachment === 'object' && attachment.publicURL) {
                        if (attachment.type?.startsWith('image/')) {
                          return (
                            <div key={index} className="my-2 text-center"> {/* 이미지와 파일명을 가운데 정렬하기 위해 text-center 추가 */}
                              <img
                                src={attachment.publicURL}
                                alt={attachment.name || `첨부 이미지 ${index + 1}`}
                                className="w-full h-36 sm:h-40 md:h-48 rounded-md border object-cover mx-auto mb-1 cursor-pointer hover:opacity-80 transition-opacity" // FeedbackPage와 동일하게 크기 조정
                                onClick={() => {
                                  if (Array.isArray(feedback.attachments)) {
                                    const imageAttachments = feedback.attachments.filter(att => att && typeof att === 'object' && (att as any).type?.startsWith('image/'));
                                    const imageIndex = imageAttachments.findIndex(imgAtt => imgAtt && typeof imgAtt === 'object' && (imgAtt as any).publicURL === attachment.publicURL);
                                    if (imageIndex !== -1) {
                                      handleImageClick(attachment.publicURL, imageIndex);
                                    }
                                  }
                                }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">{attachment.name || `첨부파일 ${index + 1}`}</p>
                            </div>
                          );
                        } else if (attachment.type?.startsWith('video/')) {
                          return (
                            <div key={index} className="my-2 text-center">
                              <video src={attachment.publicURL} controls className="w-full h-36 sm:h-40 md:h-48 rounded-md border object-cover mx-auto mb-1"> {/* FeedbackPage와 동일하게 크기 조정 */}
                                브라우저가 비디오 태그를 지원하지 않습니다.
                              </video>
                              <p className="text-xs text-muted-foreground mt-1">{attachment.name || `첨부파일 ${index + 1}`}</p>
                            </div>
                          );
                        } else {
                          return (
                            <div key={index} className="my-2">
                              <a href={attachment.publicURL} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                {attachment.name || `첨부파일 ${index + 1} 다운로드`}
                              </a>
                            </div>
                          );
                        }
                      }
                      return (
                        <div key={index} className="my-2">
                           <p className="text-xs text-muted-foreground">잘못된 첨부파일 형식 또는 URL 없음: {attachment?.name || `Raw: ${JSON.stringify(att)}`}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm p-3 bg-muted rounded-md text-muted-foreground">첨부파일이 없습니다.</p>
                )}
              </div>
            )}

            <div className="pt-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <MessageSquareText className="mr-2 h-5 w-5" /> 답변
              </h3>
              {replies.length > 0 ? (
                <div className="space-y-3">
                  {replies.map((reply) => (
                    <div key={reply.id} className="p-3 border rounded-md bg-slate-50 dark:bg-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          답변자: {reply.replier_id ? `...${reply.replier_id.slice(-6)}` : '시스템'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(reply.created_at), "yy/MM/dd HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">아직 등록된 답변이 없습니다.</p>
              )}
            </div>

            <div className="pt-4">
              <h3 className="font-medium mb-2">새 답변 작성</h3>
              <Textarea
                placeholder="답변 내용을 입력하세요..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                className="mb-2"
              />
              <Button onClick={handleSubmitReply} disabled={isSubmitting || !replyContent.trim()}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                답변 제출
              </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sm:justify-start mt-2">
          {/* Hide main modal's close button when lightbox is open */}
          <DialogClose asChild className={lightboxOpen ? 'invisible' : ''}>
            <Button type="button" variant="outline">
              닫기
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Image Lightbox */}
    <ImageLightbox
      attachments={Array.isArray(feedback.attachments) ? feedback.attachments : []}
      currentIndex={currentLightboxIndex}
      isOpen={lightboxOpen}
      onClose={handleLightboxClose}
      onNavigate={handleLightboxNavigate}
    />
    </React.Fragment>
  );
};

// Lightbox Dialog Component
interface ImageLightboxProps {
  attachments: Json[];
  currentIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ attachments, currentIndex, isOpen, onClose, onNavigate }) => {
  if (currentIndex === null || !Array.isArray(attachments) || attachments.length === 0) return null;

  const imageAttachments = attachments.filter(att => att && typeof att === 'object' && (att as any).type?.startsWith('image/'));
  if (currentIndex >= imageAttachments.length) return null; // Index out of bounds
  
  const currentImage = imageAttachments[currentIndex] as any;

  if (!currentImage || !currentImage.publicURL) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none p-4 flex flex-col items-center justify-center bg-black border-none rounded-none z-[100] [&>.absolute.right-4.top-4]:hidden">
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
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-lg bg-black/60 px-4 py-2 rounded-lg shadow-xl">
              {currentIndex + 1} / {imageAttachments.length}
            </div>
          </>
        )}
        
        <Button
          variant="ghost"
          size="lg"
          className="absolute top-6 right-6 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full cursor-pointer w-12 h-12"
          onClick={onClose}
        >
          <XCircle className="h-8 w-8" />
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDetailModal;