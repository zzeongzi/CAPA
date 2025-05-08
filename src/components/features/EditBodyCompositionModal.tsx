import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// members 테이블 정보 포함하도록 확장
interface BodyCompositionLog {
  id: string;
  member_id: string;
  measurement_date: string;
  weight_kg: number | null;
  skeletal_muscle_mass_kg: number | null;
  body_fat_percentage: number | null;
  bmi: number | null;
  height_cm: number | null;
  notes: string | null;
  members: { // members 정보 추가
    gender: string | null;
  } | null;
}

interface EditBodyCompositionModalProps {
  log: BodyCompositionLog | null; // 업데이트된 타입 사용
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void; // Callback after saving
}

// 평가 카테고리 타입 정의
type EvaluationCategory = '낮음' | '표준' | '높음' | '과체중' | '비만(1단계)' | '비만(2단계)' | '비만(3단계)' | '저체중' | '';

// 평가 기준 함수들 (임시 기준 적용)
const getWeightCategory = (bmi: number | null): EvaluationCategory => {
  if (bmi === null) return '';
  if (bmi < 18.5) return '저체중';
  if (bmi < 23) return '표준'; // '정상체중' 대신 '표준' 사용 통일
  if (bmi < 25) return '과체중';
  if (bmi < 30) return '비만(1단계)';
  if (bmi < 35) return '비만(2단계)';
  return '비만(3단계)';
};

const getMuscleMassCategory = (muscleMass: number | null, weight: number | null, gender: string | null): EvaluationCategory => {
  if (muscleMass === null || weight === null || weight <= 0 || gender === null) return '';
  const standardRatio = gender === 'male' ? 0.45 : 0.40; // 남성 45%, 여성 40% 기준 (임시)
  const ratio = muscleMass / weight;
  // 임시 기준: 표준 비율의 +- 10% 범위
  if (ratio < standardRatio * 0.9) return '낮음';
  if (ratio > standardRatio * 1.1) return '높음';
  return '표준';
};

const getBodyFatCategory = (fatPercentage: number | null, gender: string | null): EvaluationCategory => {
  if (fatPercentage === null || gender === null) return '';
  const [min, max] = gender === 'male' ? [10, 20] : [18, 28]; // 남성 10-20%, 여성 18-28% 기준 (임시)
  if (fatPercentage < min) return '낮음';
  if (fatPercentage > max) return '높음';
  return '표준';
};

// 카테고리별 텍스트 색상 반환 함수
const getCategoryColor = (category: EvaluationCategory): string => {
  switch (category) {
    case '저체중':
    case '낮음':
      return 'text-blue-600';
    case '표준':
      return 'text-green-600';
    case '과체중':
    case '높음':
      return 'text-yellow-600';
    case '비만(1단계)':
    case '비만(2단계)':
    case '비만(3단계)':
      return 'text-red-600';
    default:
      return 'text-gray-500'; // 기본값 또는 빈 값
  }
};


export function EditBodyCompositionModal({ log, isOpen, onClose, onSaved }: EditBodyCompositionModalProps) {
  const { toast } = useToast();
  const [measurementDate, setMeasurementDate] = useState<Date | undefined>();
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [muscleMass, setMuscleMass] = useState<string>('');
  const [fatPercentage, setFatPercentage] = useState<string>('');
  const [bmi, setBmi] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [gender, setGender] = useState<string | null>(null); // 성별 상태 추가

  // 평가 카테고리 상태 추가
  const [weightCategory, setWeightCategory] = useState<EvaluationCategory>('');
  const [muscleMassCategory, setMuscleMassCategory] = useState<EvaluationCategory>('');
  const [fatPercentageCategory, setFatPercentageCategory] = useState<EvaluationCategory>('');
  const [bmiCategory, setBmiCategory] = useState<EvaluationCategory>(''); // BMI 분류 상태 타입 변경


  useEffect(() => {
    if (log) {
      try {
        setMeasurementDate(parseISO(log.measurement_date));
      } catch {
        setMeasurementDate(undefined); // Handle invalid date string
      }
      setWeight(log.weight_kg?.toString() ?? '');
      setHeight(log.height_cm?.toString() ?? '');
      setMuscleMass(log.skeletal_muscle_mass_kg?.toString() ?? '');
      setFatPercentage(log.body_fat_percentage?.toString() ?? '');
      setBmi(log.bmi?.toString() ?? '');
      setNotes(log.notes ?? '');
      setGender(log.members?.gender ?? null); // 성별 설정

      // 초기 카테고리 설정
      const initialBmi = log.bmi;
      const initialWeight = log.weight_kg;
      const initialMuscleMass = log.skeletal_muscle_mass_kg;
      const initialFatPercentage = log.body_fat_percentage;
      const initialGender = log.members?.gender ?? null;

      setBmiCategory(getWeightCategory(initialBmi)); // BMI 카테고리는 체중 카테고리 기준 사용
      setWeightCategory(getWeightCategory(initialBmi)); // 초기 체중 카테고리 (BMI 기반)
      setMuscleMassCategory(getMuscleMassCategory(initialMuscleMass, initialWeight, initialGender));
      setFatPercentageCategory(getBodyFatCategory(initialFatPercentage, initialGender));

    } else {
      // Reset form when log is null
      setMeasurementDate(undefined);
      setWeight('');
      setHeight('');
      setMuscleMass('');
      setFatPercentage('');
      setBmi('');
      setNotes('');
      setGender(null);
      setWeightCategory('');
      setMuscleMassCategory('');
      setFatPercentageCategory('');
      setBmiCategory('');
    }
  }, [log]);

  // BMI 계산 함수
  const calculateBmi = (weightKg: number, heightCm: number): number | null => {
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      return weightKg / (heightM * heightM);
    }
    return null;
  };

  // 입력값 변경 시 카테고리 업데이트
  useEffect(() => {
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const muscleMassNum = parseFloat(muscleMass);
    const fatPercentageNum = parseFloat(fatPercentage);

    // BMI 및 체중 카테고리 업데이트
    const calculatedBmi = calculateBmi(weightNum, heightNum);
    if (calculatedBmi !== null) {
      // BMI를 소수점 첫째 자리까지 반올림하여 표시
      setBmi(calculatedBmi.toFixed(1));
      const category = getWeightCategory(calculatedBmi);
      setBmiCategory(category);
      setWeightCategory(category); // 체중 카테고리도 BMI 기준으로 업데이트
    } else {
      setBmi('');
      setBmiCategory('');
      setWeightCategory('');
    }

    // 골격근량 카테고리 업데이트
    setMuscleMassCategory(getMuscleMassCategory(muscleMassNum, weightNum, gender));

    // 체지방률 카테고리 업데이트
    setFatPercentageCategory(getBodyFatCategory(fatPercentageNum, gender));

  }, [weight, height, muscleMass, fatPercentage, gender]);


  const handleSave = async () => {
    if (!log || !measurementDate) {
      toast({ title: "오류", description: "수정할 데이터가 올바르지 않습니다.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('body_composition_logs')
        .update({
          measurement_date: format(measurementDate, 'yyyy-MM-dd'),
          weight_kg: weight ? parseFloat(weight) : null,
          height_cm: height ? parseFloat(height) : null,
          skeletal_muscle_mass_kg: muscleMass ? parseFloat(muscleMass) : null,
          body_fat_percentage: fatPercentage ? parseFloat(fatPercentage) : null,
          bmi: bmi ? parseFloat(bmi) : null,
          notes: notes || null,
        })
        .eq('id', log.id);

      if (error) throw error;

      toast({ title: "성공", description: "체성분 정보가 수정되었습니다." });
      onSaved(); // Notify parent component
      onClose(); // Close modal
    } catch (error) {
      console.error('Error updating body composition:', error);
      toast({ title: "수정 오류", description: "정보 수정 중 오류 발생", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent closing modal when clicking outside or pressing Esc if loading
  const handleInteractOutside = (event: Event) => {
    if (isLoading) {
      event.preventDefault();
    }
  };

  const handleEscapeKeyDown = (event: KeyboardEvent) => {
    if (isLoading) {
      event.preventDefault();
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onClose()}>
      <DialogContent
        className="sm:max-w-[600px]"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        <DialogHeader>
          <DialogTitle>체성분 기록 수정</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Measurement Date */}
          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="editMeasurementDate" className="text-right">측정 날짜</Label>
             <Popover>
               <PopoverTrigger asChild>
                 <Button
                   variant={"outline"}
                   className={cn(
                     "col-span-3 justify-start text-left font-normal",
                     !measurementDate && "text-muted-foreground"
                   )}
                   disabled={isLoading}
                 >
                   <CalendarIcon className="mr-2 h-4 w-4" />
                   {measurementDate ? format(measurementDate, 'PPP', { locale: ko }) : <span>날짜 선택</span>}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0">
                 <Calendar
                   mode="single"
                   selected={measurementDate}
                   onSelect={setMeasurementDate}
                   initialFocus
                   locale={ko}
                   disabled={isLoading}
                 />
               </PopoverContent>
             </Popover>
           </div>
          {/* Weight */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editWeight" className="text-right">체중 (kg)</Label>
            <div className="col-span-3 relative">
              <Input id="editWeight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="pr-20" disabled={isLoading} />
              {weightCategory && (
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <p className={cn("text-sm", getCategoryColor(weightCategory))}>
                    {weightCategory}
                  </p>
                </div>
              )}
            </div>
          </div>
           {/* Height */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editHeight" className="text-right">신장 (cm)</Label>
            <Input id="editHeight" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="col-span-3" disabled={isLoading} />
          </div>
          {/* Muscle Mass */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editMuscleMass" className="text-right">골격근량 (kg)</Label>
             <div className="col-span-3 relative">
              <Input id="editMuscleMass" type="number" step="0.1" value={muscleMass} onChange={(e) => setMuscleMass(e.target.value)} className="pr-20" disabled={isLoading} />
              {muscleMassCategory && (
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <p className={cn("text-sm", getCategoryColor(muscleMassCategory))}>
                    {muscleMassCategory}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Fat Percentage */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editFatPercentage" className="text-right">체지방률 (%)</Label>
             <div className="col-span-3 relative">
              <Input id="editFatPercentage" type="number" step="0.1" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} className="pr-20" disabled={isLoading} />
              {fatPercentageCategory && (
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <p className={cn("text-sm", getCategoryColor(fatPercentageCategory))}>
                    {fatPercentageCategory}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* BMI (자동 계산됨) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editBmi" className="text-right">BMI</Label>
            <div className="col-span-3 relative">
              <Input id="editBmi" type="number" step="0.01" value={bmi} readOnly placeholder="자동 계산" className="bg-muted pr-20" disabled={isLoading} />
              {bmiCategory && (
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <p className={cn("text-sm", getCategoryColor(bmiCategory))}>
                    {bmiCategory}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Notes */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="editNotes" className="text-right">메모</Label>
            <Textarea id="editNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" disabled={isLoading} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
             <Button type="button" variant="outline" disabled={isLoading}>취소</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isLoading}>
            {isLoading ? '저장 중...' : '변경사항 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}