import React from 'react';
import { ChevronUp } from 'lucide-react'; // ChevronUp 아이콘 import
import { cn } from '@/lib/utils';

export interface Range {
  label: string;
  min?: number;
  max?: number;
  colorClass: string;
}

interface BodyCompositionBarProps {
  label: string;
  value: number | null;
  unit: string;
  displayRanges: Range[];
  standardRange: { min: number; max: number };
  displayMin: number;
  displayMax: number;
  standardRangeLabel?: string;
  opacity?: number;
  isMobileView?: boolean;
}

export function BodyCompositionBar({
  label,
  value,
  unit,
  displayRanges,
  standardRange,
  displayMin,
  displayMax,
  standardRangeLabel,
  opacity,
  isMobileView = false,
}: BodyCompositionBarProps) {
  const barOpacity = opacity ?? 0.7;
  const totalDisplayRange = displayMax - displayMin;

  const valuePercentage = value !== null && totalDisplayRange > 0
    ? Math.max(0, Math.min(100, ((value - displayMin) / totalDisplayRange) * 100))
    : null;

  return (
    <div className="mb-3 relative">
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 relative z-10">{standardRangeLabel ?? `${standardRange.min.toFixed(1)} ~ ${standardRange.max.toFixed(1)} ${unit}`}</span>
      </div>
      <div className="relative h-5 bg-gray-200 dark:bg-gray-700 rounded">
        {displayRanges.map((range, index) => {
          const rangeMin = range.min ?? displayMin;
          const rangeMax = range.max ?? displayMax;
          const left = ((rangeMin - displayMin) / totalDisplayRange) * 100;
          const width = Math.max(0, ((rangeMax - rangeMin) / totalDisplayRange) * 100);

          const isValueInRange = value !== null && value >= rangeMin && value < rangeMax;
          const isLastRange = index === displayRanges.length - 1;
          const isValueInLastRange = isLastRange && value !== null && value >= rangeMin && value <= rangeMax;
          const separatorLeft = left + width;

          return (
            <React.Fragment key={index}>
              <div
                className={cn(
                  "absolute top-0 h-full",
                  range.colorClass,
                  (isValueInRange || isValueInLastRange) && "animate-pulse-bg",
                  index === 0 && "rounded-l",
                  isLastRange && "rounded-r"
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  opacity: barOpacity,
                }}
              >
                <span className={cn(
                  "absolute inset-0 flex items-center justify-center font-medium text-gray-700 dark:text-gray-700 overflow-hidden whitespace-nowrap px-0.5",
                  isMobileView ? "text-[7px]" : "text-[10px]" // 모바일에서 7px, 데스크톱에서 10px로 더 명확히 구분
                )}>
                  {range.label}
                </span>
              </div>
              {!isLastRange && width > 0 && (
                <div
                  className="absolute top-0 h-full w-px bg-white dark:bg-black"
                  style={{
                    left: `${separatorLeft}%`,
                    zIndex: 1,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {valuePercentage !== null && (
          <div
            className={cn(
              "absolute left-0 flex flex-col items-center z-20",
              "top-full mt-1" // 모바일과 동일하게 그래프 바 아래로 위치 고정
            )}
            style={{ left: `${valuePercentage}%`, transform: `translateX(-50%) translateY(0px)` }} // translateY 고정
          >
            {/* 위를 향하는 v 아이콘과 현재값 표시 */}
            <div className="flex flex-col items-center">
              <ChevronUp className={cn(
                "text-green-600 dark:text-green-400",
                isMobileView ? "w-3 h-3" : "w-3.5 h-3.5" // PC에서 아이콘 약간 크게
              )} />
              <span className={cn(
                "font-semibold mt-0.5",
                isMobileView ? "text-[8px] text-green-700 dark:text-green-500" : "text-xs text-green-700 dark:text-green-500" // PC에서 텍스트 약간 크게
              )}>
                {value?.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

       <div className="relative mt-1.5 h-3.5">
         {(() => {
           const tickValues = Array.from(
             new Set(
               [
                 displayMin,
                 ...displayRanges.flatMap(r => [r.min, r.max])
                   .filter((v): v is number => v !== undefined && v >= displayMin && v <= displayMax),
                 displayMax
               ]
             )
           ).sort((a, b) => a - b);

           return tickValues.map((tickVal) => {
             if (tickVal === null || tickVal === undefined) return null;
             const currentTickPercentage = ((tickVal - displayMin) / totalDisplayRange) * 100;
             const clampedPercentage = Math.max(0, Math.min(100, currentTickPercentage));

             return (
               <div key={`tick-${tickVal}`} className="absolute top-0 h-0" style={{ left: `${clampedPercentage}%` }}>
                 <div className="absolute top-full left-1/2 transform -translate-x-1/2 bg-transparent border-none pt-0.5">
                   <span className="text-[0.6rem] text-gray-500 dark:text-gray-400">{tickVal.toFixed(0)}</span>
                 </div>
               </div>
             );
           });
         })()}
       </div>
    </div>
  );
}

export default BodyCompositionBar;