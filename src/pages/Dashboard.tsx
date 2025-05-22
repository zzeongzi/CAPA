import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, ChevronRight, Scale, Dumbbell, Clock, BarChart3, CreditCard, CheckCircle, ListTodo, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus, UserX, Wallet, ChevronDown, ChevronUp, ListChecks, History } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // Table 관련 import 제거 또는 주석 처리
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { format, parseISO, differenceInMinutes, startOfMonth, subMonths, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import MemberStatsCard from '@/components/features/dashboard/MemberStatsCard';
import SessionStatsCard from '@/components/features/dashboard/SessionStatsCard';
import MonthlySalaryCard from '@/components/features/dashboard/MonthlySalaryCard';
import MonthlyRevenueCard from '@/components/features/dashboard/MonthlyRevenueCard';
import TodaysScheduleCard from '@/components/features/dashboard/TodaysScheduleCard';
import RecentPTSessionChangesCard from '@/components/features/dashboard/RecentPTSessionChangesCard';
import LowSessionMembersCard from '@/components/features/dashboard/LowSessionMembersCard';
import RecentBodyCompositionsCard from '@/components/features/dashboard/RecentBodyCompositionsCard';
import RecentWorkoutsCard from '@/components/features/dashboard/RecentWorkoutsCard';
import { ko } from 'date-fns/locale';
import { AppLayout } from "@/components/layout/AppLayout";
import type { Database, Tables } from '@/integrations/supabase/types';
// import { calculateMonthlyRevenueAndSalary } from '@/lib/revenueUtils'; // No longer used directly in Dashboard
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useUserRole } from '@/hooks/useUserRole'; // Import the new hook

const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

// const useUserRole = () => { // Remove the old local hook
//   return { isTrainer: true, isAdmin: true, isOwner: true };
// };

const formatDate = (dateString: string | null | undefined): string => { // This might be unused after all cards are refactored
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
  const userRoleData = useUserRole();

  useEffect(() => {
    console.log("User Roles from hook:", userRoleData);
  }, [userRoleData]);

  // const [ptSessionChangeLogs, setPtSessionChangeLogs] = useState<PTSessionChangeLog[]>([]);
  // const [ptSessionChangesLoading, setPtSessionChangesLoading] = useState(true);
  // const [ptLogCurrentPage, setPtLogCurrentPage] = useState(1);
  // const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  // const [scheduleLoading, setScheduleLoading] = useState(true);
  // const [scheduleCurrentPage, setScheduleCurrentPage] = useState(1);
  // const [allCompositions, setAllCompositions] = useState<BodyComposition[]>([]);
  // const [compositionsLoading, setCompositionsLoading] = useState(true);
  // const [compositionCurrentPage, setCompositionCurrentPage] = useState(1);
  // const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  // const [recentWorkoutsLoading, setRecentWorkoutsLoading] = useState(true);
  // const [workoutCurrentPage, setWorkoutCurrentPage] = useState(1);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  // const [lowSessionMembers, setLowSessionMembers] = useState<LowSessionMember[]>([]);
  // const [lowSessionLoading, setLowSessionLoading] = useState(true);
  // const [monthlySalaryData, setMonthlySalaryData] = useState<MonthlySalaryData>({ total: 0, net: 0, baseSalary: 0, lessonCommission: 0, incentive: 0 });
  // const [salaryLoading, setSalaryLoading] = useState(true);
  // const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenueData>({ currentRevenue: 0, targetRevenue: null, achievementRate: null, percentageChange: null });
  // const [revenueLoading, setRevenueLoading] = useState(true);

  const ITEMS_PER_LOG_CARD = 4; // Still used by cards if they haven't internalized it
  const ITEMS_PER_SCHEDULE_CARD = 4; // Still used by cards if they haven't internalized it
  const ITEMS_PER_COMPOSITION_CARD = 2; // Still used by cards if they haven't internalized it

  // All useEffects for data fetching have been removed as each card handles its own.
  // The fetchPayments useEffect is the only one remaining for now.
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
   // useEffect for fetchLowSessionMembers removed
   // useEffect for fetchDashboardData has been removed as this logic is now handled by useQuery in MonthlySalaryCard and MonthlyRevenueCard.

 return (
    <AppLayout>
      <div className="space-y-6">
        {/* 첫 번째 행 카드들 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 총 회원 수 */}
          <MemberStatsCard />
          {/* 월간 PT 수 */}
          <SessionStatsCard />
           {/* 이번 달 예상 월급 */}
           <MonthlySalaryCard />
          {/* 월간 매출 */}
          <MonthlyRevenueCard />
        </div>

        {/* 두 번째 행 카드들 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
          {/* 오늘의 일정 */}
          <TodaysScheduleCard />
          {/* 최근 PT 횟수 변경 로그 */}
          <RecentPTSessionChangesCard />
           {/* 만료 예정 회원 카드 */}
           <LowSessionMembersCard />
        </div>

        {/* 세 번째 행 카드들 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 최근 체성분 분석 */}
          <RecentBodyCompositionsCard />
          {/* 최근 운동 기록 카드 */}
          <RecentWorkoutsCard />
        </div>
      </div>
    </AppLayout>
  );
}


// Removed formatDate from here as it's now in RecentBodyCompositionsCard or can be moved to a more general util if needed by other components.
// If other cards still need formatDate, it should be imported or passed as a prop.
// For now, assuming each card handles its own date formatting or it's part of dashboardQueries types/logic.
// calculateMonthlyRevenueAndSalary is also removed from direct Dashboard use.
export default Dashboard;
