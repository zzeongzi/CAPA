// src/lib/dashboardQueries.ts
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, differenceInMinutes } from 'date-fns';
import { calculateMonthlyRevenueAndSalary } from '@/lib/revenueUtils';
import type { Tables } from '@/integrations/supabase/types';

// Shared Member type
type Member = Tables<'members'>;

// For FinancialData (Salary & Revenue)
type MonthlySalaryData = {
  total: number;
  net: number;
  baseSalary: number;
  lessonCommission: number;
  incentive: number;
};

type MonthlyRevenueData = {
  currentRevenue: number;
  targetRevenue: number | null;
  achievementRate: number | null;
  percentageChange: number | null;
};

export interface FinancialData {
  salaryData: MonthlySalaryData;
  revenueData: MonthlyRevenueData;
}

export const fetchFinancialData = async (userId: string | undefined, userCenter: string | null | undefined): Promise<FinancialData> => {
  if (!userId || !userCenter) {
    throw new Error("User or user center is not defined for financial data.");
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const monthStartDate = startOfMonth(today);
  const monthEndDate = endOfMonth(today);
  monthEndDate.setHours(23, 59, 59, 999);
  const yearEndDateWithTime = format(endOfYear(today), "yyyy-MM-dd'T'23:59:59.999'Z'");

  const [
    allMembershipsRes,
    allCompletedSessionsRes,
    trainerSettingsRes,
    commissionRulesRes,
    sessionPriceRulesRes,
    membersRes,
    previousMonthContractMembershipsRes,
  ] = await Promise.all([
    supabase.from('memberships').select('*').eq('trainer_id', userId).lte('start_date', format(monthEndDate, 'yyyy-MM-dd')).or(`end_date.gte.${format(monthStartDate, 'yyyy-MM-dd')},end_date.is.null`),
    supabase.from('pt_sessions').select('*').eq('trainer_id', userId).in('status', ['completed', 'canceled']).gte('end_time', format(startOfYear(today), "yyyy-MM-dd'T'00:00:00'Z'")).lte('end_time', yearEndDateWithTime),
    supabase.from('trainer_settings').select('*').eq('trainer_id', userId).eq('center_id', userCenter).maybeSingle(),
    supabase.from('commission_rules').select('*').eq('center_id', userCenter).order('revenue_threshold'),
    supabase.from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions'),
    supabase.from('members').select<string, Tables<'members'>>('*').eq('center_id', userCenter),
    supabase.from('memberships').select('session_price, total_sessions').eq('trainer_id', userId).gte('contract_date', format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')).lte('contract_date', format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'23:59:59.999'Z'")),
  ]);

  if (allMembershipsRes.error) throw new Error(`멤버십 조회 오류: ${allMembershipsRes.error.message}`);
  if (allCompletedSessionsRes.error) throw new Error(`완료된 세션 조회 오류: ${allCompletedSessionsRes.error.message}`);
  if (trainerSettingsRes.error) throw new Error(`트레이너 설정 조회 오류: ${trainerSettingsRes.error.message}`);
  if (commissionRulesRes.error) throw new Error(`커미션 규칙 조회 오류: ${commissionRulesRes.error.message}`);
  if (sessionPriceRulesRes.error) throw new Error(`세션 단가 규칙 조회 오류: ${sessionPriceRulesRes.error.message}`);
  if (membersRes.error) throw new Error(`회원 정보 조회 오류: ${membersRes.error.message}`);
  if (previousMonthContractMembershipsRes.error) throw new Error(`전월 계약 멤버십 조회 오류: ${previousMonthContractMembershipsRes.error.message}`);

  const allMemberships = allMembershipsRes.data || [];
  const allCompletedSessions = allCompletedSessionsRes.data || [];
  const trainerSettings = trainerSettingsRes.data || null;
  const commissionRules = commissionRulesRes.data || [];
  const sessionPriceRules = sessionPriceRulesRes.data || [];
  const members = membersRes.data || [];
  const previousMonthContractMemberships = previousMonthContractMembershipsRes.data || [];

  const reportResult = calculateMonthlyRevenueAndSalary(
    currentYear,
    currentMonth,
    allMemberships,
    allCompletedSessions.filter(s => {
      const sessionTime = s.end_time ? parseISO(s.end_time) : new Date(0);
      return sessionTime >= monthStartDate && sessionTime <= monthEndDate;
    }),
    trainerSettings,
    commissionRules,
    sessionPriceRules,
    members
  );

  const salaryData: MonthlySalaryData = {
    total: reportResult.totalSalaryBeforeDeduction,
    net: reportResult.netSalary,
    baseSalary: reportResult.baseSalary,
    lessonCommission: reportResult.lessonCommission,
    incentive: reportResult.incentive,
  };
  
  const currentMonthContractRevenue = reportResult.revenueReportData.reduce((sum, r) => sum + r.totalAmount, 0);
  const targetRevenue = trainerSettings?.target_revenue || null;
  let achievementRate: number | null = null;
  if (targetRevenue && targetRevenue > 0) {
    achievementRate = (currentMonthContractRevenue / targetRevenue) * 100;
  }

  const previousMonthRevenue = previousMonthContractMemberships.reduce((sum, m) => sum + ((m.session_price || 0) * (m.total_sessions || 0)), 0);
  let percentageChange: number | null = null;
  if (previousMonthRevenue > 0) {
    percentageChange = ((currentMonthContractRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
  } else if (currentMonthContractRevenue > 0) {
    percentageChange = Infinity;
  }
  
  const revenueData: MonthlyRevenueData = {
    currentRevenue: currentMonthContractRevenue,
    targetRevenue: targetRevenue,
    achievementRate: achievementRate,
    percentageChange: percentageChange,
  };
  
  return { salaryData, revenueData };
};

// For MemberStatsCard
export interface MemberStatsData {
  memberCount: number;
  activeMembers: number;
  previousMonthActiveMembers: number;
}
export const fetchMemberStats = async (userCenter: string | null | undefined): Promise<MemberStatsData> => {
  if (!userCenter) throw new Error("User center is not defined for member stats.");
  const now = new Date();
  const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

  const [{ count: totalCount, error: countError }, { count: activeCount, error: activeError }, { count: prevActiveCount, error: prevActiveError }] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('center_id', userCenter),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('center_id', userCenter).eq('status', 'active'),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('center_id', userCenter).eq('status', 'active').lte('registration_date', endOfPreviousMonth.toISOString().split('T')[0])
  ]);

  if (countError) throw countError;
  if (activeError) throw activeError;
  if (prevActiveError) throw prevActiveError;

  return {
    memberCount: totalCount || 0,
    activeMembers: activeCount || 0,
    previousMonthActiveMembers: prevActiveCount || 0,
  };
};

// For SessionStatsCard
export interface SessionStatsData {
  sessionCount: number;
  completedSessions: number;
  canceledSessions: number;
}
export const fetchSessionStats = async (userCenter: string | null | undefined): Promise<SessionStatsData> => {
  if (!userCenter) throw new Error("User center is not defined for session stats.");
  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = endOfMonth(today);
  endOfCurrentMonth.setHours(23, 59, 59, 999);

  const { data: centerMembers, error: memberError } = await supabase.from('members').select('user_id').eq('center_id', userCenter).not('user_id', 'is', null);
  if (memberError) throw memberError;
  const centerUserIds = centerMembers?.map(m => m.user_id).filter(id => id !== null) as string[] || [];

  if (centerUserIds.length === 0) return { sessionCount: 0, completedSessions: 0, canceledSessions: 0 };

  const [totalResult, completedResult, canceledResult] = await Promise.all([
    supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString()).or('status.eq.completed,status.eq.canceled'),
    supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).eq('status', 'completed').in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString()),
    supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).eq('status', 'canceled').in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString())
  ]);

  if (totalResult.error) throw totalResult.error;
  if (completedResult.error) throw completedResult.error;
  if (canceledResult.error) throw canceledResult.error;

  return {
    sessionCount: totalResult.count || 0,
    completedSessions: completedResult.count || 0,
    canceledSessions: canceledResult.count || 0,
  };
};

// For TodaysScheduleCard
export type ScheduleItem = Tables<'pt_sessions'> & { members: Member | null; duration: number; scheduled_at: string };
export const fetchTodaysSchedule = async (userCenter: string | null | undefined): Promise<ScheduleItem[]> => {
  if (!userCenter) throw new Error("User center is not defined for today's schedule.");
  const today = new Date();
  const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

  const { data: centerMembers, error: memberError } = await supabase.from('members').select('user_id').eq('center_id', userCenter).not('user_id', 'is', null);
  if (memberError) throw memberError;
  const centerUserIds = centerMembers?.map(m => m.user_id).filter(id => id !== null) as string[] || [];
  if (centerUserIds.length === 0) return [];

  const { data: sessionsData, error: sessionsError } = await supabase.from('pt_sessions').select('*').in('member_id', centerUserIds).eq('status', 'scheduled').gte('start_time', startOfDay.toISOString()).lte('start_time', endOfDay.toISOString()).order('start_time', { ascending: true });
  if (sessionsError) throw sessionsError;
  if (!sessionsData || sessionsData.length === 0) return [];

  const sessionUserIds = sessionsData.map(s => s.member_id);
  const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('user_id', sessionUserIds).eq('center_id', userCenter);
  if (membersError) throw membersError;

  const membersMap = new Map<string, Member>();
  (membersData || []).forEach(member => { if (member.user_id) membersMap.set(member.user_id, member); });

  return sessionsData.map(item => {
    const member = membersMap.get(item.member_id);
    const startTime = parseISO(item.start_time);
    const endTime = parseISO(item.end_time);
    const duration = !isNaN(startTime.getTime()) && !isNaN(endTime.getTime()) ? differenceInMinutes(endTime, startTime) : 0;
    return { ...item, scheduled_at: item.start_time, duration: duration, members: member || null };
  });
};

// For RecentPTSessionChangesCard
export type PTSessionChangeLog = Tables<'pt_session_change_logs'> & { members: Member | null; };
export const fetchPTSessionChanges = async (userCenter: string | null | undefined): Promise<PTSessionChangeLog[]> => {
  if (!userCenter) throw new Error("User center is not defined for PT session changes.");
  const { data: logsData, error: logsError } = await supabase.from('pt_session_change_logs').select(`*`).order('created_at', { ascending: false });
  if (logsError) throw logsError;
  if (!logsData || logsData.length === 0) return [];

  const memberIds = logsData.map(log => log.member_id).filter(id => id !== null) as string[];
  if (memberIds.length === 0) return logsData.map(log => ({...log, members: null}));

  const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('id', memberIds).eq('center_id', userCenter);
  if (membersError) throw membersError;

  const membersMap = new Map<string, Member>();
  (membersData || []).forEach(member => membersMap.set(member.id, member));

  return logsData.map(log => {
    const member = log.member_id ? membersMap.get(log.member_id) : null;
    return { ...log, members: member || null };
  }).filter((item): item is PTSessionChangeLog => item.members !== null);
};

// For LowSessionMembersCard
export type LowSessionMember = { membership_id: string; remaining_sessions: number; total_sessions: number; member: Member; };
export const fetchLowSessionMembers = async (userCenter: string | null | undefined): Promise<LowSessionMember[]> => {
  if (!userCenter) throw new Error("User center is not defined for low session members.");
  const { data: membershipsData, error: membershipsError } = await supabase.from('memberships').select('id, remaining_sessions, member_id, total_sessions').lte('remaining_sessions', 5).gt('remaining_sessions', 0).order('remaining_sessions', { ascending: true });
  if (membershipsError) throw membershipsError;
  if (!membershipsData || membershipsData.length === 0) return [];

  const memberUserIds = membershipsData.map(m => m.member_id).filter((id): id is string => id !== null);
  if (memberUserIds.length === 0) return [];

  const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('user_id', memberUserIds).eq('center_id', userCenter);
  if (membersError) throw membersError;

  const membersMap = new Map<string, Member>();
  (membersData || []).forEach(member => { if (member.user_id) membersMap.set(member.user_id, member); });

  return membershipsData.map(membership => {
    if (!membership.member_id) return null;
    const member = membersMap.get(membership.member_id);
    return member ? { membership_id: membership.id, remaining_sessions: membership.remaining_sessions ?? 0, total_sessions: membership.total_sessions ?? 0, member: member } : null;
  }).filter((item): item is LowSessionMember => item !== null && item.member !== null);
};

// For RecentBodyCompositionsCard
export type BodyComposition = Tables<'body_composition_logs'> & { members: Member | null };
export const fetchRecentBodyCompositions = async (userCenter: string | null | undefined): Promise<BodyComposition[]> => {
  if (!userCenter) throw new Error("User center is not defined for body compositions.");
  const { data: centerMembers, error: memberError } = await supabase.from('members').select('id').eq('center_id', userCenter);
  if (memberError) throw memberError;
  const memberIds = centerMembers?.map(m => m.id) || [];
  if (memberIds.length === 0) return [];

  const { data, error } = await supabase.from('body_composition_logs').select(`*, members ( id, user_id, name, profile_image_url )`).in('member_id', memberIds).order('measurement_date', { ascending: false }).limit(20);
  if (error) throw error;
  return (data as BodyComposition[]) || [];
};

// For RecentWorkoutsCard
export type RecentWorkout = Tables<'workout_sessions'> & { members: Member | null; exerciseSummary?: string; pt_session_id?: string | null; };
export const fetchRecentWorkouts = async (userCenter: string | null | undefined): Promise<RecentWorkout[]> => {
  if (!userCenter) throw new Error("User center is not defined for recent workouts.");
  const { data: centerMembers, error: memberError } = await supabase.from('members').select('id').eq('center_id', userCenter);
  if (memberError) throw memberError;
  const memberPks = centerMembers?.map(m => m.id) || [];
  if (memberPks.length === 0) return [];

  const { data, error } = await supabase.from('workout_sessions').select(`id, session_date, notes, member_id, members (user_id, name, profile_image_url)`).in('member_id', memberPks).order('session_date', { ascending: false });
  if (error) throw error;

  return (data || []).map((session: any) => ({
    ...session,
    members: session.members as Member | null,
    exerciseSummary: session.notes || `운동 기록 (${format(parseISO(session.session_date), 'MM/dd')})`,
  }));
};
