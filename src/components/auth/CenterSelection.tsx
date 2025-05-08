import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MapPin, MapPinned, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { KakaoPlace } from "@/types/kakao";
import { useCenterSearch } from "@/hooks/use-center-search";

// Props 타입 정의
interface CenterSelectionProps {
  isNewMemberFlow?: boolean;
  onCenterSelect?: (centerId: string) => void; // 기존/관리자 흐름 콜백
  isSubmitting?: boolean;
  selectedPlace: KakaoPlace | null;
  onPlaceSelect: (place: KakaoPlace | null) => void; // null 허용
  // 추가: 일반 회원가입 확인 콜백
  onConfirmSignup?: () => void;
}

export function CenterSelection({
  isNewMemberFlow,
  onCenterSelect,
  isSubmitting: parentIsSubmitting,
  selectedPlace,
  onPlaceSelect,
  onConfirmSignup, // prop 추가
}: CenterSelectionProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, refreshUserRole } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    debouncedSearchQuery,
    searchCenters
  } = useCenterSearch();

  useEffect(() => {
    if (debouncedSearchQuery.trim().length > 0) {
      searchCenters(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, searchCenters]);

  // 확인 다이얼로그 열기/닫기 로직 (부모 상태에 따라)
  useEffect(() => {
    setConfirmDialogOpen(!!selectedPlace); // selectedPlace가 있으면 다이얼로그 열기
  }, [selectedPlace]);


  // Helper function to find or create a center
async function findOrCreateCenter(
  supabaseClient: typeof supabase,
  place: KakaoPlace
): Promise<string | null> {
  let centerId: string | null = null;

  // 1. Check if center exists using kakao_place_id
  // @ts-ignore
  const selectResult: any = await supabaseClient
    .from('centers')
    .select('id')
    .eq('kakao_place_id', place.id)
    .maybeSingle();

  if (selectResult.error) {
    console.error('Error checking existing center:', selectResult.error);
    return null;
  }

  if (selectResult.data) {
    centerId = selectResult.data.id;
    console.log('[findOrCreateCenter] Existing center found:', centerId);
  } else {
    console.log('[findOrCreateCenter] No existing center found, inserting new one...');
    // 클라이언트 측에서 센터 생성 시 RLS 정책 필요 (authenticated 사용자 INSERT 허용)
    const insertResult = await supabaseClient
      .from('centers')
      .insert({
        name: place.place_name,
        address: place.road_address_name || place.address_name,
        description: `전화: ${place.phone || ''}`,
        kakao_place_id: place.id,
      })
      .select('id')
      .single();

    if (insertResult.error) {
      console.error('Error inserting new center:', insertResult.error);
      toast({ title: "오류", description: `센터 생성 중 오류: ${insertResult.error.message}`, variant: "destructive" });
      return null;
    }
    centerId = insertResult.data?.id;
    console.log('[findOrCreateCenter] New center inserted:', centerId);
  }

  return centerId;
}


  const handleConfirmRegistration = async () => {
    console.log('!!! [CenterSelection] handleConfirmRegistration function CALLED !!!');
    console.log('[CenterSelection] parentIsSubmitting:', parentIsSubmitting);
    console.log('[CenterSelection] selectedPlace:', selectedPlace);
    console.log('[CenterSelection] onCenterSelect prop type:', typeof onCenterSelect);
    console.log('[CenterSelection] onConfirmSignup prop type:', typeof onConfirmSignup);

    if (!selectedPlace || parentIsSubmitting) {
       console.log('[CenterSelection] Exiting: Missing place or already submitting.');
       return;
    }

    // 1. 일반 회원가입 흐름 (onConfirmSignup 콜백 사용)
    if (onConfirmSignup) {
       console.log('[CenterSelection] onConfirmSignup exists. Calling callback.');
       onConfirmSignup(); // 페이지 레벨의 등록 함수 호출
       setConfirmDialogOpen(false); // 다이얼로그 닫기
    }
    // 2. 관리자/트레이너 신규 회원 등록 흐름 (onCenterSelect 콜백 사용, centerId 전달)
    else if (onCenterSelect && isNewMemberFlow) {
       console.log('[CenterSelection] onCenterSelect exists (Admin New Member Flow). Proceeding with callback flow.');
       // 관리자 흐름에서는 클라이언트에서 센터 생성 시도 (RLS 주의)
       const centerId = await findOrCreateCenter(supabase, selectedPlace);
       if (!centerId) {
          // findOrCreateCenter 내부에서 toast 처리
          setConfirmDialogOpen(false);
          return;
       }
       console.log('[CenterSelection] Calling onCenterSelect with centerId:', centerId);
       onCenterSelect(centerId); // 페이지 레벨의 등록 함수 호출 (Edge Function)
       setConfirmDialogOpen(false);
    }
    // 3. 기존 로그인 후 초기 설정 흐름 (콜백 없음)
    else {
       console.log('[CenterSelection] No relevant callback found. Proceeding with initial setup flow.');
       if (!user) { // 이 흐름에서는 user 필수
         console.error('[CenterSelection] Initial setup flow requires a logged-in user.');
         toast({ title: "오류", description: "사용자 정보가 없습니다. 다시 로그인해주세요.", variant: "destructive" });
         navigate("/login");
         return;
       }
       try {
         setConfirmDialogOpen(false);

      // 기존 로그인 흐름에서도 클라이언트에서 센터 생성 시도 (RLS 주의)
      const centerId = await findOrCreateCenter(supabase, selectedPlace);

      if (!centerId) {
        // findOrCreateCenter 내부에서 toast 처리
        return;
      }

      console.log('[CenterSelection] Upserting center_users with final center_id:', centerId);

      const { error: userCenterError } = await supabase
        .from('center_users')
        .upsert({
          user_id: user.id,
          center_id: centerId
        }, {
          onConflict: 'user_id'
        });

      if (userCenterError) throw userCenterError;

      await refreshUserRole(user);

      toast({
        title: '센터 등록 완료',
        description: '선택하신 센터가 성공적으로 등록되었습니다. 대시보드로 이동합니다.',
      });

      setSearchQuery('');
      navigate('/dashboard', { replace: true });

    } catch (error) {
      console.error('센터 등록 오류:', error);
      toast({
        title: '오류 발생',
        description: '센터 등록 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
       }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">센터 선택</h1>
        <p className="text-xl text-muted-foreground mt-2">
          활동하실 피트니스 센터를 선택해주세요
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="피트니스 센터 검색 또는 주소 검색..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mt-6 space-y-3">
  {isSearching ? (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-muted-foreground">검색 중...</p>
      </CardContent>
    </Card>
  ) : searchResults.length > 0 ? (
    searchResults.map((place) => (
      <Card
        key={place.id}
        className="cursor-pointer hover:shadow-md transition-all mb-2"
        onClick={() => onPlaceSelect(place)} // 부모 콜백 호출
      >
        <CardContent className="p-4 flex items-start gap-3">
          <div className="bg-primary/10 p-2 rounded-full">
            <MapPinned className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{place.place_name}</h3>
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1" />
              <span>{place.road_address_name || place.address_name}</span>
            </div>
            {place.phone && (
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <Phone className="h-3 w-3 mr-1" />
                <span>{place.phone}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    ))
  ) : (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-muted-foreground">검색 결과가 없습니다</p>
      </CardContent>
    </Card>
  )}
</div>
</div>


      <AlertDialog open={confirmDialogOpen} onOpenChange={(open) => {
        setConfirmDialogOpen(open);
        if (!open) {
          onPlaceSelect(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>센터 등록 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlace?.place_name}을(를) 등록하시겠습니까?
            </AlertDialogDescription>
            <div className="mt-2 text-sm">
              <p>주소: {selectedPlace?.road_address_name || selectedPlace?.address_name}</p>
              {selectedPlace?.phone && <p>전화: {selectedPlace.phone}</p>}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRegistration}
              disabled={parentIsSubmitting}
            >
              {parentIsSubmitting ? '처리 중...' : (isNewMemberFlow ? '등록 완료' : '확인')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}