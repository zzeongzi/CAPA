import React, { useState, useRef } from "react"; // useState, useRef 추가
import { format } from "date-fns";
import { ko } from "date-fns/locale"; // 한국어 로케일 추가
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ date, setDate, className }) => {
  const [open, setOpen] = useState(false); // Popover 열림/닫힘 상태 추가
  const triggerRef = useRef<HTMLButtonElement>(null); // PopoverTrigger 버튼 ref

  return (
    <Popover modal={true} open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        triggerRef.current?.focus(); // Popover 닫힐 때 트리거 버튼으로 포커스 이동
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef} // ref 연결
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10", // h-10 추가
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP", { locale: ko }) : <span>날짜 선택</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            setDate(selectedDate);
            setOpen(false); // 날짜 선택 후 Popover 닫기
          }}
          initialFocus
          locale={ko} // 한국어 로케일 적용
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;