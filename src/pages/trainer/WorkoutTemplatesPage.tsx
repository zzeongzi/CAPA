import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/use-toast';
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

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  trainer_id: string;
  center_id: string;
}

const fetchWorkoutTemplates = async (trainerId: string | undefined): Promise<WorkoutTemplate[]> => {
  if (!trainerId) return [];
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching workout templates:', error);
    throw error;
  }
  return data || [];
};

const deleteWorkoutTemplate = async (templateId: string) => {
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Error deleting workout template:', error);
    throw new Error(`Error deleting template: ${error.message}`);
  }
  // Supabase delete doesn't return the deleted record by default unless specified with .select()
  // which is not needed here. We just need to confirm no error.
  return { id: templateId }; 
};

const WorkoutTemplatesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const trainerId = user?.id;

  const { data: templates = [], isLoading, error } = useQuery<WorkoutTemplate[], Error>({
    queryKey: ['workoutTemplates', trainerId],
    queryFn: () => fetchWorkoutTemplates(trainerId),
    enabled: !!trainerId,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkoutTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workoutTemplates', trainerId] });
      toast({ title: "성공", description: "워크아웃 템플릿이 삭제되었습니다." });
    },
    onError: (error) => {
      toast({ title: "오류", description: `템플릿 삭제 중 오류: ${error.message}`, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="워크아웃 템플릿" description="운동 루틴 템플릿을 관리합니다.">
        <div className="space-y-4">
          <Skeleton className="h-10 w-36" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-1" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="워크아웃 템플릿" description="운동 루틴 템플릿을 관리합니다.">
        <div className="text-red-500">템플릿 로딩 중 오류 발생: {error.message}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="워크아웃 템플릿" description="자주 사용하는 운동 루틴 템플릿을 만들고 관리하세요.">
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">내 워크아웃 템플릿</h1>
          <Button onClick={() => navigate('/trainer/templates/new')}>
            <PlusCircle className="mr-2 h-4 w-4" /> 새 템플릿 만들기
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <p className="text-lg mb-2">아직 생성된 워크아웃 템플릿이 없습니다.</p>
            <p>새 템플릿 만들기 버튼을 클릭하여 첫 번째 템플릿을 만들어보세요!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="h-10 overflow-hidden text-ellipsis">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-grow">
                  {/* Placeholder for future content like exercise count or tags */}
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/trainer/templates/edit/${template.id}`)}
                  >
                    <Edit className="mr-1 h-3 w-3" /> 수정
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deleteMutation.isLoading}>
                        <Trash2 className="mr-1 h-3 w-3" /> 삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          이 작업은 되돌릴 수 없습니다. '{template.name}' 템플릿이 영구적으로 삭제됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isLoading}
                        >
                          {deleteMutation.isLoading ? '삭제 중...' : '삭제 확인'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default WorkoutTemplatesPage;
