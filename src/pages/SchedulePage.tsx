import { useState, useMemo, useCallback, useEffect, useRef } from 'react'; // useRef 추가
// import { useMcpTool } from '@modelcontextprotocol/react'; // MCP 도구 훅 제거
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScheduleCalendar, CalendarEvent, PTSession } from "@/components/features/ScheduleCalendar";
// Loader2 추가, Plus 제거 (AlertDialog에서 사용)
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Plus } from 'lucide-react'; // Plus 다시 추가
import { NewAppointmentModal, AppointmentData } from '@/components/features/NewAppointmentModal';
import { EditAppointmentModal, EditAppointmentData } from '@/components/features/EditAppointmentModal'; // EditAppointmentModal import 확인
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMembers } from '@/hooks/use-members';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, isSameMonth, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types'; // Import Database type
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

const SchedulePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day'); // 기본값을 'day'로 변경
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { members, isLoading: membersLoading } = useMembers();
  // 삭제 관련 상태 추가
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
// 예약 수정 관련 상태 추가
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<CalendarEvent | null>(null);
  // const { callTool: callSupabaseTool } = useMcpTool('supabase-mcp-server'); // Supabase MCP 서버 도구 호출 훅 제거
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null); // 강조할 이벤트 ID 상태 추가
  const calendarContainerRef = useRef<HTMLDivElement>(null); // 캘린더 컨테이너 ref 추가


  const handleNewAppointment = () => {
    setIsNewAppointmentModalOpen(true);
  };

  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') {
      setCurrentDate(new Date());
    } else {
      const adder = action === 'PREV' ? -1 : 1;
      if (currentView === 'month') {
        setCurrentDate(addMonths(currentDate, adder));
      } else if (currentView === 'week') {
        setCurrentDate(addWeeks(currentDate, adder));
      } else { // day
        setCurrentDate(addDays(currentDate, adder));
      }
    }
  };

  const calendarTitle = useMemo(() => {
     if (currentView === 'month') {
       return format(currentDate, 'yyyy년 M월', { locale: ko });
     } else if (currentView === 'week') {
       const weekStart = startOfWeek(currentDate, { locale: ko });
       const weekEnd = endOfWeek(currentDate, { locale: ko });
       if (!isSameMonth(weekStart, weekEnd)) {
         return `${format(weekStart, 'M월 d일')} - ${format(weekEnd, 'M월 d일')}`;
       }
       return `${format(weekStart, 'yyyy년 M월 d일')} - ${format(weekEnd, 'd일')}`;
     } else { // day
       return format(currentDate, 'yyyy년 M월 d일 (eee)', { locale: ko });
     }
   }, [currentDate, currentView]);

    const fetchEvents = useCallback(async () => {
      if (!user || membersLoading) return;
      setIsLoading(true);
      try {
        const viewStart = currentView === 'month' ? startOfMonth(currentDate) : startOfWeek(currentDate, { locale: ko });
        const viewEnd = currentView === 'month' ? endOfMonth(currentDate) : endOfWeek(currentDate, { locale: ko });


        const { data: sessionsData, error: sessionsError } = await supabase
          .from('pt_sessions')
          .select('id, member_id, trainer_id, start_time, end_time, status, notes, type, background_color, workout_session_id, calendar_column_index') // calendar_column_index 추가
          .eq('trainer_id', user.id)
          .gte('start_time', viewStart.toISOString())
          .lte('end_time', viewEnd.toISOString())
          .order('start_time');

        if (sessionsError) throw sessionsError;

        if (sessionsData) {
          const memberMap = new Map(members.map(m => [m.id, m.name]));

          const fetchedEvents: CalendarEvent[] = [];
          for (const session of sessionsData) {
            const workoutSessionId = session.workout_session_id;
            const start = session.start_time;
            const end = session.end_time;
            const status = session.status;
            const type = session.type as "PT" | "상담" | "측정" | null;
            const defaultColor = "#1d4ed8ff";
            const completedColor = "#6b7280ff";
            const cancelledColor = "#ef4444ff";

            let bgColor = session.background_color || defaultColor;

            if (status === 'completed') {
              bgColor = completedColor;
            } else if (status === 'cancelled') {
              bgColor = cancelledColor;
            }

            const darkenColor = (hexColor: string | null | undefined): string => {
               if (!hexColor || !hexColor.startsWith('#') || hexColor.length < 7) return hexColor || defaultColor;
               try {
                 let r = parseInt(hexColor.substring(1, 3), 16);
                 let g = parseInt(hexColor.substring(3, 5), 16);
                 let b = parseInt(hexColor.substring(5, 7), 16);
                 let a = hexColor.length === 9 ? hexColor.substring(7, 9) : 'ff';

                 r = Math.max(0, r - 20);
                 g = Math.max(0, g - 20);
                 b = Math.max(0, b - 20);

                 return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a}`;
               } catch (e) {
                 console.error("Error darkening color:", e);
                 return hexColor;
               }
             };

            const borderColor = darkenColor(bgColor);

            fetchedEvents.push({
               id: session.id,
               workoutSessionId: workoutSessionId,
               title: memberMap.get(session.member_id) || '알 수 없는 회원',
               start,
               end,
               status,
               notes: session.notes,
               memberId: session.member_id,
               type: type,
               backgroundColor: bgColor,
               borderColor: borderColor,
               textColor: '#ffffff',
               layout: { // layout 객체에 calendar_column_index 저장
                 top: 0, // 초기값, TimeGridView에서 계산됨
                 height: 0, // 초기값, TimeGridView에서 계산됨
                 left: 0, // 초기값, TimeGridView에서 계산됨
                 width: 0, // 초기값, TimeGridView에서 계산됨
                 zIndex: 10, // 초기값, TimeGridView에서 계산됨
                 columnIndex: session.calendar_column_index ?? undefined, // DB에서 가져온 값 사용
               }
            });
          }
          setEvents(fetchedEvents);
        } else {
          setEvents([]);
        }
      } catch (error: any) {
        console.error("Error fetching events:", error);
        setEvents([]);
        toast({ title: "오류", description: error.message || "일정 데이터를 불러오는 중 오류 발생", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }, [user, members, membersLoading, toast]);

    useEffect(() => {
      if (!membersLoading) {
        fetchEvents();
      }
  }, [fetchEvents, membersLoading]);

  // Dashboard에서 전달된 highlightId 처리 (상태 설정만)
  useEffect(() => {
    // console.log('[SchedulePage] location.state:', location.state); // 로그 제거
    if (location.state?.highlightId) {
      const idToHighlight = location.state.highlightId;
      // console.log('[SchedulePage] Received highlightId:', idToHighlight); // 로그 제거
      setHighlightedEventId(idToHighlight);
      // state 초기화
      navigate(location.pathname, { replace: true, state: {} });
      // 스크롤 및 깜빡임 로직은 ScheduleCalendar 내부에서 처리하도록 제거
    }
     // highlightId가 null로 초기화되는 로직도 제거 (ScheduleCalendar에서 처리 후 초기화)
  }, [location.key, navigate]);


  // WorkoutPage에서 돌아왔을 때 상태 업데이트 및 refetch 트리거
  // WorkoutPage에서 돌아왔을 때 상태 업데이트
  useEffect(() => {
    const state = location.state as { refetch?: boolean, completedPtSessionId?: string, completedWorkoutSessionId?: string };
    // completedPtSessionId가 있으면 로컬 상태를 즉시 업데이트
    if (state?.completedPtSessionId) {
      // console.log('[SchedulePage] Received completed session info from WorkoutPage:', state); // 로그 제거
      // console.log(`[SchedulePage] Updating event ${state.completedPtSessionId} status to completed locally.`); // 로그 제거
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === state.completedPtSessionId
            ? { ...event, status: 'completed', workoutSessionId: state.completedWorkoutSessionId ?? null } // Update status and workoutSessionId only
            : event
        )
      );
      // state 초기화
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.refetch) {
       // Fallback for general refetch if needed (e.g., after deletion)
       // console.log('[SchedulePage] Received general refetch trigger.'); // 로그 제거
       fetchEvents();
       navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, setEvents]);

  const dailyCount = useMemo(() => {
      return events.filter(e => isSameDay(e.start, currentDate)).length;
    }, [events, currentDate]);

    const monthlyCount = useMemo(() => {
      return events.filter(e => isSameMonth(e.start, currentDate)).length;
    }, [events, currentDate]);

    const noShowCount = useMemo(() => {
      return events.filter(e => isSameMonth(e.start, currentDate) && e.status === 'cancelled').length;
    }, [events, currentDate]);

    const handleSaveAppointment = async (appointmentData: AppointmentData): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        if (!user || !appointmentData.member || !appointmentData.startTime || !appointmentData.endTime) {
          toast({ title: "오류", description: "예약 정보를 저장하기 위한 필수 정보가 부족합니다.", variant: "destructive" });
          reject(new Error("필수 정보 부족"));
          return;
        }

        const { member, startTime, endTime, type, notes, backgroundColor: initialBackgroundColor } = appointmentData; // backgroundColor 가져오기 확인
        const trainerId = user.id;
        const memberId = member.id;
        // startTime and endTime are already ISO strings from NewAppointmentModal
        const startTimeISO = startTime;
        const endTimeISO = endTime;
        const defaultColor = "#1d4ed8ff";
        const overlapColor = "#ec4899ff"; // 겹칠 때 분홍색 확인

        let finalBackgroundColor = initialBackgroundColor || defaultColor; // 초기 색상 설정 확인

        let membershipId: string | null = null;

        try {
          const { data: activeMemberships, error: membershipError } = await supabase
            .from('memberships')
            .select('id, remaining_sessions')
            .eq('member_id', memberId)
            .gt('remaining_sessions', 0)
            .order('start_date', { ascending: true })
            .order('created_at', { ascending: true });

          if (membershipError) throw membershipError;

          if (!activeMemberships || activeMemberships.length === 0) {
            throw new Error("해당 회원의 유효한 (잔여 세션이 있는) 멤버십 정보를 찾을 수 없습니다.");
          }
          
          const targetMembership = activeMemberships[0];
          membershipId = targetMembership.id;

          // 겹치는 예약 확인
          // console.log("Checking for overlapping appointments..."); // 로그 제거
          const { data: overlappingSessions, error: overlapError } = await supabase
            .from('pt_sessions')
            .select('id')
            .eq('trainer_id', trainerId)
            // 시간 범위가 겹치는지 확인 (새 예약 시작 < 기존 예약 종료 AND 새 예약 종료 > 기존 예약 시작)
            .lt('start_time', endTimeISO)
            .gt('end_time', startTimeISO)
            .limit(1); // 하나라도 겹치면 충분

          if (overlapError) {
            console.error("Error checking for overlapping sessions:", overlapError);
            // 오류가 발생해도 일단 진행하되, 색상 변경은 하지 않음
          } else if (overlappingSessions && overlappingSessions.length > 0) {
            // console.log("Overlapping appointment found. Changing color to pink."); // 로그 제거
            finalBackgroundColor = overlapColor; // 겹치면 분홍색으로 변경
          } else {
            // console.log("No overlapping appointments found."); // 로그 제거
          }


          // console.log("Inserting into pt_sessions:", { membership_id: membershipId, member_id: memberId, trainer_id: trainerId, start_time: startTimeISO, end_time: endTimeISO, status: 'scheduled', type: type, notes: notes || null, background_color: finalBackgroundColor }); // 로그 제거
          const { error: insertError } = await supabase
            .from('pt_sessions')
            .insert({
              membership_id: membershipId,
              member_id: memberId,
              trainer_id: trainerId,
              start_time: startTimeISO,
              end_time: endTimeISO,
              status: 'scheduled',
              type: type,
              notes: notes || null,
              background_color: finalBackgroundColor, // 최종 배경색 저장 확인
            });

          if (insertError) throw insertError;

          toast({ title: "성공", description: "예약 정보가 데이터베이스에 저장되었습니다." });
          setIsNewAppointmentModalOpen(false);
          resolve();
          fetchEvents();

        } catch (error: any) {
          console.error("Error saving appointment:", error);
          toast({ title: "저장 오류", description: error.message || "예약 저장 중 오류 발생", variant: "destructive" });
          reject(error);
        }
    });
  };

  // --- 핸들러 함수 구현 ---
// 예약 수정 핸들러 구현
  const handleEditAppointment = useCallback((event: CalendarEvent) => {
    setEditingAppointment(event);
    setIsEditAppointmentModalOpen(true);
  }, []);

  // 예약 업데이트 핸들러 구현
  const handleUpdateAppointment = useCallback(async (updatedData: EditAppointmentData) => {
    if (!user || !updatedData.member || !updatedData.startTime || !updatedData.endTime) {
      toast({ title: "오류", description: "예약 정보를 업데이트하기 위한 필수 정보가 부족합니다.", variant: "destructive" });
      return Promise.reject(new Error("필수 정보 부족"));
    }

    const { id, member, startTime, endTime, type, notes, backgroundColor: initialBackgroundColor } = updatedData;
    const trainerId = user.id;
    const memberId = member.id; // 주의: member.id가 auth.users.id인지 members.id인지 확인 필요 (NewAppointmentModal과 동일하게 가정)
    // startTime and endTime are already ISO strings from EditAppointmentModal
    const startTimeISO = startTime;
    const endTimeISO = endTime;
    const defaultColor = "#1d4ed8ff";
    const overlapColor = "#ec4899ff";

    let finalBackgroundColor = initialBackgroundColor || defaultColor;

    // console.log("Updating appointment:", updatedData); // 로그 제거

    try {
       // 겹치는 예약 확인 (자기 자신 제외)
      // console.log("Checking for overlapping appointments (excluding self)..."); // 로그 제거
      const { data: overlappingSessions, error: overlapError } = await supabase
        .from('pt_sessions')
        .select('id')
        .eq('trainer_id', trainerId)
        .neq('id', id) // 자기 자신은 제외
        .lt('start_time', endTimeISO)
        .gt('end_time', startTimeISO)
        .limit(1);

      if (overlapError) {
        console.error("Error checking for overlapping sessions:", overlapError);
      } else if (overlappingSessions && overlappingSessions.length > 0) {
        // console.log("Overlapping appointment found. Changing color to pink."); // 로그 제거
        finalBackgroundColor = overlapColor;
      } else {
        // console.log("No overlapping appointments found."); // 로그 제거
      }

      // members 테이블 ID 조회 (handleSaveAppointment와 동일 로직)
      const { data: memberMappingData, error: mappingError } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', memberId) // member.id가 auth.users.id라고 가정
        .single();

      if (mappingError || !memberMappingData) {
        throw new Error("회원 ID 매핑 정보를 찾을 수 없습니다.");
      }
      const memberTableId = memberMappingData.id; // members 테이블의 ID

      // 멤버십 ID 조회 (handleSaveAppointment와 동일 로직)
      const { data: membershipData, error: membershipError } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', memberId) // auth.users.id 사용
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membershipData) throw new Error("해당 회원의 멤버십 정보를 찾을 수 없습니다.");
      const membershipId = membershipData.id;


      // Supabase 업데이트
      const { error: updateError } = await supabase
        .from('pt_sessions')
        .update({
          member_id: memberId, // auth.users.id 사용
          membership_id: membershipId, // 멤버십 ID 추가
          start_time: startTimeISO,
          end_time: endTimeISO,
          type: type,
          notes: notes || null,
          background_color: finalBackgroundColor,
          // status는 수정하지 않음 (운동 완료/취소는 별도 로직)
        })
        .eq('id', id);

      if (updateError) throw updateError;

          toast({ title: "성공", description: "예약 정보가 업데이트되었습니다." });
          setIsEditAppointmentModalOpen(false); // 모달 닫기
          fetchEvents(); // 목록 새로고침
          return Promise.resolve(); // 성공 시 resolve
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      toast({ title: "수정 오류", description: error.message || "예약 수정 중 오류 발생", variant: "destructive" });
      return Promise.reject(error); // 실패 시 reject
    }
  }, [user, toast]);

  const handleStartPt = useCallback((event: CalendarEvent) => {
    const memberInfo = members.find(m => m.id === event.memberId);
    if (!memberInfo) {
      toast({ title: "오류", description: "회원 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    navigate('/workout', {
      state: {
        selectedMember: memberInfo,
        selectedDate: event.start,
        ptSessionId: event.id // ptSessionId 추가
      }
    });
  }, [navigate, members, toast]);

  const handleEditPt = useCallback((event: CalendarEvent) => {
    if (!event.workoutSessionId) {
      toast({ title: "알림", description: "아직 운동 기록이 없는 예약입니다.", variant: "default" });
      return;
    }
    const memberInfo = members.find(m => m.id === event.memberId);
    if (!memberInfo) {
       toast({ title: "오류", description: "회원 정보를 찾을 수 없습니다.", variant: "destructive" });
       return;
    }
    navigate('/workout', {
      state: {
        workoutSessionId: event.workoutSessionId, // 운동 기록 ID
        ptSessionId: event.id, // PT 세션 ID
        selectedMember: memberInfo, // 회원 정보 추가
        selectedDate: event.start, // 날짜 정보 추가 (fetchWorkoutLog에서 덮어쓰지만, 만약을 위해)
      }
    });
  }, [navigate, members, toast]); // members 의존성 추가

  const handleToggleNoShow = useCallback(async (event: CalendarEvent) => {
    const newStatus = event.status === 'cancelled' ? 'scheduled' : 'cancelled';
    try {
      // unsafe 모드 활성화 필요
      const { error } = await supabase
        .from('pt_sessions')
        .update({ status: newStatus })
        .eq('id', event.id);

      if (error) throw error;

      toast({ title: "성공", description: `예약 상태를 ${newStatus === 'cancelled' ? '노쇼' : '예약됨'}으로 변경했습니다.` });
      fetchEvents();
    } catch (error: any) {
      console.error("Error updating session status:", error);
      toast({ title: "오류", description: `예약 상태 변경 중 오류 발생: ${error.message}`, variant: "destructive" });
      fetchEvents();
    }
  }, [toast]);


  // 예약 삭제 핸들러 추가
  const openDeleteConfirm = (event: CalendarEvent) => {
    setDeletingEvent(event);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeletePt = useCallback(async () => {
    if (!deletingEvent) return;
    setIsDeletingEvent(true);
    // console.log('[handleDeletePt] Deleting event:', deletingEvent.id); // 로그 제거

    try {
      // unsafe 모드 활성화 로직 제거
      // console.log('[handleDeletePt] Enabling unsafe mode for database...');
      // await callSupabaseTool('live_dangerously', {
      //   service: 'database',
      //   enable_unsafe_mode: true,
      // });
      // console.log('[handleDeletePt] Unsafe mode disabled.');

      // Perform the delete operation
      // console.log('[handleDeletePt] Attempting to delete from Supabase...'); // 로그 제거
      const { error } = await supabase
        .from('pt_sessions')
        .delete()
        .eq('id', deletingEvent.id);

      if (error) {
        console.error('[handleDeletePt] Supabase delete error:', error); // 오류 로그 추가
        throw error; // 오류 발생 시 throw
      }

      // console.log('[handleDeletePt] Supabase delete successful.'); // 로그 제거
      toast({ title: "성공", description: "예약이 삭제되었습니다." });
  
    // triggerRefetch() 대신 직접 상태 업데이트
    setEvents(prevEvents => prevEvents.filter(event => event.id !== deletingEvent.id));
    // console.log('[handleDeletePt] Events state updated locally.'); // 로그 제거
  
    } catch (error: any) {
      console.error("Error deleting session:", error);
      toast({ title: "오류", description: error.message || "예약 삭제 중 오류 발생", variant: "destructive" });
    } finally {
      // unsafe 모드 비활성화 로직 제거
      // try {
      //   console.log('[handleDeletePt] Disabling unsafe mode for database...');
      //   await callSupabaseTool('live_dangerously', {
      //     service: 'database',
      //     enable_unsafe_mode: false, // Disable unsafe mode
      //   });
      //   console.log('[handleDeletePt] Unsafe mode disabled.');
      // } catch (disableError) {
      //   console.error("Error disabling unsafe mode:", disableError);
      // }

      setIsDeletingEvent(false);
      setIsDeleteConfirmOpen(false);
      setDeletingEvent(null);
      // console.log('[handleDeletePt] Finished delete process.'); // 로그 제거
    }
  // }, [deletingEvent, toast, triggerRefetch, callSupabaseTool]); // callSupabaseTool 의존성 제거
  }, [deletingEvent, toast]);


  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <div className="sticky top-0 bg-background z-20 border-b">
          <div className="flex items-center justify-between p-4">
            <h1 className="text-3xl font-bold">일정 관리</h1>
            <div className="flex space-x-2">
              <Button variant={currentView === 'day' ? 'default' : 'outline'} onClick={() => setCurrentView('day')}>일</Button>
              <Button variant={currentView === 'week' ? 'default' : 'outline'} onClick={() => setCurrentView('week')}>주</Button>
              <Button variant={currentView === 'month' ? 'default' : 'outline'} onClick={() => setCurrentView('month')}>월</Button>
              <Button size="sm" className="bg-primary" onClick={handleNewAppointment}>
                <Plus className="h-4 w-4 mr-2" /> {/* Plus 아이콘 다시 추가 */}
                새 예약
              </Button>
            </div>
          </div>
          {/* flex-wrap을 추가하고, justify-between으로 변경하여 공간이 부족하면 버튼 그룹이 아래로 내려가도록 함 */}
          <div className="flex flex-wrap items-center justify-between p-4 pt-0 gap-x-4 gap-y-2">
            <h2 className="text-xl font-semibold whitespace-nowrap">{calendarTitle}</h2> {/* 날짜가 줄바꿈되지 않도록 */}
            {/* absolute 제거 */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleNavigate('PREV')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant={isSameDay(currentDate, new Date()) ? 'default' : 'outline'} size="sm" onClick={() => handleNavigate('TODAY')}>오늘</Button>
              <Button variant="outline" size="sm" onClick={() => handleNavigate('NEXT')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) setCurrentDate(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 p-4 pt-0">
            <Card>
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">일간</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{dailyCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">월간</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{monthlyCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">노쇼</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold text-red-500">{noShowCount}</div> {/* text-red-500 클래스 추가 */}
              </CardContent>
            </Card>
          </div>
        </div>
        {/* 캘린더 컨테이너에 ref 추가 */}
        <div className="flex-grow overflow-y-auto" ref={calendarContainerRef}>
          <ScheduleCalendar
            currentView={currentView}
            currentDate={currentDate}
            events={events}
            isLoading={isLoading}
            highlightedEventId={highlightedEventId} // highlightedEventId prop 전달
            setHighlightedEventId={setHighlightedEventId} // 상태 초기화 함수 전달
            onStartPt={handleStartPt}
            onEditPt={handleEditPt} // 운동 기록 수정
            onEditAppointment={handleEditAppointment} // 예약 수정 핸들러 전달
            onToggleNoShow={handleToggleNoShow}
            onDeletePt={openDeleteConfirm}
            onEventDrop={(eventId, newStart, newEnd, columnIndex) => {
              // 디버깅: 드롭 정보 출력
              console.log('[onEventDrop] eventId:', eventId, 'newStart:', newStart, 'newEnd:', newEnd, 'columnIndex:', columnIndex);
              setEvents(prevEvents =>
                prevEvents.map(event =>
                  event.id === eventId
                    ? {
                        ...event,
                        start: newStart.toISOString(),
                        end: newEnd.toISOString(),
                        layout: {
                          ...event.layout,
                          columnIndex: typeof columnIndex === 'number' ? columnIndex : undefined,
                        },
                      }
                    : event
                )
              );
            }}
          />
        </div>
      </div>
      <NewAppointmentModal
        isOpen={isNewAppointmentModalOpen}
        onClose={() => setIsNewAppointmentModalOpen(false)}
        onSave={handleSaveAppointment}
      />
 
      {/* 예약 수정 모달 */}
      <EditAppointmentModal
        isOpen={isEditAppointmentModalOpen}
        onClose={() => setIsEditAppointmentModalOpen(false)}
        onSave={handleUpdateAppointment}
        appointment={editingAppointment}
      />
 
      {/* 예약 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>예약 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 '{deletingEvent?.title}' 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingEvent(null)} disabled={isDeletingEvent}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePt}
              disabled={isDeletingEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};
 
export default SchedulePage;

