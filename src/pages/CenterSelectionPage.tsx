import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CenterSelection } from "@/components/auth/CenterSelection";
import { useNewMember } from '@/contexts/NewMemberContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { KakaoPlace } from '@/types/kakao';

const CenterSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { memberData, setMemberData, resetMemberData } = useNewMember();
  const { user: currentUser, signUp, refreshUserRole } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  // const [confirmDialogOpen, setConfirmDialogOpen] = useState(false); // CenterSelection 내부에서 관리

  const isAdminNewMemberFlow = location.pathname === '/members/new/center';
  const isSignupFlow = location.pathname === '/signup/center';

  // 센터 선택 및 최종 등록 처리 함수 (관리자/트레이너용)
  const handleCenterSelectForAdminNewMember = async (centerId: string) => {
    if (!isAdminNewMemberFlow) return;

    setIsSubmitting(true);
    setMemberData(prev => ({ ...prev, centerId }));

    const finalMemberData = { ...memberData, centerId };

    if (!finalMemberData.email || !finalMemberData.password || !finalMemberData.name || !finalMemberData.role) {
       toast({ title: "오류", description: "회원 정보가 불완전합니다.", variant: "destructive" });
       setIsSubmitting(false);
       return;
    }

    try {
      // Edge Function 호출 시 centerId 및 creatorId 직접 전달
      if (!currentUser) {
         toast({ title: "오류", description: "로그인 정보가 없습니다.", variant: "destructive" });
         setIsSubmitting(false);
         return;
      }
      const { data: functionData, error: functionError } = await supabase.functions.invoke('create-new-user', {
        body: {
          email: finalMemberData.email,
          password: finalMemberData.password,
          name: finalMemberData.name,
          role: finalMemberData.role,
          phone_number: finalMemberData.phoneNumber,
          birth_date: finalMemberData.birthDate,
          gender: finalMemberData.gender,
          avatar_url: finalMemberData.avatarUrl,
          centerId: finalMemberData.centerId,
          creatorId: currentUser.id, // 현재 로그인한 사용자 ID 전달
        },
      });

      if (functionError) {
         // Edge Function에서 반환된 특정 오류 처리 (예: 이메일 중복)
         if (functionError.context?.json?.error === 'EMAIL_ALREADY_EXISTS') {
            throw { context: { json: { error: 'EMAIL_ALREADY_EXISTS', message: functionError.context.json.message } } };
         }
         throw functionError;
      }
      if (!functionData || !functionData.userId) throw new Error("Edge Function did not return a user ID.");

      const newUserId = functionData.userId;

      // Edge Function에서 members 테이블 삽입을 처리하므로 클라이언트 측 삽입 로직 제거
      /*
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: newUserId,
          center_id: finalMemberData.centerId,
          name: finalMemberData.name,
          email: finalMemberData.email,
          status: 'active',
          phone_number: finalMemberData.phoneNumber,
          birth_date: finalMemberData.birthDate,
          gender: finalMemberData.gender,
        });

      if (memberError) {
         console.error("Error inserting into members table:", memberError);
         toast({ title: "오류", description: "회원 정보를 DB에 저장하는 중 오류 발생.", variant: "destructive" });
         throw memberError;
      }
      */

      // 클라이언트 측 center_users 조작 제거 (Edge Function에서 처리)

      toast({ title: "성공", description: `${finalMemberData.name} 회원이 성공적으로 등록되었습니다.` });
      resetMemberData();
      navigate('/dashboard');

    } catch (error: any) {
      console.error("New member registration failed:", error);
      let description = "회원 등록 중 오류가 발생했습니다.";
      if (error && typeof error === 'object' && 'context' in error && error.context && typeof error.context === 'object') {
         const context = error.context as any;
         if (context.json?.error === 'EMAIL_ALREADY_EXISTS') {
            description = context.json.message || "이미 등록된 이메일 주소입니다.";
         } else if (context.status === 409) {
             description = "이미 등록된 이메일 주소입니다. (상태 코드 409)";
         } else if (context.message) {
             description = context.message;
         }
      } else if (error instanceof Error) {
        description = error.message;
      }
      toast({ title: "회원 등록 실패", description: description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 프로필 이미지 업로드 함수
  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      if (!userId) throw new Error("User ID was not provided for avatar path.");
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      console.log(`Uploading avatar to: ${filePath}`);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('Avatar uploaded successfully. Public URL:', urlData?.publicUrl);
      return urlData?.publicUrl || null;

    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ title: "오류", description: "프로필 이미지 업로드 중 오류가 발생했습니다.", variant: "destructive" });
      return null;
    }
  };

  // CenterSelection 컴포넌트에서 장소 선택 시 호출될 콜백 함수
  const handlePlaceSelect = (place: KakaoPlace | null) => {
    setSelectedPlace(place);
  };


  // Helper function to find or create a center (adapted from CenterSelection)
  async function findOrCreateCenter(place: KakaoPlace): Promise<string | null> {
    let centerId: string | null = null;

    // 1. Check if center exists using kakao_place_id
    const { data: existingCenter, error: selectError } = await supabase
      .from('centers')
      .select('id')
      .eq('kakao_place_id', place.id)
      .maybeSingle();

    if (selectError) {
      console.error('[Signup Flow] Error checking existing center:', selectError);
      toast({ title: "오류", description: "센터 정보 확인 중 오류 발생.", variant: "destructive" });
      return null;
    }

    if (existingCenter) {
      centerId = existingCenter.id;
      console.log('[Signup Flow] Existing center found:', centerId);
    } else {
      console.log('[Signup Flow] No existing center found, inserting new one...');
      // Ensure RLS allows authenticated users to insert into 'centers'
      const { data: newCenter, error: insertError } = await supabase
        .from('centers')
        .insert({
          name: place.place_name,
          address: place.road_address_name || place.address_name,
          description: `전화: ${place.phone || ''}`,
          kakao_place_id: place.id,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[Signup Flow] Error inserting new center:', insertError);
        toast({ title: "오류", description: `센터 생성 중 오류: ${insertError.message}`, variant: "destructive" });
        return null;
      }
      centerId = newCenter?.id;
      console.log('[Signup Flow] New center inserted:', centerId);
    }

    return centerId;
  }

  // 센터 선택 및 최종 등록 처리 함수 (일반 회원가입용)
  const handleCenterSelectForSignup = async () => {
     console.log('[Signup Flow] handleCenterSelectForSignup called.');
     if (!isSignupFlow || !selectedPlace) {
       console.log('[Signup Flow] Not in signup flow or no place selected, exiting.');
       return;
     }

     setIsSubmitting(true);
     const finalMemberData = { ...memberData, centerId: selectedPlace.id };

     console.log('[Signup Flow] Checking required fields...');
     if (!finalMemberData.email || !finalMemberData.password || !finalMemberData.name || !finalMemberData.role) {
        console.error('[Signup Flow] Missing required fields in context:', finalMemberData);
        toast({ title: "오류", description: "회원 정보가 불완전합니다.", variant: "destructive" });
        setIsSubmitting(false);
        return;
     }
     console.log('[Signup Flow] Required fields checked.');

     try {
        console.log('[Signup Flow] Attempting supabase.auth.signUp...');
        const { data: authData, error: authError } = await signUp(
          finalMemberData.email,
          finalMemberData.password,
          {
            first_name: finalMemberData.name?.split(' ')[0] || '',
            last_name: finalMemberData.name?.split(' ').slice(1).join(' ') || '',
          }
        );

        if (authError) throw authError;
        if (!authData.user) throw new Error("Sign up successful but no user data returned.");

        const newUserId = authData.user.id;
        console.log(`[Signup Flow] signUp successful, new user ID: ${newUserId}`);

        let uploadedAvatarUrl: string | null = null;
        if (finalMemberData.avatarFile) {
          console.log('Avatar file found, attempting to upload...');
          uploadedAvatarUrl = await uploadAvatar(finalMemberData.avatarFile, newUserId);
          if (!uploadedAvatarUrl) {
             toast({ title: "경고", description: "프로필 이미지 업로드 실패.", variant: "destructive"});
          } else {
             console.log('[Signup Flow] Avatar uploaded successfully. URL:', uploadedAvatarUrl);
          }
        }

        console.log(`[Signup Flow] Attempting to update profiles table for user ${newUserId}...`);
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            phone_number: finalMemberData.phoneNumber,
            birth_date: finalMemberData.birthDate,
            gender: finalMemberData.gender,
            avatar_url: uploadedAvatarUrl,
          })
          .eq('id', newUserId);

        if (profileUpdateError) {
           console.error("[Signup Flow] Error updating profiles table:", profileUpdateError);
           toast({ title: "오류", description: "프로필 정보 저장 중 오류 발생.", variant: "destructive" });
           throw profileUpdateError;
        }
        console.log(`[Signup Flow] Updated profiles table successfully.`);

        // Find or create the center and get the actual UUID
        console.log('[Signup Flow] Finding or creating center...');
        if (!selectedPlace) { // Add null check for selectedPlace
           toast({ title: "오류", description: "선택된 센터 정보가 없습니다.", variant: "destructive" });
           setIsSubmitting(false);
           return;
        }
        const realCenterId = await findOrCreateCenter(selectedPlace);

        if (!realCenterId) {
          toast({ title: "오류", description: "센터 정보를 처리하는 중 오류가 발생했습니다.", variant: "destructive" });
          // Optionally, consider rolling back the user creation or handling this state
          setIsSubmitting(false); // Ensure submission state is reset
          return; // Stop execution if center ID couldn't be obtained
        }
        console.log(`[Signup Flow] Using actual center UUID: ${realCenterId}`);


        console.log(`[Signup Flow] Attempting to insert into members table for user ${newUserId}...`);
        const { error: memberError } = await supabase
          .from('members')
          .insert({
            user_id: newUserId, // TypeScript 타입 정의에 따라 user_id 다시 추가
            center_id: realCenterId, // Use the actual UUID
            name: finalMemberData.name,
            email: finalMemberData.email,
            status: 'active',
            phone_number: finalMemberData.phoneNumber,
            birth_date: finalMemberData.birthDate,
            gender: finalMemberData.gender,
          });

        if (memberError) {
           console.error("[Signup Flow] Error inserting into members table:", memberError);
           toast({ title: "오류", description: "회원 정보 저장 중 오류 발생.", variant: "destructive" });
           throw memberError;
        }
        console.log(`[Signup Flow] Inserted into members table successfully.`);

        console.log(`[Signup Flow] Attempting to insert into user_roles table for user ${newUserId}...`);
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: newUserId,
            role: finalMemberData.role,
          });

        if (roleError) {
           console.error("[Signup Flow] Error inserting into user_roles table:", roleError);
           toast({ title: "오류", description: "회원 역할 저장 중 오류 발생.", variant: "destructive" });
           throw roleError;
        }
        console.log(`[Signup Flow] Inserted into user_roles table successfully.`);

        console.log(`[Signup Flow] Attempting to upsert into center_users table for user ${newUserId}...`);
        const { error: centerUserError } = await supabase
          .from('center_users')
          .upsert({
            user_id: newUserId,
            center_id: realCenterId, // Use the actual UUID
          }, { onConflict: 'user_id' });

        if (centerUserError) {
           console.error("[Signup Flow] Error upserting center_users:", centerUserError);
           toast({ title: "오류", description: "센터 정보 저장 중 오류 발생.", variant: "destructive" });
           throw centerUserError;
        }
        console.log(`[Signup Flow] Upserted into center_users table successfully.`);

        console.log('[Signup Flow] All steps completed successfully.');
        toast({ title: "회원가입 완료", description: "FitFluent에 오신 것을 환영합니다!" });
        resetMemberData();

        // Refresh user role/center info before navigating
        console.log('[Signup Flow] Refreshing user role/center info...');
        const { data: { user: signedUpUser } } = await supabase.auth.getUser(); // Get the newly signed up user object
        if (signedUpUser) {
          await refreshUserRole(signedUpUser); // Pass the user object
          console.log('[Signup Flow] User role/center info refreshed. Navigating to dashboard.');
          navigate('/dashboard', { replace: true });
        } else {
          console.error('[Signup Flow] Could not get user object after signup to refresh role.');
          // Handle error case - maybe navigate to login or show error
          toast({ title: "오류", description: "사용자 정보를 가져오는데 실패했습니다. 다시 로그인해주세요.", variant: "destructive" });
          navigate('/login'); // Fallback to login
        }


      } catch (error: any) {
        console.error("Signup failed:", error);
        let description = "회원가입 중 오류가 발생했습니다.";
        if (error.message.includes('already been registered')) {
           description = "이미 등록된 이메일 주소입니다.";
        }
        toast({ title: "회원가입 실패", description: description, variant: "destructive" });
     } finally {
        setIsSubmitting(false);
     }
  };

  // 일반 회원가입 확인 버튼 클릭 시 호출될 함수
  const handleConfirmRegistrationSignup = () => {
     if (selectedPlace) {
        handleCenterSelectForSignup();
     } else {
        toast({ title: "오류", description: "선택된 센터 정보가 없습니다.", variant: "destructive" });
     }
  };

  // CenterSelection 컴포넌트의 onCenterSelect prop은 기존 로그인 흐름에서만 사용됨
  const onCenterSelectForExistingUser = async (centerId: string) => {
     if (!currentUser) return;
     setIsSubmitting(true);
     try {
        const { error: userCenterError } = await supabase
          .from('center_users')
          .upsert({ user_id: currentUser.id, center_id: centerId }, { onConflict: 'user_id' });
        if (userCenterError) throw userCenterError;
        await refreshUserRole(currentUser);
        toast({ title: '센터 등록 완료', description: '선택하신 센터가 성공적으로 등록되었습니다.' });
        navigate('/dashboard', { replace: true });
     } catch (error) {
        console.error('센터 등록 오류 (기존 사용자):', error);
        toast({ title: '오류 발생', description: '센터 등록 중 문제가 발생했습니다.', variant: 'destructive' });
     } finally {
        setIsSubmitting(false);
     }
  };

  // 최종 콜백 결정 (onCenterSelect prop 용)
  const onCenterSelectCallback = isAdminNewMemberFlow
     ? handleCenterSelectForAdminNewMember // 관리자 흐름 콜백 (centerId 받음)
     : !isSignupFlow // 일반 로그인 후 초기 설정 흐름인지 확인
     ? onCenterSelectForExistingUser // 기존 사용자 콜백 (centerId 받음)
     : undefined; // 일반 회원가입 흐름에서는 onCenterSelect 사용 안 함


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fitness-light to-white p-4">
      <div className="w-full max-w-2xl">
        <CenterSelection
           isNewMemberFlow={isAdminNewMemberFlow || isSignupFlow}
           onCenterSelect={onCenterSelectCallback} // 기존/관리자 흐름용 콜백
           isSubmitting={isSubmitting}
           selectedPlace={selectedPlace}
           onPlaceSelect={handlePlaceSelect}
           // 일반 회원가입 확인 버튼 클릭 시 호출될 함수 전달
           onConfirmSignup={isSignupFlow ? handleConfirmRegistrationSignup : undefined}
        />
      </div>
    </div>
  );
};

export default CenterSelectionPage;

