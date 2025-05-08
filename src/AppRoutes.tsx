import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile"; // useIsMobile 훅 추가
import Login from "./pages/Login";
import RoleSelectionPage from "./pages/RoleSelectionPage";
import CenterSelectionPage from "./pages/CenterSelectionPage";
import { Dashboard } from "./pages/Dashboard";
import MembersPage from "./pages/MembersPage";
import MembersPageMobile from "./pages/MembersPageMobile";
import ChatPage from "./pages/ChatPage";
import SchedulePage from "./pages/SchedulePage";
import SchedulePageMobile from "./pages/SchedulePageMobile";
import WorkoutPage from "./pages/WorkoutPage";
import WorkoutPageMobile from "./pages/WorkoutPageMobile"; // WorkoutPageMobile 추가
import NotFound from "./pages/NotFound";
// import ProfilePage from "./pages/ProfilePage"; // 기존 페이지 주석 처리
import { ProfilePage2 } from "./pages/ProfilePage2"; // 명명된 가져오기로 변경
import SettingsPage from "./pages/SettingsPage";
import NewMemberPage from "./pages/NewMemberPage";
// import MembersListPage from "./pages/MembersListPage"; // 회원 목록 페이지 import - 제거 (사용하지 않음)
import NewMemberProfilePage from "./pages/NewMemberProfilePage"; // 새 회원 추가 프로필 페이지 추가
import WorkoutHistoryPage from "./pages/WorkoutHistoryPage"; // 운동 기록 내역 페이지 추가
import BodyCompositionPage from "./pages/BodyCompositionPage"; // 체성분 측정 페이지 추가
import { AppLayout } from "./components/layout/AppLayout";
import BodyCompositionHistoryPage from "./pages/BodyCompositionHistoryPage"; // 중복 가능성 있는 라인, 하나만 남김
import RevenueSettingsPage from "./pages/RevenueSettingsPage";
import MonthlyReportPage from "./pages/MonthlyReportPage";
import MonthlyReportPageMobile from "./pages/MonthlyReportPageMobile"; // 모바일 월별 보고서 페이지 import
import RevenueSimulatorPage from "./pages/RevenueSimulatorPage";
import BodyCompositionHistoryPageMobile from "./pages/BodyCompositionHistoryPageMobile"; // 추가

const AppRoutes = () => {
  const navigate = useNavigate();
  const { userCenter, userRole } = useAuth();
  const isMobile = useIsMobile(); // isMobile 상태 가져오기

  useEffect(() => {
    const shouldRedirect = sessionStorage.getItem('redirectToDashboard');

    if (shouldRedirect === 'true') {
      sessionStorage.removeItem('redirectToDashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />  {/* 기본 경로 */}
      <Route path="/login" element={<Login />} />

      {/* 기존 역할/센터 선택 (로그인 후 초기 설정용) */}
      <Route
        path="/role-selection"
        element={
          <ProtectedRoute>
            <RoleSelectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/center-selection"
        element={
          <ProtectedRoute>
            <CenterSelectionPage />
          </ProtectedRoute>
        }
      />

      {/* 일반 회원가입 단계별 라우트 (로그인 전) */}
      <Route path="/signup/profile" element={<NewMemberProfilePage />} />
      <Route path="/signup/role" element={<RoleSelectionPage />} />
      <Route path="/signup/center" element={<CenterSelectionPage />} />


      {/* 새 회원 등록 단계별 라우트 (로그인 후, 관리자/트레이너용) */}
      <Route
        path="/members/new" // 1단계: 기본 정보
        element={
          <ProtectedRoute> {/* 기존 사용자(관리자/트레이너)만 접근 가능 */}
            <NewMemberPage />
          </ProtectedRoute>
        }
      />
       <Route
        path="/members/new/profile" // 2단계: 추가 프로필
        element={
          <ProtectedRoute>
            <NewMemberProfilePage />
          </ProtectedRoute>
        }
      />
       <Route
        path="/members/new/role" // 3단계: 역할 선택
        element={
          <ProtectedRoute>
            {/* RoleSelectionPage에 isNewMemberFlow 같은 prop 전달 고려 */}
            <RoleSelectionPage />
          </ProtectedRoute>
        }
      />
       <Route
        path="/members/new/center" // 4단계: 센터 선택 및 완료
        element={
          <ProtectedRoute>
             {/* CenterSelectionPage에 isNewMemberFlow 같은 prop 전달 고려 */}
            <CenterSelectionPage />
          </ProtectedRoute>
        }
      />

      {/* 기타 보호된 라우트 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/members"
        element={
          <ProtectedRoute>
            {isMobile ? <MembersPageMobile /> : <MembersPage />}
          </ProtectedRoute>
        }
      />
      {/* 채팅 목록 페이지 라우트 추가 */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            {/* TODO: ChatListPage 컴포넌트로 교체 */}
            <ChatPage />
          </ProtectedRoute>
        }
      />
      {/* 개별 채팅 페이지 라우트 */}
      <Route
        path="/chat/:roomId" // memberId 대신 roomId 사용 고려
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            {isMobile ? <SchedulePageMobile /> : <SchedulePage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/workout"
        element={
          <ProtectedRoute>
            {isMobile ? <WorkoutPageMobile /> : <WorkoutPage />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/workout-history"
        element={
          <ProtectedRoute>
            <WorkoutHistoryPage />
          </ProtectedRoute>
        }
      />
      {/* 내 프로필 페이지 */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage2 /> {/* ProfilePage2로 변경 */}
          </ProtectedRoute>
        }
      />
      {/* 타인 프로필 페이지 (동적 라우트) */}
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <ProfilePage2 /> {/* ProfilePage2로 변경 */}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      {/* 매출 설정 페이지 라우트 추가 */}
      <Route
        path="/settings/revenue"
        element={
          <ProtectedRoute>
            <RevenueSettingsPage />
          </ProtectedRoute>
        }
      />
      {/* 월별 보고서 페이지 라우트 추가 */}
      <Route
        path="/reports/monthly"
        element={
          <ProtectedRoute>
            {isMobile ? <MonthlyReportPageMobile /> : <MonthlyReportPage />}
          </ProtectedRoute>
        }
      />
      {/* 매출 시뮬레이터 페이지 라우트 추가 */}
      <Route
        path="/reports/simulator"
        element={
          <ProtectedRoute>
            <RevenueSimulatorPage />
          </ProtectedRoute>
        }
      />
      {/* 회원 목록 페이지 라우트 제거 */}
      {/* 체성분 측정 페이지 */}
      <Route
        path="/measurements"
        element={
          <ProtectedRoute>
            <AppLayout> {/* AppLayout 적용 */}
              <BodyCompositionPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* 체성분 기록 내역 페이지 (임시) */}
      <Route
        path="/measurements/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              {isMobile ? <BodyCompositionHistoryPageMobile /> : <BodyCompositionHistoryPage />}
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;