import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DatePicker from '@/components/features/workout/DatePicker';
import ExerciseLogger, { ExerciseLog } from '@/components/features/workout/ExerciseLogger';
import WorkoutNotes from '@/components/features/workout/WorkoutNotes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Dialog import 제거
import { Loader2, User, Clock, ChevronLeft, ChevronRight } from 'lucide-react'; // ChevronRight 추가
import type SwiperCore from 'swiper';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '@/integrations/supabase/types';
import { format, setHours, setMinutes, getHours, parseISO } from 'date-fns';
import MemberSelector from '@/components/features/workout/MemberSelector';
import { SelectHourModal } from '@/components/features/workout/SelectHourModal';
import { useMembers, Member } from '@/hooks/use-members';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const WorkoutPageMobile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [workoutDate, setWorkoutDate] = useState<Date | undefined>(new Date());
  const [sessionHour, setSessionHour] = useState<number>(new Date().getHours());
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([
    { id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, userCenter } = useAuth();
  const { toast } = useToast();
  const [swiperApi, setSwiperApi] = useState<SwiperCore | undefined>();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogContent, setConfirmDialogContent] = useState({ title: "", description: "" });
  const [membershipInfo, setMembershipInfo] = useState<{ id: string; remaining_sessions: number, total_sessions: number } | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isHourModalOpen, setIsHourModalOpen] = useState(false);
  const { members } = useMembers();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [currentPtSessionId, setCurrentPtSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMemberId) {
      const member = members.find(m => m.id === selectedMemberId);
      setSelectedMember(member || null);
    } else {
      setSelectedMember(null);
    }
  }, [selectedMemberId, members]);

  useEffect(() => {
    if (swiperApi && exerciseLogs.length > 0) {
      setTimeout(() => { swiperApi.slideTo(exerciseLogs.length - 1); }, 50);
    }
  }, [exerciseLogs.length, swiperApi]);

  const fetchWorkoutLog = useCallback(async (workoutSessionId: string) => {
    setIsLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('*, members!inner(user_id, name, profile_image_url)')
        .eq('id', workoutSessionId)
        .maybeSingle();

      if (sessionError || !sessionData) throw sessionError || new Error("Session not found");
      
      const memberInfoFromJoin = sessionData.members;
      const memberUserId = memberInfoFromJoin?.user_id;

      if (memberUserId) {
        setSelectedMemberId(memberUserId);
        const memberInfo = members.find(m => m.id === memberUserId);
        setSelectedMember(memberInfo || null);
      } else {
        setSelectedMemberId(null);
        setSelectedMember(null);
      }

      if (sessionData.session_date) {
        const date = new Date(sessionData.session_date);
        setWorkoutDate(date);
        setSessionHour(getHours(date));
      }
      setSessionNotes(sessionData.notes || "");

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*, workout_sets(*), workout_media(*)')
        .eq('session_id', workoutSessionId)
        .order('order');

      if (exercisesError) throw exercisesError;

      const fetchedExerciseLogs: ExerciseLog[] = exercisesData.map(exercise => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        notes: exercise.notes || '',
        sets: exercise.workout_sets.sort((a,b) => a.set_number - b.set_number).map(set => ({
          id: set.id,
          weight: set.weight !== null ? String(set.weight) : '',
          reps: set.reps !== null ? String(set.reps) : '',
          completed: set.completed || false,
        })),
        media: exercise.workout_media.map(media => ({
          id: media.id, storagePath: media.storage_path, fileName: media.file_name || undefined, mimeType: media.mime_type || undefined,
        })),
      }));
      setExerciseLogs(fetchedExerciseLogs.length > 0 ? fetchedExerciseLogs : [{ id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }]);
    } catch (error: any) {
      toast({ title: "오류", description: `운동 기록 불러오기 실패: ${error.message}`, variant: "destructive" });
      setExerciseLogs([{ id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }]);
      setSessionNotes(""); setSessionHour(new Date().getHours()); setSelectedMemberId(null); setSelectedMember(null); setEditingSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, members, toast, navigate]);

  useEffect(() => {
    const state = location.state as { selectedMember?: Member; selectedDate?: Date; ptSessionId?: string; workoutSessionId?: string; };
    const processState = async () => {
      if (state) {
        if (state.selectedMember && state.selectedDate && state.ptSessionId && !state.workoutSessionId) {
          setSelectedMemberId(state.selectedMember.id);
          setSelectedMember(state.selectedMember);
          setWorkoutDate(new Date(state.selectedDate));
          setSessionHour(getHours(new Date(state.selectedDate)));
          setEditingSessionId(null);
          setCurrentPtSessionId(state.ptSessionId);
          navigate(location.pathname, { replace: true, state: {} });
        } else if (state.workoutSessionId) {
          setEditingSessionId(state.workoutSessionId);
          setCurrentPtSessionId(state.ptSessionId ?? null);
          await fetchWorkoutLog(state.workoutSessionId);
          if (state.workoutSessionId) navigate(location.pathname, { replace: true, state: {} });
        } else if (state.ptSessionId && !state.selectedMember && !state.selectedDate && !state.workoutSessionId) {
           setEditingSessionId(null); setCurrentPtSessionId(state.ptSessionId);
           if (state.ptSessionId) navigate(location.pathname, { replace: true, state: {} });
        } else if (location.state && Object.keys(location.state).length > 0) {
           navigate(location.pathname, { replace: true, state: {} });
        }
      }
    };
    processState();
  }, [location.state, navigate, fetchWorkoutLog]);

  const getCombinedDateTimeISO = (date: Date | undefined, hour: number): string | null => {
    if (!date || typeof hour !== 'number' || hour < 0 || hour > 23) return null;
    try {
      let combinedDate = setHours(date, hour);
      combinedDate = setMinutes(combinedDate, 0);
      return combinedDate.toISOString();
    } catch (error) { return null; }
  };

  const handleMemberSelect = (memberId: string | null) => { setSelectedMemberId(memberId); setIsMemberModalOpen(false); };
  const handleHourSelect = (hour: number) => { setSessionHour(hour); setIsHourModalOpen(false); };

  const handleSaveWorkout = async () => {
     if (!selectedMemberId || !workoutDate || sessionHour === null || !user || !userCenter) {
       toast({ title: "오류", description: "필수 정보 누락", variant: "destructive" }); return;
     }
     if (exerciseLogs.length === 0 || exerciseLogs.every(log => !log.exerciseId)) {
        toast({ title: "알림", description: "운동을 선택해주세요.", variant: "default" }); return;
     }
     try {
       const { data: activeMemberships, error: membershipError } = await supabase.from('memberships').select('id, remaining_sessions, total_sessions, start_date').eq('member_id', selectedMemberId).gt('remaining_sessions', 0).order('start_date', { ascending: true }).order('created_at', { ascending: true });
       if (membershipError) throw membershipError;
       if (!activeMemberships || activeMemberships.length === 0) {
         toast({ title: "오류", description: "유효한 PT 멤버십 정보 없음", variant: "destructive" }); return;
       }
       const targetMembership = activeMemberships[0];
       setMembershipInfo(targetMembership);
       if (targetMembership.remaining_sessions <= 0) {
         toast({ title: "알림", description: "남은 PT 횟수 없음", variant: "default" }); return;
       }
       setConfirmDialogContent({ title: "PT 횟수 차감 확인", description: `운동 기록 저장 시 '${format(parseISO(targetMembership.start_date!), 'yyyy/MM/dd')} 계약'의 남은 PT가 ${targetMembership.remaining_sessions}회에서 ${targetMembership.remaining_sessions - 1}회로 차감됩니다. 계속하시겠습니까?` });
       setIsConfirmDialogOpen(true);
     } catch (error: any) { toast({ title: "멤버십 조회 오류", description: error.message, variant: "destructive" }); }
   };

  const confirmAndSaveWorkout = async () => {
    setIsConfirmDialogOpen(false); setIsSaving(true);
    if (!selectedMemberId || !workoutDate || sessionHour === null || !user || !userCenter || !membershipInfo || !selectedMember) {
      toast({ title: "오류", description: "필수 정보 누락", variant: "destructive" }); setIsSaving(false); return;
    }
    try {
      const { data: memberMappingData, error: mappingError } = await supabase.from('members').select('id').eq('user_id', selectedMemberId).single();
      if (mappingError || !memberMappingData) { throw mappingError || new Error("회원 ID 매핑 실패"); }
      const memberTableId = memberMappingData.id;
      const { count: existingSessionCount, error: countError } = await supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('member_id', memberTableId);
      if (countError) { throw new Error("기존 세션 수 조회 오류"); }
      const sessionOrder = (existingSessionCount ?? 0) + 1;
      const totalSessions = membershipInfo?.total_sessions ?? null;
      const combinedDateTime = getCombinedDateTimeISO(workoutDate, sessionHour);
      if (!combinedDateTime) { throw new Error("날짜/시간 형식 오류"); }
      let sessionId: string;

      if (editingSessionId) {
        sessionId = editingSessionId;
        const { error: sessionUpdateError } = await supabase.from('workout_sessions').update({ session_date: combinedDateTime, notes: sessionNotes || null, updated_at: new Date().toISOString(), session_order: sessionOrder, total_sessions_at_creation: totalSessions }).eq('id', sessionId);
        if (sessionUpdateError) throw sessionUpdateError;
        const { data: existingExercises, error: fetchExistingError } = await supabase.from('workout_exercises').select('id, workout_sets(id), workout_media(id, storage_path)').eq('session_id', sessionId);
        if (fetchExistingError) throw fetchExistingError;
        if (existingExercises && existingExercises.length > 0) {
          const setIds = existingExercises.flatMap(ex => ex.workout_sets.map(s => s.id));
          const mediaToDelete = existingExercises.flatMap(ex => ex.workout_media);
          if (setIds.length > 0) { await supabase.from('workout_sets').delete().in('id', setIds); }
          if (mediaToDelete.length > 0) {
            const storagePaths = mediaToDelete.map(m => m.storage_path).filter((p): p is string => !!p);
            if (storagePaths.length > 0) { await supabase.storage.from('workoutmedia').remove(storagePaths); }
            await supabase.from('workout_media').delete().in('id', mediaToDelete.map(m => m.id));
          }
          await supabase.from('workout_exercises').delete().in('id', existingExercises.map(ex => ex.id));
        }
      } else {
        const { data: sessionInsertData, error: sessionInsertError } = await supabase.from('workout_sessions').insert({ member_id: memberTableId, trainer_id: user.id, center_id: userCenter, session_date: combinedDateTime, notes: sessionNotes || null, session_order: sessionOrder, total_sessions_at_creation: totalSessions, membership_id: membershipInfo.id }).select('id').single();
        if (sessionInsertError || !sessionInsertData) throw sessionInsertError || new Error("운동 세션 저장 실패");
        sessionId = sessionInsertData.id;
        const { error: membershipUpdateError } = await supabase.from('memberships').update({ remaining_sessions: membershipInfo.remaining_sessions - 1 }).eq('id', membershipInfo.id);
        if (membershipUpdateError) throw membershipUpdateError;
      }

      for (const [index, log] of exerciseLogs.entries()) {
         if (!log.exerciseId) continue;
         const { data: exerciseData, error: exerciseError } = await supabase.from('workout_exercises').insert({ session_id: sessionId, exercise_id: log.exerciseId, notes: log.notes || null, order: index }).select('id').single();
         if (exerciseError || !exerciseData) throw exerciseError || new Error("운동 항목 저장 실패");
         const workoutExerciseId = exerciseData.id;
         const setsToInsert = log.sets.map((set, setIndex) => ({ workout_exercise_id: workoutExerciseId, set_number: setIndex + 1, weight: typeof set.weight === 'number' ? set.weight : (set.weight === '' ? null : Number(set.weight)), reps: typeof set.reps === 'number' ? set.reps : (set.reps === '' ? null : Number(set.reps)), completed: set.completed }));
         const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
         if (setsError) throw setsError;
         if (log.media && log.media.length > 0) {
           const uploadPromises = log.media.filter(mf => mf.file).map(async (mf) => {
             if (!mf.file || !mf.fileName) return null;
             const fileExt = mf.fileName.split('.').pop() || ''; const uniqueFileName = `${uuidv4()}.${fileExt}`;
             const filePath = `public/${user.id}/${uniqueFileName}`;
             const { data: uploadData, error: uploadError } = await supabase.storage.from('workoutmedia').upload(filePath, mf.file);
             if (uploadError || !uploadData) throw uploadError || new Error("미디어 업로드 실패");
             return { workout_exercise_id: workoutExerciseId, storage_path: uploadData.path, file_name: uniqueFileName, mime_type: mf.mimeType };
           });
           const uploadedMedia = (await Promise.all(uploadPromises)).filter(r => r !== null);
           if (uploadedMedia.length > 0) {
             const { error: mediaError } = await supabase.from('workout_media').insert(uploadedMedia as any);
             if (mediaError) throw mediaError;
           }
         }
      }
      if (currentPtSessionId) {
        const { error: updateError } = await supabase.from('pt_sessions').update({ status: 'completed', workout_session_id: sessionId }).eq('id', currentPtSessionId);
        if (updateError) { toast({ title: "경고", description: "운동 기록은 저장, 세션 상태 업데이트 실패.", variant: "default" }); }
        else { toast({ title: "성공", description: "운동 기록 저장 및 세션 상태 업데이트 완료." }); }
      } else { toast({ title: "성공", description: "운동 기록이 저장되었습니다." }); }
      setExerciseLogs([{ id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }]);
      setSessionNotes(""); setSessionHour(new Date().getHours()); setSelectedMemberId(null); setSelectedMember(null); setEditingSessionId(null);
      navigate('/schedule', { state: { refetch: true, completedPtSessionId: currentPtSessionId, completedWorkoutSessionId: sessionId } });
    } catch (error: any) {
      toast({ title: "저장 오류", description: error.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-4 p-4 md:p-6 lg:p-8"> {/* 모바일 패딩 기본 p-4 */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="sm:hidden"> {/* 모바일에서만 뒤로가기 버튼 */}
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">운동 관리</h1>
          <div /> {/* 오른쪽 공간 확보용 빈 div */}
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6"> {/* 모바일 패딩 조정 */}
            <CardTitle className="text-lg sm:text-xl">수업 정보</CardTitle>
            <div className="flex flex-col gap-3 mt-3"> {/* 모바일 수직, 간격 조정 */}
              <div className="flex-1">
                 <Label>회원</Label>
                 {/* Button 대신 MemberSelector 직접 사용 */}
                 <div className="mt-1">
                   <MemberSelector
                     selectedMemberId={selectedMemberId}
                     onSelectMember={handleMemberSelect}
                   />
                 </div>
              </div>
              <div className="flex flex-1 gap-2 items-end">
                 <div className="flex-1">
                   <Label htmlFor="workout-date">날짜</Label>
                   <DatePicker date={workoutDate} setDate={setWorkoutDate} />
                 </div>
                 <div className="w-28">
                   <Label>시간</Label>
                   <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 h-10" onClick={() => setIsHourModalOpen(true)}>
                     <Clock className="mr-2 h-4 w-4" /> {String(sessionHour).padStart(2, '0')}:00
                   </Button>
                 </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl">운동 기록</CardTitle>
              {exerciseLogs.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => swiperApi?.slidePrev()} disabled={!swiperApi}> <ChevronLeft className="h-4 w-4" /> </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => swiperApi?.slideNext()} disabled={!swiperApi}> <ChevronRight className="h-4 w-4" /> </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4"> {/* 모바일 패딩 조정 */}
             <ExerciseLogger exerciseLogs={exerciseLogs} setExerciseLogs={setExerciseLogs} setApi={setSwiperApi} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">전체 수업 메모</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
             <WorkoutNotes initialNotes={sessionNotes} onNotesChange={setSessionNotes} />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
          {/* <Button variant="outline" className="w-full sm:w-auto h-10">초기화</Button> */} {/* 초기화 버튼 제거 */}
          <Button onClick={handleSaveWorkout} disabled={isSaving} className="w-full sm:w-auto h-10">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* MemberSelector를 Dialog로 감싸는 부분 제거 (이미 위에서 직접 사용) */}

      <SelectHourModal isOpen={isHourModalOpen} onClose={() => setIsHourModalOpen(false)} onHourSelect={handleHourSelect} currentHour={sessionHour} />
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSaveWorkout} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 확인 및 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default WorkoutPageMobile;