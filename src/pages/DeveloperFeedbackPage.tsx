import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Popover 추가
import { Loader2, MessageSquareText, Edit3, Trash2, Filter, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types'; // Json 타입은 현재 페이지에서 직접 사용하지 않으므로 제거 가능
import FeedbackDetailModal from '@/components/features/FeedbackDetailModal';

type FeedbackEntry = Tables<'feedbacks'> & {
  profiles: { // profiles 테이블에서 가져올 수 있는 사용자 정보
    first_name: string | null;
    last_name: string | null;
    // email은 feedbacks 테이블에서 직접 가져오므로 여기서는 제외
  } | null;
  feedback_replies: Tables<'feedback_replies'>[];
};

// TODO: 피드백 상세 보기 및 답변 모달/컴포넌트 추가 예정

const DeveloperFeedbackPage = () => {
  const { user } = useAuth(); // 현재 로그인한 개발자/관리자 정보
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // TODO: 페이지네이션, 정렬 기능 추가 예정

  const fetchFeedbacks = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('feedbacks')
        .select('*,feedback_replies(id,content,created_at,replier_id,feedback_id)')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (filterType !== 'all') {
        query = query.eq('feedback_type', filterType);
      }
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const feedbacksWithProfiles = await Promise.all(
          data.map(async (fb) => {
            let profileData: { first_name: string | null; last_name: string | null } | null = null;
            if (fb.user_id) {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', fb.user_id)
                .maybeSingle(); // .single() 대신 .maybeSingle() 사용하여 결과가 없어도 오류 발생 안하도록
              if (profileError) {
                // PGRST116 (No rows found)는 maybeSingle() 사용 시 error로 간주되지 않음.
                // 다른 종류의 오류만 콘솔에 출력
                console.error(`Error fetching profile for user_id ${fb.user_id}:`, profileError);
              }
              profileData = profile;
            }
            return { ...fb, profiles: profileData };
          })
        );
        setFeedbacks(feedbacksWithProfiles as FeedbackEntry[]);
      } else {
        setFeedbacks([]);
      }

    } catch (error: any) {
      console.error("Error fetching feedbacks:", error);
      toast({ title: "오류", description: "피드백 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterType, searchTerm, toast]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);
  
  const handleStatusChange = async (feedbackId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ status: newStatus })
        .eq('id', feedbackId);
      if (error) throw error;
      toast({ title: "성공", description: "피드백 상태가 업데이트되었습니다." });
      fetchFeedbacks(); // 목록 새로고침
    } catch (error: any) {
      toast({ title: "오류", description: `상태 업데이트 중 오류: ${error.message}`, variant: "destructive" });
    }
  };


  const handleOpenModal = (feedback: FeedbackEntry) => {
    setSelectedFeedback(feedback);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFeedback(null);
  };

  const handleReplySubmitted = () => {
    fetchFeedbacks(); // 피드백 목록 새로고침
    // 또는 선택된 피드백의 답변만 업데이트하는 로직 추가 가능
    if (selectedFeedback) {
      // Optimistically update or refetch just the selected feedback's replies
      // For simplicity, we refetch all feedbacks here.
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">사용자 피드백 관리</CardTitle>
            <CardDescription>제출된 사용자 피드백을 확인하고 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col sm:flex-row gap-2">
              <Input 
                placeholder="제목 또는 내용 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="유형 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">유형 전체</SelectItem>
                  <SelectItem value="문의">문의사항</SelectItem>
                  <SelectItem value="기능요청">기능 요청</SelectItem>
                  <SelectItem value="버그리포트">버그 리포트</SelectItem>
                  <SelectItem value="기타">기타 의견</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="상태 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">상태 전체</SelectItem>
                  <SelectItem value="접수됨">접수됨</SelectItem>
                  <SelectItem value="확인중">확인중</SelectItem>
                  <SelectItem value="처리중">처리중</SelectItem>
                  <SelectItem value="완료됨">완료됨</SelectItem>
                  <SelectItem value="보류">보류</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchFeedbacks} variant="outline" className="sm:ml-auto">
                <Filter className="mr-2 h-4 w-4" /> 필터 적용
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : feedbacks.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">제출일</TableHead>
                      <TableHead className="w-[150px]">제출자</TableHead>
                      <TableHead className="w-[120px]">유형</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-[120px]">상태</TableHead>
                      <TableHead className="w-[150px] text-right">답변/관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbacks.map((fb) => (
                      <TableRow key={fb.id}>
                        <TableCell>{format(parseISO(fb.created_at), "yy/MM/dd HH:mm")}</TableCell>
                        <TableCell>
                          {fb.user_id ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="link" className="p-0 h-auto text-current hover:no-underline focus:ring-0">
                                  ID: {fb.user_id.substring(0, 6)}...
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto text-sm" side="top" align="start">
                                <div className="grid gap-1">
                                  <div className="font-medium">제출자 정보</div>
                                  <p><strong>이름:</strong> {fb.profiles?.first_name || '-'} {fb.profiles?.last_name || ''}</p>
                                  <p><strong>이메일:</strong> {fb.email || '-'}</p>
                                  <p><strong>전체 ID:</strong> {fb.user_id}</p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            fb.email || '익명'
                          )}
                        </TableCell>
                        <TableCell>{fb.feedback_type}</TableCell>
                        <TableCell className="font-medium truncate max-w-xs">{fb.title}</TableCell>
                        <TableCell>
                          <Select value={fb.status} onValueChange={(newStatus) => handleStatusChange(fb.id, newStatus)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="접수됨">접수됨</SelectItem>
                              <SelectItem value="확인중">확인중</SelectItem>
                              <SelectItem value="처리중">처리중</SelectItem>
                              <SelectItem value="완료됨">완료됨</SelectItem>
                              <SelectItem value="보류">보류</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleOpenModal(fb)}>
                            <MessageSquareText className="mr-1 h-3 w-3" /> 보기/답변
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">피드백이 없습니다.</p>
            )}
          </CardContent>
          {/* TODO: 페이지네이션 추가 */}
        </Card>
      </div>
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onReplySubmitted={handleReplySubmitted}
        />
      )}
    </AppLayout>
  );
};

export default DeveloperFeedbackPage;