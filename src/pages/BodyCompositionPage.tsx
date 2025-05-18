import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom'; // useLocation 추가
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Layers } from 'lucide-react'; // Layers 아이콘 추가
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast'; // useToast 훅 임포트
import { BodyCompositionBar, Range } from '@/components/features/BodyCompositionBar'; // 바 그래프 컴포넌트 및 Range 타입 임포트 (type 키워드 제거)

interface Member {
  id: string;
  name: string;
  gender: string | null; // gender 추가
  birth_date?: string | null; // birth_date 추가 (nullable)
}

interface BodyCompositionLog {
  id: string;
  member_id: string;
  measurement_date: string;
  weight_kg: number | null;
  skeletal_muscle_mass_kg: number | null;
  body_fat_percentage: number | null;
  bmi: number | null;
  height_cm: number | null; // height_cm 추가
  notes: string | null;
  created_at: string;
  members?: Member; // Optional members relation
}

export function BodyCompositionPage() {
  const { user, userCenter } = useAuth();
  const location = useLocation(); // useLocation 사용
  const { toast } = useToast(); // 토스트 훅 사용
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedMemberGender, setSelectedMemberGender] = useState<string | null>(null); // 선택된 회원 성별 상태 추가
  const [selectedMemberBirthDate, setSelectedMemberBirthDate] = useState<string | null>(null); // 선택된 회원 생년월일 상태 추가
  const [selectedMemberAge, setSelectedMemberAge] = useState<number | null>(null); // 선택된 회원 나이 상태 추가
  const [measurementDate, setMeasurementDate] = useState<Date | undefined>(new Date());
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>(''); // height 상태 추가
  const [muscleMass, setMuscleMass] = useState<string>('');
  const [fatPercentage, setFatPercentage] = useState<string>('');
  const [bmi, setBmi] = useState<string>('');
  // const [bmiCategory, setBmiCategory] = useState<string>(''); // BMI 분류 상태 제거
  // const [weightCategory, setWeightCategory] = useState<string>(''); // 체중 분류 상태 제거
  // const [smiCategory, setSmiCategory] = useState<string>(''); // 골격근량(SMI) 분류 상태 제거
  // const [fatPercentageCategory, setFatPercentageCategory] = useState<string>(''); // 체지방률 분류 상태 제거
  const [notes, setNotes] = useState<string>('');
  const [recentLogs, setRecentLogs] = useState<BodyCompositionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [barOpacity, setBarOpacity] = useState(0.7); // 바 투명도 상태 추가 (초기값 0.7)

  // Fetch members for the select dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      if (!userCenter) return;
      try {
        const { data, error } = await supabase
          .from('members')
          .select('id, name, gender, birth_date') // birth_date 조회 추가
          .eq('center_id', userCenter)
          .order('name', { ascending: true });
        if (error) throw error;
        // Supabase 타입 추론 문제 해결을 위해 명시적 타입 캐스팅 추가
        setMembers((data as Member[]) || []);
      } catch (error) {
        console.error('Error fetching members:', error);
        toast({
          title: "오류",
          description: "회원 목록을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };
    fetchMembers();
  }, [userCenter, toast]);

  // Handle member selection from navigation state
  useEffect(() => {
    const state = location.state as { selectedMember?: { id?: string } }; // ptSessionId는 아직 사용 안 함
    if (state?.selectedMember?.id && members.length > 0) {
      const memberExists = members.some(m => m.id === state.selectedMember.id);
      if (memberExists) {
        setSelectedMemberId(state.selectedMember.id);
        // Clear location state after using it
        window.history.replaceState({}, document.title)
      } else {
        console.warn(`Member with id ${state.selectedMember.id} not found in the members list.`);
        toast({
          title: "알림",
          description: "선택된 회원을 찾을 수 없습니다. 목록에서 직접 선택해주세요.",
          variant: "default",
        });
      }
    }
  }, [location.state, members, toast]);


  // Fetch recent logs for the selected member
  const fetchRecentLogs = useCallback(async (memberId: string) => {
    if (!memberId) {
      setRecentLogs([]);
      return;
    }
    setIsFetchingLogs(true);
    try {
      const { data, error } = await supabase
        .from('body_composition_logs')
        .select('*')
        .eq('member_id', memberId)
        .order('measurement_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      setRecentLogs(data || []);
    } catch (error) {
      console.error('Error fetching recent logs:', error);
      toast({
        title: "오류",
        description: "최근 측정 기록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingLogs(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchRecentLogs(selectedMemberId);
    } else {
      setRecentLogs([]);
    }
  }, [selectedMemberId, fetchRecentLogs]);

  // 나이 계산 함수
  const calculateAge = (birthDateString: string | null | undefined): number | null => {
    if (!birthDateString) return null;
    if (!birthDateString) return null;
    try {
      const birthDate = parseISO(birthDateString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (error) {
      console.error("Error parsing birth date:", error);
      return null;
    }
  };

  // 선택된 회원 변경 시 성별, 생년월일, 나이 업데이트
  useEffect(() => {
    const member = members.find(m => m.id === selectedMemberId);
    setSelectedMemberGender(member?.gender || null);
    setSelectedMemberBirthDate(member?.birth_date || null);
    setSelectedMemberAge(calculateAge(member?.birth_date));
  }, [selectedMemberId, members]);

  // 표준 체중 계산 함수
  const calculateStandardWeight = (heightCm: number): number | null => {
    if (heightCm <= 0) return null;
    const standardWeight = (heightCm - 100) * 0.9;
    return standardWeight > 0 ? standardWeight : null;
  };

  // SMM 기준 가져오기 함수
  const getSmmCriteria = (gender: string | null, age: number | null): {
    displayRanges: Range[];
    standardRange: { min: number; max: number };
    displayMin: number;
    displayMax: number;
    standardRangeLabel: string;
  } => {
    let ranges: Range[] = [];
    let standard: { min: number; max: number } = { min: 0, max: 0 };
    let displayMinVal = 10; // 기본 최소값
    let displayMaxVal = 65; // 기본 최대값
    let standardLabel = '-';

    if (gender === 'male' && age !== null) {
      if (age >= 20 && age <= 39) {
        standard = { min: 33.3, max: 39.5 };
        ranges = [
          { label: '낮음', max: 33.3, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 33.3, max: 39.5, colorClass: 'bg-green-200' },
          { label: '높음', min: 39.5, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 25; displayMaxVal = 60; standardLabel = '33.3 ~ 39.5 kg'; // displayMaxVal 65 -> 60
      } else if (age >= 40 && age <= 59) {
        standard = { min: 30.0, max: 36.7 };
        ranges = [
          { label: '낮음', max: 30.0, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 30.0, max: 36.7, colorClass: 'bg-green-200' },
          { label: '높음', min: 36.7, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 20; displayMaxVal = 60; standardLabel = '30.0 ~ 36.7 kg'; // displayMaxVal 65 -> 60
      } else if (age >= 60 && age <= 79) {
        standard = { min: 25.7, max: 31.7 };
        ranges = [
          { label: '낮음', max: 25.7, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 25.7, max: 31.7, colorClass: 'bg-green-200' },
          { label: '높음', min: 31.7, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 15; displayMaxVal = 60; standardLabel = '25.7 ~ 31.7 kg'; // displayMaxVal 65 -> 60
      }
    } else if (gender === 'female' && age !== null) {
      if (age >= 20 && age <= 39) {
        standard = { min: 22.1, max: 26.5 };
        ranges = [
          { label: '낮음', max: 22.1, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 22.1, max: 26.5, colorClass: 'bg-green-200' },
          { label: '높음', min: 26.5, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 15; displayMaxVal = 60; standardLabel = '22.1 ~ 26.5 kg'; // displayMaxVal 65 -> 60
      } else if (age >= 40 && age <= 59) {
        standard = { min: 21.1, max: 24.9 };
        ranges = [
          { label: '낮음', max: 21.1, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 21.1, max: 24.9, colorClass: 'bg-green-200' },
          { label: '높음', min: 24.9, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 10; displayMaxVal = 60; standardLabel = '21.1 ~ 24.9 kg'; // displayMaxVal 65 -> 60
      } else if (age >= 60 && age <= 79) {
        standard = { min: 18.2, max: 21.8 };
        ranges = [
          { label: '낮음', max: 18.2, colorClass: 'bg-yellow-200' },
          { label: '정상', min: 18.2, max: 21.8, colorClass: 'bg-green-200' },
          { label: '높음', min: 21.8, max: 55, colorClass: 'bg-blue-200' }, // max 60 -> 55
          { label: '범위 초과', min: 55, colorClass: 'bg-purple-200' }, // min 60 -> 55
        ];
        displayMinVal = 10; displayMaxVal = 60; standardLabel = '18.2 ~ 21.8 kg'; // displayMaxVal 65 -> 60
      }
    }

    // 기본값 또는 계산된 값 반환
    return {
      displayRanges: ranges,
      standardRange: standard,
      displayMin: displayMinVal,
      displayMax: displayMaxVal,
      standardRangeLabel: standardLabel,
    };
  };

  // BMI 계산 함수
  const calculateBmi = (weightKg: number, heightCm: number): number | null => {
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      return weightKg / (heightM * heightM);
    }
    return null;
  };

  // BMI 계산 함수 (기존 getBmiCategory 제거)
  // const getBmiCategory = ...

  // 체중, 키 변경 시 BMI 자동 계산
  useEffect(() => {
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    // BMI 계산
    const calculatedBmi = calculateBmi(weightNum, heightNum);
    setBmi(calculatedBmi !== null ? calculatedBmi.toFixed(2) : '');

    // 분류 계산 로직 제거
    // setWeightCategory(getWeightCategory(weightNum, heightNum));
    // setSmiCategory(getSmiCategory(muscleMassNum, heightNum, selectedMemberGender));
    // setFatPercentageCategory(getFatPercentageCategory(fatPercentageNum, selectedMemberGender));

  }, [weight, height]); // 의존성 배열에서 muscleMass, fatPercentage, selectedMemberGender 제거


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !measurementDate || !userCenter) {
      toast({
        title: "입력 오류",
        description: "회원과 측정 날짜를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('body_composition_logs')
        .insert({
          member_id: selectedMemberId,
          center_id: userCenter,
          measurement_date: format(measurementDate, 'yyyy-MM-dd'),
          weight_kg: weight ? parseFloat(weight) : null,
          height_cm: height ? parseFloat(height) : null, // height_cm 저장 추가
          skeletal_muscle_mass_kg: muscleMass ? parseFloat(muscleMass) : null,
          body_fat_percentage: fatPercentage ? parseFloat(fatPercentage) : null,
          bmi: bmi ? parseFloat(bmi) : null, // 자동 계산된 BMI 저장
          notes: notes || null,
        });

      if (error) throw error;

      toast({
        title: "성공",
        description: "체성분 정보가 성공적으로 저장되었습니다.",
      });
      // Reset form
      // setSelectedMemberId(''); // Optionally keep member selected
      setMeasurementDate(new Date());
      setWeight('');
      setHeight(''); // height 초기화 추가
      setMuscleMass('');
      setFatPercentage('');
      setBmi('');
      // setBmiCategory(''); // 제거
      // setWeightCategory(''); // 제거
      // setSmiCategory(''); // 제거
      // setFatPercentageCategory(''); // 제거
      setNotes('');
      // Refetch logs for the selected member
      fetchRecentLogs(selectedMemberId);
    } catch (error) {
      console.error('Error saving body composition:', error);
      toast({
        title: "저장 오류",
        description: "체성분 정보 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 바 투명도 토글 함수
  const toggleBarOpacity = () => {
    setBarOpacity(prev => prev === 0.7 ? 1.0 : 0.7); // 0.7과 1.0 토글
  };

  const formatDateDisplay = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'yyyy년 MM월 dd일');
    } catch {
      return '날짜 오류';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">체성분 측정</h1>

      <Card>
        <CardHeader>
          <CardTitle>새 측정 기록 입력</CardTitle>
          <CardDescription>회원의 체성분 측정 결과를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Member Selection */}
              <div>
                <Label htmlFor="member">회원 선택</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger id="member">
                    <SelectValue placeholder="회원을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} {/* last_name, first_name 대신 name 사용 */}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Measurement Date */}
              <div>
                <Label htmlFor="measurementDate">측정 날짜</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !measurementDate && "text-muted-foreground"
                      )}
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
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Weight */}
              <div>
                <Label htmlFor="weight">체중 (kg)</Label>
                <Input id="weight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="예: 75.5" />
              </div>
               {/* Height */}
              <div>
                <Label htmlFor="height">신장 (cm)</Label>
                <Input id="height" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="예: 175.0" />
              </div>
              {/* Muscle Mass */}
              <div>
                <Label htmlFor="muscleMass">골격근량 (kg)</Label>
                <Input id="muscleMass" type="number" step="0.1" value={muscleMass} onChange={(e) => setMuscleMass(e.target.value)} placeholder="예: 35.2" />
              </div>
              {/* Fat Percentage */}
              <div>
                <Label htmlFor="fatPercentage">체지방률 (%)</Label>
                <Input id="fatPercentage" type="number" step="0.1" value={fatPercentage} onChange={(e) => setFatPercentage(e.target.value)} placeholder="예: 18.3" />
              </div>
              {/* BMI Input 제거 */}
            </div>

            {/* 바 그래프 표시 영역 */}
            <div className="pt-6 border-t">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">체성분 분석 결과</h3>
                <Button type="button" variant="ghost" size="icon" onClick={toggleBarOpacity} title={barOpacity === 0.7 ? "배경 진하게" : "배경 연하게"}> {/* title 텍스트 수정 */}
                  <Layers className="h-5 w-5" />
                </Button>
              </div>
              {/* 모든 필수 입력값이 유효한 숫자인 경우에만 그래프 렌더링 */}
              {selectedMemberId && weight && height && muscleMass && fatPercentage &&
               !isNaN(parseFloat(weight)) && !isNaN(parseFloat(height)) &&
               !isNaN(parseFloat(muscleMass)) && !isNaN(parseFloat(fatPercentage)) && (
                <div className="space-y-6">
                  {/* 체중 바 그래프 */}
                  <BodyCompositionBar
                    label="체중"
                    value={weight ? parseFloat(weight) : null}
                    unit="kg"
                    displayRanges={(() => {
                      const stdWeight = calculateStandardWeight(parseFloat(height));
                      if (stdWeight === null) return []; // 신장 값 없으면 빈 배열
                      return [
                        { label: '저체중', max: stdWeight * 0.9, colorClass: 'bg-blue-200' },
                        { label: '정상', min: stdWeight * 0.9, max: stdWeight * 1.1, colorClass: 'bg-green-200' },
                        { label: '과체중', min: stdWeight * 1.1, max: stdWeight * 1.2, colorClass: 'bg-yellow-200' },
                        { label: '비만', min: stdWeight * 1.2, colorClass: 'bg-red-200' },
                      ];
                    })()}
                    standardRange={(() => {
                      const stdWeight = calculateStandardWeight(parseFloat(height));
                      return stdWeight !== null ? { min: stdWeight * 0.9, max: stdWeight * 1.1 } : { min: 0, max: 0 }; // 신장 값 없으면 0
                    })()}
                    displayMin={(() => {
                      const stdWeight = calculateStandardWeight(parseFloat(height));
                      return stdWeight !== null ? stdWeight * 0.5 : 0; // 신장 값 없으면 0
                    })()}
                    displayMax={(() => {
                      const stdWeight = calculateStandardWeight(parseFloat(height));
                      return stdWeight !== null ? stdWeight * 1.5 : 100; // 신장 값 없으면 기본 최대값 (예: 100)
                    })()}
                    standardRangeLabel={(() => {
                      const stdWeight = calculateStandardWeight(parseFloat(height));
                      return stdWeight !== null ? `${(stdWeight * 0.9).toFixed(1)} ~ ${(stdWeight * 1.1).toFixed(1)} kg` : '-'; // 신장 값 없으면 '-'
                    })()}
                    opacity={barOpacity} // opacity prop 전달
                  />

                  {/* 골격근량 바 그래프 (SMM 기준) */}
                  <BodyCompositionBar
                    label={`골격근량 (${selectedMemberAge !== null ? `${selectedMemberAge}세` : ''})`}
                    value={muscleMass ? parseFloat(muscleMass) : null}
                    unit="kg"
                    {...getSmmCriteria(selectedMemberGender, selectedMemberAge)} // 동적 기준 적용
                    opacity={barOpacity} // opacity prop 전달
                  />

                  {/* 체지방률 바 그래프 */}
                  <BodyCompositionBar
                    label="체지방률"
                    value={fatPercentage ? parseFloat(fatPercentage) : null}
                    unit="%"
                    displayRanges={selectedMemberGender === 'male' ? [
                      { label: '매우 낮음', max: 6, colorClass: 'bg-blue-100' },
                      { label: '낮음', min: 6, max: 14, colorClass: 'bg-blue-200' },
                      { label: '정상', min: 14, max: 18, colorClass: 'bg-green-200' },
                      { label: '다소 높음', min: 18, max: 25, colorClass: 'bg-yellow-200' },
                      { label: '높음', min: 25, colorClass: 'bg-red-200' },
                    ] : selectedMemberGender === 'female' ? [
                      { label: '매우 낮음', max: 14, colorClass: 'bg-blue-100' },
                      { label: '낮음', min: 14, max: 21, colorClass: 'bg-blue-200' },
                      { label: '정상', min: 21, max: 25, colorClass: 'bg-green-200' },
                      { label: '다소 높음', min: 25, max: 32, colorClass: 'bg-yellow-200' },
                      { label: '높음', min: 32, colorClass: 'bg-red-200' },
                    ] : []}
                    standardRange={selectedMemberGender === 'male' ? { min: 14, max: 18 } : selectedMemberGender === 'female' ? { min: 21, max: 25 } : { min: 0, max: 0 }}
                    displayMin={0}
                    displayMax={selectedMemberGender === 'male' ? 40 : selectedMemberGender === 'female' ? 50 : 1}
                    standardRangeLabel={selectedMemberGender === 'male' ? '14.0 ~ 18.0 %' : selectedMemberGender === 'female' ? '21.0 ~ 25.0 %' : '-'}
                    opacity={barOpacity}
                  />

                  {/* BMI 바 그래프 */}
                  <BodyCompositionBar
                    label="BMI"
                    value={bmi ? parseFloat(bmi) : null}
                    unit="kg/m²"
                    displayRanges={[
                      { label: '저체중', max: 18.5, colorClass: 'bg-blue-200' },
                      { label: '정상', min: 18.5, max: 23, colorClass: 'bg-green-200' },
                      { label: '과체중', min: 23, max: 25, colorClass: 'bg-yellow-200' },
                      { label: '비만 1단계', min: 25, max: 30, colorClass: 'bg-orange-200' },
                      { label: '비만 2단계', min: 30, max: 35, colorClass: 'bg-red-200' },
                      { label: '비만 3단계', min: 35, colorClass: 'bg-red-300' },
                    ]}
                    standardRange={{ min: 18.5, max: 23 }} // 아시아 태평양 기준 정상 범위
                    displayMin={10}
                    displayMax={40}
                    standardRangeLabel="18.5 ~ 23.0 kg/m²"
                    opacity={barOpacity} // opacity prop 전달
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">메모</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="측정 관련 특이사항이나 메모를 입력하세요." />
            </div>

            <Button type="submit" disabled={isLoading || !selectedMemberId}>
              {isLoading ? '저장 중...' : '측정 결과 저장'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedMemberId && (
        <Card>
          <CardHeader>
            <CardTitle>최근 측정 기록 ({members.find(m => m.id === selectedMemberId)?.name})</CardTitle> {/* last_name, first_name 대신 name 사용 */}
            <CardDescription>선택된 회원의 최근 5개 측정 기록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {isFetchingLogs ? (
              <p>기록 로딩 중...</p>
            ) : recentLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>측정일</TableHead><TableHead className="text-right">체중(kg)</TableHead><TableHead className="text-right">신장(cm)</TableHead><TableHead className="text-right">골격근량(kg)</TableHead><TableHead className="text-right">체지방률(%)</TableHead><TableHead className="text-right">BMI</TableHead><TableHead>메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateDisplay(log.measurement_date)}</TableCell>
                      <TableCell className="text-right">{log.weight_kg?.toFixed(1) ?? '-'}</TableCell>
                      <TableCell className="text-right">{log.height_cm?.toFixed(1) ?? '-'}</TableCell> {/* 신장 표시 추가 */}
                      <TableCell className="text-right">{log.skeletal_muscle_mass_kg?.toFixed(1) ?? '-'}</TableCell>
                      <TableCell className="text-right">{log.body_fat_percentage?.toFixed(1) ?? '-'}</TableCell>
                      <TableCell className="text-right">{log.bmi?.toFixed(1) ?? '-'}</TableCell>
                      <TableCell>{log.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p>선택된 회원의 측정 기록이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BodyCompositionPage;