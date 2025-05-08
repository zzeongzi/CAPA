import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'; // Supabase client
import { useAuth } from '@/contexts/AuthContext'; // Auth context
import { useMembers, Member } from '@/hooks/use-members'; // useMembers 훅 사용

interface SelectUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSelect: (member: Member) => void;
}

export const SelectUserModal: React.FC<SelectUserModalProps> = ({
  isOpen,
  onClose,
  onUserSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { members: allMembers, isLoading: isLoadingMembers } = useMembers(); // 전체 회원 목록 및 로딩 상태
  const { user: currentUser } = useAuth(); // 현재 사용자 정보
  const [myMemberPks, setMyMemberPks] = useState<Set<string>>(new Set()); // 나의 회원 PK Set (members.id)
  const [isLoadingMyMembers, setIsLoadingMyMembers] = useState(false); // 나의 회원 로딩 상태

  // 나의 회원 PK 목록 로드
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const fetchMyMemberPks = async () => { // 함수명 변경
      setIsLoadingMyMembers(true);
      try {
        const { data, error } = await supabase
          .from('my_trainer_members')
          .select('member_id') // member_id는 members 테이블의 PK임
          .eq('trainer_id', currentUser.id);

        if (error) throw error;

        setMyMemberPks(new Set(data.map(item => item.member_id))); // setMyMemberPks 사용
      } catch (error) {
        console.error("Error fetching my member PKs:", error); // 로그 메시지 변경
        setMyMemberPks(new Set()); // 오류 시 초기화
      } finally {
        setIsLoadingMyMembers(false);
      }
    };

    fetchMyMemberPks(); // 함수명 변경
  }, [isOpen, currentUser]);

  // 활성 상태인 나의 회원 목록 필터링
  const myActiveMembers = useMemo(() => {
    if (isLoadingMembers || isLoadingMyMembers) return []; // 로딩 중이면 빈 배열
    // member.id (auth.users.id) 대신 member.memberPk (members.id)와 비교
    return allMembers.filter(member =>
      myMemberPks.has(member.memberPk) && member.status === 'active'
    );
  }, [allMembers, myMemberPks, isLoadingMembers, isLoadingMyMembers]); // myMemberIds -> myMemberPks

  // 검색 필터링 (활성 상태인 나의 회원 목록 기준)
  const filteredMembers = useMemo(() => {
    if (!searchQuery) {
      return myActiveMembers; // 검색어 없으면 전체 반환
    }
    return myActiveMembers.filter((member) => {
      const name = member.name.toLowerCase();
      const phone = member.phone || '';
      return name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
    });
  }, [myActiveMembers, searchQuery]);

  const handleSelect = (member: Member) => {
    onUserSelect(member);
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const isLoading = isLoadingMembers || isLoadingMyMembers; // 통합 로딩 상태

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* onOpenAutoFocus 이벤트 핸들러 추가 */}
      <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>회원 선택 (활성 상태)</DialogTitle> {/* 타이틀 변경 */}
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="이름 또는 전화번호 검색..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredMembers.length > 0 ? (
              <div className="p-2 grid grid-cols-1 gap-2">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-md cursor-pointer hover:bg-accent border"
                    onClick={() => handleSelect(member)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatarUrl ?? undefined} />
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.phone || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center h-full text-muted-foreground">
                {searchQuery ? '검색 결과가 없습니다.' : '활성 상태인 나의 회원이 없습니다.'}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};