
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
// import { supabase } from "@/integrations/supabase/client"; // 여기서는 직접 사용 안 함

// Props 타입 정의
interface RoleSelectionProps {
  isNewMemberFlow?: boolean; // 새 회원 등록 흐름 여부
  onRoleSelect?: (role: "trainer" | "member") => void; // 역할 선택 시 콜백 (새 회원 등록 흐름용)
}

export function RoleSelection({ isNewMemberFlow, onRoleSelect }: RoleSelectionProps) {
  const [selectedRole, setSelectedRole] = useState<"trainer" | "member" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setUserRole, user } = useAuth(); // AuthContext는 여전히 필요 (기존 흐름)

  const handleContinue = async () => {
    if (!selectedRole) {
      toast({
        title: "역할을 선택해주세요",
        description: "계속하려면 역할을 선택해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    // Context를 사용하는 흐름 처리 (관리자 신규 등록 또는 일반 회원가입)
    if (onRoleSelect) {
      // isNewMemberFlow 체크 제거, onRoleSelect 유무로 판단
      onRoleSelect(selectedRole);
      return; // 콜백 호출 후 함수 종료
    }

    // --- 기존 로그인 후 초기 설정 흐름 (onRoleSelect가 없을 때) ---
    if (!user) {
      toast({
        title: "인증 오류",
        description: "먼저 로그인해주세요.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsLoading(true);
    
    try {
      // 역할 설정 로직: AuthContext의 setUserRole 함수를 사용합니다.
      // 이렇게 하면 DB 작업은 AuthContext에서 처리하게 됩니다.
      await setUserRole(selectedRole);
      
      // 역할 설정 성공 시 다음 페이지로 이동
      navigate("/center-selection");
    } catch (error) {
      console.error("역할 설정 오류:", error);
      
      // 오류 발생 시 사용자에게 알림
      toast({
        title: "오류 발생",
        description: "역할을 설정하는 중 문제가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">역할 선택</h1>
        <p className="text-muted-foreground mt-2">
          <span className="bg-clip-text text-transparent bg-premium-gradient font-bold">FitFluent</span>에서 어떤 역할로 활동하실 건가요?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedRole === "trainer" ? "ring-4 ring-primary/70 scale-[1.02] shadow-lg" : ""
          }`}
          onClick={() => setSelectedRole("trainer")}
        >
          <CardHeader>
            <div className={`p-3 rounded-full mb-3 w-fit ${
              selectedRole === "trainer" ? "bg-primary text-white" : "bg-primary/10"
            }`}>
              <Dumbbell className={`h-6 w-6 ${
                selectedRole === "trainer" ? "text-white" : "text-primary"
              }`} />
            </div>
            <CardTitle>트레이너</CardTitle>
            <CardDescription>회원을 관리하고 PT를 제공합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>회원 관리</li>
              <li>운동 프로그램 작성</li>
              <li>PT 일정 관리</li>
              <li>체성분 분석</li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedRole === "member" ? "ring-4 ring-primary/70 scale-[1.02] shadow-lg" : ""
          }`}
          onClick={() => setSelectedRole("member")}
        >
          <CardHeader>
            <div className={`p-3 rounded-full mb-3 w-fit ${
              selectedRole === "member" ? "bg-primary text-white" : "bg-primary/10"
            }`}>
              <Users className={`h-6 w-6 ${
                selectedRole === "member" ? "text-white" : "text-primary"
              }`} />
            </div>
            <CardTitle>회원</CardTitle>
            <CardDescription>나의 트레이너와 소통하고 운동 기록을 관리합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>PT 예약 관리</li>
              <li>운동 기록 확인</li>
              <li>트레이너와 채팅</li>
              <li>체성분 측정 기록</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleContinue}
          className="w-full max-w-md bg-premium-gradient hover:opacity-90"
          disabled={isLoading || !selectedRole}
        >
          {/* 버튼 텍스트 조건부 변경 */}
          {isLoading ? "처리 중..." : (isNewMemberFlow ? "다음 (센터 선택)" : "계속")}
        </Button>
      </div>
    </div>
  );
}
