import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, Edit, PlusCircle, Save, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { subMonths, startOfMonth, endOfMonth, format, differenceInMonths, parseISO } from 'date-fns';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts'; // 사용 안 함, 제거 가능

// formatCurrency 함수
const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

// 숫자 콤마 포맷 함수
const formatNumberWithCommas = (num: number | null | undefined): string => {
    const validNum = typeof num === 'number' && !isNaN(num) ? num : 0;
    if (num === null) return '';
    return validNum.toLocaleString('ko-KR');
};

// 콤마 제거 및 숫자로 변환 함수 (parseInt 사용)
const parseFormattedNumber = (formattedValue: string, allowNullable = false): number | null => {
    const cleanedValue = formattedValue.replace(/,/g, '');
    if (cleanedValue === '' && allowNullable) return null;
    // 정수만 처리하므로 parseInt 사용
    const parsed = parseInt(cleanedValue, 10);
    return isNaN(parsed) ? (allowNullable ? null : 0) : parsed;
};


// 타입 정의
type TrainerSettings = Tables<'trainer_settings'>;
type CommissionRule = Tables<'commission_rules'>;
type SessionPriceRule = Tables<'session_price_rules'>;
type EditingCommissionRuleData = {
  revenue_threshold?: number;
  revenue_upper_bound?: number | null;
  commission_rate?: number;
  incentive_amount?: number;
  // team_incentive_amount?: number; // 팀 인센티브 제거
};
type EditingSessionPriceRuleData = Partial<Pick<SessionPriceRule, 'min_sessions' | 'max_sessions' | 'price_per_session'>>;


const RevenueSettingsPage = () => {
  const { user, userCenter } = useAuth();
  const { toast } = useToast();

  // 상태 변수들...
  const [settings, setSettings] = useState<TrainerSettings | null>(null);
  const [targetRevenue, setTargetRevenue] = useState<number>(0);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleData, setEditingRuleData] = useState<EditingCommissionRuleData>({});
  const [isAddingNewRule, setIsAddingNewRule] = useState(false);
  const [newRuleData, setNewRuleData] = useState<EditingCommissionRuleData>({
    revenue_threshold: 0, revenue_upper_bound: null, commission_rate: 0, incentive_amount: 0, // team_incentive_amount 제거
  });
  const [sessionPriceRules, setSessionPriceRules] = useState<SessionPriceRule[]>([]);
  const [isLoadingPriceRules, setIsLoadingPriceRules] = useState(true);
  const [isSavingPriceRules, setIsSavingPriceRules] = useState(false);
  const [editingPriceRuleId, setEditingPriceRuleId] = useState<string | null>(null);
  const [editingPriceRuleData, setEditingPriceRuleData] = useState<EditingSessionPriceRuleData>({});
  const [isAddingNewPriceRule, setIsAddingNewPriceRule] = useState(false);
  const [newPriceRuleData, setNewPriceRuleData] = useState<EditingSessionPriceRuleData>({
    min_sessions: 0, max_sessions: null, price_per_session: 0,
  });


  // 데이터 로딩 useEffect들...
   // 트레이너 설정 데이터 로딩
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user || !userCenter) { setIsLoadingSettings(false); return; }
      setIsLoadingSettings(true);
      try {
        const { data, error } = await supabase.from('trainer_settings').select('*').eq('trainer_id', user.id).eq('center_id', userCenter).maybeSingle();
        if (error) throw error;
        if (data) {
          setSettings(data); setTargetRevenue(data.target_revenue || 0); setMonthlySalary(data.monthly_salary || 0);
        } else {
          setSettings(null); setTargetRevenue(0); setMonthlySalary(0);
        }
      } catch (error) { console.error('Error fetching trainer settings:', error); toast({ title: '오류', description: '트레이너 설정 정보 로딩 오류', variant: 'destructive' }); }
      finally { setIsLoadingSettings(false); }
    };
    fetchSettings();
  }, [user, userCenter, toast]);

  // 커미션 규칙 데이터 로딩
  useEffect(() => {
     const fetchCommissionRules = async () => {
      if (!userCenter) { setIsLoadingRules(false); return; }
      setIsLoadingRules(true);
      try {
        const { data, error } = await supabase.from('commission_rules').select('*').eq('center_id', userCenter).order('revenue_threshold', { ascending: true });
        if (error) throw error;
        setCommissionRules(data || []);
      } catch (error) { console.error('Error fetching commission rules:', error); toast({ title: '오류', description: '수업료/인센티브 기준 로딩 오류', variant: 'destructive' }); }
      finally { setIsLoadingRules(false); }
    };
    fetchCommissionRules();
  }, [userCenter, toast]);

  // 세션 단가 규칙 데이터 로딩
  useEffect(() => {
    const fetchSessionPriceRules = async () => {
      if (!userCenter) { setIsLoadingPriceRules(false); return; }
      setIsLoadingPriceRules(true);
      try {
        const { data, error } = await supabase.from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions', { ascending: true });
        if (error) throw error;
        setSessionPriceRules(data || []);
      } catch (error) { console.error('Error fetching session price rules:', error); toast({ title: '오류', description: '세션 단가 기준 로딩 오류', variant: 'destructive' }); }
      finally { setIsLoadingPriceRules(false); }
    };
    fetchSessionPriceRules();
  }, [userCenter, toast]);


  // 목표 매출 저장 핸들러
  const handleSaveTargetRevenue = async () => {
     if (!user || !userCenter) return;
    setIsSavingSettings(true);
    try {
      const upsertData: TablesInsert<'trainer_settings'> = {
        center_id: userCenter, trainer_id: user.id, target_revenue: targetRevenue, monthly_salary: monthlySalary, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('trainer_settings').upsert(upsertData, { onConflict: 'center_id, trainer_id' });
      if (error) throw error;
      toast({ title: '성공', description: '목표 매출 및 기본급이 저장되었습니다.' });
       const { data: updatedData } = await supabase.from('trainer_settings').select('*').eq('trainer_id', user.id).eq('center_id', userCenter).single();
       if (updatedData) setSettings(updatedData);
    } catch (error) { console.error('Error saving trainer settings:', error); toast({ title: '오류', description: '목표 매출 저장 오류', variant: 'destructive' }); }
    finally { setIsSavingSettings(false); }
  };

  // 숫자 입력 처리 함수
  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const numValue = parseFormattedNumber(value); // parseInt 사용
      if (numValue !== null) { setter(numValue); }
  };

  // 테이블 내 숫자 입력 처리 함수
  type CommissionRuleField = keyof EditingCommissionRuleData;
  type SessionPriceRuleField = keyof EditingSessionPriceRuleData;

  const handleTableNumericInputChange = (
      id: string | null,
      field: CommissionRuleField | SessionPriceRuleField,
      value: string,
      isFloat = false,
      max?: number,
      allowNullable = false
  ) => {
      // 숫자, 콤마, 소수점(isFloat=true일 때)만 허용
      const regex = isFloat ? /^[0-9,]*\.?[0-9]*$/ : /^[0-9,]*$/;
      if (!regex.test(value) && value !== '') {
          return; // 유효하지 않은 입력이면 무시
      }

      const cleanedValue = value.replace(/,/g, '');
      let numValue: number | null = null;

      const nullableFields = ['revenue_upper_bound', 'max_sessions'];
      const isNullableField = nullableFields.includes(field as string);

      if (cleanedValue === '') {
          // 빈 문자열 처리: nullable 필드이거나 allowNullable이 true이면 null, 아니면 0
          numValue = (isNullableField || allowNullable) ? null : 0;
      } else if (isFloat) {
          // 소수점 처리
          if (cleanedValue.includes('.') && cleanedValue.split('.')[1]?.length > 2) return; // 소수점 둘째 자리까지만 허용
          const parsedFloat = parseFloat(cleanedValue);
          numValue = isNaN(parsedFloat) ? 0 : parsedFloat;
      } else {
          // 정수 처리 (9자리 제한 고려 - parseInt는 충분히 큰 수를 다룸)
          const parsedInt = parseInt(cleanedValue, 10);
          // 9자리 초과 입력 방지 (선택적: 필요하다면 추가)
          // if (cleanedValue.length > 9) return;
          numValue = isNaN(parsedInt) ? 0 : parsedInt;
      }

      // 최대값 제한
      if (max !== undefined && numValue !== null && numValue > max) {
          numValue = max;
      }

      // 상태 업데이트
      if (id === null) { // 새 규칙
          if (['revenue_threshold', 'revenue_upper_bound', 'commission_rate', 'incentive_amount'].includes(field)) { // team_incentive_amount 제거
              setNewRuleData(prev => ({ ...prev, [field as CommissionRuleField]: numValue }));
          } else if (['min_sessions', 'max_sessions', 'price_per_session'].includes(field)) {
              setNewPriceRuleData(prev => ({ ...prev, [field as SessionPriceRuleField]: numValue }));
          }
      } else { // 기존 규칙 수정
          if (['revenue_threshold', 'revenue_upper_bound', 'commission_rate', 'incentive_amount'].includes(field)) { // team_incentive_amount 제거
              setEditingRuleData(prev => ({ ...prev, [field as CommissionRuleField]: numValue }));
          } else if (['min_sessions', 'max_sessions', 'price_per_session'].includes(field)) {
              setEditingPriceRuleData(prev => ({ ...prev, [field as SessionPriceRuleField]: numValue }));
          }
      }
  };


  // --- 커미션 규칙 핸들러들 ---
  const handleEditRule = (rule: CommissionRule) => {
     setEditingRuleId(rule.id);
    const { id, center_id, created_at, updated_at, ...editableData } = rule;
    setEditingRuleData(editableData);
    handleCancelEditPriceRule(); setIsAddingNewRule(false); setIsAddingNewPriceRule(false);
  };
  const handleCancelEdit = () => { setEditingRuleId(null); setEditingRuleData({}); };
  const handleSaveRule = async (ruleId: string) => {
      if (!userCenter || !editingRuleData) return;
     if (typeof editingRuleData.revenue_threshold !== 'number' || editingRuleData.revenue_threshold < 0 ||
         (editingRuleData.revenue_upper_bound !== null && (typeof editingRuleData.revenue_upper_bound !== 'number' || editingRuleData.revenue_upper_bound <= editingRuleData.revenue_threshold)) ||
         typeof editingRuleData.commission_rate !== 'number' || editingRuleData.commission_rate < 0 || editingRuleData.commission_rate > 100 ||
         (editingRuleData.incentive_amount !== undefined && (typeof editingRuleData.incentive_amount !== 'number' || editingRuleData.incentive_amount < 0))
         // (editingRuleData.team_incentive_amount !== undefined && (typeof editingRuleData.team_incentive_amount !== 'number' || editingRuleData.team_incentive_amount < 0)) // 팀 인센티브 유효성 검사 제거
         ) {
         toast({ title: '오류', description: '입력값이 유효하지 않습니다. 상한선은 하한선보다 커야 합니다.', variant: 'destructive' }); return;
     }
     // TODO: 구간 겹침 검사
     setIsSavingRules(true);
     try {
         const updateData = {
             revenue_threshold: editingRuleData.revenue_threshold,
             revenue_upper_bound: editingRuleData.revenue_upper_bound,
             commission_rate: editingRuleData.commission_rate,
             incentive_amount: editingRuleData.incentive_amount ?? 0,
             // team_incentive_amount: editingRuleData.team_incentive_amount ?? 0, // 팀 인센티브 제거
             updated_at: new Date().toISOString(),
         };
         const { error } = await supabase.from('commission_rules').update(updateData).eq('id', ruleId).eq('center_id', userCenter);
         if (error) throw error;
         toast({ title: '성공', description: '기준이 수정되었습니다.' });
         setCommissionRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...(updateData as Partial<CommissionRule>) } : r).sort((a, b) => a.revenue_threshold - b.revenue_threshold));
         handleCancelEdit();
     } catch (error) { console.error('Error updating commission rule:', error); toast({ title: '오류', description: '기준 수정 오류', variant: 'destructive' }); }
     finally { setIsSavingRules(false); }
  };
  const handleDeleteRule = async (ruleId: string) => {
      if (!userCenter) return;
     setIsSavingRules(true);
     try {
         const { error } = await supabase.from('commission_rules').delete().eq('id', ruleId).eq('center_id', userCenter);
         if (error) throw error;
         toast({ title: '성공', description: '기준이 삭제되었습니다.' });
         setCommissionRules(prev => prev.filter(r => r.id !== ruleId));
     } catch (error) { console.error('Error deleting commission rule:', error); toast({ title: '오류', description: '기준 삭제 오류', variant: 'destructive' }); }
     finally { setIsSavingRules(false); }
  };
  const handleAddNewRule = () => {
    setIsAddingNewRule(true);
    setNewRuleData({ revenue_threshold: 0, revenue_upper_bound: null, commission_rate: 0, incentive_amount: 0 }); // team_incentive_amount 제거
    handleCancelEdit(); handleCancelEditPriceRule(); setIsAddingNewPriceRule(false);
  };
  const handleCancelNewRule = () => { setIsAddingNewRule(false); setNewRuleData({}); };
  const handleSaveNewRule = async () => {
     if (!userCenter || !newRuleData) return;
     if (typeof newRuleData.revenue_threshold !== 'number' || newRuleData.revenue_threshold < 0 ||
         (newRuleData.revenue_upper_bound !== null && (typeof newRuleData.revenue_upper_bound !== 'number' || newRuleData.revenue_upper_bound <= newRuleData.revenue_threshold)) ||
         typeof newRuleData.commission_rate !== 'number' || newRuleData.commission_rate < 0 || newRuleData.commission_rate > 100 ||
         (newRuleData.incentive_amount !== undefined && (typeof newRuleData.incentive_amount !== 'number' || newRuleData.incentive_amount < 0))
         // (newRuleData.team_incentive_amount !== undefined && (typeof newRuleData.team_incentive_amount !== 'number' || newRuleData.team_incentive_amount < 0)) // 팀 인센티브 유효성 검사 제거
         ) {
         toast({ title: '오류', description: '입력값이 유효하지 않습니다. 상한선은 하한선보다 커야 합니다.', variant: 'destructive' }); return;
     }
     // TODO: 구간 겹침 검사
    setIsSavingRules(true);
    try {
      const insertData = {
        center_id: userCenter, revenue_threshold: newRuleData.revenue_threshold!,
        revenue_upper_bound: newRuleData.revenue_upper_bound,
        commission_rate: newRuleData.commission_rate!,
        incentive_amount: newRuleData.incentive_amount ?? 0, // team_incentive_amount 제거
      };
      const { data: insertedData, error } = await supabase.from('commission_rules').insert(insertData).select().single();
      if (error) throw error;
      toast({ title: '성공', description: '새 기준이 추가되었습니다.' });
      if (insertedData) { setCommissionRules(prev => [...prev, insertedData as CommissionRule].sort((a, b) => a.revenue_threshold - b.revenue_threshold)); }
      handleCancelNewRule();
    } catch (error) { console.error('Error inserting commission rule:', error); toast({ title: '오류', description: '새 기준 추가 오류', variant: 'destructive' }); }
    finally { setIsSavingRules(false); }
  };

  // --- 세션 단가 규칙 핸들러들 ---
  const handleEditPriceRule = (rule: SessionPriceRule) => {
    setEditingPriceRuleId(rule.id);
    const { id, center_id, created_at, updated_at, ...editableData } = rule;
    setEditingPriceRuleData(editableData);
    handleCancelEdit(); setIsAddingNewRule(false); setIsAddingNewPriceRule(false);
  };
  const handleCancelEditPriceRule = () => { setEditingPriceRuleId(null); setEditingPriceRuleData({}); };
  const handleSavePriceRule = async (ruleId: string) => {
     if (!userCenter || !editingPriceRuleData) return;
     if (typeof editingPriceRuleData.min_sessions !== 'number' || editingPriceRuleData.min_sessions < 0 ||
         (editingPriceRuleData.max_sessions !== null && (typeof editingPriceRuleData.max_sessions !== 'number' || editingPriceRuleData.max_sessions < 0)) ||
         typeof editingPriceRuleData.price_per_session !== 'number' || editingPriceRuleData.price_per_session < 0 ||
         (editingPriceRuleData.max_sessions !== null && editingPriceRuleData.min_sessions >= editingPriceRuleData.max_sessions)
         ) {
         toast({ title: '오류', description: '입력값이 유효하지 않습니다.', variant: 'destructive' }); return;
     }
     // TODO: 구간 겹침 검사
     setIsSavingPriceRules(true);
     try {
         const updateData: TablesUpdate<'session_price_rules'> = {
             min_sessions: editingPriceRuleData.min_sessions, max_sessions: editingPriceRuleData.max_sessions,
             price_per_session: editingPriceRuleData.price_per_session, updated_at: new Date().toISOString(),
         };
         const { error } = await supabase.from('session_price_rules').update(updateData).eq('id', ruleId).eq('center_id', userCenter);
         if (error) throw error;
         toast({ title: '성공', description: '세션 단가 기준이 수정되었습니다.' });
         setSessionPriceRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updateData } : r).sort((a, b) => a.min_sessions - b.min_sessions));
         handleCancelEditPriceRule();
     } catch (error) { console.error('Error updating session price rule:', error); toast({ title: '오류', description: '세션 단가 기준 수정 오류', variant: 'destructive' }); }
     finally { setIsSavingPriceRules(false); }
  };
  const handleDeletePriceRule = async (ruleId: string) => {
     if (!userCenter) return;
     setIsSavingPriceRules(true);
     try {
         const { error } = await supabase.from('session_price_rules').delete().eq('id', ruleId).eq('center_id', userCenter);
         if (error) throw error;
         toast({ title: '성공', description: '세션 단가 기준이 삭제되었습니다.' });
         setSessionPriceRules(prev => prev.filter(r => r.id !== ruleId));
     } catch (error) { console.error('Error deleting session price rule:', error); toast({ title: '오류', description: '세션 단가 기준 삭제 오류', variant: 'destructive' }); }
     finally { setIsSavingPriceRules(false); }
  };
  const handleAddNewPriceRule = () => {
    setIsAddingNewPriceRule(true);
    setNewPriceRuleData({ min_sessions: 0, max_sessions: null, price_per_session: 0 });
    handleCancelEdit(); handleCancelEditPriceRule(); setIsAddingNewRule(false);
  };
  const handleCancelNewPriceRule = () => { setIsAddingNewPriceRule(false); setNewPriceRuleData({}); };
  const handleSaveNewPriceRule = async () => {
     if (!userCenter || !newPriceRuleData) return;
     if (typeof newPriceRuleData.min_sessions !== 'number' || newPriceRuleData.min_sessions < 0 ||
         (newPriceRuleData.max_sessions !== null && (typeof newPriceRuleData.max_sessions !== 'number' || newPriceRuleData.max_sessions < 0)) ||
         typeof newPriceRuleData.price_per_session !== 'number' || newPriceRuleData.price_per_session < 0 ||
         (newPriceRuleData.max_sessions !== null && newPriceRuleData.min_sessions >= newPriceRuleData.max_sessions)
         ) {
         toast({ title: '오류', description: '입력값이 유효하지 않습니다.', variant: 'destructive' }); return;
     }
     // TODO: 구간 겹침 검사
     setIsSavingPriceRules(true);
     try {
         const insertData: TablesInsert<'session_price_rules'> = {
             center_id: userCenter, min_sessions: newPriceRuleData.min_sessions!,
             max_sessions: newPriceRuleData.max_sessions, price_per_session: newPriceRuleData.price_per_session!,
         };
         const { data: insertedData, error } = await supabase.from('session_price_rules').insert(insertData).select().single();
         if (error) throw error;
         toast({ title: '성공', description: '새 세션 단가 기준이 추가되었습니다.' });
         if (insertedData) { setSessionPriceRules(prev => [...prev, insertedData].sort((a, b) => a.min_sessions - b.min_sessions)); }
         handleCancelNewPriceRule();
     } catch (error) { console.error('Error inserting session price rule:', error); toast({ title: '오류', description: '새 세션 단가 기준 추가 오류', variant: 'destructive' }); }
     finally { setIsSavingPriceRules(false); }
  };


  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">매출 설정</h1>
        <p className="text-muted-foreground"> 트레이너별 목표 매출, 수업료 및 인센티브 기준, 세션 단가 등을 설정합니다. </p>

        {/* 목표 매출 및 기본급 설정 카드 */}
        <Card>
           <CardHeader> <CardTitle>목표 매출 및 기본급 설정</CardTitle> <CardDescription>트레이너의 월별 목표 매출과 기본급을 설정합니다.</CardDescription> </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSettings ? ( <p>로딩 중...</p> ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <Label htmlFor="targetRevenue">목표 매출 (월)</Label>
                     <Input id="targetRevenue" type="text" value={formatNumberWithCommas(targetRevenue)} onChange={e => handleNumericInputChange(setTargetRevenue)(e)} placeholder="월 목표 매출액 입력" />
                     <p className="text-sm text-muted-foreground mt-1"> {formatCurrency(targetRevenue)} </p>
                   </div>
                   <div>
                     <Label htmlFor="monthlySalary">기본급 (월)</Label>
                     <Input id="monthlySalary" type="text" value={formatNumberWithCommas(monthlySalary)} onChange={e => handleNumericInputChange(setMonthlySalary)(e)} placeholder="월 기본 급여 입력" />
                      <p className="text-sm text-muted-foreground mt-1"> {formatCurrency(monthlySalary)} </p>
                   </div>
                 </div>
              </>
            )}
          </CardContent>
          <CardFooter> <Button onClick={handleSaveTargetRevenue} disabled={isLoadingSettings || isSavingSettings}> {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 저장 </Button> </CardFooter>
        </Card>

        {/* 수업료 및 인센티브 기준 설정 카드 */}
        <Card>
           <CardHeader> <CardTitle>수업료 및 인센티브 기준</CardTitle> <CardDescription>매출 구간별 수업료 비율(%)과 인센티브 금액을 설정합니다.</CardDescription> </CardHeader>
          <CardContent>
            {isLoadingRules ? ( <p>로딩 중...</p> ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>매출 하한 (이상)</TableHead> {/* 용어 변경 */}
                    <TableHead>매출 상한 (미만)</TableHead>
                    <TableHead>수업료 비율 (%)</TableHead>
                    <TableHead>개인 인센티브</TableHead>
                    {/* <TableHead>팀 인센티브</TableHead> */} {/* 팀 인센티브 헤더 제거 */}
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionRules.map((rule) => (
                    <TableRow key={rule.id}>
                      {editingRuleId === rule.id ? (
                        <>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingRuleData.revenue_threshold)} onChange={(e) => handleTableNumericInputChange(rule.id, 'revenue_threshold', e.target.value)} className="h-8"/> </TableCell>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingRuleData.revenue_upper_bound)} onChange={(e) => handleTableNumericInputChange(rule.id, 'revenue_upper_bound', e.target.value, false, undefined, true)} className="h-8" placeholder="없음"/> </TableCell>
                          <TableCell> <Input type="number" value={editingRuleData.commission_rate ?? ''} onChange={(e) => handleTableNumericInputChange(rule.id, 'commission_rate', e.target.value, true, 100)} className="h-8" step="0.01"/> </TableCell>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingRuleData.incentive_amount)} onChange={(e) => handleTableNumericInputChange(rule.id, 'incentive_amount', e.target.value)} className="h-8"/> </TableCell>
                          {/* <TableCell> <Input type="text" value={formatNumberWithCommas(editingRuleData.team_incentive_amount)} onChange={(e) => handleTableNumericInputChange(rule.id, 'team_incentive_amount', e.target.value)} className="h-8"/> </TableCell> */} {/* 팀 인센티브 입력 제거 */}
                          <TableCell className="text-right space-x-1"> <Button variant="ghost" size="icon" onClick={() => handleSaveRule(rule.id)} disabled={isSavingRules}> {isSavingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} </Button> <Button variant="ghost" size="icon" onClick={handleCancelEdit} disabled={isSavingRules}> <X className="h-4 w-4" /> </Button> </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{formatCurrency(rule.revenue_threshold)}</TableCell>
                          {/* @ts-ignore - 타입 오류 임시 무시 */}
                          <TableCell>{rule.revenue_upper_bound ? `< ${formatCurrency(rule.revenue_upper_bound)}` : '없음'}</TableCell>
                          <TableCell>{rule.commission_rate}%</TableCell> <TableCell>{formatCurrency(rule.incentive_amount)}</TableCell> {/* <TableCell>{formatCurrency(rule.team_incentive_amount)}</TableCell> */} {/* 팀 인센티브 표시 제거 */}
                          <TableCell className="text-right space-x-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSavingRules || !!editingRuleId || isAddingNewRule || isAddingNewPriceRule || !!editingPriceRuleId}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle> <AlertDialogDescription> 이 작업은 되돌릴 수 없습니다. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>취소</AlertDialogCancel> <AlertDialogAction onClick={() => handleDeleteRule(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"> 삭제 </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
                            </AlertDialog>
                            <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)} disabled={isSavingRules || !!editingRuleId || isAddingNewRule || isAddingNewPriceRule || !!editingPriceRuleId}> <Edit className="h-4 w-4" /> </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {isAddingNewRule && (
                     <TableRow>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newRuleData.revenue_threshold)} onChange={(e) => handleTableNumericInputChange(null, 'revenue_threshold', e.target.value)} className="h-8" placeholder="매출 기준"/> </TableCell>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newRuleData.revenue_upper_bound)} onChange={(e) => handleTableNumericInputChange(null, 'revenue_upper_bound', e.target.value, false, undefined, true)} className="h-8" placeholder="상한 (없으면 비워둠)"/> </TableCell>
                       <TableCell> <Input type="number" value={newRuleData.commission_rate ?? ''} onChange={(e) => handleTableNumericInputChange(null, 'commission_rate', e.target.value, true, 100)} className="h-8" step="0.01" placeholder="수업료 %"/> </TableCell>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newRuleData.incentive_amount)} onChange={(e) => handleTableNumericInputChange(null, 'incentive_amount', e.target.value)} className="h-8" placeholder="개인 인센티브"/> </TableCell>
                       {/* <TableCell> <Input type="text" value={formatNumberWithCommas(newRuleData.team_incentive_amount)} onChange={(e) => handleTableNumericInputChange(null, 'team_incentive_amount', e.target.value)} className="h-8" placeholder="팀 인센티브"/> </TableCell> */} {/* 팀 인센티브 입력 제거 */}
                       <TableCell className="text-right space-x-1"> <Button variant="ghost" size="icon" onClick={handleSaveNewRule} disabled={isSavingRules}> {isSavingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} </Button> <Button variant="ghost" size="icon" onClick={handleCancelNewRule} disabled={isSavingRules}> <X className="h-4 w-4" /> </Button> </TableCell>
                     </TableRow>
                   )}
                </TableBody>
              </Table>
            )}
             <Button variant="outline" className="mt-4" onClick={handleAddNewRule} disabled={!!editingRuleId || isAddingNewRule || isAddingNewPriceRule || !!editingPriceRuleId}> <PlusCircle className="mr-2 h-4 w-4" /> 새 기준 추가 </Button>
          </CardContent>
        </Card>

        {/* 세션 단가 설정 카드 */}
        <Card>
          <CardHeader> <CardTitle>세션 단가 설정</CardTitle> <CardDescription>PT 세션 횟수 구간별 단가를 설정합니다.</CardDescription> </CardHeader>
          <CardContent>
            {isLoadingPriceRules ? ( <p>로딩 중...</p> ) : (
              <Table>
                <TableHeader> <TableRow> <TableHead>최소 세션</TableHead> <TableHead>최대 세션 (미만)</TableHead> <TableHead>세션당 단가</TableHead> <TableHead className="text-right">액션</TableHead> </TableRow> </TableHeader>
                <TableBody>
                  {sessionPriceRules.map((rule) => (
                    <TableRow key={rule.id}>
                      {editingPriceRuleId === rule.id ? (
                        <>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingPriceRuleData.min_sessions)} onChange={(e) => handleTableNumericInputChange(rule.id, 'min_sessions', e.target.value)} className="h-8"/> </TableCell>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingPriceRuleData.max_sessions)} onChange={(e) => handleTableNumericInputChange(rule.id, 'max_sessions', e.target.value, false, undefined, true)} className="h-8" placeholder="없음"/> </TableCell>
                          <TableCell> <Input type="text" value={formatNumberWithCommas(editingPriceRuleData.price_per_session)} onChange={(e) => handleTableNumericInputChange(rule.id, 'price_per_session', e.target.value)} className="h-8"/> </TableCell>
                          <TableCell className="text-right space-x-1"> <Button variant="ghost" size="icon" onClick={() => handleSavePriceRule(rule.id)} disabled={isSavingPriceRules}> {isSavingPriceRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} </Button> <Button variant="ghost" size="icon" onClick={handleCancelEditPriceRule} disabled={isSavingPriceRules}> <X className="h-4 w-4" /> </Button> </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{rule.min_sessions}회</TableCell> <TableCell>{rule.max_sessions ? `< ${rule.max_sessions}회` : '없음'}</TableCell> <TableCell>{formatCurrency(rule.price_per_session)}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSavingPriceRules || !!editingPriceRuleId || isAddingNewPriceRule || isAddingNewRule || !!editingRuleId}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent> <AlertDialogHeader> <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle> <AlertDialogDescription> 이 작업은 되돌릴 수 없습니다. </AlertDialogDescription> </AlertDialogHeader> <AlertDialogFooter> <AlertDialogCancel>취소</AlertDialogCancel> <AlertDialogAction onClick={() => handleDeletePriceRule(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"> 삭제 </AlertDialogAction> </AlertDialogFooter> </AlertDialogContent>
                            </AlertDialog>
                             <Button variant="ghost" size="icon" onClick={() => handleEditPriceRule(rule)} disabled={isSavingPriceRules || !!editingPriceRuleId || isAddingNewPriceRule || isAddingNewRule || !!editingRuleId}> <Edit className="h-4 w-4" /> </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {isAddingNewPriceRule && (
                     <TableRow>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newPriceRuleData.min_sessions)} onChange={(e) => handleTableNumericInputChange(null, 'min_sessions', e.target.value)} className="h-8" placeholder="최소 세션"/> </TableCell>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newPriceRuleData.max_sessions)} onChange={(e) => handleTableNumericInputChange(null, 'max_sessions', e.target.value, false, undefined, true)} className="h-8" placeholder="최대 (없으면 비워둠)"/> </TableCell>
                       <TableCell> <Input type="text" value={formatNumberWithCommas(newPriceRuleData.price_per_session)} onChange={(e) => handleTableNumericInputChange(null, 'price_per_session', e.target.value)} className="h-8" placeholder="세션당 단가"/> </TableCell>
                       <TableCell className="text-right space-x-1"> <Button variant="ghost" size="icon" onClick={handleSaveNewPriceRule} disabled={isSavingPriceRules}> {isSavingPriceRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} </Button> <Button variant="ghost" size="icon" onClick={handleCancelNewPriceRule} disabled={isSavingPriceRules}> <X className="h-4 w-4" /> </Button> </TableCell>
                     </TableRow>
                   )}
                </TableBody>
              </Table>
            )}
             <Button variant="outline" className="mt-4" onClick={handleAddNewPriceRule} disabled={!!editingPriceRuleId || isAddingNewPriceRule || isAddingNewRule || !!editingRuleId}> <PlusCircle className="mr-2 h-4 w-4" /> 새 단가 기준 추가 </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RevenueSettingsPage;