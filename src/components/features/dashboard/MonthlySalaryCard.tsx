// MonthlySalaryCard.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from '@/components/ui/use-toast';
import { fetchFinancialData, FinancialData } from '@/lib/dashboardQueries';

const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

const MonthlySalaryCard = () => {
  const { user, userCenter } = useAuth();
  const { toast } = useToast();
  const [isSalaryDetailsVisible, setIsSalaryDetailsVisible] = useState(false);

  const { data, isLoading, error } = useQuery<FinancialData, Error>({
    queryKey: ['dashboard', 'financials', user?.id, userCenter],
    queryFn: () => fetchFinancialData(user?.id, userCenter),
    enabled: !!user && !!userCenter,
    select: (data) => ({ // Select only salary data for this component
      salaryData: data.salaryData,
      // revenueData is not needed here, but fetched by the query
    } as FinancialData), // Cast to FinancialData to satisfy type, even if revenueData is not used
     onError: (err: any) => {
      toast({
        title: "오류",
        description: `월급 정보 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // Error state will be handled by toast
  }
  
  const monthlySalaryData = data?.salaryData || { total: 0, net: 0, baseSalary: 0, lessonCommission: 0, incentive: 0 };

  return (
    <Card className="min-h-[150px]">
      <Collapsible open={isSalaryDetailsVisible} onOpenChange={setIsSalaryDetailsVisible}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 h-[52px]">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">이번 달 예상 월급</CardTitle>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              {isSalaryDetailsVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">상세 보기 토글</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-8 w-24" /> : (
            <>
              <div className="text-2xl font-bold">{formatCurrency(monthlySalaryData.total)}</div>
              <p className="text-xs text-green-600 mt-1"> 실수령액: {formatCurrency(monthlySalaryData.net)} </p>
              <CollapsibleContent className="space-y-1 mt-2 text-xs text-muted-foreground border-t pt-2">
                <div className="flex justify-between"><span>기본급:</span> <span>{formatCurrency(monthlySalaryData.baseSalary)}</span></div>
                <div className="flex justify-between"><span>수업료:</span> <span>{formatCurrency(monthlySalaryData.lessonCommission)}</span></div>
                {(monthlySalaryData.incentive > 0) && (
                  <div className="flex justify-between"><span>인센티브:</span> <span>{formatCurrency(monthlySalaryData.incentive)}</span></div>
                )}
              </CollapsibleContent>
            </>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
};

export default MonthlySalaryCard;
