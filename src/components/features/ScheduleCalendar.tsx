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
    columnIndex?: number; // columnIndex 추가
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
  viewType: 'day' | 'week' | 'month' | 'week-list';
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
                <Button
                  variant="outline"
                  className="w-full h-12 flex items-center justify-center text-base"
                  style={{
                    color: event.backgroundColor || 'inherit',
                    borderColor: event.borderColor || 'currentColor',
                    // hover styles can be handled by Tailwind's hover:bg-opacity or custom CSS if needed
                  }}
                  onClick={(e) => { e.stopPropagation(); onStartPt(event); setIsDetailModalOpen(false); }}
                >
                  <Play className="mr-2 h-6 w-6" /> {event.type} 시작
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
    viewType === 'month' || viewType === 'week' || viewType === 'week-list' || !event.layout
      ? { ...eventItemStyle } // For month, week, week-list, or if layout is missing, use basic style
      : { // This will now only apply to 'day' view if event.layout exists
          ...eventItemStyle,
          position: 'absolute',
          top: `${event.layout.top}px`,
          height: `${event.layout.height}px`,
          left: `${event.layout.left}%`,
          width: `${event.layout.width}%`, // Use layout width for day view
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
            "rounded cursor-grab flex border-black dark:border-white overflow-hidden", // Add overflow-hidden here
            (viewType === 'month' || viewType === 'week' || viewType === 'week-list')
              ? "w-full relative min-h-[24px] mb-0.5 shadow-sm"
              : "absolute shadow-md", // day view
            highlightedEventId === event.id && "ring-2 ring-offset-2 ring-primary"
          )}
          style={dynamicStyle} // dynamicStyle에서 width를 %로 설정하므로, className에서 w-full 등의 클래스 제거 확인
          onClick={() => setIsDetailModalOpen(true)}
          title={`${format(parseISO(event.start), 'HH:mm')} - ${format(parseISO(event.end), 'HH:mm')} ${event.title}${event.type ? ` (${event.type})` : ''}${event.status === 'completed' ? ' (완료)' : ''}`}
        >
          <div
            className={cn(
              (viewType === 'month' || viewType === 'week' || viewType === 'week-list') ? 'w-1.5 absolute top-0 left-0 bottom-0' : 'w-1.5 flex-shrink-0',
              "h-full z-20",
              barColor
            )}
          ></div>
          <div
            className={cn(
              "flex-grow p-1",
              (viewType === 'month' || viewType === 'week' || viewType === 'week-list') && 'ml-1.5',
              (viewType !== 'week' && viewType !== 'week-list') && "overflow-hidden", // week, week-list일 때는 overflow-hidden 제거
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
              ) : (viewType === 'day') ? (
                <div className="flex justify-between items-center h-full w-full leading-tight p-1"> {/* p-1 추가로 내부 여백 */}
                  <span className={cn("text-base font-medium", titleTextColor)}> {/* 시간 표시, 크기 증가 */}
                    {format(parseISO(event.start), 'HH:mm')}
                  </span>
                  <div className="flex flex-col items-end ml-2"> {/* 회원 이름 및 예약 종류, 오른쪽 정렬 및 왼쪽 마진 */}
                    <span className={cn("text-base", event.status === 'completed' && "opacity-70", titleTextColor, "whitespace-normal text-right")} > {/* 크기 증가, 오른쪽 정렬 */}
                      {event.title}
                    </span>
                    {statusText &&
                      <span className={cn("text-base font-medium", statusTextColor, event.status === 'completed' && "opacity-70", "whitespace-normal text-right")} > {/* 크기 증가, 오른쪽 정렬 */}
                        {statusText}
                      </span>
                    }
                  </div>
                </div>
              ) : (viewType === 'week' || viewType === 'week-list') ? (
                <div className="flex justify-between items-center h-full w-full leading-tight">
                  <span className={cn("text-sm truncate", event.status === 'completed' && "opacity-70", titleTextColor, "whitespace-nowrap")}>
                    {event.title}
                  </span>
                  {statusText &&
                    <span className={cn("text-sm font-medium truncate", statusTextColor, event.status === 'completed' && "opacity-70", "whitespace-nowrap ml-1")}>
                      {statusText}
                    </span>
                  }
                </div>
              ) : ( // Fallback
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
              {/* PT 완료된 이벤트 표시 */}
              {(() => {
                const completedPtCount = dayEvents.filter(event => event.type === 'PT' && event.status === 'completed').length;
                return completedPtCount > 0 ? (
                  <div className="flex flex-col items-center mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> {/* 초록색 점 */}
                    <span className="text-[9px] leading-none font-semibold mt-0.5">{completedPtCount}</span>
                  </div>
                ) : null;
              })()}
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
const MIN_EVENT_HEIGHT_PX_DAY = 36; // Increased to accommodate more text
const EVENT_GAP_PX = 2;
const EVENT_GAP_PX_X = 1; 
const EVENT_WIDTH_PERCENTAGE = 85; // 너비 추가 조정
const EVENT_LEFT_PERCENTAGE = 0;
const MAX_EVENTS_PER_ROW_DAY = 2; // 한 줄에 표시될 최대 이벤트 수 (Day View 가로 칸 수)
const DAY_VIEW_EVENT_WIDTH_PERCENTAGE = 49; // Day View에서 각 이벤트의 너비 (칸 너비와 동일하게 설정)
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

  // This useEffect is for calculating dynamic hour slot heights, which might not be needed
  // if day view events are absolutely positioned relative to the entire day column.
  // For simplicity and to ensure events are rendered correctly in day view as single cards,
  // we might rely on fixed HOUR_SLOT_HEIGHT_PX for visual hour lines
  // and calculate event top/height based on the total day height.
  useEffect(() => {
    const newSlotHeights: Record<number, number> = {};
    hours.forEach(hour => {
      newSlotHeights[hour] = HOUR_SLOT_HEIGHT_PX; // Keep fixed for now
    });
    setHourSlotHeights(newSlotHeights);
  }, []);


  const processedEvents = useMemo(() => {
    if (viewType !== 'day') return []; // Only calculate for day view

    const dayEvents = events.filter(event => isSameDay(parseISO(event.start), date));
    
    // Sort events by start time, then by duration (longer events first for better layout)
    const sortedEvents = dayEvents.sort((a, b) => {
      const startA = parseISO(a.start).getTime();
      const startB = parseISO(b.start).getTime();
      if (startA !== startB) return startA - startB;
      return differenceInMinutes(parseISO(b.end), parseISO(b.start)) - differenceInMinutes(parseISO(a.end), parseISO(a.start));
    });

    const layoutEvents: CalendarEvent[] = [];
    // Store end times for each column to check for overlaps
    const columnEndTimes: number[] = Array(MAX_EVENTS_PER_ROW_DAY).fill(0);

    sortedEvents.forEach(event => {
      const eventStart = parseISO(event.start);
      const eventEnd = parseISO(event.end);
      const startMinutes = getHours(eventStart) * 60 + getMinutes(eventStart);
      const endMinutes = getHours(eventEnd) * 60 + getMinutes(eventEnd);
      const durationMinutes = Math.max(15, differenceInMinutes(eventEnd, eventStart)); // Min duration 15 mins

      let targetColumn = -1;

      // Check if event already has a columnIndex from a previous drop
      if (typeof event.layout?.columnIndex === 'number') {
        targetColumn = event.layout.columnIndex;
      } else {
        // Original logic to find the first available column
        for (let i = 0; i < MAX_EVENTS_PER_ROW_DAY; i++) {
          if (startMinutes >= columnEndTimes[i]) {
            targetColumn = i;
            break;
          }
        }

        // Fallback if no column is free
        if (targetColumn === -1) {
            let minEndTime = Infinity;
            for (let i = 0; i < MAX_EVENTS_PER_ROW_DAY; i++) {
                if (columnEndTimes[i] < minEndTime) {
                    minEndTime = columnEndTimes[i];
                    targetColumn = i;
                }
            }
            if (targetColumn === -1) targetColumn = 0;
        }
      }
      
      // Ensure targetColumn is within bounds
      targetColumn = Math.min(targetColumn, MAX_EVENTS_PER_ROW_DAY - 1);
      targetColumn = Math.max(targetColumn, 0);

      const top = (startMinutes / (24 * 60)) * (24 * HOUR_SLOT_HEIGHT_PX);
      const height = (durationMinutes / (24 * 60)) * (24 * HOUR_SLOT_HEIGHT_PX);
      
      const eventWidth = EVENT_WIDTH_PERCENTAGE_DAY;
      const eventLeft = EVENT_LEFT_PERCENTAGE + targetColumn * (eventWidth + EVENT_GAP_PX_X);


      layoutEvents.push({
        ...event,
        layout: {
          top: top,
          height: Math.max(height, MIN_EVENT_HEIGHT_PX_DAY), // Ensure minimum height
          left: eventLeft,
          width: eventWidth,
          zIndex: 10 + targetColumn, // Higher zIndex for events in later columns if they overlap
          columnIndex: targetColumn,
        },
      });
      // Update the end time for this column
      columnEndTimes[targetColumn] = endMinutes;
    });

    return layoutEvents;
  }, [events, date, viewType]);


  return (
    <div className="flex flex-col h-full">
      {/* Header for week view */}
      {viewType === 'week' && (
        <div className="grid grid-cols-[minmax(3rem,auto)_repeat(7,1fr)] items-center border-b sticky top-0 bg-background z-30"> {/* Adjusted grid-cols for week header */}
          <div className="w-12 text-center text-xs text-muted-foreground py-2 border-r">시간</div> {/* Fixed width for time header cell */}
          {days.map(day => (
            <div key={day.toString()} className="text-center text-xs py-2 border-r last:border-r-0">
              <div>{format(day, 'EEE', { locale: ko })}</div>
              <div className={cn("text-lg font-medium", isSameDay(day, new Date()) && "text-primary")}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={cn("flex-grow overflow-y-auto", viewType === 'week' ? "grid grid-cols-[minmax(3rem,auto)_repeat(7,1fr)]" : "flex")}> {/* Adjusted grid-cols for week main content, flex for day view */}
        {/* Time column */}
        <div className="w-12 shrink-0 border-r relative"> {/* Consistent width and shrink-0 */}
          {hours.map(hour => (
            <div
              key={`time-${hour}`}
              className="h-24 text-center text-xs text-muted-foreground pt-1 border-b" // Removed relative from here, parent is relative
              style={{ height: `${hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX}px` }}
            >
              {hour === 0 ? '' : `${hour.toString().padStart(2, '0')}:00`}
            </div>
          ))}
        </div>

        {/* Day columns container */}
        {/* For day view, days.map will iterate once. For week view, 7 times. */}
        {days.map((dayItem, dayIndex) => (
          <div
            key={dayItem.toString()}
            className={cn(
              "relative", // Each day column is relative for its events
              viewType === 'week' && "border-r last:border-r-0", // Borders for week view
              viewType === 'day' && "flex-1 w-full" // Day view's single column takes remaining space
            )}
            onDragOver={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const currentHour = Math.floor(y / (hourSlotHeights[0] || HOUR_SLOT_HEIGHT_PX)); // Assuming all slots have same height for simplicity
              const minuteFraction = (y % (hourSlotHeights[0] || HOUR_SLOT_HEIGHT_PX)) / (hourSlotHeights[0] || HOUR_SLOT_HEIGHT_PX);
              const currentMinute = Math.floor(minuteFraction * 6) * 10; // Snap to 10-minute intervals

              let currentColumnIndex;
              if (viewType === 'day') {
                const x = e.clientX - rect.left;
                const columnWidth = rect.width / MAX_EVENTS_PER_ROW_DAY;
                currentColumnIndex = Math.min(MAX_EVENTS_PER_ROW_DAY - 1, Math.floor(x / columnWidth));
              }
              setDraggedOverInfo({ day: dayItem, hour: currentHour, minute: currentMinute, columnIndex: currentColumnIndex });
            }}
            onDragLeave={() => setDraggedOverInfo(null)}
            onDrop={(e) => {
              e.preventDefault();
              const eventDataString = e.dataTransfer.getData("application/json");
              if (!eventDataString || !draggedOverInfo) return;

              const eventData = JSON.parse(eventDataString);
              const { id: eventId, durationMinutes } = eventData;
              
              let newStart = setMinutes(setHours(startOfDay(draggedOverInfo.day), draggedOverInfo.hour), draggedOverInfo.minute);
              newStart = newStart < startOfDay(draggedOverInfo.day) ? startOfDay(draggedOverInfo.day) : newStart;
              
              let newEnd = addMinutes(newStart, durationMinutes);
              if (newEnd > endOfDay(draggedOverInfo.day)) {
                newEnd = endOfDay(draggedOverInfo.day);
                newStart = subMinutes(newEnd, durationMinutes);
                newStart = newStart < startOfDay(draggedOverInfo.day) ? startOfDay(draggedOverInfo.day) : newStart;
              }
              
              onEventDrop(eventId, newStart, newEnd, draggedOverInfo.columnIndex);
              setDraggedOverInfo(null);
            }}
          >
            {/* Hour lines for each day column (visual only for day view, week view has events here) */}
            {/* For day view, events are rendered above, absolutely. For week view, events are per hour slot. */}
            {hours.map(hour => (
              <div
                key={`${dayItem.toString()}-hour-${hour}`}
                className={cn("border-b", viewType === 'day' && "pointer-events-none")} // pointer-events-none for day view hour lines
                style={{ height: `${hourSlotHeights[hour] || HOUR_SLOT_HEIGHT_PX}px` }}
              >
                {/* Highlight for drag over */}
                {draggedOverInfo && isSameDay(draggedOverInfo.day, dayItem) && draggedOverInfo.hour === hour && (
                  <div
                    className="absolute bg-blue-100 opacity-50 pointer-events-none flex items-center justify-center text-xs text-blue-800" // Added flex centering and text style
                    style={{
                      top: `${draggedOverInfo.hour * (hourSlotHeights[draggedOverInfo.hour] || HOUR_SLOT_HEIGHT_PX) + (draggedOverInfo.minute / 60) * (hourSlotHeights[draggedOverInfo.hour] || HOUR_SLOT_HEIGHT_PX)}px`,
                      height: `${MIN_EVENT_HEIGHT_PX_DAY}px`,
                      left: viewType === 'day' && draggedOverInfo.columnIndex !== undefined ? `${draggedOverInfo.columnIndex * (100 / MAX_EVENTS_PER_ROW_DAY)}%` : '0%',
                      width: viewType === 'day' && draggedOverInfo.columnIndex !== undefined ? `${100 / MAX_EVENTS_PER_ROW_DAY}%` : '100%',
                      zIndex: 5,
                    }}
                  >
                    {format(setMinutes(setHours(new Date(), draggedOverInfo.hour), draggedOverInfo.minute), 'HH:mm')}
                  </div>
                )}
                {/* Render events for this hour slot in WEEK VIEW ONLY */}
                {viewType === 'week' && (
                  <div className="p-1 space-y-0.5 overflow-y-auto h-full">
                    {events
                      .filter(event => {
                        const eventStart = parseISO(event.start);
                        return isSameDay(eventStart, dayItem) && getHours(eventStart) === hour;
                      })
                      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
                      .map(event => (
                        <EventItem
                          key={event.id}
                          event={event}
                          viewType="week-list"
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
                )}
              </div>
            ))}
            {/* Render Day View events here, absolutely positioned relative to this dayItem column */}
            {viewType === 'day' && dayIndex === 0 && processedEvents.map(event => (
              <EventItem
                key={event.id}
                event={event}
                viewType="day"
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
        ))}
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
          calendar_column_index: columnIndex, // 컬럼 이름 수정
        })
        .eq('id', eventId); // eventId is pt_sessions.id

      if (error) {
        throw error;
      }
      toast({ title: "성공", description: "일정이 성공적으로 업데이트되었습니다." });
      // 두 번째 props.onEventDrop 호출을 제거하여 중복 상태 업데이트 및 잠재적 문제를 방지합니다.
      // 부모 컴포넌트는 첫 번째 props.onEventDrop 호출을 통해 상태를 업데이트하고,
      // 그 후 DB 업데이트를 진행하거나, UI를 낙관적으로 업데이트 후 DB 결과에 따라 처리해야 합니다.
      // props.onEventDrop(eventId, newStart, newEnd, columnIndex); // 이 줄을 제거 또는 주석 처리

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
