import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserCheck, User, Edit, Save, X, Camera, Building } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { UserMetadata } from '@supabase/supabase-js';

// 사용자 역할 타입 정의 (Supabase Enum과 일치)
type UserRole = 'trainer' | 'member';

// 멤버십 데이터 타입 (간략화)
interface MembershipData {
  plan: string | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
}

// 프로필 데이터 타입 정의
interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  bio?: string | null;
  created_at?: string;
  role?: UserRole | null;
  gender?: string | null;
  phone_number?: string | null;
  birth_date?: string | null; // yyyy-mm-dd 형식
  memberships?: MembershipData[] | null;
  center_id?: string | null;
  updated_at?: string;
  center_name?: string | null; // 센터 이름 추가
}

// 성별 표시 함수 추가
const displayGender = (gender: string | null | undefined): string => {
  switch (gender) {
    case 'male': return '남성';
    case 'female': return '여성';
    case 'other': return '기타';
    default: return '-';
  }
};

// 연락처 자동 하이픈 함수 추가
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, '');
  if (numbers.length <= 3) {
    return numbers;
  }
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  }
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export function ProfilePage2() {
  const { user, userCenter } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState('');
  const [editedLastName, setEditedLastName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState('');
  const [editedBirthDate, setEditedBirthDate] = useState('');
  const [editedGender, setEditedGender] = useState('');
  const [editedAvatarFile, setEditedAvatarFile] = useState<File | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      console.error("No target user ID found.");
      toast({ title: "오류", description: "사용자 정보를 찾을 수 없습니다.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const ownProfileCheck = targetUserId === user?.id;
    setIsOwnProfile(ownProfileCheck);
    const currentCenterId = userCenter;

    try {
      const [profileResponse, roleResponse, membershipResponse, centerResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', targetUserId).single(),
        supabase.from('user_roles').select('role').eq('user_id', targetUserId).maybeSingle(),
        supabase.from('memberships').select('plan, total_sessions, remaining_sessions').eq('member_id', targetUserId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        currentCenterId ? supabase.from('centers').select('name').eq('id', currentCenterId).single() : Promise.resolve({ data: null, error: null })
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (!profileResponse.data) throw new Error("프로필 데이터를 찾을 수 없습니다.");
      const profileResult = profileResponse.data as ProfileData;

      let userRole: UserRole | null = null;
      if (roleResponse.error) console.error("Error fetching user role:", roleResponse.error);
      else if (roleResponse.data) userRole = roleResponse.data.role as UserRole;

      let membershipInfo: MembershipData | null = null;
      if (membershipResponse.error) console.error("Error fetching membership:", membershipResponse.error);
      else if (membershipResponse.data) membershipInfo = membershipResponse.data;

      let centerName: string | null = null;
      if (centerResponse.error) console.error("Error fetching center name:", centerResponse.error);
      else if (centerResponse.data) centerName = centerResponse.data.name;

      const fetchedProfile: ProfileData = {
        ...profileResult,
        role: userRole,
        memberships: membershipInfo ? [membershipInfo] : null,
        email: ownProfileCheck ? user?.email : undefined,
        center_name: centerName,
      };
      setProfileData(fetchedProfile);

      if (!isEditing) {
        setEditedFirstName(fetchedProfile.first_name || '');
        setEditedLastName(fetchedProfile.last_name || '');
        setEditedBio(fetchedProfile.bio || '');
        // 연락처 표시 형식 적용
        setEditedPhoneNumber(formatPhoneNumber(fetchedProfile.phone_number || ''));
        setEditedBirthDate(fetchedProfile.birth_date || '');
        setEditedGender(fetchedProfile.gender || 'none');
        setEditedAvatarFile(null);
        setPreviewAvatarUrl(null);
      }

    } catch (error: any) {
      console.error("[fetchProfile] CATCH block error:", error);
      toast({ title: "오류", description: error.message || "프로필 정보를 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
      setProfileData(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, user, userCenter, toast, isEditing]);

  useEffect(() => {
    if (user !== undefined && userCenter !== undefined) {
       fetchProfile();
    }
  }, [user, userCenter, fetchProfile]);

  useEffect(() => {
    return () => {
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
    };
  }, [previewAvatarUrl]);

  const getInitials = (profile: ProfileData | null) => {
    if (!profile) return "?";
    const firstNameInitial = (profile.first_name || '').charAt(0);
    const lastNameInitial = (profile.last_name || '').charAt(0);
    return `${firstNameInitial}${lastNameInitial}`.toUpperCase() || '?';
  };

  const getDisplayName = (profile: ProfileData | null) => {
    if (!profile) return '사용자';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '이름 없음';
  }

  // displayRole 함수 제거 (displayGender 사용)

  const RoleIcon = ({ role }: { role: UserRole | null | undefined }) => {
    if (role === 'trainer') return <UserCheck className="h-4 w-4 text-blue-500" />;
    if (role === 'member') return <User className="h-4 w-4 text-green-500" />;
    return null;
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditedAvatarFile(file);
      if (previewAvatarUrl) {
        URL.revokeObjectURL(previewAvatarUrl);
      }
      setPreviewAvatarUrl(URL.createObjectURL(file));
    }
  };

  // 연락처 입력 핸들러 수정
  const handlePhoneNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/[^0-9]/g, '');
    if (rawValue.length <= 11) {
      setEditedPhoneNumber(formatPhoneNumber(rawValue));
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profileData) return;
    setIsUpdating(true);
    const genderToSave = editedGender === 'none' ? null : editedGender;
    // 저장 시 하이픈 제거된 숫자만 저장
    const phoneNumberToSave = editedPhoneNumber.replace(/[^0-9]/g, '');

    console.log("Updating profile with:", { editedFirstName, editedLastName, editedBio, phoneNumberToSave, editedBirthDate, genderToSave, editedAvatarFile });

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

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: editedFirstName,
          last_name: editedLastName,
          bio: editedBio,
          avatar_url: avatarUrl,
          phone_number: phoneNumberToSave, // 하이픈 제거된 값 저장
          birth_date: editedBirthDate || null,
          gender: genderToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // updateUserMetadata 호출 제거

      toast({ title: "성공", description: "프로필이 업데이트되었습니다." });
      await fetchProfile();

    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "오류", description: error.message || "프로필 업데이트 중 오류가 발생했습니다.", variant: "destructive" });
      setIsUpdating(false);
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

   const handleEditToggle = () => {
    if (!isEditing && profileData) {
      setEditedFirstName(profileData.first_name || '');
      setEditedLastName(profileData.last_name || '');
      setEditedBio(profileData.bio || '');
      // 편집 시작 시에도 형식 적용
      setEditedPhoneNumber(formatPhoneNumber(profileData.phone_number || ''));
      setEditedBirthDate(profileData.birth_date || '');
      setEditedGender(profileData.gender || 'none');
      setEditedAvatarFile(null);
      setPreviewAvatarUrl(null);
    }
    setIsEditing(!isEditing);
  };


  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        ) : profileData ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">
                {isOwnProfile ? '내 프로필' : `${getDisplayName(profileData)}의 프로필`}
              </h1>
              {isOwnProfile && !isEditing && (
                <Button variant="outline" onClick={handleEditToggle}>
                  <Edit className="mr-2 h-4 w-4" /> 프로필 수정
                </Button>
              )}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>사용자 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="relative group">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={previewAvatarUrl || profileData.avatar_url || undefined} alt={getDisplayName(profileData)} />
                      <AvatarFallback>{getInitials(profileData)}</AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          ref={avatarInputRef}
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={isUpdating}
                        >
                          <Camera className="h-4 w-4" />
                          <span className="sr-only">프로필 사진 변경</span>
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="성"
                          value={editedLastName}
                          onChange={(e) => setEditedLastName(e.target.value)}
                          disabled={isUpdating}
                        />
                        <Input
                          placeholder="이름"
                          value={editedFirstName}
                          onChange={(e) => setEditedFirstName(e.target.value)}
                          disabled={isUpdating}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-xl font-semibold">{getDisplayName(profileData)}</p>
                        {isOwnProfile && profileData.email && (
                          <p className="text-sm text-muted-foreground">{profileData.email}</p>
                        )}
                        <div className="flex items-center mt-1 flex-wrap gap-2">
                          <div className="flex items-center">
                            <RoleIcon role={profileData.role} />
                            <Badge variant="outline" className="ml-2">
                              {/* displayRole 대신 displayGender 사용 */}
                              {profileData.role === 'trainer' ? '트레이너' : '회원'}
                            </Badge>
                          </div>
                          {profileData.center_name && (
                            <div className="flex items-center">
                              <Building className="h-4 w-4 text-muted-foreground" />
                              <span className="ml-1 text-sm text-muted-foreground">{profileData.center_name}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                  <div>
                    <Label htmlFor="phone_number" className="text-sm text-muted-foreground">연락처</Label>
                    {isEditing ? (
                      <Input
                        id="phone_number"
                        type="tel" // type="tel" 유지
                        placeholder="010-1234-5678"
                        value={editedPhoneNumber}
                        onChange={handlePhoneNumberChange} // 변경된 핸들러 사용
                        maxLength={13} // 하이픈 포함 최대 길이
                        disabled={isUpdating}
                        className="mt-1"
                      />
                    ) : (
                      // 표시할 때도 형식 적용
                      <p className="mt-1">{formatPhoneNumber(profileData.phone_number || '') || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="birth_date" className="text-sm text-muted-foreground">생년월일</Label>
                    {isEditing ? (
                      <Input
                        id="birth_date"
                        type="date"
                        value={editedBirthDate}
                        onChange={(e) => setEditedBirthDate(e.target.value)}
                        disabled={isUpdating}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1">{profileData.birth_date ? new Date(profileData.birth_date).toLocaleDateString() : '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="gender" className="text-sm text-muted-foreground">성별</Label>
                    {isEditing ? (
                      <Select
                        value={editedGender}
                        onValueChange={setEditedGender}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="성별 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">남성</SelectItem>
                          <SelectItem value="female">여성</SelectItem>
                          <SelectItem value="other">기타</SelectItem>
                          <SelectItem value="none">선택 안함</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      // displayGender 함수 사용
                      <p className="mt-1">{displayGender(profileData.gender)}</p>
                    )}
                  </div>
                   {profileData.created_at && !isEditing && (
                    <div>
                      <Label className="text-sm text-muted-foreground">가입일</Label>
                      <p className="mt-1">{new Date(profileData.created_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="bio" className="text-sm text-muted-foreground">자기소개</Label>
                  {isEditing ? (
                    <Textarea
                      id="bio"
                      placeholder="자기소개를 입력하세요."
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value)}
                      rows={4}
                      disabled={isUpdating}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                      {profileData.bio || (isOwnProfile ? '자기소개가 없습니다. 수정하여 추가해보세요.' : '자기소개가 없습니다.')}
                    </p>
                  )}
                </div>

                {profileData.role === 'member' && profileData.memberships?.[0] && !isEditing && (
                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-2">멤버십 정보</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">플랜</p>
                        <p className="font-semibold">{profileData.memberships[0].plan || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">총 세션</p>
                        <p className="font-semibold">{profileData.memberships[0].total_sessions ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">잔여 세션</p>
                        <p className="font-semibold">{profileData.memberships[0].remaining_sessions ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {isOwnProfile && isEditing && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={handleEditToggle} disabled={isUpdating}>
                      <X className="mr-2 h-4 w-4" /> 취소
                    </Button>
                    <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      저장
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold mb-2">프로필을 찾을 수 없습니다.</h2>
            <p className="text-muted-foreground">요청한 사용자의 프로필 정보를 불러올 수 없습니다.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ProfilePage2;