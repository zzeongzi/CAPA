import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface UserRoleData {
  roles: string[];
  isTrainer: boolean;
  isMember: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isLoading: boolean;
  error: any;
}

const fetchUserRoles = async (userId: string | undefined): Promise<string[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user roles:', error);
    throw error;
  }

  return data?.map(r => r.role) || [];
};

export const useUserRole = (): UserRoleData => {
  const { user } = useAuth();

  const { data: roles = [], isLoading, error } = useQuery<string[], Error>({
    queryKey: ['userRoles', user?.id],
    queryFn: () => fetchUserRoles(user?.id),
    enabled: !!user, // Only run if the user is loaded
  });

  if (!user) {
    return {
      roles: [],
      isTrainer: false,
      isMember: false,
      isAdmin: false,
      isOwner: false,
      isLoading: false,
      error: null,
    };
  }
  
  const isTrainer = roles.includes('trainer');
  const isMember = roles.includes('member');
  // Assuming 'admin' is a role that can be present in the user_roles table.
  // If the ENUM for 'role' in 'user_roles' only contains 'trainer' and 'member',
  // then 'isAdmin' would always be false unless the DB schema is updated.
  const isAdmin = roles.includes('admin'); 
  
  // Placeholder logic for isOwner: if user is an admin, they are considered an owner.
  // This might need more specific logic based on application requirements.
  const isOwner = isAdmin; 

  return {
    roles,
    isTrainer,
    isMember,
    isAdmin,
    isOwner,
    isLoading,
    error,
  };
};
