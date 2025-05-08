"use client"

import * as React from "react"
import { useState, useEffect } from "react" // useState, useEffect 추가
import { format } from "date-fns"
import { ko } from "date-fns/locale" // 한국어 로케일 추가
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange, DayPickerRangeProps } from "react-day-picker" // DayPickerRangeProps 추가

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
}

// formatCaption 함수 정의
const formatCaption: DayPickerRangeProps['formatters']['formatCaption'] = (month, options) => {
  return format(month, 'yyyy년 LLL', { locale: options?.locale });
};


export function DatePickerWithRange({
  className,
  date,
  onDateChange
}: DatePickerWithRangeProps) {
  // 표시할 월 상태 추가
  const [month, setMonth] = useState<Date | undefined>(date?.from);

  // date prop이 변경될 때 month 상태 업데이트
  useEffect(() => {
    if (date?.from && (!month || date.from.getMonth() !== month.getMonth() || date.from.getFullYear() !== month.getFullYear())) {
      setMonth(date.from);
    }
  }, [date?.from, month]);


  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "yyyy년 LLL d일", { locale: ko })} -{" "}
                  {format(date.to, "yyyy년 LLL d일", { locale: ko })}
                </>
              ) : (
                format(date.from, "yyyy년 LLL d일", { locale: ko })
              )
            ) : (
              <span>기간 선택</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            month={month} // defaultMonth 대신 month 사용
            onMonthChange={setMonth} // onMonthChange 핸들러 추가
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={ko} // 한국어 로케일 적용
            formatters={{ formatCaption }} // formatters prop 추가
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}