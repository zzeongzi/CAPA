import { Moon, Sun, Laptop } from "lucide-react"; // Laptop 아이콘 추가
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
  // theme: 현재 테마 상태 ('light', 'dark', 'system')
  // setTheme: 테마 변경 함수
  // resolvedTheme: 'system'일 경우 실제 적용되는 테마 ('light' 또는 'dark')
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 컴포넌트 마운트 후 상태 설정 (Hydration 오류 방지)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 순환 토글 함수
  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else { // theme === "system" 또는 초기 상태
      setTheme("light");
    }
  };

  // 마운트 전에는 UI 렌더링 방지 (Hydration 오류 방지)
  if (!mounted) {
    // 빈 버튼 또는 스켈레톤 등으로 대체 가능
    return <Button variant="outline" size="icon" disabled aria-label="Toggle theme" className="w-9 h-9" />;
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {/* 현재 테마에 따라 아이콘 변경 */}
      {theme === "light" && (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      {theme === "dark" && (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      {theme === "system" && (
        <Laptop className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
