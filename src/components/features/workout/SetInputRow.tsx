import React from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetData {
  id: string;
  weight: number | string;
  reps: number | string;
  // completed: boolean; // 완료 여부 필드 제거
}

interface SetInputRowProps {
  setIndex: number;
  setData: Omit<SetData, 'completed'>; // SetData에서 completed 제외
  onSetChange: (field: keyof Omit<SetData, 'completed'>, value: string | number) => void; // boolean 타입 제거
  onRemoveSet: () => void;
  isRemoveDisabled?: boolean;
}

// 숫자 증감 함수
const adjustNumericValue = (currentValue: number | string, delta: number): number | string => {
  const numericValue = parseFloat(String(currentValue));
  if (isNaN(numericValue)) {
    // 현재 값이 숫자가 아니면 delta 값으로 시작 (0 또는 1 등)
    return delta > 0 ? delta : 0;
  }
  const newValue = numericValue + delta;
  return newValue < 0 ? 0 : newValue; // 음수 방지
};

// 컴포넌트 정의
const SetInputRow: React.FC<SetInputRowProps> = ({
  setIndex,
  setData,
  onSetChange,
  onRemoveSet,
  isRemoveDisabled = false,
}) => {
  return (
    // 반응형 레이아웃: 기본 1열, sm 이상 4열로 변경 (완료 체크박스 제거로 인해)
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-x-3 gap-y-2 items-center">
      {/* 세트 번호 */}
      <div className="flex justify-between items-center w-full sm:w-auto">
        <span className="text-base font-medium text-foreground sm:pr-2">{setIndex + 1} 세트</span>
        {/* 작은 화면용 완료 스위치 제거 */}
      </div>

      {/* 무게 입력 그룹 */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">무게 (kg)</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
           className="h-9 w-9 flex-shrink-0"
           onClick={() => onSetChange('weight', adjustNumericValue(setData.weight, -1))}
         >
           <Minus className="h-4 w-4" />
         </Button>
         <Input
           type="number"
           placeholder="무게" // placeholder 스타일 추가
           value={setData.weight}
           onChange={(e) => onSetChange('weight', e.target.value)}
           className={cn(
             "h-9 text-left px-2 placeholder:text-xs", // placeholder 텍스트 크기 조정
             "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
           )}
           step={1} // 증감 단위
           min={0}
         />
         <Button
           variant="outline"
           size="icon"
           className="h-9 w-9 flex-shrink-0"
           onClick={() => onSetChange('weight', adjustNumericValue(setData.weight, 1))}
         >
           <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 횟수 입력 그룹 */}
      <div className="flex flex-col gap-1">
        {/* 횟수 라벨 텍스트 수정 */}
        <span className="text-xs text-muted-foreground">횟수 (reps)</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
           className="h-9 w-9 flex-shrink-0"
           onClick={() => onSetChange('reps', adjustNumericValue(setData.reps, -1))}
         >
           <Minus className="h-4 w-4" />
         </Button>
         <Input
           type="number"
           placeholder="횟수" // placeholder 스타일 추가
           value={setData.reps}
           onChange={(e) => onSetChange('reps', e.target.value)}
           className={cn(
             "h-9 text-left px-2 placeholder:text-xs", // placeholder 텍스트 크기 조정
             "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
           )}
           step={1}
           min={0}
         />
         <Button
           variant="outline"
           size="icon"
           className="h-9 w-9 flex-shrink-0"
           onClick={() => onSetChange('reps', adjustNumericValue(setData.reps, 1))}
         >
           <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 완료 체크박스 제거 */}

      {/* 작은 화면용 세트 삭제 버튼 컨테이너 */}
      <div className="w-full sm:hidden mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRemoveSet}
          disabled={isRemoveDisabled}
          className="w-full"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          세트 삭제
        </Button>
      </div>

      {/* sm 이상용 세트 삭제 버튼 (col-start-4로 변경) */}
      <div className="hidden sm:flex sm:justify-center sm:items-center sm:self-center sm:pt-5 sm:col-start-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemoveSet}
          disabled={isRemoveDisabled}
          className="h-8 w-8" // sm 이상 크기
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
 };

 // React.memo 제거
 export default SetInputRow;