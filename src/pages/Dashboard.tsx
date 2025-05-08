import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ChevronRight, Users, Scale, Dumbbell, Clock, BarChart3, CreditCard, CheckCircle, ListTodo, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus, UserX, Wallet, ChevronDown, ChevronUp, ListChecks, History } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // Table 관련 import 제거 또는 주석 처리
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { format, parseISO, differenceInMinutes, startOfMonth, subMonths, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AppLayout } from "@/components/layout/AppLayout";
import type { Database, Tables } from '@/integrations/supabase/types';
import { calculateMonthlyRevenueAndSalary } from '@/lib/revenueUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

const useUserRole = () => {
  return { isTrainer: true, isAdmin: true, isOwner: true };
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "날짜 없음";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "날짜 오류";
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { console.error("Error formatting date:", dateString, e); return "날짜 오류"; }
};

type Member = Tables<'members'>;
type ScheduleItem = Tables<'pt_sessions'> & { members: Member | null; duration: number; scheduled_at: string };
type BodyComposition = Tables<'body_composition_logs'> & { members: Member | null };
type RecentWorkout = Tables<'workout_sessions'> & {
  members: Member | null;
  exerciseSummary?: string;
  pt_session_id?: string | null;
};
type Payment = Tables<'memberships'> & { members: Member | null; amount: number; due_date: string };
type LowSessionMember = { membership_id: string; remaining_sessions: number; total_sessions: number; member: Member; };
type PTSessionChangeLog = Tables<'pt_session_change_logs'> & { members: Member | null; };
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


export function Dashboard() {
  const navigate = useNavigate();
  const { user, userCenter } = useAuth();
  const { toast } = useToast();

  const [memberCount, setMemberCount] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [previousMonthActiveMembers, setPreviousMonthActiveMembers] = useState(0);
  const [memberLoading, setMemberLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [canceledSessions, setCanceledSessions] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [ptSessionChangeLogs, setPtSessionChangeLogs] = useState<PTSessionChangeLog[]>([]);
  const [ptSessionChangesLoading, setPtSessionChangesLoading] = useState(true);
  const [ptLogCurrentPage, setPtLogCurrentPage] = useState(1);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleCurrentPage, setScheduleCurrentPage] = useState(1);
  const [allCompositions, setAllCompositions] = useState<BodyComposition[]>([]);
  const [compositionsLoading, setCompositionsLoading] = useState(true);
  const [compositionCurrentPage, setCompositionCurrentPage] = useState(1);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [recentWorkoutsLoading, setRecentWorkoutsLoading] = useState(true);
  const [workoutCurrentPage, setWorkoutCurrentPage] = useState(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [lowSessionMembers, setLowSessionMembers] = useState<LowSessionMember[]>([]);
  const [lowSessionLoading, setLowSessionLoading] = useState(true);
  const [monthlySalaryData, setMonthlySalaryData] = useState<MonthlySalaryData>({ total: 0, net: 0, baseSalary: 0, lessonCommission: 0, incentive: 0 });
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenueData>({ currentRevenue: 0, targetRevenue: null, achievementRate: null, percentageChange: null });
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [isSalaryDetailsVisible, setIsSalaryDetailsVisible] = useState(false);

  const ITEMS_PER_LOG_CARD = 4;
  const ITEMS_PER_SCHEDULE_CARD = 4;
  const ITEMS_PER_COMPOSITION_CARD = 2;

  useEffect(() => {
    const fetchMemberStats = async () => {
      if (!user || !userCenter) { setMemberLoading(false); return; }
      setMemberLoading(true);
      try {
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
        setMemberCount(totalCount || 0);
        setActiveMembers(activeCount || 0);
        setPreviousMonthActiveMembers(prevActiveCount || 0);
      } catch (error) { console.error('회원 통계 로딩 중 오류 발생:', error); }
      finally { setMemberLoading(false); }
    };
    fetchMemberStats();
  }, [user, userCenter]);

  useEffect(() => {
    const fetchSessionStats = async () => {
      if (!user || !userCenter) { setSessionsLoading(false); return; }
      setSessionsLoading(true);
      try {
        const today = new Date();
        const startOfCurrentMonth = startOfMonth(today);
        const endOfCurrentMonth = endOfMonth(today);
        endOfCurrentMonth.setHours(23, 59, 59, 999);

        const { data: centerMembers, error: memberError } = await supabase.from('members').select('user_id').eq('center_id', userCenter).not('user_id', 'is', null);
        if (memberError) throw memberError;
        const centerUserIds = centerMembers?.map(m => m.user_id).filter(id => id !== null) as string[] || [];

        if (centerUserIds.length === 0) {
           setSessionCount(0); setCompletedSessions(0); setCanceledSessions(0); setSessionsLoading(false); return;
        }

        const [totalResult, completedResult, canceledResult] = await Promise.all([
          supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString()).or('status.eq.completed,status.eq.canceled'),
          supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).eq('status', 'completed').in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString()),
          supabase.from('pt_sessions').select('id', { count: 'exact', head: true }).eq('status', 'canceled').in('member_id', centerUserIds).gte('start_time', startOfCurrentMonth.toISOString()).lte('start_time', endOfCurrentMonth.toISOString())
        ]);
        if (totalResult.error) throw totalResult.error;
        if (completedResult.error) throw completedResult.error;
        if (canceledResult.error) throw canceledResult.error;
        setSessionCount(totalResult.count || 0);
        setCompletedSessions(completedResult.count || 0);
        setCanceledSessions(canceledResult.count || 0);
      } catch (error) { console.error('세션 통계 로딩 중 오류 발생:', error); }
      finally { setSessionsLoading(false); }
    };
    fetchSessionStats();
  }, [user, userCenter]);

  useEffect(() => {
    const fetchPTSessionChanges = async () => {
      if (!user || !userCenter) { setPtSessionChangesLoading(false); return; }
      setPtSessionChangesLoading(true);
      setPtLogCurrentPage(1);
      try {
        const { data: logsData, error: logsError } = await supabase.from('pt_session_change_logs').select(`*`).order('created_at', { ascending: false });
        if (logsError) throw logsError;
        if (!logsData || logsData.length === 0) { setPtSessionChangeLogs([]); setPtSessionChangesLoading(false); return; }
        const memberIds = logsData.map(log => log.member_id);
        const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('id', memberIds).eq('center_id', userCenter);
        if (membersError) throw membersError;
        const membersMap = new Map<string, Member>();
        (membersData || []).forEach(member => membersMap.set(member.id, member));
        const combinedData: PTSessionChangeLog[] = logsData.map(log => {
            const member = membersMap.get(log.member_id);
            return member ? { ...log, members: member } : null;
          }).filter((item): item is PTSessionChangeLog => item !== null);
        setPtSessionChangeLogs(combinedData);
      } catch (error) { console.error('PT 세션 변경 로그 처리 중 오류 발생:', error); toast({ title: "오류", description: "PT 세션 변경 로그를 불러오는 중 오류가 발생했습니다.", variant: "destructive" }); }
      finally { setPtSessionChangesLoading(false); }
    };
    fetchPTSessionChanges();
  }, [user, userCenter, toast]);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user || !userCenter) { setScheduleLoading(false); return; }
      setScheduleLoading(true);
      setScheduleCurrentPage(1);
      try {
        const today = new Date();
        const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);
        const { data: centerMembers, error: memberError } = await supabase.from('members').select('user_id').eq('center_id', userCenter).not('user_id', 'is', null);
        if (memberError) throw memberError;
        const centerUserIds = centerMembers?.map(m => m.user_id).filter(id => id !== null) as string[] || [];
        if (centerUserIds.length === 0) { setScheduleItems([]); setScheduleLoading(false); return; }
        const { data: sessionsData, error: sessionsError } = await supabase.from('pt_sessions').select('*').in('member_id', centerUserIds).eq('status', 'scheduled').gte('start_time', startOfDay.toISOString()).lte('start_time', endOfDay.toISOString()).order('start_time', { ascending: true });
        if (sessionsError) throw sessionsError;
        if (!sessionsData || sessionsData.length === 0) { setScheduleItems([]); setScheduleLoading(false); return; }
        const sessionUserIds = sessionsData.map(s => s.member_id);
        const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('user_id', sessionUserIds).eq('center_id', userCenter);
        if (membersError) throw membersError;
        const membersMap = new Map<string, Member>();
        (membersData || []).forEach(member => { if (member.user_id) membersMap.set(member.user_id, member); });
        const formattedData: ScheduleItem[] = sessionsData.map(item => {
          const member = membersMap.get(item.member_id);
          const startTime = parseISO(item.start_time); const endTime = parseISO(item.end_time);
          const duration = !isNaN(startTime.getTime()) && !isNaN(endTime.getTime()) ? differenceInMinutes(endTime, startTime) : 0;
          return { ...item, scheduled_at: item.start_time, duration: duration, members: member || null };
        });
        setScheduleItems(formattedData);
      } catch (error) { console.error('일정 로딩 중 오류 발생:', error); }
      finally { setScheduleLoading(false); }
    };
    fetchSchedule();
  }, [user, userCenter]);

  useEffect(() => {
    const fetchBodyCompositions = async () => { 
      if (!user || !userCenter) { setCompositionsLoading(false); return; }
      setCompositionsLoading(true);
      setCompositionCurrentPage(1); 
      try {
        const { data: centerMembers, error: memberError } = await supabase.from('members').select('id').eq('center_id', userCenter);
        if (memberError) throw memberError;
        const memberIds = centerMembers?.map(m => m.id) || [];
        if (memberIds.length === 0) { 
          setAllCompositions([]); 
          setCompositionsLoading(false); 
          return; 
        }
        const { data, error } = await supabase
          .from('body_composition_logs')
          .select(`*, members ( id, user_id, name, profile_image_url )`) 
          .in('member_id', memberIds)
          .order('measurement_date', { ascending: false }) 
          .limit(20); 

        if (error) throw error;
        setAllCompositions((data as BodyComposition[]) || []); 
      } catch (error) { 
        console.error('체성분 데이터 로딩 중 오류 발생:', error); 
        setAllCompositions([]); 
      } finally { 
        setCompositionsLoading(false); 
      }
    };
    fetchBodyCompositions();
  }, [user, userCenter]);

  useEffect(() => {
    const fetchRecentWorkouts = async () => {
      if (!user || !userCenter) { setRecentWorkoutsLoading(false); return; }
      setRecentWorkoutsLoading(true);
      setWorkoutCurrentPage(1); 
      try {
        console.log('[Dashboard] fetchRecentWorkouts: Fetching center members...');
        const { data: centerMembers, error: memberError } = await supabase
          .from('members')
          .select('id')
          .eq('center_id', userCenter);

        if (memberError) {
          console.error('[Dashboard] fetchRecentWorkouts: Error fetching center members:', memberError);
          throw memberError;
        }
        const memberPks = centerMembers?.map(m => m.id) || [];
        console.log('[Dashboard] fetchRecentWorkouts: Member PKs for center:', memberPks);

        if (memberPks.length === 0) {
          console.log('[Dashboard] fetchRecentWorkouts: No member PKs found, setting empty workouts.');
          setRecentWorkouts([]);
          setRecentWorkoutsLoading(false);
          return;
        }

        console.log('[Dashboard] fetchRecentWorkouts: Fetching workout_sessions for member PKs:', memberPks);
        const { data, error } = await supabase
          .from('workout_sessions')
          .select(`
            id, session_date, notes, member_id,
            members (
              user_id, name, profile_image_url
            )
          `)
          .in('member_id', memberPks)
          .order('session_date', { ascending: false });

        if (error) {
          console.error('[Dashboard] fetchRecentWorkouts: Error fetching workout_sessions:', error);
          throw error;
        }
        console.log('[Dashboard] fetchRecentWorkouts: Fetched workout_sessions data:', data);

        const formattedData: RecentWorkout[] = (data || []).map((session: any) => {
          let summary = session.notes || `운동 기록 (${format(parseISO(session.session_date), 'MM/dd')})`;
          return {
            ...session,
            members: session.members as Member | null,
            exerciseSummary: summary,
          };
        });
        console.log('[Dashboard] fetchRecentWorkouts: Formatted recent workouts:', formattedData);
        setRecentWorkouts(formattedData);
      } catch (error) {
        console.error('[Dashboard] fetchRecentWorkouts: Overall error:', error);
        setRecentWorkouts([]);
      } finally {
        setRecentWorkoutsLoading(false);
        console.log('[Dashboard] fetchRecentWorkouts: Finished.');
      }
    };
    fetchRecentWorkouts();
  }, [user, userCenter]);

  useEffect(() => {
    const fetchPayments = async () => {
       if (!user || !userCenter) { setPaymentsLoading(false); return; }
       setPaymentsLoading(true);
       try {
         const { data: centerMembers, error: memberError } = await supabase.from('members').select('id').eq('center_id', userCenter);
         if (memberError) throw memberError;
         const memberIds = centerMembers?.map(m => m.id) || [];
         if (memberIds.length === 0) { setPayments([]); setPaymentsLoading(false); return; }
         const { data, error } = await supabase.from('memberships').select(`*`).in('member_id', memberIds).order('end_date', { ascending: true, nullsFirst: false }).limit(10);
         if (error) throw error;
         const formattedData: Payment[] = (data || []).map((membership: any) => ({ ...membership, amount: 0, status: membership.end_date && new Date(membership.end_date) < new Date() ? 'expired' : 'active', due_date: membership.end_date || '', members: null }));
         setPayments(formattedData);
       } catch (error) { console.error('결제 데이터 로딩 중 오류 발생:', error); }
       finally { setPaymentsLoading(false); }
     };
     fetchPayments();
   }, [user, userCenter]);

   useEffect(() => {
     const fetchLowSessionMembers = async () => {
       if (!userCenter) { setLowSessionLoading(false); return; }
       setLowSessionLoading(true);
       try {
         const { data: membershipsData, error: membershipsError } = await supabase.from('memberships').select('id, remaining_sessions, member_id, total_sessions').lte('remaining_sessions', 5).gt('remaining_sessions', 0).order('remaining_sessions', { ascending: true });
         if (membershipsError) throw membershipsError;
         if (!membershipsData || membershipsData.length === 0) { setLowSessionMembers([]); setLowSessionLoading(false); return; }
         const memberUserIds = membershipsData.map(m => m.member_id).filter((id): id is string => id !== null);
         if (memberUserIds.length === 0) { setLowSessionMembers([]); setLowSessionLoading(false); return; }
         const { data: membersData, error: membersError } = await supabase.from('members').select('*').in('user_id', memberUserIds).eq('center_id', userCenter);
         if (membersError) throw membersError;
         const membersMap = new Map<string, Member>();
         (membersData || []).forEach(member => { if (member.user_id) membersMap.set(member.user_id, member); });
         const combinedData: LowSessionMember[] = membershipsData.map(membership => {
             if (!membership.member_id) return null;
             const member = membersMap.get(membership.member_id);
             return member ? { membership_id: membership.id, remaining_sessions: membership.remaining_sessions, total_sessions: membership.total_sessions, member: member } : null;
           }).filter((item): item is LowSessionMember => item !== null);
         setLowSessionMembers(combinedData);
       } catch (error: any) { console.error('[Dashboard-LowSession] Error loading low session members:', error); setLowSessionMembers([]); toast({ title: "오류", description: `만료 예정 회원 로딩 중 오류: ${error.message}`, variant: "destructive" }); }
       finally { setLowSessionLoading(false); }
     };
     fetchLowSessionMembers();
   }, [userCenter, toast]);

   useEffect(() => {
     const fetchDashboardData = async () => {
       if (!user || !userCenter) {
         setSalaryLoading(false);
         setRevenueLoading(false);
         return;
       }
       setSalaryLoading(true);
       setRevenueLoading(true);
       try {
         const today = new Date();
         const currentYear = today.getFullYear();
         const currentMonth = today.getMonth() + 1;
         
         const yearStartDate = format(startOfYear(today), 'yyyy-MM-dd');
         const yearEndDate = format(endOfYear(today), 'yyyy-MM-dd');
         const yearEndDateWithTime = format(endOfYear(today), "yyyy-MM-dd'T'23:59:59.999'Z'");

         const monthStartDate = startOfMonth(today);
         const monthEndDate = endOfMonth(today);
         monthEndDate.setHours(23, 59, 59, 999);

         const [
           allMembershipsRes,
           allCompletedSessionsRes,
           trainerSettingsRes,
           commissionRulesRes,
           sessionPriceRulesRes,
           membersRes,
           previousMonthContractMembershipsRes,
         ] = await Promise.all([
           supabase.from('memberships').select('*').eq('trainer_id', user.id).lte('start_date', format(monthEndDate, 'yyyy-MM-dd')).or(`end_date.gte.${format(monthStartDate, 'yyyy-MM-dd')},end_date.is.null`),
           supabase.from('pt_sessions').select('*').eq('trainer_id', user.id).in('status', ['completed', 'canceled']).gte('end_time', format(startOfYear(today), "yyyy-MM-dd'T'00:00:00'Z'")).lte('end_time', yearEndDateWithTime),
           supabase.from('trainer_settings').select('*').eq('trainer_id', user.id).eq('center_id', userCenter).maybeSingle(),
           supabase.from('commission_rules').select('*').eq('center_id', userCenter).order('revenue_threshold'),
           supabase.from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions'),
           supabase.from('members').select<string, Tables<'members'>>('*').eq('center_id', userCenter),
           supabase.from('memberships').select('session_price, total_sessions').eq('trainer_id', user.id).gte('contract_date', format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')).lte('contract_date', format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'23:59:59.999'Z'")),
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

         setMonthlySalaryData({
           total: reportResult.totalSalaryBeforeDeduction,
           net: reportResult.netSalary,
           baseSalary: reportResult.baseSalary,
           lessonCommission: reportResult.lessonCommission,
           incentive: reportResult.incentive,
         });

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

         setMonthlyRevenueData({
           currentRevenue: currentMonthContractRevenue,
           targetRevenue: targetRevenue,
           achievementRate: achievementRate,
           percentageChange: percentageChange,
         });

       } catch (error: any) {
         console.error("Error calculating dashboard data:", error);
         toast({ title: "오류", description: `대시보드 데이터 계산 중 오류 발생: ${error.message}`, variant: "destructive" });
         setMonthlySalaryData({ total: 0, net: 0, baseSalary: 0, lessonCommission: 0, incentive: 0 });
         setMonthlyRevenueData({ currentRevenue: 0, targetRevenue: null, achievementRate: null, percentageChange: null });
       } finally {
         setSalaryLoading(false);
         setRevenueLoading(false);
       }
     };

     fetchDashboardData();
   }, [user, userCenter, toast]);


 return (
    <AppLayout>
      <div className="space-y-6">
        {/* 첫 번째 행 카드들 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 총 회원 수 */}
          <Card className="min-h-[150px]">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">총 회원 수</CardTitle>
              </div>
            </CardHeader>
            <CardContent> {memberLoading ? <Skeleton className="h-8 w-20" /> : (<> <div className="text-2xl font-bold">{memberCount}명</div> <p className="text-xs text-muted-foreground mt-1"> { memberLoading ? <Skeleton className="h-4 w-24" /> : previousMonthActiveMembers !== null ? ( activeMembers > previousMonthActiveMembers ? ( <span className="text-green-500 flex items-center"> <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 +{activeMembers - previousMonthActiveMembers}명 </span> ) : activeMembers < previousMonthActiveMembers ? ( <span className="text-red-500 flex items-center"> <TrendingDown className="h-4 w-4 mr-1" /> 전월 대비 {activeMembers - previousMonthActiveMembers}명 </span> ) : ( <span className="text-orange-500 flex items-center"> <Minus className="h-4 w-4 mr-1" /> 전월 대비 변동 없음 </span> ) ) : ( <span>활성 회원: {activeMembers}명</span> ) } </p> </>)} </CardContent>
          </Card>
          {/* 월간 PT 수 */}
          <Card className="min-h-[150px]">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">이번 달 PT 수</CardTitle>
              </div>
            </CardHeader>
            <CardContent> {sessionsLoading ? <Skeleton className="h-8 w-20" /> : (<> <div className="text-2xl font-bold">{sessionCount}건</div> <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground"> <div className="flex items-center"> <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> <span>완료 {completedSessions}건</span> </div> <div className="flex items-center"> <UserX className="h-4 w-4 mr-1 text-red-500" /> <span>노쇼 {canceledSessions}건</span> </div> </div> </>)} </CardContent>
          </Card>
           {/* 이번 달 예상 월급 */}
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
                 {salaryLoading ? <Skeleton className="h-8 w-24" /> : (
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
          {/* 월간 매출 */}
          <Card className="min-h-[150px]">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 h-[52px]">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">월간 계약 매출</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
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
                         <span className="text-green-500 flex items-center"> <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 증가 (전월 0) </span>
                       ) : monthlyRevenueData.percentageChange > 0 ? (
                         <span className="text-green-500 flex items-center"> <TrendingUp className="h-4 w-4 mr-1" /> 전월 대비 +{monthlyRevenueData.percentageChange.toFixed(1)}% </span>
                       ) : monthlyRevenueData.percentageChange < 0 ? (
                         <span className="text-red-500 flex items-center"> <TrendingDown className="h-4 w-4 mr-1" /> 전월 대비 {monthlyRevenueData.percentageChange.toFixed(1)}% </span>
                       ) : (
                         <span className="text-orange-500 flex items-center"> <Minus className="h-4 w-4 mr-1" /> 전월 대비 변동 없음 </span>
                       )}
                     </p>
                   )}
                 </>
               )}
            </CardContent>
          </Card>
        </div>

        {/* 두 번째 행 카드들 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
          {/* 오늘의 일정 */}
          <Card className="lg:col-span-5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">오늘의 일정</CardTitle>
                </div>
                <CardDescription>예약된 PT 세션과 클래스</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}> 전체 일정 보기 <ChevronRight className="ml-2 h-4 w-4" /> </Button>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="w-full space-y-3"> <Skeleton className="h-8 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full"/> </div>
              ) : (() => {
                const paginatedScheduleItems = scheduleItems.slice((scheduleCurrentPage - 1) * ITEMS_PER_SCHEDULE_CARD, scheduleCurrentPage * ITEMS_PER_SCHEDULE_CARD);
                const totalSchedulePages = Math.ceil(scheduleItems.length / ITEMS_PER_SCHEDULE_CARD);
                return paginatedScheduleItems.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {paginatedScheduleItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={item.members?.profile_image_url || undefined} />
                              <AvatarFallback>{item.members?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{item.members?.name || '알 수 없는 회원'}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(item.start_time), 'HH:mm')} ({item.duration}분) - {item.type}
                              </p>
                            </div>
                          </div>
                          <div>
                            {item.status === 'completed' && <Badge variant="secondary" className="text-green-600 border-green-600 bg-green-100 dark:bg-green-900/30">완료</Badge>}
                            {item.status === 'scheduled' && <Badge variant="outline" className="text-blue-600 border-blue-600">예약</Badge>}
                            {item.status === 'canceled' && <Badge variant="destructive">취소/노쇼</Badge>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/schedule', { state: { highlightId: item.id } })}>
                            상세
                          </Button>
                        </div>
                      ))}
                    </div>
                    {totalSchedulePages > 1 && (
                      <div className="mt-4 flex justify-center items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setScheduleCurrentPage(p => Math.max(1, p - 1))} disabled={scheduleCurrentPage === 1}>이전</Button>
                        <span className="text-sm text-muted-foreground">{scheduleCurrentPage} / {totalSchedulePages}</span>
                        <Button variant="outline" size="sm" onClick={() => setScheduleCurrentPage(p => Math.min(totalSchedulePages, p + 1))} disabled={scheduleCurrentPage === totalSchedulePages}>다음</Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Calendar className="h-10 w-10 mb-2 opacity-20" />
                    <p>오늘 예약된 일정이 없습니다.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* 최근 PT 횟수 변경 로그 */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">최근 PT 횟수 변경</CardTitle>
              </div>
              <CardDescription>최근 PT 횟수 변경 기록</CardDescription>
            </CardHeader>
            <CardContent>
              {ptSessionChangesLoading ? (
                <div className="w-full space-y-3"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> </div>
              ) : (() => {
                const paginatedLogs = ptSessionChangeLogs.slice((ptLogCurrentPage - 1) * ITEMS_PER_LOG_CARD, ptLogCurrentPage * ITEMS_PER_LOG_CARD);
                const totalPages = Math.ceil(ptSessionChangeLogs.length / ITEMS_PER_LOG_CARD);
                return paginatedLogs.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {paginatedLogs.map((log) => (
                        <div key={log.id} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={log.members?.profile_image_url || undefined} />
                              <AvatarFallback>{log.members?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{log.members?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(log.created_at), 'yyyy.MM.dd HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              총 {log.previous_total_sessions}회 → {log.new_total_sessions}회
                            </p>
                            <p className={`text-xs ${log.change_amount > 0 ? 'text-green-500' : log.change_amount < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              ({log.change_amount > 0 ? '+' : ''}{log.change_amount}회)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-4 flex justify-center items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setPtLogCurrentPage(p => Math.max(1, p - 1))} disabled={ptLogCurrentPage === 1}>이전</Button>
                        <span className="text-sm text-muted-foreground">{ptLogCurrentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setPtLogCurrentPage(p => Math.min(totalPages, p + 1))} disabled={ptLogCurrentPage === totalPages}>다음</Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <ListTodo className="h-10 w-10 mb-2 opacity-20" />
                    <p>최근 PT 횟수 변경 기록이 없습니다.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

           {/* 만료 예정 회원 카드 */}
           <Card className="lg:col-span-3">
             <CardHeader className="flex flex-row items-center space-y-0 pb-2">
               <div className="flex items-center gap-2">
                 <AlertTriangle className="h-4 w-4 text-yellow-500" />
                 <CardTitle className="text-sm font-medium">만료 예정 회원</CardTitle>
               </div>
             </CardHeader>
             <CardContent className="pt-2"> {lowSessionLoading ? (<div className="space-y-2"> <Skeleton className="h-6 w-full" /> <Skeleton className="h-6 w-full" /> <Skeleton className="h-6 w-full" /> </div>) : lowSessionMembers.length > 0 ? (<> <Carousel opts={{ align: "start", loop: false, }} className="w-full max-w-xs mx-auto" > <CarouselContent className="-ml-1"> {lowSessionMembers.map((item) => ( <CarouselItem key={item.membership_id} className="pl-1 basis-full"> <div className="p-1"> <div className="flex items-center justify-between text-sm bg-muted p-3 rounded-md"> <div className="flex items-center gap-2 overflow-hidden"> <Avatar className="h-6 w-6"> <AvatarImage src={item.member.profile_image_url || undefined} /> <AvatarFallback>{item.member.name?.[0]}</AvatarFallback> </Avatar> <span className="font-medium truncate">{item.member.name}</span> </div> <Badge variant="outline" className="text-xs flex-shrink-0"> {item.remaining_sessions} / {item.total_sessions}회 </Badge> </div> </div> </CarouselItem> ))} </CarouselContent> {lowSessionMembers.length > 1 && ( <> <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2" /> <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2" /> </> )} </Carousel> <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs w-full justify-end" onClick={() => navigate('/members?filter=low_sessions')}> 전체 명단 보기 </Button> </>) : (<p className="text-sm text-muted-foreground text-center py-4">만료 예정 회원이 없습니다.</p>)} </CardContent>
           </Card>

        </div>

        {/* 세 번째 행 카드들 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 최근 체성분 분석 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">최근 체성분 분석</CardTitle>
                </div>
                <CardDescription>가장 최근 측정된 회원 체성분 기록</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/measurements/history')}> 모든 측정 기록 보기 <ChevronRight className="ml-2 h-4 w-4" /> </Button>
            </CardHeader>
            <CardContent>
              {compositionsLoading ? (
                <div className="w-full space-y-3"> <Skeleton className="h-20 w-full" /> <Skeleton className="h-20 w-full" /> </div>
              ) : (() => {
                const paginatedCompositions = allCompositions.slice((compositionCurrentPage - 1) * ITEMS_PER_COMPOSITION_CARD, compositionCurrentPage * ITEMS_PER_COMPOSITION_CARD);
                const totalCompositionPages = Math.ceil(allCompositions.length / ITEMS_PER_COMPOSITION_CARD);

                return paginatedCompositions.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {paginatedCompositions.map((composition) => (
                        <div key={composition.id} className="space-y-2 border-b pb-2 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={composition.members?.profile_image_url || undefined} />
                                <AvatarFallback>{composition.members?.name?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{composition.members?.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{formatDate(composition.measurement_date)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div className="flex justify-between"> <span>체중:</span> <span className="font-medium">{composition.weight_kg?.toFixed(1) ?? '-'} kg</span> </div>
                            <div className="flex justify-between"> <span>골격근량:</span> <span className="font-medium">{composition.skeletal_muscle_mass_kg?.toFixed(1) ?? '-'} kg</span> </div>
                            <div className="flex justify-between"> <span>체지방률:</span> <span className="font-medium">{composition.body_fat_percentage?.toFixed(1) ?? '-'} %</span> </div>
                            <div className="flex justify-between"> <span>BMI:</span> <span className="font-medium">{composition.bmi?.toFixed(1) ?? '-'}</span> </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalCompositionPages > 1 && (
                      <div className="mt-4 flex justify-center items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setCompositionCurrentPage(p => Math.max(1, p - 1))} disabled={compositionCurrentPage === 1}>이전</Button>
                        <span className="text-sm text-muted-foreground">{compositionCurrentPage} / {totalCompositionPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCompositionCurrentPage(p => Math.min(totalCompositionPages, p + 1))} disabled={compositionCurrentPage === totalCompositionPages}>다음</Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Scale className="h-10 w-10 mb-2 opacity-20" />
                    <p>최근 측정된 체성분 데이터가 없습니다.</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* 최근 운동 기록 카드 */}
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
              {recentWorkoutsLoading ? (
                 <div className="w-full space-y-3"> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> <Skeleton className="h-12 w-full" /> </div>
              ) : (() => {
                const paginatedWorkouts = recentWorkouts.slice((workoutCurrentPage - 1) * ITEMS_PER_LOG_CARD, workoutCurrentPage * ITEMS_PER_LOG_CARD);
                const totalPages = Math.ceil(recentWorkouts.length / ITEMS_PER_LOG_CARD);
                return paginatedWorkouts.length > 0 ? (
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
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default Dashboard;
