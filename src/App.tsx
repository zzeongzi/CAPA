import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useNavigate } from "react-router-dom"; // Routes, Route 제거
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NewMemberProvider } from "@/contexts/NewMemberContext"; // NewMemberProvider 임포트 추가
// ProtectedRoute, Index, Login 등 페이지 컴포넌트 임포트 제거 (AppRoutes에서 관리)
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect } from "react";
import AppRoutes from "./AppRoutes";
import { useWorkoutStore } from "@/store/workoutStore"; // Zustand 스토어 import 추가

// Create a client
const queryClient = new QueryClient();

// 리디렉션 로직 등 App 전체 레벨에서 필요한 로직 처리
const AppContent = () => {
  const navigate = useNavigate();
  const { userCenter } = useAuth(); // userRole 제거 (여기서는 불필요)
  const { fetchExercises, fetchMembers } = useWorkoutStore(); // 스토어 액션 가져오기

  // 앱 로드 시 운동 목록 가져오기
  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // 센터 ID 변경 시 회원 목록 가져오기
  useEffect(() => {
    if (userCenter) {
      fetchMembers(userCenter);
    }
  }, [userCenter, fetchMembers]);


  useEffect(() => {
    // 세션 스토리지에서 대시보드 리디렉션 플래그 확인
    const shouldRedirect = sessionStorage.getItem('redirectToDashboard');

    if (shouldRedirect === 'true') {
      // 리디렉션 후 플래그 제거
      sessionStorage.removeItem('redirectToDashboard');

      // 대시보드로 이동
      navigate('/dashboard', { replace: true });
    }
    // 필요하다면 userCenter, userRole 변경 감지 로직 추가 가능
  }, [navigate]); // userCenter, userRole 종속성 추가 가능

  return (
    <>
      {/* Routes 대신 AppRoutes 컴포넌트 사용 */}
      <AppRoutes />
      <Toaster />
      <Sonner />
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NewMemberProvider> {/* NewMemberProvider 추가 */}
              <TooltipProvider>
                <AppContent />
              </TooltipProvider>
            </NewMemberProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
export default App;
