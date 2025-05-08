import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNewMember } from "@/contexts/NewMemberContext"; // useNewMember 추가
import { toast } from "sonner";

export function AuthForm() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth(); // signUp은 최종 단계에서 사용
  const { setMemberData } = useNewMember(); // Context setter 추가
  const [isLoading, setIsLoading] = useState(false);
  
  // 로그인 폼 상태
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // 회원가입 폼 상태
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 리디렉션 로직을 useEffect로 이동
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast.error("모든 필드를 입력해주세요", {
        description: "이메일과 비밀번호를 입력해주세요."
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      
      if (!error) {
        navigate("/role-selection");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // handleSignup 함수 수정 (async 제거)
  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !signupEmail || !signupPassword || !confirmPassword) {
      toast.error("모든 필드를 입력해주세요", {
        description: "모든 필수 정보를 입력해주세요."
      });
      return;
    }
    
    if (signupPassword !== confirmPassword) {
      toast.error("비밀번호 불일치", {
        description: "비밀번호와 비밀번호 확인이 일치하지 않습니다."
      });
      return;
    }

    setIsLoading(true); // 간단한 UI 피드백

    // Context에 기본 정보 저장
    setMemberData(prev => ({
      ...prev,
      name,
      email: signupEmail,
      password: signupPassword, // 비밀번호 임시 저장
    }));

    // 추가 프로필 입력 페이지로 이동
    navigate("/signup/profile");

    // Supabase signUp 호출 로직 제거
    // try...finally 블록 제거

    // setIsLoading(false); // 페이지 이동하므로 불필요
  };

  return (
    <Card className="w-full max-w-md glass-card animate-fade-in">
      <CardHeader className="space-y-1 flex flex-col items-center">
        <div className="bg-primary/10 p-3 rounded-full mb-3">
          <Dumbbell className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">
          Fit<span className="premium-text">Fluent</span>
        </CardTitle>
        <CardDescription className="text-center">
          피트니스 전문가를 위한 프리미엄 관리 플랫폼
        </CardDescription>
      </CardHeader>
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">로그인</TabsTrigger>
          <TabsTrigger value="signup">회원가입</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">비밀번호</Label>
                  <a href="#" className="text-xs text-primary hover:underline">
                    비밀번호 찾기
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-premium-gradient hover:opacity-90" 
                disabled={isLoading}
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input 
                  id="name" 
                  placeholder="홍길동" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">이메일</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">비밀번호</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              {/* 버튼 텍스트 변경 */}
              <Button
                type="submit"
                className="w-full bg-premium-gradient hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? "처리 중..." : "다음 (추가 정보 입력)"}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
