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
import { SelectUserModal } from '@/components/features/SelectUserModal';
import { Member, useMembers } from '@/hooks/use-members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import DatePicker from '@/components/features/workout/DatePicker';
import { SelectHourModal } from '@/components/features/workout/SelectHourModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setHours, setMinutes, getHours } from 'date-fns';
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
  const [appointmentType, setAppointmentType] = useState<"PT" | "상담" | "측정">("PT");
  const [notes, setNotes] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>("#1d4ed8ff");
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHourModalOpen, setIsHourModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { members } = useMembers(); // 회원 목록 가져오기

  // 모달이 열리거나 appointment prop이 변경될 때 상태 초기화
  useEffect(() => {
    if (isOpen && appointment) {
      const member = members.find(m => m.id === appointment.memberId);
      setSelectedMember(member || null);
      // Parse ISO strings to Date objects for state
      setAppointmentDate(appointment.start ? new Date(appointment.start) : undefined);
      setStartHour(appointment.start ? getHours(new Date(appointment.start)) : new Date().getHours());
      // appointment.type이 유효한 값인지 확인 후 설정
      const validTypes = ["PT", "상담", "측정"];
      const appointmentTypeToSet = appointment.type && validTypes.includes(appointment.type)
        ? appointment.type as "PT" | "상담" | "측정"
        : "PT"; // 유효하지 않으면 기본값 "PT"
      setAppointmentType(appointmentTypeToSet);
      setNotes(appointment.notes || '');
      setSelectedColor(appointment.backgroundColor || "#1d4ed8ff");
      setIsSaving(false);
    } else if (!isOpen) {
      // 모달이 닫힐 때 상태 초기화 (선택 사항)
      setSelectedMember(null);
      setAppointmentDate(new Date());
      setStartHour(new Date().getHours());
      setAppointmentType('PT');
      setNotes('');
      setSelectedColor("#1d4ed8ff");
    }
  }, [isOpen, appointment, members]);

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    setIsMemberModalOpen(false);
  };

  const handleHourSelect = (hour: number) => {
    setStartHour(hour);
    setIsHourModalOpen(false);
  };

  const calculateTimes = (): { startTime: Date | null; endTime: Date | null } => {
    if (!appointmentDate) return { startTime: null, endTime: null };
    try {
      const start = setMinutes(setHours(appointmentDate, startHour), 0);
      const end = new Date(start.getTime() + 60 * 60000); // duration 60분 고정
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
      backgroundColor: selectedColor,
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
                  onClick={() => setIsHourModalOpen(true)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {String(startHour).padStart(2, '0')}:00
                </Button>
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
                     <SelectItem value="PT">PT (60분)</SelectItem>
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

            {/* 배경색 선택 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="backgroundColor-edit" className="text-right">배경색</Label>
              <div className="col-span-3 flex flex-col gap-2">
                <HexAlphaColorPicker color={selectedColor} onChange={setSelectedColor} style={{ width: '100%', height: '150px' }}/>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded border flex-shrink-0" style={{ backgroundColor: selectedColor }}></div>
                  <Input
                    id="backgroundColorInput-edit"
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