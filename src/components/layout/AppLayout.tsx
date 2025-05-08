import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
  // title?: string; // title prop 제거
}

export function AppLayout({ children }: AppLayoutProps) { // title prop 받기 제거
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0"> {/* min-w-0 추가 */}
          <AppHeader /> {/* pageTitle prop 전달 제거 */}
          <main className="flex-1 p-4 md:p-6 w-full"> {/* mx-auto 제거 */}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
