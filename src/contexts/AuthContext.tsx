import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User, UserMetadata } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string, meta?: { first_name?: string; last_name?: string }) => Promise<{ error: any | null; data: any | null }>;
  signOut: () => Promise<void>;
  userRole: Database["public"]["Enums"]["user_role"] | null;
  userCenter: string | null;
  centerName: string | null; // 센터 이름 상태 추가
  setUserRole: (role: Database["public"]["Enums"]["user_role"]) => Promise<void>;
  refreshUserRole: (currentUser: User | null) => Promise<void>;
  updateUserMetadata: (metadata: UserMetadata) => Promise<{ error: any | null }>;
  refreshCounter: number;
  triggerNotificationRefresh: () => void;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRoleState] = useState<Database["public"]["Enums"]["user_role"] | null>(null);
  const [userCenter, setUserCenter] = useState<string | null>(null);
  const [centerName, setCenterName] = useState<string | null>(null); // 센터 이름 상태 추가
  const { toast } = useToast();
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Callback to refresh user role and related data
  const refreshUserRole = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      console.log('[AuthContext] refreshUserRole called with null user.');
      setUserRoleState(null);
      setUserCenter(null);
      return;
    }
    console.log(`[AuthContext] Refreshing data for user ID: ${currentUser.id}`);
    setLoading(true); // 함수 시작 시 로딩 상태 설정
    try {
      console.log('[AuthContext] refreshUserRole: Starting data fetch...');
      let roleResult, centerResult, profileResult;

      // Fetch role
      console.log('[AuthContext] refreshUserRole: Fetching role...');
      roleResult = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle();
      console.log('[AuthContext] refreshUserRole: Role fetch result:', roleResult);
      if (roleResult.error) {
        console.error('역할 조회 오류:', roleResult.error);
        setUserRoleState(null);
      } else {
        setUserRoleState(roleResult.data?.role as Database["public"]["Enums"]["user_role"] || null); // 타입 단언 추가
        console.log('[AuthContext] refreshUserRole: Role set to:', roleResult.data?.role || null);
      }
      console.log('[AuthContext] refreshUserRole: Finished handling role result.');

      // Fetch center
      console.log('[AuthContext] refreshUserRole: Fetching center...');
      centerResult = await supabase.from('center_users').select('center_id').eq('user_id', currentUser.id).maybeSingle();
      console.log('[AuthContext] refreshUserRole: Center (ID) fetch result:', centerResult);
      const fetchedCenterId = centerResult.data?.center_id || null;
      setUserCenter(fetchedCenterId);

      if (fetchedCenterId) {
        console.log('[AuthContext] refreshUserRole: Fetching center name for ID:', fetchedCenterId);
        const { data: centerNameData, error: centerNameError } = await supabase
          .from('centers')
          .select('name')
          .eq('id', fetchedCenterId)
          .single();
        if (centerNameError && centerNameError.code !== 'PGRST116') {
          console.error('센터 이름 조회 오류:', centerNameError);
          setCenterName(null);
        } else {
          setCenterName(centerNameData?.name || null);
          console.log('[AuthContext] refreshUserRole: Center name set to:', centerNameData?.name || null);
        }
      } else {
        setCenterName(null); // 센터 ID가 없으면 센터 이름도 null
      }

      // Fetch profile (avatar_url)
      console.log('[AuthContext] refreshUserRole: Fetching profile...');
      profileResult = await supabase.from('profiles').select('avatar_url').eq('id', currentUser.id).maybeSingle();
      console.log('[AuthContext] refreshUserRole: Profile fetch result:', profileResult);

      // Handle profile result (avatar_url)
      let avatarUrl: string | null = null;
      if (profileResult.error && profileResult.error.code !== 'PGRST116') { // Ignore 'not found'
        console.error('프로필 정보 조회 오류:', profileResult.error);
      } else {
        avatarUrl = profileResult.data?.avatar_url || null;
        setUser(prevUser => {
            if (prevUser && prevUser.user_metadata?.avatar_url !== avatarUrl) {
                 const newMetadata = { ...prevUser.user_metadata, avatar_url: avatarUrl };
                 return { ...prevUser, user_metadata: newMetadata };
            }
            return prevUser;
        });
      }

    } catch (error) {
      console.error('사용자 역할/센터/프로필 정보 가져오기 실패:', error);
      setUserRoleState(null);
      setUserCenter(null);
      setCenterName(null); // 오류 시 센터 이름도 null
    } finally {
       console.log('[AuthContext] refreshUserRole FINALLY');
       setLoading(false); // 함수 종료 시 항상 로딩 상태 해제
    }
  }, [setLoading]); // 의존성 배열에 setLoading 추가

  // Combined Effect for Initialization and Auth State Changes
  useEffect(() => {
    let isMounted = true;

    const initializeAndListen = async () => {
      // 1. Initial Session Check & Data Load
      console.log('[AuthContext] Initializing auth...');
      if (isMounted) setLoading(true);
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      console.log('[AuthContext] initializeAndListen: supabase.auth.getSession() called.');
      console.log('[AuthContext] initializeAndListen: Initial session from getSession():', initialSession);
      console.log('[AuthContext] initializeAndListen: Session error from getSession():', sessionError);

      if (sessionError) {
        console.error("Error fetching initial session:", sessionError);
      }

      const initialUser = initialSession?.user ?? null;
      console.log('[AuthContext] initializeAndListen: Initial user object:', initialUser);
      if (isMounted) {
          setSession(initialSession);
          setUser(initialUser);
          console.log(`[AuthContext] initializeAndListen: setUser called with:`, initialUser);

          if (initialUser) {
              console.log('[AuthContext] Initial user found, loading data...');
              try {
                  console.log('[AuthContext] initializeAndListen: Calling refreshUserRole for initial user...');
                  await refreshUserRole(initialUser);
                  console.log('[AuthContext] initializeAndListen: refreshUserRole for initial user FINISHED.');
              } catch (error) {
                  console.error("[AuthContext] initializeAndListen: Error calling refreshUserRole for initial user:", error);
                  if (isMounted) {
                      setUserRoleState(null);
                      setUserCenter(null);
                      setCenterName(null);
                  }
              }
          } else {
              console.log('[AuthContext] No initial user found.');
              if (isMounted) {
                  setUserRoleState(null);
                  setUserCenter(null);
                  setCenterName(null);
              }
          }
          console.log('[AuthContext] initializeAndListen: Setting initial loading FALSE');
          if (isMounted) setLoading(false); // 초기 로드 완료 후 로딩 해제
          console.log('[AuthContext] Initial auth check and data load finished.');
      }


      // 2. Setup Auth State Change Listener
      console.log('[AuthContext] Setting up onAuthStateChange listener.');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted) return;

          console.log(`[AuthContext] onAuthStateChange event: ${event}`);
          setSession(currentSession);
          const currentUser = currentSession?.user ?? null;
          setUser(currentUser);

          // Handle specific events
          if (event === 'SIGNED_OUT') {
            setUserRoleState(null);
            setUserCenter(null);
            setCenterName(null);
            setLoading(false);
          } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') { // TOKEN_REFRESHED 조건 제거
            if (currentUser) {
              console.log(`[AuthContext] Refreshing user data due to ${event}...`);
              try {
                  await refreshUserRole(currentUser); // refreshUserRole 내부에서 로딩 관리
              } catch(error) {
                  console.error(`Error refreshing user role on ${event}:`, error);
                  if (isMounted) {
                      setUserRoleState(null);
                      setUserCenter(null);
                      setCenterName(null);
                  }
              } finally {
                // refreshUserRole 내부 finally에서 setLoading(false) 호출됨
                console.log(`[AuthContext] User data refresh finished after ${event}.`);
              }
          } else { // currentUser가 없는 경우 (예: TOKEN_REFRESHED 후 세션은 있지만 user가 없는 이상한 상황)
               if (isMounted) {
                   setUserRoleState(null);
                   setUserCenter(null);
                   setCenterName(null);
                   setLoading(false);
               }
          }
        } else { // SIGNED_OUT 이외의 다른 이벤트 (예: PASSWORD_RECOVERY 등)
             if (loading && isMounted) setLoading(false);
          }
        }
      );

      // Cleanup function
      return () => {
        isMounted = false;
        console.log('[AuthContext] Unsubscribing from onAuthStateChange.');
        subscription?.unsubscribe();
      };
    };

    initializeAndListen();

  }, [refreshUserRole]);


  // --- Other Auth Functions ---

  const setUserRole = async (role: Database["public"]["Enums"]["user_role"]) => { // Enum 타입 직접 사용
    if (!user) {
      toast({ title: '오류 발생', description: '사용자 인증이 필요합니다.', variant: 'destructive' });
      return;
    }
    try {
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingRole) {
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('id', existingRole.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role });
        if (insertError) throw insertError;
      }

      setUserRoleState(role);

      toast({ title: '역할 설정 완료', description: `'${role}' 역할이 성공적으로 설정되었습니다.` });
    } catch (error: any) {
      console.error('역할 설정 오류:', error);
      toast({ title: '오류 발생', description: error.message || '역할 설정 중 문제가 발생했습니다.', variant: 'destructive' });
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: '로그인 오류', description: error.message, variant: 'destructive' });
        return { error };
      }
      toast({ title: '로그인 성공', description: '환영합니다!' });
      return { error: null };
    } catch (error: any) {
      console.error('로그인 오류:', error);
      toast({ title: '로그인 오류', description: error.message || '로그인 중 문제가 발생했습니다.', variant: 'destructive' });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, meta?: { first_name?: string; last_name?: string }) => {
     try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta ? { first_name: meta.first_name, last_name: meta.last_name } : undefined,
        },
      });

      if (error) {
        toast({ title: '회원가입 오류', description: error.message, variant: 'destructive' });
        return { error, data: null };
      }

      toast({ title: '회원가입 성공', description: '계정이 생성되었습니다.' });
      return { error: null, data };
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      toast({ title: '회원가입 오류', description: error.message || '회원가입 중 문제가 발생했습니다.', variant: 'destructive' });
      return { error, data: null };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: '로그아웃 성공', description: '안전하게 로그아웃되었습니다.' });
    } catch (error: any) {
      console.error('로그아웃 오류:', error);
      toast({ title: '로그아웃 오류', description: error.message || '로그아웃 중 문제가 발생했습니다.', variant: 'destructive' });
    }
  };

  const updateUserMetadata = async (metadata: UserMetadata) => {
     try {
      // updateUser 반환값에 user 정보가 포함됨
      const { data, error } = await supabase.auth.updateUser({ data: metadata });
      if (error) throw error;
      console.log('[AuthContext] User metadata update request sent successfully.');
      // 로컬 상태 즉시 업데이트 (선택 사항, 이벤트 리스너가 처리할 수도 있음)
      if (data.user) {
        setUser(data.user); // 업데이트된 user 객체로 상태 업데이트
      }
      return { error: null, user: data.user }; // 업데이트된 user 정보 반환
    } catch (error: any) {
      console.error('Error updating user metadata:', error);
      toast({ title: '오류', description: error.message || '사용자 정보 업데이트 중 오류가 발생했습니다.', variant: 'destructive' });
      return { error, user: null };
    }
  };

  const triggerNotificationRefresh = useCallback(() => {
    console.log('[AuthContext] Triggering notification refresh...');
    setRefreshCounter(prev => prev + 1);
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
     if (!user) return;
    console.log(`[AuthContext] Marking notification ${notificationId} as read.`);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error("Error marking notification as read in DB:", error);
        toast({ title: "오류", description: "알림 상태 업데이트 실패", variant: "destructive" });
      } else {
        console.log(`[AuthContext] Successfully marked notification ${notificationId} as read in DB.`);
        triggerNotificationRefresh();
      }
    } catch (error) {
      console.error("Exception marking notification as read:", error);
      toast({ title: "오류", description: "알림 상태 업데이트 중 예외 발생", variant: "destructive" });
    }
  }, [user, toast, triggerNotificationRefresh]);


  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    userRole,
    userCenter,
    centerName, // centerName 추가
    setUserRole,
    refreshUserRole,
    refreshCounter,
    updateUserMetadata,
    triggerNotificationRefresh,
    markNotificationAsRead,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내에서 사용되어야 합니다');
  }
  return context;
}
