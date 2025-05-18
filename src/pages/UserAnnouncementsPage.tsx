import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type Announcement = Tables<'announcements'>;

const ITEMS_PER_PAGE = 10; // 페이지당 항목 수 (필요시 페이징 구현)

export function UserAnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState<Announcement | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const announcementIdFromUrl = searchParams.get('id');

  // 공지사항 목록 조회 (게시된 것만)
  const fetchPublishedAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false }) // 게시일 기준 최신순
        // TODO: 페이징 구현 시 .range() 추가
        ;

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({ title: "오류", description: `공지사항 로딩 실패: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // 공지사항 상세 조회
  const fetchAnnouncementDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    setSelectedAnnouncementDetail(null);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .eq('is_published', true) // 게시된 공지사항만 상세 보기 허용
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // 행이 없는 경우는 정상 처리
      
      if (data) {
        setSelectedAnnouncementDetail(data);
      } else {
        toast({ title: "정보", description: "해당 공지사항을 찾을 수 없거나 게시되지 않았습니다.", variant: "default" });
        navigate('/announcements', { replace: true }); // 목록으로 이동
      }
    } catch (err: any) {
      toast({ title: "오류", description: "공지사항 상세 정보를 불러오는데 실패했습니다: " + err.message, variant: "destructive" });
      navigate('/announcements', { replace: true });
    } finally {
      setIsLoadingDetail(false);
    }
  }, [toast, navigate]);

  useEffect(() => {
    if (announcementIdFromUrl) {
      fetchAnnouncementDetail(announcementIdFromUrl);
    } else {
      setSelectedAnnouncementDetail(null);
      fetchPublishedAnnouncements();
    }
  }, [announcementIdFromUrl, fetchAnnouncementDetail, fetchPublishedAnnouncements]);

  const handleBackToList = () => {
    navigate('/announcements');
  };

  if (isLoadingDetail || (isLoading && !selectedAnnouncementDetail && !announcementIdFromUrl)) {
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
                게시일: {selectedAnnouncementDetail.published_at ? format(parseISO(selectedAnnouncementDetail.published_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko }) : '날짜 정보 없음'}
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

  // 공지사항 목록 표시
  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">공지사항</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>전체 공지사항</CardTitle>
            <CardDescription>새로운 소식들을 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && announcements.length === 0 && <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {!isLoading && announcements.length === 0 && <p className="text-center text-muted-foreground py-4">등록된 공지사항이 없습니다.</p>}
            {!isLoading && announcements.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead className="text-right">게시일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((ann) => (
                    <TableRow key={ann.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/announcements?id=${ann.id}`)}>
                      <TableCell className="font-medium">{ann.title}</TableCell>
                      <TableCell className="text-right">
                        {ann.published_at ? format(parseISO(ann.published_at), 'yyyy.MM.dd', { locale: ko }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {/* TODO: 페이징 UI 추가 */}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default UserAnnouncementsPage;