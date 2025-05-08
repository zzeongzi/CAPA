import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts'; // 그래프 라이브러리 임포트 활성화
import type { Tables } from '@/integrations/supabase/types';
import { subMonths, startOfMonth, endOfMonth, format, differenceInMonths, parseISO } from 'date-fns';

// formatCurrency 함수
const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

// 그래프 Tooltip 포맷터
const currencyTooltipFormatter = (value: number) => formatCurrency(value);

// 타입 정의
type SessionPriceRule = Tables<'session_price_rules'>;
type Membership = Tables<'memberships'>;
type PastMembershipData = Pick<Membership, 'total_sessions' | 'session_price' | 'contract_date'>;


const RevenueSimulatorPage = () => {
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [sessionPriceRules, setSessionPriceRules] = useState<SessionPriceRule[]>([]);
  const [simulationParams, setSimulationParams] = useState<{
    targetSessionRuleId: string | undefined;
    newPricePerSession: number;
    simulationMonths: number;
  }>({
    targetSessionRuleId: undefined,
    newPricePerSession: 0,
    simulationMonths: 3,
  });
  const [simulationResult, setSimulationResult] = useState<{ originalRevenue: number, simulatedRevenue: number } | null>(null);

  // 세션 단가 규칙 데이터 로딩
  useEffect(() => {
    const fetchSessionPriceRules = async () => {
      if (!userCenter) { setIsLoadingRules(false); return; }
      setIsLoadingRules(true);
      try {
        const { data, error } = await supabase.from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions', { ascending: true });
        if (error) throw error;
        setSessionPriceRules(data || []);
        if (data && data.length > 0) { setSimulationParams(prev => ({ ...prev, targetSessionRuleId: data[0].id })); }
      } catch (error) { console.error('Error fetching session price rules:', error); toast({ title: '오류', description: '세션 단가 기준 로딩 오류', variant: 'destructive' }); }
      finally { setIsLoadingRules(false); }
    };
    fetchSessionPriceRules();
  }, [userCenter, toast]);

  // 입력값 변경 핸들러
  const handleParamChange = (field: keyof typeof simulationParams, value: string) => {
    const isNumericField = ['newPricePerSession', 'simulationMonths'].includes(field);
    let processedValue: string | number | undefined = value;

    if (isNumericField) {
        const numValue = parseInt(value, 10);
        processedValue = isNaN(numValue) || numValue < 0 ? 0 : numValue;
    } else if (value === '') {
        processedValue = undefined;
    }

    setSimulationParams(prev => ({ ...prev, [field]: processedValue }));
  };


  // 시뮬레이션 실행 함수
  const runSimulation = async () => {
    if (!simulationParams.targetSessionRuleId || simulationParams.newPricePerSession < 0 || simulationParams.simulationMonths <= 0) {
        toast({ title: '오류', description: '변경할 세션 구간을 선택하고 유효한 단가 및 기간(1개월 이상)을 입력하세요.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setSimulationResult(null);
    try {
      // 1. 과거 데이터 조회
      const today = new Date();
      const pastStartDate = format(startOfMonth(subMonths(today, simulationParams.simulationMonths)), 'yyyy-MM-dd');
      const pastEndDate = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

      // @ts-ignore - Supabase 타입 추론 오류 임시 무시
      const { data: pastMembershipsData, error: pastDataError } = await supabase
        .from('memberships')
        .select('total_sessions, session_price, contract_date')
        .eq('center_id', userCenter)
        .gte('contract_date', pastStartDate)
        .lte('contract_date', pastEndDate);

      const pastMemberships: PastMembershipData[] | null = pastMembershipsData;


      if (pastDataError) throw pastDataError;
      if (!pastMemberships || pastMemberships.length === 0) {
          toast({ title: '정보', description: '시뮬레이션을 위한 과거 데이터가 부족합니다.', variant: 'default' });
          setIsLoading(false);
          return;
      }

      // 2. 원본 예상 매출 계산
      const monthsInPastData = differenceInMonths(parseISO(pastEndDate), parseISO(pastStartDate)) + 1;
      if (monthsInPastData <= 0) {
          toast({ title: '오류', description: '유효한 과거 데이터 기간이 없습니다.', variant: 'destructive' });
          setIsLoading(false);
          return;
      }
      const avgMonthlyContracts = pastMemberships.length / monthsInPastData;
      const getOriginalPrice = (totalSessions: number): number => {
          const applicableRule = sessionPriceRules.find(
              rule => totalSessions >= rule.min_sessions && (rule.max_sessions === null || totalSessions < rule.max_sessions)
          );
          return applicableRule?.price_per_session ?? 0;
      };
      const totalOriginalValue = pastMemberships.reduce((sum, m) => sum + ((m.total_sessions ?? 0) * getOriginalPrice(m.total_sessions ?? 0)), 0); // nullish coalescing 추가
      const avgOriginalContractValue = pastMemberships.length > 0 ? totalOriginalValue / pastMemberships.length : 0;
      const originalEstRevenue = avgMonthlyContracts * avgOriginalContractValue;


      // 3. 시뮬레이션 예상 매출 계산
      const simulatedPriceRules = sessionPriceRules.map(rule =>
          rule.id === simulationParams.targetSessionRuleId
              ? { ...rule, price_per_session: simulationParams.newPricePerSession }
              : rule
      );
      const getSimulatedPrice = (totalSessions: number): number => {
          const applicableRule = simulatedPriceRules.find(
              rule => totalSessions >= rule.min_sessions && (rule.max_sessions === null || totalSessions < rule.max_sessions)
          );
          return applicableRule?.price_per_session ?? 0;
      };
      const totalSimulatedValue = pastMemberships.reduce((sum, m) => sum + ((m.total_sessions ?? 0) * getSimulatedPrice(m.total_sessions ?? 0)), 0); // nullish coalescing 추가
      const avgSimulatedContractValue = pastMemberships.length > 0 ? totalSimulatedValue / pastMemberships.length : 0;
      const simulatedEstRevenue = avgMonthlyContracts * avgSimulatedContractValue;

      // 4. 결과 저장
      setSimulationResult({
          originalRevenue: Math.round(originalEstRevenue),
          simulatedRevenue: Math.round(simulatedEstRevenue)
      });

    } catch (error: any) {
      console.error("Error running simulation:", error);
      toast({ title: "오류", description: `시뮬레이션 중 오류 발생: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // 그래프용 데이터
  const chartData = simulationResult ? [
      { name: '예상 월 매출', original: simulationResult.originalRevenue, simulated: simulationResult.simulatedRevenue }
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">매출 시뮬레이터</h1>
        <p className="text-muted-foreground">
          세션 단가 등을 조정하여 예상 매출 변화를 시뮬레이션합니다.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>시뮬레이션 조건 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingRules ? (
              <p>세션 단가 규칙 로딩 중...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="targetRule">변경할 세션 구간</Label>
                        <Select
                            value={simulationParams.targetSessionRuleId}
                            onValueChange={(value) => handleParamChange('targetSessionRuleId', value)}
                        >
                            <SelectTrigger id="targetRule">
                            <SelectValue placeholder="세션 구간 선택" />
                            </SelectTrigger>
                            <SelectContent>
                            {sessionPriceRules.map(rule => (
                                <SelectItem key={rule.id} value={rule.id}>
                                {rule.min_sessions}회 이상 {rule.max_sessions ? `- ${rule.max_sessions}회 미만` : ''} (현재: {formatCurrency(rule.price_per_session)})
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="newPrice">새로운 세션당 단가</Label>
                        <Input
                            id="newPrice"
                            type="number"
                            value={simulationParams.newPricePerSession}
                            onChange={(e) => handleParamChange('newPricePerSession', e.target.value)}
                            min="0"
                            placeholder="새로운 단가 입력"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                            {formatCurrency(simulationParams.newPricePerSession)}
                        </p>
                    </div>
                     <div>
                        <Label htmlFor="simulationMonths">시뮬레이션 기준 기간 (개월)</Label>
                        <Input
                            id="simulationMonths"
                            type="number"
                            value={simulationParams.simulationMonths}
                            onChange={(e) => handleParamChange('simulationMonths', e.target.value)}
                            min="1"
                            placeholder="예: 3"
                        />
                         <p className="text-sm text-muted-foreground mt-1">
                            최근 {simulationParams.simulationMonths}개월 데이터 기준
                         </p>
                    </div>
                </div>
              </>
            )}
            <Button onClick={runSimulation} disabled={isLoading || isLoadingRules}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              시뮬레이션 실행
            </Button>
          </CardContent>
        </Card>

        {simulationResult && (
          <Card>
            <CardHeader>
              <CardTitle>시뮬레이션 결과 (월 평균 예상)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-base mb-6"> {/* 결과 텍스트와 그래프 간격 추가 */}
                  <div className="flex justify-between">
                      <span>기존 예상 매출:</span>
                      <span className="font-medium">{formatCurrency(simulationResult.originalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span>시뮬레이션 예상 매출:</span>
                      <span className="font-medium">{formatCurrency(simulationResult.simulatedRevenue)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold pt-2 border-t mt-2 ${simulationResult.simulatedRevenue >= simulationResult.originalRevenue ? 'text-green-600' : 'text-red-600'}`}>
                      <span>예상 변화:</span>
                      <span>
                          {simulationResult.simulatedRevenue >= simulationResult.originalRevenue ? '+' : ''}
                          {formatCurrency(simulationResult.simulatedRevenue - simulationResult.originalRevenue)}
                          ({(((simulationResult.simulatedRevenue / (simulationResult.originalRevenue || 1)) || 0) * 100 - 100).toFixed(1)}%)
                      </span>
                  </div>
              </div>
              {/* 그래프 구현 */}
              <div className="mt-6 h-60">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" />
                     <YAxis tickFormatter={formatCurrency} width={80} />
                     <Tooltip formatter={currencyTooltipFormatter} />
                     <Legend />
                     <Bar dataKey="original" fill="#8884d8" name="기존 예상" />
                     <Bar dataKey="simulated" fill="#82ca9d" name="시뮬레이션 예상" />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default RevenueSimulatorPage;