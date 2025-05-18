import React, { useEffect, useState, useCallback, useRef } from 'react'; // useCallback, useRef 추가
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ModeToggle } from '@/components/layout/ModeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from "next-themes"; // useTheme 추가
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from "@/components/ui/badge"; // Badge 추가
import { Textarea } from '@/components/ui/textarea'; // Textarea 추가
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Select 관련 추가
import { Loader2, Edit, Save, X, Camera, Building, ChevronDown, ChevronUp, User, Sun, Moon } from 'lucide-react'; // Sun, Moon 아이콘 추가
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Collapsible 추가
import { UserMetadata } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';


// 프로필 데이터 타입 정의 (ProfilePage.tsx에서 가져옴)
interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null; // SettingsPage에서는 user.email을 직접 사용하므로 선택적
  avatar_url: string | null;
  bio?: string | null;
  created_at?: string;
  gender?: string | null;
  phone_number?: string | null;
  birth_date?: string | null; // yyyy-mm-dd 형식
  // center_name?: string | null; // AuthContext에서 직접 centerName을 사용하므로 ProfileData에서 제거 가능
}


export function SettingsPage() {
  const { user, loading: authLoading, updateUserMetadata, userRole, userCenter, centerName } = useAuth(); // centerName 추가
  const { theme, setTheme } = useTheme(); // theme, setTheme 가져오기
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState<boolean | null>(null);
  const [pushNotifications, setPushNotifications] = useState<boolean | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true); // 알림 설정 로딩 상태

  // 프로필 관련 상태 추가
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); // 프로필 로딩 상태
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false); // 프로필 업데이트 중 로딩 상태
  const [editedFirstName, setEditedFirstName] = useState('');
  const [editedLastName, setEditedLastName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [editedBirthDate, setEditedBirthDate] = useState('');
  const [editedGender, setEditedGender] = useState('');
  const [editedAvatarFile, setEditedAvatarFile] = useState<File | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false); // 상세 정보 토글 상태


  // 프로필 정보 로드 (ProfilePage.tsx의 fetchProfile 로직 일부 참조)
  const fetchProfileData = useCallback(async () => {
    if (!user || !user.id) {
      setIsLoadingProfile(false);
      return;
    }
    setIsLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, bio, gender, phone_number, birth_date, created_at')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileData({ ...data, id: user.id, email: user.email } as ProfileData);
        // 수정 상태 초기화
        setEditedFirstName(data.first_name || '');
        // setEditedLastName(data.last_name || ''); // "성" 필드 제거로 삭제
        setEditedBio(data.bio || '');
        setEditedPhoneNumber(data.phone_number || '');
        setEditedBirthDate(data.birth_date || '');
        setEditedGender(data.gender || 'none');
      } else {
         // 프로필이 없는 경우 기본값으로 초기화
        setProfileData({ id: user.id, email: user.email, first_name: '', last_name: null, avatar_url: null }); // last_name을 null로
        setEditedFirstName('');
        // setEditedLastName(''); // "성" 필드 제거로 삭제
        setEditedBio('');
        setEditedPhoneNumber('');
        setEditedBirthDate('');
        setEditedGender('none');
      }
    } catch (err: any) {
      toast({ title: "오류", description: "프로필 정보 로딩 실패: " + err.message, variant: "destructive" });
      setProfileData({ id: user.id, email: user.email, first_name: '', last_name: null, avatar_url: null }); // center_name 제거
    } finally {
      setIsLoadingProfile(false);
    }
  }, [user, userCenter, toast]); // useCallback 의존성 배열에 userCenter 추가

  // 알림 설정 로드
  useEffect(() => {
    if (user && user.id && !authLoading) {
      const fetchNotificationSettings = async () => {
        setIsLoadingSettings(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('allow_push_notifications, allow_email_notifications')
            .eq('id', user.id)
            .single();
          if (error && error.code !== 'PGRST116') throw error;
          if (data) {
            setPushNotifications(data.allow_push_notifications ?? true);
            setEmailNotifications(data.allow_email_notifications ?? true);
          } else {
            setPushNotifications(true);
            setEmailNotifications(true);
          }
        } catch (err: any) {
          toast({ title: "오류", description: "알림 설정 로딩 실패: " + err.message, variant: "destructive" });
          setPushNotifications(true);
          setEmailNotifications(true);
        } finally {
          setIsLoadingSettings(false);
        }
      };
      fetchNotificationSettings();
      fetchProfileData(); // 프로필 정보도 함께 로드
    } else if (!authLoading && !user) {
      setIsLoadingSettings(false);
      setIsLoadingProfile(false);
      setPushNotifications(true);
      setEmailNotifications(true);
    } else if (authLoading) {
      setIsLoadingSettings(true);
      setIsLoadingProfile(true);
    }
  }, [user, authLoading, toast, fetchProfileData]);

  useEffect(() => {
    return () => {
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
    };
  }, [previewAvatarUrl]);


  const handleEditToggle = () => {
    if (!isEditing && profileData) {
      setEditedFirstName(profileData.first_name || '');
      // setEditedLastName(profileData.last_name || ''); // "성" 필드 제거로 삭제
      setEditedBio(profileData.bio || '');
      setEditedPhoneNumber(profileData.phone_number || '');
      setEditedBirthDate(profileData.birth_date || '');
      setEditedGender(profileData.gender || 'none');
      setEditedAvatarFile(null);
      setPreviewAvatarUrl(profileData.avatar_url); // 기존 아바타 URL로 미리보기 설정
    }
    setIsEditing(!isEditing);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditedAvatarFile(file);
      if (previewAvatarUrl && !previewAvatarUrl.startsWith('blob:')) { // 기존 supabase URL이 아니면 해제
        // No need to revoke supabase urls
      } else if (previewAvatarUrl) {
         URL.revokeObjectURL(previewAvatarUrl);
      }
      setPreviewAvatarUrl(URL.createObjectURL(file));
    }
  };
  
  const handleUpdateProfile = async () => {
    if (!user || !profileData) return;
    setIsUpdating(true);
    const genderToSave = editedGender === 'none' ? null : editedGender;

    try {
      let avatarUrl = profileData.avatar_url;

      if (editedAvatarFile) {
        const fileExt = editedAvatarFile.name.split('.').pop();
        const fileName = `${user.id}-${uuidv4()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, editedAvatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const updates: Partial<ProfileData> & { updated_at: string; id: string } = {
        id: user.id,
        first_name: editedFirstName, // 전체 이름이 여기에 저장됨
        last_name: null, // "성" 필드 제거로 null 또는 빈 문자열 처리
        bio: editedBio,
        avatar_url: avatarUrl,
        phone_number: editedPhoneNumber,
        birth_date: editedBirthDate || null,
        gender: genderToSave,
        updated_at: new Date().toISOString(),
      };
      
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) throw updateError;
      
      // Auth user metadata 업데이트 (avatar_url, first_name, last_name)
      const metadataToUpdate: UserMetadata = {
        avatar_url: avatarUrl,
        first_name: editedFirstName, // 전체 이름
        last_name: null, // "성" 필드 제거
        // 기존 메타데이터 보존을 위해 user.user_metadata를 확장할 수 있으나,
        // 현재 AuthContext의 updateUserMetadata는 전체를 덮어쓰므로 필요한 필드만 전달
      };
      await updateUserMetadata(metadataToUpdate);


      toast({ title: "성공", description: "프로필이 업데이트되었습니다." });
      setIsEditing(false);
      fetchProfileData(); // 업데이트 후 프로필 다시 로드
    } catch (error: any) {
      toast({ title: "오류", description: error.message || "프로필 업데이트 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };


  const handleSettingChange = async (settingType: 'push' | 'email', checked: boolean) => {
    if (!user || !user.id) {
      toast({ title: "오류", description: "사용자 정보가 없어 설정을 저장할 수 없습니다.", variant: "destructive" });
      return;
    }
    if (settingType === 'push') setPushNotifications(checked);
    else setEmailNotifications(checked);

    try {
      const fieldToUpdate = settingType === 'push' ? 'allow_push_notifications' : 'allow_email_notifications';
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, [fieldToUpdate]: checked, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) {
        if (settingType === 'push') setPushNotifications(!checked);
        else setEmailNotifications(!checked);
        throw error;
      }
      toast({ title: "성공", description: `${settingType === 'push' ? '푸시' : '이메일'} 알림 설정이 저장되었습니다.` });
    } catch (err: any) {
      toast({ title: "오류", description: `${settingType === 'push' ? '푸시' : '이메일'} 알림 설정 저장 실패: ${err.message}`, variant: "destructive" });
    }
  };

  const pageIsActuallyLoading = authLoading || isLoadingSettings || isLoadingProfile;
  const getSwitchCheckedState = (stateValue: boolean | null) => pageIsActuallyLoading || stateValue === null ? true : stateValue;
  const isSwitchDisabled = pageIsActuallyLoading || !user;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = (firstName || '').charAt(0);
    const last = (lastName || '').charAt(0);
    return `${first}${last}`.toUpperCase() || '?';
  };
  
  const displayName = user ? `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim() || user.email : '사용자';

  const formatPhoneNumber = (pn: string | null | undefined): string => {
    if (!pn) return '-';
    const cleaned = pn.replace(/\D/g, '');
    if (cleaned.length === 11) { // 010-xxxx-xxxx
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 7)}-${cleaned.substring(7)}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith('02')) { // 02-xxxx-xxxx
      return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    // 기타 국내 번호 형식 (예: 지역번호 3자리, 국번 3자리)
    if (cleaned.length === 10) {
        return `${cleaned.substring(0,3)}-${cleaned.substring(3,6)}-${cleaned.substring(6)}`;
    }
    return pn; // 그 외 형식은 그대로 반환
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ''); // 숫자만 추출
    let formattedValue = '';
    if (rawValue.length > 0) {
      if (rawValue.startsWith('02') && rawValue.length <= 10) { // 서울 지역번호
        formattedValue = rawValue.replace(/(\d{2})(\d{1,4})?(\d{1,4})?/, (match, p1, p2, p3) => {
          let res = p1;
          if (p2) res += `-${p2}`;
          if (p3) res += `-${p3}`;
          return res;
        });
      } else if (rawValue.length <= 11) { // 일반 휴대전화 또는 지역번호 3자리
        formattedValue = rawValue.replace(/(\d{3})(\d{1,4})?(\d{1,4})?/, (match, p1, p2, p3) => {
          let res = p1;
          if (p2) res += `-${p2}`;
          if (p3) res += `-${p3}`;
          return res;
        });
      } else { // 길이 초과 시 입력 제한 (11자리까지만)
        formattedValue = editedPhoneNumber;
      }
    }
    // 최대 길이 제한 (하이픈 포함)
    if (formattedValue.length > 13 && rawValue.length > 11) {
        // 이미 formattedValue가 이전 상태라면, 더 이상 변경하지 않음
    } else {
       setEditedPhoneNumber(formattedValue);
    }
  };

  if (pageIsActuallyLoading && !profileData && !user) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 flex justify-center items-center h-[calc(100vh-10rem)]">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">설정</h1> {/* mb-8에서 mb-6으로 변경 */}

        {/* 계정 섹션 (Supabase 스타일) */}
        <div className="py-6 border-b"> {/* 상하 패딩 및 하단 구분선 */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">계정</h2>
            {!isEditing && user && (
              <Button variant="outline" onClick={handleEditToggle} size="sm">
                <Edit className="mr-2 h-4 w-4" /> 프로필 수정
              </Button>
            )}
          </div>
          {isLoadingProfile && !profileData ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : user && profileData ? (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={previewAvatarUrl || profileData.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback>{getInitials(profileData.first_name, profileData.last_name)}</AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <>
                      <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
                      <Button variant="outline" size="icon" className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-muted transition-opacity" onClick={() => avatarInputRef.current?.click()} disabled={isUpdating}> {/* opacity-0 group-hover:opacity-100 제거 */}
                        <Camera className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <div>
                      <Input placeholder="이름 (성 포함)" value={editedFirstName} onChange={(e) => setEditedFirstName(e.target.value)} disabled={isUpdating} />
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-semibold">{displayName}</p>
                      <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        {userRole && (
                          <Badge variant="outline" className="py-1 px-2 border-gray-600">
                            <User className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs font-medium text-gray-300">
                              {userRole === 'trainer' ? '트레이너' : userRole === 'member' ? '회원' : userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                            </span>
                          </Badge>
                        )}
                        {centerName && (
                          <div className="flex items-center text-xs text-gray-400">
                            <Building className="mr-1.5 h-3.5 w-3.5" />
                            {centerName}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen} className="w-full mt-2">
                <div className="flex justify-center py-2"> {/* 아이콘 버튼 영역, 상하 패딩 추가 */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                      {isDetailsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      <span className="sr-only">{isDetailsOpen ? "상세 정보 숨기기" : "상세 정보 보기"}</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="pt-4 space-y-5 border-t border-border/60 mt-2"> {/* CollapsibleContent 내부, 상단 패딩 및 구분선 추가 */}
                    {/* 연락처 */}
                    <div className="flex flex-col sm:flex-row sm:items-center pb-5 border-b border-border/60">
                      <Label htmlFor="phone_number" className="w-full sm:w-32 text-sm font-medium text-muted-foreground mb-1 sm:mb-0 shrink-0">연락처</Label>
                      <div className="flex-1">
                        {isEditing ? (
                          <Input id="phone_number" type="tel" placeholder="010-1234-5678" value={editedPhoneNumber} onChange={handlePhoneNumberChange} disabled={isUpdating} className="text-sm" maxLength={13} />
                        ) : (
                          <p className="text-sm">{formatPhoneNumber(profileData.phone_number)}</p>
                        )}
                      </div>
                    </div>
                    {/* 생년월일 */}
                    <div className="flex flex-col sm:flex-row sm:items-center pb-5 border-b border-border/60">
                      <Label htmlFor="birth_date" className="w-full sm:w-32 text-sm font-medium text-muted-foreground mb-1 sm:mb-0 shrink-0">생년월일</Label>
                      <div className="flex-1">
                        {isEditing ? (
                          <Input id="birth_date" type="date" value={editedBirthDate} onChange={(e) => setEditedBirthDate(e.target.value)} disabled={isUpdating} className="text-sm" />
                        ) : (
                          <p className="text-sm">{profileData.birth_date ? new Date(profileData.birth_date).toLocaleDateString() : '-'}</p>
                        )}
                      </div>
                    </div>
                    {/* 성별 */}
                    <div className="flex flex-col sm:flex-row sm:items-center pb-5 border-b border-border/60">
                      <Label htmlFor="gender" className="w-full sm:w-32 text-sm font-medium text-muted-foreground mb-1 sm:mb-0 shrink-0">성별</Label>
                      <div className="flex-1">
                        {isEditing ? (
                          <Select value={editedGender} onValueChange={setEditedGender} disabled={isUpdating}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="성별 선택" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">남성</SelectItem>
                              <SelectItem value="female">여성</SelectItem>
                              <SelectItem value="other">기타</SelectItem>
                              <SelectItem value="none">선택 안함</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm">{profileData.gender ? (profileData.gender === 'male' ? '남성' : profileData.gender === 'female' ? '여성' : '기타') : '-'}</p>
                        )}
                      </div>
                    </div>
                    {/* 가입일 */}
                    {profileData.created_at && !isEditing && (
                      <div className="flex flex-col sm:flex-row sm:items-center pb-5 border-b border-border/60">
                        <Label className="w-full sm:w-32 text-sm font-medium text-muted-foreground mb-1 sm:mb-0 shrink-0">가입일</Label>
                        <div className="flex-1">
                          <p className="text-sm">{new Date(profileData.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                    {/* 자기소개 */}
                    <div className="flex flex-col pt-0"> {/* 자기소개는 하단 border 없음, pt-0으로 조정 */}
                      <Label htmlFor="bio" className="text-sm font-medium text-muted-foreground mb-2">자기소개</Label> {/* mb-2 추가 */}
                      <div className="flex-1">
                        {isEditing ? (
                          <Textarea id="bio" placeholder="자기소개를 입력하세요." value={editedBio} onChange={(e) => setEditedBio(e.target.value)} rows={4} disabled={isUpdating} className="text-sm" />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap min-h-[40px]">{profileData.bio || '자기소개가 없습니다.'}</p> /* min-h 추가 */
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {isEditing && (
                <div className="flex justify-end gap-2 pt-4 border-t mt-6"> {/* mt-6 추가 */}
                  <Button variant="outline" onClick={handleEditToggle} disabled={isUpdating}>
                    <X className="mr-2 h-4 w-4" /> 취소
                  </Button>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    저장
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.</p>
          )}
        </div>

        {/* 알림 섹션 (Supabase 스타일) */}
        <div className="py-6 border-b">
          <h2 className="text-xl font-semibold mb-4">알림</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications" className="font-medium">이메일 알림</Label>
                <p className="text-sm text-muted-foreground">새로운 기능 및 중요 업데이트에 대한 알림을 받습니다.</p>
              </div>
              <Switch
                id="email-notifications"
                checked={getSwitchCheckedState(emailNotifications)}
                onCheckedChange={(checked) => handleSettingChange('email', checked)}
                disabled={isSwitchDisabled}
                className="transform scale-90"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-notifications" className="font-medium">푸시 알림</Label>
                <p className="text-sm text-muted-foreground">활동 및 중요 알림에 대한 푸시 알림을 받습니다.</p>
              </div>
              <Switch
                id="push-notifications"
                checked={getSwitchCheckedState(pushNotifications)}
                onCheckedChange={(checked) => handleSettingChange('push', checked)}
                disabled={isSwitchDisabled}
                className="transform scale-90"
              />
            </div>
          </div>
        </div>

        {/* 테마 섹션 (Supabase 스타일) */}
        {/* 테마 섹션 시작 */}
        <div className="py-6">
          <h2 className="text-xl font-semibold mb-2">테마</h2> {/* 제목 변경, mb-2로 조정 */}
          <div className="flex justify-between items-center"> {/* items-center로 변경 */}
            <div>
              {/* <h3 className="text-lg font-medium mb-1">테마 모드</h3> */} {/* 부제목 삭제 */}
              <p className="text-sm text-muted-foreground">
                FitFluent가 어떻게 보이는지 선택하십시오.
              </p>
            </div>
            <div className="ml-6 flex items-center space-x-2"> {/* 테마 선택 버튼 영역 */}
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className={`flex items-center ${theme === 'light' ? '' : 'text-muted-foreground'}`}
              >
                <Sun className="mr-2 h-4 w-4" /> 라이트
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className={`flex items-center ${theme === 'dark' ? '' : 'text-muted-foreground'}`}
              >
                <Moon className="mr-2 h-4 w-4" /> 다크
              </Button>
            </div>
          </div>
        </div>
        {/* 테마 섹션 끝 */}
      </div>
    </AppLayout>
  );
}

export default SettingsPage;