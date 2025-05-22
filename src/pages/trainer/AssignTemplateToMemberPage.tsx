import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/components/ui/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale"; // For Korean date formatting

// Schema for form validation
const assignWorkoutSchema = z.object({
  memberId: z.string().min(1, "회원을 선택해주세요."),
  templateId: z.string().min(1, "템플릿을 선택해주세요."),
  sessionDate: z.date({
    required_error: "세션 날짜를 선택해주세요.",
    invalid_type_error: "유효한 날짜를 선택해주세요.",
  }),
});

type AssignWorkoutFormData = z.infer<typeof assignWorkoutSchema>;

interface Member {
  id: string; // This is public.members.id
  name: string;
  // user_id: string; // This is auth.users.id, if needed
}

interface WorkoutTemplate {
  id: string;
  name: string;
}

// Fetch members for the current center
const fetchCenterMembers = async (centerId: string | undefined): Promise<Member[]> => {
  if (!centerId) return [];
  const { data, error } = await supabase
    .from('members')
    .select('id, name') // Assuming 'name' is directly in 'members' table
    .eq('center_id', centerId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching center members:', error);
    throw error;
  }
  return data || [];
};

// Fetch workout templates for the current trainer
const fetchWorkoutTemplates = async (trainerId: string | undefined): Promise<WorkoutTemplate[]> => {
  if (!trainerId) return [];
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name')
    .eq('trainer_id', trainerId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching workout templates:', error);
    throw error;
  }
  return data || [];
};

const AssignTemplateToMemberPage = () => {
  const navigate = useNavigate();
  const { user, userCenter } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<AssignWorkoutFormData>({
    resolver: zodResolver(assignWorkoutSchema),
    defaultValues: {
      memberId: '',
      templateId: '',
      sessionDate: new Date(),
    },
  });

  const { data: members = [], isLoading: isLoadingMembers } = useQuery<Member[], Error>({
    queryKey: ['centerMembers', userCenter?.id],
    queryFn: () => fetchCenterMembers(userCenter?.id),
    enabled: !!userCenter?.id,
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<WorkoutTemplate[], Error>({
    queryKey: ['workoutTemplates', user?.id],
    queryFn: () => fetchWorkoutTemplates(user?.id),
    enabled: !!user?.id,
  });

  const assignWorkoutMutation = useMutation({
    mutationFn: async (values: AssignWorkoutFormData) => {
      if (!user || !userCenter) {
        throw new Error("User or center information is missing.");
      }
      const { error: rpcError } = await supabase.rpc('create_workout_session_from_template', {
        p_template_id: values.templateId,
        p_member_id: values.memberId,
        p_trainer_id: user.id,
        p_center_id: userCenter.id,
        p_session_date: values.sessionDate.toISOString(),
      });

      if (rpcError) {
        console.error('Error calling create_workout_session_from_template:', rpcError);
        throw new Error(`워크아웃 할당 중 오류: ${rpcError.message}`);
      }
      return true; // Indicate success
    },
    onSuccess: () => {
      toast({
        title: "성공",
        description: "워크아웃 템플릿이 회원에게 성공적으로 할당되었습니다.",
      });
      form.reset();
      // Optionally, navigate away or refresh relevant data
      // queryClient.invalidateQueries(['someOtherKey']);
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: AssignWorkoutFormData) => {
    assignWorkoutMutation.mutate(values);
  };
  
  if (isLoadingMembers || isLoadingTemplates) {
     return (
      <AppLayout title="워크아웃 할당" description="템플릿을 선택하여 회원에게 워크아웃을 할당합니다.">
        <div className="max-w-2xl mx-auto py-8 px-4">
          <Card>
            <CardHeader><CardTitle>정보 로딩 중...</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-24" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
     );
  }

  return (
    <AppLayout title="워크아웃 템플릿 할당" description="선택한 회원에게 워크아웃 템플릿을 할당합니다.">
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>새 워크아웃 할당</CardTitle>
            <CardDescription>회원, 워크아웃 템플릿, 세션 날짜를 선택하여 할당하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>회원 선택</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="회원을 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {members.length === 0 && <SelectItem value="" disabled>선택 가능한 회원이 없습니다.</SelectItem>}
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>템플릿 선택</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="템플릿을 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {templates.length === 0 && <SelectItem value="" disabled>선택 가능한 템플릿이 없습니다.</SelectItem>}
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sessionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>세션 날짜</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${
                                !field.value && "text-muted-foreground"
                              }`}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: ko })
                              ) : (
                                <span>날짜를 선택하세요</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={assignWorkoutMutation.isLoading}>
                  {assignWorkoutMutation.isLoading ? '할당 중...' : '워크아웃 할당'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AssignTemplateToMemberPage;
