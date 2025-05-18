import React, { useState, useEffect, useRef } from 'react'; // useRef 추가
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Popover 추가
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MemberSelector from '@/components/features/workout/MemberSelector';
import { Member, useMembers } from '@/hooks/use-members'; // useMembers 다시 추가
// import { useWorkoutStore } from '@/store/workoutStore'; // Zustand 스토어 사용 제거
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DatePicker from '@/components/features/workout/DatePicker';
import { SelectHourModal } from '@/components/features/workout/SelectHourModal'; // 시간 선택 모달 import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setHours, setMinutes, startOfDay, getHours, getMinutes, addMinutes } from 'date-fns'; // getHours, getMinutes, addMinutes 추가
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
  const [endHour, setEndHour] = useState<number>(getHours(addMinutes(setHours(new Date(), new Date().getHours()), 50)));
  const [endMinute, setEndMinute] = useState<number>(0); // 분은 0으로 고정, 상태는 유지하되 UI에서 직접 수정 안 함
  const [isEndTimeManuallySelected, setIsEndTimeManuallySelected] = useState(false);
  // const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false); // SelectHourModal로 대체되므로 불필요

  const [appointmentType, setAppointmentType] = useState<"PT" | "상담" | "측정">("PT");
  const [notes, setNotes] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHourModalOpen, setIsHourModalOpen] = useState(false); // 시작 시간 모달용
  const [isEndHourModalOpen, setIsEndHourModalOpen] = useState(false); // 종료 시간 모달용 상태 추가
  // selectedColor, isColorPickerOpen, colorPickerTriggerRef 제거
  const [isSaving, setIsSaving] = useState(false);
  const { members, isLoading: membersLoading } = useMembers(); // useMembers 다시 사용
  // const {
  //   members: workoutStoreMembers,
  //   fetchMembers: fetchWorkoutStoreMembers,
  //   isLoadingMembers,
  //   memberError
  // } = useWorkoutStore(); // useWorkoutStore 관련 제거
  // const { userCenter } = useAuth(); // userCenter는 useMembers 내부에서 사용되므로 여기선 불필요

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMember(null);
      setAppointmentDate(new Date());
      setStartHour(new Date().getHours());
      const defaultStartTime = setHours(new Date(), new Date().getHours());
      const defaultEndTime = addMinutes(defaultStartTime, appointmentType === "PT" ? 50 : 60);
      setEndHour(getHours(defaultEndTime));
      setEndMinute(0); // 분은 0으로 고정
      setIsEndTimeManuallySelected(false);
      setAppointmentType('PT');
      setNotes('');
      // setSelectedColor 제거
      setIsSaving(false);
    }
  }, [isOpen]);

  // selectedMember 상태 변경 시 로그 출력 (디버깅용)
  useEffect(() => {
    console.log('[NewAppointmentModal] selectedMember changed:', selectedMember);
    if (selectedMember) {
      console.log('[NewAppointmentModal] selectedMember.memberPk:', selectedMember.memberPk);
    }
  }, [selectedMember]);

  const handleMemberSelect = (memberPk: string | null) => {
    if (memberPk) {
      const member = members.find(m => m.memberPk === memberPk);
      setSelectedMember(member || null);
    } else {
      setSelectedMember(null);
    }
    // 선택 후 활성 요소에서 포커스 제거 시도 (setTimeout 사용)
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
  };

  // 시간 선택 모달 콜백
  const handleStartHourSelect = (hour: number) => {
    setStartHour(hour);
    setIsHourModalOpen(false);
    // 시작 시간 변경 시, 수동으로 종료 시간을 설정하지 않았다면 종료 시간 자동 업데이트
    if (!isEndTimeManuallySelected && appointmentDate) {
      const newStartTime = setMinutes(setHours(startOfDay(appointmentDate), hour), 0);
      const duration = appointmentType === "PT" ? 50 : 60;
      const newEndTime = addMinutes(newStartTime, duration);
      setEndHour(getHours(newEndTime));
      setEndMinute(0); // 분은 0으로 고정
    }
  };

  const handleEndHourSelect = (hour: number) => {
    setEndHour(hour);
    // setEndMinute(0); // 분은 별도 Select로 선택하므로 여기서 0으로 고정하지 않음
    setIsEndHourModalOpen(false);
    setIsEndTimeManuallySelected(true);
    if (hour < startHour || (hour === startHour && endMinute <= 0)) {
      setStartHour(hour - 1 < 0 ? 0 : hour - 1);
    }
  };

  const handleEndMinuteSelect = (minute: number) => { // handleEndMinuteSelect 함수 다시 추가
    setEndMinute(minute);
    setIsEndTimeManuallySelected(true);
     if (startHour === endHour && 0 >= minute) {
        if (minute === 0) {
             setStartHour(startHour - 1 < 0 ? 0 : startHour -1);
        }
    }
  };

  // appointmentType 변경 시 종료 시간 자동 업데이트
  useEffect(() => {
    if (!isEndTimeManuallySelected && appointmentDate) {
      const currentStartTime = setMinutes(setHours(startOfDay(appointmentDate), startHour), 0);
      const duration = appointmentType === "PT" ? 50 : 60; // PT 50분, 상담/측정 60분으로 가정
      const newEndTime = addMinutes(currentStartTime, duration);
      setEndHour(getHours(newEndTime));
      setEndMinute(getMinutes(newEndTime)); // 계산된 분으로 설정
    }
  }, [appointmentType, startHour, appointmentDate, isEndTimeManuallySelected]);


  const calculateTimes = (): { startTime: Date | null; endTime: Date | null } => {
    if (!appointmentDate) return { startTime: null, endTime: null };
    try {
      const start = setMinutes(setHours(startOfDay(appointmentDate), startHour), 0);
      let end = setMinutes(setHours(startOfDay(appointmentDate), endHour), endMinute); // endMinute 사용 (현재는 0)
      
      // 만약 계산된 end 시간이 start 시간보다 이전이거나 같으면, start 시간에 duration을 더한 값으로 설정
      if (end <= start) {
        const durationMinutes = appointmentType === "PT" ? 50 : 60;
        end = addMinutes(start, durationMinutes);
        console.warn("Calculated end time was before or same as start time. Adjusted end time.");
      }
      console.log('[calculateTimes] Calculated Start:', start, 'End:', end);
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
      // backgroundColor 제거 (AppointmentData 인터페이스에서 optional이므로 전달 안 함)
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
                {/* Button 대신 MemberSelector 직접 사용 */}
                <MemberSelector
                  selectedMemberId={selectedMember ? selectedMember.memberPk : null} // MemberSelector에는 members 테이블 PK 전달
                  onSelectMember={handleMemberSelect}
                />
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
              <div className="col-span-3">
                <Button
                  id="start-time-button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10 px-3" // px-3 추가하여 버튼 내부 패딩과 유사하게
                  onClick={() => setIsHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" /> {/* opacity-50 제거 */}
                  {String(startHour).padStart(2, '0')}시
                </Button>
              </div>
            </div>

            {/* End Time Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-time-hour-select" className="text-right">
                종료 시간
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2"> {/* EditAppointmentModal과 동일한 구조 */}
                <Button
                  id="end-time-hour-button" // ID 변경 (SelectTrigger와 구분)
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10 px-3"
                  onClick={() => setIsEndHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {String(endHour).padStart(2, '0')}시
                </Button>
                <Select value={String(endMinute)} onValueChange={(value) => handleEndMinuteSelect(Number(value))}>
                  <SelectTrigger className="w-full h-10 justify-start text-left font-normal px-3">
                     <SelectValue placeholder="분" />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 10, 15, 20, 30, 40, 45, 50].map(min => (
                      <SelectItem key={`end-min-${min}`} value={String(min)}>{String(min).padStart(2, '0')}분</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                     <SelectItem value="PT">PT</SelectItem>
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

            {/* 배경색 선택 UI 제거 */}
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

      {/* MemberSelector를 Dialog로 감싸는 부분 제거 (이미 위에서 직접 사용) */}

      {/* Hour Selection Modal */}
      <SelectHourModal
        isOpen={isHourModalOpen} // 시작 시간 모달은 isHourModalOpen 상태 사용
        onClose={() => setIsHourModalOpen(false)}
        onHourSelect={handleStartHourSelect}
        currentHour={startHour}
      />

      {/* End Hour Selection Modal */}
      <SelectHourModal
        isOpen={isEndHourModalOpen} // 종료 시간 모달은 isEndHourModalOpen 상태 사용
        onClose={() => setIsEndHourModalOpen(false)}
        onHourSelect={handleEndHourSelect}
        currentHour={endHour}
        minHour={startHour === endHour ? startHour : (startHour + 1 > 23 ? undefined : startHour + 1)}
      />
    </>
  );
};