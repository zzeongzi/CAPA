import { useState, ChangeEvent, FormEvent, useRef, useEffect } from 'react'; // useEffect 추가
import { useNavigate } from 'react-router-dom';
import { useNewMember } from '@/contexts/NewMemberContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { supabase } from '@/integrations/supabase/client'; // Storage 사용 안 함
import { useToast } from '@/components/ui/use-toast'; // 토스트 메시지 사용
import { useLocation } from 'react-router-dom'; // useLocation 추가

const NewMemberProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation(); // location 추가
  const { memberData, setMemberData } = useNewMember();
  const { toast } = useToast(); // toast는 유지 (필요시)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // 초기값 null
  // const [isUploading, setIsUploading] = useState(false); // 업로드 상태 제거
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localData, setLocalData] = useState({
    phoneNumber: memberData.phoneNumber || '',
    birthDate: memberData.birthDate || '',
    gender: memberData.gender || '',
    avatarFile: memberData.avatarFile || null, // 파일은 유지
  });

  // 컴포넌트 마운트 시 Context의 파일로 미리보기 설정
  useEffect(() => {
    if (memberData.avatarFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(memberData.avatarFile);
    }
  }, [memberData.avatarFile]);


  // 입력값 포맷팅 함수
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, ''); // 숫자만 추출
    const match = cleaned.match(/^(\d{3})(\d{3,4})(\d{4})$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return value; // 형식 안 맞으면 그대로 반환
  };

  const formatBirthDate = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  };


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;

    // 입력 필드에 따라 포맷팅 적용
    if (name === 'phoneNumber') {
      // 숫자만 남기고 최대 11자리까지만 허용
      const cleaned = value.replace(/\D/g, '').slice(0, 11);
      value = formatPhoneNumber(cleaned); // 포맷팅된 값으로 업데이트
    } else if (name === 'birthDate') {
       // 숫자만 남기고 최대 8자리까지만 허용
      const cleaned = value.replace(/\D/g, '').slice(0, 8);
      value = formatBirthDate(cleaned); // 포맷팅된 값으로 업데이트
    }

    setLocalData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenderChange = (value: string) => {
    setLocalData(prev => ({ ...prev, gender: value as 'male' | 'female' | 'other' }));
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLocalData(prev => ({ ...prev, avatarFile: file }));
      // 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 이미지 업로드 함수 제거
  /*
  const uploadAvatar = async (file: File): Promise<string | null> => { ... }
  */


  // handleSubmit 수정 (async 제거, 업로드 로직 제거)
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // 생년월일 유효성 검사
    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (localData.birthDate) { // 생년월일이 입력된 경우에만 검사
      if (!birthDateRegex.test(localData.birthDate)) {
        toast({
          title: "입력 오류",
          description: "생년월일을 YYYY-MM-DD 형식으로 올바르게 입력해주세요.",
          variant: "destructive",
        });
        return; // 형식 오류 시 중단
      }

      // 월, 일 범위 검사
      const parts = localData.birthDate.split('-');
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        toast({
          title: "입력 오류",
          description: "생년월일의 월(01-12) 또는 일(01-31) 범위가 올바르지 않습니다.",
          variant: "destructive",
        });
        return; // 범위 오류 시 중단
      }
      // 참고: 각 월별 실제 일수(예: 2월 30일) 검사는 추가하지 않음 (요구사항 기준)
    }

    // Context 업데이트
    setMemberData(prev => ({
      ...prev,
      phoneNumber: localData.phoneNumber,
      birthDate: localData.birthDate,
      gender: localData.gender as 'male' | 'female' | 'other' | undefined,
      avatarFile: localData.avatarFile,
      avatarUrl: avatarPreview, // 미리보기 URL(Data URL)을 avatarUrl로 저장
    }));

    // 현재 경로에 따라 다음 단계 결정
    const nextPath = location.pathname === '/signup/profile' ? '/signup/role' : '/members/new/role';
    navigate(nextPath);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>추가 프로필 정보</CardTitle>
          <CardDescription>회원의 추가 정보를 입력해 주세요.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={avatarPreview || undefined} alt="Avatar Preview" />
                <AvatarFallback>{memberData.name?.substring(0, 1).toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <Input
                ref={fileInputRef}
                id="avatar"
                name="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              {/* 업로드 상태 관련 로직 제거 */}
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                이미지 변경
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="phoneNumber">휴대폰 번호</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel" // type="tel" 유지 (모바일 키패드)
                placeholder="010-1234-5678"
                value={localData.phoneNumber}
                onChange={handleInputChange}
                maxLength={13} // 하이픈 포함 최대 길이
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="birthDate">생년월일</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="text" // type="date" 대신 "text" 사용 (자동 포맷팅 위해)
                placeholder="YYYY-MM-DD"
                value={localData.birthDate}
                onChange={handleInputChange}
                maxLength={10} // 하이픈 포함 최대 길이
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gender">성별</Label>
              <Select onValueChange={handleGenderChange} value={localData.gender}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="성별 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
             {/* 업로드 상태 관련 로직 제거 */}
            <Button type="submit" className="w-full">
              다음 (역할 선택)
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default NewMemberProfilePage;