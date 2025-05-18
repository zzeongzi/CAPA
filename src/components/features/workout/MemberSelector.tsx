import React, { useState, useMemo, useRef } from "react"; // useEffect 제거, useMemo 추가, useRef 추가
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// supabase import 제거 (스토어에서 처리)
import { Database } from "@/integrations/supabase/types";
import useDebounce from "@/hooks/use-debounce";
// useAuth 제거 (스토어에서 처리)
import { useWorkoutStore } from "@/store/workoutStore"; // Zustand 스토어 import 추가
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Member = Database['public']['Tables']['members']['Row'];

interface MemberSelectorProps {
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({
  selectedMemberId,
  onSelectMember,
}) => {
  // Zustand 스토어에서 상태 및 액션 가져오기
  const { members, isLoadingMembers, memberError } = useWorkoutStore();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null); // PopoverTrigger 버튼 ref
  const debouncedSearchValue = useDebounce(searchValue, 500); // 검색 디바운스 유지

  // 클라이언트 측 필터링 로직
  const filteredMemberList = useMemo(() => {
    if (!debouncedSearchValue) {
      return members; // 검색어 없으면 전체 목록 반환
    }
    const searchTerm = debouncedSearchValue.toLowerCase();
    return members.filter(member =>
      member.name.toLowerCase().includes(searchTerm) ||
      member.phone_number?.includes(searchTerm) // 전화번호 검색 추가
    );
  }, [members, debouncedSearchValue]);

  const selectedMember = members.find((member) => member.id === selectedMemberId);

  return (
    <Popover modal={true} open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setSearchValue(""); // Popover 닫힐 때 검색어 초기화
        triggerRef.current?.focus(); // Popover 닫힐 때 트리거 버튼으로 포커스 이동
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef} // ref 연결
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedMember.profile_image_url ?? undefined} alt={selectedMember.name} />
                <AvatarFallback>{selectedMember.name?.[0]}</AvatarFallback>
              </Avatar>
              {selectedMember.name}
            </div>
          ) : "회원 선택"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput
            placeholder="회원 이름 또는 전화번호 검색..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {/* 스토어의 로딩 및 오류 상태 사용 */}
            {isLoadingMembers && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> 로딩 중...
              </div>
            )}
            {!isLoadingMembers && memberError && (
              <div className="p-4 text-center text-sm text-destructive">{memberError}</div>
            )}
            {/* 필터링된 목록 사용 */}
            {!isLoadingMembers && !memberError && filteredMemberList.length === 0 && (
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            )}
            {!isLoadingMembers && !memberError && filteredMemberList.length > 0 && (
              <CommandGroup>
                {filteredMemberList.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={member.id} // 고유 ID 사용
                    onSelect={(currentValue) => {
                      onSelectMember(currentValue === selectedMemberId ? null : currentValue);
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedMemberId === member.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Avatar className="mr-2 h-5 w-5">
                       <AvatarImage src={member.profile_image_url ?? undefined} alt={member.name} />
                       <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MemberSelector;