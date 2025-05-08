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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
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
  LayoutGrid,
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

const MembersPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [myMembers, setMyMembers] = useState<Member[]>([]);
  const { members, isLoading, refetchMembers, removeMemberLocally } = useMembers();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Member | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  const [filterCriteria, setFilterCriteria] = useState<{ status: 'all' | 'active' | 'inactive'; plan: 'all' | string }>({ status: 'all', plan: 'all' });
  const [isCheckboxMode, setIsCheckboxMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [columnCount, setColumnCount] = useState<number>(1); // 초기값 1열 (모바일 우선)
  const [myMembersSortConfig, setMyMembersSortConfig] = useState<{ key: keyof Member | null; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  const [mainTab, setMainTab] = useState<'allMembers' | 'myMembers'>('myMembers');
  const [myMembersSearchQuery, setMyMembersSearchQuery] = useState("");
  const [myMembersActiveTab, setMyMembersActiveTab] = useState("active");
  const [myMembersFilterCriteria, setMyMembersFilterCriteria] = useState<{ status: 'all' | 'active' | 'inactive'; plan: 'all' | string }>({ status: 'all', plan: 'all' });

  // 화면 크기에 따라 초기 columnCount 설정 (PC에서는 4열 기본)
  useEffect(() => {
    const updateColumnCountBasedOnWindowSize = () => {
      if (window.innerWidth >= 1024) { // lg
        setColumnCount(4);
      } else if (window.innerWidth >= 768) { // md
        setColumnCount(3);
      } else if (window.innerWidth >= 640) { // sm
        setColumnCount(2);
      } else {
        setColumnCount(1); // 모바일
      }
    };
    updateColumnCountBasedOnWindowSize(); // 초기 로드 시 실행
    window.addEventListener('resize', updateColumnCountBasedOnWindowSize);
    return () => window.removeEventListener('resize', updateColumnCountBasedOnWindowSize);
  }, []);


  useEffect(() => {
    // console.log('[MembersPage] myMembers state updated:', myMembers);
  }, [myMembers]);

  useEffect(() => {
    const fetchMyMembers = async () => {
      if (!user) return;
      try {
        const { data: myMemberRelations, error: relationError } = await supabase
          .from('my_trainer_members')
          .select('member_id')
          .eq('trainer_id', user.id);

        if (relationError) throw relationError;

        const myMemberPks = new Set(myMemberRelations.map(rel => rel.member_id));
        const initialMyMembers = members.filter(member => myMemberPks.has(member.memberPk));
        setMyMembers(initialMyMembers);

      } catch (error: any) {
        console.error("Error fetching my members:", error);
        toast({
          title: "오류",
          description: "나의 회원 목록을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    if (user && !isLoading && members.length > 0) {
       fetchMyMembers();
    }
  }, [user, isLoading, members, toast]);


  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        searchQuery === '' ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.phone && member.phone.includes(searchQuery));
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "active" && member.status === "active") ||
        (activeTab === "inactive" && member.status === "inactive");
      const matchesStatusFilter =
        filterCriteria.status === 'all' || member.status === filterCriteria.status;
      const matchesPlanFilter =
        filterCriteria.plan === 'all' || (member.plan && member.plan === filterCriteria.plan);
      return matchesSearch && matchesTab && matchesStatusFilter && matchesPlanFilter;
    });
  }, [members, searchQuery, activeTab, filterCriteria]);

  const sortedMembers = useMemo(() => {
    let sortableMembers = [...filteredMembers];
    if (sortConfig.key !== null) {
      sortableMembers.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue, 'ko');
          return sortConfig.direction === 'ascending' ? comparison : -comparison;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        } else if ((sortConfig.key === 'lastSession' || sortConfig.key === 'nextSession') && typeof aValue === 'string' && typeof bValue === 'string') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          if (isNaN(dateA) && isNaN(dateB)) return 0;
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
        } else {
          if (String(aValue) < String(bValue)) { return sortConfig.direction === 'ascending' ? -1 : 1; }
          if (String(aValue) > String(bValue)) { return sortConfig.direction === 'ascending' ? 1 : -1; }
          return 0;
        }
      });
    }
    return sortableMembers;
  }, [filteredMembers, sortConfig]);

  const sortedMyMembers = useMemo(() => {
    const filtered = myMembers.filter((member) => {
      const matchesSearch =
        myMembersSearchQuery === '' ||
        member.name.toLowerCase().includes(myMembersSearchQuery.toLowerCase()) ||
        (member.phone && member.phone.includes(myMembersSearchQuery));
      const matchesTab =
        myMembersActiveTab === "all" ||
        (myMembersActiveTab === "active" && member.status === "active") ||
        (myMembersActiveTab === "inactive" && member.status === "inactive");
      const matchesStatusFilter =
        myMembersFilterCriteria.status === 'all' || member.status === myMembersFilterCriteria.status;
      const matchesPlanFilter =
        myMembersFilterCriteria.plan === 'all' || (member.plan && member.plan === myMembersFilterCriteria.plan);
      return matchesSearch && matchesTab && matchesStatusFilter && matchesPlanFilter;
    });
    let sortableMyMembers = [...filtered];
    if (myMembersSortConfig.key !== null) {
      sortableMyMembers.sort((a, b) => {
        const aValue = a[myMembersSortConfig.key!];
        const bValue = b[myMembersSortConfig.key!];
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue, 'ko');
          return myMembersSortConfig.direction === 'ascending' ? comparison : -comparison;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          return myMembersSortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        } else {
          if (String(aValue) < String(bValue)) return myMembersSortConfig.direction === 'ascending' ? -1 : 1;
          if (String(aValue) > String(bValue)) return myMembersSortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
      });
    }
    return sortableMyMembers;
  }, [myMembers, myMembersSearchQuery, myMembersActiveTab, myMembersFilterCriteria, myMembersSortConfig]);

  const allMembersCounts = useMemo(() => {
    const baseFiltered = members.filter((member) => {
       const matchesSearch =
         searchQuery === '' ||
         member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (member.phone && member.phone.includes(searchQuery));
       const matchesStatusFilter =
         filterCriteria.status === 'all' || member.status === filterCriteria.status;
       const matchesPlanFilter =
         filterCriteria.plan === 'all' || (member.plan && member.plan === filterCriteria.plan);
       return matchesSearch && matchesStatusFilter && matchesPlanFilter;
     });
    const active = baseFiltered.filter(m => m.status === 'active').length;
    const inactive = baseFiltered.filter(m => m.status === 'inactive').length;
    return { total: baseFiltered.length, active, inactive };
  }, [members, searchQuery, filterCriteria]);

  const filteredMyMembersBase = useMemo(() => {
     return myMembers.filter((member) => {
       const matchesSearch =
         myMembersSearchQuery === '' ||
         member.name.toLowerCase().includes(myMembersSearchQuery.toLowerCase()) ||
         (member.phone && member.phone.includes(myMembersSearchQuery));
       const matchesStatusFilter =
         myMembersFilterCriteria.status === 'all' || member.status === myMembersFilterCriteria.status;
       const matchesPlanFilter =
         myMembersFilterCriteria.plan === 'all' || (member.plan && member.plan === myMembersFilterCriteria.plan);
       return matchesSearch && matchesStatusFilter && matchesPlanFilter;
     });
  }, [myMembers, myMembersSearchQuery, myMembersFilterCriteria]);

  const myMembersCounts = useMemo(() => {
    const active = filteredMyMembersBase.filter(m => m.status === 'active').length;
    const inactive = filteredMyMembersBase.filter(m => m.status === 'inactive').length;
    return { total: filteredMyMembersBase.length, active, inactive };
  }, [filteredMyMembersBase]);

  const requestSort = (key: keyof Member) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const requestMyMembersSort = (key: keyof Member) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (myMembersSortConfig.key === key && myMembersSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setMyMembersSortConfig({ key, direction });
};

  const getSortIcon = (key: keyof Member) => {
    if (sortConfig.key !== key) { return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />; }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const getMyMembersSortIcon = (key: keyof Member) => {
    if (myMembersSortConfig.key !== key) { return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />; }
    return myMembersSortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

const handleAddMyMember = (member: Member) => {
    if (!myMembers.some(myMember => myMember.id === member.id)) {
      setMyMembers([...myMembers, member]);
    }
  };

  const handleToggleCheckboxMode = () => {
    setIsCheckboxMode(true);
    setSelectedMemberIds(new Set());
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      if (newSelectedIds.has(memberId)) { newSelectedIds.delete(memberId); } else { newSelectedIds.add(memberId); }
      return newSelectedIds;
    });
  };

  const handleSaveMyMembers = async () => {
    if (!user) return;
    const trainerId = user.id;
    const finalSelectedIds = new Set(selectedMemberIds);
    if (finalSelectedIds.size === 0) { setIsCheckboxMode(false); return; }
    const currentMyMemberIds = new Set(myMembers.map(m => m.id));
    const memberIdsToInsert: string[] = [];
    const alreadyExistingIds: string[] = [];
    finalSelectedIds.forEach(id => {
      if (currentMyMemberIds.has(id)) { alreadyExistingIds.push(id); } else { memberIdsToInsert.push(id); }
    });
    if (memberIdsToInsert.length === 0 && alreadyExistingIds.length > 0) {
      toast({ title: "알림", description: "선택한 회원은 모두 이미 나의 회원 목록에 있습니다." });
      setIsCheckboxMode(false); setSelectedMemberIds(new Set()); return;
    }
    try {
      if (memberIdsToInsert.length > 0) {
        const { data: memberPksData, error: pkError } = await supabase.from('members').select('id').in('user_id', memberIdsToInsert);
        if (pkError) throw pkError;
        const memberPksToInsert = memberPksData?.map(m => m.id) || [];
        const { data: existingRelations, error: checkError } = await supabase.from('my_trainer_members').select('member_id').eq('trainer_id', trainerId).in('member_id', memberPksToInsert);
        if (checkError) throw checkError;
        const existingMemberPks = new Set(existingRelations?.map(rel => rel.member_id) || []);
        const trulyNewMemberIds = memberIdsToInsert.filter(userId => {
            const memberInfo = members.find(m => m.id === userId);
            return memberInfo && !existingMemberPks.has(memberInfo.memberPk);
        });
        if (trulyNewMemberIds.length > 0) {
          const { data: existingMembers, error: memberCheckError } = await supabase.from('members').select('user_id').in('user_id', trulyNewMemberIds);
          if (memberCheckError) throw memberCheckError;
          const existingUserIdsInMembersTable = new Set(existingMembers?.map(m => m.user_id) || []);
          const finalUserIdsToInsert = trulyNewMemberIds.filter(id => existingUserIdsInMembersTable.has(id));
          if (finalUserIdsToInsert.length > 0) {
            const membersToInsertDetails = members.filter(m => finalUserIdsToInsert.includes(m.id));
            const insertData = membersToInsertDetails.map(memberDetail => ({ trainer_id: trainerId, member_id: memberDetail.memberPk }));
            const { error: insertError } = await supabase.from('my_trainer_members').insert(insertData);
            if (insertError) {
              if (insertError.code !== '23505') { throw insertError; } 
              else { console.warn("Insert failed with unique violation, likely due to concurrent request. Ignoring.", insertError); }
            }
             const newMembersToAdd = members.filter(member => finalUserIdsToInsert.includes(member.id));
             setMyMembers(prevMyMembers => [...prevMyMembers, ...newMembersToAdd]);
             toast({ title: "성공", description: `${finalUserIdsToInsert.length}명의 회원을 나의 회원 목록에 추가했습니다.` });
          } else {
             toast({ title: "알림", description: "선택한 회원 정보가 유효하지 않거나 이미 추가되었습니다.", variant: "destructive" });
          }
        } else if (alreadyExistingIds.length > 0) {
           toast({ title: "알림", description: "선택한 회원은 모두 이미 나의 회원 목록에 있습니다." });
        } else { console.warn("handleSaveMyMembers: No new members to insert, but reached insertion logic."); }
      } else if (alreadyExistingIds.length > 0) {
         toast({ title: "알림", description: "선택한 회원은 모두 이미 나의 회원 목록에 있습니다." });
      } else { console.warn("handleSaveMyMembers: No new members to insert, but reached insertion logic."); }
    } catch (error: any) {
      console.error("Error saving my members:", error);
      toast({ title: "오류", description: `나의 회원 저장 중 오류가 발생했습니다: ${error.message}`, variant: "destructive" });
    } finally { setIsCheckboxMode(false); setSelectedMemberIds(new Set()); }
  };

  const handleCancelCheckboxMode = () => { setIsCheckboxMode(false); setSelectedMemberIds(new Set()); };
  const handleLongPressMember = (memberId: string) => { if (!isCheckboxMode) { setIsCheckboxMode(true); setSelectedMemberIds(new Set([memberId])); } };
  const handleRemoveMyMember = async (memberId: string) => {
    if (!user) return;
    const trainerId = user.id;
    try {
      const { error } = await supabase.from('my_trainer_members').delete().match({ trainer_id: trainerId, member_id: memberId });
      if (error) throw error;
      setMyMembers(prevMyMembers => prevMyMembers.filter(member => member.id !== memberId));
      toast({ title: "성공", description: "나의 회원 목록에서 제거했습니다." });
    } catch (error: any) {
      console.error("Error removing my member:", error);
      toast({ title: "오류", description: `나의 회원 제거 중 오류가 발생했습니다: ${error.message}`, variant: "destructive" });
    }
  };
  const handleRegisterNewMember = () => { navigate("/members/new"); };
  const handleOpenEditModal = (member: Member) => { setEditingMember(member); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingMember(null); };
  const handleUpdateSuccess = () => { refetchMembers(); toast({ title: "성공", description: "PT 횟수가 업데이트되었습니다. 목록을 갱신합니다." }); };
  const handleOpenDeleteDialog = (member: Member) => { setDeletingMember(member); setIsDeleteDialogOpen(true); };
  const handleDeleteConfirm = async () => {
    if (!deletingMember) return;
    const userIdToDelete = deletingMember.id;
    setIsDeleting(true);
    toast({ title: "삭제 중...", description: `${deletingMember.name} 회원 정보를 삭제하고 있습니다.` });
    try {
      const { data, error: functionError } = await supabase.functions.invoke('delete-user', { body: { userIdToDelete } });
      if (functionError) { throw new Error(functionError.message || "회원 삭제 함수 호출 중 오류가 발생했습니다."); }
      if (data?.error) { throw new Error(data.error.message || "회원 삭제 중 함수 내부 오류가 발생했습니다."); }
      toast({ title: "성공", description: `${deletingMember.name} 회원이 성공적으로 삭제되었습니다.` });
      removeMemberLocally(userIdToDelete); setIsDeleteDialogOpen(false);
    } catch (error: any) {
      console.error("회원 삭제 오류:", error);
      toast({ title: "오류 발생", description: `회원 삭제 중 문제가 발생했습니다: ${error.message}`, variant: "destructive" });
    } finally { setIsDeleting(false); setDeletingMember(null); }
  };

  const getGridColsClass = () => {
    // 모바일에서는 columnCount 상태와 관계없이 항상 1열
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 'grid-cols-1';
    // sm 이상에서는 columnCount 상태에 따라 동적으로 클래스 반환
    switch (columnCount) {
      case 2: return 'sm:grid-cols-2';
      case 3: return 'sm:grid-cols-2 md:grid-cols-3';
      case 4: return 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      default: return 'grid-cols-1'; // 기본값 (혹은 columnCount가 1일 때)
    }
  };
  
  const handleSetColumnCount = () => {
    // 모바일에서는 열 개수 변경 버튼이 동작하지 않도록 (항상 1열 유지)
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setColumnCount(1); 
      return;
    }
    // 데스크톱/태블릿에서는 2, 3, 4열 순환
    setColumnCount(prev => (prev >= 4 ? 2 : prev + 1));
  };


  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">회원 관리</h1>
          <Button className="bg-premium-gradient hover:opacity-90" onClick={handleRegisterNewMember}>
            <UserPlus className="h-4 w-4 mr-2" /> 새 회원 등록
          </Button>
        </div>

        <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'allMembers' | 'myMembers')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="allMembers">전체 회원</TabsTrigger>
            <TabsTrigger value="myMembers">나의 회원</TabsTrigger>
          </TabsList>

          <TabsContent value="allMembers">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle>전체 회원 목록</CardTitle>
                  {/* 컨트롤 영역: 모바일에서는 수직, sm 이상에서는 수평으로 배치하고, 버튼들이 한 줄에 보이도록 수정 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 ml-auto">
                    {isCheckboxMode ? (
                      <>
                        <Button onClick={handleSaveMyMembers} className="w-full sm:w-auto">저장</Button>
                        <Button variant="outline" onClick={handleCancelCheckboxMode} className="w-full sm:w-auto">취소</Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={handleToggleCheckboxMode} className="w-full sm:w-auto">
                          <UserPlus className="mr-2 h-4 w-4" /> 나의 회원 추가
                        </Button>
                        <div className="relative flex-grow w-full sm:w-auto">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="이름, 전화번호 검색..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        {/* 열 선택 버튼과 필터 버튼을 한 줄에 배치 (모바일 포함) */}
                        <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={handleSetColumnCount}
                                className="flex-1 flex items-center justify-center px-2 sm:px-3"
                                aria-label={`현재 ${columnCount}열 보기, 클릭하여 변경`}
                            >
                                <span className="mr-1 sm:mr-2">{columnCount}열</span>
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="flex-shrink-0 px-2 sm:px-3">
                                <Filter className="h-4 w-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right">
                                <SheetHeader><SheetTitle>필터</SheetTitle></SheetHeader>
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
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="all">전체 {allMembersCounts.total}</TabsTrigger>
                    <TabsTrigger value="active">활성 {allMembersCounts.active}</TabsTrigger>
                    <TabsTrigger value="inactive">비활성 {allMembersCounts.inactive}</TabsTrigger>
                  </TabsList>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
                  ) : filteredMembers.length > 0 ? (
                    (<div className={`grid gap-4 py-1 ${getGridColsClass()}`}>
                      {sortedMembers.map((member) => (
                        <div key={member.id} className="h-auto">
                          <MemberListItem member={member} onOpenEditModal={handleOpenEditModal} onOpenDeleteDialog={handleOpenDeleteDialog} onAddMyMember={handleAddMyMember} isCheckboxMode={isCheckboxMode} isSelected={selectedMemberIds.has(member.id)} onSelectMember={handleSelectMember} onLongPress={handleLongPressMember} />
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

          <TabsContent value="myMembers">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle>나의 회원 목록</CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 ml-auto">
                    <div className="relative flex-grow w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input placeholder="이름, 전화번호 검색..." className="pl-10 w-full" value={myMembersSearchQuery} onChange={(e) => setMyMembersSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={handleSetColumnCount} className="flex-1 sm:flex-initial flex items-center justify-center px-2 sm:px-3" aria-label={`현재 ${columnCount}열 보기, 클릭하여 변경`}>
                            <span className="mr-1 sm:mr-2">{columnCount}열</span>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="flex-shrink-0 px-2 sm:px-3">
                            <Filter className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <SheetHeader><SheetTitle>필터</SheetTitle></SheetHeader>
                            <div className="py-4 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium mb-2">상태</h3>
                                <ToggleGroup type="single" value={myMembersFilterCriteria.status} onValueChange={(value) => { if (value) setMyMembersFilterCriteria(prev => ({ ...prev, status: value as 'all' | 'active' | 'inactive' })); }} className="grid grid-cols-3 gap-2">
                                <ToggleGroupItem value="all" className="flex-1">전체</ToggleGroupItem>
                                <ToggleGroupItem value="active" className="flex-1">활성</ToggleGroupItem>
                                <ToggleGroupItem value="inactive" className="flex-1">비활성</ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium mb-2">플랜</h3>
                                <ToggleGroup type="single" value={myMembersFilterCriteria.plan} onValueChange={(value) => { if (value) setMyMembersFilterCriteria(prev => ({ ...prev, plan: value })); }} className="grid grid-cols-3 gap-2">
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
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={myMembersActiveTab} onValueChange={setMyMembersActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="all">전체 {myMembersCounts.total}</TabsTrigger>
                    <TabsTrigger value="active">활성 {myMembersCounts.active}</TabsTrigger>
                    <TabsTrigger value="inactive">비활성 {myMembersCounts.inactive}</TabsTrigger>
                  </TabsList>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
                  ) : sortedMyMembers.length === 0 ? (
                    (<p className="text-muted-foreground text-center py-4">나의 회원이 없습니다.</p>)
                  ) : (
                    (<div className={`grid gap-4 py-1 ${getGridColsClass()}`}>
                      {sortedMyMembers.map(member => (
                        <MemberListItem key={`my-${member.id}`} member={member} onOpenEditModal={handleOpenEditModal} onOpenDeleteDialog={handleOpenDeleteDialog} handleRemoveMyMember={handleRemoveMyMember} isMyMemberView={true} onAddMyMember={() => {}} isCheckboxMode={false} isSelected={false} onSelectMember={() => {}} onLongPress={() => {}} />
                      ))}
                    </div>)
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
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

interface MemberListItemProps {
  member: Member;
  onOpenEditModal: (member: Member) => void;
  onOpenDeleteDialog: (member: Member) => void;
  onAddMyMember: (member: Member) => void;
  isCheckboxMode: boolean;
  isSelected: boolean;
  onSelectMember: (memberId: string) => void;
  onLongPress: (memberId: string) => void;
  isMyMemberView?: boolean;
  handleRemoveMyMember?: (memberId: string) => void;
}

const MemberListItem = ({
  member,
  onOpenEditModal,
  onOpenDeleteDialog,
  isCheckboxMode,
  isSelected,
  onSelectMember,
  onLongPress,
  isMyMemberView = false,
  handleRemoveMyMember,
}: MemberListItemProps): React.ReactElement => {
  const navigate = useNavigate();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

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

  const clearLongPressTimer = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    startPos.current = null;
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    clearLongPressTimer();
    startPos.current = { x: clientX, y: clientY };
    longPressTimer.current = setTimeout(() => { onLongPress(member.id); longPressTimer.current = null; }, 700);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!startPos.current) return;
    const deltaX = Math.abs(clientX - startPos.current.x);
    const deltaY = Math.abs(clientY - startPos.current.y);
    if (deltaX > 10 || deltaY > 10) { clearLongPressTimer(); }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) { clearLongPressTimer(); }
    startPos.current = null;
  };

  return (
    <Card
      className={`relative transition-colors duration-150 ${isCheckboxMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:bg-muted/50'} h-full ${member.remainingSessions === 0 ? 'card-border-red' : member.remainingSessions != null && member.remainingSessions <= 5 ? 'card-pulse-orange' : ''}`}
      onClick={() => { if (isCheckboxMode) { onSelectMember(member.id); } }}
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => handlePointerDown(e.clientX, e.clientY)}
      onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => handlePointerMove(e.clientX, e.clientY)}
      onPointerUp={handlePointerUp}
      onPointerLeave={clearLongPressTimer}
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => { e.preventDefault(); if (!isCheckboxMode) { onLongPress(member.id); } }}
    >
      {isCheckboxMode && (
        <div className="absolute top-2 right-2 z-10">
          <Checkbox checked={isSelected} onCheckedChange={() => { onSelectMember(member.id); }} onClick={(e) => e.stopPropagation()} className="h-5 w-5 bg-background border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
        </div>
      )}
      {isMyMemberView && handleRemoveMyMember ? (
         <div className="absolute top-2 right-2 z-10">
           <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRemoveMyMember(member.id); }} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 p-1 h-auto flex-shrink-0">
             <Trash2 className="h-4 w-4" /> <span className="sr-only">나의 회원에서 제거</span>
           </Button>
         </div>
      ) : !isCheckboxMode && (
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
      )}
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

export default MembersPage;
