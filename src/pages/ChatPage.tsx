import React, { useState, useEffect, useMemo, useCallback } from "react"; // useCallback 추가
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Loader2, Users, LogOut } from "lucide-react"; // LogOut 추가
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChatInterface } from "@/components/features/ChatInterface";
import { SelectUserModal } from "@/components/features/SelectUserModal";
import { useToast } from "@/components/ui/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // AlertDialog 추가

// Supabase profiles 테이블 타입
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

// Supabase chat_participants 테이블 타입
interface ChatParticipant {
  room_id: string;
  user_id: string;
  created_at: string;
}

// Supabase chat_rooms 테이블 타입
interface ChatRoom {
  id: string;
  created_at: string;
}

// Supabase chat_messages 테이블 타입
interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

// 채팅 목록 연락처 타입
interface ChatContact {
  id: string; // room_id
  name: string;
  avatarUrl?: string | null;
  initials: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageTimestamp?: string;
  unreadCount: number;
  online: boolean;
  otherUserId?: string;
}

const ChatPage = () => {
  const { user } = useAuth();
  const { roomId: roomIdFromParams } = useParams<{ roomId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(location.state?.selectedRoomId ?? roomIdFromParams ?? null);
  const [activeTab, setActiveTab] = useState("all");
  const [isSelectUserModalOpen, setIsSelectUserModalOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false); // 나가기 확인 모달 상태
  const [leavingChatId, setLeavingChatId] = useState<string | null>(null); // 삭제 대상 채팅방 ID
  const [isLeavingChat, setIsLeavingChat] = useState(false); // 나가기 진행 상태

  // 채팅 목록 조회 함수
  const fetchChatList = useCallback(async () => { // useCallback 추가
    if (!user) return;
    // setIsLoading(true); // 로딩 상태는 초기 로드 시에만 설정
    console.log('[ChatPage] Starting fetchChatList...');
    try {
      const { data: participantData, error: participantError } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;
      const roomIds = (participantData as any[])?.map(p => p.room_id) ?? [];
      console.log('[ChatPage] Fetched room IDs:', roomIds);

      if (roomIds.length === 0) {
        console.log('[ChatPage] No rooms found for user.');
        setContacts([]);
        // setIsLoading(false); // finally에서 처리
        return;
      }

      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`id, created_at`)
        .in('id', roomIds)
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;
      console.log('[ChatPage] Fetched rooms data:', roomsData);
      if (!roomsData) {
        setContacts([]);
        // setIsLoading(false); // finally에서 처리
        return;
      }

      const otherUserIds = (await Promise.all(roomsData.map(async (room) => {
        const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
          'get_other_participant_id',
          { p_room_id: room.id, p_user_id: user.id }
        );
        const otherUserId = rpcResult as string;
        if (rpcError || !otherUserId) {
          console.error(`Error fetching other participant for room ${room.id}:`, rpcError);
          return null;
        }
        return otherUserId;
      }))).filter(Boolean) as string[];

      const uniqueParticipantIds = [...new Set(otherUserIds)];
      console.log('[ChatPage] Unique other participant IDs:', uniqueParticipantIds);

      let profilesMap: { [key: string]: Profile } = {};
      if (uniqueParticipantIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', uniqueParticipantIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else if (profilesData) {
          console.log('[ChatPage] Fetched profiles data:', profilesData);
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile as Profile;
            return acc;
          }, {} as { [key: string]: Profile });
        }
      }

      const chatListPromises = roomsData.map(async (room) => {
         const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
          'get_other_participant_id',
          { p_room_id: room.id, p_user_id: user.id }
        );
        const otherUserId = rpcResult as string;

        if (rpcError || !otherUserId) return null;

        const otherProfile = profilesMap[otherUserId];
        console.log(`[ChatPage] Found other profile for room ${room.id}:`, otherProfile);

        const { data: lastMessageData, error: lastMessageError } = await supabase
          .from('chat_messages')
          .select('content, created_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMessageError) console.error("Error fetching last message for room", room.id, lastMessageError);

        // 안 읽은 메시지 수 계산 로직 수정 (RPC 함수 호출 + 타입 단언)
        const { data: unreadCountData, error: rpcCountError } = await (supabase.rpc as any)( // 타입 단언 추가
          'get_unread_message_count',
          { p_room_id: room.id, p_user_id: user.id }
        );

        if (rpcCountError) {
          console.error(`Error calling get_unread_message_count RPC for room ${room.id}:`, rpcCountError);
        }
        const unreadCount = unreadCountData ?? 0;

        return {
          id: room.id,
          name: otherProfile ? `${otherProfile.first_name || ''} ${otherProfile.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User',
          avatarUrl: otherProfile?.avatar_url,
          initials: otherProfile ? `${(otherProfile.first_name || '').charAt(0)}${(otherProfile.last_name || '').charAt(0)}`.toUpperCase() || 'U' : 'U',
          lastMessage: lastMessageData?.content,
          lastMessageTime: lastMessageData?.created_at
            ? new Date(lastMessageData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined,
          lastMessageTimestamp: lastMessageData?.created_at,
          unreadCount: unreadCount,
          online: false, // TODO: Presence 구현
          otherUserId: otherUserId
        };
      });

      const resolvedChatList = (await Promise.all(chatListPromises)).filter(Boolean) as ChatContact[];
      resolvedChatList.sort((a, b) => {
        const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
        const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
        return timeB - timeA;
      });

      console.log('[ChatPage] Sorted chat list:', resolvedChatList);
      setContacts(resolvedChatList);

      if (location.state?.selectedRoomId && location.state.selectedRoomId !== selectedChatId) {
        setSelectedChatId(location.state.selectedRoomId);
        navigate(location.pathname, { replace: true, state: {} });
      }
      // 초기 선택 로직 제거 (최근 대화 목록 표시)
      // else if (!selectedChatId && resolvedChatList.length > 0) {
      //   setSelectedChatId(resolvedChatList[0].id);
      // }

    } catch (error) {
      console.error("Error fetching chat list:", error);
      toast({
        title: "오류",
        description: "채팅 목록을 불러오는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false); // 로딩 상태 해제
      console.log('[ChatPage] fetchChatList finished.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast, navigate, location.pathname, location.state, selectedChatId]); // selectedChatId 의존성 추가

  useEffect(() => {
    fetchChatList();
  }, [fetchChatList]); // fetchChatList를 의존성 배열에 추가

   useEffect(() => {
    const stateRoomId = location.state?.selectedRoomId;
    if (stateRoomId && stateRoomId !== selectedChatId) {
      setSelectedChatId(stateRoomId);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (roomIdFromParams && roomIdFromParams !== selectedChatId) {
      setSelectedChatId(roomIdFromParams);
    }
  }, [roomIdFromParams, location.state, selectedChatId, navigate]);


  // 실시간 구독 (참여자 변경 시 목록 갱신)
  useEffect(() => {
    if (!user) return;

    const participantChannel = supabase.channel('public:chat_participants:user_id=eq.' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${user.id}` }, (payload) => {
        console.log('Chat participant change received!', payload);
        fetchChatList();
      }).subscribe();

    // 메시지 수신 시 목록 갱신 (마지막 메시지 업데이트 위해)
    const messageChannel = supabase.channel('public:chat_messages')
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
         const newMessage = payload.new as any;
         const isParticipant = contacts.some(contact => contact.id === newMessage.room_id);
         if (isParticipant) {
           console.log('New message received for list update!', payload);
           fetchChatList(); // 목록 갱신하여 마지막 메시지 업데이트
         }
       }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to chat message changes for list update!');
        }
      });

    return () => {
      supabase.removeChannel(participantChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user, contacts, fetchChatList]); // fetchChatList 의존성 추가

  // 검색 및 탭 필터링 로직
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch = contact.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "unread" && (contact.unreadCount ?? 0) > 0);

      return matchesSearch && matchesTab;
    });
  }, [contacts, searchQuery, activeTab]);

  // 안 읽은 메시지 총 개수 계산
  const totalUnreadCount = useMemo(() => {
    return contacts.reduce((acc, contact) => acc + (contact.unreadCount ?? 0), 0);
  }, [contacts]);

  // 새 메시지 모달에서 사용자 선택 시 처리
  const handleUserSelect = async (selectedUserId: string) => {
    if (!user || isCreatingChat) return;

    setIsCreatingChat(true);
    try {
      const { data: roomId, error: rpcError } = await supabase.rpc(
        'get_or_create_direct_chat_room',
        {
          user1_id: user.id,
          user2_id: selectedUserId,
        }
      );

      if (rpcError) throw rpcError;
      if (!roomId) throw new Error("채팅방 ID를 가져오지 못했습니다.");

      setSelectedChatId(roomId);
      fetchChatList(); // 채팅 목록 갱신
      setIsSelectUserModalOpen(false);
      setIsUserListOpen(false);

    } catch (error: any) {
      console.error("Error creating/navigating chat room:", error);
      toast({
        title: "오류",
        description: error.message || "채팅방을 처리하는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingChat(false);
    }
  };

  // 채팅방 나가기 성공 시 콜백 함수
  const handleLeaveChatSuccess = () => {
    setSelectedChatId(null);
    fetchChatList();
  };

  // 채팅방 나가기 확인 모달 열기
  const handleOpenLeaveDialog = (chatIdToLeave: string) => {
    setLeavingChatId(chatIdToLeave);
    setIsLeaveDialogOpen(true);
  };

  // 채팅방 나가기 최종 확인 및 실행
  const handleLeaveConfirm = async () => {
    if (!user || !leavingChatId || isLeavingChat) return;

    setIsLeavingChat(true);
    try {
      // @ts-ignore - RPC 함수 생성 및 타입 업데이트 전 임시 조치
      const { error } = await supabase.rpc('leave_chat_room', {
        p_room_id: leavingChatId,
        p_user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "성공",
        description: "채팅방에서 나갔습니다.",
      });

      // 로컬 상태 업데이트
      setContacts(prev => prev.filter(c => c.id !== leavingChatId));
      if (selectedChatId === leavingChatId) {
        setSelectedChatId(null); // 현재 보고 있는 채팅방이면 닫기
      }
      setLeavingChatId(null); // 대상 ID 초기화
      setIsLeaveDialogOpen(false); // 모달 닫기

    } catch (error: any) {
      console.error("Error leaving chat room:", error);
      toast({
        title: "오류",
        description: error.message || "채팅방을 나가는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLeavingChat(false);
    }
  };


  // 회원 목록 컴포넌트 (Sheet 내부 및 데스크탑용)
  const UserListContent = ({ isSheet = false }: { isSheet?: boolean }) => (
    <>
      <div className={`p-4 border-b ${isSheet ? '' : ''}`}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="이름 검색..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex justify-between items-center">
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="unread">
                안 읽음
                {totalUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {totalUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="group" disabled>그룹</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="divide-y">
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`p-4 hover:bg-accent/10 cursor-pointer transition-colors flex items-center gap-3 ${ // flex 추가
                    selectedChatId === contact.id ? "bg-accent/20" : ""
                  }`}
                  onClick={() => {
                    setSelectedChatId(contact.id);
                    if (isSheet) setIsUserListOpen(false);
                  }}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.name} />
                      <AvatarFallback>{contact.initials}</AvatarFallback>
                    </Avatar>
                    {/* {contact.online && ( ... )} */}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{contact.name}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {contact.lastMessageTime}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-sm text-muted-foreground truncate">
                        {contact.lastMessage}
                      </div>
                      {(contact.unreadCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="ml-2">{contact.unreadCount}</Badge>
                      )}
                    </div>
                  </div>
                  {/* 나가기 버튼 추가 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation(); // 부모 div의 onClick 방지
                      handleOpenLeaveDialog(contact.id);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">채팅방 나가기</span>
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                채팅 목록이 없습니다.
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className={`p-4 border-t ${isSheet ? '' : ''}`}>
        <Button
          className="w-full bg-premium-gradient hover:opacity-90"
          onClick={() => setIsSelectUserModalOpen(true)}
          disabled={isCreatingChat}
        >
          {isCreatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          새 메시지
        </Button>
      </div>
    </>
  );


  return (
    <AppLayout>
      <div className="animate-fade-in h-[calc(100vh-9rem)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          {/* 왼쪽: 채팅 목록 (데스크탑) */}
          <Card className="hidden md:flex md:col-span-1 glass-card overflow-hidden flex-col">
            <UserListContent />
          </Card>

          {/* 오른쪽: 채팅 인터페이스 또는 최근 대화 목록 */}
          <div className="col-span-1 md:col-span-2 h-full flex flex-col">
             {/* 모바일용 회원 목록 열기 버튼 */}
             <div className="md:hidden p-4 border-b flex justify-end">
                <Button variant="outline" size="icon" onClick={() => setIsUserListOpen(true)}>
                  <Users className="h-5 w-5" />
                  <span className="sr-only">회원 목록 열기</span>
                </Button>
              </div>

            <div className="flex-1 overflow-hidden">
              {selectedChatId ? (
                <ChatInterface
                  key={selectedChatId}
                  chatId={selectedChatId}
                  onLeaveSuccess={handleLeaveChatSuccess}
                  onMessagesRead={fetchChatList} // Add this line
                />
              ) : (
                // 초기 화면: 최근 채팅 목록 표시
                <Card className="glass-card h-full flex flex-col">
                  <CardHeader className="p-4 border-b"> {/* CardHeader 추가 */}
                    <CardTitle>최근 대화</CardTitle> {/* CardTitle 추가 */}
                  </CardHeader>
                  <ScrollArea className="flex-1">
                    {isLoading ? (
                       <div className="flex justify-center items-center h-full py-10">
                         <Loader2 className="h-8 w-8 animate-spin text-primary" />
                       </div>
                    ) : contacts.length > 0 ? (
                      <div className="divide-y">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-4 hover:bg-accent/10 cursor-pointer transition-colors flex items-center gap-3" // flex 추가
                            onClick={() => setSelectedChatId(contact.id)}
                          >
                            <Avatar>
                              <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.name} />
                              <AvatarFallback>{contact.initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{contact.name}</div>
                              {contact.lastMessage && (
                                 <p className="text-sm text-muted-foreground truncate mt-1">{contact.lastMessage}</p>
                              )}
                            </div>
                            {contact.lastMessageTime && (
                              <div className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                                {contact.lastMessageTime}
                              </div>
                            )}
                            {/* 나가기 버튼 추가 */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" // flex-shrink-0 추가
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLeaveDialog(contact.id);
                              }}
                            >
                              <LogOut className="h-4 w-4" />
                              <span className="sr-only">채팅방 나가기</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-muted-foreground">
                        <p>진행 중인 대화가 없습니다.</p>
                        <p className="mt-2">새 메시지를 보내 대화를 시작하세요.</p>
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 사용자 선택 모달 */}
      <SelectUserModal
        isOpen={isSelectUserModalOpen}
        onClose={() => setIsSelectUserModalOpen(false)}
        onUserSelect={handleUserSelect}
      />

      {/* 회원 목록 Sheet (모바일용) */}
      <Sheet open={isUserListOpen} onOpenChange={setIsUserListOpen}>
        <SheetContent side="left" className="p-0 flex flex-col w-full sm:max-w-xs">
           <SheetHeader className="p-4 border-b">
             <SheetTitle>회원 목록</SheetTitle>
           </SheetHeader>
           <div className="flex-1 flex flex-col overflow-hidden">
             <UserListContent isSheet={true} />
           </div>
        </SheetContent>
      </Sheet>

      {/* 채팅방 나가기 확인 모달 */}
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>채팅방 나가기 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 채팅방에서 나가시겠습니까? 나가면 대화 내용이 삭제되고 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeavingChatId(null)} disabled={isLeavingChat}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveConfirm}
              disabled={isLeavingChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeavingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ChatPage;
