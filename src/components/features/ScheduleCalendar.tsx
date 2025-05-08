import { useState, useEffect, useCallback, useMemo, useRef } from "react"; // useRef 추가
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, Play, CheckCircle, Edit, Ban, Undo2, Trash2, UserX, Pencil } from "lucide-react";
// Popover 추가
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMembers } from '@/hooks/use-members';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, isSameMonth, getHours, getMinutes, differenceInMinutes, setHours, setMinutes, parseISO, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export type PTSession = Database['public']['Tables']['pt_sessions']['Row'];

export interface CalendarEvent {
  id: string; // pt_sessions ID
  workoutSessionId?: string | null; // workout_sessions ID added
  title: string;
  start: string; // ISO string
  end: string;   // ISO string
  status: string;
  notes: string | null;
  memberId: string;
  type?: string | null;
  backgroundColor?: string | null;
  borderColor?: string;
  textColor?: string;
  layout?: { // Add layout property for TimeGridView positioning
    top: number;
    height: number;
    left: number;
    width: number;
    zIndex: number;
  };
}

interface ScheduleCalendarProps {
  currentView: 'day' | 'week' | 'month';
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  refetchTrigger?: number;
  highlightedEventId?: string | null; // 추가
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>; // 추가
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
}

// EventItem 컴포넌트 (Popover 방식 적용)
const EventItem = ({
  event,
  viewType,
  highlightedEventId, // 추가
  setHighlightedEventId, // 추가
  onStartPt,
  onEditPt,
  onEditAppointment,
  onToggleNoShow,
  onDeletePt,
}: {
  event: CalendarEvent;
  viewType: 'day' | 'week' | 'month';
  highlightedEventId?: string | null; // 추가
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>; // 추가
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
}) => {
  const itemRef = useRef<HTMLDivElement>(null); // 요소 참조 추가

  // 스크롤 및 깜빡임 효과 처리
  useEffect(() => {
    // highlightedEventId가 현재 이벤트 ID와 일치하고, ref가 존재하고, 상태 설정 함수가 있을 때만 실행
    if (highlightedEventId && event.id === highlightedEventId && itemRef.current && setHighlightedEventId) {
      const element = itemRef.current;
      // console.log('[EventItem] Scrolling and blinking for event:', event.id); // 로그 제거

      // 스크롤 (가장 가까운 스크롤 가능 조상 요소 기준 중앙 정렬)
      element.scrollIntoView({ block: 'center' });

      // 깜빡임 효과
      element.classList.add('highlight-blink');
      const blinkTimer = setTimeout(() => {
        // 타이머 콜백 내에서도 요소가 여전히 존재하는지 확인
        if (itemRef.current) {
          itemRef.current.classList.remove('highlight-blink');
          // console.log('[EventItem] Removed blink class for event:', event.id); // 로그 제거
        }
        setHighlightedEventId(null); // 부모 컴포넌트 상태 초기화
      }, 1500); // 1.5초

      // 컴포넌트 언마운트 또는 highlightedEventId 변경 시 타이머 정리
      return () => clearTimeout(blinkTimer);
    }
  }, [highlightedEventId, event.id, setHighlightedEventId]); // 의존성 배열

  // Popover 내부 버튼 렌더링 로직
  const renderPopoverButtons = () => (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-0.5"> {/* PopoverContent 내부 패딩은 PopoverContent 자체 prop으로 조절 */}
        {event.status === 'scheduled' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:bg-green-100" onClick={(e) => { e.stopPropagation(); onStartPt(event); }}>
                  <Play className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>PT 시작</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-500 hover:bg-yellow-100" onClick={(e) => { e.stopPropagation(); onEditAppointment(event); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>예약 수정</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); onToggleNoShow(event); }}>
                  <UserX className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>노쇼 처리</p></TooltipContent>
            </Tooltip>
          </>
        )}
        {event.status === 'completed' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); onEditPt(event); }}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>기록 수정</p></TooltipContent>
            </Tooltip>
            {/* 비활성화된 예약 수정 버튼 추가 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled className="h-6 w-6 text-gray-400 opacity-50 cursor-not-allowed">
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>예약 수정 불가</p></TooltipContent>
            </Tooltip>
            {/* 비활성화된 노쇼 버튼 추가 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled className="h-6 w-6 text-gray-400 opacity-50 cursor-not-allowed">
                  <UserX className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>노쇼 처리 불가</p></TooltipContent>
            </Tooltip>
          </>
        )}
        {event.status === 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-500 hover:bg-yellow-100" onClick={(e) => { e.stopPropagation(); onToggleNoShow(event); }}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>노쇼 해제</p></TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDeletePt(event); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>예약 삭제</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  // MonthView, TimeGridView 공통 스타일 계산
  const eventStyle = {
    backgroundColor: event.status === 'completed' ? '#6b7280ff' : (event.backgroundColor || '#1d4ed8ff'), // 완료 시 회색 배경 유지
    borderColor: event.borderColor || '#1e40af',
    borderWidth: '1px',
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* ref 추가 */}
        <div
          ref={itemRef} // ref 연결
          key={event.id}
          data-event-id={event.id} // 스크롤 타겟 식별을 위한 속성 추가
          // h-full 제거
          className={`rounded px-1 text-white text-[10px] sm:text-xs cursor-pointer ${viewType === 'month' ? 'mb-0.5' : 'absolute p-1 flex flex-col'}`}
          style={ viewType === 'month' ? eventStyle : { ...eventStyle, top: `${event.layout?.top}%`, height: `${event.layout?.height}%`, left: `${event.layout?.left}%`, width: `${event.layout?.width}%`, zIndex: event.layout?.zIndex } }
          title={`${format(parseISO(event.start), 'HH:mm')} - ${format(parseISO(event.end), 'HH:mm')} ${event.title}${event.type ? ` (${event.type})` : ''}${event.status === 'completed' ? ' (완료)' : ''}`}
        >
          {/* flex items-center 및 h-full 추가 */}
          <div className="flex items-center justify-between w-full h-full"> {/* 제목 영역 */}
            <div className={`flex items-center flex-grow overflow-hidden mr-1 ${event.status === 'completed' ? 'opacity-80' : ''}`}>
              {event.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0 text-green-400" />}
              {/* 예약 종류 표시 추가 */}
              <span className="truncate">{viewType === 'month' ? `${format(parseISO(event.start), 'HH:mm')} ` : ''}{event.title}{event.type ? ` - ${event.type}` : ''}</span>
            </div>
          </div>
          {/* 버튼 영역 제거 (PopoverContent로 이동) */}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background border shadow-md rounded-md" side="bottom" align="end"> {/* align="start" -> align="end" */}
        {renderPopoverButtons()}
      </PopoverContent>
    </Popover>
  );
};


// MonthView 컴포넌트 수정
interface MonthViewProps {
  date: Date;
  events: CalendarEvent[];
  highlightedEventId?: string | null; // 추가
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>; // 추가
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
}

const MonthView = ({ date, events, highlightedEventId, setHighlightedEventId, onStartPt, onEditPt, onEditAppointment, onToggleNoShow, onDeletePt }: MonthViewProps) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const startDate = startOfWeek(monthStart, { locale: ko });
  const endDate = endOfWeek(monthEnd, { locale: ko });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="border-t border-l">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day.toString()} className="py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 w-full">
        {days.map((day) => {
          const dayEvents = events.filter(event => isSameDay(parseISO(event.start), day)); // Parse event.start
          const isCurrentMonthView = isSameMonth(day, date);
          const today = new Date();
          const isToday = isSameDay(day, today);

          return (
            <div key={day.toString()} className={cn(
              "border-r border-b p-1 min-h-28 flex flex-col", // overflow-hidden 제거
              !isCurrentMonthView && "bg-muted/30 text-muted-foreground",
              isToday && "bg-blue-50"
            )}>
              <span className={cn("text-xs", isToday && "font-bold text-blue-600")}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5 overflow-y-auto text-xs flex-grow"> {/* overflow-y-auto 복원 */}
                {dayEvents
                  .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()) // Parse a.start and b.start
                  .map(event => (
                    <EventItem
                      key={event.id}
                      event={event}
                      viewType="month"
                      highlightedEventId={highlightedEventId} // prop 전달
                      setHighlightedEventId={setHighlightedEventId} // prop 전달
                      onStartPt={onStartPt}
                      onEditPt={onEditPt}
                      onEditAppointment={onEditAppointment}
                      onToggleNoShow={onToggleNoShow}
                      onDeletePt={onDeletePt}
                    />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TimeGridViewProps {
  viewType: 'week' | 'day';
  date: Date;
  events: CalendarEvent[];
  highlightedEventId?: string | null; // 추가
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>; // 추가
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
}

const TimeGridView = ({
  viewType,
  date,
  events,
  highlightedEventId, // 추가
  setHighlightedEventId, // 추가
  onStartPt,
  onEditPt,
  onEditAppointment,
  onToggleNoShow,
  onDeletePt
}: TimeGridViewProps): JSX.Element => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = useMemo(() => {
    if (viewType === 'week') {
      const weekStart = startOfWeek(date, { locale: ko });
      const weekEnd = endOfWeek(date, { locale: ko });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [date];
    }
  }, [date, viewType]);

  const renderEventsForHour = (day: Date, hour: number) => {
    const startOfCurrentDay = startOfDay(day); // Get the start of the day
    const hourStart = setMinutes(setHours(startOfCurrentDay, hour), 0); // Use startOfCurrentDay
    const hourEnd = setMinutes(setHours(startOfCurrentDay, hour + 1), 0); // Use startOfCurrentDay
    const eventsStartingInHour = events.filter(event => {
      const eventStart = parseISO(event.start); // Parse event.start
      // console.log(`[renderEventsForHour] Checking event ${event.id}: start=${event.start}, parsedStart=${eventStart}, hourStart=${hourStart}, hourEnd=${hourEnd}`); // 로그 제거
      return isSameDay(eventStart, day) &&
             eventStart >= hourStart && eventStart < hourEnd;
    });

    const eventLayouts: { [key: string]: { top: number; height: number; left: number; width: number; zIndex: number } } = {};
    const columns: CalendarEvent[][] = [];

    eventsStartingInHour.sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()); // Parse a.start and b.start

    eventsStartingInHour.forEach(event => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastEventInColumn = columns[i][columns[i].length - 1];
        if (event.start >= lastEventInColumn.end) {
          columns[i].push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([event]);
      }
    });

    const totalColumns = columns.length;
    columns.forEach((column, colIndex) => {
      column.forEach(event => {
        const eventStart = parseISO(event.start); // Parse event.start
        const eventEnd = parseISO(event.end);     // Parse event.end
        const startMinutes = getMinutes(eventStart);
        const durationMinutes = differenceInMinutes(eventEnd, eventStart);
        const topOffset = (startMinutes / 60) * 100;
        const height = Math.max(5, (durationMinutes / 60) * 100); // 최소 높이 원래대로 (5)
        const width = 100 / totalColumns;
        const leftOffset = colIndex * (100 / totalColumns);

        eventLayouts[event.id] = {
          top: topOffset,
          height: height,
          left: leftOffset,
          width: width,
          zIndex: 10 + colIndex,
        };
      });
    });

    return eventsStartingInHour.map(event => {
      const layout = eventLayouts[event.id];
      if (!layout) return null;

      // EventItem 컴포넌트 사용
      return (
        <EventItem
          key={event.id}
          event={{...event, layout}} // layout 정보 추가
          viewType={viewType}
          highlightedEventId={highlightedEventId} // prop 전달
          setHighlightedEventId={setHighlightedEventId} // prop 전달
          onStartPt={onStartPt}
          onEditPt={onEditPt}
          onEditAppointment={onEditAppointment}
          onToggleNoShow={onToggleNoShow}
          onDeletePt={onDeletePt}
        />
       );
     });
   };

   return (
     <div className="flex border-t">
       <div className="w-14 text-xs text-center text-muted-foreground sticky left-0 bg-background z-20">
         {viewType === 'week' && (
           <div className="text-center text-sm font-medium py-1 border-b invisible">
             <div>&nbsp;</div>
             <div>&nbsp;</div>
           </div>
         )}
         {hours.map(hour => (
           <div key={`label-${hour}`} className="h-9 border-b flex items-center justify-center">
             {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
           </div>
         ))}
       </div>
       <div className={`grid ${viewType === 'week' ? 'grid-cols-7' : 'grid-cols-1'} flex-grow w-full`}>
         {days.map(day => (
           <div key={day.toString()} className="border-l relative">
             {viewType === 'week' && (
               <div className="text-center text-sm font-medium py-1 border-b sticky top-0 bg-background z-20">
                 <div>{format(day, 'd', { locale: ko })}</div>
                 <div>{format(day, 'eee', { locale: ko })}</div>
               </div>
             )}
             {hours.map(hour => (
               <div key={`slot-${day.toISOString()}-${hour}`} className="h-9 border-b relative">
                 {renderEventsForHour(day, hour)}
               </div>
             ))}
           </div>
         ))}
       </div>
     </div>
   );
 };


 export function ScheduleCalendar({
   currentView,
   currentDate,
   events,
   isLoading,
   refetchTrigger,
   highlightedEventId, // prop 받기
   setHighlightedEventId, // prop 받기
   onStartPt,
   onEditPt,
   onEditAppointment,
   onToggleNoShow,
   onDeletePt
 }: ScheduleCalendarProps): JSX.Element {

   const renderCalendarView = () => {
     if (currentView === 'month') {
       // MonthView/TimeGridView에 highlightedEventId, setHighlightedEventId 전달
       return <MonthView date={currentDate} events={events} highlightedEventId={highlightedEventId} setHighlightedEventId={setHighlightedEventId} onStartPt={onStartPt} onEditPt={onEditPt} onEditAppointment={onEditAppointment} onToggleNoShow={onToggleNoShow} onDeletePt={onDeletePt} />;
     } else {
       return <TimeGridView viewType={currentView} date={currentDate} events={events} highlightedEventId={highlightedEventId} setHighlightedEventId={setHighlightedEventId} onStartPt={onStartPt} onEditPt={onEditPt} onEditAppointment={onEditAppointment} onToggleNoShow={onToggleNoShow} onDeletePt={onDeletePt} />;
     }
   };

   return (
     <div className="relative p-0 h-full">
       {isLoading && (
         <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
           )}
           {renderCalendarView()}
         </div>
   );
 };
