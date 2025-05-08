import React, { useState, useEffect, useMemo } from 'react'; // useRef 제거
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { DateRange } from "react-day-picker";
import { subMonths, startOfMonth, endOfMonth, format, startOfYear, endOfYear, getMonth as getMonthIndex, parseISO, getYear } from 'date-fns';
import { Loader2, ChevronDown } from 'lucide-react'; // Edit3, Save, X IconX 제거
import { calculateMonthlyRevenueAndSalary, MonthlyCalculationResult, SalaryReportRow, RevenueReportRow } from '@/lib/revenueUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts'; // CartesianGrid 제거
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
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

const formatRegistrationType = (type: 'new' | 'renewal' | null | undefined): string => {
    if (type === 'new') return '신규';
    if (type === 'renewal') return '재등록';
    return '-';
};

const currencyTooltipFormatter = (value: number) => formatCurrency(value);

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 30];

const MonthlyReportPage = () => {
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
    setIsConfirmEditOpen(true);
  };

  const handleConfirmEdit = () => {
    if (editingRowForModal) {
      setIsEditModalOpen(true);
    }
    setIsConfirmEditOpen(false);
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

        return {
          ...row,
          contractDate: newContractDate,
          sessionPrice: newSessionPrice,
          contractualCommissionRate: newContractualCommissionRate,
          appliedCommissionRate: newAppliedCommissionRate,
          revenueFromMember: newRevenueFromMember,
        };
      }
      return row;
    });

    const newLessonCommission = updatedSalaryReportData.reduce((sum, r) => sum + r.revenueFromMember, 0);
    const newTotalSalaryBeforeDeduction = (reportData.baseSalary || 0) + newLessonCommission + (reportData.incentive || 0);
    const newNetSalary = newTotalSalaryBeforeDeduction * (1 - 0.033);

    setReportData(prev => prev ? ({
      ...prev,
      salaryReportData: updatedSalaryReportData,
      lessonCommission: newLessonCommission,
      totalSalaryBeforeDeduction: newTotalSalaryBeforeDeduction,
      netSalary: newNetSalary,
    }) : null);

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

            const monthlyMemberships = allMemberships.filter(m => {
                const startDate = parseISO(m.start_date);
                const endDate = m.end_date ? parseISO(m.end_date) : null;
                return startDate <= monthEndDate && (!endDate || endDate >= monthStartDate);
            });
            const monthlyCompletedSessions = allCompletedSessions.filter(s => {
                const sessionTime = s.end_time ? parseISO(s.end_time) : new Date(0);
                return sessionTime >= monthStartDate && sessionTime <= monthEndDate;
            });

            const monthlyResult = calculateMonthlyRevenueAndSalary( currentYear, month, monthlyMemberships, monthlyCompletedSessions, trainerSettings, commissionRules, sessionPriceRules, members );
            const baseSalaryToShow = monthlyCompletedSessions.length > 0 ? monthlyResult.baseSalary : 0;

            return {
                month: `${month}월`,
                baseSalary: baseSalaryToShow,
                lessonCommission: monthlyResult.lessonCommission,
                incentive: monthlyResult.incentive,
                totalSalary: monthlyResult.totalSalaryBeforeDeduction,
                netSalary: monthlyResult.netSalary,
            };
        });
        setYearlySalaryData(monthlyAggregatedData);

        if (dateRange?.from) {
            const selectedMonth = getMonthIndex(dateRange.from) + 1;
            const selectedYear = getYear(dateRange.from);
            const monthStartDate = startOfMonth(dateRange.from);
            const monthEndDate = endOfMonth(dateRange.from);

             const monthlyMemberships = allMemberships.filter(m => {
                const startDate = parseISO(m.start_date);
                const endDate = m.end_date ? parseISO(m.end_date) : null;
                return startDate <= monthEndDate && (!endDate || endDate >= monthStartDate);
            });
            const monthlyCompletedSessions = allCompletedSessions.filter(s => {
                const sessionTime = s.end_time ? parseISO(s.end_time) : new Date(0);
                return sessionTime >= monthStartDate && sessionTime <= monthEndDate;
            });

            const detailedMonthlyResult = calculateMonthlyRevenueAndSalary( selectedYear, selectedMonth, monthlyMemberships, monthlyCompletedSessions, trainerSettings, commissionRules, sessionPriceRules, members );
            console.log('[MonthlyReportPage Debug] detailedMonthlyResult:', detailedMonthlyResult);
            setReportData(detailedMonthlyResult);
        }

      } catch (error: any) {
        console.error("Error fetching or calculating report data:", error);
        toast({ title: "오류", description: `보고서 데이터 처리 중 오류 발생: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

  const handleSearch = () => { fetchDataAndCalculate(); };
  useEffect(() => { 
    fetchDataAndCalculate();
  }, [user, userCenter, dateRange]);
  
  const paginatedSalaryData = useMemo(() => {
    if (!reportData) return [];
    const startIndex = (currentSalaryPage - 1) * salaryItemsPerPage;
    const endIndex = startIndex + salaryItemsPerPage;
    return reportData.salaryReportData.slice(startIndex, endIndex);
  }, [reportData, currentSalaryPage, salaryItemsPerPage]);

  const totalSalaryPages = reportData ? Math.ceil(reportData.salaryReportData.length / salaryItemsPerPage) : 0;

  const paginatedRevenueData = useMemo(() => {
    if (!reportData) return [];
    const startIndex = (currentRevenuePage - 1) * revenueItemsPerPage;
    const endIndex = startIndex + revenueItemsPerPage;
    return reportData.revenueReportData.slice(startIndex, endIndex);
  }, [reportData, currentRevenuePage, revenueItemsPerPage]);
  const totalRevenuePages = reportData ? Math.ceil(reportData.revenueReportData.length / revenueItemsPerPage) : 0;

  const salaryFooterData = useMemo(() => {
    if (!reportData) return { sessionsCompletedThisMonth: 0, sessionsCompletedLastMonth: 0, remainingSessions: 0, totalContractedSessions: 0, revenueFromMember: 0 };
    return reportData.salaryReportData.reduce((acc, row) => {
        acc.sessionsCompletedThisMonth += row.sessionsCompletedThisMonth;
        acc.sessionsCompletedLastMonth += row.sessionsCompletedLastMonth;
        acc.remainingSessions += row.remainingSessions;
        acc.totalContractedSessions += row.totalContractedSessions;
        acc.revenueFromMember += row.revenueFromMember;
        return acc;
    }, { sessionsCompletedThisMonth: 0, sessionsCompletedLastMonth: 0, remainingSessions: 0, totalContractedSessions: 0, revenueFromMember: 0 });
  }, [reportData]);


  const revenueFooterData = reportData?.revenueReportData.reduce((acc, row) => {
      acc.count += 1;
      acc.totalContractedSessions += row.totalContractedSessions;
      acc.totalAmount += row.totalAmount;
      return acc;
  }, { count: 0, totalContractedSessions: 0, totalAmount: 0 }) || { count: 0, totalContractedSessions: 0, totalAmount: 0 };

  const revenueChartData = reportData ? [
      { name: '신규', value: reportData.revenueReportData.filter(r => r.registrationType === 'new').reduce((sum, r) => sum + r.totalAmount, 0) },
      { name: '재등록', value: reportData.revenueReportData.filter(r => r.registrationType === 'renewal').reduce((sum, r) => sum + r.totalAmount, 0) },
  ] : [];

  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} aria-disabled={currentPage <= 1} tabIndex={currentPage <= 1 ? -1 : undefined} className={currentPage <= 1 ? "pointer-events-none opacity-50" : undefined} />
          </PaginationItem>
          <PaginationItem>
             <span className="px-4 py-2 text-sm"> {currentPage} / {totalPages} </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} aria-disabled={currentPage >= totalPages} tabIndex={currentPage >= totalPages ? -1 : undefined} className={currentPage >= totalPages ? "pointer-events-none opacity-50" : undefined} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold">월별 보고서</h1>
          <div className="flex items-center gap-2">
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              조회
            </Button>
          </div>
        </div>

        {isLoading ? (
           <div className="flex justify-center items-center h-60"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
        ) : reportData ? (
          <Tabs defaultValue="salary">
            <TabsList className="grid w-full grid-cols-2"> <TabsTrigger value="salary">월급</TabsTrigger> <TabsTrigger value="revenue">매출</TabsTrigger> </TabsList>
            <TabsContent value="salary">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>월급 상세 내역</CardTitle>
                      <CardDescription>선택된 기간의 월급 계산 상세 내역입니다. (행 클릭 시 수정)</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {salaryItemsPerPage}개 보기 <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ITEMS_PER_PAGE_OPTIONS.map(size => (
                          <DropdownMenuItem key={size} onClick={() => { setSalaryItemsPerPage(size); setCurrentSalaryPage(1); }}>
                            {size}개 보기
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">계약일</TableHead>
                        <TableHead className="whitespace-nowrap">회원명</TableHead>
                        <TableHead className="whitespace-nowrap text-right">수업료(%)</TableHead>
                        <TableHead className="whitespace-nowrap text-right">세션단가</TableHead>
                        <TableHead className="whitespace-nowrap text-right">진행(이번달)</TableHead>
                        <TableHead className="whitespace-nowrap text-right">진행(지난달)</TableHead>
                        <TableHead className="whitespace-nowrap text-right">남은세션</TableHead>
                        <TableHead className="whitespace-nowrap text-right">계약세션</TableHead>
                        <TableHead className="whitespace-nowrap text-right">수업료</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSalaryData.length > 0 ? (
                        paginatedSalaryData.map((row) => (
                          <TableRow 
                            key={row.membershipId} 
                            className={cn(
                              row.remainingSessions === 0 ? 'bg-green-100 dark:bg-green-900/30' : '',
                              'cursor-pointer hover:bg-muted/50'
                            )}
                            onClick={() => handleRowClick(row)}
                          >
                            <TableCell className="whitespace-nowrap">{row.contractDate ? format(parseISO(row.contractDate), 'MM/dd') : '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.memberName || '-'}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{`${row.appliedCommissionRate?.toFixed(1) ?? '-'}%`}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.sessionPrice)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{row.sessionsCompletedThisMonth}회</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{row.sessionsCompletedLastMonth}회</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {row.remainingSessions === 0 ? <Badge variant="outline" className="text-green-600 border-green-600">완료</Badge> : `${row.remainingSessions}회`}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">{row.totalContractedSessions}회</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.revenueFromMember)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow> <TableCell colSpan={9} className="h-24 text-center"> 해당 기간의 데이터가 없습니다. </TableCell> </TableRow>
                      )}
                    </TableBody>
                    <TableFooter>
                       <TableRow>
                         <TableCell colSpan={4} className="font-semibold text-right">합계</TableCell>
                         <TableCell className="text-right">{salaryFooterData.sessionsCompletedThisMonth}회</TableCell>
                         <TableCell className="text-right">{salaryFooterData.sessionsCompletedLastMonth}회</TableCell>
                         <TableCell className="text-right">{salaryFooterData.remainingSessions}회</TableCell>
                         <TableCell className="text-right">{salaryFooterData.totalContractedSessions}회</TableCell>
                         <TableCell className="text-right">{formatCurrency(salaryFooterData.revenueFromMember)}</TableCell>
                       </TableRow>
                    </TableFooter>
                  </Table>
                  {renderPagination(currentSalaryPage, totalSalaryPages, setCurrentSalaryPage)}
                   <div className="mt-6 space-y-2 border-t pt-4">
                     <h3 className="font-semibold">요약</h3>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                       <span>기본급:</span> <span className="text-right font-medium">{formatCurrency(reportData.baseSalary)}</span>
                       <span>적용된 커미션 (%):</span> <span className="text-right font-medium">{reportData.commissionRateApplied.toFixed(1)}%</span>
                       <span>수업료:</span> <span className="text-right font-medium">{formatCurrency(salaryFooterData.revenueFromMember)}</span>
                       <span>인센티브:</span> <span className="text-right font-medium">{formatCurrency(reportData.incentive)}</span>
                       <span className="font-bold">공제 전 총 급여:</span> <span className="text-right font-medium">{formatCurrency(reportData.totalSalaryBeforeDeduction)}</span>
                       <span className="font-bold">공제 후 실수령액 (예상):</span> <span className="text-right font-medium">{formatCurrency(reportData.netSalary)}</span>
                     </div>
                   </div>
                </CardContent>
              </Card>
              <Card className="mt-6">
                <CardHeader> <CardTitle>연간 월급 추이</CardTitle> <CardDescription>선택된 연도의 월별 급여 구성 요소를 보여줍니다.</CardDescription> </CardHeader>
                <CardContent>
                   <ResponsiveContainer width="100%" height={400}>
                     <BarChart data={yearlySalaryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                       {/* <CartesianGrid strokeDasharray="3 3" /> */}
                       <XAxis dataKey="month" />
                       <YAxis tickFormatter={formatCurrency} width={80}/>
                       <Tooltip formatter={currencyTooltipFormatter} />
                       <Legend />
                       <Bar dataKey="baseSalary" stackId="a" fill="#8884d8" name="기본급" />
                       <Bar dataKey="lessonCommission" stackId="a" fill="#82ca9d" name="수업료" />
                       <Bar dataKey="incentive" stackId="a" fill="#ffc658" name="인센티브" />
                       <Bar dataKey="netSalary" fill="#fa8072" name="실수령액" />
                     </BarChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>매출 상세 내역</CardTitle>
                      <CardDescription>선택된 기간의 매출 상세 내역입니다.</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {revenueItemsPerPage}개 보기 <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ITEMS_PER_PAGE_OPTIONS.map(size => (
                          <DropdownMenuItem key={size} onClick={() => { setRevenueItemsPerPage(size); setCurrentRevenuePage(1); }}>
                            {size}개 보기
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="whitespace-nowrap">계약일</TableHead>
                         <TableHead className="whitespace-nowrap">등록</TableHead>
                         <TableHead className="whitespace-nowrap">회원명</TableHead>
                         <TableHead className="whitespace-nowrap">계약세션</TableHead>
                         <TableHead className="whitespace-nowrap">세션단가</TableHead>
                         <TableHead className="whitespace-nowrap">결제방법</TableHead>
                         <TableHead className="whitespace-nowrap text-right">총 금액</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {paginatedRevenueData.length > 0 ? (
                         paginatedRevenueData.map((row) => (
                           <TableRow key={row.membershipId}>
                             <TableCell>{row.contractDate ? format(parseISO(row.contractDate), 'MM/dd') : '-'}</TableCell>
                             <TableCell>{formatRegistrationType(row.registrationType)}</TableCell>
                             <TableCell>{row.memberName || '-'}</TableCell>
                             <TableCell className="text-right whitespace-nowrap">{row.totalContractedSessions}회</TableCell>
                             <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.sessionPrice)}</TableCell>
                             <TableCell>{row.paymentMethod || '-'}</TableCell>
                             <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.totalAmount)}</TableCell>
                           </TableRow>
                         ))
                       ) : (
                         <TableRow> <TableCell colSpan={7} className="h-24 text-center"> 해당 기간의 데이터가 없습니다. </TableCell> </TableRow>
                       )}
                     </TableBody>
                     <TableFooter>
                       <TableRow>
                         <TableCell colSpan={2} className="font-semibold text-right">합계</TableCell>
                         <TableCell>{revenueFooterData.count}명</TableCell>
                         <TableCell className="text-right">{revenueFooterData.totalContractedSessions}회</TableCell>
                         <TableCell colSpan={2}></TableCell>
                         <TableCell className="text-right">{formatCurrency(revenueFooterData.totalAmount)}</TableCell>
                       </TableRow>
                     </TableFooter>
                   </Table>
                   {renderPagination(currentRevenuePage, totalRevenuePages, setCurrentRevenuePage)}
                   <div className="mt-6 space-y-2 border-t pt-4">
                     <h3 className="font-semibold">요약</h3>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                       <span>총 매출 (수업료 기준):</span> <span className="text-right font-medium">{formatCurrency(reportData.totalRevenue)}</span>
                       <span>총 계약 매출:</span> <span className="text-right font-medium">{formatCurrency(revenueFooterData.totalAmount)}</span>
                       <span>총 완료 세션:</span> <span className="text-right font-medium">{reportData.totalSessionsCompleted}회</span>
                       <span>총 계약 건수:</span> <span className="text-right font-medium">{reportData.revenueReportData.length}건</span>
                     </div>
                   </div>
                </CardContent>
              </Card>
               <Card className="mt-6">
                <CardHeader> <CardTitle>매출 구성 (등록 유형별)</CardTitle> <CardDescription>신규 등록과 재등록 매출 비중을 보여줍니다.</CardDescription> </CardHeader>
                <CardContent>
                   <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={revenueChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                       {/* <CartesianGrid strokeDasharray="3 3" /> */}
                       <XAxis dataKey="name" />
                       <YAxis tickFormatter={formatCurrency} width={80}/>
                       <Tooltip formatter={currencyTooltipFormatter} />
                       <Legend />
                       <Bar dataKey="value" fill="#82ca9d" name="매출액" />
                     </BarChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
           <div className="flex justify-center items-center h-60"> <p className="text-muted-foreground">데이터를 조회해주세요.</p> </div>
        )}
      </div>

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
            <AlertDialogAction onClick={handleConfirmEdit}>확인</AlertDialogAction>
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
    </AppLayout>
  );
};

export default MonthlyReportPage;