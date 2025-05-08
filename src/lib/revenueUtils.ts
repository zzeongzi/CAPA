import { parseISO, getMonth, getYear, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

// 타입 정의
type Membership = Tables<'memberships'>;
type CompletedSession = Tables<'pt_sessions'>;
type TrainerSettings = Tables<'trainer_settings'>;
type CommissionRule = Tables<'commission_rules'>;
type SessionPriceRule = Tables<'session_price_rules'>;
type Member = Tables<'members'>;

// 월별 계산 결과 타입 정의
export type MonthlyCalculationResult = {
  totalRevenue: number; // 총 수업료 매출 (커미션 적용 전, 완료+노쇼 세션 기준)
  totalSessionsCompleted: number;
  commissionTotal: number; // totalRevenue와 동일
  lessonCommission: number; // 최종 수업료 (각 멤버십의 contractualCommissionRate 또는 자동계산된 비율 적용 후 합계)
  incentive: number;
  baseSalary: number;
  totalSalaryBeforeDeduction: number;
  netSalary: number;
  commissionRateApplied: number; // 참고용: 해당 월의 전체 계약 매출 기준 자동 계산된 커미션 비율
  salaryReportData: SalaryReportRow[];
  revenueReportData: RevenueReportRow[];
};

// 월급 보고서 행 데이터 타입
export type SalaryReportRow = {
  membershipId: string;
  contractDate: string | null;
  memberName: string | null;
  contractualCommissionRate: number | null; // DB에 저장된 계약별 커미션 비율 (사용자 수정 가능)
  appliedCommissionRate: number | null; // 실제로 해당 행의 수업료 계산에 적용된 비율 (UI 표시용)
  sessionPrice: number | null;
  sessionsCompletedThisMonth: number;
  sessionsCompletedLastMonth: number;
  remainingSessions: number;
  totalContractedSessions: number;
  revenueFromMember: number; // 이 멤버십에서 발생한 (최종 적용된 커미션 비율이 적용된) 수업료
};

// 매출 보고서 행 데이터 타입
export type RevenueReportRow = {
    membershipId: string;
    contractDate: string | null;
    registrationType: 'new' | 'renewal' | null;
    memberName: string | null;
    totalContractedSessions: number;
    sessionPrice: number | null;
    paymentMethod: string | null;
    totalAmount: number; // 계약 총액
};

const countSessionsForMembership = (
  membershipId: string,
  startDate: Date,
  endDate: Date,
  sessions: CompletedSession[]
): number => {
  return sessions.filter(session => {
    if (session.membership_id !== membershipId) return false;
    try {
        if (!session.end_time) return false;
        const sessionDate = parseISO(session.end_time);
        return sessionDate >= startDate && sessionDate <= endDate;
    } catch (e) {
        console.error("Error parsing session date for count:", session.end_time, e);
        return false;
    }
  }).length;
};

export const calculateMonthlyRevenueAndSalary = (
  year: number,
  month: number, // 1-12
  memberships: Membership[],
  allSessionsForTrainer: CompletedSession[],
  trainerSettings: TrainerSettings | null,
  commissionRules: CommissionRule[],
  sessionPriceRules: SessionPriceRule[],
  allMembers: Member[]
): MonthlyCalculationResult => {

  const currentMonthStart = new Date(year, month - 1, 1);
  const currentMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const lastMonthStart = startOfMonth(subMonths(currentMonthStart, 1));
  const lastMonthEnd = endOfMonth(subMonths(currentMonthStart, 1));
  lastMonthEnd.setHours(23, 59, 59, 999);

  const membersMap = new Map<string, Member>();
  allMembers.forEach(m => {
    if (m.user_id) {
      membersMap.set(m.user_id, m);
    }
  });

  let totalRevenueFromSessionsThisMonth = 0;
  let totalSessionsCompletedThisMonth = 0;
  allSessionsForTrainer.forEach(session => {
    const sessionDate = session.end_time ? parseISO(session.end_time) : null;
    if (sessionDate && sessionDate >= currentMonthStart && sessionDate <= currentMonthEnd) {
      const linkedMembership = memberships.find(m => m.id === session.membership_id);
      const sessionPriceToUse = linkedMembership?.session_price || (session as any).session_price || 0;
      totalRevenueFromSessionsThisMonth += sessionPriceToUse;
      totalSessionsCompletedThisMonth++;
    }
  });

  let totalContractRevenueThisMonth = 0;
  memberships.forEach(ms => {
    const contractStartDate = ms.contract_date ? parseISO(ms.contract_date) : null;
    if (contractStartDate && getYear(contractStartDate) === year && getMonth(contractStartDate) === month - 1) {
      totalContractRevenueThisMonth += (ms.total_sessions || 0) * (ms.session_price || 0);
    }
  });

  let autoCalculatedRateForMonth = 0;
  let incentiveAmount = 0;
  const applicableCommissionRule = [...commissionRules]
    .sort((a, b) => b.revenue_threshold - a.revenue_threshold)
    .find(rule => totalContractRevenueThisMonth >= rule.revenue_threshold);

  if (applicableCommissionRule) {
    autoCalculatedRateForMonth = applicableCommissionRule.commission_rate ?? 0;
    incentiveAmount = applicableCommissionRule.incentive_amount ?? 0;
  }

  const salaryReportData: SalaryReportRow[] = [];
  let calculatedLessonCommissionTotal = 0;

  memberships.forEach(ms => {
    const member = membersMap.get(ms.member_id);
    const sessionsThisMonthForMembership = countSessionsForMembership(ms.id, currentMonthStart, currentMonthEnd, allSessionsForTrainer);
    const sessionsLastMonthForMembership = countSessionsForMembership(ms.id, lastMonthStart, lastMonthEnd, allSessionsForTrainer);
    const sessionPriceForMembership = ms.session_price ?? 0;
    
    const contractualRate = ms.commission_rate;
    // const contractualRate = ms.commission_rate; // 중복 선언 제거
    const rateToApplyToThisRow = (contractualRate !== null && contractualRate !== undefined)
                               ? contractualRate
                               : autoCalculatedRateForMonth;
    
    const revenueFromThisMembership = sessionsThisMonthForMembership * sessionPriceForMembership * (rateToApplyToThisRow / 100);
    calculatedLessonCommissionTotal += revenueFromThisMembership;

    salaryReportData.push({
      membershipId: ms.id,
      contractDate: ms.contract_date,
      memberName: member?.name ?? '알 수 없음',
      contractualCommissionRate: contractualRate ?? null,
      appliedCommissionRate: rateToApplyToThisRow,
      sessionPrice: sessionPriceForMembership,
      sessionsCompletedThisMonth: sessionsThisMonthForMembership,
      sessionsCompletedLastMonth: sessionsLastMonthForMembership,
      remainingSessions: ms.remaining_sessions,
      totalContractedSessions: ms.total_sessions,
      revenueFromMember: revenueFromThisMembership,
    });
  });

  const revenueReportData: RevenueReportRow[] = [];
  memberships.forEach(ms => {
    const member = membersMap.get(ms.member_id);
    const contractStartDate = ms.contract_date ? parseISO(ms.contract_date) : null;
    if (contractStartDate && getYear(contractStartDate) === year && getMonth(contractStartDate) === month - 1) {
        revenueReportData.push({
            membershipId: ms.id,
            contractDate: ms.contract_date,
            registrationType: ms.registration_type,
            memberName: member?.name ?? '알 수 없음',
            totalContractedSessions: ms.total_sessions,
            sessionPrice: ms.session_price,
            paymentMethod: ms.payment_method,
            totalAmount: (ms.total_sessions || 0) * (ms.session_price || 0),
        });
    }
  });

  const baseSalary = trainerSettings?.monthly_salary ?? 0;
  const totalSalaryBeforeDeduction = baseSalary + calculatedLessonCommissionTotal + incentiveAmount;
  const netSalary = totalSalaryBeforeDeduction * (1 - 0.033);

  return {
    totalRevenue: totalRevenueFromSessionsThisMonth,
    totalSessionsCompleted: totalSessionsCompletedThisMonth,
    commissionTotal: totalRevenueFromSessionsThisMonth,
    lessonCommission: calculatedLessonCommissionTotal,
    incentive: incentiveAmount,
    baseSalary,
    totalSalaryBeforeDeduction,
    netSalary,
    commissionRateApplied: autoCalculatedRateForMonth,
    salaryReportData,
    revenueReportData,
  };
};