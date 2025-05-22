// MemberStatsCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { fetchMemberStats, MemberStatsData } from '@/lib/dashboardQueries';

const MemberStatsCard = () => {
  const { userCenter } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<MemberStatsData, Error>({
    queryKey: ['dashboard', 'memberStats', userCenter],
    queryFn: () => fetchMemberStats(userCenter),
    enabled: !!userCenter,
    onError: (err: any) => {
      toast({
        title: "오류",
        description: `회원 통계 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // You might want to render a specific error UI here
    // For now, it will show nothing or rely on the toast for feedback.
  }


  const { memberCount = 0, activeMembers = 0, previousMonthActiveMembers = 0 } = data || {};

  return (
    <Card className="min-h-[150px]">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">총 회원 수</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{memberCount}명</div>
            <p className="text-xs text-muted-foreground mt-1">
              {previousMonthActiveMembers !== null ? (
                activeMembers > previousMonthActiveMembers ? (
                  <span className="text-green-500 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 +{activeMembers - previousMonthActiveMembers}명
                  </span>
                ) : activeMembers < previousMonthActiveMembers ? (
                  <span className="text-red-500 flex items-center">
                    <TrendingDown className="h-4 w-4 mr-1" /> 전월 대비 {activeMembers - previousMonthActiveMembers}명
                  </span>
                ) : (
                  <span className="text-orange-500 flex items-center">
                    <Minus className="h-4 w-4 mr-1" /> 전월 대비 변동 없음
                  </span>
                )
              ) : (
                <span>활성 회원: {activeMembers}명</span>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MemberStatsCard;
