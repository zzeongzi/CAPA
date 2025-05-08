import React, { useState, useEffect } from 'react';
import { HexAlphaColorPicker } from "react-colorful"; // 색상 선택기 import
import { Input } from "@/components/ui/input"; // Input 추가
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectUserModal } from '@/components/features/SelectUserModal';
import { Member } from '@/hooks/use-members'; // Member 타입 직접 import
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DatePicker from '@/components/features/workout/DatePicker';
import { SelectHourModal } from '@/components/features/workout/SelectHourModal'; // 시간 선택 모달 import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setHours, setMinutes, startOfDay } from 'date-fns';
import { Loader2, Clock } from 'lucide-react';
import { cn } from "@/lib/utils"; // cn 함수 import 추가

// Define the structure for appointment data passed to the save handler
export interface AppointmentData {
  member: Member | null;
  startTime: string | null; // Changed to string
  endTime: string | null;   // Changed to string
  type: "PT" | "상담" | "측정";
  notes?: string;
  backgroundColor?: string | null;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AppointmentData) => Promise<void>;
  isMobileView?: boolean; // 모바일 뷰 여부 prop 추가
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isMobileView = false, // 기본값 false
}) => {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = useState<number>(new Date().getHours()); // number 타입으로 변경
  // durationMinutes 상태 제거
  const [appointmentType, setAppointmentType] = useState<"PT" | "상담" | "측정">("PT");
  const [notes, setNotes] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHourModalOpen, setIsHourModalOpen] = useState(false); // 시간 선택 모달 상태 추가
  const [selectedColor, setSelectedColor] = useState<string>("#1d4ed8ff"); // 색상 상태 추가 (기본 파란색, 불투명)
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMember(null);
      setAppointmentDate(new Date());
      setStartHour(new Date().getHours());
      // durationMinutes 초기화 제거
      setAppointmentType('PT');
      setNotes('');
      setSelectedColor("#1d4ed8ff"); // 색상 초기화
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setIsMemberModalOpen(false);
  };

  // 시간 선택 모달 콜백
  const handleHourSelect = (hour: number) => {
    setStartHour(hour);
    setIsHourModalOpen(false);
  };

  const calculateTimes = (): { startTime: Date | null; endTime: Date | null } => {
    if (!appointmentDate) return { startTime: null, endTime: null };
    try {
      // appointmentDate의 시간 부분을 무시하고 startHour로 설정
      const start = setMinutes(setHours(startOfDay(appointmentDate), startHour), 0); // startOfDay 추가
      const end = new Date(start.getTime() + 60 * 60000); // duration 60분 고정
      console.log('[calculateTimes] Calculated Start:', start, 'End:', end); // 디버깅 로그 추가
      return { startTime: start, endTime: end };
    } catch (e) {
      console.error("Error calculating times:", e);
      return { startTime: null, endTime: null };
    }
  };

  const handleSaveClick = async () => {
    const { startTime, endTime } = calculateTimes();
    if (!selectedMember || !startTime || !endTime) {
      alert("회원과 시간을 정확히 선택해주세요.");
      return;
    }

    setIsSaving(true);
    console.log('[handleSaveClick] Selected Member:', selectedMember);
    console.log('[handleSaveClick] Appointment Date:', appointmentDate);
    console.log('[handleSaveClick] Start Hour:', startHour);
    console.log('[handleSaveClick] Calculated Start Time (Date object):', startTime);
    console.log('[handleSaveClick] Calculated End Time (Date object):', endTime);

    // Convert Date objects to ISO strings (UTC) before saving
    const data: AppointmentData = {
      member: selectedMember,
      startTime: startTime.toISOString(), // Convert to ISO string (UTC)
      endTime: endTime.toISOString(),     // Convert to ISO string (UTC)
      type: appointmentType,
      notes,
      backgroundColor: selectedColor,
    };
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
      // 오류 발생 시 모달을 닫지 않고 사용자에게 피드백 (Toast는 부모 컴포넌트에서 처리)
    } finally {
      setIsSaving(false);
    }
  };

  // durationOptions 제거

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        {/* DialogContent에 aria-describedby 추가 */}
        <DialogContent className="sm:max-w-[480px]" aria-describedby="new-appointment-description">
          <DialogHeader>
            <DialogTitle>새 예약 생성</DialogTitle>
            {/* DialogDescription 추가 */}
            <DialogDescription id="new-appointment-description">
              새로운 예약을 생성합니다. 회원과 시간을 선택해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Member Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-select-button" className="text-right">
                회원
              </Label>
              <div className="col-span-3">
                <Button
                  id="member-select-button" // ID 추가
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10"
                  onClick={() => setIsMemberModalOpen(true)}
                >
                  {selectedMember ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedMember.avatarUrl ?? undefined} />
                        <AvatarFallback>{selectedMember.initials}</AvatarFallback>
                      </Avatar>
                      <span>{selectedMember.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">회원을 선택하세요</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="appointment-date" className="text-right">
                날짜
              </Label>
              <div className="col-span-3">
                 <DatePicker date={appointmentDate} setDate={setAppointmentDate} />
              </div>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-time-button" className="text-right">
                시작 시간
              </Label>
              <div className="col-span-3"> {/* col-span-2 -> col-span-3 */}
                {/* 시작 시간 선택 버튼 */}
                <Button
                  id="start-time-button" // ID 추가
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10"
                  onClick={() => setIsHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {String(startHour).padStart(2, '0')}:00
                </Button>
              </div>
              {/* Duration Select 제거 */}
            </div>

             {/* Appointment Type */}
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="appointment-type" className="text-right">
                 예약 종류
               </Label>
               <div className="col-span-3">
                 <Select value={appointmentType} onValueChange={(value: "PT" | "상담" | "측정") => setAppointmentType(value)}>
                   <SelectTrigger id="appointment-type">
                     <SelectValue placeholder="종류 선택" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="PT">PT (60분)</SelectItem> {/* 시간 명시 */}
                     <SelectItem value="상담">상담</SelectItem>
                     <SelectItem value="측정">측정</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             </div>

            {/* Notes */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                메모
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="col-span-3"
                placeholder="예약 관련 메모를 입력하세요 (선택 사항)"
              />
            </div>

            {/* 배경색 선택 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="backgroundColor" className="text-right">배경색</Label>
              <div className="col-span-3 flex flex-col gap-2">
                <HexAlphaColorPicker color={selectedColor} onChange={setSelectedColor} style={{ width: '100%', height: '150px' }}/>
                <div className="flex items-center gap-2 mt-2"> {/* mt-2 추가 */}
                  <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: selectedColor }}></div>
                  <Input
                    id="backgroundColorInput"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    placeholder="#RRGGBBAA"
                    className="flex-grow"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className={cn(
            "pt-4",
            isMobileView ? "flex-col space-y-2" : "sm:justify-end space-x-2" // 모바일이면 수직, 아니면 수평 오른쪽 정렬
          )}>
            {!isMobileView && ( // 모바일 뷰가 아닐 때만 취소 버튼 표시
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  취소
                </Button>
              </DialogClose>
            )}
            <Button type="button" onClick={handleSaveClick} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Selection Modal */}
      <SelectUserModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onUserSelect={handleMemberSelect}
      />

      {/* Hour Selection Modal */}
      <SelectHourModal
        isOpen={isHourModalOpen}
        onClose={() => setIsHourModalOpen(false)}
        onHourSelect={handleHourSelect}
        currentHour={startHour}
      />
    </>
  );
};