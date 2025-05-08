
import { KakaoPlace } from "@/types/kakao";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CenterConfirmDialogProps {
  selectedPlace: KakaoPlace | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const CenterConfirmDialog = ({
  selectedPlace,
  isOpen,
  onOpenChange,
  onConfirm,
}: CenterConfirmDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>센터 등록 확인</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedPlace?.place_name}을(를) 등록하시겠습니까?
            <div className="mt-2 text-sm">
              <p>주소: {selectedPlace?.road_address_name || selectedPlace?.address_name}</p>
              {selectedPlace?.phone && <p>전화: {selectedPlace.phone}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>확인</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
