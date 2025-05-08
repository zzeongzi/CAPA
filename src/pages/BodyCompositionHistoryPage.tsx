import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
// types.ts에서 Database, Tables 타입 가져오기
import type { Database, Tables } from '@/integrations/supabase/types';
import type { Range } from '@/components/features/BodyCompositionBar'; // Range 타입 경로 수정
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, X, ChevronDown, ChevronUp } from 'lucide-react'; // Chevron 아이콘 추가
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditBodyCompositionModal } from '@/components/features/EditBodyCompositionModal';
import { BodyCompositionBar } from '@/components/features/BodyCompositionBar'; // BodyCompositionBar 임포트

// types.ts에서 가져온 타입 사용
type BodyCompositionLog = Tables<'body_composition_logs'> & {
  members: Tables<'members'> | null;
};
type Member = Tables<'members'>;

// BodyCompositionPage에서 표준 범위 계산 로직 가져오기
// 나이 계산 함수
const calculateAge = (birthDateString: string | null | undefined): number | null => {
  if (!birthDateString) return null;
  try {
    const birthDate = parseISO(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (error) {
    console.error("Error parsing birth date:", error);
    return null;
  }
};

// 표준 체중 계산 함수
const calculateStandardWeight = (heightCm: number | null): number | null => {
  if (heightCm === null || heightCm <= 0) return null;
  const standardWeight = (heightCm - 100) * 0.9;
  return standardWeight > 0 ? standardWeight : null;
};

// SMM 기준 가져오기 함수
const getSmmCriteria = (gender: string | null, age: number | null): {
  displayRanges: Range[];
  standardRange: { min: number; max: number };
  displayMin: number;
  displayMax: number;
  standardRangeLabel: string;
} => {
  let ranges: Range[] = [];
  let standard: { min: number; max: number } = { min: 0, max: 0 };
  let displayMinVal = 10; // 기본 최소값
  let displayMaxVal = 65; // 기본 최대값
  let standardLabel = '-';

  if (gender === 'male' && age !== null) {
    if (age >= 20 && age <= 39) {
      standard = { min: 33.3, max: 39.5 };
      ranges = [
        { label: '낮음', max: 33.3, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 33.3, max: 39.5, colorClass: 'bg-green-200' },
        { label: '높음', min: 39.5, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 25; displayMaxVal = 60; standardLabel = '33.3 ~ 39.5 kg';
    } else if (age >= 40 && age <= 59) {
      standard = { min: 30.0, max: 36.7 };
      ranges = [
        { label: '낮음', max: 30.0, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 30.0, max: 36.7, colorClass: 'bg-green-200' },
        { label: '높음', min: 36.7, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 20; displayMaxVal = 60; standardLabel = '30.0 ~ 36.7 kg';
    } else if (age >= 60 && age <= 79) {
      standard = { min: 25.7, max: 31.7 };
      ranges = [
        { label: '낮음', max: 25.7, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 25.7, max: 31.7, colorClass: 'bg-green-200' },
        { label: '높음', min: 31.7, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 15; displayMaxVal = 60; standardLabel = '25.7 ~ 31.7 kg';
    }
  } else if (gender === 'female' && age !== null) {
    if (age >= 20 && age <= 39) {
      standard = { min: 22.1, max: 26.5 };
      ranges = [
        { label: '낮음', max: 22.1, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 22.1, max: 26.5, colorClass: 'bg-green-200' },
        { label: '높음', min: 26.5, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 15; displayMaxVal = 60; standardLabel = '22.1 ~ 26.5 kg';
    } else if (age >= 40 && age <= 59) {
      standard = { min: 21.1, max: 24.9 };
      ranges = [
        { label: '낮음', max: 21.1, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 21.1, max: 24.9, colorClass: 'bg-green-200' },
        { label: '높음', min: 24.9, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 10; displayMaxVal = 60; standardLabel = '21.1 ~ 24.9 kg';
    } else if (age >= 60 && age <= 79) {
      standard = { min: 18.2, max: 21.8 };
      ranges = [
        { label: '낮음', max: 18.2, colorClass: 'bg-yellow-200' },
        { label: '정상', min: 18.2, max: 21.8, colorClass: 'bg-green-200' },
        { label: '높음', min: 21.8, max: 55, colorClass: 'bg-blue-200' },
        { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' },
      ];
      displayMinVal = 10; displayMaxVal = 60; standardLabel = '18.2 ~ 21.8 kg';
    }
  }

  // 기본값 또는 계산된 값 반환
  return {
    displayRanges: ranges,
    standardRange: standard,
    displayMin: displayMinVal,
    displayMax: displayMaxVal,
    standardRangeLabel: standardLabel,
  };
};


const ITEMS_PER_PAGE = 10;

export function BodyCompositionHistoryPage() {
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<BodyCompositionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<BodyCompositionLog | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({}); // 확장 상태 추가

  // Filters
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch members for filter dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      if (!userCenter) return;
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('center_id', userCenter)
          .order('name', { ascending: true });
        if (error) throw error;
        setMembers(data || []);
      } catch (error) {
        console.error('Error fetching members:', error);
        toast({ title: "오류", description: "회원 목록 로딩 실패", variant: "destructive" });
      }
    };
    fetchMembers();
  }, [userCenter, toast]);

  // Fetch logs based on filters and pagination
  const fetchLogs = useCallback(async () => {
    if (!userCenter) return;
    setIsLoading(true);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE - 1;

    try {
      let queryBuilder: PostgrestFilterBuilder<Database['public'], Tables<'body_composition_logs'>, BodyCompositionLog[]> = supabase
        .from('body_composition_logs')
        .select(`
          *,
          members(*)
        `, { count: 'exact' })
        .eq('center_id', userCenter);

      if (filterMemberId && filterMemberId !== 'all') {
        queryBuilder = queryBuilder.eq('member_id', filterMemberId);
      }
      if (filterStartDate) {
        queryBuilder = queryBuilder.gte('measurement_date', format(filterStartDate, 'yyyy-MM-dd'));
      }
      if (filterEndDate) {
        queryBuilder = queryBuilder.lte('measurement_date', format(filterEndDate, 'yyyy-MM-dd'));
      }

      // 정렬 기준을 created_at (등록 시간)으로 변경
      const finalQuery = queryBuilder
        .order('created_at', { ascending: false }) // measurement_date -> created_at
        .range(startIndex, endIndex);

      const { data, error, count } = await finalQuery;

      if (error) throw error;

      const logsData = (data || []) as BodyCompositionLog[];
      const validData = logsData.filter(log => log.members !== null);

      setLogs(validData);
      setTotalCount(count || 0);

    } catch (error) {
      console.error('Error fetching body composition logs:', error);
      toast({ title: "오류", description: "체성분 기록 로딩 실패", variant: "destructive" });
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userCenter, currentPage, filterMemberId, filterStartDate, filterEndDate, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterApply = () => {
    setCurrentPage(1);
  };

  const handleFilterReset = () => {
    setFilterMemberId('all');
    setFilterStartDate(startOfMonth(new Date()));
    setFilterEndDate(endOfMonth(new Date()));
    setCurrentPage(1);
  };

  const formatDateDisplay = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'yyyy.MM.dd');
    } catch {
      return '날짜 오류';
    }
  };

  const handleEditClick = (log: BodyCompositionLog) => {
    setEditingLog(log);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingLog(null);
  };

   const handleSaveSuccess = () => {
    fetchLogs();
  };

  const handleDeleteClick = (logId: string) => {
    setDeletingLogId(logId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingLogId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('body_composition_logs')
        .delete()
        .eq('id', deletingLogId);

      if (error) throw error;

      toast({ title: "성공", description: "기록이 삭제되었습니다." });
      setDeletingLogId(null);
      setIsDeleteDialogOpen(false);
      fetchLogs();
    } catch (error) {
      console.error('Error deleting body composition log:', error);
      toast({ title: "삭제 오류", description: "기록 삭제 중 오류 발생", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // 행 확장/축소 토글 함수
  const toggleRowExpansion = (logId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };


  // Pagination Logic
  const renderPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5;
    const halfMaxPages = Math.floor(maxPagesToShow / 2);
    let startPage = Math.max(1, currentPage - halfMaxPages);
    let endPage = Math.min(totalPages, currentPage + halfMaxPages);

    if (currentPage <= halfMaxPages) {
        endPage = Math.min(totalPages, maxPagesToShow);
    }
    if (currentPage + halfMaxPages >= totalPages) {
        startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        items.push(
            <PaginationItem key="start-ellipsis">
                <PaginationEllipsis />
            </PaginationItem>
        );
    }

    for (let i = startPage; i <= endPage; i++) {
        items.push(
            <PaginationItem key={i}>
                <PaginationLink
                    href="#"
                    isActive={i === currentPage}
                    onClick={(e) => { e.preventDefault(); handlePageChange(i); }}
                >
                    {i}
                </PaginationLink>
            </PaginationItem>
        );
    }

    if (endPage < totalPages) {
        items.push(
            <PaginationItem key="end-ellipsis">
                <PaginationEllipsis />
            </PaginationItem>
        );
    }
    return items;
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">체성분 기록 내역</h1>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle>기록 필터</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Member Filter */}
            <div>
              <Label htmlFor="filterMember">회원</Label>
              <Select value={filterMemberId} onValueChange={setFilterMemberId}>
                <SelectTrigger id="filterMember">
                  <SelectValue placeholder="전체 회원" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 회원</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Start Date Filter */}
            <div>
              <Label>시작일</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterStartDate ? format(filterStartDate, 'PPP', { locale: ko }) : <span>시작 날짜</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} locale={ko} />
                </PopoverContent>
              </Popover>
            </div>
            {/* End Date Filter */}
            <div>
              <Label>종료일</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterEndDate ? format(filterEndDate, 'PPP', { locale: ko }) : <span>종료 날짜</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} locale={ko} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleFilterReset}><X className="mr-2 h-4 w-4" /> 초기화</Button>
            <Button onClick={handleFilterApply}><Filter className="mr-2 h-4 w-4" /> 적용</Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>측정 기록</CardTitle>
          <CardDescription>총 {totalCount}개의 기록이 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>기록 로딩 중...</p>
          ) : logs.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead> {/* 토글 버튼 열 */}
                    <TableHead>측정일</TableHead>
                    <TableHead>회원</TableHead>
                    <TableHead className="text-right">체중(kg)</TableHead>
                    <TableHead className="text-right">신장(cm)</TableHead>
                    <TableHead className="text-right">골격근량(kg)</TableHead>
                    <TableHead className="text-right">체지방률(%)</TableHead>
                    <TableHead className="text-right">BMI</TableHead>
                    {/* 메모 열 제거 */}
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expandedRows[log.id];
                    const memberAge = calculateAge(log.members?.birth_date);
                    const memberGender = log.members?.gender;
                    const smmCriteria = getSmmCriteria(memberGender, memberAge);
                    const stdWeight = calculateStandardWeight(log.height_cm);

                    return (
                      <React.Fragment key={log.id}>
                        <TableRow>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(log.id)}>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>{formatDateDisplay(log.measurement_date)}</TableCell>
                          <TableCell>{log.members?.name ?? '알 수 없음'}</TableCell>
                          <TableCell className="text-right">{log.weight_kg?.toFixed(1) ?? '-'}</TableCell>
                          <TableCell className="text-right">{log.height_cm?.toFixed(1) ?? '-'}</TableCell>
                          <TableCell className="text-right">{log.skeletal_muscle_mass_kg?.toFixed(1) ?? '-'}</TableCell>
                          <TableCell className="text-right">{log.body_fat_percentage?.toFixed(1) ?? '-'}</TableCell>
                          <TableCell className="text-right">{log.bmi?.toFixed(1) ?? '-'}</TableCell>
                          {/* 메모 셀 제거 */}
                          <TableCell className="text-right space-x-1">
                            <Button variant="outline" size="sm" onClick={() => handleEditClick(log)} disabled={isLoading}>수정</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(log.id)} disabled={isLoading}>삭제</Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            {/* colSpan은 헤더의 총 열 개수 (토글 버튼 포함 9개) */}
                            <TableCell colSpan={9} className="p-0">
                              <div className="p-4 bg-muted/50 space-y-4">
                                <h4 className="font-semibold mb-2">상세 분석 결과</h4>
                                {/* 체중 */}
                                <BodyCompositionBar
                                  label="체중"
                                  value={log.weight_kg}
                                  unit="kg"
                                  displayRanges={stdWeight !== null ? [
                                    { label: '저체중', max: stdWeight * 0.9, colorClass: 'bg-blue-200' },
                                    { label: '정상', min: stdWeight * 0.9, max: stdWeight * 1.1, colorClass: 'bg-green-200' },
                                    { label: '과체중', min: stdWeight * 1.1, max: stdWeight * 1.2, colorClass: 'bg-yellow-200' },
                                    { label: '비만', min: stdWeight * 1.2, colorClass: 'bg-red-200' },
                                  ] : []}
                                  standardRange={stdWeight !== null ? { min: stdWeight * 0.9, max: stdWeight * 1.1 } : { min: 0, max: 0 }}
                                  displayMin={stdWeight !== null ? stdWeight * 0.5 : 0}
                                  displayMax={stdWeight !== null ? stdWeight * 1.5 : 100}
                                  standardRangeLabel={stdWeight !== null ? `${(stdWeight * 0.9).toFixed(1)} ~ ${(stdWeight * 1.1).toFixed(1)} kg` : '-'}
                                  opacity={1.0} // 확장 시에는 불투명하게
                                />
                                {/* 골격근량 */}
                                <BodyCompositionBar
                                  label={`골격근량 (${memberAge !== null ? `${memberAge}세` : ''})`}
                                  value={log.skeletal_muscle_mass_kg}
                                  unit="kg"
                                  {...smmCriteria}
                                  opacity={1.0}
                                />
                                {/* 체지방률 */}
                                <BodyCompositionBar
                                  label="체지방률"
                                  value={log.body_fat_percentage}
                                  unit="%"
                                  displayRanges={memberGender === 'male' ? [
                                    { label: '매우 낮음', max: 6, colorClass: 'bg-blue-100' },
                                    { label: '낮음', min: 6, max: 14, colorClass: 'bg-blue-200' },
                                    { label: '정상', min: 14, max: 18, colorClass: 'bg-green-200' },
                                    { label: '다소 높음', min: 18, max: 25, colorClass: 'bg-yellow-200' },
                                    { label: '높음', min: 25, colorClass: 'bg-red-200' },
                                  ] : memberGender === 'female' ? [
                                    { label: '매우 낮음', max: 14, colorClass: 'bg-blue-100' },
                                    { label: '낮음', min: 14, max: 21, colorClass: 'bg-blue-200' },
                                    { label: '정상', min: 21, max: 25, colorClass: 'bg-green-200' },
                                    { label: '다소 높음', min: 25, max: 32, colorClass: 'bg-yellow-200' },
                                    { label: '높음', min: 32, colorClass: 'bg-red-200' },
                                  ] : []}
                                  standardRange={memberGender === 'male' ? { min: 14, max: 18 } : memberGender === 'female' ? { min: 21, max: 25 } : { min: 0, max: 0 }}
                                  displayMin={0}
                                  displayMax={memberGender === 'male' ? 40 : memberGender === 'female' ? 50 : 1}
                                  standardRangeLabel={memberGender === 'male' ? '14.0 ~ 18.0 %' : memberGender === 'female' ? '21.0 ~ 25.0 %' : '-'}
                                  opacity={1.0}
                                />
                                {/* BMI */}
                                <BodyCompositionBar
                                  label="BMI"
                                  value={log.bmi}
                                  unit="kg/m²"
                                  displayRanges={[
                                    { label: '저체중', max: 18.5, colorClass: 'bg-blue-200' },
                                    { label: '정상', min: 18.5, max: 23, colorClass: 'bg-green-200' },
                                    { label: '과체중', min: 23, max: 25, colorClass: 'bg-yellow-200' },
                                    { label: '비만 1단계', min: 25, max: 30, colorClass: 'bg-orange-200' },
                                    { label: '비만 2단계', min: 30, max: 35, colorClass: 'bg-red-200' },
                                    { label: '비만 3단계', min: 35, colorClass: 'bg-red-300' },
                                  ]}
                                  standardRange={{ min: 18.5, max: 23 }}
                                  displayMin={10}
                                  displayMax={40}
                                  standardRangeLabel="18.5 ~ 23.0 kg/m²"
                                  opacity={1.0}
                                />
                                {/* 메모 표시 추가 */}
                                {log.notes && (
                                  <div className="mt-4 pt-4 border-t">
                                    <h5 className="font-semibold mb-1">메모:</h5>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.notes}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} aria-disabled={currentPage === 1} />
                      </PaginationItem>
                      {renderPaginationItems()}
                      <PaginationItem>
                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} aria-disabled={currentPage === totalPages} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">조건에 맞는 측정 기록이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EditBodyCompositionModal
        log={editingLog}
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        onSaved={handleSaveSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 체성분 기록을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingLogId(null)} disabled={isLoading}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BodyCompositionHistoryPage;