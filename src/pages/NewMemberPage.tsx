import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // useNavigate 추가
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNewMember } from '@/contexts/NewMemberContext'; // useNewMember 추가
// import { supabase } from '@/integrations/supabase/client'; // Supabase 클라이언트 제거
// import { useAuth } from '@/contexts/AuthContext'; // useAuth 제거 (여기서는 불필요)

export function NewMemberPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태는 유지 (UI 피드백용)
  const { toast } = useToast();
  const { setMemberData } = useNewMember(); // Context setter 가져오기
  const navigate = useNavigate(); // navigate 훅 사용

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => { // async 제거
    event.preventDefault();
    setIsLoading(true); // 간단한 UI 피드백용

    // 기본 유효성 검사
    if (!name || !email || !password || !confirmPassword) {
      toast({ title: '오류', description: '모든 필드를 입력해주세요.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: '오류', description: '비밀번호가 일치하지 않습니다.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    // userCenter 검사 제거

    // Context에 데이터 저장
    setMemberData(prev => ({
      ...prev,
      name,
      email,
      password, // 비밀번호도 Context에 임시 저장 (최종 단계에서 사용)
    }));

    // 다음 단계로 이동
    navigate('/members/new/profile');

    // Supabase 관련 로직 제거
    // try...catch...finally 블록 제거

    // 로딩 상태는 페이지 이동 후 자동으로 해제되므로 별도 처리 불필요하거나,
    // 짧은 시간 후 해제하도록 setTimeout 사용 가능 (선택적)
    // setIsLoading(false); // 페이지 이동하므로 굳이 필요 없을 수 있음
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>새 회원 등록</CardTitle>
            <CardDescription>새로운 회원의 정보를 입력해주세요.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input 
                  id="name" 
                  placeholder="홍길동" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="member@example.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              {/* 버튼 텍스트 변경 */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '처리 중...' : '다음 (추가 정보 입력)'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}

export default NewMemberPage;