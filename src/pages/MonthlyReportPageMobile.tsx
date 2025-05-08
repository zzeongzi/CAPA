import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { DateRange } from "react-day-picker";
import { subMonths, startOfMonth, endOfMonth, format, startOfYear, endOfYear, getMonth as getMonthIndex, parseISO, getYear } from 'date-fns';
import { Loader2, ChevronDown, Edit3, Trash2 } from 'lucide-react';
import { calculateMonthlyRevenueAndSalary, MonthlyCalculationResult, SalaryReportRow, RevenueReportRow } from '@/lib/revenueUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import type { Tables } from '@/integrations/supabase/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditSalaryDetailModal } from '@/components/features/EditSalaryDetailModal';

const formatCurrency = (amount: number | null | undefined): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(validAmount);
};

const formatCurrencyShort = (value: number): string => {
  if (Math.abs(value) >= 100000000) {
    return `${(value / 100000000).toFixed(1).replace(/\.0$/, '')}억`;
  }
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(0)}만`;
  }
  return `${value.toFixed(0)}`;
};

const formatRegistrationType = (type: 'new' | 'renewal' | null | undefined): string => {
    if (type === 'new') return '신규';
    if (type === 'renewal') return '재등록';
    return '-';
};

const currencyTooltipFormatter = (value: number) => formatCurrency(value);

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15];

const MonthlyReportPageMobile = () => {
  const { user, userCenter } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return { from: start, to: end };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<MonthlyCalculationResult | null>(null);
  const [yearlySalaryData, setYearlySalaryData] = useState<any[]>([]);

  const [salaryItemsPerPage, setSalaryItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [currentSalaryPage, setCurrentSalaryPage] = useState(1);
  const [revenueItemsPerPage, setRevenueItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [currentRevenuePage, setCurrentRevenuePage] = useState(1);
  
  const [isConfirmEditOpen, setIsConfirmEditOpen] = useState(false);
  const [editingRowForModal, setEditingRowForModal] = useState<SalaryReportRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleRowClick = (row: SalaryReportRow) => {
    setEditingRowForModal(row);
    setIsEditModalOpen(true);
  };

  const handleSaveFromModal = (updatedData: Partial<SalaryReportRow>) => {
    if (!updatedData.membershipId || !reportData) return;
    const updatedSalaryReportData = reportData.salaryReportData.map(row => {
      if (row.membershipId === updatedData.membershipId) {
        const newContractDate = updatedData.contractDate ?? row.contractDate;
        const newSessionPrice = updatedData.sessionPrice ?? row.sessionPrice;
        const newContractualCommissionRate = updatedData.contractualCommissionRate ?? row.contractualCommissionRate;
        const newAppliedCommissionRate = newContractualCommissionRate !== null ? newContractualCommissionRate : row.appliedCommissionRate;
        const newRevenueFromMember = (row.sessionsCompletedThisMonth || 0) * (newSessionPrice || 0) * ((newAppliedCommissionRate || 0) / 100);
        return { ...row, contractDate: newContractDate, sessionPrice: newSessionPrice, contractualCommissionRate: newContractualCommissionRate, appliedCommissionRate: newAppliedCommissionRate, revenueFromMember: newRevenueFromMember };
      }
      return row;
    });
    const newLessonCommission = updatedSalaryReportData.reduce((sum, r) => sum + r.revenueFromMember, 0);
    const newTotalSalaryBeforeDeduction = (reportData.baseSalary || 0) + newLessonCommission + (reportData.incentive || 0);
    const newNetSalary = newTotalSalaryBeforeDeduction * (1 - 0.033);
    setReportData(prev => prev ? ({ ...prev, salaryReportData: updatedSalaryReportData, lessonCommission: newLessonCommission, totalSalaryBeforeDeduction: newTotalSalaryBeforeDeduction, netSalary: newNetSalary }) : null);
    setIsEditModalOpen(false); 
    setEditingRowForModal(null); 
    toast({ title: "성공", description: "월급 내역이 업데이트되었습니다." });
  };

  const fetchDataAndCalculate = async () => {
      if (!user || !userCenter) return;
      setIsLoading(true);
      setReportData(null);
      setYearlySalaryData([]);
      setCurrentSalaryPage(1);
      setCurrentRevenuePage(1);
      try {
        const currentYear = getYear(new Date());
        const yearStartDate = format(startOfYear(new Date(currentYear, 0, 1)), 'yyyy-MM-dd');
        const yearEndDate = format(endOfYear(new Date(currentYear, 11, 31)), 'yyyy-MM-dd');
        const yearEndDateWithTime = format(endOfYear(new Date(currentYear, 11, 31)), "yyyy-MM-dd'T'23:59:59.999'Z'");
        const [ membershipsRes, completedSessionsRes, trainerSettingsRes, commissionRulesRes, sessionPriceRulesRes, membersRes ] = await Promise.all([
          supabase.from('memberships').select('*').eq('trainer_id', user.id).lte('start_date', yearEndDate).or(`end_date.gte.${yearStartDate},end_date.is.null`),
          supabase.from('pt_sessions').select('*').eq('trainer_id', user.id).in('status', ['completed', 'canceled']).gte('end_time', format(startOfYear(new Date(currentYear, 0, 1)), "yyyy-MM-dd'T'00:00:00'Z'")).lte('end_time', yearEndDateWithTime),
          supabase.from('trainer_settings').select('*').eq('trainer_id', user.id).eq('center_id', userCenter).maybeSingle(),
          supabase.from('commission_rules').select('*').eq('center_id', userCenter).order('revenue_threshold'),
          supabase.from('session_price_rules').select('*').eq('center_id', userCenter).order('min_sessions'),
          supabase.from('members').select<string, Tables<'members'>>('*').eq('center_id', userCenter)
        ]);
        if (membershipsRes.error) throw new Error(`멤버십 조회 오류: ${membershipsRes.error.message}`);
        if (completedSessionsRes.error) throw new Error(`완료된 세션 조회 오류: ${completedSessionsRes.error.message}`);
        if (trainerSettingsRes.error) throw new Error(`트레이너 설정 조회 오류: ${trainerSettingsRes.error.message}`);
        if (commissionRulesRes.error) throw new Error(`커미션 규칙 조회 오류: ${commissionRulesRes.error.message}`);
        if (sessionPriceRulesRes.error) throw new Error(`세션 단가 규칙 조회 오류: ${sessionPriceRulesRes.error.message}`);
        if (membersRes.error) throw new Error(`회원 정보 조회 오류: ${membersRes.error.message}`);
        const allMemberships = membershipsRes.data || [];
        const allCompletedSessions = completedSessionsRes.data || [];
        const trainerSettings = trainerSettingsRes.data || null;
        const commissionRules = commissionRulesRes.data || [];
        const sessionPriceRules = sessionPriceRulesRes.data || [];
        const members = membersRes.data || [];
        const monthlyAggregatedData = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const monthStartDate = new Date(currentYear, i, 1);
            const monthEndDate = endOfMonth(monthStartDate);
            const monthlyMemberships = allMemberships.filter(m => { const startDate = parseISO(m.start_date); const endDate = m.end_date ? parseISO(m.end_date) : null; return startDate <= monthEndDate && (!endDate || endDate >= monthStartDate); });
            const monthlyCompletedSessions = allCompletedSessions.filter(s => { const sessionTime = s.end_time ? parseISO(s.end_time) : new Date(0); return sessionTime >= monthStartDate && sessionTime <= monthEndDate; });
            const monthlyResult = calculateMonthlyRevenueAndSalary( currentYear, month, monthlyMemberships, monthlyCompletedSessions, trainerSettings, commissionRules, sessionPriceRules, members );
            const baseSalaryToShow = monthlyCompletedSessions.length > 0 ? monthlyResult.baseSalary : 0;
            return { month: `${month}월`, baseSalary: baseSalaryToShow, lessonCommission: monthlyResult.lessonCommission, incentive: monthlyResult.incentive, totalSalary: monthlyResult.totalSalaryBeforeDeduction, netSalary: monthlyResult.netSalary };
        });
        setYearlySalaryData(monthlyAggregatedData);
        if (dateRange?.from) {
            const selectedMonth = getMonthIndex(dateRange.from) + 1;
            const selectedYear = getYear(dateRange.from);
            const monthStartDate = startOfMonth(dateRange.from);
            const monthEndDate = endOfMonth(dateRange.from);
            const monthlyMemberships = allMemberships.filter(m => { const startDate = parseISO(m.start_date); const endDate = m.end_date ? parseISO(m.end_date) : null; return startDate <= monthEndDate && (!endDate || endDate >= monthStartDate); });
            const monthlyCompletedSessions = allCompletedSessions.filter(s => { const sessionTime = s.end_time ? parseISO(s.end_time) : new Date(0); return sessionTime >= monthStartDate && sessionTime <= monthEndDate; });
            const detailedMonthlyResult = calculateMonthlyRevenueAndSalary( selectedYear, selectedMonth, monthlyMemberships, monthlyCompletedSessions, trainerSettings, commissionRules, sessionPriceRules, members );
            setReportData(detailedMonthlyResult);
        }
      } catch (error: any) { console.error("Error fetching or calculating report data:", error); toast({ title: "오류", description: `보고서 데이터 처리 중 오류 발생: ${error.message}`, variant: "destructive" });
      } finally { setIsLoading(false); }
    };

  useEffect(() => { fetchDataAndCalculate(); }, [user, userCenter, dateRange]);
  
  const paginatedSalaryData = useMemo(() => { if (!reportData) return []; const startIndex = (currentSalaryPage - 1) * salaryItemsPerPage; const endIndex = startIndex + salaryItemsPerPage; return reportData.salaryReportData.slice(startIndex, endIndex); }, [reportData, currentSalaryPage, salaryItemsPerPage]);
  const totalSalaryPages = reportData ? Math.ceil(reportData.salaryReportData.length / salaryItemsPerPage) : 0;
  const paginatedRevenueData = useMemo(() => { if (!reportData) return []; const startIndex = (currentRevenuePage - 1) * revenueItemsPerPage; const endIndex = startIndex + revenueItemsPerPage; return reportData.revenueReportData.slice(startIndex, endIndex); }, [reportData, currentRevenuePage, revenueItemsPerPage]);
  const totalRevenuePages = reportData ? Math.ceil(reportData.revenueReportData.length / revenueItemsPerPage) : 0;
  const salaryFooterData = useMemo(() => { if (!reportData) return { sessionsCompletedThisMonth: 0, sessionsCompletedLastMonth: 0, remainingSessions: 0, totalContractedSessions: 0, revenueFromMember: 0 }; return reportData.salaryReportData.reduce((acc, row) => { acc.sessionsCompletedThisMonth += row.sessionsCompletedThisMonth; acc.sessionsCompletedLastMonth += row.sessionsCompletedLastMonth; acc.remainingSessions += row.remainingSessions; acc.totalContractedSessions += row.totalContractedSessions; acc.revenueFromMember += row.revenueFromMember; return acc; }, { sessionsCompletedThisMonth: 0, sessionsCompletedLastMonth: 0, remainingSessions: 0, totalContractedSessions: 0, revenueFromMember: 0 }); }, [reportData]);
  const revenueFooterData = reportData?.revenueReportData.reduce((acc, row) => { acc.count += 1; acc.totalContractedSessions += row.totalContractedSessions; acc.totalAmount += row.totalAmount; return acc; }, { count: 0, totalContractedSessions: 0, totalAmount: 0 }) || { count: 0, totalContractedSessions: 0, totalAmount: 0 };
  const revenueChartData = reportData ? [ { name: '신규', value: reportData.revenueReportData.filter(r => r.registrationType === 'new').reduce((sum, r) => sum + r.totalAmount, 0) }, { name: '재등록', value: reportData.revenueReportData.filter(r => r.registrationType === 'renewal').reduce((sum, r) => sum + r.totalAmount, 0) } ] : [];

  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} disabled={currentPage <= 1} className="h-8 px-3 text-xs">이전</Button>
          </PaginationItem>
          <PaginationItem><span className="px-4 py-1.5 text-sm font-medium"> {currentPage} / {totalPages} </span></PaginationItem>
          <PaginationItem>
            <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} disabled={currentPage >= totalPages} className="h-8 px-3 text-xs">다음</Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const renderSalaryItemMobile = (row: SalaryReportRow) => (
    <AccordionItem value={row.membershipId} key={row.membershipId} className="border bg-card rounded-md mb-2">
      <AccordionTrigger className="p-3 text-sm hover:no-underline">
        <div className="flex justify-between items-center w-full">
          <div className="flex-grow text-left">
            <span className="font-semibold">{row.memberName || '-'}</span>
            <span className="text-xs text-muted-foreground ml-2">({row.contractDate ? format(parseISO(row.contractDate), 'yy/MM/dd') : '-'})</span>
            {row.remainingSessions === 0 && <Badge variant="outline" className="ml-2 text-green-600 border-green-600 text-[0.6rem] px-1 py-0 align-middle">완료</Badge>}
          </div>
          <strong className="text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap mr-2">{formatCurrency(row.revenueFromMember)}</strong>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-3 pt-0 text-xs space-y-1 border-t">
        <div className="flex justify-between"><span>수업료(%):</span> <span className="font-medium">{`${row.appliedCommissionRate?.toFixed(1) ?? '-'}%`}</span></div>
        <div className="flex justify-between"><span>세션단가:</span> <span className="font-medium">{formatCurrency(row.sessionPrice)}</span></div>
        <div className="flex justify-between"><span>진행(이번달):</span> <span className="font-medium">{row.sessionsCompletedThisMonth}회</span></div>
        <div className="flex justify-between"><span>진행(지난달):</span> <span className="font-medium">{row.sessionsCompletedLastMonth}회</span></div>
        <div className="flex justify-between"><span>남은세션:</span> <span className="font-medium">{row.remainingSessions}회</span></div>
        <div className="flex justify-between"><span>계약세션:</span> <span className="font-medium">{row.totalContractedSessions}회</span></div>
        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs w-full" onClick={(e) => { e.stopPropagation(); handleRowClick(row); }}>
            <Edit3 className="mr-1 h-3 w-3"/> 상세 수정
        </Button>
      </AccordionContent>
    </AccordionItem>
  );

  const renderRevenueItemMobile = (row: RevenueReportRow) => (
    <AccordionItem value={row.membershipId} key={row.membershipId} className="border bg-card rounded-md mb-2">
      <AccordionTrigger className="p-3 text-sm hover:no-underline">
        <div className="flex justify-between items-center w-full">
          <div className="flex-grow text-left">
            <span className="font-semibold">{row.memberName || '-'}</span>
            <span className="text-xs text-muted-foreground ml-2">({row.contractDate ? format(parseISO(row.contractDate), 'yy/MM/dd') : '-'} / {formatRegistrationType(row.registrationType)})</span>
          </div>
          <strong className="text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap mr-2">{formatCurrency(row.totalAmount)}</strong>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-3 pt-0 text-xs space-y-1 border-t">
        <div className="flex justify-between"><span>계약세션:</span> <span className="font-medium">{row.totalContractedSessions}회</span></div>
        <div className="flex justify-between"><span>세션단가:</span> <span className="font-medium">{formatCurrency(row.sessionPrice)}</span></div>
        <div className="flex justify-between"><span>결제방법:</span> <span className="font-medium">{row.paymentMethod || '-'}</span></div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <AppLayout>
      <div className="p-2 bg-muted/20 min-h-screen"> {/* AppLayout 내부 컨텐츠에 배경색 및 패딩 적용 */}
        <div className="flex justify-between items-center mb-3 p-3 bg-background border-b sticky top-0 z-10"> {/* 페이지 헤더: 제목과 날짜 선택기 */}
          <h1 className="text-xl font-bold whitespace-nowrap">월별 보고서</h1>
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="h-9 text-xs" />
        </div>

        {isLoading ? (
           <div className="flex justify-center items-center h-60"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
        ) : reportData ? (
          <Tabs defaultValue="salary" className="pt-0">
            <TabsList className="grid w-full grid-cols-2 sticky top-[69px] z-[9] bg-background shadow-sm"> {/* sticky top 위치 조정 */}
              <TabsTrigger value="salary" className="text-sm">월급</TabsTrigger> 
              <TabsTrigger value="revenue" className="text-sm">매출</TabsTrigger>
            </TabsList>
            <TabsContent value="salary" className="py-2 space-y-3"> {/* px-2 제거 */}
              <Card>
                <CardHeader className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">월급 상세 내역</CardTitle>
                      <CardDescription className="text-xs">선택된 기간의 월급 계산 상세 내역입니다.</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                          {salaryItemsPerPage}개 <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ITEMS_PER_PAGE_OPTIONS.map(size => (
                          <DropdownMenuItem key={size} onClick={() => { setSalaryItemsPerPage(size); setCurrentSalaryPage(1); }} className="text-xs">
                            {size}개 보기
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {paginatedSalaryData.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full px-3 py-2"> {/* px-3 다시 추가, space-y-0은 없는 상태 유지 */}
                      {paginatedSalaryData.map(renderSalaryItemMobile)}
                    </Accordion>
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">해당 기간의 데이터가 없습니다.</div>
                  )}
                   {totalSalaryPages > 0 && (
                    <div className="p-3 border-t">
                      {renderPagination(currentSalaryPage, totalSalaryPages, setCurrentSalaryPage)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="mt-3">
                <CardHeader className="p-3">
                  <CardTitle className="text-base">월급 상세 합계</CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">총 진행(이번달):</span> <span className="font-medium text-right">{salaryFooterData.sessionsCompletedThisMonth}회</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">총 진행(지난달):</span> <span className="font-medium text-right">{salaryFooterData.sessionsCompletedLastMonth}회</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">총 남은세션:</span> <span className="font-medium text-right">{salaryFooterData.remainingSessions}회</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">총 계약세션:</span> <span className="font-medium text-right">{salaryFooterData.totalContractedSessions}회</span></div>
                  <div className="flex justify-between text-sm mt-1.5 pt-1.5 border-t"><strong>총 수업료 합계:</strong> <strong className="font-bold text-right text-blue-600 dark:text-blue-400">{formatCurrency(salaryFooterData.revenueFromMember)}</strong></div>
                </CardContent>
              </Card>
               <Card className="mt-3">
                  <CardHeader className="p-3">
                    <CardTitle className="text-base">월급 요약</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">기본급:</span> <span className="font-medium text-right">{formatCurrency(reportData.baseSalary)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">적용된 커미션 (%):</span> <span className="font-medium text-right">{reportData.commissionRateApplied.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">수업료 합계:</span> <span className="font-medium text-right">{formatCurrency(salaryFooterData.revenueFromMember)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">인센티브:</span> <span className="font-medium text-right">{formatCurrency(reportData.incentive)}</span></div>
                      <div className="flex justify-between text-sm mt-1.5 pt-1.5 border-t"><strong>공제 전 총 급여:</strong> <strong className="font-bold text-right text-blue-600 dark:text-blue-400">{formatCurrency(reportData.totalSalaryBeforeDeduction)}</strong></div>
                      <div className="flex justify-between text-sm"><strong>공제 후 실수령액 (예상):</strong> <strong className="font-bold text-right text-blue-600 dark:text-blue-400">{formatCurrency(reportData.netSalary)}</strong></div>
                  </CardContent>
              </Card>
              <Card className="mt-3">
                <CardHeader className="p-3"> <CardTitle className="text-base">연간 월급 추이</CardTitle> <CardDescription className="text-xs">선택된 연도의 월별 급여 구성.</CardDescription> </CardHeader>
                <CardContent className="p-2">
                   <ResponsiveContainer width="100%" height={250}>
                     <BarChart data={yearlySalaryData} margin={{ top: 15, right: 5, left: -25, bottom: 0 }}>
                       <XAxis dataKey="month" fontSize={10} />
                       <YAxis tickFormatter={formatCurrencyShort} fontSize={10} width={70}/>
                       <Tooltip formatter={currencyTooltipFormatter} labelStyle={{ fontSize: '12px' }} itemStyle={{ fontSize: '12px' }} />
                       <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                       <Bar dataKey="baseSalary" stackId="a" fill="#8884d8" name="기본급" />
                       <Bar dataKey="lessonCommission" stackId="a" fill="#82ca9d" name="수업료" />
                       <Bar dataKey="incentive" stackId="a" fill="#ffc658" name="인센티브" />
                       <Bar dataKey="netSalary" fill="#fa8072" name="실수령액" />
                     </BarChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="revenue" className="py-2 space-y-3"> {/* px-2 제거 */}
              <Card>
                <CardHeader className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">매출 상세 내역</CardTitle>
                      <CardDescription className="text-xs">선택된 기간의 매출 상세 내역입니다.</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                          {revenueItemsPerPage}개 <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ITEMS_PER_PAGE_OPTIONS.map(size => (
                          <DropdownMenuItem key={size} onClick={() => { setRevenueItemsPerPage(size); setCurrentRevenuePage(1); }} className="text-xs">
                            {size}개 보기
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {paginatedRevenueData.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full px-3 py-2"> {/* px-3 다시 추가, space-y-0은 없는 상태 유지 */}
                      {paginatedRevenueData.map(renderRevenueItemMobile)}
                    </Accordion>
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">해당 기간의 데이터가 없습니다.</div>
                  )}
                  {totalRevenuePages > 0 && (
                    <div className="p-3 border-t">
                      {renderPagination(currentRevenuePage, totalRevenuePages, setCurrentRevenuePage)}
                    </div>
                  )}
                </CardContent>
                {/* 매출 상세 내역 합계 카드 */}
                <Card className="mt-3 bg-muted/30"> {/* 배경색 추가하여 구분 */}
                  <CardHeader className="p-3">
                    <CardTitle className="text-base">매출 상세 합계</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">총 계약 건수:</span> <span className="font-medium text-right">{revenueFooterData.count}건</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">총 계약 세션:</span> <span className="font-medium text-right">{revenueFooterData.totalContractedSessions}회</span></div>
                    <div className="flex justify-between text-sm mt-1.5 pt-1.5 border-t"><strong>총 계약 매출 합계:</strong> <strong className="font-bold text-right text-blue-600 dark:text-blue-400">{formatCurrency(revenueFooterData.totalAmount)}</strong></div>
                  </CardContent>
                </Card>
              </Card>
               <Card className="mt-3">
                  <CardHeader className="p-3">
                    <CardTitle className="text-base">매출 요약</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">총 매출 (수업료 기준):</span> <span className="font-medium text-right">{formatCurrency(reportData.totalRevenue)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">총 계약 매출:</span> <span className="font-medium text-right">{formatCurrency(revenueFooterData.totalAmount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">총 완료 세션:</span> <span className="font-medium text-right">{reportData.totalSessionsCompleted}회</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">총 계약 건수:</span> <span className="font-medium text-right">{reportData.revenueReportData.length}건</span></div>
                  </CardContent>
              </Card>
              <Card className="mt-3">
                <CardHeader className="p-3"> <CardTitle className="text-base">매출 구성 (등록 유형별)</CardTitle> <CardDescription className="text-xs">신규와 재등록 매출 비중.</CardDescription> </CardHeader>
                <CardContent className="p-2">
                   <ResponsiveContainer width="100%" height={200}>
                     <BarChart data={revenueChartData} margin={{ top: 15, right: 5, left: -25, bottom: 0 }}>
                       <XAxis dataKey="name" fontSize={10} />
                       <YAxis tickFormatter={formatCurrencyShort} fontSize={10} width={70}/>
                       <Tooltip formatter={currencyTooltipFormatter} labelStyle={{ fontSize: '12px' }} itemStyle={{ fontSize: '12px' }} />
                       <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                       <Bar dataKey="value" fill="#82ca9d" name="매출액" />
                     </BarChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
           <div className="flex justify-center items-center h-60"> <p className="text-muted-foreground text-sm">데이터를 조회해주세요.</p> </div>
        )}

        <AlertDialog open={isConfirmEditOpen} onOpenChange={setIsConfirmEditOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>수정 확인</AlertDialogTitle>
              <AlertDialogDescription>
                '{editingRowForModal?.memberName}' 회원의 월급 상세 내역을 수정하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditingRowForModal(null)}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if(editingRowForModal) setIsEditModalOpen(true); setIsConfirmEditOpen(false);}}>확인</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <EditSalaryDetailModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRowForModal(null);
          }}
          rowData={editingRowForModal}
          onSave={handleSaveFromModal}
        />
      </div>
    </AppLayout>
  );
};

export default MonthlyReportPageMobile;