import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // uuid import 추가
import { Button } from '@/components/ui/button';
// Chevron 아이콘 제거
import { PlusCircle, Trash2, Loader2, Search as SearchIcon, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
// Swiper 관련 import
import { Swiper, SwiperSlide } from 'swiper/react';
// Navigation 모듈 제거
import 'swiper/css';
// import 'swiper/css/navigation'; // Navigation CSS 제거
import { Badge } from '@/components/ui/badge'; // Badge 추가
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SetInputRow from './SetInputRow';
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Textarea } from '@/components/ui/textarea';
import MediaUploader from './MediaUploader';
import { Input } from '@/components/ui/input';
import useDebounce from '@/hooks/use-debounce';
import { useWorkoutStore } from '@/store/workoutStore';
import { cn } from '@/lib/utils';
import type SwiperCore from 'swiper'; // Swiper 타입 import

type Exercise = Database['public']['Tables']['exercises']['Row'];

interface SetData {
  id: string;
  weight: number | string;
  reps: number | string;
  completed: boolean;
}

// ExerciseLog 인터페이스 확장: 로컬 파일 정보 추가
export interface ExerciseLog {
  id: string;
  exerciseId: string | null;
  sets: SetData[];
  notes?: string;
  media?: { file?: File, localUrl?: string, thumbnailUrl?: string, storagePath?: string; fileName?: string; mimeType?: string }[]; // thumbnailUrl 추가
}

interface ExerciseLoggerProps {
  exerciseLogs: ExerciseLog[];
  setExerciseLogs: React.Dispatch<React.SetStateAction<ExerciseLog[]>>;
  setApi?: (api: SwiperCore | undefined) => void; // setApi prop 타입 추가
}

// data prop 타입 명시 및 필요한 핸들러 추가 (누락된 속성 복원)
interface ExerciseLogRowData {
  logs: ExerciseLog[];
  handleExerciseChange: (logId: string, exerciseId: string | null) => void;
  removeExerciseLog: (logId: string) => void;
  handleSetChange: (logId: string, setId: string, field: keyof SetData, value: string | number | boolean) => void;
  removeSet: (logId: string, setId: string) => void;
  addSet: (logId: string) => void;
  handleNotesChange: (logId: string, notes: string) => void;
  handleFileSelect: (logId: string, file: File, localUrl: string, thumbnailUrl?: string) => void; // thumbnailUrl 추가
  handleFileRemove: (logId: string, localUrlOrStoragePath: string) => void;
  selectedCategoryL1: string | null;
  handleCategoryL1Change: (value: string | null) => void;
  allCategoriesL1: string[];
  selectedCategoryL2: string | null;
  handleCategoryL2Change: (value: string | null) => void;
  currentCategoriesL2: string[];
  exerciseSearchValue: string;
  setExerciseSearchValue: React.Dispatch<React.SetStateAction<string>>;
  isLoadingExercises: boolean;
  exerciseError: string | null;
  filteredExerciseList: Exercise[];
}


// 한글 근육 이름 -> 영어 파일명 매핑
const muscleNameMap: { [key: string]: string } = {
  '복근': 'abdominals',
  '이두근': 'biceps', // '이두' -> '이두근'
  '가슴': 'chest',
  '둔근': 'glutes',
  '햄스트링': 'hamstrings',
  '중간 등근육': 'middleback', // '등 중부' -> '중간 등근육'
  '대퇴사두근': 'quadriceps',
  '어깨': 'shoulder',
  '삼두근': 'triceps', // '삼두' -> '삼두근'
  '아래 등근육': 'underback', // '등 하부' -> '아래 등근육'
  '윗 등근육': 'upperback', // '등 상부' -> '윗 등근육'
  '등': 'middleback', // '등' 대표 이미지 유지
  '승모근': 'upperback', // '승모근' 추가 (upperback 이미지 사용)
  // '내전근', '종아리', '상완근' 등 이미지가 없는 부위는 뱃지로 표시되므로 매핑 불필요
};

// 근육 이름으로 이미지 URL 가져오는 함수
const getMuscleImageUrl = (muscleName: string | null | undefined): string | undefined => {
  if (!muscleName) return undefined;
  const englishName = muscleNameMap[muscleName];
  if (!englishName) return undefined;
  return `/assets/muscle/${englishName}.png`;
};


const ExerciseLogRow = memo(React.forwardRef<HTMLDivElement, { index: number; data: ExerciseLogRowData }>(({ index, data }, ref) => {
  const {
    logs,
    handleExerciseChange,
    removeExerciseLog,
    handleSetChange,
    removeSet,
    addSet,
    handleNotesChange,
    handleFileSelect, // 이름 변경됨
    handleFileRemove, // 이름 변경됨
    // Select 관련 상태 및 핸들러
    selectedCategoryL1, handleCategoryL1Change, allCategoriesL1,
    selectedCategoryL2, handleCategoryL2Change, currentCategoriesL2,
    exerciseSearchValue, setExerciseSearchValue,
    isLoadingExercises, exerciseError, filteredExerciseList
   } = data;

  const log = logs[index];
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const { exercises } = useWorkoutStore.getState();
  const selectedExercise = exercises.find(ex => ex.id === log.exerciseId);


  return (
    // Card가 최상위 요소
    <Card key={log.id} ref={ref} className="w-full"> {/* ref 추가 */}
      <CardHeader className="bg-muted/50 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex-1 w-full">
            <Select
              value={log.exerciseId ?? ""}
              onValueChange={(value) => handleExerciseChange(log.id, value || null)}
              open={isSelectOpen}
              onOpenChange={setIsSelectOpen}
            >
              <SelectTrigger className="w-full">
                 <SelectValue placeholder="운동 선택">
                   {selectedExercise ? selectedExercise.name : "운동 선택"}
                 </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 space-y-2">
                  <div className="flex gap-2">
                    <Select value={selectedCategoryL1 ?? 'all'} onValueChange={handleCategoryL1Change}>
                      <SelectTrigger className="flex-1"> <SelectValue placeholder="대분류" /> </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {allCategoriesL1.map((cat: string) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedCategoryL2 ?? 'all'} onValueChange={handleCategoryL2Change} disabled={!selectedCategoryL1 || currentCategoriesL2.length === 0}>
                      <SelectTrigger className="flex-1"> <SelectValue placeholder="중분류" /> </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체</SelectItem>
                        {currentCategoriesL2.map((cat: string) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="운동 이름 검색..."
                      value={exerciseSearchValue}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setExerciseSearchValue(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                {isLoadingExercises ? (
                  <div className="p-2 text-center text-sm">로딩 중...</div>
                ) : exerciseError ? (
                  <div className="p-2 text-center text-sm text-destructive">{exerciseError}</div>
                ) : filteredExerciseList.length === 0 ? (
                  <div className="p-2 text-center text-sm">결과 없음</div>
                ) : (
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredExerciseList.map((exercise) => (
                      <div
                        key={exercise.id}
                        className={cn(
                          "flex items-center p-2 text-sm hover:bg-accent cursor-pointer relative",
                          log.exerciseId === exercise.id && "bg-accent"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleExerciseChange(log.id, exercise.id);
                          setIsSelectOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", log.exerciseId === exercise.id ? "opacity-100" : "opacity-0")} />
                        <span>{exercise.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          {/* 타겟 부위 카드 (target_muscles 기반) */}
          {selectedExercise && selectedExercise.target_muscles && selectedExercise.target_muscles.length > 0 && (
            <Card className="mt-2 sm:mt-0 sm:ml-2 flex-shrink-0">
              <CardHeader className="p-2 pb-1">
                <h4 className="text-xs font-semibold text-muted-foreground">타겟 부위</h4>
              </CardHeader>
              <CardContent className="p-2 pt-0 flex flex-wrap justify-center items-center gap-1">
                {selectedExercise.target_muscles.map((muscle) => {
                  const imageUrl = getMuscleImageUrl(muscle);
                  return (
                    <div key={muscle} className="flex flex-col items-center text-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={muscle}
                          className="w-10 h-10 object-contain"
                          title={muscle}
                        />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center"> {/* 이미지 없을 때 공간 확보 */}
                          <Badge variant="secondary" className="text-xs">{muscle}</Badge>
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-0.5">{muscle}</span> {/* 이름 표시 */}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <div className="w-full sm:w-auto mt-2 sm:mt-0">
            <Button
              size="sm"
              onClick={() => removeExerciseLog(log.id)}
              className={cn(
                "w-full bg-destructive text-destructive-foreground hover:bg-destructive/90",
                "sm:w-9 sm:h-9 sm:bg-transparent sm:text-destructive sm:hover:bg-accent sm:hover:text-accent-foreground",
                "sm:p-0"
              )}
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sm:hidden ml-2">운동 삭제</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          {log.sets.map((set, setIndex) => (
             <SetInputRow
               key={set.id}
               setIndex={setIndex}
               setData={set}
               onSetChange={(field, value) => handleSetChange(log.id, set.id, field, value)}
               onRemoveSet={() => removeSet(log.id, set.id)}
               isRemoveDisabled={log.sets.length <= 1}
             />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => addSet(log.id)} className="w-full">
          <PlusCircle className="mr-2 h-4 w-4" /> 세트 추가
        </Button>
        <Textarea
          placeholder="운동별 특이사항 메모..."
          value={log.notes ?? ""}
          onChange={(e) => handleNotesChange(log.id, e.target.value)}
          rows={2}
          className="resize-none text-sm mt-2"
        />
        <MediaUploader
          workoutExerciseId={log.id}
          initialMedia={log.media} // initialMedia prop으로 변경
          onFileSelect={(file, localUrl, thumbnailUrl) => handleFileSelect(log.id, file, localUrl, thumbnailUrl)} // handleFileSelect 전달 (thumbnailUrl 포함)
          onFileRemove={(localUrlOrStoragePath) => handleFileRemove(log.id, localUrlOrStoragePath)} // handleFileRemove 전달
        />
      </CardContent>
    </Card>
  );
}));
ExerciseLogRow.displayName = 'ExerciseLogRow';

const ExerciseLogger: React.FC<ExerciseLoggerProps> = ({ exerciseLogs, setExerciseLogs, setApi }) => { // setApi prop 추가
  const { exercises, isLoadingExercises, exerciseError } = useWorkoutStore();
  const [selectedCategoryL1, setSelectedCategoryL1] = useState<string | null>(null);
  const [selectedCategoryL2, setSelectedCategoryL2] = useState<string | null>(null);
  const [exerciseSearchValue, setExerciseSearchValue] = useState("");
  const debouncedExerciseSearch = useDebounce(exerciseSearchValue, 500);
  const swiperRef = useRef<SwiperCore | null>(null); // Swiper 인스턴스 ref
  const swiperContainerRef = useRef<HTMLDivElement | null>(null); // Swiper 컨테이너 ref
  const logCardRefs = useRef<(HTMLDivElement | null)[]>([]); // 각 로그 카드 ref 배열

  // WorkoutPage에서 API 상태를 관리하므로 제거
  // const [api, setApi] = useState<CarouselApi | undefined>();
  // useEffect(() => { ... });


  const { allCategoriesL1, allCategoriesL2 } = useMemo(() => {
    const l1Set = new Set<string>();
    const l2Map: Record<string, Set<string>> = {};
    exercises.forEach(item => {
      if (item.category_l1) {
        l1Set.add(item.category_l1);
        if (!l2Map[item.category_l1]) {
          l2Map[item.category_l1] = new Set<string>();
        }
        if (item.category_l2) {
          l2Map[item.category_l1].add(item.category_l2);
        }
      }
    });
    const finalL2Map: Record<string, string[]> = {};
    for (const key in l2Map) {
      finalL2Map[key] = Array.from(l2Map[key]).sort();
    }
    return {
      allCategoriesL1: Array.from(l1Set).sort(),
      allCategoriesL2: finalL2Map
    };
  }, [exercises]);

  const currentCategoriesL2 = useMemo(() => {
    if (selectedCategoryL1 && allCategoriesL2[selectedCategoryL1]) {
      return allCategoriesL2[selectedCategoryL1];
    }
    return [];
  }, [selectedCategoryL1, allCategoriesL2]);

  const filteredExerciseList = useMemo(() => {
    let list = exercises;
    if (selectedCategoryL1 && selectedCategoryL1 !== 'all') {
      list = list.filter(ex => ex.category_l1 === selectedCategoryL1);
    }
    if (selectedCategoryL2 && selectedCategoryL2 !== 'all') {
      list = list.filter(ex => ex.category_l2 === selectedCategoryL2);
    }
    if (debouncedExerciseSearch) {
      const searchTermNoSpaces = debouncedExerciseSearch.replace(/\s/g, '').toLowerCase();
      list = list.filter(exercise =>
        exercise.name.replace(/\s/g, '').toLowerCase().includes(searchTermNoSpaces)
      );
    }
    return list;
  }, [exercises, selectedCategoryL1, selectedCategoryL2, debouncedExerciseSearch]);

  const handleCategoryL1Change = useCallback((value: string | null) => {
    const newL1 = value === 'all' ? null : value;
    setSelectedCategoryL1(newL1);
    setSelectedCategoryL2(null);
  }, []);

  const handleCategoryL2Change = useCallback((value: string | null) => {
    setSelectedCategoryL2(value === 'all' ? null : value);
  }, []);

  const addExerciseLog = useCallback(() => {
    const newLogId = uuidv4(); // crypto.randomUUID() -> uuidv4()
    setExerciseLogs((prevLogs) => {
      const newLogs = [
        ...prevLogs,
        {
          id: newLogId,
          exerciseId: null,
          sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }],
          notes: '',
          media: [],
        },
      ];
      // 새 로그 추가 후 해당 슬라이드로 이동
      setTimeout(() => {
        swiperRef.current?.slideTo(newLogs.length - 1);
      }, 50);
      return newLogs;
    });
  }, [setExerciseLogs]); // swiperRef 제거 (WorkoutPage에서 관리)

  const removeExerciseLog = useCallback((logId: string) => {
    // 제거하려는 로그의 로컬 미디어 URL 해제
    const logToRemove = exerciseLogs.find(log => log.id === logId);
    logToRemove?.media?.forEach(media => {
      if (media.localUrl) {
        URL.revokeObjectURL(media.localUrl);
      }
    });
    setExerciseLogs((prevLogs) => prevLogs.filter((log) => log.id !== logId));
  }, [exerciseLogs, setExerciseLogs]); // exerciseLogs 추가

  const handleExerciseChange = useCallback((logId: string, exerciseId: string | null) => {
    setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId ? { ...log, exerciseId } : log
      )
    );
  }, [setExerciseLogs]);

  const handleNotesChange = useCallback((logId: string, notes: string) => {
    setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId ? { ...log, notes } : log
      )
    );
  }, [setExerciseLogs]);

  const addSet = useCallback((logId: string) => {
    setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              sets: [
                ...log.sets,
                { id: uuidv4(), weight: '', reps: '', completed: false }, // crypto.randomUUID() -> uuidv4()
              ],
            }
          : log
      )
    );
  }, [setExerciseLogs]);

  const removeSet = useCallback((logId: string, setId: string) => {
     setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId
          ? { ...log, sets: log.sets.filter((set) => set.id !== setId) }
          : log
      )
    );
  }, [setExerciseLogs]);

  // handleMediaUploadSuccess -> handleFileSelect 로 변경 및 로직 수정
  const handleFileSelect = useCallback((logId: string, file: File, localUrl: string, thumbnailUrl?: string) => { // thumbnailUrl 추가
    setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              // 로컬 파일 정보, URL, 썸네일 URL을 media 배열에 추가
              media: [...(log.media || []), { file, localUrl, thumbnailUrl, fileName: file.name, mimeType: file.type }],
            }
          : log
      )
    );
  }, [setExerciseLogs]);

  // handleRemoveMedia -> handleFileRemove 로 변경 및 로직 수정
  const handleFileRemove = useCallback((logId: string, localUrlOrStoragePath: string) => {
    // 상태 업데이트 및 로컬 URL 해제
    setExerciseLogs(prevLogs => {
      const logToUpdate = prevLogs.find(log => log.id === logId);
      const removedItem = logToUpdate?.media?.find(m => m.localUrl === localUrlOrStoragePath || m.storagePath === localUrlOrStoragePath);

      // 로컬 URL 해제
      if (removedItem?.localUrl) {
        URL.revokeObjectURL(removedItem.localUrl);
      }

      return prevLogs.map((log) =>
        log.id === logId
          ? { ...log, media: log.media?.filter(m => m.localUrl !== localUrlOrStoragePath && m.storagePath !== localUrlOrStoragePath) }
          : log
      );
    });
    // 스토리지 삭제 로직은 WorkoutPage의 저장 함수에서 처리
  }, [setExerciseLogs]);


  const handleSetChange = useCallback((logId: string, setId: string, field: keyof SetData, value: string | number | boolean) => {
     let processedValue = value;
     if ((field === 'weight' || field === 'reps') && typeof value === 'string' && value !== '') {
       processedValue = parseFloat(value) || '';
     }

     setExerciseLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              sets: log.sets.map((set) =>
                set.id === setId ? { ...set, [field]: processedValue } : set
              ),
            }
          : log
      )
    );
  }, [setExerciseLogs]);

  // Prepare data for ExerciseLogRow
  const itemData: ExerciseLogRowData = useMemo(() => ({
    logs: exerciseLogs,
    handleExerciseChange,
    removeExerciseLog,
    handleSetChange,
    removeSet,
    addSet,
    handleNotesChange,
    handleFileSelect, // 이름 변경됨
    handleFileRemove, // 이름 변경됨
    selectedCategoryL1, handleCategoryL1Change, allCategoriesL1,
    selectedCategoryL2, handleCategoryL2Change, currentCategoriesL2,
    exerciseSearchValue, setExerciseSearchValue,
    isLoadingExercises, exerciseError, filteredExerciseList
  }), [
    exerciseLogs, handleExerciseChange, removeExerciseLog, handleSetChange, removeSet, addSet, handleNotesChange, handleFileSelect, handleFileRemove, // 의존성 배열 업데이트
    selectedCategoryL1, handleCategoryL1Change, allCategoriesL1,
    selectedCategoryL2, handleCategoryL2Change, currentCategoriesL2,
    exerciseSearchValue, setExerciseSearchValue,
    isLoadingExercises, exerciseError, filteredExerciseList
  ]);


  // useEffect(() => { ... }); // Swiper 업데이트 관련 useEffect 제거 (observer 옵션 사용)
  // useEffect(() => { ... }); // Swiper 리사이즈 관련 useEffect 제거 (observer 옵션 사용)



  return (
    <div className="space-y-4">
      {/* Swiper 컨테이너 */}
      <div ref={swiperContainerRef} className="relative overflow-hidden w-full"> {/* w-full 추가 */}
        <Swiper
          observer={true} // observer 옵션 추가
          observeParents={true} // observeParents 옵션 추가
          slidesPerView={1}
          spaceBetween={0} // 간격 제거
          className="w-full" // w-full 유지
          onSwiper={(swiper) => { // 로컬 ref 설정 및 부모 setApi 호출
            swiperRef.current = swiper;
            if (setApi) {
              setApi(swiper);
            }
          }}
        >
          {exerciseLogs.map((log, index) => (
            // SwiperSlide에서 너비 및 패딩 클래스 제거
            <SwiperSlide key={log.id}>
              <div> {/* 내부 패딩 제거 */}
                <ExerciseLogRow ref={el => logCardRefs.current[index] = el} index={index} data={itemData} /> {/* ref 추가 */}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

      </div>

      <Button onClick={addExerciseLog} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" /> 운동 추가
      </Button>
    </div>
  );
};

export default ExerciseLogger;