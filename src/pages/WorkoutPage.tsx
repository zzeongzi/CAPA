import React, { useState, useEffect, useCallback } from 'react'; // useCallback 확인
import { useLocation, useNavigate } from 'react-router-dom'; // useLocation, useNavigate 추가
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
// import MemberSelector from '@/components/features/workout/MemberSelector'; // 제거
import DatePicker from '@/components/features/workout/DatePicker';
import ExerciseLogger, { ExerciseLog } from '@/components/features/workout/ExerciseLogger';
import WorkoutNotes from '@/components/features/workout/WorkoutNotes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/input'; // 제거
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Select 컴포넌트 추가
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogOverlay,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog";
// Dialog 관련 import 제거
import { Loader2, ChevronLeft, ChevronRight, User, Clock } from 'lucide-react'; // User, Clock 아이콘 추가
import type SwiperCore from 'swiper';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '@/integrations/supabase/types';
import { format, setHours, setMinutes, getHours, parseISO } from 'date-fns'; // parseISO 추가, getHours 추가
import { ko } from 'date-fns/locale'; // ko 로케일 추가
import MemberSelector from '@/components/features/workout/MemberSelector'; // SelectUserModal import
import { SelectHourModal } from '@/components/features/workout/SelectHourModal'; // SelectHourModal import
import { useMembers, Member } from '@/hooks/use-members'; // Member 타입 import
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Avatar import

const WorkoutPage = () => {
  const location = useLocation(); // useLocation 훅 사용
  const navigate = useNavigate(); // useNavigate 훅 사용
  // selectedMemberId는 이제 auth.users.id를 저장합니다.
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null); // 선택된 회원 정보 (UI 표시용)
  const [workoutDate, setWorkoutDate] = useState<Date | undefined>(new Date());
  const [sessionHour, setSessionHour] = useState<number>(new Date().getHours()); // 시간(hour) 상태
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([
    { id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // isLoading 상태 추가
  const { user } = useAuth();
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [swiperApi, setSwiperApi] = useState<SwiperCore | undefined>();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogContent, setConfirmDialogContent] = useState({ title: "", description: "" });
  const [membershipInfo, setMembershipInfo] = useState<{ id: string; remaining_sessions: number, total_sessions: number } | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false); // 회원 선택 모달 상태
  const [isHourModalOpen, setIsHourModalOpen] = useState(false); // 시간 선택 모달 상태 추가
  const { members } = useMembers(); // 회원 목록 가져오기
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null); // 수정 중인 workout_sessions ID 상태
  const [currentPtSessionId, setCurrentPtSessionId] = useState<string | null>(null); // 현재 작업 중인 pt_sessions ID 상태 추가

  // selectedMemberId(auth.users.id)가 변경될 때 selectedMember 상태 업데이트
  useEffect(() => {
    if (selectedMemberId) {
      // useMembers 훅에서 가져온 members 배열에서 해당 auth.users.id를 가진 회원 찾기
      const member = members.find(m => m.id === selectedMemberId);
      setSelectedMember(member || null);
    } else {
      setSelectedMember(null);
    }
  }, [selectedMemberId, members]);

  useEffect(() => {
    if (swiperApi && exerciseLogs.length > 0) {
      setTimeout(() => {
         swiperApi.slideTo(exerciseLogs.length - 1);
      }, 50);
    }
  }, [exerciseLogs.length, swiperApi]);

  // 운동 기록 불러오기 함수
  const fetchWorkoutLog = useCallback(async (workoutSessionId: string) => { // Parameter name changed to workoutSessionId
    setIsLoading(true); // 로딩 시작 확인
    try {
      // 1. workout_sessions 정보 가져오기
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('*, members!inner(user_id, name, profile_image_url)') // inner join 및 컬럼명 수정
        .eq('id', workoutSessionId) // Use workoutSessionId here
        .maybeSingle(); // Allow null if session not found

      if (sessionError || !sessionData) throw sessionError || new Error("Session not found");

      // 상태 업데이트 (회원, 날짜, 시간, 메모)
      // members 테이블 join 결과 타입 확인 및 user_id 접근 수정
      // sessionData.members가 배열이 아닌 객체로 반환됨 (single() 사용)
      const memberInfoFromJoin = sessionData.members;
      const memberUserId = memberInfoFromJoin?.user_id;

      if (memberUserId) {
        setSelectedMemberId(memberUserId); // auth.users.id 설정
        const memberInfo = members.find(m => m.id === memberUserId); // members 배열에서 찾기
        setSelectedMember(memberInfo || null);
      } else {
         // members 정보가 없는 경우 처리 (이론상 inner join으로 인해 발생하지 않음)
         console.error("Member info not found despite inner join.");
         setSelectedMemberId(null);
         setSelectedMember(null);
      }

      if (sessionData.session_date) {
        const date = new Date(sessionData.session_date);
        setWorkoutDate(date);
        setSessionHour(getHours(date));
      }
      setSessionNotes(sessionData.notes || "");

      // 2. workout_exercises 정보 가져오기
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select('*, workout_sets(*), workout_media(*)') // sets와 media 정보 join
        .eq('session_id', workoutSessionId) // FIX: Use workoutSessionId here
        .order('order');

      if (exercisesError) throw exercisesError;

      // 3. exerciseLogs 상태 재구성
      const fetchedExerciseLogs: ExerciseLog[] = exercisesData.map(exercise => ({
        id: exercise.id, // 기존 workout_exercises id 사용
        exerciseId: exercise.exercise_id,
        notes: exercise.notes || '',
        sets: exercise.workout_sets.sort((a, b) => a.set_number - b.set_number).map(set => ({
          id: set.id, // 기존 workout_sets id 사용
          weight: set.weight !== null ? String(set.weight) : '',
          reps: set.reps !== null ? String(set.reps) : '',
          completed: set.completed || false,
        })),
        media: exercise.workout_media.map(media => ({
          id: media.id, // 기존 workout_media id 사용
          storagePath: media.storage_path,
          fileName: media.file_name || undefined,
          mimeType: media.mime_type || undefined,
          // file 객체는 불러오지 않음 (필요시 URL 생성 로직 추가)
        })),
      }));

      setExerciseLogs(fetchedExerciseLogs.length > 0 ? fetchedExerciseLogs : [
        { id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }
      ]); // 데이터 없으면 초기 상태

    } catch (error: any) {
      console.error("Error fetching workout log:", error);
      // 오류 발생 시 페이지 이동 대신 오류 메시지 표시
      toast({ title: "오류", description: `운동 기록 불러오기 실패: ${error.message}`, variant: "destructive" });
      // 오류 발생 시 상태 초기화 (선택 사항)
      setExerciseLogs([{ id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }]);
      setSessionNotes("");
      setSessionHour(new Date().getHours());
      setSelectedMemberId(null);
      setSelectedMember(null);
      setEditingSessionId(null);
    } finally {
      setIsLoading(false); // 로딩 종료 확인
    }
  }, [supabase, members, toast, navigate]); // setIsLoading 제거 (컴포넌트 스코프 내에서 정의됨)

  // SchedulePage에서 전달된 state 처리
  useEffect(() => {
    const state = location.state as {
      selectedMember?: Member;
      selectedDate?: Date;
      ptSessionId?: string; // ID of the pt_session
      workoutSessionId?: string; // ID of the workout_session (for editing)
    };

    const processState = async () => {
      if (state) {
        if (state.selectedMember && state.selectedDate && state.ptSessionId && !state.workoutSessionId) {
          // Case 1: Starting a new workout from SchedulePage (PT 시작)
          console.log('[WorkoutPage] Received state for New PT:', state);
          setSelectedMemberId(state.selectedMember.id);
          setSelectedMember(state.selectedMember); // Set member info directly
          setWorkoutDate(new Date(state.selectedDate)); // Ensure date is a Date object
          setSessionHour(getHours(new Date(state.selectedDate)));
          setEditingSessionId(null);
          setCurrentPtSessionId(state.ptSessionId);
          // Clear state after processing
          navigate(location.pathname, { replace: true, state: {} });

        } else if (state.workoutSessionId) {
          // Case 2: Editing an existing workout from SchedulePage (기록 수정)
          console.log('[WorkoutPage] Received state for Edit Workout:', state);
          setEditingSessionId(state.workoutSessionId);
          setCurrentPtSessionId(state.ptSessionId ?? null); // Use ptSessionId if passed

          // fetchWorkoutLog will set member, date, hour, notes, and exerciseLogs
          await fetchWorkoutLog(state.workoutSessionId);

          // Clear state only if it was processed
          if (state.workoutSessionId) {
            navigate(location.pathname, { replace: true, state: {} });
          }

        } else if (state.ptSessionId && !state.selectedMember && !state.selectedDate && !state.workoutSessionId) {
           // Case 3: Received only ptSessionId (e.g., direct link or older flow)
           console.warn('[WorkoutPage] Received only ptSessionId in state. Assuming new workout:', state.ptSessionId);
           setEditingSessionId(null);
           setCurrentPtSessionId(state.ptSessionId);
           if (state.ptSessionId) { // Clear state only if it was processed
             navigate(location.pathname, { replace: true, state: {} });
           }
        } else if (location.state && Object.keys(location.state).length > 0) { // Check if state is not empty before clearing
          // Clear any other unexpected state only if state is not already empty
           console.log('[WorkoutPage] Clearing unexpected state:', location.state);
           navigate(location.pathname, { replace: true, state: {} });
        }
      }
    };
    processState();
  }, [location.state, navigate, fetchWorkoutLog]); // supabase removed as it's used within fetchWorkoutLog

  // 날짜와 시간을 조합하여 ISO 문자열 생성하는 헬퍼 함수 (분은 00으로 고정)
  const getCombinedDateTimeISO = (date: Date | undefined, hour: number): string | null => {
    if (!date || typeof hour !== 'number' || hour < 0 || hour > 23) return null;
    try {
      let combinedDate = setHours(date, hour);
      combinedDate = setMinutes(combinedDate, 0); // 분을 0으로 설정
      return combinedDate.toISOString();
    } catch (error) {
      console.error("Error combining date and time:", error);
      return null;
    }
  };



  // 회원 선택 모달에서 회원 선택 시 호출될 콜백
  const handleMemberSelect = (memberId: string | null) => {
    setSelectedMemberId(memberId); // auth.users.id 저장
    setIsMemberModalOpen(false); // 모달 닫기
  };

  // 시간 선택 모달에서 시간 선택 시 호출될 콜백
  const handleHourSelect = (hour: number) => {
    setSessionHour(hour);
    setIsHourModalOpen(false); // 모달 닫기
  };

  const handleSaveWorkout = async () => {
     // sessionHour 사용, selectedMemberId (auth.users.id) 확인
     if (!selectedMemberId || !workoutDate || sessionHour === null || !user || !userCenter) {
       toast({ title: "오류", description: "회원, 날짜, 시간, 트레이너 또는 센터 정보가 유효하지 않습니다.", variant: "destructive" });
       return;
     }
     if (exerciseLogs.length === 0 || exerciseLogs.every(log => !log.exerciseId)) {
        toast({ title: "알림", description: "기록할 운동을 선택해주세요.", variant: "default" });
        return;
     }

     const combinedDateTime = getCombinedDateTimeISO(workoutDate, sessionHour);
     if (!combinedDateTime) {
       toast({ title: "오류", description: "날짜 또는 시간 형식이 올바르지 않습니다.", variant: "destructive" });
       return;
     }

     try {
       const memberUserId = selectedMemberId;

       // 해당 회원의 유효한 (잔여 횟수 > 0) 모든 멤버십을 가져와 가장 오래된 것부터 정렬
       const { data: activeMemberships, error: membershipError } = await supabase
         .from('memberships')
         .select('id, remaining_sessions, total_sessions, start_date, created_at') // 정렬을 위해 start_date 또는 created_at 포함
         .eq('member_id', memberUserId)
         .gt('remaining_sessions', 0) // 잔여 횟수가 0보다 큰 멤버십만
         .order('start_date', { ascending: true }) // 계약 시작일이 오래된 순서대로 정렬
         .order('created_at', { ascending: true }); // 시작일이 같다면 생성일 순

       if (membershipError) throw membershipError;

       if (!activeMemberships || activeMemberships.length === 0) {
         toast({ title: "오류", description: "해당 회원의 유효한 PT 멤버십 정보를 찾을 수 없습니다. PT 횟수를 차감할 수 없습니다.", variant: "destructive" });
         return;
       }

       // 차감할 대상 멤버십은 정렬된 목록의 첫 번째 항목
       const targetMembership = activeMemberships[0];
       setMembershipInfo(targetMembership); // 차감 대상 멤버십 정보 저장

       if (targetMembership.remaining_sessions <= 0) { // 이중 확인 (이론상 gt(0)으로 필터링됨)
         toast({ title: "알림", description: "선택된 멤버십의 남은 PT 횟수가 없습니다.", variant: "default" });
         return;
       }

       setConfirmDialogContent({
         title: "PT 횟수 차감 확인",
         description: `운동 기록을 저장하면 '${format(parseISO(targetMembership.start_date!), 'yyyy/MM/dd')} 계약'의 남은 PT 횟수가 ${targetMembership.remaining_sessions}회에서 ${targetMembership.remaining_sessions - 1}회로 차감됩니다. 계속하시겠습니까?`
       });
       setIsConfirmDialogOpen(true);

     } catch (error: any) {
       console.error("Error checking membership:", error);
       toast({ title: "멤버십 조회 오류", description: error.message || "멤버십 정보 조회 중 오류 발생", variant: "destructive" });
     }
   };

  const confirmAndSaveWorkout = async () => {
    setIsConfirmDialogOpen(false);
    setIsSaving(true);

    if (!selectedMemberId || !workoutDate || sessionHour === null || !user || !userCenter || !membershipInfo || !selectedMember) {
      toast({ title: "오류", description: "회원, 날짜, 시간, 트레이너 또는 센터 정보가 유효하지 않습니다.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    try {
      // Member mapping data fetching
      const { data: memberMappingData, error: mappingError } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', selectedMemberId)
        .single();

      if (mappingError || !memberMappingData) {
        console.error("Error fetching member mapping data:", mappingError);
        toast({ title: "오류", description: "회원 ID 매핑 정보를 찾을 수 없습니다.", variant: "destructive" });
        throw mappingError || new Error("회원 ID 매핑 정보 조회 실패");
      }
      const memberTableId = memberMappingData.id;

      // Calculate session_order and totalSessions here
      const { count: existingSessionCount, error: countError } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberTableId); // Use memberTableId (members.id)

      if (countError) {
        console.error("Error counting existing workout sessions:", countError);
        throw new Error("기존 세션 수 조회 오류");
      }

      const sessionOrder = (existingSessionCount ?? 0) + 1;
      const totalSessions = membershipInfo?.total_sessions ?? null; // Use total_sessions from membershipInfo

      const combinedDateTime = getCombinedDateTimeISO(workoutDate, sessionHour);
      if (!combinedDateTime) {
        toast({ title: "오류", description: "날짜 또는 시간 형식이 올바르지 않습니다.", variant: "destructive" });
        throw new Error("날짜 또는 시간 형식 오류");
      }

      let sessionId: string;
      // ptSessionIdToUpdate 변수 제거, currentPtSessionId 상태 사용

      if (editingSessionId) {
        // --- Update Logic ---
        sessionId = editingSessionId;
        console.log(`[WorkoutPage] Updating workout session: ${sessionId}`);

        // 1. Update workout_sessions
        const { error: sessionUpdateError } = await supabase
          .from('workout_sessions')
          .update({
            session_date: combinedDateTime,
            notes: sessionNotes || null,
            updated_at: new Date().toISOString(),
            session_order: sessionOrder, // Use calculated sessionOrder from outer scope
            total_sessions_at_creation: totalSessions, // Use totalSessions from outer scope
          })
          .eq('id', sessionId);
        if (sessionUpdateError) throw sessionUpdateError;

        // 2. Delete old exercises, sets, media
        const { data: existingExercises, error: fetchExistingError } = await supabase
          .from('workout_exercises')
          .select('id, workout_sets(id), workout_media(id, storage_path)')
          .eq('session_id', sessionId);
        if (fetchExistingError) throw fetchExistingError;

        if (existingExercises && existingExercises.length > 0) {
          const exerciseIds = existingExercises.map(ex => ex.id);
          const setIds = existingExercises.flatMap(ex => ex.workout_sets.map(s => s.id));
          const mediaToDelete = existingExercises.flatMap(ex => ex.workout_media);

          if (setIds.length > 0) {
            await supabase.from('workout_sets').delete().in('id', setIds);
          }
          if (mediaToDelete.length > 0) {
            const storagePaths = mediaToDelete.map(m => m.storage_path).filter((p): p is string => !!p);
            if (storagePaths.length > 0) {
               await supabase.storage.from('workoutmedia').remove(storagePaths);
            }
            await supabase.from('workout_media').delete().in('id', mediaToDelete.map(m => m.id));
          }
          await supabase.from('workout_exercises').delete().in('id', exerciseIds);
        }

        // 3. Insert new exercises, sets, media
        for (const [index, log] of exerciseLogs.entries()) {
          if (!log.exerciseId) continue;
          const { data: exerciseData, error: exerciseError } = await supabase
            .from('workout_exercises')
            .insert({ session_id: sessionId, exercise_id: log.exerciseId, notes: log.notes || null, order: index })
            .select('id').single();
          if (exerciseError || !exerciseData) throw exerciseError || new Error("운동 항목 저장 실패");
          const workoutExerciseId = exerciseData.id;

          const setsToInsert = log.sets.map((set, setIndex) => ({
            workout_exercise_id: workoutExerciseId, set_number: setIndex + 1,
            weight: typeof set.weight === 'number' ? set.weight : (set.weight === '' ? null : Number(set.weight)),
            reps: typeof set.reps === 'number' ? set.reps : (set.reps === '' ? null : Number(set.reps)),
            completed: set.completed,
          }));
          const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
          if (setsError) throw setsError;

          if (log.media && log.media.length > 0) {
            const uploadPromises = log.media.filter(mf => mf.file).map(async (mf) => {
              if (!mf.file || !mf.fileName) return null;
              const fileExt = mf.fileName.split('.').pop() || '';
              const uniqueFileName = `${uuidv4()}.${fileExt}`;
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
        // ptSessionIdToUpdate = editingSessionId; // 수정 시에는 currentPtSessionId 상태 사용

      } else {
        // --- Create New Logic ---
        console.log('[WorkoutPage] Creating new workout session');

        // 1. Insert workout_sessions
        const { data: sessionInsertData, error: sessionInsertError } = await supabase
          .from('workout_sessions')
          .insert({
            member_id: memberTableId,
            trainer_id: user.id,
            center_id: userCenter,
            session_date: combinedDateTime,
            notes: sessionNotes || null,
            session_order: sessionOrder,
            total_sessions_at_creation: totalSessions,
            membership_id: membershipInfo.id, // 어떤 멤버십에서 차감되었는지 기록
          })
          .select('id').single();
        if (sessionInsertError || !sessionInsertData) throw sessionInsertError || new Error("운동 세션 저장 실패");
        sessionId = sessionInsertData.id;
        console.log(`[WorkoutPage] New workout session created with ID: ${sessionId}, linked to membership_id: ${membershipInfo.id}`);

        // 2. Insert exercises, sets, media
        for (const [index, log] of exerciseLogs.entries()) {
           if (!log.exerciseId) continue;
           const { data: exerciseData, error: exerciseError } = await supabase
             .from('workout_exercises')
             .insert({ session_id: sessionId, exercise_id: log.exerciseId, notes: log.notes || null, order: index })
             .select('id').single();
           if (exerciseError || !exerciseData) throw exerciseError || new Error("운동 항목 저장 실패");
           const workoutExerciseId = exerciseData.id;

           const setsToInsert = log.sets.map((set, setIndex) => ({
             workout_exercise_id: workoutExerciseId, set_number: setIndex + 1,
             weight: typeof set.weight === 'number' ? set.weight : (set.weight === '' ? null : Number(set.weight)),
             reps: typeof set.reps === 'number' ? set.reps : (set.reps === '' ? null : Number(set.reps)),
             completed: set.completed,
           }));
           const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
           if (setsError) throw setsError;

           if (log.media && log.media.length > 0) {
             const uploadPromises = log.media.filter(mf => mf.file).map(async (mf) => {
               if (!mf.file || !mf.fileName) return null;
               const fileExt = mf.fileName.split('.').pop() || '';
               const uniqueFileName = `${uuidv4()}.${fileExt}`;
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

        // 3. Decrement membership sessions
        const { error: membershipUpdateError } = await supabase
          .from('memberships')
          .update({ remaining_sessions: membershipInfo.remaining_sessions - 1 })
          .eq('id', membershipInfo.id);
        if (membershipUpdateError) throw membershipUpdateError;
        console.log(`[WorkoutPage] Membership sessions decremented for member ${selectedMemberId}`);

        // 4. Get ptSessionId to update status (already set in useEffect via setCurrentPtSessionId)
        // const state = location.state as { ptSessionId?: string };
        // if (state?.ptSessionId) {
        //    ptSessionIdToUpdate = state.ptSessionId;
        //    console.log(`[WorkoutPage] Updating linked pt_session: ${ptSessionIdToUpdate}`);
        // } else {
        //    console.warn('[WorkoutPage] No ptSessionId found in state for new workout. Skipping pt_session status update.');
        // }
      }

      // Update PT session status (common) using currentPtSessionId state
      if (currentPtSessionId) {
        console.log(`[WorkoutPage] Attempting to update pt_session status for ID: ${currentPtSessionId}`);
        try {
          const { error: updateError } = await supabase
            .from('pt_sessions')
            .update({ status: 'completed', workout_session_id: sessionId })
            .eq('id', currentPtSessionId); // Use state variable
          if (updateError) {
            console.error("Error updating pt_session status:", updateError);
            toast({ title: "경고", description: "운동 기록은 저장되었으나, 세션 상태 업데이트에 실패했습니다.", variant: "default" });
          } else {
            console.log(`[WorkoutPage] Successfully updated pt_session ${currentPtSessionId} status to completed.`);
            toast({ title: "성공", description: "운동 기록이 저장되고 세션 상태가 업데이트되었습니다." });
          }
        } catch (updateError: any) {
           console.error("Error in status update block:", updateError);
           toast({ title: "경고", description: "운동 기록은 저장되었으나, 세션 상태 업데이트 중 오류 발생.", variant: "default" });
        }
      } else {
         console.warn('[WorkoutPage] currentPtSessionId is null, skipping PT session status update.');
         toast({ title: "성공", description: "운동 기록이 저장되었습니다." }); // Still show success for workout save
      }

      // Reset state and navigate on success
      setExerciseLogs([{ id: uuidv4(), exerciseId: null, sets: [{ id: uuidv4(), weight: '', reps: '', completed: false }], notes: '', media: [] }]);
      setSessionNotes("");
      setSessionHour(new Date().getHours());
      setSelectedMemberId(null);
      setSelectedMember(null);
      setEditingSessionId(null);
      navigate('/schedule', { state: { refetch: true, completedPtSessionId: currentPtSessionId, completedWorkoutSessionId: sessionId } }); // Pass IDs

    } catch (error: any) {
      console.error("Error saving workout:", error);
      toast({ title: "저장 오류", description: error.message || "운동 기록 저장 중 오류 발생", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">운동 관리</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>수업 정보</CardTitle>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {/* 회원 선택 버튼을 MemberSelector로 대체 */}
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
              {/* 날짜 및 시간 선택 영역 */}
              <div className="flex flex-1 gap-2 items-end">
                 <div className="flex-1">
                   <Label htmlFor="workout-date">날짜</Label>
                   <DatePicker date={workoutDate} setDate={setWorkoutDate} />
                 </div>
                 {/* 시간 선택 버튼 */}
                 <div className="w-28">
                   <Label>시간</Label>
                   <Button
                     variant="outline"
                     className="w-full justify-start text-left font-normal mt-1 h-10"
                     onClick={() => setIsHourModalOpen(true)}
                   >
                     <Clock className="mr-2 h-4 w-4" />
                     {String(sessionHour).padStart(2, '0')}:00
                   </Button>
                 </div>
              </div>
            </div>
          </CardHeader>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>운동 기록</CardTitle>
              {exerciseLogs.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => swiperApi?.slidePrev()}
                    disabled={!swiperApi}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => swiperApi?.slideNext()}
                    disabled={!swiperApi}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
             <ExerciseLogger exerciseLogs={exerciseLogs} setExerciseLogs={setExerciseLogs} setApi={setSwiperApi} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>전체 수업 메모</CardTitle>
          </CardHeader>
          <CardContent>
             <WorkoutNotes initialNotes={sessionNotes} onNotesChange={setSessionNotes} />
          </CardContent>
        </Card>


        <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
          {/* <Button variant="outline" className="w-full sm:w-auto">초기화</Button> */} {/* 초기화 버튼 제거 */}
          <Button onClick={handleSaveWorkout} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* MemberSelector를 Dialog로 감싸는 부분 제거 (이미 위에서 직접 사용) */}

      {/* 시간 선택 모달 */}
      <SelectHourModal
        isOpen={isHourModalOpen}
        onClose={() => setIsHourModalOpen(false)}
        onHourSelect={handleHourSelect}
        currentHour={sessionHour}
      />

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSaveWorkout} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              확인 및 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}; // WorkoutPage 컴포넌트 정의 종료

export default WorkoutPage; // 컴포넌트를 기본으로 내보내기
