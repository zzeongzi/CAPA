import { Link, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar"; // useSidebar 추가
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Users,
  MessageSquare,
  Calendar,
  Dumbbell,
  User,
  History,
  Scale,
  Cog,
  ClipboardList,
  TrendingUp, // 시뮬레이터 아이콘 추가
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { userRole } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar(); // useSidebar 사용

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // 현재 활성화된 라우트 확인 (정확히 일치하는 경우만 활성화)
  const isActive = (path: string) => pathname === path;
  // 하위 경로 포함 활성화 여부 함수 (필요시 사용)
  // const isPrefixActive = (path: string) => pathname.startsWith(path);


  return (
    <Sidebar className="border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarContent className="pb-12">
        <div className="space-y-4 py-4">
          {/* 로고 부분: 좌우 가운데 정렬 */}
          <div className="px-4 py-4 flex justify-center mb-4">
            <Link to="/dashboard">
              <h2 className="text-lg font-semibold tracking-tight">
                Fit<span className="premium-text">Fluent</span>
              </h2>
            </Link>
          </div>
          {/* 메뉴 버튼 부분 */}
          <div className="px-4 space-y-1">
            <Link to="/dashboard">
              <Button
                variant={isActive("/dashboard") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <BarChart className="mr-2 h-4 w-4" />
                대시보드
              </Button>
            </Link>

            {/* 트레이너 역할에만 회원 관리 메뉴 표시 */}
            {userRole === "trainer" && (
              <Link to="/members">
                <Button
                  variant={isActive("/members") ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={handleLinkClick}
                >
                  <Users className="mr-2 h-4 w-4" />
                  회원 관리
                </Button>
              </Link>
            )}

            <Link to="/chat">
              <Button
                variant={isActive("/chat") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                메시지
              </Button>
            </Link>

            <Link to="/schedule">
              <Button
                variant={isActive("/schedule") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <Calendar className="mr-2 h-4 w-4" />
                일정 관리
              </Button>
            </Link>

            <Link to="/workout">
              <Button
                variant={isActive("/workout") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                운동 관리
              </Button>
            </Link>
            <Link to="/workout-history">
              <Button
                variant={isActive("/workout-history") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <History className="mr-2 h-4 w-4" />
                운동 기록 내역
              </Button>
            </Link>
            <Link to="/measurements">
              <Button
                // 측정 페이지는 하위 경로가 없으므로 exact match 사용
                variant={isActive("/measurements") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <Scale className="mr-2 h-4 w-4" />
                체성분 측정
              </Button>
            </Link>
            <Link to="/measurements/history">
              <Button
                variant={isActive("/measurements/history") ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={handleLinkClick}
              >
                <History className="mr-2 h-4 w-4" />
                체성분 기록 내역
              </Button>
            </Link>
          </div>

          {/* 보고서 섹션 추가 */}
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-sm font-medium tracking-tight">
              보고서
            </h2>
            <div className="space-y-1">
              <Link to="/reports/monthly">
                <Button
                  variant={isActive("/reports/monthly") ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={handleLinkClick}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  월별 보고서
                </Button>
              </Link>
              <Link to="/reports/simulator">
                <Button
                  variant={isActive("/reports/simulator") ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={handleLinkClick}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  매출 시뮬레이터
                </Button>
              </Link>
            </div>
          </div>


          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-sm font-medium tracking-tight">
              계정
            </h2>
            <div className="space-y-1">
              <Link to="/profile">
                <Button
                  variant={isActive("/profile") ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={handleLinkClick}
                >
                  <User className="mr-2 h-4 w-4" />
                  내 프로필
                </Button>
              </Link>
              {/* 설정 메뉴: 정확히 /settings일 때만 default, 하위 경로일 때는 ghost */}
              <Link to="/settings">
                <Button
                  variant={isActive("/settings") ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={handleLinkClick}
                >
                  <Cog className="mr-2 h-4 w-4" />
                  설정
                </Button>
              </Link>
              {/* 매출 설정 하위 메뉴: 정확히 /settings/revenue일 때만 secondary */}
              <Link to="/settings/revenue">
                 <Button
                   variant={isActive("/settings/revenue") ? "default" : "ghost"} // secondary -> default 로 변경
                   className="w-full justify-start pl-8"
                   onClick={handleLinkClick}
                 >
                   매출 설정
                 </Button>
               </Link>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
