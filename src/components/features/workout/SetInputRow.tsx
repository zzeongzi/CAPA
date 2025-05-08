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
  completed: boolean;
}

interface SetInputRowProps {
  setIndex: number;
  setData: SetData;
  onSetChange: (field: keyof SetData, value: string | number | boolean) => void;
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
    // 반응형 레이아웃: 기본 1열, sm 이상 5열. 각 입력 그룹에 라벨 추가
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto_auto] gap-x-3 gap-y-2 items-center">
      {/* 세트 번호 및 작은 화면용 완료 스위치 컨테이너 */}
      <div className="flex justify-between items-center w-full sm:w-auto">
        {/* 세트 번호 스타일 수정: 글자색, 크기 */}
        <span className="text-base font-medium text-foreground sm:pr-2">{setIndex + 1} 세트</span>
        {/* 작은 화면용 완료 스위치 (sm 이상 숨김) */}
        <div className="flex items-center space-x-2 sm:hidden">
          <Switch
            id={`set-${setData.id}-completed-sm`} // 고유 ID 부여 (sm 용)
            checked={setData.completed}
            onCheckedChange={(checked) => onSetChange('completed', checked)}
            aria-label="세트 완료"
          />
          <label htmlFor={`set-${setData.id}-completed-sm`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            완료
          </label>
        </div>
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

      {/* 완료 및 삭제 버튼 그룹 (sm 이상에서만 옆으로) */}
      {/* 완료 체크박스 (반응형: 작은 화면에서는 삭제 버튼과 함께 표시, sm 이상에서는 중앙 정렬) */}
      {/* sm 이상용 완료 체크박스 (정렬 조정: self-center 및 pt-5 추가) */}
      <div className="hidden sm:flex sm:justify-center sm:items-center sm:self-center sm:pt-5 sm:col-start-4">
        <Checkbox
          checked={setData.completed}
          onCheckedChange={(checked) => onSetChange('completed', !!checked)}
          className="h-5 w-5" // sm 이상에서만 표시
        />
      </div>

      {/* 작은 화면용 세트 삭제 버튼 컨테이너 (세트 추가 버튼과 유사하게) */}
      <div className="w-full sm:hidden mt-2"> {/* sm 이상 숨김, 상단 마진 추가 */}
        <Button
          variant="outline" // 작은 화면용 variant
          size="sm" // 작은 화면용 size
          onClick={onRemoveSet}
          disabled={isRemoveDisabled}
          className="w-full" // 전체 너비 차지
        >
          <Trash2 className="mr-2 h-4 w-4" /> {/* 아이콘 왼쪽으로, 마진 추가 */}
          세트 삭제
        </Button>
      </div>

      {/* sm 이상용 세트 삭제 버튼 (정렬 조정: self-center 및 pt-5 추가) */}
      <div className="hidden sm:flex sm:justify-center sm:items-center sm:self-center sm:pt-5 sm:col-start-5">
        <Button
          variant="ghost" // sm 이상 variant
          size="icon" // sm 이상 size
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