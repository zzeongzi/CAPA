import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import AddExerciseModal from '@/components/features/trainer/AddExerciseModal'; // Import the modal
import { PlusCircle, Trash2 } from 'lucide-react'; // Import icons used in the exercise list

const templateFormSchema = z.object({
  name: z.string().min(1, "템플릿 이름은 필수입니다.").max(100, "템플릿 이름은 100자 이내여야 합니다."),
  description: z.string().max(500, "설명은 500자 이내여야 합니다.").optional().nullable(),
  exercises: z.array(z.object({
    id: z.string().optional(), // ID from workout_template_exercises if existing
    exercise_id: z.string().min(1, "운동을 선택해주세요."),
    sets: z.preprocess(val => Number(val) || null, z.number().min(1, "세트 수는 1 이상이어야 합니다.").nullable()),
    reps: z.string().optional().nullable(),
    rest_period_seconds: z.preprocess(val => Number(val) || null, z.number().min(0, "휴식 시간은 0 이상이어야 합니다.").nullable()),
    notes: z.string().optional().nullable(),
    exercise_order: z.number(),
  })).optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface Exercise { // For the list of all available exercises
  id: string;
  name: string;
  // Add other relevant exercise fields if needed for display
}

interface WorkoutTemplateExercise { // For exercises linked to the template
  id?: string; // This will be the id from workout_template_exercises table
  exercise_id: string;
  sets: number | null;
  reps: string | null;
  rest_period_seconds: number | null;
  notes: string | null;
  exercise_order: number;
  // If you need to display exercise name directly in this structure after fetching:
  // exercises?: { name: string }; // Populated from the 'exercises' table
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  trainer_id: string;
  center_id: string;
  workout_template_exercises?: WorkoutTemplateExercise[]; // Added this
}

// Fetch all available exercises for selection
const fetchAllExercises = async (): Promise<Exercise[]> => {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name') // Select only necessary fields
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching all exercises:', error);
    throw error;
  }
  return data || [];
};


// Fetch existing template for editing, now including its exercises
const fetchWorkoutTemplate = async (templateId: string): Promise<WorkoutTemplate | null> => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(`
      *,
      workout_template_exercises (
        id,
        exercise_id,
        sets,
        reps,
        rest_period_seconds,
        notes,
        exercise_order
      )
    `)
    .eq('id', templateId)
    .order('exercise_order', { foreignTable: 'workout_template_exercises', ascending: true })
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: "Searched item was not found"
    console.error('Error fetching template with exercises:', error);
    throw error;
  }
  return data;
};

// Create or Update template
const upsertWorkoutTemplate = async ({
  values,
  trainerId,
  centerId,
  templateId,
}: {
  values: TemplateFormData;
  trainerId: string;
  centerId: string;
  templateId?: string;
}): Promise<WorkoutTemplate> => {
  const { exercises, ...templateData } = values;

  const templateRecord = {
    ...templateData,
    trainer_id: trainerId,
    center_id: centerId,
  };

  let savedTemplate: WorkoutTemplate;

  // 1. Upsert main template data
  if (templateId) {
    const { data, error } = await supabase
      .from('workout_templates')
      .update(templateRecord)
      .eq('id', templateId)
      .select()
      .single();
    if (error) throw new Error(`Error updating template: ${error.message}`);
    savedTemplate = data;
  } else {
    const { data, error } = await supabase
      .from('workout_templates')
      .insert(templateRecord)
      .select()
      .single();
    if (error) throw new Error(`Error creating template: ${error.message}`);
    savedTemplate = data;
  }

  if (!savedTemplate) throw new Error("Failed to save template data.");

  // 2. Handle workout_template_exercises
  // First, delete existing exercises for this template if it's an edit
  if (templateId) {
    const { error: deleteError } = await supabase
      .from('workout_template_exercises')
      .delete()
      .eq('template_id', templateId);
    if (deleteError) throw new Error(`Error deleting old template exercises: ${deleteError.message}`);
  }

  // Then, insert new exercises if any
  if (exercises && exercises.length > 0) {
    const exercisesToInsert = exercises.map((ex, index) => ({
      template_id: savedTemplate.id,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps: ex.reps,
      rest_period_seconds: ex.rest_period_seconds,
      notes: ex.notes,
      exercise_order: ex.exercise_order || index + 1, // Ensure order is set
    }));

    const { error: insertExercisesError } = await supabase
      .from('workout_template_exercises')
      .insert(exercisesToInsert);
    if (insertExercisesError) throw new Error(`Error inserting new template exercises: ${insertExercisesError.message}`);
  }
  
  // Return the main template data (exercises are linked by template_id)
  // To reflect the newly saved exercises immediately, we'd ideally fetch them again or have them returned by an RPC.
  // For now, returning savedTemplate which doesn't have the exercises populated unless fetched again.
  return savedTemplate; 
};


const CreateEditWorkoutTemplatePage = () => {
  const { templateId } = useParams<{ templateId?: string }>();
  const navigate = useNavigate();
  const { user, userCenter } = useAuth(); // Assuming userCenter provides current center_id
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditMode = Boolean(templateId);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      description: '',
      exercises: [],
    },
  });

  const { fields, append, remove, update, move } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  const { data: allExercises = [], isLoading: isLoadingAllExercises } = useQuery<Exercise[], Error>({
    queryKey: ['allExercises'],
    queryFn: fetchAllExercises,
  });

  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery<WorkoutTemplate | null, Error>({
    queryKey: ['workoutTemplate', templateId],
    queryFn: () => fetchWorkoutTemplate(templateId!),
    enabled: isEditMode && !!templateId,
  });

  useEffect(() => {
    if (isEditMode && existingTemplate) {
      form.reset({
        name: existingTemplate.name,
        description: existingTemplate.description || '',
        exercises: existingTemplate.workout_template_exercises?.map(ex => ({ ...ex })) || [],
      });
    }
  }, [isEditMode, existingTemplate, form]);

  const upsertMutation = useMutation({
    mutationFn: (values: TemplateFormData) => {
      if (!user?.id || !userCenter) { // Use userCenter from useAuth
        throw new Error("User or center information is missing.");
      }
      return upsertWorkoutTemplate({ values, trainerId: user.id, centerId: userCenter, templateId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workoutTemplates', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['workoutTemplate', data.id]});
      toast({
        title: "성공",
        description: `워크아웃 템플릿이 성공적으로 ${isEditMode ? '수정' : '생성'}되었습니다.`,
      });
      navigate('/trainer/templates'); // Or navigate to the template detail page: `/trainer/templates/edit/${data.id}`
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: `템플릿 ${isEditMode ? '수정' : '생성'} 중 오류: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: TemplateFormData) => {
    upsertMutation.mutate(values);
  };

  if (isLoadingTemplate && isEditMode) {
    return (
      <AppLayout title="템플릿 로딩 중..." description="템플릿 정보를 불러오고 있습니다.">
        <Card className="max-w-2xl mx-auto">
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-24" />
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  
  // Handle case where template is not found in edit mode but not loading
  if (isEditMode && !isLoadingTemplate && !existingTemplate) {
    return (
       <AppLayout title="오류" description="템플릿을 찾을 수 없습니다.">
        <div className="text-center py-10">
          <p className="text-xl text-red-500">템플릿을 찾을 수 없습니다.</p>
          <Button onClick={() => navigate('/trainer/templates')} className="mt-4">
            템플릿 목록으로 돌아가기
          </Button>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout
      title={isEditMode ? "워크아웃 템플릿 수정" : "새 워크아웃 템플릿 만들기"}
      description={isEditMode ? "기존 워크아웃 템플릿의 세부 정보를 수정합니다." : "새로운 운동 루틴 템플릿을 생성합니다."}
    >
      <Card className="max-w-3xl mx-auto my-8">
        <CardHeader>
          <CardTitle>{isEditMode ? "템플릿 수정" : "새 템플릿"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>템플릿 이름</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 전신 근력 강화" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (선택 사항)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="템플릿에 대한 간단한 설명을 입력하세요."
                        className="resize-none"
                        {...field}
                        value={field.value ?? ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="my-6 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">운동 목록</h3>
                  <AddExerciseModal 
                    allExercises={allExercises} 
                    isLoadingAllExercises={isLoadingAllExercises}
                    onAddExercise={(exerciseId) => {
                      const newOrder = fields.length > 0 ? Math.max(...fields.map(f => f.exercise_order), 0) + 1 : 1;
                      append({ exercise_id: exerciseId, sets: 3, reps: '10', rest_period_seconds: 60, notes: '', exercise_order: newOrder });
                    }} 
                  />
                </div>

                {fields.length === 0 && (
                  <div className="p-4 border rounded-md bg-gray-50 text-center text-gray-500">
                    <p>아직 추가된 운동이 없습니다. "운동 추가" 버튼을 눌러 운동을 추가하세요.</p>
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const selectedExercise = allExercises.find(e => e.id === form.watch(`exercises.${index}.exercise_id`));
                    return (
                      <Card key={field.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                            <FormLabel className="text-base font-medium">
                              {selectedExercise ? selectedExercise.name : `운동 ${index + 1}`}
                            </FormLabel>
                            <FormDescription>
                              {selectedExercise ? `ID: ${selectedExercise.id}`: "운동을 선택하세요."}
                            </FormDescription>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`exercises.${index}.exercise_id`}
                            render={({ field: exerciseIdField }) => (
                              <FormItem>
                                <FormLabel>운동 선택</FormLabel>
                                <FormControl>
                                  <select
                                    {...exerciseIdField}
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={isLoadingAllExercises}
                                  >
                                    <option value="">운동을 선택하세요</option>
                                    {allExercises.map(ex => (
                                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                                    ))}
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={form.control}
                            name={`exercises.${index}.sets`}
                            render={({ field: setsField }) => (
                              <FormItem>
                                <FormLabel>세트</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="예: 3" {...setsField} onChange={e => setsField.onChange(parseInt(e.target.value, 10) || null)} value={setsField.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`exercises.${index}.reps`}
                            render={({ field: repsField }) => (
                              <FormItem>
                                <FormLabel>반복</FormLabel>
                                <FormControl>
                                  <Input placeholder="예: 8-12 또는 AMRAP" {...repsField} value={repsField.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`exercises.${index}.rest_period_seconds`}
                            render={({ field: restField }) => (
                              <FormItem>
                                <FormLabel>휴식 시간 (초)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="예: 60" {...restField} onChange={e => restField.onChange(parseInt(e.target.value, 10) || null)} value={restField.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                            control={form.control}
                            name={`exercises.${index}.notes`}
                            render={({ field: notesField }) => (
                              <FormItem className="mt-4">
                                <FormLabel>운동 노트 (선택 사항)</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="이 운동에 대한 추가 노트..." {...notesField} value={notesField.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {/* Hidden input for exercise_order, will be managed by drag/drop or move buttons later */}
                          <input type="hidden" {...form.register(`exercises.${index}.exercise_order`)} />
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                 <Button type="button" variant="outline" onClick={() => navigate('/trainer/templates')}>
                  취소
                </Button>
                <Button type="submit" disabled={upsertMutation.isLoading}>
                  {upsertMutation.isLoading ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '템플릿 저장' : '템플릿 생성')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default CreateEditWorkoutTemplatePage;
