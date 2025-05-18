import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types"; // Database 타입 import
import { useToast } from "@/components/ui/use-toast"; // useToast import

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: Database["public"]["Enums"]["user_role"]; // 역할 제한을 위한 prop 추가
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, userRole, userCenter } = useAuth();
  const { toast } = useToast(); // toast 사용
  const location = useLocation();
  
  // 로딩 중이면 로드 표시
  // Add detailed logging
  console.log('[ProtectedRoute] Rendering:', { loading, userId: user?.id, userRole, userCenter, pathname: location.pathname });

  if (loading) {
    console.log('[ProtectedRoute] Decision: Loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // 인증되지 않았으면 로그인 페이지로 리디렉션
  if (!user) {
    console.log('[ProtectedRoute] Decision: No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // 3. Developer Role Check (After loading is false and user exists)
  if (userRole === 'developer') {
    // 개발자는 역할/센터 선택 페이지에 있으면 안 됨. 개발자 페이지나 대시보드로 보냄.
    if (location.pathname === '/role-selection' || location.pathname === '/center-selection') {
      console.log('[ProtectedRoute] Decision: Developer on selection page, redirecting to /admin/feedbacks');
      return <Navigate to="/admin/feedbacks" replace />; // 개발자용 기본 페이지로 리디렉션
    }
    // 특정 페이지 접근 시 역할 확인 (예: /admin/feedbacks는 developer만)
    if (requiredRole && userRole !== requiredRole) {
      console.log(`[ProtectedRoute] Decision: Developer role mismatch for protected route (required: ${requiredRole}, user: ${userRole}), redirecting to /admin/feedbacks`);
      toast({ title: "접근 권한 없음", description: "이 페이지에 접근할 수 있는 개발자 권한이 아닙니다.", variant: "destructive" });
      return <Navigate to="/admin/feedbacks" replace />;
    }
    console.log('[ProtectedRoute] Decision: Developer role, rendering children');
    return <>{children}</>; // 개발자 역할이면 센터 정보 없어도 통과
  }
  
  // 4. Non-Developer Role & Center Check
  if (userRole && userCenter) {
    // User has both role and center (and is not a developer)
    if (location.pathname === '/role-selection' || location.pathname === '/center-selection') {
        console.log('[ProtectedRoute] Decision: Non-developer has role/center, redirecting from selection page to /dashboard');
        return <Navigate to="/dashboard" replace />;
    }
    // 역할 기반 접근 제어 (개발자가 아닌 사용자에 대해)
    if (requiredRole && userRole !== requiredRole) {
      console.log(`[ProtectedRoute] Decision: Role mismatch (required: ${requiredRole}, user: ${userRole}), redirecting to /dashboard`);
      toast({ title: "접근 권한 없음", description: `이 페이지에 접근하려면 '${requiredRole}' 역할이 필요합니다.`, variant: "destructive" });
      return <Navigate to="/dashboard" replace />;
    }
    console.log('[ProtectedRoute] Decision: Non-developer has role/center and required role (if any), rendering children');
    return <>{children}</>;
  } else if (!userRole) {
    // User has no role (and is not a developer, as that case is handled above)
    if (location.pathname !== '/role-selection') {
      console.log('[ProtectedRoute] Decision: No role, redirecting to /role-selection');
      return <Navigate to="/role-selection" replace />;
    }
    console.log('[ProtectedRoute] Decision: No role, already on /role-selection, rendering children');
    return <>{children}</>;
  } else { // userRole exists (but not 'developer'), and userCenter is null
    // User has role but no center (and is not a developer)
    if (location.pathname !== '/center-selection' && location.pathname !== '/role-selection') {
      console.log(`[ProtectedRoute] Decision: Role ${userRole} but no center, redirecting to /center-selection`);
      return <Navigate to="/center-selection" replace />;
    }
    console.log(`[ProtectedRoute] Decision: Role ${userRole}, no center but already on selection page, rendering children`);
    return <>{children}</>;
  }
};
