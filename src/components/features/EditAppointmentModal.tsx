import React, { useState, useEffect, useCallback } from 'react';
import { HexAlphaColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
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
import MemberSelector from '@/components/features/workout/MemberSelector';
import { Member, useMembers } from '@/hooks/use-members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DatePicker from '@/components/features/workout/DatePicker';
import { SelectHourModal } from '@/components/features/workout/SelectHourModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setHours, setMinutes, getHours, getMinutes } from 'date-fns'; // getMinutes 추가
import { Loader2, Clock } from 'lucide-react';
import { CalendarEvent } from './ScheduleCalendar';
import { cn } from "@/lib/utils"; // cn 함수 import 추가

// AppointmentData 인터페이스 확장 (id 포함)
export interface EditAppointmentData {
  id: string; // 예약 ID 추가
  member: Member | null;
  startTime: string | null; // Changed to string (ISO string)
  endTime: string | null;   // Changed to string (ISO string)
  type: "PT" | "상담" | "측정";
  notes?: string;
  backgroundColor?: string | null;
}

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EditAppointmentData) => Promise<void>;
  appointment: CalendarEvent | null;
  isMobileView?: boolean; // 모바일 뷰 여부 prop 추가
}

export const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  appointment,
  isMobileView = false, // 기본값 false
}) => {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = useState<number>(new Date().getHours());
  const [endHour, setEndHour] = useState<number>(new Date().getHours() + 1);
  const [endMinute, setEndMinute] = useState<number>(0);
  const [appointmentType, setAppointmentType] = useState<"PT" | "상담" | "측정">("PT");
  const [notes, setNotes] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isStartHourModalOpen, setIsStartHourModalOpen] = useState(false);
  const [isEndHourModalOpen, setIsEndHourModalOpen] = useState(false);
  // isEndMinuteModalOpen 상태는 Select를 직접 사용하므로 불필요할 수 있으나, 일단 유지하고 필요시 제거
  const [isEndMinuteModalOpen, setIsEndMinuteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { members } = useMembers(); // 회원 목록 가져오기

  // 모달이 열리거나 appointment prop이 변경될 때 상태 초기화
  useEffect(() => {
    if (isOpen && appointment) {
      const member = members.find(m => m.id === appointment.memberId);
      setSelectedMember(member || null);
      // Parse ISO strings to Date objects for state
      setAppointmentDate(appointment.start ? new Date(appointment.start) : undefined);
      const startDate = appointment.start ? new Date(appointment.start) : new Date();
      const endDate = appointment.end ? new Date(appointment.end) : new Date(startDate.getTime() + 60 * 60000);
      setStartHour(getHours(startDate));
      // startMinute은 0으로 고정하거나 appointment.start의 분을 사용하되 UI에서 수정 불가. 여기서는 0으로 가정.
      setEndHour(getHours(endDate));
      setEndMinute(getMinutes(endDate));
      // appointment.type이 유효한 값인지 확인 후 설정
      const validTypes = ["PT", "상담", "측정"];
      const appointmentTypeToSet = appointment.type && validTypes.includes(appointment.type)
        ? appointment.type as "PT" | "상담" | "측정"
        : "PT"; // 유효하지 않으면 기본값 "PT"
      setAppointmentType(appointmentTypeToSet);
      setNotes(appointment.notes || '');
      // setSelectedColor 제거
      setIsSaving(false);
    } else if (!isOpen) {
      // 모달이 닫힐 때 상태 초기화 (선택 사항)
      setSelectedMember(null);
      setAppointmentDate(new Date());
      const now = new Date();
      setStartHour(getHours(now));
      setEndHour(getHours(now) + 1 > 23 ? 23 : getHours(now) + 1);
      setEndMinute(0);
      setAppointmentType('PT');
      setNotes('');
      // setSelectedColor 제거
    }
  }, [isOpen, appointment, members]);

  const handleMemberSelect = (memberId: string | null) => {
    if (memberId) {
      const member = members.find(m => m.id === memberId);
      setSelectedMember(member || null);
    } else {
      setSelectedMember(null);
    }
    setIsMemberModalOpen(false);
  };

  const handleStartHourSelect = (hour: number) => {
    setStartHour(hour);
    setIsStartHourModalOpen(false);
    // 시작 시간이 변경되면 종료 시간도 최소 1시간 뒤로 자동 조정 (옵션)
    // 시작 분은 0으로 간주
    if (hour > endHour || (hour === endHour && 0 >= endMinute)) { // startMinute 대신 0 사용
      setEndHour(hour + 1 > 23 ? 23 : hour + 1);
      setEndMinute(0);
    }
  };

  // handleStartMinuteSelect 함수는 이미 제거됨 (또는 여기서 확실히 제거)

  const handleEndHourSelect = (hour: number) => {
    setEndHour(hour);
    setIsEndHourModalOpen(false);
    // 종료 시간이 시작 시간보다 이전으로 설정될 경우 시작 시간 조정 (시작 분은 0으로 간주)
    if (hour < startHour || (hour === startHour && endMinute <= 0)) { // startMinute 대신 0 사용
      setStartHour(hour - 1 < 0 ? 0 : hour - 1);
    }
  };

  const handleEndMinuteSelect = (minute: number) => {
    setEndMinute(minute);
    // 시작 시간과 종료 시간이 같고, 종료 분이 시작 분(0)보다 작거나 같으면 시작 시간 조정
     if (startHour === endHour && 0 >= minute) { // startMinute 대신 0 사용
        if (minute === 0) {
             setStartHour(startHour - 1 < 0 ? 0 : startHour -1);
        }
    }
  };

  const calculateTimes = (): { startTime: Date | null; endTime: Date | null } => {
    if (!appointmentDate) return { startTime: null, endTime: null };
    try {
      const start = setMinutes(setHours(appointmentDate, startHour), 0); // 시작 분은 0으로 고정
      const end = setMinutes(setHours(appointmentDate, endHour), endMinute);
      if (end <= start) {
        const defaultDuration = appointmentType === "PT" ? 60 : 30;
        return { startTime: start, endTime: new Date(start.getTime() + defaultDuration * 60000) };
      }
      return { startTime: start, endTime: end };
    } catch (e) {
      console.error("Error calculating times:", e);
      return { startTime: null, endTime: null };
    }
  };

  const handleSaveClick = async () => {
    const { startTime, endTime } = calculateTimes();
    if (!appointment || !selectedMember || !startTime || !endTime) {
      alert("회원과 시간을 정확히 선택해주세요.");
      return;
    }

    setIsSaving(true);
    const data: EditAppointmentData = {
      id: appointment.id, // 예약 ID 포함
      member: selectedMember,
      // Convert Date objects back to ISO strings (UTC) before saving
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      type: appointmentType,
      notes,
      // backgroundColor 제거
    };
    try {
      await onSave(data);
      onClose(); // 저장 성공 시 모달 닫기
    } catch (error) {
      console.error("Update failed:", error);
      // 오류 발생 시 모달 유지
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[480px]" aria-describedby="edit-appointment-description">
          <DialogHeader>
            <DialogTitle>예약 수정</DialogTitle>
            <DialogDescription id="edit-appointment-description">
              예약 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Member Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="member-select-button-edit" className="text-right">
                회원
              </Label>
              <div className="col-span-3">
                {/* MemberSelector를 직접 사용하는 대신, NewAppointmentModal처럼 버튼 클릭 시 Dialog로 열도록 수정 */}
                <Button
                  id="member-select-button-edit"
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
              <Label htmlFor="appointment-date-edit" className="text-right">
                날짜
              </Label>
              <div className="col-span-3">
                 <DatePicker date={appointmentDate} setDate={setAppointmentDate} />
              </div>
            </div>

            {/* Time Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-time-button-edit" className="text-right">
                시작 시간
              </Label>
              <div className="col-span-3">
                <Button
                  id="start-time-button-edit"
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10"
                  onClick={() => setIsStartHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" /> {/* opacity-50 제거 가정 (이전 단계에서 제거되었을 수 있음) */}
                  {String(startHour).padStart(2, '0')}시
                </Button>
                {/* 시작 시간 분 선택 Select 제거 */}
              </div>
            </div>

            {/* End Time Selection */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-time-button-edit" className="text-right">
                종료 시간
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2"> {/* grid로 변경하여 너비 동일하게 */}
                <Button
                  id="end-time-button-edit"
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-10" // flex-grow 제거, w-full 추가
                  onClick={() => setIsEndHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" /> {/* opacity-50 제거 가정 (이전 단계에서 제거되었을 수 있음) */}
                  {String(endHour).padStart(2, '0')}시
                </Button>
                <Select value={String(endMinute)} onValueChange={(value) => handleEndMinuteSelect(Number(value))}>
                  <SelectTrigger className="w-full h-10"> {/* w-[80px] ml-2 제거, w-full 추가 */}
                    <SelectValue placeholder="분" /> {/* placeholder 추가 */}
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
               <Label htmlFor="appointment-type-edit" className="text-right">
                 예약 종류
               </Label>
               <div className="col-span-3">
                 <Select value={appointmentType} onValueChange={(value: "PT" | "상담" | "측정") => setAppointmentType(value)}>
                   <SelectTrigger id="appointment-type-edit">
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
              <Label htmlFor="notes-edit" className="text-right">
                메모
              </Label>
              <Textarea
                id="notes-edit"
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
            isMobileView ? "flex-col space-y-2" : "sm:justify-end space-x-2"
          )}>
            {!isMobileView && (
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

      {/* Member Selection Modal (Dialog로 감싸기) */}
      {isMemberModalOpen && (
        <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>회원 선택</DialogTitle>
            </DialogHeader>
            <MemberSelector
              selectedMemberId={selectedMember ? selectedMember.id : null}
              onSelectMember={(memberId) => {
                handleMemberSelect(memberId);
                setIsMemberModalOpen(false); // 선택 후 모달 닫기
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMemberModalOpen(false)}>
                취소
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Start Hour Selection Modal */}
      <SelectHourModal
        isOpen={isStartHourModalOpen}
        onClose={() => setIsStartHourModalOpen(false)}
        onHourSelect={handleStartHourSelect}
        currentHour={startHour}
      />

      {/* End Hour Selection Modal */}
      <SelectHourModal
        isOpen={isEndHourModalOpen}
        onClose={() => setIsEndHourModalOpen(false)}
        onHourSelect={handleEndHourSelect}
        currentHour={endHour}
        minHour={startHour === endHour ? startHour : (startHour + 1 > 23 ? undefined : startHour + 1)}
      />
    </>
  );
};