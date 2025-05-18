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
import { useWorkoutStore } from "@/store/workoutStore";
import { initializePushNotifications } from "@/lib/pushNotifications";
import { App as CapacitorApp } from '@capacitor/app'; // Capacitor App 플러그인 import
import type { URLOpenListenerEvent } from '@capacitor/app'; // 타입 import

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // 창 포커스 시 자동 refetch 비활성화
    },
  },
});

// 리디렉션 로직 등 App 전체 레벨에서 필요한 로직 처리
const AppContent = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, userCenter } = useAuth(); // user와 loading (authLoading 별칭) 추가
  const { fetchExercises, fetchMembers } = useWorkoutStore();

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
  }, [navigate]);

  // 푸시 알림 초기화
  useEffect(() => {
    initializePushNotifications();
  }, []);

  // Capacitor App 플러그인을 사용하여 앱 URL 열기 이벤트 처리 (딥링크/푸시 알림 클릭)
  useEffect(() => {
    let appUrlOpenListenerHandle: import('@capacitor/core').PluginListenerHandle | null = null;
    let appStateChangeListenerHandle: import('@capacitor/core').PluginListenerHandle | null = null;

    const setupListeners = async () => {
      console.log('[AppContent] Setting up Capacitor App listeners...');
      
      // appUrlOpen 리스너 (앱이 이미 실행 중일 때 URL로 열리는 경우)
      appUrlOpenListenerHandle = await CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        alert(`[AppContent] appUrlOpen event: ${event.url}`); // 단순 alert로 변경
        console.log('[AppContent] appUrlOpen CALLBACK TRIGGERED. Event URL:', event.url);
        // try {
        //   const url = new URL(event.url);
        //   const path = url.pathname + url.search;
        //   console.log('[AppContent] Parsed path from appUrlOpen:', path);
        //   if (path) {
        //     navigate(path);
        //     console.log('[AppContent] Navigation called with path from appUrlOpen:', path);
        //   } else {
        //     console.warn('[AppContent] No path could be parsed from appUrlOpen event. URL:', event.url);
        //   }
        // } catch (e) {
        //   console.error('[AppContent] Error in appUrlOpen listener:', e, 'Original URL:', event.url);
        // }
      });
      console.log('[AppContent] appUrlOpen listener added.');

      // 초기 실행 URL 처리 (앱이 URL로 시작된 경우)
      const initialUrl = await CapacitorApp.getLaunchUrl();
      if (initialUrl && initialUrl.url) {
        alert(`[AppContent] Launch URL: ${initialUrl.url}`); // 단순 alert로 변경
        console.log('[AppContent] Launch URL detected:', initialUrl.url);
        // try {
        //   const url = new URL(initialUrl.url);
        //   const path = url.pathname + url.search;
        //   if (path) {
        //     console.log('[AppContent] Path from launch URL:', path, '- Navigation will be handled by router or subsequent appUrlOpen if app was cold started by URL.');
        //   }
        // } catch (e) {
        //   console.error('[AppContent] Error parsing launch URL:', e, 'Original URL:', initialUrl.url);
        // }
      } else {
        console.log('[AppContent] No launch URL detected.');
      }

      // 앱 상태 변경 리스너 (예: 백그라운드 -> 포그라운드)
      appStateChangeListenerHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        console.log('[AppContent] App state changed. Is active:', isActive);
        if (isActive) {
          // 앱이 포그라운드로 돌아왔을 때 필요한 작업 (예: 데이터 새로고침, 세션 확인 등)
          // console.log('[AppContent] App resumed. Consider refreshing data or re-checking auth.');
        }
      });
      console.log('[AppContent] appStateChange listener added.');
    };

    setupListeners();

    return () => {
      if (appUrlOpenListenerHandle) {
        console.log('[AppContent] Removing appUrlOpen listener.');
        appUrlOpenListenerHandle.remove();
      }
      if (appStateChangeListenerHandle) {
        console.log('[AppContent] Removing appStateChange listener.');
        appStateChangeListenerHandle.remove();
      }
    };
  }, [navigate, authLoading]); // authLoading을 의존성 배열에 추가

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
