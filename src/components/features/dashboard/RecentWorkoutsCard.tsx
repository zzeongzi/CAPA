// src/components/features/dashboard/RecentWorkoutsCard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { History, ChevronRight } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { fetchRecentWorkouts, RecentWorkout } from '@/lib/dashboardQueries';

const ITEMS_PER_LOG_CARD = 4; // Assuming this constant is also used for workouts

const RecentWorkoutsCard = () => {
  const navigate = useNavigate();
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [workoutCurrentPage, setWorkoutCurrentPage] = useState(1);

  const { data: recentWorkouts = [], isLoading, error } = useQuery<RecentWorkout[], Error>({
    queryKey: ['dashboard', 'recentWorkouts', userCenter],
    queryFn: () => fetchRecentWorkouts(userCenter),
    enabled: !!userCenter,
    onError: (err) => {
      toast({
        title: "오류",
        description: `최근 운동 기록 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // Error is handled by toast
  }

  const paginatedWorkouts = recentWorkouts.slice((workoutCurrentPage - 1) * ITEMS_PER_LOG_CARD, workoutCurrentPage * ITEMS_PER_LOG_CARD);
  const totalPages = Math.ceil(recentWorkouts.length / ITEMS_PER_LOG_CARD);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">최근 운동 기록</CardTitle>
          </div>
          <CardDescription>최근 저장된 회원 운동 기록 내역</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/workout-history')}>
          모든 기록 보기 <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="w-full space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : paginatedWorkouts.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedWorkouts.map((workout) => (
                <div key={workout.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={workout.members?.profile_image_url || undefined} />
                      <AvatarFallback>{workout.members?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{workout.members?.name || '알 수 없는 회원'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(workout.session_date), 'yyyy.MM.dd HH:mm')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate max-w-[150px]">{workout.exerciseSummary || workout.notes || '기록 없음'}</p>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/workout-history', { state: { selectedWorkoutSessionId: workout.id } })}>
                    보기
                  </Button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setWorkoutCurrentPage(p => Math.max(1, p - 1))} disabled={workoutCurrentPage === 1}>이전</Button>
                <span className="text-sm text-muted-foreground">{workoutCurrentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setWorkoutCurrentPage(p => Math.min(totalPages, p + 1))} disabled={workoutCurrentPage === totalPages}>다음</Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <History className="h-10 w-10 mb-2 opacity-20" />
            <p>최근 운동 기록이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentWorkoutsCard;
