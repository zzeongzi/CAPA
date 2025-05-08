import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, userRole, userCenter } = useAuth();
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
  
  // 3. Role & Center Check (After loading is false and user exists)
  if (userRole && userCenter) {
    // User has both role and center
    if (location.pathname === '/role-selection' || location.pathname === '/center-selection') {
        console.log('[ProtectedRoute] Decision: User has role/center, redirecting from selection page to /dashboard');
        return <Navigate to="/dashboard" replace />;
    }
    console.log('[ProtectedRoute] Decision: User has role/center, rendering children');
    return <>{children}</>; // Render the intended protected route
  } else if (!userRole) {
    // User has no role
    if (location.pathname !== '/role-selection') {
      console.log('[ProtectedRoute] Decision: No role, redirecting to /role-selection');
      return <Navigate to="/role-selection" replace />;
    }
    console.log('[ProtectedRoute] Decision: No role, already on /role-selection, rendering children');
    return <>{children}</>; // Allow rendering RoleSelection page itself
  } else { // userRole exists, but userCenter is null
    // User has role but no center
    if (location.pathname !== '/center-selection' && location.pathname !== '/role-selection') {
      console.log('[ProtectedRoute] Decision: No center, redirecting to /center-selection');
      return <Navigate to="/center-selection" replace />;
    }
    console.log('[ProtectedRoute] Decision: No center, already on selection page, rendering children');
    return <>{children}</>; // Allow rendering CenterSelection/RoleSelection page
  }
};
