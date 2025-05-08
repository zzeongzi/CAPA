import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Member } from '@/hooks/use-members';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getHours } from 'date-fns';
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

type SessionPriceRule = Tables<'session_price_rules'>;
type Membership = Tables<'memberships'>;

interface EditPTSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onUpdateSuccess: () => void;
}

export function EditPTSessionsModal({
  isOpen,
  onClose,
  member,
  onUpdateSuccess,
}: EditPTSessionsModalProps) {
  const { user, userCenter } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [existingMembership, setExistingMembership] = useState<Membership | null>(null);
  const [contractDate, setContractDate] = useState<Date | undefined>(new Date());
  const [registrationType, setRegistrationType] = useState<'new' | 'renewal' | undefined>();
  const [totalSessions, setTotalSessions] = useState<number>(0);
  // commissionRate 상태 및 관련 UI 제거 (항상 NULL로 저장)
  const [sessionPrice, setSessionPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [predictedRemaining, setPredictedRemaining] = useState<number>(0);

  const [sessionPriceRules, setSessionPriceRules] = useState<SessionPriceRule[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !member || !userCenter) return;
      setIsLoadingData(true);
      try {
        const { data: membershipData, error: membershipError } = await supabase
          .from('memberships')
          .select('*')
          .eq('member_id', member.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;
        setExistingMembership(membershipData);

        const { data: priceRes, error: priceError } = await supabase
          .from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions');

        if (priceError) throw priceError;
        setSessionPriceRules(priceRes || []);
        
        setTotalSessions(0);
        setSessionPrice(0);
        setPaymentMethod(membershipData?.payment_method || '');
        setContractDate(membershipData?.contract_date ? parseISO(membershipData.contract_date) : new Date());
        setRegistrationType(membershipData ? 'renewal' : 'new');
        setPredictedRemaining(membershipData?.remaining_sessions || 0);

      } catch (error) {
        console.error('Error loading data for modal:', error);
        toast({ title: '오류', description: '데이터 로딩 중 오류 발생', variant: 'destructive' });
        onClose();
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isOpen) { 
        loadData();
    } else { 
        setTotalSessions(0);
        setSessionPrice(0);
        setPaymentMethod('');
        setPredictedRemaining(0);
        setExistingMembership(null); 
        setContractDate(new Date());
        setRegistrationType(undefined);
    }
  }, [isOpen, member, userCenter, toast, onClose]);

  useEffect(() => {
    if (!member) return;
    const existingRemain = existingMembership?.remaining_sessions ?? 0;
    const sessionsToAdd = Number(totalSessions || 0);
    const newPredictedRemaining = existingRemain + sessionsToAdd;
    setPredictedRemaining(newPredictedRemaining);

    const applicableRule = sessionPriceRules.find(
      rule => sessionsToAdd >= rule.min_sessions && (rule.max_sessions === null || sessionsToAdd < rule.max_sessions)
    );
    setSessionPrice(applicableRule?.price_per_session ?? 0);

  }, [totalSessions, member, existingMembership, sessionPriceRules]);


  const handleSave = async () => {
    if (!member || !user || !userCenter || !contractDate || !registrationType) {
       toast({ title: '오류', description: '필수 정보가 누락되었습니다.', variant: 'destructive' });
       return;
    }
    if (totalSessions <= 0 && registrationType === 'new') {
        toast({ title: '오류', description: '신규 등록 시 PT 횟수는 0보다 커야 합니다.', variant: 'destructive' });
        return;
    }
    if (totalSessions < 0 ) {
        toast({ title: '오류', description: 'PT 횟수는 음수가 될 수 없습니다.', variant: 'destructive' });
        return;
    }
    if (sessionPrice <= 0 && totalSessions > 0) {
        toast({ title: '오류', description: '세션 단가는 0보다 커야 합니다.', variant: 'destructive' });
        return;
    }
    
    setIsSubmitting(true);
    try {
      const sessionsToAdd = totalSessions || 0;

      const finalTotalSessions = sessionsToAdd;
      const finalRemainingSessions = sessionsToAdd;

      const previousTotalSessions = 0; // 새 레코드이므로 이전 값은 0
      const previousRemainingSessions = 0; // 새 레코드이므로 이전 값은 0

      const insertData: TablesInsert<'memberships'> = {
        member_id: member.id,
        trainer_id: user.id,
        plan: existingMembership?.plan || '기본',
        total_sessions: finalTotalSessions,
        remaining_sessions: finalRemainingSessions,
        start_date: format(contractDate, 'yyyy-MM-dd'),
        contract_date: format(contractDate, 'yyyy-MM-dd'),
        registration_type: registrationType,
        commission_rate: null,
        session_price: sessionPrice,
        payment_method: paymentMethod,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('memberships')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!insertedData) throw new Error("Failed to insert new membership.");
      const savedMembershipId = insertedData.id;

      if (user && savedMembershipId && sessionsToAdd !== 0) {
        const { error: logError } = await supabase.from('pt_session_change_logs').insert({
            membership_id: savedMembershipId,
            member_id: member.memberPk,
            changed_by_user_id: user.id,
            previous_total_sessions: previousTotalSessions,
            new_total_sessions: finalTotalSessions,
            previous_remaining_sessions: previousRemainingSessions,
            new_remaining_sessions: finalRemainingSessions,
            change_amount: sessionsToAdd,
            change_reason: registrationType,
          });
        if (logError) { console.error('PT 세션 변경 로그 기록 오류:', logError); }
      }

      toast({ title: '성공', description: `${member.name} 회원의 PT 정보가 저장되었습니다.` });
      onUpdateSuccess();
      onClose();

    } catch (error) {
      console.error(`PT 정보 저장 오류 상세:`, error);
      toast({ title: '오류 발생', description: `PT 정보 저장 중 문제가 발생했습니다.`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumericInput = (setter: React.Dispatch<React.SetStateAction<number>>, isFloat = false, max?: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const regex = isFloat ? /^\d*\.?\d*$/ : /^\d*$/;
      if (value === '' || regex.test(value)) {
         let numValue = 0;
         if (isFloat) {
             if (value.includes('.') && value.split('.')[1]?.length > 2) return;
             numValue = value === '' ? 0 : parseFloat(value);
          } else {
             numValue = value === '' ? 0 : parseInt(value, 10);
         }
         if (max !== undefined && numValue > max) { numValue = max; }
         setter(isNaN(numValue) ? 0 : numValue);
      }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>신규 및 재등록</DialogTitle>
        </DialogHeader>
        {isLoadingData ? (
          <div className="flex justify-center items-center h-40"> <Loader2 className="h-8 w-8 animate-spin" /> </div>
        ) : (
          <div>
            {member && (
              <div className="mb-6 p-4 border rounded-md bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold">{member.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">현재 총 PT: </span>
                    <span className="font-medium">{existingMembership?.total_sessions ?? 0}회</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">현재 잔여 PT: </span>
                    <span className="font-medium">{existingMembership?.remaining_sessions ?? 0}회</span>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contract-date" className="text-right">계약 날짜</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !contractDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {contractDate ? format(contractDate, "yyyy-MM-dd") : <span>날짜 선택</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"> <Calendar mode="single" selected={contractDate} onSelect={setContractDate} initialFocus /> </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="registration-type" className="text-right">등록 유형</Label>
                <Select value={registrationType} onValueChange={(value: 'new' | 'renewal') => setRegistrationType(value)}>
                  <SelectTrigger className="col-span-3"> <SelectValue placeholder="등록 유형 선택" /> </SelectTrigger>
                  <SelectContent> <SelectItem value="new">신규</SelectItem> <SelectItem value="renewal">재등록</SelectItem> </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="total-sessions" className="text-right">등록/추가 PT</Label>
                <Input id="total-sessions" type="number" value={totalSessions === 0 ? '' : totalSessions} onChange={handleNumericInput(setTotalSessions)} className="col-span-3" min="0" placeholder="추가할 횟수 입력"/>
              </div>
              {/* 수업료(%) 입력 필드 제거됨 */}
              <div className="grid grid-cols-4 items-center gap-4">
                 <Label className="text-right text-sm text-muted-foreground">예상 총 PT 횟수</Label>
                 <span className={`col-span-3 text-sm font-medium ${ predictedRemaining > (existingMembership?.remaining_sessions ?? 0) ? 'text-green-600' : predictedRemaining < (existingMembership?.remaining_sessions ?? 0) ? 'text-destructive' : 'text-muted-foreground' }`}> {predictedRemaining}회 </span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="session-price" className="text-right">세션 단가</Label>
                <Input id="session-price" type="number" value={sessionPrice === 0 ? '' : sessionPrice} onChange={handleNumericInput(setSessionPrice)} className="col-span-2" min="0" placeholder="자동 계산"/>
                <span className="col-span-1 text-sm text-muted-foreground">
                  {sessionPrice > 0 ? formatCurrency(sessionPrice) : ""}
                </span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-sm">총 계약 금액</Label>
                <span className="col-span-3 text-sm font-medium">
                  {formatCurrency(totalSessions * sessionPrice)}
                </span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="payment-method" className="text-right">결제 방법</Label>
                <Input id="payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="col-span-3" placeholder="예: 카드, 현금, 계좌이체"/>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="flex flex-col space-y-2 pt-4 sm:flex-row sm:space-y-0 sm:space-x-2 sm:justify-end"> {/* flex-col과 space-y-2 추가, sm 이상에서는 수평 및 오른쪽 정렬 */}
          {/* 취소 버튼 제거됨 */}
          <Button onClick={handleSave} disabled={isSubmitting || isLoadingData} className="w-full sm:w-auto"> {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 저장 </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}