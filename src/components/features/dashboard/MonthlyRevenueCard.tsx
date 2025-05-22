// MonthlyRevenueCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { fetchFinancialData, FinancialData } from '@/lib/dashboardQueries';

// Helper function (consider moving to a shared utils file if used elsewhere)
const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

const MonthlyRevenueCard = () => {
  const { user, userCenter } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<FinancialData, Error>({
    queryKey: ['dashboard', 'financials', user?.id, userCenter],
    queryFn: () => fetchFinancialData(user?.id, userCenter),
    enabled: !!user && !!userCenter,
    select: (data) => ({ // Select only revenue data for this component
      // salaryData is not needed here, but fetched by the query
      revenueData: data.revenueData,
    } as FinancialData), // Cast to FinancialData to satisfy type
    onError: (err: any) => {
      toast({
        title: "오류",
        description: `월간 매출 정보 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // Error state will be handled by toast
  }

  const monthlyRevenueData = data?.revenueData || { currentRevenue: 0, targetRevenue: null, achievementRate: null, percentageChange: null };
  
  return (
    <Card className="min-h-[150px]">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">월간 계약 매출</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-28 mb-1" />
            <Skeleton className="h-4 w-20" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{formatCurrency(monthlyRevenueData.currentRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyRevenueData.targetRevenue !== null && monthlyRevenueData.targetRevenue > 0 ? (
                monthlyRevenueData.achievementRate !== null ? (
                  `목표 대비 ${monthlyRevenueData.achievementRate.toFixed(1)}% 달성`
                ) : (
                  `목표: ${formatCurrency(monthlyRevenueData.targetRevenue)}`
                )
              ) : (
                "월 목표 매출 미설정"
              )}
            </p>
            {monthlyRevenueData.percentageChange !== null && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                {monthlyRevenueData.percentageChange === Infinity ? (
                  <span className="text-green-500 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 증가 (전월 0)
                  </span>
                ) : monthlyRevenueData.percentageChange > 0 ? (
                  <span className="text-green-500 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 +{monthlyRevenueData.percentageChange.toFixed(1)}%
                  </span>
                ) : monthlyRevenueData.percentageChange < 0 ? (
                  <span className="text-red-500 flex items-center">
                    <TrendingDown className="h-4 w-4 mr-1" /> 전월 대비 {monthlyRevenueData.percentageChange.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-orange-500 flex items-center">
                    <Minus className="h-4 w-4 mr-1" /> 전월 대비 변동 없음
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyRevenueCard;
