import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Square, ArrowLeft, Edit2, Clock, Dumbbell } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Types
interface WorkoutSet {
  id: string;
  set_number: number;
  reps: number | null; // From workout_sets (parsed integer)
  target_reps_text?: string | null; // To store original text like "8-12", "AMRAP"
  weight: number | null;
  completed: boolean;
  notes: string | null;
}

interface WorkoutExercise {
  id: string;
  order: number;
  notes: string | null;
  exercise_id: string;
  exercises: { // Joined data from 'exercises' table
    name: string;
    // video_url: string | null; // Consider adding if useful
  } | null;
  workout_sets: WorkoutSet[];
  // For rest period, assuming it might be in notes or a dedicated field if schema changes
  rest_period_seconds?: number | null; 
}

interface WorkoutSession {
  id: string;
  session_date: string;
  notes: string | null;
  source_template_id: string | null;
  workout_templates: { // Joined data from 'workout_templates' table
    name: string;
  } | null;
  workout_exercises: WorkoutExercise[];
  // Add trainer info if needed
  users?: { // trainer info
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}


const fetchWorkoutSessionDetails = async (workoutSessionId: string): Promise<WorkoutSession | null> => {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      id,
      session_date,
      notes,
      source_template_id,
      workout_templates (name), 
      users (full_name, avatar_url), 
      workout_exercises (
        id,
        order,
        notes,
        exercise_id,
        exercises (name), 
        workout_sets (
          id,
          set_number,
          reps,
          weight,
          completed,
          notes
        )
      )
    `)
    .eq('id', workoutSessionId)
    .order('order', { foreignTable: 'workout_exercises', ascending: true })
    .order('set_number', { foreignTable: 'workout_exercises.workout_sets', ascending: true })
    .single();

  if (error) {
    console.error('Error fetching workout session details:', error);
    throw error;
  }
  return data as WorkoutSession | null;
};


const AssignedWorkoutPage = () => {
  const { workoutSessionId } = useParams<{ workoutSessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(); // For member context if needed, or for RLS
  const { toast } = useToast();
  const [sessionSets, setSessionSets] = useState<Record<string, WorkoutSet[]>>({});

  const { data: workoutSession, isLoading, error, refetch } = useQuery<WorkoutSession | null, Error>(
    ['workoutSession', workoutSessionId],
    () => fetchWorkoutSessionDetails(workoutSessionId!),
    {
      enabled: !!workoutSessionId,
      onSuccess: (data) => {
        if (data?.workout_exercises) {
          const initialSets: Record<string, WorkoutSet[]> = {};
          data.workout_exercises.forEach(ex => {
            initialSets[ex.id] = ex.workout_sets.map(s => ({
              ...s,
              // If original reps text (e.g. "8-12", "AMRAP") was stored in workout_exercises.notes or workout_sets.notes
              // we could parse it here. For now, assuming workout_sets.reps is the integer value.
              // Example: target_reps_text: parseRepsTextFromNotes(s.notes || ex.notes)
            }));
          });
          setSessionSets(initialSets);
        }
      }
    }
  );
  
  // Function to toggle set completion
  const toggleSetCompletion = async (exerciseId: string, setId: string, currentStatus: boolean) => {
    try {
        const { error: updateError } = await supabase
            .from('workout_sets')
            .update({ completed: !currentStatus, updated_at: new Date().toISOString() })
            .eq('id', setId);

        if (updateError) throw updateError;

        // Update local state optimistically or refetch
        setSessionSets(prevSets => {
            const newExerciseSets = (prevSets[exerciseId] || []).map(s => 
                s.id === setId ? { ...s, completed: !currentStatus } : s
            );
            return { ...prevSets, [exerciseId]: newExerciseSets };
        });

        toast({ title: "세트 상태 변경", description: `세트가 ${!currentStatus ? '완료' : '미완료'}(으)로 표시되었습니다.` });
    } catch (err: any) {
        toast({ title: "오류", description: `세트 상태 변경 중 오류: ${err.message}`, variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <AppLayout title="운동 세션 로딩 중" description="운동 세션 정보를 불러오고 있습니다.">
        <div className="container mx-auto py-8 px-4">
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-6 w-1/2 mb-6" />
          {[1, 2].map(i => (
            <Card key={i} className="mb-6">
              <CardHeader><Skeleton className="h-7 w-1/2" /></CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map(j => <Skeleton key={j} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="오류" description="운동 세션 정보를 불러오는 중 오류가 발생했습니다.">
        <div className="container mx-auto py-8 px-4 text-center">
          <p className="text-red-500 mb-4">오류: {error.message}</p>
          <Button onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기</Button>
        </div>
      </AppLayout>
    );
  }

  if (!workoutSession) {
    return (
      <AppLayout title="세션 없음" description="요청한 운동 세션을 찾을 수 없습니다.">
        <div className="container mx-auto py-8 px-4 text-center">
          <p className="text-lg mb-4">해당 운동 세션을 찾을 수 없습니다.</p>
          <Button onClick={() => navigate('/workout-history')}><ArrowLeft className="mr-2 h-4 w-4" /> 내역으로 돌아가기</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="오늘의 운동" description="할당된 운동 세션의 상세 내역입니다.">
      <div className="container mx-auto py-6 px-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
        </Button>

        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-background">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">
              {format(parseISO(workoutSession.session_date), "yyyy년 M월 d일 (EEEE)", { locale: ko })} 운동
            </CardTitle>
            {workoutSession.workout_templates?.name && (
              <Badge variant="outline" className="mt-1 w-fit">
                템플릿: {workoutSession.workout_templates.name}
              </Badge>
            )}
             {workoutSession.users?.full_name && (
              <p className="text-sm text-muted-foreground mt-1">
                담당 트레이너: {workoutSession.users.full_name}
              </p>
            )}
            {workoutSession.notes && (
              <CardDescription className="pt-2 text-base">
                <strong>세션 노트:</strong> {workoutSession.notes}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {workoutSession.workout_exercises.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">이 세션에는 아직 등록된 운동이 없습니다.</p>
        ) : (
          <div className="space-y-6">
            {workoutSession.workout_exercises.map((exercise) => (
              <Card key={exercise.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 p-4">
                  <CardTitle className="text-xl flex items-center">
                    <Dumbbell className="mr-3 h-5 w-5 text-primary" />
                    {exercise.exercises?.name || '알 수 없는 운동'}
                  </CardTitle>
                  {exercise.notes && (
                    <CardDescription className="pt-1 text-sm">
                      <strong>운동 노트:</strong> {exercise.notes}
                    </CardDescription>
                  )}
                   {/* Placeholder for rest period - assuming it's in exercise.notes or a future dedicated field */}
                   {/* {exercise.rest_period_seconds && <CardDescription className="pt-1 text-sm">휴식: {exercise.rest_period_seconds}초</CardDescription>} */}
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {(sessionSets[exercise.id] || []).map((set, setIndex) => (
                      <li key={set.id} className={`flex items-center justify-between p-3 ${set.completed ? 'bg-green-500/10' : ''}`}>
                        <div className="flex items-center">
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="mr-3 h-7 w-7" 
                            onClick={() => toggleSetCompletion(exercise.id, set.id, set.completed)}
                          >
                            {set.completed ? <CheckSquare className="h-5 w-5 text-green-600" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                          </Button>
                          <Badge variant="outline" className="mr-3 w-10 h-6 flex-shrink-0 justify-center">{setIndex + 1}세트</Badge>
                          <span className="text-sm md:text-base">
                            {set.weight !== null ? `${set.weight}kg` : '-'} / {set.reps !== null ? `${set.reps}회` : (set.target_reps_text || '-')}
                          </span>
                        </div>
                        {/* Placeholder for actual input fields if needed later */}
                        {/* <div className="flex items-center gap-2">
                           <Input type="number" placeholder="무게" className="w-20 h-8 text-sm" defaultValue={set.weight ?? ''} />
                           <Input type="number" placeholder="횟수" className="w-20 h-8 text-sm" defaultValue={set.reps ?? ''} />
                        </div> */}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Placeholder for "Start Workout" or "Complete Workout" button */}
        {/* <div className="mt-8 flex justify-center">
          <Button size="lg">
            <PlayCircle className="mr-2 h-5 w-5" /> 운동 시작하기
          </Button>
        </div> */}
      </div>
    </AppLayout>
  );
};

export default AssignedWorkoutPage;
