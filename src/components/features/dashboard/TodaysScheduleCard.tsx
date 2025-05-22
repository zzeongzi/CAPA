// src/components/features/dashboard/TodaysScheduleCard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronRight } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { fetchTodaysSchedule, ScheduleItem } from '@/lib/dashboardQueries';

const ITEMS_PER_SCHEDULE_CARD = 4;

const TodaysScheduleCard = () => {
  const navigate = useNavigate();
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [scheduleCurrentPage, setScheduleCurrentPage] = useState(1);

  const { data: scheduleItems = [], isLoading, error } = useQuery<ScheduleItem[], Error>({
    queryKey: ['dashboard', 'todaysSchedule', userCenter],
    queryFn: () => fetchTodaysSchedule(userCenter),
    enabled: !!userCenter,
    onError: (err) => {
      toast({
        title: "오류",
        description: `오늘의 일정 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });
  
  if (error) {
    // Error is handled by toast
  }

  const paginatedScheduleItems = scheduleItems.slice((scheduleCurrentPage - 1) * ITEMS_PER_SCHEDULE_CARD, scheduleCurrentPage * ITEMS_PER_SCHEDULE_CARD);
  const totalSchedulePages = Math.ceil(scheduleItems.length / ITEMS_PER_SCHEDULE_CARD);

  return (
    <Card className="lg:col-span-5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">오늘의 일정</CardTitle>
          </div>
          <CardDescription>예약된 PT 세션과 클래스</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
          전체 일정 보기 <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="w-full space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : paginatedScheduleItems.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedScheduleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.members?.profile_image_url || undefined} />
                      <AvatarFallback>{item.members?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{item.members?.name || '알 수 없는 회원'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(item.start_time), 'HH:mm')} ({item.duration}분) - {item.type}
                      </p>
                    </div>
                  </div>
                  <div>
                    {item.status === 'completed' && <Badge variant="secondary" className="text-green-600 border-green-600 bg-green-100 dark:bg-green-900/30">완료</Badge>}
                    {item.status === 'scheduled' && <Badge variant="outline" className="text-blue-600 border-blue-600">예약</Badge>}
                    {item.status === 'canceled' && <Badge variant="destructive">취소/노쇼</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/schedule', { state: { highlightId: item.id } })}>
                    상세
                  </Button>
                </div>
              ))}
            </div>
            {totalSchedulePages > 1 && (
              <div className="mt-4 flex justify-center items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setScheduleCurrentPage(p => Math.max(1, p - 1))} disabled={scheduleCurrentPage === 1}>이전</Button>
                <span className="text-sm text-muted-foreground">{scheduleCurrentPage} / {totalSchedulePages}</span>
                <Button variant="outline" size="sm" onClick={() => setScheduleCurrentPage(p => Math.min(totalSchedulePages, p + 1))} disabled={scheduleCurrentPage === totalSchedulePages}>다음</Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Calendar className="h-10 w-10 mb-2 opacity-20" />
            <p>오늘 예약된 일정이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysScheduleCard;
