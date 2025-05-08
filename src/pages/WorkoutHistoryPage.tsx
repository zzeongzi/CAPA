import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Image, Video, File as FileIcon, Loader2, Play, CheckCircle2, XCircle, AlertCircle, Download, User, X } from 'lucide-react'; // User, X 아이콘 추가
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input'; // Input 제거
import { useMembers, Member } from '@/hooks/use-members';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
// import useDebounce from '@/hooks/use-debounce'; // useDebounce 제거
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils"; // cn 함수 import 추가
import { SelectUserModal } from '@/components/features/SelectUserModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Avatar import
import { Badge } from '@/components/ui/badge'; // Badge 추가

// 이미지 모듈 동적 import (Vite 기능)
// 한글 근육 이름 -> 영어 파일명 매핑 (ExerciseLogger.tsx와 동일하게)
const muscleNameMap: { [key: string]: string } = {
  '복근': 'abdominals',
  '이두근': 'biceps',
  '가슴': 'chest',
  '둔근': 'glutes',
  '햄스트링': 'hamstrings',
  '중간 등근육': 'middleback',
  '대퇴사두근': 'quadriceps',
  '어깨': 'shoulder',
  '삼두근': 'triceps',
  '아래 등근육': 'underback',
  '윗 등근육': 'upperback',
  '등': 'middleback',
  '승모근': 'upperback',
};

// 근육 이름으로 이미지 URL 가져오는 함수 (ExerciseLogger.tsx와 동일하게)
const getMuscleImageUrl = (muscleName: string | null | undefined): string | undefined => {
  if (!muscleName) return undefined;
  const englishName = muscleNameMap[muscleName];
  if (!englishName) return undefined;
  return `/assets/muscle/${englishName}.png`;
};


// 데이터 타입 정의
interface SignedMediaItem {
  storage_path: string;
  file_name: string;
  mime_type: string;
  signedUrl: string | null;
  error?: string;
  isLoading?: boolean;
}
interface WorkoutSet {
  set_number: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}
interface InitialMediaItem {
  storagePath: string;
  fileName: string;
  mimeType: string;
}
interface WorkoutExercise {
  id: string;
  exercises: { name: string; target_muscles?: string[] | null } | null; // target_muscles 추가
  notes: string | null;
  workout_sets: WorkoutSet[];
  workout_media?: InitialMediaItem[];
}
interface WorkoutSession {
  id: string;
  session_date: string;
  notes: string | null;
  session_order: number | null;
  total_sessions_at_creation: number | null;
  members: {
    id: string; // members 테이블의 id
    name: string;
    user_id: string; // auth.users 테이블의 id
  } | null;
  workout_exercises: WorkoutExercise[];
}

const WorkoutHistoryPage = () => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [memberCurrentTotalSessions, setMemberCurrentTotalSessions] = useState<Map<string, number | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrlsMap, setSignedUrlsMap] = useState<Map<string, SignedMediaItem[]>>(new Map());
  const [mediaLoading, setMediaLoading] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const { members: allMembers, isLoading: membersLoading, refetchMembers } = useMembers();
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMemberIdForFilter, setSelectedMemberIdForFilter] = useState<string | null>(null);
  const [selectedMemberForFilter, setSelectedMemberForFilter] = useState<Member | null>(null);
  const location = useLocation();
  const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>(undefined);
  const accordionItemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const state = location.state as { selectedWorkoutSessionId?: string };
    if (state?.selectedWorkoutSessionId) {
      setOpenAccordionItem(state.selectedWorkoutSessionId);
      // window.history.replaceState({}, document.title); // Optional: clear state after use
    }
  }, [location.state]);

  useEffect(() => {
    if (openAccordionItem) {
      const itemRef = accordionItemRefs.current.get(openAccordionItem);
      // Ensure the item is rendered and ref is set before scrolling
      setTimeout(() => { // setTimeout can help ensure DOM is updated
        itemRef?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }
  }, [openAccordionItem, sessions]); // Add sessions to dependency to re-run if items render later

  useEffect(() => {
    if (selectedMemberIdForFilter) {
      const member = allMembers.find(m => m.id === selectedMemberIdForFilter);
      setSelectedMemberForFilter(member || null);
    } else {
      setSelectedMemberForFilter(null);
    }
  }, [selectedMemberIdForFilter, allMembers]);


  const membersMap = useMemo(() => {
    const map = new Map<string, Member>();
    allMembers.forEach(member => {
      map.set(member.id, member); // key를 auth.users.id로 사용
    });
    return map;
  }, [allMembers]);


  const handleDownload = async (url: string, filename: string) => {
    if (!url) return;
    setDownloading(filename);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(null);
    }
  };


  const fetchSignedUrls = useCallback(async (exerciseId: string) => {
    if (!exerciseId || mediaLoading.has(exerciseId) || signedUrlsMap.has(exerciseId)) {
      return;
    }
    console.log(`Fetching signed URLs for exerciseId: ${exerciseId}`);
    setMediaLoading(prev => new Set(prev).add(exerciseId));
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-media-signed-urls', {
        body: { exerciseId },
      });
      if (invokeError) throw invokeError;
      console.log(`Received signed URL data for ${exerciseId}:`, JSON.stringify(data, null, 2));
      if (data && Array.isArray(data)) {
        data.forEach((item: SignedMediaItem) => {
          if (item.error) {
            console.error(`[Signed URL Error - ${exerciseId}/${item.file_name}]`, item.error);
          }
        });
        setSignedUrlsMap(prevMap => new Map(prevMap).set(exerciseId, data as SignedMediaItem[]));
      } else {
         console.warn(`No valid signed URL data array returned for exerciseId: ${exerciseId}`);
         setSignedUrlsMap(prevMap => new Map(prevMap).set(exerciseId, []));
      }
    } catch (err: any) {
      console.error(`[Invoke Error] Error fetching signed URLs for exercise ${exerciseId}:`, err);
       setSignedUrlsMap(prevMap => {
          const newMap = new Map(prevMap);
          const currentMedia = newMap.get(exerciseId) || [];
          newMap.set(exerciseId, currentMedia.map(m => ({ ...m, error: `URL 로딩 실패: ${err.message}` })));
          return newMap;
      });
    } finally {
      setMediaLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(exerciseId);
        return newSet;
      });
    }
  }, [mediaLoading, signedUrlsMap]);

  useEffect(() => {
    const fetchWorkoutHistory = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        // workout_sessions 조회 시 members 테이블의 id, name, user_id를 함께 가져옴
        const { data, error: fetchError } = await supabase
          .from('workout_sessions')
          .select(`
            id,
            session_date,
            notes,
            session_order,
            total_sessions_at_creation,
            members (
              id,
              name,
              user_id
            ),
            workout_exercises (
              id,
              notes,
              exercises ( name, target_muscles ),
              workout_sets (
                set_number,
                weight,
                reps,
                completed
              ),
              workout_media (
                storage_path,
                file_name,
                mime_type
              )
            )
          `)
          .eq('trainer_id', user.id) // auth.users.id 사용
          .order('created_at', { ascending: false }); // 정렬 기준을 created_at (생성 시간)으로 변경

        if (fetchError) throw fetchError;

        if (data) {
          const mappedSessions = data
            .filter((session: any) => !!session && !!session.members)
            .map((session: any) => {
              const membersData = session.members ? {
                id: session.members.id, // members 테이블 id
                name: session.members.name,
                user_id: session.members.user_id, // auth.users id
              } : null;

               const workout_exercises: WorkoutExercise[] = Array.isArray(session.workout_exercises)
                ? session.workout_exercises
                    .filter((ex: any): ex is NonNullable<typeof ex> => ex !== null && ex.exercises != null)
                    .map((ex: any) => {
                      const workout_media: InitialMediaItem[] = Array.isArray(ex.workout_media)
                        ? ex.workout_media
                            .filter((m: any): m is NonNullable<typeof m> => m !== null)
                            .map((m: any) => ({
                              storagePath: m.storage_path,
                              fileName: m.file_name,
                              mimeType: m.mime_type,
                            }))
                        : [];
                      const workout_sets: WorkoutSet[] = Array.isArray(ex.workout_sets)
                        ? ex.workout_sets
                            .filter((s: any): s is NonNullable<typeof s> => s !== null)
                            .map((s: any) => ({
                              set_number: s.set_number,
                              weight: s.weight,
                              reps: s.reps,
                              completed: s.completed ?? false,
                            }))
                        : [];
                      return {
                        id: ex.id,
                        exercises: ex.exercises, // target_muscles 포함됨
                        notes: ex.notes,
                        workout_sets: workout_sets,
                        workout_media: workout_media,
                      };
                    })
                : [];

              return {
                id: session.id,
                session_date: session.session_date!,
                notes: session.notes,
                session_order: session.session_order,
                total_sessions_at_creation: session.total_sessions_at_creation,
                members: membersData,
                workout_exercises: workout_exercises,
              } as WorkoutSession;
            });

          console.log("[WorkoutHistory] Mapped sessions data (before fetching current totals):", mappedSessions);
          setSessions(mappedSessions);

        } else {
          setSessions([]);
        }

      } catch (err: any) {
        console.error("Error fetching workout history:", err);
        setError(err.message || "운동 기록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutHistory();
  }, [user]);

  useEffect(() => {
    const fetchCurrentMemberships = async () => {
      if (sessions.length === 0) return;

      // 세션 데이터에서 고유 user_id (auth.users ID) 추출
      const userIds = [...new Set(sessions.map(s => s.members?.user_id).filter((id): id is string => !!id))];
      if (userIds.length === 0) return;

      console.log("[WorkoutHistory] Fetching current memberships for users (auth.users ID):", userIds);

      try {
        // user_id 목록으로 memberships 테이블 조회 (컬럼명은 member_id)
        const { data: membershipsData, error: membershipsError } = await supabase
          .from('memberships')
          .select('member_id, total_sessions, created_at')
          .in('member_id', userIds);

        if (membershipsError) {
          console.error("Error fetching current memberships:", membershipsError);
          return;
        }

        if (membershipsData) {
          console.log("[WorkoutHistory] Fetched current memberships data:", membershipsData);
          const newTotalSessionsMap = new Map<string, number | null>();
          const groupedMemberships: { [key: string]: { total_sessions: number | null, created_at: string }[] } = {};

          membershipsData.forEach(m => {
            if (!groupedMemberships[m.member_id]) {
              groupedMemberships[m.member_id] = [];
            }
            groupedMemberships[m.member_id].push({ total_sessions: m.total_sessions, created_at: m.created_at });
          });

          Object.keys(groupedMemberships).forEach(userId => {
            const latestMembership = groupedMemberships[userId].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            if (latestMembership) {
              newTotalSessionsMap.set(userId, latestMembership.total_sessions);
            } else {
              newTotalSessionsMap.set(userId, null);
            }
          });

          console.log("[WorkoutHistory] Updated memberCurrentTotalSessions:", newTotalSessionsMap);
          setMemberCurrentTotalSessions(newTotalSessionsMap);
        }
      } catch (err: any) {
        console.error("Error in fetchCurrentMemberships:", err);
      }
    };

    fetchCurrentMemberships();
  }, [sessions]);

  useEffect(() => {
    const handleFocus = () => {
      console.log("[WorkoutHistory] Page focused, refetching members data...");
      refetchMembers();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchMembers]);

  // 선택된 회원 ID에 따라 세션 필터링
  const filteredSessions = useMemo(() => {
    if (!selectedMemberIdForFilter) {
      return sessions; // 선택된 회원이 없으면 전체 세션 반환
    }
    return sessions.filter(session =>
      session.members?.user_id === selectedMemberIdForFilter // auth.users.id 비교
    );
  }, [sessions, selectedMemberIdForFilter]);

  // 회원 선택 모달 콜백
  const handleMemberSelectForFilter = (member: Member) => {
    setSelectedMemberIdForFilter(member.id); // auth.users.id 저장
    setIsMemberModalOpen(false);
  };

  // 필터 초기화 핸들러
  const handleClearFilter = () => {
    setSelectedMemberIdForFilter(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <h1 className="text-3xl font-bold">운동 기록 내역</h1>

        {/* 회원 선택 버튼 및 필터 초기화 버튼 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="justify-start text-left font-normal flex-grow"
            onClick={() => setIsMemberModalOpen(true)}
          >
            {selectedMemberForFilter ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={selectedMemberForFilter.avatarUrl ?? undefined} />
                  <AvatarFallback>{selectedMemberForFilter.initials}</AvatarFallback>
                </Avatar>
                <span>{selectedMemberForFilter.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">회원 선택</span>
            )}
          </Button>
          {selectedMemberIdForFilter && (
            <Button variant="ghost" size="icon" onClick={handleClearFilter} title="필터 해제">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-destructive text-center">{error}</p>}

        {/* 필터링 결과 없을 때 메시지 표시 */}
        {!loading && !error && filteredSessions.length === 0 && selectedMemberIdForFilter && (
          <p className="text-muted-foreground text-center py-10">
            '{selectedMemberForFilter?.name}' 회원의 운동 기록이 없습니다.
          </p>
        )}

        {/* 전체 기록 없을 때 메시지 표시 */}
        {!loading && !error && sessions.length === 0 && !selectedMemberIdForFilter && (
          <p className="text-muted-foreground text-center py-10">저장된 운동 기록이 없습니다.</p>
        )}

        {!loading && !error && filteredSessions.length > 0 && (
          <Accordion
            type="single"
            collapsible
            className="w-full space-y-4"
            value={openAccordionItem}
            onValueChange={(value) => {
              setOpenAccordionItem(value || undefined);
              const targetSession = filteredSessions.find(s => s.id === value);
              if (targetSession) {
                  targetSession.workout_exercises.forEach(ex => {
                      if (ex.workout_media && ex.workout_media.length > 0) {
                          fetchSignedUrls(ex.id);
                      }
                  });
              }
            }}
          >
            {filteredSessions.map((session) => (
              <AccordionItem
                key={session.id}
                value={session.id}
                ref={(el) => accordionItemRefs.current.set(session.id, el)}
                className={cn(
                  openAccordionItem === session.id && "ring-2 ring-primary ring-offset-2 rounded-md shadow-lg"
                )}
              >
                <AccordionTrigger className={cn(
                  "bg-muted/50 px-4 py-3 rounded-md hover:bg-muted/70",
                  openAccordionItem === session.id && "bg-primary/10 hover:bg-primary/20"
                )}>
                  <div className="flex justify-between items-start w-full gap-2">
                    <div className="flex flex-col items-start flex-grow">
                      <span className="text-sm">
                        {format(new Date(session.session_date), 'yyyy년 M월 d일 (eee) HH:mm', { locale: ko })}
                      </span>
                      <span className="font-medium">
                        {session.members?.name ?? '알 수 없는 회원'}
                      </span>
                    </div>
                    {session.session_order != null && (
                      <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                        {session.session_order}번째 / {(() => {
                          const currentTotal = session.members?.user_id ? memberCurrentTotalSessions.get(session.members.user_id) : null;
                          if (typeof currentTotal === 'number') {
                            return currentTotal;
                          }
                          return session.total_sessions_at_creation ?? '?';
                        })()}회
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 px-4 space-y-4">
                  {session.notes && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">전체 수업 메모</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                  <Carousel
                    opts={{ align: "start", loop: false }}
                    className="w-full px-4 sm:px-6 md:px-8"
                  >
                    <CarouselContent className="-ml-4">
                      {session.workout_exercises.map((exercise) => (
                        <CarouselItem key={exercise.id} className="pl-4 md:basis-2/3 lg:basis-1/2">
                          <div className="p-1 h-full">
                            <Card className="h-full flex flex-col">
                              <CardHeader className="pb-2">
                                {/* CardTitle에서 자극 부위 표시 제거 */}
                                <CardTitle className="text-lg">{exercise.exercises?.name ?? '알 수 없는 운동'}</CardTitle>
                                {exercise.notes && <p className="text-xs text-muted-foreground pt-1">{exercise.notes}</p>}
                              </CardHeader>
                              <CardContent className="flex flex-col sm:flex-row gap-4"> {/* flex 레이아웃 적용 */}
                                <div className="flex-1 space-y-1 text-sm"> {/* 세트 정보 영역 */}
                                  {exercise.workout_sets
                                    .sort((a, b) => a.set_number - b.set_number)
                                    .map((set) => (
                                    <div key={set.set_number} className="flex justify-between items-center">
                                      {/* 세트 번호와 상세 정보(kg/회/체크)를 한 줄에 배치 */}
                                      <span className={`flex items-center gap-1 ${set.completed ? 'text-muted-foreground' : ''}`}>
                                        <span>{set.set_number}세트:</span>
                                        <span className="ml-2">{set.weight !== null ? `${set.weight}kg` : '-'} / {set.reps !== null ? `${set.reps}회` : '-'}</span>
                                        {set.completed ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-500 ml-1" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500 ml-1" />
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* 자극 부위 이미지 영역 (오른쪽, 더 크게) */}
                                {exercise.exercises?.target_muscles && exercise.exercises.target_muscles.length > 0 && (
                                  <div className="w-full sm:w-24 flex flex-col items-center gap-1 border-l sm:pl-4 pt-1"> {/* flex-col, items-center, pt-1 추가 */}
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">타겟 부위</h4> {/* 레이블 추가 */}
                                    <div className="flex flex-wrap justify-center items-start gap-1"> {/* 이미지/뱃지 래퍼 추가 */}
                                      {exercise.exercises.target_muscles.map((muscle) => {
                                        const imageUrl = getMuscleImageUrl(muscle);
                                        return (
                                        <div key={muscle} className="flex flex-col items-center text-center">
                                          {imageUrl ? (
                                            <img
                                              src={imageUrl}
                                              alt={muscle}
                                              className="w-10 h-10 object-contain" // 이미지 크기 조정 (w-10 h-10)
                                              title={muscle}
                                            />
                                          ) : (
                                            <div className="w-10 h-10 flex items-center justify-center">
                                              <Badge variant="secondary" className="text-xs">{muscle}</Badge>
                                            </div>
                                          )}
                                          <span className="text-[10px] text-muted-foreground mt-0.5">{muscle}</span>
                                        </div>
                                      );
                                    })}
                                    </div> {/* 이미지/뱃지 래퍼 닫기 */}
                                  </div>
                                )}
                                {/* 미디어 영역 (기존 로직 유지) */}
                                {exercise.workout_media && exercise.workout_media.length > 0 && (
                                  <div className="mt-3 pt-3 border-t">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">첨부된 미디어:</p>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                      {(() => {
                                        const mediaItemsToRender = signedUrlsMap.get(exercise.id) ??
                                          (exercise.workout_media || []).map(initialMedia => ({
                                            storage_path: initialMedia.storagePath,
                                            file_name: initialMedia.fileName,
                                            mime_type: initialMedia.mimeType,
                                            signedUrl: null,
                                            isLoading: mediaLoading.has(exercise.id),
                                            error: undefined
                                          }));
                                        return mediaItemsToRender;
                                      })().map((media: SignedMediaItem) => {
                                        const { signedUrl, error, isLoading, mime_type, file_name, storage_path } = media;
                                        const uniqueKey = storage_path || file_name;
                                        return (
                                          <Dialog key={uniqueKey}>
                                            <DialogTrigger asChild disabled={isLoading || !!error || !signedUrl}>
                                              <div className="relative aspect-square rounded-md overflow-hidden cursor-pointer group border bg-muted">
                                                {isLoading && ( <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10"><Loader2 className="h-6 w-6 animate-spin text-white" /></div> )}
                                                {error && !isLoading && ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 p-1 text-center z-10"><AlertCircle className="h-5 w-5 text-destructive mb-1" /><span className="text-xs text-destructive leading-tight">{error.includes("Unexpected token '<'") ? "URL 생성 실패" : "미디어 로딩 실패"}</span></div> )}
                                                {!isLoading && !error && signedUrl && mime_type.startsWith('image/') ? ( <img src={signedUrl} alt={file_name} className="object-cover w-full h-full" onError={(e) => console.error(`[Image Error] Failed to load image: ${file_name}, URL: ${signedUrl}`, e)} /> )
                                                : !isLoading && !error && signedUrl && mime_type.startsWith('video/') ? ( <div className="relative w-full h-full bg-black"><video key={signedUrl} src={signedUrl} className="object-cover w-full h-full" preload="metadata" muted playsInline onError={(e) => { console.error(`[Video Thumbnail Error] Failed to load video metadata/frame for: ${file_name}, URL: ${signedUrl}`, e); }} /><div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-colors duration-200"><Play className="h-8 w-8 text-white opacity-75 group-hover:opacity-100 transition-opacity" /></div></div> )
                                                : !isLoading && !error && signedUrl ? ( <div className="w-full h-full flex items-center justify-center bg-gray-100"><FileIcon className="h-8 w-8 text-muted-foreground" /></div> ) : null}
                                              </div>
                                            </DialogTrigger>
                                            {signedUrl && !isLoading && !error && (
                                              <DialogContent className="max-w-3xl">
                                                <DialogTitle>{file_name}</DialogTitle>
                                                <DialogDescription className="sr-only">미리보기: {file_name}</DialogDescription>
                                                {mime_type.startsWith('image/') && ( <div className="flex flex-col items-center space-y-4"><img src={signedUrl} alt={file_name} className="max-w-full max-h-[75vh] mx-auto rounded" /><Button variant="outline" size="sm" onClick={() => handleDownload(signedUrl, file_name)} disabled={downloading === file_name}>{downloading === file_name ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Download className="mr-2 h-4 w-4" /> )}{downloading === file_name ? '다운로드 중...' : '다운로드'}</Button></div> )}
                                                {mime_type.startsWith('video/') && ( <video controls src={signedUrl} className="max-w-full max-h-[80vh] mx-auto" onError={(e) => { console.error(`[Video Error] Failed to load video: ${file_name}, URL: ${signedUrl}`, e); }}>Your browser does not support the video tag.</video> )}
                                                {!mime_type.startsWith('image/') && !mime_type.startsWith('video/') && ( <p className="text-center p-4">이 파일 형식은 미리보기를 지원하지 않습니다.</p> )}
                                              </DialogContent>
                                            )}
                                          </Dialog>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="absolute left-[-16px] top-1/2 -translate-y-1/2 sm:left-[-24px] md:left-[-32px]" />
                    <CarouselNext className="absolute right-[-16px] top-1/2 -translate-y-1/2 sm:right-[-24px] md:right-[-32px]" />
                  </Carousel>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* 회원 선택 모달 */}
      <SelectUserModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onUserSelect={handleMemberSelectForFilter} // 필터용 핸들러 연결
      />
    </AppLayout>
  );
};

export default WorkoutHistoryPage;
