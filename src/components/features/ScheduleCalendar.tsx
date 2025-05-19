import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, Play, Edit, UserX, Undo2, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMembers } from '@/hooks/use-members';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, isSameMonth, getHours, getMinutes, differenceInMinutes, setHours, setMinutes, parseISO, startOfDay, addMinutes, endOfDay, subMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import React from "react"; 

export type PTSession = Database['public']['Tables']['pt_sessions']['Row'];

export interface CalendarEvent {
  id: string;
  workoutSessionId?: string | null;
  title: string;
  start: string;
  end: string;
  status: string;
  notes: string | null;
  memberId: string;
  type?: string | null;
  backgroundColor?: string | null;
  borderColor?: string;
  textColor?: string;
  layout?: {
    top: number; 
    height: number; 
    left: number; 
    width: number; 
    zIndex: number;
    columnIndex?: number;
  };
}

interface ScheduleCalendarProps {
  currentView: 'day' | 'week' | 'month';
  currentDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  refetchTrigger?: number;
  highlightedEventId?: string | null;
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>;
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date, columnIndex?: number) => void; // columnIndex 추가
}

interface EventItemProps {
  event: CalendarEvent;
  viewType: 'day' | 'week' | 'month';
  highlightedEventId?: string | null;
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>;
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
}

const EventItem: React.FC<EventItemProps> = ({
  event,
  viewType,
  highlightedEventId,
  setHighlightedEventId,
  onStartPt,
  onEditPt,
  onEditAppointment,
  onToggleNoShow,
  onDeletePt,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (highlightedEventId && event.id === highlightedEventId && itemRef.current && setHighlightedEventId) {
      const element = itemRef.current;
      element.scrollIntoView({ block: 'center' });
      element.classList.add('highlight-blink');
      const blinkTimer = setTimeout(() => {
        if (itemRef.current) {
          itemRef.current.classList.remove('highlight-blink');
        }
        setHighlightedEventId(null);
      }, 1500);
      return () => clearTimeout(blinkTimer);
    }
  }, [highlightedEventId, event.id, setHighlightedEventId]);

  const renderDialogButtons = () => (
    <TooltipProvider delayDuration={100}>
      <div className="grid grid-cols-2 gap-3 w-full">
        {event.status === 'scheduled' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full h-12 flex items-center justify-center text-base text-green-700 border-green-500 hover:bg-green-100 hover:border-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); onStartPt(event); setIsDetailModalOpen(false); }}>
                  <Play className="mr-2 h-6 w-6" /> PT 시작
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>PT 시작</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full h-12 flex items-center justify-center text-base hover:bg-slate-100 hover:text-slate-900" onClick={(e) => { e.stopPropagation(); onEditAppointment(event); setIsDetailModalOpen(false); }}>
                  <Pencil className="mr-2 h-6 w-6" /> 예약 수정
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>예약 수정</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="w-full h-12 flex items-center justify-center text-base text-red-700 border-red-500 hover:bg-red-100 hover:border-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onToggleNoShow(event); setIsDetailModalOpen(false); }}>
                  <UserX className="mr-2 h-6 w-6" /> 노쇼 처리
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
                <Button variant="outline" className="w-full h-12 flex items-center justify-center text-base hover:bg-slate-100 hover:text-slate-900" onClick={(e) => { e.stopPropagation(); onEditPt(event); setIsDetailModalOpen(false); }}>
                  <Edit className="mr-2 h-6 w-6" /> 기록 수정
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>기록 수정</p></TooltipContent>
            </Tooltip>
            <Button variant="outline" disabled className="w-full h-12 flex items-center justify-center text-base opacity-50 cursor-not-allowed">
              <Pencil className="mr-2 h-6 w-6" /> 예약 수정 불가
            </Button>
            <Button variant="outline" disabled className="w-full h-12 flex items-center justify-center text-base opacity-50 cursor-not-allowed">
              <UserX className="mr-2 h-6 w-6" /> 노쇼 처리 불가
            </Button>
          </>
        )}
        {event.status === 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" className="w-full h-12 flex items-center justify-center text-base text-yellow-700 border-yellow-500 hover:bg-yellow-100 hover:border-yellow-600 hover:text-yellow-700" onClick={(e) => { e.stopPropagation(); onToggleNoShow(event); setIsDetailModalOpen(false); }}>
                <Undo2 className="mr-2 h-6 w-6" /> 노쇼 해제
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>노쇼 해제</p></TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="destructive" className="w-full h-12 flex items-center justify-center text-base" onClick={(e) => { e.stopPropagation(); onDeletePt(event); setIsDetailModalOpen(false); }}>
              <Trash2 className="mr-2 h-6 w-6" /> 예약 삭제
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>예약 삭제</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  let titleTextColor: string = "text-black dark:text-white";
  let barColor = "bg-slate-500 dark:bg-slate-400";
  let statusText = event.type === 'PT' ? 'PT' : event.type || '기타';
  let statusTextColor: string = titleTextColor;

  if (event.status === 'completed') {
    barColor = "bg-green-500 dark:bg-green-600";
    statusText += " (완료)";
  } else if (event.status === 'cancelled') {
    barColor = "bg-red-500 dark:bg-red-600";
    statusText += " (취소)";
  } else if (event.status === 'scheduled') {
    barColor = "bg-blue-500 dark:bg-blue-600";
    if (event.type === '상담') {
      barColor = "bg-yellow-400 dark:bg-yellow-500";
    } else if (event.type === '측정') {
      barColor = "bg-orange-500 dark:bg-orange-600";
    }
  }

  const eventItemStyle: React.CSSProperties = {
    borderWidth: '1px',
    color: event.textColor || undefined,
  };

  const dynamicStyle: React.CSSProperties =
    viewType === 'month' || !event.layout
      ? { ...eventItemStyle }
      : {
          ...eventItemStyle,
          position: 'absolute',
          top: `${event.layout.top}px`,
          height: `${event.layout.height}px`,
          left: `${event.layout.left}%`,
          width: viewType === 'day' ? `${DAY_VIEW_EVENT_WIDTH_PERCENTAGE}%` : `${event.layout.width}%`, // Day view일 때 너비 강제 설정
          zIndex: event.layout.zIndex,
        };


  return (
    <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
      <DialogTrigger asChild>
        <div
          ref={itemRef}
          key={event.id}
          data-event-id={event.id}
          draggable={viewType !== 'month'} // 월간 뷰에서는 드래그 비활성화
          onDragStart={(e) => {
            if (viewType === 'month') return;
            const durationMinutes = differenceInMinutes(parseISO(event.end), parseISO(event.start));
            e.dataTransfer.setData("application/json", JSON.stringify({
              id: event.id,
              durationMinutes,
              originalStart: event.start // 드래그 시작 시 원래 시간도 전달 (옵션)
            }));
            e.dataTransfer.effectAllowed = "move";
          }}
          className={cn(
            "rounded cursor-grab flex overflow-hidden border-black dark:border-white",
            // viewType === 'month' 조건은 dynamicStyle에서 position으로 처리하므로 여기서는 제거 가능,
            // 또는 month view일 때만 특정 스타일을 유지하고 싶다면 남겨둘 수 있음.
            // day/week view에서는 absolute positioning을 사용하므로, width는 dynamicStyle에서 제어.
            viewType === 'month' ? "relative mb-0.5 shadow-sm" : "absolute shadow-md",
            highlightedEventId === event.id && "ring-2 ring-offset-2 ring-primary"
          )}
          style={dynamicStyle} // dynamicStyle에서 width를 %로 설정하므로, className에서 w-full 등의 클래스 제거 확인
          onClick={() => setIsDetailModalOpen(true)}
          title={`${format(parseISO(event.start), 'HH:mm')} - ${format(parseISO(event.end), 'HH:mm')} ${event.title}${event.type ? ` (${event.type})` : ''}${event.status === 'completed' ? ' (완료)' : ''}`}
        >
          <div
            className={cn(
              viewType === 'month' ? 'w-1.5 absolute top-0 left-0 bottom-0' : 'w-1.5 flex-shrink-0',
              "h-full z-20",
              barColor
            )}
          ></div>
          <div
            className={cn(
              "flex-grow p-1 overflow-hidden",
              viewType === 'month' ? 'ml-1.5' : '',
              titleTextColor
            )}
          >
            <div className={cn("flex items-center justify-between w-full h-full", viewType === 'day' && "flex-row items-center justify-between")}>
              {viewType === 'month' ? (
                <>
                  <span className={cn("text-sm", event.status === 'completed' && "opacity-70", titleTextColor)}>
                    {format(parseISO(event.start), 'HH:mm')}
                  </span>
                  <span className={cn("truncate text-sm ml-1", event.status === 'completed' && "opacity-70", titleTextColor)}>
                    {event.title}
                  </span>
                </>
              ) : viewType === 'day' ? (
                 <div className="flex items-center justify-between h-full w-full leading-tight">
                  <span className={cn("truncate text-xs", event.status === 'completed' && "opacity-70", titleTextColor)} >
                    {event.title}
                  </span>
                  {statusText &&
                    <span className={cn("text-xs font-medium whitespace-nowrap ml-1", statusTextColor, event.status === 'completed' && "opacity-70")} >
                      {statusText}
                    </span>
                  }
                </div>
              ) : ( // week view
                <>
                  <span className={cn("truncate text-sm", event.status === 'completed' && "opacity-70", titleTextColor)}>
                    {event.title}
                  </span>
                  {statusText &&
                    <span className={cn("ml-1 text-xs font-medium whitespace-nowrap", statusTextColor, event.status === 'completed' && "opacity-70")}>
                      {statusText}
                    </span>
                  }
                </>
              )}
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{event.title} - {event.type || '일정'}</DialogTitle>
          <DialogDescription className="text-base">
            {format(parseISO(event.start), 'yyyy년 M월 d일 HH:mm', { locale: ko })} - {format(parseISO(event.end), 'HH:mm', { locale: ko })}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {event.notes && (
            <div className="mb-3">
              <h4 className="text-base font-semibold mb-1">메모:</h4>
              <p className="text-base text-muted-foreground whitespace-pre-wrap bg-muted p-2 rounded-md">{event.notes}</p>
            </div>
          )}
           <div className="text-base">
             <p><span className="font-semibold">상태:</span> {event.status === 'completed' ? '완료' : event.status === 'cancelled' ? '취소됨' : '예약됨'}</p>
           </div>
        </div>
        <DialogFooter className="pt-4">
          {renderDialogButtons()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface MonthViewProps {
  date: Date;
  events: CalendarEvent[];
  highlightedEventId?: string | null;
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>;
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
  const daysArr = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="border-t border-l">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day.toString()} className="py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 w-full">
        {daysArr.map((day) => {
          const dayEvents = events.filter(event => isSameDay(parseISO(event.start), day));
          const isCurrentMonthView = isSameMonth(day, date);
          const today = new Date();
          const isToday = isSameDay(day, today);

          return (
            <div key={day.toString()} className={cn(
              "border-r border-b p-1 min-h-28 flex flex-col",
              !isCurrentMonthView && "bg-muted/30 text-muted-foreground"
            )}>
              <span className={cn("text-xs", isToday && "font-bold text-blue-600")}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5 overflow-y-auto text-xs flex-grow">
                {dayEvents
                  .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
                  .map(event => (
                    <EventItem
                      key={event.id}
                      event={event}
                      viewType="month"
                      highlightedEventId={highlightedEventId}
                      setHighlightedEventId={setHighlightedEventId}
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
  highlightedEventId?: string | null;
  setHighlightedEventId?: React.Dispatch<React.SetStateAction<string | null>>;
  onStartPt: (event: CalendarEvent) => void;
  onEditPt: (event: CalendarEvent) => void;
  onEditAppointment: (event: CalendarEvent) => void;
  onToggleNoShow: (event: CalendarEvent) => void;
  onDeletePt: (event: CalendarEvent) => void;
  openMoreEventsModal: (events: CalendarEvent[], title: string) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date, columnIndex?: number) => void; // columnIndex 추가
}

const HOUR_SLOT_HEIGHT_PX = 96;
const MIN_EVENT_HEIGHT_PX = 20; 
const MIN_EVENT_HEIGHT_PX_DAY = 18;
const EVENT_GAP_PX = 2;
const EVENT_GAP_PX_X = 1; 
const EVENT_WIDTH_PERCENTAGE = 85; // 너비 추가 조정
const EVENT_LEFT_PERCENTAGE = 0;
const MAX_EVENTS_PER_ROW_DAY = 2; // 한 줄에 표시될 최대 이벤트 수 (Day View 가로 칸 수)
const DAY_VIEW_EVENT_WIDTH_PERCENTAGE = 49; // Day View에서 각 이벤트의 너비
const DAY_VIEW_EVENT_LEFT_MARGIN_PERCENTAGE = 1; // Day View 이벤트 왼쪽 마진
const EVENT_WIDTH_PERCENTAGE_DAY = Math.floor((100 - (EVENT_LEFT_PERCENTAGE * 2) - (EVENT_GAP_PX_X * (MAX_EVENTS_PER_ROW_DAY -1 ))) / MAX_EVENTS_PER_ROW_DAY) ;


const TimeGridView = (props: TimeGridViewProps): JSX.Element => {
  const {
    viewType,
    date,
    events,
    highlightedEventId,
    setHighlightedEventId,
    onStartPt,
    onEditPt,
    onEditAppointment,
    onToggleNoShow,
    onDeletePt,
    openMoreEventsModal,
    onEventDrop, // Added from props
  } = props;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [hourSlotHeights, setHourSlotHeights] = useState<Record<number, number>>({});
  const [draggedOverInfo, setDraggedOverInfo] = useState<{ day: Date; hour: number; minute: number; columnIndex?: number } | null>(null);

  const days = useMemo(() => {
    if (viewType === 'week') {
      const weekStart = startOfWeek(date, { locale: ko });
      const weekEnd = endOfWeek(date, { locale: ko });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [date];
    }
  }, [date, viewType]);

  useEffect(() => {
    const calculateNewSlotHeights = () => {
      const newSlotHeights: Record<number, number> = {};
      hours.forEach(hour => {
        let maxHourHeight = HOUR_SLOT_HEIGHT_PX;
        days.forEach(day => {
          const hourStart = setMinutes(setHours(startOfDay(day), hour), 0);
          const hourEnd = setMinutes(setHours(startOfDay(day), hour + 1), 0);
          const relevantEvents = events.filter(event => {
            const eventStart = parseISO(event.start);
            const eventEnd = parseISO(event.end);
            return isSameDay(eventStart, day) && eventStart < hourEnd && eventEnd > hourStart;
          });

          if (relevantEvents.length > 0) {
          let currentDayHourHeight = 0;
          if (viewType === 'day') {
            let accumulatedPixelWidth = EVENT_LEFT_PERCENTAGE;
            let currentRowEventMaxHeight = 0; 
            let currentRowTotalHeight = 0;    

            relevantEvents.forEach((event, index) => {
              const eventStartObj = parseISO(event.start);
              const eventEndObj = parseISO(event.end);
              let effectiveStart = eventStartObj < hourStart ? hourStart : eventStartObj;
              let effectiveEnd = eventEndObj > hourEnd ? hourEnd : eventEndObj;
              const durationMinutes = differenceInMinutes(effectiveEnd, effectiveStart);
              let eventHeight = (durationMinutes / 60) * HOUR_SLOT_HEIGHT_PX;
              eventHeight = Math.max(MIN_EVENT_HEIGHT_PX_DAY, eventHeight);

              currentRowEventMaxHeight = Math.max(currentRowEventMaxHeight, eventHeight);

              const eventWidth = EVENT_WIDTH_PERCENTAGE_DAY;
              if (index > 0 && (accumulatedPixelWidth + eventWidth + EVENT_GAP_PX_X) > (100 - EVENT_LEFT_PERCENTAGE)) { 
                currentRowTotalHeight += currentRowEventMaxHeight + EVENT_GAP_PX; 
                accumulatedPixelWidth = EVENT_LEFT_PERCENTAGE; 
                currentRowEventMaxHeight = eventHeight; 
              }
              accumulatedPixelWidth += eventWidth + EVENT_GAP_PX_X;
            });
            currentDayHourHeight = currentRowTotalHeight + currentRowEventMaxHeight + EVENT_GAP_PX; 
            maxHourHeight = Math.max(maxHourHeight, currentDayHourHeight);

          } else { // week view
            relevantEvents.forEach(event => {
              const eventStartObj = parseISO(event.start);
              const eventEndObj = parseISO(event.end);
              let start = eventStartObj < hourStart ? hourStart : eventStartObj;
              let end = eventEndObj > hourEnd ? hourEnd : eventEndObj;
              const durationMinutes = differenceInMinutes(end, start);
              let eventHeight = (durationMinutes / 60) * HOUR_SLOT_HEIGHT_PX; 
              eventHeight = Math.max(MIN_EVENT_HEIGHT_PX, eventHeight);
              currentDayHourHeight += eventHeight + EVENT_GAP_PX;
            });
            maxHourHeight = Math.max(maxHourHeight, currentDayHourHeight > 0 ? currentDayHourHeight - EVENT_GAP_PX : 0);
          }
        }
      });
      newSlotHeights[hour] = Math.max(HOUR_SLOT_HEIGHT_PX, maxHourHeight);
      });
      return newSlotHeights;
    };
    
    const newHeights = calculateNewSlotHeights();
    if (JSON.stringify(newHeights) !== JSON.stringify(hourSlotHeights)) {
      setHourSlotHeights(newHeights);
    }
  }, [events, days, viewType, hours, hourSlotHeights]);


  const renderEventsForHour = (day: Date, hour: number, slotHeight: number) => {
    const startOfCurrentDay = startOfDay(day);
    const hourStart = setMinutes(setHours(startOfCurrentDay, hour), 0);
    const hourEnd = setMinutes(setHours(startOfCurrentDay, hour + 1), 0);

    const relevantEventsForSlot = events.filter(event => {
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);
      return isSameDay(eventStart, day) && eventStart < hourEnd && eventEnd > hourStart;
    });

    const sortedEvents = relevantEventsForSlot.sort((a, b) => {
      const startA = parseISO(a.start).getTime();
      const startB = parseISO(b.start).getTime();
      if (startA !== startB) {
        return startA - startB;
      }
      return differenceInMinutes(parseISO(b.end), parseISO(b.start)) - differenceInMinutes(parseISO(a.end), parseISO(a.start));
    });

    const eventsToDisplay = sortedEvents;
    const eventLayouts: { [key: string]: CalendarEvent['layout'] } = {};

    if (eventsToDisplay.length > 0) {
      if (viewType === 'day') {
        // Day view: 이벤트들을 4개의 가로 칸에 배치하는 로직
        const columnAssignments: { [eventId: string]: number } = {};
        const occupiedColumns: boolean[][] = Array(60).fill(null).map(() => Array(MAX_EVENTS_PER_ROW_DAY).fill(false)); // 1분 단위로 각 칸의 점유 상태 기록

        eventsToDisplay.forEach((event) => {
          const eventStartObj = parseISO(event.start);
          const eventEndObj = parseISO(event.end);

          const startMinuteInHour = Math.max(0, differenceInMinutes(eventStartObj, hourStart));
          const endMinuteInHour = Math.min(60, differenceInMinutes(eventEndObj, hourStart));

          let assignedColumn = -1;
          const preferredColumn = (event.layout as { columnIndex?: number })?.columnIndex;

          // 드롭된 이벤트의 경우 지정된 칸에 강제 할당
          if (preferredColumn !== undefined && preferredColumn >= 0 && preferredColumn < MAX_EVENTS_PER_ROW_DAY) {
            assignedColumn = preferredColumn;
          } else {
            // 빈 칸 찾기
            for (let col = 0; col < MAX_EVENTS_PER_ROW_DAY; col++) {
              if (!occupiedColumns[startMinuteInHour]?.[col]) {
                assignedColumn = col;
                break;
              }
            }
            // 모든 칸이 차있으면 첫 번째 칸에 배치
            if (assignedColumn === -1) {
              assignedColumn = 0;
            }
          }

          // 점유 상태 업데이트
          for (let m = startMinuteInHour; m < endMinuteInHour; m++) {
            if (!occupiedColumns[m]) {
              occupiedColumns[m] = Array(MAX_EVENTS_PER_ROW_DAY).fill(false);
            }
            occupiedColumns[m][assignedColumn] = true;
          }

          columnAssignments[event.id] = assignedColumn;
          // 점유 상태 업데이트: assignedColumn이 유효한 경우에만 점유 처리
          if (assignedColumn >= 0 && assignedColumn < MAX_EVENTS_PER_ROW_DAY) {
            for (let m = startMinuteInHour; m < endMinuteInHour; m++) {
              if (!occupiedColumns[m]) {
                occupiedColumns[m] = Array(MAX_EVENTS_PER_ROW_DAY).fill(false);
              }
              occupiedColumns[m][assignedColumn] = true;
            }
          }
        });

        eventsToDisplay.forEach((event) => {
          const eventStartObj = parseISO(event.start);
          const eventEndObj = parseISO(event.end);
          let effectiveStart = eventStartObj < hourStart ? hourStart : eventStartObj;
          let effectiveEnd = eventEndObj > hourEnd ? hourEnd : eventEndObj;

          const top = (differenceInMinutes(effectiveStart, hourStart) / 60) * slotHeight;
          const height = Math.max(MIN_EVENT_HEIGHT_PX_DAY, (differenceInMinutes(effectiveEnd, effectiveStart) / 60) * slotHeight - EVENT_GAP_PX);

          const eventColumnIndex = columnAssignments[event.id] !== undefined ? columnAssignments[event.id] : 0;

          const currentEventWidth = DAY_VIEW_EVENT_WIDTH_PERCENTAGE; // 명확하게 DAY_VIEW_EVENT_WIDTH_PERCENTAGE 사용
          const left = DAY_VIEW_EVENT_LEFT_MARGIN_PERCENTAGE + (eventColumnIndex * (currentEventWidth + EVENT_GAP_PX_X));
          const zIndex = 10 + eventColumnIndex;

          eventLayouts[event.id] = {
            top,
            height,
            left,
            width: currentEventWidth, // EventItem에 전달될 너비
            zIndex,
            columnIndex: eventColumnIndex,
          };
        });

      } else { // week view
        // Week view: 기존 로직 유지
        eventsToDisplay.forEach((event, index) => {
            const eventStartObj = parseISO(event.start);
            const eventEndObj = parseISO(event.end);

            let effectiveStart = eventStartObj < hourStart ? hourStart : eventStartObj;
            let effectiveEnd = eventEndObj > hourEnd ? hourEnd : eventEndObj;

            const topOffsetWithinHour = (differenceInMinutes(effectiveStart, hourStart) / 60) * slotHeight;
            let heightInPx = (differenceInMinutes(effectiveEnd, effectiveStart) / 60) * slotHeight;
            heightInPx = Math.max(MIN_EVENT_HEIGHT_PX, heightInPx - EVENT_GAP_PX);

            eventLayouts[event.id] = {
                top: topOffsetWithinHour,
                height: heightInPx,
                left: EVENT_LEFT_PERCENTAGE,
                width: EVENT_WIDTH_PERCENTAGE,
                zIndex: 10 + index,
            };
        });
      }
    }

    const renderedEventItems = eventsToDisplay.map(event => {
      const finalLayout = eventLayouts[event.id];
                  if (!finalLayout) return null;

                  // 이벤트의 기존 columnIndex를 우선 사용
                  const columnIndex = event.layout?.columnIndex !== undefined ? event.layout.columnIndex : finalLayout.columnIndex;
                  const left = DAY_VIEW_EVENT_LEFT_MARGIN_PERCENTAGE + (columnIndex * (DAY_VIEW_EVENT_WIDTH_PERCENTAGE + EVENT_GAP_PX_X));

                  // console.log('Event layout:', event.id, { columnIndex, left, finalLayout });

                  return (
                    <EventItem
                      key={event.id}
                      event={{
                        ...event,
                        layout: {
                          ...finalLayout,
                          left,
                          columnIndex // columnIndex 정보 유지
                        }
                      }}
                      viewType={viewType}
                      highlightedEventId={highlightedEventId}
                      setHighlightedEventId={setHighlightedEventId}
                      onStartPt={onStartPt}
                      onEditPt={onEditPt}
                      onEditAppointment={onEditAppointment}
                      onToggleNoShow={onToggleNoShow}
                      onDeletePt={onDeletePt}
                    />
                  );
    }).filter(Boolean);

    return renderedEventItems;
  };

  return (
    <div className="flex border-t">
      <div className="w-12 text-center text-xs font-medium text-muted-foreground sticky left-0 bg-background z-30 shrink-0">
        {viewType === 'week' && (
          <div className="h-[60px] border-b border-r invisible"></div>
        )}
        {hours.map(hour => (
          <div 
            key={`time-label-${hour}`} 
            className="border-b border-r flex items-center justify-center"
            style={{ height: `${hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX}px` }}
          >
            {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
          </div>
        ))}
      </div>

      <div className="flex-grow overflow-x-auto">
        <div className={`grid ${viewType === 'week' ? 'grid-cols-7' : 'grid-cols-1'} min-w-full`}>
          {days.map(day => (
            <div key={day.toISOString()} className="border-l relative min-w-[120px] box-border day-column-container"> {/* Added day-column-container for drop calculation */}
              {viewType === 'week' && (
                <div className="text-center text-sm font-medium py-1 border-b sticky top-0 bg-background z-20 h-[60px] flex flex-col justify-center">
                  <div>{format(day, 'd', { locale: ko })}</div>
                  <div>{format(day, 'eee', { locale: ko })}</div>
                </div>
              )}
              <div className="relative h-full"> {/* Ensure this container takes full height for absolute positioning of events */}
                {/* Render hour slots for visual lines and drop zones */}
                {hours.map(hour => (
                  <div
                    key={`slot-${day.toISOString()}-${hour}`}
                    data-slot-key={`${day.toISOString()}-${hour}`}
                    data-hour={hour}
                    className={cn(
                      "relative border-b",
                      hour === hours.length - 1 && "border-b-0",
                      "day-view-hour-slot flex" // flex로 변경하여 가로 정렬
                    )}
                    style={{ height: `${hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX}px` }}
                  >
                    {/* 가로 4칸으로 나누기 (day view에만 적용) */}
                    {viewType === 'day' ? (
                      Array.from({ length: 2 }).map((_, colIndex) => (
                        <div
                          key={`day-col-${hour}-${colIndex}`}
                          className={cn(
                            "flex-1 flex flex-col", // 각 칸이 세로로 10분 슬롯을 가짐
                            colIndex < 3 && "border-r border-gray-300 dark:border-gray-600" // 마지막 칸 제외하고 오른쪽에 구분선
                          )}
                        >
                          {/* 각 칸 내부에 10분 단위 슬롯 렌더링 */}
                          {Array.from({ length: 6 }).map((_, minuteIndex) => {
                            const minute = minuteIndex * 10;
                            return (
                              <div
                                key={`minute-slot-${day.toISOString()}-${hour}-${colIndex}-${minute}`}
                                data-minute={minute}
                                data-col={colIndex}
                                className={cn(
                                  "flex-1 border-b border-dashed border-gray-200 dark:border-gray-700 last:border-b-0",
                                  draggedOverInfo &&
                                  isSameDay(draggedOverInfo.day, day) &&
                                  draggedOverInfo.hour === hour &&
                                  draggedOverInfo.minute === minute &&
                                  draggedOverInfo.columnIndex === colIndex && // columnIndex 일치 확인
                                  "bg-green-100 dark:bg-green-700 opacity-75"
                                )}
                                style={{ minHeight: `${(hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX) / 6}px` }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDraggedOverInfo({ day, hour, minute: minute, columnIndex: colIndex });
                                  e.dataTransfer.dropEffect = "move";
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDraggedOverInfo(null);
                                  const eventDataString = e.dataTransfer.getData("application/json");
                                  if (!eventDataString) return;
                                  try {
                                    const eventData = JSON.parse(eventDataString);
                                    const eventId = eventData.id;
                                    const durationMinutes = eventData.durationMinutes;
                                    if (typeof eventId !== 'string' || typeof durationMinutes !== 'number') return;

                                    // 드롭된 시간과 칼럼 인덱스 처리
                                    let newStart = setMinutes(setHours(startOfDay(day), hour), minute);
                                    let newEnd = addMinutes(newStart, durationMinutes);
                                    
                                    // console.log('Drop event:', { eventId, colIndex, newStart, newEnd });
                                    const endOfDropDay = endOfDay(day);
                                    if (newEnd > endOfDropDay) {
                                        newEnd = endOfDropDay;
                                        if (newStart >= newEnd) {
                                           newStart = subMinutes(newEnd, Math.max(10, durationMinutes));
                                           if (newStart < startOfDay(day)) newStart = startOfDay(day);
                                        }
                                    }
                                    // onEventDrop에 columnIndex 전달
                                    onEventDrop(eventId, newStart, newEnd, colIndex);
                                  } catch (error) { console.error("Drop error:", error); }
                                }}
                                onDragLeave={() => setDraggedOverInfo(null) }
                              />
                            );
                          })}
                        </div>
                      ))
                    ) : (
                      // Week view: 기존 10분 단위 슬롯 렌더링 (가로 구분 없음)
                      // Week view에서는 columnIndex가 없으므로 draggedOverInfo 설정 시 주의
                      Array.from({ length: 6 }).map((_, minuteIndex) => {
                        const minute = minuteIndex * 10;
                        return (
                          <div
                            key={`minute-slot-week-${day.toISOString()}-${hour}-${minute}`}
                            data-minute={minute}
                            className={cn(
                              "flex-1 border-b border-dashed border-gray-200 dark:border-gray-700 last:border-b-0",
                              draggedOverInfo &&
                              isSameDay(draggedOverInfo.day, day) &&
                              draggedOverInfo.hour === hour &&
                              draggedOverInfo.minute === minute &&
                              draggedOverInfo.columnIndex === undefined && // week view에서는 columnIndex가 없음
                              "bg-green-100 dark:bg-green-700 opacity-75"
                            )}
                            style={{ minHeight: `${(hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX) / 6}px` }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDraggedOverInfo({ day, hour, minute: minute }); // columnIndex 없이 설정
                              e.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDraggedOverInfo(null);
                              const eventDataString = e.dataTransfer.getData("application/json");
                              if (!eventDataString) return;
                              try {
                                const eventData = JSON.parse(eventDataString);
                                const eventId = eventData.id;
                                const durationMinutes = eventData.durationMinutes;
                                if (typeof eventId !== 'string' || typeof durationMinutes !== 'number') return;
                                let newStart = setMinutes(setHours(startOfDay(day), hour), minute);
                                let newEnd = addMinutes(newStart, durationMinutes);
                                const endOfDropDay = endOfDay(day);
                                if (newEnd > endOfDropDay) {
                                    newEnd = endOfDropDay;
                                    if (newStart >= newEnd) {
                                       newStart = subMinutes(newEnd, Math.max(10, durationMinutes));
                                       if (newStart < startOfDay(day)) newStart = startOfDay(day);
                                    }
                                }
                                onEventDrop(eventId, newStart, newEnd); // Week view에서는 columnIndex 불필요
                              } catch (error) { console.error("Drop error:", error); }
                            }}
                            onDragLeave={() => setDraggedOverInfo(null)}
                          />
                        );
                      })
                    )}
                  </div>
                ))}
                {/* Render all events for the current day directly into the day column */}
                {events
                  .filter(event => isSameDay(parseISO(event.start), day))
                  .map(event => {
                    const eventStart = parseISO(event.start);
                    const eventEnd = parseISO(event.end);

                    const startMinutesInDay = getHours(eventStart) * 60 + getMinutes(eventStart);

                    // Calculate top position based on dynamic slot heights up to the event's start hour
                    let topOffsetPx = 0;
                    for(let h=0; h < getHours(eventStart); h++) {
                        topOffsetPx += (hourSlotHeights[h] || HOUR_SLOT_HEIGHT_PX);
                    }
                    // Add offset for minutes within the start hour
                    topOffsetPx += (getMinutes(eventStart) / 60) * (hourSlotHeights[getHours(eventStart)] || HOUR_SLOT_HEIGHT_PX);

                    const duration = differenceInMinutes(eventEnd, eventStart);
                    let eventHeightPx = 0;
                    let currentHour = getHours(eventStart);
                    let minutesProcessed = 0;

                    while(minutesProcessed < duration && currentHour < 24) {
                        const minutesInCurrentHourSlot = Math.min(60 - (currentHour === getHours(eventStart) ? getMinutes(eventStart) : 0), duration - minutesProcessed);
                        eventHeightPx += (minutesInCurrentHourSlot / 60) * (hourSlotHeights[currentHour] || HOUR_SLOT_HEIGHT_PX);
                        minutesProcessed += minutesInCurrentHourSlot;
                        currentHour++;
                    }
                     eventHeightPx = Math.max(viewType === 'day' ? MIN_EVENT_HEIGHT_PX_DAY : MIN_EVENT_HEIGHT_PX, eventHeightPx);


                    return (
                      <EventItem
                        key={event.id}
                        event={{
                          ...event,
                          layout: {
                            top: topOffsetPx,
                            height: eventHeightPx,
                            left: EVENT_LEFT_PERCENTAGE,
                            width: EVENT_WIDTH_PERCENTAGE,
                            zIndex: 10,
                          },
                        }}
                        viewType={viewType}
                        highlightedEventId={highlightedEventId}
                        setHighlightedEventId={setHighlightedEventId}
                        onStartPt={onStartPt}
                        onEditPt={onEditPt}
                        onEditAppointment={onEditAppointment}
                        onToggleNoShow={onToggleNoShow}
                        onDeletePt={onDeletePt}
                        // onEventDrop is handled by the parent slot
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export function ScheduleCalendar(props: ScheduleCalendarProps): JSX.Element {
  const { toast } = useToast();
  const [isMoreEventsModalOpen, setIsMoreEventsModalOpen] = useState(false);
  const [moreEventsToShow, setMoreEventsToShow] = useState<CalendarEvent[]>([]);
  const [moreEventsModalTitle, setMoreEventsModalTitle] = useState("");

  const openMoreEventsModal = (events: CalendarEvent[], title: string) => {
    setMoreEventsToShow(events);
    setMoreEventsModalTitle(title);
    setIsMoreEventsModalOpen(true);
  };

  const handleEventDrop = async (eventId: string, newStart: Date, newEnd: Date, columnIndex?: number) => {
    console.log(`Event ${eventId} dropped. New start: ${newStart}, New end: ${newEnd}, ColumnIndex: ${columnIndex}`);
    // Optimistically update UI or call parent to update and refetch
    // This function will be passed to TimeGridView and called on drop

    const eventToUpdate = props.events.find(event => event.id === eventId);
    if (!eventToUpdate) {
      toast({ title: "오류", description: "업데이트할 이벤트를 찾지 못했습니다.", variant: "destructive" });
      return;
    }

    // Call the prop function to notify the parent about the drop.
    // The parent component is responsible for updating the events list and persisting changes.
    // Pass columnIndex to the parent.
    props.onEventDrop(eventId, newStart, newEnd, columnIndex);

    // Database update logic (example, adjust table/column names as needed)
    // This should ideally be handled by the parent component that owns the events data and supabase client usage.
    // For demonstration, placing a simplified version here.
    try {
      // All event types are assumed to be in 'pt_sessions' based on fetchEvents and other handlers
      // The 'type' field distinguishes between PT, 상담, 측정, etc.
      // The primary key for pt_sessions is 'id' (as per CalendarEvent.id and fetchEvents)

      const { error } = await supabase
        .from('pt_sessions')
        .update({
          start_time: newStart.toISOString(), // Use 'start_time'
          end_time: newEnd.toISOString(),   // Use 'end_time'
          // type, member_id, notes etc. remain unchanged on drag-drop
          // If you need to store columnIndex in the DB, add it here.
        })
        .eq('id', eventId); // eventId is pt_sessions.id

      if (error) {
        throw error;
      }
      toast({ title: "성공", description: "일정이 성공적으로 업데이트되었습니다." });
      // It might be redundant to call props.onEventDrop again here if the parent handles UI updates based on the first call.
      // However, if the parent relies on this for post-DB update confirmation, it can remain.
      // Consider if columnIndex is needed in this second call as well.
      props.onEventDrop(eventId, newStart, newEnd, columnIndex);

    } catch (error: any) {
      console.error("Error updating event time in DB:", error);
      toast({ title: "DB 업데이트 오류", description: `일정 업데이트 중 오류 발생: ${error.message}`, variant: "destructive" });
      // Notify parent with original times to potentially revert optimistic UI update
      // This requires storing originalStart/End or fetching them again.
      // For simplicity, we'll rely on the parent to refetch or handle reverts.
      // props.onEventDrop(eventId, parseISO(eventToUpdate.start), parseISO(eventToUpdate.end), eventToUpdate.layout?.columnIndex); // Pass original column if reverting
    }
  };

  const renderCalendarView = () => {
    if (props.currentView === 'month') {
      return <MonthView {...props} date={props.currentDate} />;
    } else {
      // Pass handleEventDrop to TimeGridView
      return <TimeGridView {...props} openMoreEventsModal={openMoreEventsModal} viewType={props.currentView as 'week' | 'day'} date={props.currentDate} onEventDrop={handleEventDrop} />;
    }
  };

  return (
    <div className="relative">
      {props.isLoading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {renderCalendarView()}

      <Dialog open={isMoreEventsModalOpen} onOpenChange={setIsMoreEventsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{moreEventsModalTitle} - 전체 일정</DialogTitle>
            <DialogDescription>
              {moreEventsToShow.length > 0 ? `${format(parseISO(moreEventsToShow[0].start), 'yyyy년 M월 d일', { locale: ko })} ${moreEventsModalTitle}의 모든 일정입니다.` : '표시할 일정이 없습니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto py-4 space-y-2">
            {moreEventsToShow
              .sort((a,b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
              .map(event => (
              <div key={event.id} className="p-3 border rounded-md shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-base">{event.title} ({event.type || '일정'})</h3>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(event.start), 'HH:mm', { locale: ko })} - {format(parseISO(event.end), 'HH:mm', { locale: ko })}
                </p>
                {event.notes && <p className="text-sm mt-1 whitespace-pre-wrap bg-muted p-2 rounded-md">{event.notes}</p>}
                <p className="text-sm mt-1">상태: {event.status === 'completed' ? '완료' : event.status === 'cancelled' ? '취소됨' : '예약됨'}</p>
                <div className="mt-3 flex space-x-2">
                  {event.status === 'scheduled' && (
                    <Button size="sm" variant="outline" onClick={() => { props.onStartPt(event); setIsMoreEventsModalOpen(false); }}>PT 시작</Button>
                  )}
                   <Button size="sm" variant="outline" onClick={() => { props.onEditAppointment(event); setIsMoreEventsModalOpen(false); }}>수정</Button>
                   <Button size="sm" variant="destructive" onClick={() => { props.onDeletePt(event); setIsMoreEventsModalOpen(false); }}>삭제</Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsMoreEventsModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}