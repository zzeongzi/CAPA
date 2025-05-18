import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox"; // 나의 회원 추가 기능에 필요
import {
  Search,
  Filter,
  MoreHorizontal,
  UserPlus,
  MessageSquare,
  Calendar,
  FileText,
  Trash2,
  Loader2,
  Dumbbell,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  // LayoutGrid, // 열 변경 버튼 제거
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMembers, Member } from "@/hooks/use-members";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import { EditPTSessionsModal } from "@/components/features/EditPTSessionsModal";
import { ko } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
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
import { Database } from '@/integrations/supabase/types';

// MembersPage.tsx에서 가져온 MemberListItem 컴포넌트 (모바일용으로 수정 가능)
interface MemberListItemProps {
  member: Member;
  onOpenEditModal: (member: Member) => void;
  onOpenDeleteDialog: (member: Member) => void;
  // onAddMyMember?: (member: Member) => void;
  // isCheckboxMode?: boolean;
  // isSelected?: boolean;
  // onSelectMember?: (memberId: string) => void;
  // onLongPress?: (memberId: string) => void;
  // isMyMemberView?: boolean;
  // handleRemoveMyMember?: (memberId: string) => void;
}

const MemberListItem = ({
  member,
  onOpenEditModal,
  onOpenDeleteDialog,
  // isMyMemberView = false, // 제거
  // handleRemoveMyMember, // 제거
}: MemberListItemProps): React.ReactElement => {
  const navigate = useNavigate();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSendMessageClick = async () => {
    if (!user) { toast({ title: "오류", description: "로그인이 필요합니다.", variant: "destructive" }); return; }
    setIsCreatingChat(true);
    try {
      const { data: existingChat, error: fetchError } = await supabase.from('chat_rooms').select('id').or(`participant1.eq.${user.id},participant2.eq.${user.id}`).or(`participant1.eq.${member.id},participant2.eq.${member.id}`).limit(1).maybeSingle();
      if (fetchError) { throw fetchError; }
      if (existingChat) {
        navigate(`/chat/${existingChat.id}`);
      } else {
        const { data: newChat, error: createError } = await supabase.from('chat_rooms').insert({ participant1: user.id, participant2: member.id } as Database['public']['Tables']['chat_rooms']['Insert']).select('id').single();
        if (createError) throw createError;
        if (!newChat) throw new Error("채팅방 생성에 실패했습니다.");
        navigate(`/chat/${newChat.id}`);
      }
    } catch (error: any) {
      console.error("Error handling chat:", error);
      toast({ title: "오류", description: `채팅방 처리 중 오류가 발생했습니다: ${error.message}`, variant: "destructive" });
    } finally { setIsCreatingChat(false); }
  };

  return (
    <Card className={`relative transition-colors duration-150 hover:bg-muted/50 h-full ${member.remainingSessions === 0 ? 'card-border-red' : member.remainingSessions != null && member.remainingSessions <= 5 ? 'card-pulse-orange' : ''}`}>
      {/* isMyMemberView 및 handleRemoveMyMember 관련 UI 제거하고 항상 DropdownMenu 표시 */}
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0"> <span className="sr-only">메뉴 열기</span> <MoreHorizontal className="h-4 w-4" /> </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendMessageClick(); }} disabled={isCreatingChat}> {isCreatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />} 메시지 보내기 </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/schedule/${member.id}`); }}> <Calendar className="mr-2 h-4 w-4" /> 일정 보기 </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenEditModal(member); }}> <Dumbbell className="mr-2 h-4 w-4" /> 신규 및 재등록 </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/profile/${member.id}`); }}> <FileText className="mr-2 h-4 w-4" /> 상세 프로필 </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onOpenDeleteDialog(member); }}> <Trash2 className="mr-2 h-4 w-4" /> 회원 삭제 </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 pt-4 px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <Avatar className="h-10 w-10 flex-shrink-0"> <AvatarImage src={member.avatarUrl} alt={member.name} /> <AvatarFallback>{member.initials}</AvatarFallback> </Avatar>
          <div className="flex-grow overflow-hidden"> <CardTitle className="text-lg font-semibold truncate">{member.name}</CardTitle> <p className="text-xs text-muted-foreground whitespace-nowrap">{member.phone || '-'}</p> </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <div className="flex items-center justify-between text-sm"> <span className="text-muted-foreground">상태</span> {member.status === 'active' ? ( <CheckCircle2 className="h-4 w-4 text-green-600" /> ) : ( <XCircle className="h-4 w-4 text-destructive" /> )} </div>
        <div className="flex items-center justify-between text-sm"> <span className="text-muted-foreground">남은 PT</span> {(member.remainingSessions != null && member.totalSessions != null) ? ( <Badge variant="outline" className={`whitespace-nowrap ${member.remainingSessions === 0 ? 'card-border-red' : member.remainingSessions != null && member.remainingSessions <= 5 ? 'card-pulse-orange' : ''}`}> {member.remainingSessions} / {member.totalSessions} </Badge> ) : <span className="text-muted-foreground">-</span>} </div>
        <div className="flex items-center justify-between text-sm"> <span className="text-muted-foreground">최근 세션</span> <span className="text-muted-foreground"> {member.lastSession ? format(new Date(member.lastSession), 'yyyy.MM.dd (eee) HH:mm', { locale: ko }) : '-'} </span> </div>
      </CardContent>
    </Card>
  );
};


const MembersPageMobile = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  // const [myMembers, setMyMembers] = useState<Member[]>([]); // "나의 회원" 관련 상태 제거
  const { members, isLoading, refetchMembers, removeMemberLocally } = useMembers();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [filterCriteria, setFilterCriteria] = useState<{ status: 'all' | 'active' | 'inactive'; plan: 'all' | string }>({ status: 'all', plan: 'all' });
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'allMembers'>('allMembers'); // 기본 "allMembers"
  // const [myMembersSearchQuery, setMyMembersSearchQuery] = useState(""); // "나의 회원" 관련 상태 제거
  // const [myMembersActiveTab, setMyMembersActiveTab] = useState("active"); // "나의 회원" 관련 상태 제거
  // const [myMembersFilterCriteria, setMyMembersFilterCriteria] = useState<{ status: 'all' | 'active' | 'inactive'; plan: 'all' | string }>({ status: 'all', plan: 'all' }); // "나의 회원" 관련 상태 제거

  // 모바일에서는 정렬 기능 단순화 또는 제거 가능 (우선 유지)
  const [sortConfig, setSortConfig] = useState<{ key: keyof Member | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  // const [myMembersSortConfig, setMyMembersSortConfig] = useState<{ key: keyof Member | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' }); // "나의 회원" 관련 상태 제거


  // "나의 회원" 관련 useEffect 제거

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch = searchQuery === '' || member.name.toLowerCase().includes(searchQuery.toLowerCase()) || (member.phone && member.phone.includes(searchQuery));
      const matchesTab = activeTab === "all" || (activeTab === "active" && member.status === "active") || (activeTab === "inactive" && member.status === "inactive");
      const matchesStatusFilter = filterCriteria.status === 'all' || member.status === filterCriteria.status;
      const matchesPlanFilter = filterCriteria.plan === 'all' || (member.plan && member.plan === filterCriteria.plan);
      return matchesSearch && matchesTab && matchesStatusFilter && matchesPlanFilter;
    });
  }, [members, searchQuery, activeTab, filterCriteria]);

  const sortedMembers = useMemo(() => {
    let sortableMembers = [...filteredMembers];
    // 모바일에서는 정렬 UI를 제공하지 않으므로, 기본 정렬(이름순)만 적용하거나 제거 가능
    // 우선 기존 정렬 로직 유지
    if (sortConfig.key !== null) {
      sortableMembers.sort((a, b) => {
        const aValue = a[sortConfig.key!]; const bValue = b[sortConfig.key!];
        if (aValue == null && bValue == null) return 0; if (aValue == null) return 1; if (bValue == null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') { const comp = aValue.localeCompare(bValue, 'ko'); return sortConfig.direction === 'ascending' ? comp : -comp; }
        else if (typeof aValue === 'number' && typeof bValue === 'number') { return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue; }
        else { if (String(aValue) < String(bValue)) return sortConfig.direction === 'ascending' ? -1 : 1; if (String(aValue) > String(bValue)) return sortConfig.direction === 'ascending' ? 1 : -1; return 0;}
      });
    }
    return sortableMembers;
  }, [filteredMembers, sortConfig]);

  // "나의 회원" 관련 sortedMyMembers 제거

  const allMembersCounts = useMemo(() => {
    const baseFiltered = members.filter((member) => {
       const matchesSearch = searchQuery === '' || member.name.toLowerCase().includes(searchQuery.toLowerCase()) || (member.phone && member.phone.includes(searchQuery));
       const matchesStatusFilter = filterCriteria.status === 'all' || member.status === filterCriteria.status;
       const matchesPlanFilter = filterCriteria.plan === 'all' || (member.plan && member.plan === filterCriteria.plan);
       return matchesSearch && matchesStatusFilter && matchesPlanFilter;
     });
    return { total: baseFiltered.length, active: baseFiltered.filter(m => m.status === 'active').length, inactive: baseFiltered.filter(m => m.status === 'inactive').length };
  }, [members, searchQuery, filterCriteria]);

  // "나의 회원" 관련 myMembersCounts 제거

  const handleRegisterNewMember = () => { navigate("/members/new"); };
  const handleOpenEditModal = (member: Member) => { setEditingMember(member); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingMember(null); };
  const handleUpdateSuccess = () => { refetchMembers(); toast({ title: "성공", description: "PT 횟수가 업데이트되었습니다." }); };
  const handleOpenDeleteDialog = (member: Member) => { setDeletingMember(member); setIsDeleteDialogOpen(true); };

  // "나의 회원" 관련 handleRemoveMyMember 제거

  const handleDeleteConfirm = async () => {
    if (!deletingMember) return;
    const userIdToDelete = deletingMember.id;
    setIsDeleting(true);
    toast({ title: "삭제 중...", description: `${deletingMember.name} 회원 정보를 삭제하고 있습니다.` });
    try {
      const { data, error: functionError } = await supabase.functions.invoke('delete-user', { body: { userIdToDelete } });
      if (functionError) { throw new Error(functionError.message || "회원 삭제 함수 호출 중 오류가 발생했습니다."); }
      if (data?.error) { throw new Error(data.error.message || "회원 삭제 중 함수 내부 오류가 발생했습니다."); }
      toast({ title: "성공", description: `${deletingMember.name} 회원이 성공적으로 삭제되었습니다.`});
      removeMemberLocally(userIdToDelete); setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({ title: "오류 발생", description: `회원 삭제 중 문제가 발생했습니다: ${error.message}`, variant: "destructive" });
    } finally { setIsDeleting(false); setDeletingMember(null); }
  };

  // 모바일에서는 항상 1열
  const gridColsClass = "grid-cols-1";

  return (
    <AppLayout>
      <div className="space-y-4 p-4 animate-fade-in"> {/* 모바일 패딩 조정 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">회원 관리</h1> {/* 모바일 폰트 크기 조정 */}
          <Button size="sm" className="bg-premium-gradient hover:opacity-90" onClick={handleRegisterNewMember}>
            <UserPlus className="h-4 w-4 mr-1 sm:mr-2" /> {/* 아이콘 마진 조정 */}
            <span className="hidden sm:inline">새 회원 등록</span> {/* 모바일에서 텍스트 숨김 */}
            <span className="sm:hidden">등록</span>
          </Button>
        </div>

        <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'allMembers')} className="w-full">
          {/* <TabsList className="grid w-full grid-cols-2 mb-4"> // "나의 회원" 탭 제거
            <TabsTrigger value="allMembers">전체 회원</TabsTrigger>
            <TabsTrigger value="myMembers">나의 회원</TabsTrigger>
          </TabsList> */}

          {/* 전체 회원 탭 */}
          <TabsContent value="allMembers">
            <Card className="shadow-none border-0 sm:border sm:shadow-sm"> {/* 모바일에서 그림자, 테두리 제거 */}
              <CardHeader className="p-0 sm:p-6 sm:pb-2"> {/* 모바일 패딩 조정 */}
                <div className="flex flex-col gap-2 mb-2 sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg sm:text-xl">전체 회원 목록</CardTitle>
                  {/* 컨트롤 영역: 모바일에서는 검색창과 필터 버튼만, 한 줄에 */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-grow">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input placeholder="이름, 전화번호 검색..." className="pl-8 w-full h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="flex-shrink-0 h-9 w-9"> <Filter className="h-4 w-4" /> </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[280px] sm:w-[400px]"> {/* 모바일 시트 너비 조정 */}
                        <SheetHeader><SheetTitle>필터</SheetTitle></SheetHeader>
                        {/* 필터 내용 동일 */}
                        <div className="py-4 space-y-4">
                          <div>
                            <h3 className="text-sm font-medium mb-2">상태</h3>
                            <ToggleGroup type="single" value={filterCriteria.status} onValueChange={(value) => { if (value) setFilterCriteria(prev => ({ ...prev, status: value as 'all' | 'active' | 'inactive' })); }} className="grid grid-cols-3 gap-2">
                              <ToggleGroupItem value="all" className="flex-1">전체</ToggleGroupItem>
                              <ToggleGroupItem value="active" className="flex-1">활성</ToggleGroupItem>
                              <ToggleGroupItem value="inactive" className="flex-1">비활성</ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium mb-2">플랜</h3>
                            <ToggleGroup type="single" value={filterCriteria.plan} onValueChange={(value) => { if (value) setFilterCriteria(prev => ({ ...prev, plan: value })); }} className="grid grid-cols-3 gap-2">
                              <ToggleGroupItem value="all" className="flex-1">전체</ToggleGroupItem>
                              <ToggleGroupItem value="Standard" className="flex-1">Standard</ToggleGroupItem>
                              <ToggleGroupItem value="Premium" className="flex-1">Premium</ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          <SheetClose asChild><Button className="w-full mt-4">적용</Button></SheetClose>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="all">전체 {allMembersCounts.total}</TabsTrigger>
                    <TabsTrigger value="active">활성 {allMembersCounts.active}</TabsTrigger>
                    <TabsTrigger value="inactive">비활성 {allMembersCounts.inactive}</TabsTrigger>
                  </TabsList>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
                  ) : sortedMembers.length > 0 ? (
                    (<div className={`grid gap-4 py-1 ${gridColsClass}`}>
                      {sortedMembers.map((member) => (
                        <div key={member.id} className="h-auto">
                          <MemberListItem member={member} onOpenEditModal={handleOpenEditModal} onOpenDeleteDialog={handleOpenDeleteDialog} />
                        </div>
                      ))}
                    </div>)
                  ) : (
                    (<div className="flex flex-col items-center justify-center py-10 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground"> {searchQuery ? `"${searchQuery}"에 대한 검색 결과가 없습니다.` : "표시할 회원이 없습니다."} </p>
                      {!searchQuery && ( <Button variant="outline" onClick={handleRegisterNewMember} className="mt-4"> <UserPlus className="mr-2 h-4 w-4" /> 새 회원 등록하기 </Button> )}
                    </div>)
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* "나의 회원" TabsContent 제거 */}
        </Tabs>

        <EditPTSessionsModal isOpen={isModalOpen} onClose={handleCloseModal} member={editingMember} onUpdateSuccess={handleUpdateSuccess} />
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>회원 삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 '{deletingMember?.name}' 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다. 관련된 모든 데이터(프로필, 회원권, 세션 기록 등)가 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingMember(null)} disabled={isDeleting}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default MembersPageMobile;