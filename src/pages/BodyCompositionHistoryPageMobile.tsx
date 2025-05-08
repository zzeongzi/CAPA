import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { Database, Tables } from '@/integrations/supabase/types';
import type { Range } from '@/components/features/BodyCompositionBar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter, X, ChevronDown, ChevronUp, MoreHorizontal, Edit3, Trash2, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { EditBodyCompositionModal } from '@/components/features/EditBodyCompositionModal';
import { BodyCompositionBarMobile } from '@/components/features/BodyCompositionBarMobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label'; // Label import 추가
import { Badge } from '@/components/ui/badge'; // Badge import 추가
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type BodyCompositionLog = Tables<'body_composition_logs'> & {
  members: Tables<'members'> | null;
};
type Member = Tables<'members'>;

const calculateAge = (birthDateString: string | null | undefined): number | null => {
  if (!birthDateString) return null;
  try {
    const birthDate = parseISO(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  } catch (e) { return null; }
};
const calculateStandardWeight = (heightCm: number | null): number | null => {
  if (heightCm === null || heightCm <= 0) return null;
  const standardWeight = (heightCm - 100) * 0.9;
  return standardWeight > 0 ? standardWeight : null;
};
const getSmmCriteria = (gender: string | null, age: number | null): { displayRanges: Range[]; standardRange: { min: number; max: number }; displayMin: number; displayMax: number; standardRangeLabel: string; } => {
  let ranges: Range[] = []; let standard: { min: number; max: number } = { min: 0, max: 0 };
  let displayMinVal = 10; let displayMaxVal = 65; let standardLabel = '-';
  if (gender === 'male' && age !== null) {
    if (age >= 20 && age <= 39) { standard = { min: 33.3, max: 39.5 }; ranges = [ { label: '낮음', max: 33.3, colorClass: 'bg-yellow-200' }, { label: '정상', min: 33.3, max: 39.5, colorClass: 'bg-green-200' }, { label: '높음', min: 39.5, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 25; displayMaxVal = 60; standardLabel = '33.3 ~ 39.5 kg'; }
    else if (age >= 40 && age <= 59) { standard = { min: 30.0, max: 36.7 }; ranges = [ { label: '낮음', max: 30.0, colorClass: 'bg-yellow-200' }, { label: '정상', min: 30.0, max: 36.7, colorClass: 'bg-green-200' }, { label: '높음', min: 36.7, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 20; displayMaxVal = 60; standardLabel = '30.0 ~ 36.7 kg'; }
    else if (age >= 60 && age <= 79) { standard = { min: 25.7, max: 31.7 }; ranges = [ { label: '낮음', max: 25.7, colorClass: 'bg-yellow-200' }, { label: '정상', min: 25.7, max: 31.7, colorClass: 'bg-green-200' }, { label: '높음', min: 31.7, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 15; displayMaxVal = 60; standardLabel = '25.7 ~ 31.7 kg'; }
  } else if (gender === 'female' && age !== null) {
    if (age >= 20 && age <= 39) { standard = { min: 22.1, max: 26.5 }; ranges = [ { label: '낮음', max: 22.1, colorClass: 'bg-yellow-200' }, { label: '정상', min: 22.1, max: 26.5, colorClass: 'bg-green-200' }, { label: '높음', min: 26.5, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 15; displayMaxVal = 60; standardLabel = '22.1 ~ 26.5 kg'; }
    else if (age >= 40 && age <= 59) { standard = { min: 21.1, max: 24.9 }; ranges = [ { label: '낮음', max: 21.1, colorClass: 'bg-yellow-200' }, { label: '정상', min: 21.1, max: 24.9, colorClass: 'bg-green-200' }, { label: '높음', min: 24.9, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 10; displayMaxVal = 60; standardLabel = '21.1 ~ 24.9 kg'; }
    else if (age >= 60 && age <= 79) { standard = { min: 18.2, max: 21.8 }; ranges = [ { label: '낮음', max: 18.2, colorClass: 'bg-yellow-200' }, { label: '정상', min: 18.2, max: 21.8, colorClass: 'bg-green-200' }, { label: '높음', min: 21.8, max: 55, colorClass: 'bg-blue-200' }, { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, ]; displayMinVal = 10; displayMaxVal = 60; standardLabel = '18.2 ~ 21.8 kg'; }
  }
  return { displayRanges: ranges, standardRange: standard, displayMin: displayMinVal, displayMax: displayMaxVal, standardRangeLabel: standardLabel };
};

const ITEMS_PER_PAGE = 5;

const BodyCompositionHistoryPageMobile = () => {
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
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!userCenter) return;
      try {
        const { data, error } = await supabase.from('members').select('*').eq('center_id', userCenter).order('name', { ascending: true });
        if (error) throw error;
        setMembers(data || []);
      } catch (error) { toast({ title: "오류", description: "회원 목록 로딩 실패", variant: "destructive" }); }
    };
    fetchMembers();
  }, [userCenter, toast]);

  const fetchLogs = useCallback(async () => {
    if (!userCenter) return;
    setIsLoading(true);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE - 1;
    try {
      let queryBuilder = supabase.from('body_composition_logs').select(`*, members(*)`, { count: 'exact' }).eq('center_id', userCenter);
      if (filterMemberId && filterMemberId !== 'all') queryBuilder = queryBuilder.eq('member_id', filterMemberId);
      if (filterStartDate) queryBuilder = queryBuilder.gte('measurement_date', format(filterStartDate, 'yyyy-MM-dd'));
      if (filterEndDate) queryBuilder = queryBuilder.lte('measurement_date', format(filterEndDate, 'yyyy-MM-dd'));
      const finalQuery = queryBuilder.order('created_at', { ascending: false }).range(startIndex, endIndex);
      const { data, error, count } = await finalQuery;
      if (error) throw error;
      const logsData = (data || []) as BodyCompositionLog[];
      setLogs(logsData.filter(log => log.members !== null));
      setTotalCount(count || 0);
    } catch (error) {
      toast({ title: "오류", description: "체성분 기록 로딩 실패", variant: "destructive" });
      setLogs([]); setTotalCount(0);
    } finally { setIsLoading(false); }
  }, [userCenter, currentPage, filterMemberId, filterStartDate, filterEndDate, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };
  const handleFilterApply = () => { setIsFilterSheetOpen(false); setCurrentPage(1); };
  const handleFilterReset = () => { setFilterMemberId('all'); setFilterStartDate(startOfMonth(new Date())); setFilterEndDate(endOfMonth(new Date())); setIsFilterSheetOpen(false); setCurrentPage(1); };
  const formatDateDisplay = (dateString: string): string => format(parseISO(dateString), 'yyyy.MM.dd');
  const handleEditClick = (log: BodyCompositionLog) => { setEditingLog(log); setIsEditModalOpen(true); };
  const handleCloseModal = () => { setIsEditModalOpen(false); setEditingLog(null); };
  const handleSaveSuccess = () => fetchLogs();
  const handleDeleteClick = (logId: string) => { setDeletingLogId(logId); setIsDeleteDialogOpen(true); };
  const confirmDelete = async () => {
    if (!deletingLogId) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('body_composition_logs').delete().eq('id', deletingLogId);
      if (error) throw error;
      toast({ title: "성공", description: "기록이 삭제되었습니다." });
      setDeletingLogId(null); setIsDeleteDialogOpen(false); fetchLogs();
    } catch (error) { toast({ title: "삭제 오류", description: "기록 삭제 중 오류 발생", variant: "destructive" });
    } finally { setIsLoading(false); }
  };
  const toggleRowExpansion = (logId: string) => setExpandedLogId(prevId => prevId === logId ? null : logId);

  const renderPaginationItems = () => {
    const items = []; const maxPagesToShow = 3; 
    const halfMaxPages = Math.floor(maxPagesToShow / 2);
    let startPage = Math.max(1, currentPage - halfMaxPages);
    let endPage = Math.min(totalPages, currentPage + halfMaxPages);
    if (currentPage <= halfMaxPages) endPage = Math.min(totalPages, maxPagesToShow);
    if (currentPage + halfMaxPages >= totalPages) startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    if (startPage > 1) items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>);
    for (let i = startPage; i <= endPage; i++) { items.push(<PaginationItem key={i}><PaginationLink href="#" isActive={i === currentPage} onClick={(e) => { e.preventDefault(); handlePageChange(i); }}>{i}</PaginationLink></PaginationItem>); }
    if (endPage < totalPages) items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>);
    return items;
  };

  return (
    <div className="flex flex-col h-screen bg-muted/20"> {/* 배경색 변경 */}
      <div className="sticky top-0 bg-background z-10 border-b p-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">체성분 기록</h1>
        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Filter className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader><SheetTitle className="text-lg">기록 필터</SheetTitle></SheetHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="filterMemberMobileSheet">회원</Label>
                        <Select value={filterMemberId} onValueChange={setFilterMemberId}>
                            <SelectTrigger id="filterMemberMobileSheet"><SelectValue placeholder="전체 회원" /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 회원</SelectItem>
                            {members.map((member) => (<SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>시작일</Label>
                        <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !filterStartDate && "text-muted-foreground")}><CalendarIcon className="mr-1 h-4 w-4" />{filterStartDate ? format(filterStartDate, 'yy/MM/dd') : "선택"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} locale={ko} /></PopoverContent></Popover>
                    </div>
                    <div>
                        <Label>종료일</Label>
                        <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !filterEndDate && "text-muted-foreground")}><CalendarIcon className="mr-1 h-4 w-4" />{filterEndDate ? format(filterEndDate, 'yy/MM/dd') : "선택"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} locale={ko} /></PopoverContent></Popover>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <Button variant="outline" onClick={handleFilterReset} className="flex-1 h-9"><X className="mr-1 h-4 w-4" />초기화</Button>
                        <Button onClick={handleFilterApply} className="flex-1 h-9"><Filter className="mr-1 h-4 w-4" />적용</Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
      </div>

      <div className="flex-grow overflow-y-auto px-1.5 py-2 space-y-1.5"> {/* 좌우 패딩 px-1.5 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : logs.length > 0 ? (
          <>
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const memberAge = calculateAge(log.members?.birth_date);
              const memberGender = log.members?.gender;
              const smmCriteria = getSmmCriteria(memberGender, memberAge);
              const stdWeight = calculateStandardWeight(log.height_cm);

              return (
                <Card key={log.id} className="overflow-hidden shadow-sm mx-0.5"> {/* 카드 좌우 마진 mx-0.5 */}
                  <CardHeader 
                    className="flex flex-row items-center justify-between p-2.5 cursor-pointer bg-background hover:bg-muted/40" // hover 효과 변경
                    onClick={() => toggleRowExpansion(log.id)}
                  >
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={log.members?.profile_image_url || undefined} />
                            <AvatarFallback>{log.members?.name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm leading-tight">{log.members?.name || '알 수 없음'}</p>
                            <p className="text-xs text-muted-foreground">{formatDateDisplay(log.measurement_date)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Badge variant={ (log.weight_kg && stdWeight && log.weight_kg >= stdWeight * 0.9 && log.weight_kg <= stdWeight * 1.1) ? "default" : "secondary"} className="text-[0.65rem] px-1.5 py-0.5"> {/* 텍스트 크기 조정 */}
                            {log.weight_kg?.toFixed(1) ?? '-'}kg
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="p-2.5 space-y-2 border-t">
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.7rem] mb-1.5">
                        <div className="flex justify-between"><span>신장:</span> <span className="font-medium">{log.height_cm?.toFixed(1) ?? '-'} cm</span></div>
                        <div className="flex justify-between"><span>BMI:</span> <span className="font-medium">{log.bmi?.toFixed(1) ?? '-'}</span></div>
                        <div className="flex justify-between"><span>골격근량:</span> <span className="font-medium">{log.skeletal_muscle_mass_kg?.toFixed(1) ?? '-'} kg</span></div>
                        <div className="flex justify-between"><span>체지방률:</span> <span className="font-medium">{log.body_fat_percentage?.toFixed(1) ?? '-'} %</span></div>
                      </div>
                      <BodyCompositionBarMobile label="체중" value={log.weight_kg} unit="kg" displayRanges={stdWeight !== null ? [ { label: '저체중', max: stdWeight * 0.9, colorClass: 'bg-blue-200' }, { label: '정상', min: stdWeight * 0.9, max: stdWeight * 1.1, colorClass: 'bg-green-200' }, { label: '과체중', min: stdWeight * 1.1, max: stdWeight * 1.2, colorClass: 'bg-yellow-200' }, { label: '비만', min: stdWeight * 1.2, colorClass: 'bg-red-200' }, ] : []} standardRange={stdWeight !== null ? { min: stdWeight * 0.9, max: stdWeight * 1.1 } : { min: 0, max: 0 }} displayMin={stdWeight !== null ? stdWeight * 0.5 : 0} displayMax={stdWeight !== null ? stdWeight * 1.5 : 100} standardRangeLabel={stdWeight !== null ? `${(stdWeight * 0.9).toFixed(1)} ~ ${(stdWeight * 1.1).toFixed(1)} kg` : '-'} />
                      <BodyCompositionBarMobile label={`골격근량 (${memberAge !== null ? `${memberAge}세` : ''})`} value={log.skeletal_muscle_mass_kg} unit="kg" {...smmCriteria} />
                      <BodyCompositionBarMobile label="체지방률" value={log.body_fat_percentage} unit="%" displayRanges={memberGender === 'male' ? [ { label: '매우 낮음', max: 6, colorClass: 'bg-blue-100' }, { label: '낮음', min: 6, max: 14, colorClass: 'bg-blue-200' }, { label: '정상', min: 14, max: 18, colorClass: 'bg-green-200' }, { label: '다소 높음', min: 18, max: 25, colorClass: 'bg-yellow-200' }, { label: '높음', min: 25, colorClass: 'bg-red-200' }, ] : memberGender === 'female' ? [ { label: '매우 낮음', max: 14, colorClass: 'bg-blue-100' }, { label: '낮음', min: 14, max: 21, colorClass: 'bg-blue-200' }, { label: '정상', min: 21, max: 25, colorClass: 'bg-green-200' }, { label: '다소 높음', min: 25, max: 32, colorClass: 'bg-yellow-200' }, { label: '높음', min: 32, colorClass: 'bg-red-200' }, ] : []} standardRange={memberGender === 'male' ? { min: 14, max: 18 } : memberGender === 'female' ? { min: 21, max: 25 } : { min: 0, max: 0 }} displayMin={0} displayMax={memberGender === 'male' ? 40 : memberGender === 'female' ? 50 : 1} standardRangeLabel={memberGender === 'male' ? '14.0 ~ 18.0 %' : memberGender === 'female' ? '21.0 ~ 25.0 %' : '-'} />
                      <BodyCompositionBarMobile label="BMI" value={log.bmi} unit="kg/m²" displayRanges={[ { label: '저체중', max: 18.5, colorClass: 'bg-blue-200' }, { label: '정상', min: 18.5, max: 23, colorClass: 'bg-green-200' }, { label: '과체중', min: 23, max: 25, colorClass: 'bg-yellow-200' }, { label: '비만 1단계', min: 25, max: 30, colorClass: 'bg-orange-200' }, { label: '비만 2단계', min: 30, max: 35, colorClass: 'bg-red-200' }, { label: '비만 3단계', min: 35, colorClass: 'bg-red-300' }, ]} standardRange={{ min: 18.5, max: 23 }} displayMin={10} displayMax={40} standardRangeLabel="18.5 ~ 23.0 kg/m²" />
                      {log.notes && (<div className="mt-1.5 pt-1.5 border-t"><h5 className="text-xs font-semibold mb-0.5">메모:</h5><p className="text-[0.7rem] text-muted-foreground whitespace-pre-wrap">{log.notes}</p></div>)}
                      <div className="flex justify-end gap-1.5 mt-1.5">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => {e.stopPropagation(); handleEditClick(log);}}><Edit3 className="mr-1 h-3 w-3"/>수정</Button>
                        <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={(e) => {e.stopPropagation(); handleDeleteClick(log.id);}}><Trash2 className="mr-1 h-3 w-3"/>삭제</Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
            {totalPages > 1 && (
              <div className="mt-3 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} aria-disabled={currentPage === 1} /></PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} aria-disabled={currentPage === totalPages} /></PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-10">기록이 없습니다.</div>
        )}
      </div>
      <EditBodyCompositionModal log={editingLog} isOpen={isEditModalOpen} onClose={handleCloseModal} onSaved={handleSaveSuccess} />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>삭제 확인</AlertDialogTitle><AlertDialogDescription>이 체성분 기록을 정말 삭제하시겠습니까? 되돌릴 수 없습니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingLogId(null)} disabled={isLoading}>취소</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '삭제'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BodyCompositionHistoryPageMobile;