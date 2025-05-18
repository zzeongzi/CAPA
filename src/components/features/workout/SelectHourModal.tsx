import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectHourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHourSelect: (hour: number) => void;
  currentHour: number; // 현재 선택된 시간 강조 표시용
  minHour?: number; // 최소 선택 가능 시간 (optional)
}

export const SelectHourModal: React.FC<SelectHourModalProps> = ({
  isOpen,
  onClose,
  onHourSelect,
  currentHour,
  minHour,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0부터 23까지 시간 배열

  const handleSelect = (hour: number) => {
    onHourSelect(hour);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[300px]"> {/* 너비 조정 */}
        <DialogHeader>
          <DialogTitle>시간 선택 (정시)</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] border rounded-md mt-4">
          <div className="p-2 grid grid-cols-4 gap-2"> {/* 4열 그리드 */}
            {hours.map((hour) => (
              <Button
                key={hour}
                variant={hour === currentHour ? 'default' : 'outline'} // 현재 시간 강조
                className="w-full h-12 text-sm" // 버튼 크기 및 텍스트 크기 조정
                onClick={() => handleSelect(hour)}
                disabled={minHour !== undefined && hour < minHour} // minHour보다 작은 시간 비활성화
              >
                {String(hour).padStart(2, '0')}:00
              </Button>
            ))}
          </div>
        </ScrollArea>
        {/* 확인/취소 버튼 제거 (선택 시 바로 닫힘) */}
      </DialogContent>
    </Dialog>
  );
};