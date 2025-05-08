import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface WorkoutNotesProps {
  // memberId: string | null; // 추후 사용
  // date: Date | undefined; // 추후 사용
  initialNotes?: string; // 초기 메모 값 (옵션)
  onNotesChange?: (notes: string) => void; // 메모 변경 시 콜백 (옵션)
}

const WorkoutNotes: React.FC<WorkoutNotesProps> = ({
  initialNotes = "",
  onNotesChange,
}) => {
  const [notes, setNotes] = useState(initialNotes);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = event.target.value;
    setNotes(newNotes);
    if (onNotesChange) {
      onNotesChange(newNotes);
    }
  };

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor="workout-notes">메모</Label>
      <Textarea
        placeholder="수업 중 특이사항이나 회원의 컨디션 등을 기록하세요..."
        id="workout-notes"
        value={notes}
        onChange={handleChange}
        rows={4} // 기본 높이 설정
        className="resize-none" // 크기 조절 비활성화 (옵션)
      />
      {/* TODO: 음성 입력 버튼 추가 고려 */}
    </div>
  );
};

export default WorkoutNotes;