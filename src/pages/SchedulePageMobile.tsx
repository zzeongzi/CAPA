import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIconLucide, ChevronLeft, ChevronRight, CalendarDays, Loader2, Plus, MoreHorizontal } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { NewAppointmentModal, AppointmentData } from '@/components/features/NewAppointmentModal';
import { EditAppointmentModal, EditAppointmentData } from '@/components/features/EditAppointmentModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMembers, Member } from '@/hooks/use-members';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, startOfDay, endOfDay, addDays, isSameDay, isSameMonth, parseISO, differenceInMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  workoutSessionId?: string | null;
  title: string;
  start: string;
  end: string;
  status: 'scheduled' | 'completed' | 'cancelled' | null;
  notes: string | null; 
  memberId: string; // auth.users.id (pt_sessions 테이블의 member_id)
  type: "PT" | "상담" | "측정" | null;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  duration: number;
  members: Member | null; 
}

const SchedulePageMobile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { members: allMembersList, isLoading: membersLoading } = useMembers();
  const [refetchCounter, setRefetchCounter] = useState(0);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<CalendarEvent | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleNewAppointment = () => setIsNewAppointmentModalOpen(true);
  const triggerRefetch = () => setRefetchCounter(prev => prev + 1);

  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') setCurrentDate(new Date());
    else setCurrentDate(prev => addDays(prev, action === 'PREV' ? -1 : 1));
  };

  const calendarTitle = useMemo(() => format(currentDate, 'yyyy년 M월 d일 (eee)', { locale: ko }), [currentDate]);

  const fetchEvents = useCallback(async () => {
    if (!user || membersLoading) return;
    setIsLoading(true);
    try {
      const viewStart = startOfDay(currentDate).toISOString();
      const viewEnd = endOfDay(currentDate).toISOString();

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('pt_sessions')
        .select('*') 
        .eq('trainer_id', user.id)
        .gte('start_time', viewStart)
        .lte('start_time', viewEnd)
        .order('start_time');

      if (sessionsError) throw sessionsError;

      if (sessionsData) {
        const fetchedEvents: CalendarEvent[] = sessionsData.map((session: any) => {
          // pt_sessions.member_id (auth.users.id로 가정)와 Member.id (auth.users.id)를 비교
          const memberInfo = allMembersList.find(m => m.id === session.member_id); 
          
          const start = session.start_time;
          const end = session.end_time;
          const status = session.status;
          const type = session.type as "PT" | "상담" | "측정" | null;
          const defaultColor = "#1d4ed8ff"; const completedColor = "#6b7280ff"; const cancelledColor = "#ef4444ff";
          let bgColor = session.background_color || defaultColor;
          if (status === 'completed') bgColor = completedColor;
          else if (status === 'cancelled') bgColor = cancelledColor;
          
          const darkenColor = (hex:string|null|undefined) => hex ? `#${Math.max(0,parseInt(hex.substring(1,3),16)-20).toString(16).padStart(2,'0')}${Math.max(0,parseInt(hex.substring(3,5),16)-20).toString(16).padStart(2,'0')}${Math.max(0,parseInt(hex.substring(5,7),16)-20).toString(16).padStart(2,'0')}${hex.length===9?hex.substring(7,9):'ff'}` : defaultColor;
          const borderColor = darkenColor(bgColor);

          return {
             id: session.id,
             workoutSessionId: session.workout_session_id,
             title: memberInfo?.name || '알 수 없는 회원',
             start, end, status, notes: session.notes,
             memberId: session.member_id, // pt_sessions의 member_id (auth.users.id)
             type: type,
             backgroundColor: bgColor, borderColor: borderColor, textColor: '#ffffff',
             duration: differenceInMinutes(parseISO(end), parseISO(start)),
             members: memberInfo || null 
          };
        });
        setEvents(fetchedEvents);
      } else {
        setEvents([]);
      }
    } catch (error: any) {
      console.error("Error fetching events:", error);
      setEvents([]);
      toast({ title: "오류", description: error.message || "일정 로딩 오류", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, membersLoading, toast, currentDate, allMembersList]);

    useEffect(() => { if (!membersLoading) fetchEvents(); }, [fetchEvents, refetchCounter, membersLoading, currentDate]);

  useEffect(() => {
    if (location.state?.highlightId) {
      const idToHighlight = location.state.highlightId;
      setHighlightedEventId(idToHighlight);
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => { document.getElementById(`event-item-${idToHighlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const state = location.state as { refetch?: boolean, completedPtSessionId?: string, completedWorkoutSessionId?: string };
    if (state?.completedPtSessionId) {
      setEvents(prev => prev.map(e => e.id === state.completedPtSessionId ? { ...e, status: 'completed', workoutSessionId: state.completedWorkoutSessionId ?? null } : e));
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.refetch) {
       triggerRefetch();
       navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, triggerRefetch]);

  const handleSaveAppointment = async (appointmentData: AppointmentData): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      if (!user || !appointmentData.member || !appointmentData.startTime || !appointmentData.endTime) {
        toast({ title: "오류", description: "필수 정보 부족", variant: "destructive" });
        reject(new Error("필수 정보 부족")); return;
      }
      const { member, startTime, endTime, type, notes, backgroundColor: initialBackgroundColor } = appointmentData;
      const trainerId = user.id;
      const memberAuthId = member.id; // member.id는 auth.users.id
      const defaultColor = "#1d4ed8ff"; const overlapColor = "#ec4899ff";
      let finalBackgroundColor = initialBackgroundColor || defaultColor;
      let membershipIdToLink: string | null = null;

      try {
        const { data: activeMemberships, error: membershipError } = await supabase.from('memberships').select('id').eq('member_id', memberAuthId).gt('remaining_sessions', 0).order('start_date', { ascending: true }).order('created_at', { ascending: true });
        if (membershipError) throw membershipError;
        if (!activeMemberships || activeMemberships.length === 0) { throw new Error("해당 회원의 유효한 멤버십 정보를 찾을 수 없습니다."); }
        membershipIdToLink = activeMemberships[0].id;

        const { data: overlappingSessions, error: overlapError } = await supabase.from('pt_sessions').select('id').eq('trainer_id', trainerId).lt('start_time', endTime).gt('end_time', startTime).limit(1);
        if (overlapError) { console.error("Error checking overlap:", overlapError); } 
        else if (overlappingSessions && overlappingSessions.length > 0) { finalBackgroundColor = overlapColor; }

        const { error: insertError } = await supabase.from('pt_sessions').insert({ membership_id: membershipIdToLink, member_id: memberAuthId, trainer_id: trainerId, start_time: startTime, end_time: endTime, status: 'scheduled', type: type, notes: notes || null, background_color: finalBackgroundColor });
        if (insertError) throw insertError;
        toast({ title: "성공", description: "예약 정보가 저장되었습니다." });
        setIsNewAppointmentModalOpen(false); triggerRefetch(); resolve();
      } catch (error: any) {
        toast({ title: "저장 오류", description: error.message || "예약 저장 중 오류 발생", variant: "destructive" });
        reject(error);
      }
    });
  };

  const handleEditAppointment = useCallback((event: CalendarEvent) => { setEditingAppointment(event); setIsEditAppointmentModalOpen(true); }, []);
  const handleUpdateAppointment = useCallback(async (updatedData: EditAppointmentData) => {
    if (!user || !updatedData.member || !updatedData.startTime || !updatedData.endTime) {
        toast({ title: "오류", description: "업데이트 정보 부족", variant: "destructive" });
        return Promise.reject(new Error("필수 정보 부족"));
    }
    const { id, member, startTime, endTime, type, notes, backgroundColor } = updatedData;
    const memberAuthId = member.id; // member.id는 auth.users.id
    try {
        const { error: updateError } = await supabase.from('pt_sessions').update({ member_id: memberAuthId, start_time: startTime, end_time: endTime, type, notes, background_color: backgroundColor }).eq('id', id);
        if (updateError) throw updateError;
        toast({ title: "성공", description: "예약이 수정되었습니다." });
        setIsEditAppointmentModalOpen(false); triggerRefetch(); return Promise.resolve();
    } catch (error: any) {
        toast({ title: "수정 오류", description: error.message, variant: "destructive" });
        return Promise.reject(error);
    }
  }, [user, toast, triggerRefetch]);

  const handleStartPt = useCallback((event: CalendarEvent) => {
    const memberInfo = allMembersList.find(m => m.id === event.memberId); // event.memberId는 auth.users.id
    if (!memberInfo) { toast({ title: "오류", description: "회원 정보를 찾을 수 없습니다.", variant: "destructive" }); return; }
    navigate('/workout', { state: { selectedMember: memberInfo, selectedDate: event.start, ptSessionId: event.id } });
  }, [navigate, allMembersList, toast]);

  const handleEditPt = useCallback((event: CalendarEvent) => {
    if (!event.workoutSessionId) { toast({ title: "알림", description: "아직 운동 기록이 없는 예약입니다.", variant: "default" }); return; }
    const memberInfo = allMembersList.find(m => m.id === event.memberId);
    if (!memberInfo) { toast({ title: "오류", description: "회원 정보를 찾을 수 없습니다.", variant: "destructive" }); return; }
    navigate('/workout', { state: { workoutSessionId: event.workoutSessionId, ptSessionId: event.id, selectedMember: memberInfo, selectedDate: event.start } });
  }, [navigate, allMembersList, toast]);

  const handleToggleNoShow = useCallback(async (event: CalendarEvent) => {
    const newStatus = event.status === 'cancelled' ? 'scheduled' : 'cancelled';
    try {
      const { error } = await supabase.from('pt_sessions').update({ status: newStatus }).eq('id', event.id);
      if (error) throw error;
      toast({ title: "성공", description: `예약 상태를 ${newStatus === 'cancelled' ? '노쇼' : '예약됨'}으로 변경했습니다.` });
      triggerRefetch();
    } catch (error: any) {
      toast({ title: "오류", description: `예약 상태 변경 중 오류 발생: ${error.message}`, variant: "destructive" });
    }
  }, [toast, triggerRefetch]);

  const openDeleteConfirm = (event: CalendarEvent) => { setDeletingEvent(event); setIsDeleteConfirmOpen(true); };
  const handleDeletePt = useCallback(async () => {
    if (!deletingEvent) return;
    setIsDeletingEvent(true);
    try {
      const { error } = await supabase.from('pt_sessions').delete().eq('id', deletingEvent.id);
      if (error) { throw error; }
      toast({ title: "성공", description: "예약이 삭제되었습니다." });
      setEvents(prevEvents => prevEvents.filter(event => event.id !== deletingEvent.id));
    } catch (error: any) {
      toast({ title: "오류", description: error.message || "예약 삭제 중 오류 발생", variant: "destructive" });
    } finally { setIsDeletingEvent(false); setIsDeleteConfirmOpen(false); setDeletingEvent(null); }
  }, [deletingEvent, toast]);

  const MobileEventItem: React.FC<{event: CalendarEvent}> = ({ event }) => (
    <Card 
        id={`event-item-${event.id}`}
        className={`mb-3 p-0 shadow-md overflow-hidden ${highlightedEventId === event.id ? 'ring-2 ring-primary' : ''}`}
        onClick={() => handleEditAppointment(event)}
    >
      <div className="flex">
        <div className="flex flex-col items-center w-20 p-2 bg-muted/30 border-r border-border/50">
          <div className="text-base font-bold text-primary">{format(parseISO(event.start), 'HH:mm')}</div>
          <div className="text-xs text-muted-foreground mt-0.5">~{format(parseISO(event.end), 'HH:mm')}</div>
          <div className="text-[0.65rem] text-muted-foreground mt-0.5">({event.duration}분)</div>
        </div>

        <div className="flex-grow p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-8 w-8">
                <AvatarImage src={event.members?.avatarUrl || undefined} />
                <AvatarFallback>{event.members?.name?.[0] || '?'}</AvatarFallback>
              </Avatar>
              <p className="font-semibold text-md leading-tight">{event.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge 
                    variant={event.status === 'completed' ? 'default' : event.status === 'cancelled' ? 'destructive' : 'outline'}
                    className={cn(
                        "text-xs px-1.5 py-0.5",
                        event.status === 'completed' && "bg-green-100 text-green-700 border-green-300",
                        event.status === 'scheduled' && "border-blue-300 text-blue-700",
                        event.status === 'cancelled' && "bg-red-100 text-red-700 border-red-300"
                    )}
                >
                    {event.type === 'PT' ? 'PT' : event.type || '기타'}
                    {event.status === 'completed' ? " (완료)" : event.status === 'cancelled' ? " (취소)" : ""}
                </Badge>
                {event.status === 'scheduled' && (
                     <Button size="sm" variant="outline" className="h-6 px-1.5 py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); handleStartPt(event); }}>PT 시작</Button>
                )}
                {event.status === 'completed' && event.workoutSessionId && (
                     <Button size="sm" variant="outline" className="h-6 px-1.5 py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); handleEditPt(event); }}>기록 수정</Button>
                )}
                 {event.status !== 'completed' && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleToggleNoShow(event)}>
                                {event.status === 'cancelled' ? '예약으로 변경' : '노쇼 처리'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(event)} className="text-destructive">
                                예약 삭제
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
          </div>
          {event.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{event.notes}</p>}
        </div>
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <div className="sticky top-0 bg-background z-20 border-b p-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">일정</h1>
            <Button size="sm" className="bg-primary h-9 px-3" onClick={handleNewAppointment}>
              <Plus className="h-4 w-4 mr-1" /> 새 예약
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => handleNavigate('PREV')} className="h-9 w-9"> <ChevronLeft className="h-5 w-5" /> </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="text-md font-semibold h-9 px-3">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {calendarTitle}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={currentDate} onSelect={(date) => { if (date) setCurrentDate(date); }} initialFocus />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => handleNavigate('NEXT')} className="h-9 w-9"> <ChevronRight className="h-5 w-5" /> </Button>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-3" ref={listContainerRef}>
          {isLoading ? (
            <div className="flex justify-center items-center h-full pt-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
          ) : events.length > 0 ? (
            events.map(event => <MobileEventItem key={event.id} event={event} />)
          ) : (
            <div className="flex flex-col items-center justify-center h-full pt-10 text-muted-foreground">
              <CalendarIconLucide className="h-12 w-12 mb-3 opacity-50" />
              <p>선택된 날짜에 일정이 없습니다.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleNewAppointment}>
                <Plus className="mr-2 h-4 w-4" /> 새 예약 추가
              </Button>
            </div>
          )}
        </div>
      </div>

      <NewAppointmentModal isOpen={isNewAppointmentModalOpen} onClose={() => setIsNewAppointmentModalOpen(false)} onSave={handleSaveAppointment} isMobileView={true} />
      <EditAppointmentModal isOpen={isEditAppointmentModalOpen} onClose={() => setIsEditAppointmentModalOpen(false)} onSave={handleUpdateAppointment} appointment={editingAppointment} isMobileView={true} />
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>예약 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription> 정말로 '{deletingEvent?.title}' 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다. </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingEvent(null)} disabled={isDeletingEvent}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePt} disabled={isDeletingEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default SchedulePageMobile;