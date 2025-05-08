import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

// Exercise 타입에 target_muscles 추가
type Exercise = Database['public']['Tables']['exercises']['Row'] & {
  target_muscles?: string[] | null;
};
// types.ts에 members 테이블 정의가 있다고 가정합니다. 없다면 추가 필요.
type Member = Database['public']['Tables']['members']['Row'];

interface WorkoutState {
  exercises: Exercise[];
  members: Member[]; // 회원 목록 추가
  isLoadingExercises: boolean;
  isLoadingMembers: boolean; // 회원 로딩 상태 추가
  exerciseError: string | null;
  memberError: string | null; // 회원 오류 상태 추가
  fetchExercises: () => Promise<void>;
  fetchMembers: (centerId: string) => Promise<void>; // 센터 ID 기반 회원 로딩
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  exercises: [],
  members: [],
  isLoadingExercises: false,
  isLoadingMembers: false,
  exerciseError: null,
  memberError: null,

  fetchExercises: async () => {
    set({ isLoadingExercises: true, exerciseError: null });
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*, target_muscles') // target_muscles 컬럼 추가
        .order('name');
      if (error) throw error;
      set({ exercises: (data as Exercise[]) || [], isLoadingExercises: false });
    } catch (err: any) {
      console.error("Error fetching exercises:", err);
      set({ exerciseError: "운동 목록 로딩 오류", isLoadingExercises: false, exercises: [] });
    }
  },

  fetchMembers: async (centerId: string) => {
    set({ isLoadingMembers: true, memberError: null });
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('center_id', centerId)
        .order('name');
      if (error) throw error;
      set({ members: (data as Member[]) || [], isLoadingMembers: false });
    } catch (err: any) {
      console.error("Error fetching members:", err);
      set({ memberError: "회원 목록 로딩 오류", isLoadingMembers: false, members: [] });
    }
  },
}));