// SessionStatsCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle, UserX } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { fetchSessionStats, SessionStatsData } from '@/lib/dashboardQueries';

const SessionStatsCard = () => {
  const { userCenter } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<SessionStatsData, Error>({
    queryKey: ['dashboard', 'sessionStats', userCenter],
    queryFn: () => fetchSessionStats(userCenter),
    enabled: !!userCenter,
    onError: (err: any) => {
      toast({
        title: "오류",
        description: `세션 통계 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });
  
  if (error) {
    // You might want to render a specific error UI here
  }

  const { sessionCount = 0, completedSessions = 0, canceledSessions = 0 } = data || {};

  return (
    <Card className="min-h-[150px]">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">이번 달 PT 수</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{sessionCount}건</div>
            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                <span>완료 {completedSessions}건</span>
              </div>
              <div className="flex items-center">
                <UserX className="h-4 w-4 mr-1 text-red-500" />
                <span>노쇼 {canceledSessions}건</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionStatsCard;
