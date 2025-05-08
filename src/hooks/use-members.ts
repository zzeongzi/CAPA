import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

// Member 인터페이스 수정: memberPk 추가
export interface Member {
  id: string; // auth.users.id
  memberPk: string; // members 테이블의 PK (id)
  name: string;
  email: string;
  phone: string | null;
  memberSince: string;
  lastSession?: string | null;
  nextSession?: string | null;
  status: 'active' | 'inactive' | 'pending';
  remainingSessions: number;
  totalSessions: number;
  plan: string;
  avatarUrl?: string | null;
  initials: string;
}

// profiles 테이블 데이터 타입
type ProfileData = {
  id: string; // auth.users.id
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

// members 테이블 데이터 타입 (user_id 포함)
type MemberTableData = {
  id: string; // members 테이블의 PK
  user_id: string; // auth.users.id 참조
  phone_number: string | null;
  email: string | null; // email은 여전히 필요할 수 있음 (fallback 등)
};

// memberships 테이블 데이터 타입 (member_id는 auth.users.id 참조)
type MembershipData = {
  member_id: string;
  remaining_sessions: number;
  total_sessions: number;
  plan: string;
};

// View for latest workout sessions data
type LatestWorkoutSessionViewData = {
  member_id: string; // members table id
  session_date: string;
};


export const useMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, userRole, userCenter } = useAuth();
  const { toast } = useToast();

  const fetchMembers = useCallback(async () => {
    if (!user || userRole !== 'trainer' || !userCenter) {
      console.log('[useMembers] Not a trainer or no center ID, clearing members.');
      setMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log(`[useMembers] Fetching members for center: ${userCenter}`);
    try {
      // 1. 현재 센터에 속한 members 정보 직접 가져오기 (트레이너 자신 제외)
      const { data: membersTableData, error: membersTableError } = await supabase
        .from('members')
        .select('id, user_id, email, phone_number') // 필요한 컬럼 선택
        .eq('center_id', userCenter) // 현재 트레이너의 센터 ID와 일치하는 멤버
        .neq('user_id', user.id); // 트레이너 자신 제외

      if (membersTableError) throw membersTableError;
      if (!membersTableData || membersTableData.length === 0) {
        console.log('[useMembers] No members found in this center (from members table).');
        setMembers([]);
        setIsLoading(false);
        return;
      }
      console.log('[useMembers] Fetched members table data:', membersTableData);

      // members 테이블 결과에서 user_id 목록 생성
      const userIds = membersTableData.map(m => m.user_id);
      console.log(`[useMembers] Found user IDs from members table: ${userIds.join(', ')}`);

      // 2. 해당 사용자들의 프로필 정보 가져오기 (userIds 사용)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, created_at')
        .in('id', userIds) // userIds는 auth.users.id 목록이므로 profiles.id와 일치
        .returns<ProfileData[]>();

      if (profilesError) throw profilesError;
      if (!profilesData) throw new Error('Failed to fetch profile data.');
      console.log('[useMembers] Fetched profiles:', profilesData);

      // 3. members.id 매핑 및 추가 정보 매핑 (이미 membersTableData 있음)
      // user_id를 키로 members.id 매핑
      const userIdToMemberIdMap = membersTableData?.reduce((acc, member) => {
        if (member.user_id) {
          acc[member.user_id] = member.id;
        }
        return acc;
      }, {} as { [key: string]: string });
      console.log('[useMembers] userIdToMemberIdMap:', userIdToMemberIdMap);

      // user_id를 키로 email, phone_number 매핑
      const userInfoMap = membersTableData?.reduce((acc, member) => {
         if (member.user_id) {
             acc[member.user_id] = { email: member.email, phone: member.phone_number };
         }
         return acc;
      }, {} as { [key: string]: { email: string | null; phone: string | null } });
      console.log('[useMembers] userInfoMap (keyed by user_id):', userInfoMap);


      const memberTableIds = membersTableData?.map(m => m.id) || [];

      // 4. 해당 members.id를 가진 마지막 workout_sessions 날짜 가져오기
      let lastWorkoutSessionMapByMemberId: { [key: string]: string } = {};
      if (memberTableIds.length > 0) {
          const { data: latestWorkoutSessionsData, error: latestWorkoutSessionsError } = await supabase
            .from('latest_workout_sessions_view') // Query the new view
            .select('member_id, session_date')
            .in('member_id', memberTableIds)
            .returns<LatestWorkoutSessionViewData[]>(); // Use the new type

         if (latestWorkoutSessionsError) {
           console.warn('Latest workout sessions 데이터 로드 오류 (무시 가능):', latestWorkoutSessionsError);
         } else if (latestWorkoutSessionsData) {
           console.log('[useMembers] Fetched latest workout sessions:', latestWorkoutSessionsData);
           // The view already provides the latest session, so just map it
           lastWorkoutSessionMapByMemberId = latestWorkoutSessionsData.reduce((acc, session) => {
             acc[session.member_id] = session.session_date;
             return acc;
           }, {} as { [key: string]: string });
         }
     }
     console.log('[useMembers] Last workout session map (keyed by members.id):', lastWorkoutSessionMapByMemberId);

      // 5. 해당 사용자들의 회원권 정보 가져오기 (member_id는 auth.users.id)
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('memberships')
        .select('member_id, remaining_sessions, total_sessions, plan')
        .in('member_id', userIds)
        .order('created_at', { ascending: false }); // 최신 멤버십이 먼저 오도록 정렬

      if (membershipsError) {
        console.warn('회원권 데이터 로드 오류 (무시 가능):', membershipsError);
      }
      console.log('[useMembers] Fetched memberships:', membershipsData);

      const aggregatedMembershipsMap = membershipsData?.reduce((acc, membership) => {
        const userId = membership.member_id;
        if (!acc[userId]) {
          acc[userId] = {
            remaining_sessions: 0,
            total_sessions: 0,
            plan: membership.plan,
          };
        }
        acc[userId].remaining_sessions += membership.remaining_sessions || 0;
        acc[userId].total_sessions += membership.total_sessions || 0;
        return acc;
      }, {} as { [key: string]: { remaining_sessions: number; total_sessions: number; plan: string; } });
      
      console.log('[useMembers] Aggregated memberships map:', aggregatedMembershipsMap);

      // 6. 데이터 최종 매핑
      const mappedMembers = profilesData.map(profile => {
        const memberId = userIdToMemberIdMap?.[profile.id];
        const lastSession = memberId ? lastWorkoutSessionMapByMemberId?.[memberId] : null;
        const aggregatedMembershipInfo = aggregatedMembershipsMap?.[profile.id];
        const memberSpecificInfo = userInfoMap?.[profile.id];

        let status: 'active' | 'inactive' | 'pending' = 'active';
        if (aggregatedMembershipInfo && aggregatedMembershipInfo.remaining_sessions === 0) {
          status = 'inactive';
        }

        const firstName = profile.first_name || '';
        const lastName = profile.last_name || '';
        const name = `${firstName} ${lastName}`.trim() || memberSpecificInfo?.email || '이름 없음'; // 이름 없으면 이메일 사용
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || name.charAt(0).toUpperCase() || '?';

        return {
          id: profile.id, // auth.users.id
          memberPk: memberId || '', // members 테이블의 PK (id) 할당, 없으면 빈 문자열
          name: name,
          email: memberSpecificInfo?.email || '', // members 테이블에서 가져온 email
          phone: memberSpecificInfo?.phone || null, // members 테이블에서 가져온 phone
          memberSince: profile.created_at,
          lastSession: lastSession,
          nextSession: null,
          status,
          remainingSessions: aggregatedMembershipInfo?.remaining_sessions ?? 0,
          totalSessions: aggregatedMembershipInfo?.total_sessions ?? 0,
          plan: aggregatedMembershipInfo?.plan ?? 'N/A',
          avatarUrl: profile.avatar_url,
          initials: initials,
        };
      });

      // 상태 계산 확인 로그 추가
      mappedMembers.forEach(m => console.log(`[useMembers] Member: ${m.name}, Remaining: ${m.remainingSessions}, Status: ${m.status}`));

      console.log('[useMembers] Final mapped members:', JSON.stringify(mappedMembers, null, 2));
      setMembers(mappedMembers);

    } catch (error) {
      console.error('회원 데이터 로드 중 전체 오류:', error);
      toast({
        title: '데이터 로드 오류',
        description: '회원 정보를 불러오는 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
      setMembers([]);
    } finally {
      setIsLoading(false);
      console.log('[useMembers] Fetching finished.');
    }
  }, [user, userRole, userCenter, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const removeMemberLocally = (memberId: string) => {
    setMembers(prevMembers => prevMembers.filter(m => m.id !== memberId));
  };

  return {
    members,
    isLoading,
    refetchMembers: fetchMembers,
    removeMemberLocally,
  };
};
