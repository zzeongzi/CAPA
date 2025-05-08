
import { useLocation, useNavigate } from 'react-router-dom'; // useLocation, useNavigate 추가
import { RoleSelection } from "@/components/auth/RoleSelection";
import { useNewMember } from '@/contexts/NewMemberContext'; // useNewMember 추가

const RoleSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setMemberData } = useNewMember(); // Context setter 가져오기

  // 현재 경로가 어떤 흐름인지 확인
  const isAdminNewMemberFlow = location.pathname === '/members/new/role';
  const isSignupFlow = location.pathname === '/signup/role';

  // 역할 선택 시 처리 함수 (Context 사용 흐름 공통)
  const handleRoleSelectWithContext = (role: 'member' | 'trainer') => {
    setMemberData(prev => ({ ...prev, role }));
    // 다음 경로 결정
    const nextPath = isSignupFlow ? '/signup/center' : '/members/new/center';
    navigate(nextPath);
  };

  // RoleSelection 컴포넌트에 전달할 콜백 결정
  const onRoleSelectCallback = isAdminNewMemberFlow || isSignupFlow ? handleRoleSelectWithContext : undefined;

  return ( // return 문 추가
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fitness-light to-white p-4">
      <div className="w-full max-w-3xl">
        {/* isNewMemberFlow 대신 isSignupFlow 또는 isAdminNewMemberFlow 전달 가능 (필요시 RoleSelection 수정) */}
        {/* 여기서는 onRoleSelectCallback 유무로 RoleSelection 내부에서 분기 처리한다고 가정 */}
        <RoleSelection
          onRoleSelect={onRoleSelectCallback}
          // isNewMemberFlow={isAdminNewMemberFlow || isSignupFlow} // 필요하다면 전달
        />
      </div>
    </div>
  );
};

export default RoleSelectionPage;
