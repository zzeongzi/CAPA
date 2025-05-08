import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"; // Card 관련 컴포넌트 추가
import { Send, Paperclip, Image, MoreVertical, PhoneCall, Video, Loader2, Download, Trash2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { Database, Json } from "@/integrations/supabase/types";
import { User } from "@supabase/supabase-js"; // Import User type

// 타입 정의
type Profile = Database['public']['Tables']['profiles']['Row'];
type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
type MessageReadStatus = Database['public']['Tables']['message_read_status']['Row'];

interface ChatMessageMetadata {
  file_name?: string;
  file_path?: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
}

interface ChatInterfaceProps {
  chatId: string;
  onLeaveSuccess?: () => void;
  onMessagesRead?: () => void;
}

interface OtherUserInfo {
  id: string;
  name: string;
  avatarUrl?: string | null;
  initials: string;
}

interface MessageWithSender extends ChatMessage {
  senderProfile?: Profile | null;
  unread_count?: number; // Represents the number of recipients who haven't read the message yet
  metadata: Json | null;
}

type NotificationType = string;
const getNotificationIcon = (type: NotificationType | null) => {
    return <span>Icon</span>;
};

function isChatMessageMetadata(metadata: any): metadata is ChatMessageMetadata {
  return metadata !== null && typeof metadata === 'object' && (
    'file_name' in metadata ||
    'file_path' in metadata ||
    'file_type' in metadata ||
    'file_size' in metadata
  );
}


export function ChatInterface({ chatId, onLeaveSuccess, onMessagesRead }: ChatInterfaceProps) {
  const { user, triggerNotificationRefresh, markNotificationAsRead } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, boolean>>({});
  const [otherUser, setOtherUser] = useState<OtherUserInfo | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [profilesMap, setProfilesMap] = useState<{ [key: string]: Profile }>({});
  const [isBlocked, setIsBlocked] = useState(false);

  // 상대방 정보 조회 함수
  const fetchOtherUserInfo = useCallback(async () => {
    if (!user || !chatId) return;
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'get_other_participant_id', { p_room_id: chatId, p_user_id: user.id }
      );
      const otherUserId = rpcResult as string;
      if (rpcError || !otherUserId) throw new Error("채팅 상대를 찾을 수 없습니다.");

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', otherUserId)
        .single();
      if (profileError || !profileData) throw new Error("상대방 프로필 정보를 찾을 수 없습니다.");

      const profile = profileData as Profile;
      setOtherUser({
        id: otherUserId,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User',
        avatarUrl: profile.avatar_url,
        initials: `${(profile.first_name || '').charAt(0)}${(profile.last_name || '').charAt(0)}`.toUpperCase() || 'U',
      });
      setProfilesMap(prev => ({ ...prev, [otherUserId]: profile }));
    } catch (error: any) {
      console.error("Failed to fetch other user info:", error);
      setOtherUser(null);
      toast({ title: "오류", description: error.message || "상대방 정보 로딩 실패", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatId]); // Removed toast

  // 메시지 목록 조회 함수 (Now accepts user and otherUser as arguments)
  const fetchMessages = useCallback(async (
    currentUser: User | null,
    currentOtherUser: OtherUserInfo | null,
    isSubscriptionRefetch = false // Keep this parameter
  ) => {
    console.log(`[ChatInterface] fetchMessages called ${isSubscriptionRefetch ? '(from subscription)' : ''} for user: ${currentUser?.id}, otherUser: ${currentOtherUser?.id}`); // Log 1
    if (!currentOtherUser?.id || !currentUser) {
        console.log("[ChatInterface] fetchMessages skipped: no currentOtherUser or currentUser");
        return;
    }
    // Set loading true only on initial load (when isLoading is true)
    if (isLoading) {
        // This check ensures we only set loading on the very first fetch or explicit reloads
    } else if (!isSubscriptionRefetch) {
        setIsLoading(true); // Set loading for non-subscription fetches after initial load
    }

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`*, message_read_status!left(user_id, read_at)`)
        .eq('room_id', chatId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      if (!messagesData) {
          console.log("[ChatInterface] No messages data found.");
          setMessages([]);
          if (!isSubscriptionRefetch || isLoading) setIsLoading(false); // Ensure loading is false if no data
          return;
      }

      const fetchedMessages = messagesData as (ChatMessage & { message_read_status: Pick<MessageReadStatus, 'user_id' | 'read_at'>[] | null })[];
      console.log(`[ChatInterface] Fetched ${fetchedMessages.length} messages.`); // Log 2

      // Fetch sender profiles if missing (using profilesMap state)
      const senderIds = [...new Set(fetchedMessages.map(msg => msg.sender_id))];
      let tempProfilesMap = { ...profilesMap }; // Use state profilesMap
      const missingProfileIds = senderIds.filter(id => !tempProfilesMap[id] && id !== currentUser.id);

      if (missingProfileIds.length > 0) {
        console.log("[ChatInterface] Fetching missing profiles:", missingProfileIds);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', missingProfileIds);
        if (profilesError) console.error("Error fetching sender profiles:", profilesError);
        else if (profilesData) {
          profilesData.forEach(profile => {
            tempProfilesMap[profile.id] = profile as Profile;
          });
          setProfilesMap(prev => ({ ...prev, ...tempProfilesMap })); // Update state
        }
      }
      // Ensure current user's profile is in the map
      if (!tempProfilesMap[currentUser.id] && currentUser.user_metadata) {
         const userProfile: Profile = {
            id: currentUser.id, first_name: currentUser.user_metadata.first_name || null, last_name: currentUser.user_metadata.last_name || null,
            avatar_url: currentUser.user_metadata.avatar_url || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            bio: null, birth_date: null, gender: null, phone_number: null,
         }
         tempProfilesMap[currentUser.id] = userProfile;
         setProfilesMap(prev => ({ ...prev, [currentUser.id]: userProfile })); // Update state
      }

      // Combine messages, profiles, calculate unread count, and generate signed URLs
      const combinedMessagesPromises = fetchedMessages.map(async (msg) => {
        const senderProfile = tempProfilesMap[msg.sender_id] || null;
        let fileUrl: string | undefined = undefined;
        let metadataTyped: ChatMessageMetadata | null = null;

        if (isChatMessageMetadata(msg.metadata)) {
          metadataTyped = msg.metadata;
          if (metadataTyped.file_path) {
            try {
              const { data, error } = await supabase.storage.from('chatattachments').createSignedUrl(metadataTyped.file_path, 3600);
              if (error) console.error(`Error creating signed URL for ${metadataTyped.file_path}:`, error);
              else fileUrl = data?.signedUrl;
            } catch (e) { console.error(`Exception creating signed URL for ${metadataTyped.file_path}:`, e); }
          }
        }

        // Calculate unread count based on fetched read statuses
        const unreadCount = msg.sender_id === currentUser.id // Use currentUser
          ? (msg.message_read_status?.filter(status => status.read_at === null).length ?? 0)
          : 0;
        // Log 3: Calculated unread count for each message
        // console.log(`[ChatInterface fetchMessages] Msg ID: ${msg.id}, Sender: ${msg.sender_id}, Calculated Unread: ${unreadCount}`);

        return {
          ...msg,
          senderProfile: senderProfile,
          metadata: metadataTyped ? { ...(metadataTyped as object), file_url: fileUrl } : msg.metadata,
          unread_count: unreadCount,
        };
      });

      const combinedMessages = await Promise.all(combinedMessagesPromises);
      const newMessagesState = [...combinedMessages] as MessageWithSender[]; // Ensure new array reference

      // Log 4: Compare previous and new state before setting
      setMessages(prevMessages => {
          console.log("[ChatInterface fetchMessages] Previous messages state:", prevMessages.map(m => ({ id: m.id, unread: m.unread_count })));
          console.log("[ChatInterface fetchMessages] New messages state:", newMessagesState.map(m => ({ id: m.id, unread: m.unread_count })));
          // Check if the state actually needs updating (optional optimization, but good for debugging)
          const stateChanged = JSON.stringify(prevMessages) !== JSON.stringify(newMessagesState);
          console.log("[ChatInterface fetchMessages] State changed:", stateChanged);
          return newMessagesState; // Always return the new array reference
      });

      if (!isSubscriptionRefetch) {
          scrollToBottom();
      }

    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({ title: "오류", description: "메시지를 불러오는 데 실패했습니다.", variant: "destructive" });
    } finally {
      // Set loading false only if it was true initially or not a subscription refetch
      if (isLoading || !isSubscriptionRefetch) setIsLoading(false);
      console.log("[ChatInterface] fetchMessages finished"); // Log 5
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, toast, isLoading]); // isLoading added back

  // Ref to hold the latest fetchMessages function to avoid stale closures in subscription
  // Moved AFTER fetchMessages definition
  const fetchMessagesRef = useRef(fetchMessages);

  // Update the ref whenever fetchMessages changes
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  // 메시지 전송 함수
  const handleSendMessage = async (contentOverride?: string, metadata?: ChatMessageMetadata) => {
    // ... (handleSendMessage implementation remains the same)
    const messageContent = contentOverride ?? newMessage;
    if (!messageContent.trim() || !user || isSending || isBlocked) return;
    setIsSending(true);
    if (!contentOverride) setNewMessage("");
    try {
      const messageData: Partial<ChatMessage> = {
        room_id: chatId, sender_id: user.id, content: messageContent, metadata: metadata ? (metadata as Json) : null,
      };
      const { error } = await supabase.from('chat_messages').insert(messageData as any);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({ title: "오류", description: "메시지 전송 실패", variant: "destructive" });
      if (!contentOverride) setNewMessage(messageContent);
    } finally { setIsSending(false); }
  };

  // 파일 업로드 및 메시지 전송 함수
  const handleFileUpload = async (file: File) => {
    // ... (handleFileUpload implementation remains the same)
     if (!user || isUploading || isBlocked) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${user.id}_${uuidv4()}.${fileExt}`;
      const filePath = `${chatId}/${uniqueFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('chatattachments').upload(filePath, file);
      if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`);
      const metadata: ChatMessageMetadata = {
        file_name: file.name, file_path: uploadData.path, file_type: file.type, file_size: file.size,
      };
      await handleSendMessage(`첨부파일: ${file.name}`, metadata);
      toast({ title: "성공", description: `${file.name} 파일을 전송했습니다.` });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({ title: "오류", description: error.message || "파일 처리 중 오류 발생", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // 파일 선택 핸들러
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... (onFileChange implementation remains the same)
     const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Enter 키 입력 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // ... (handleKeyDown implementation remains the same)
     if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // 스크롤 맨 아래로
  const scrollToBottom = () => {
    // ... (scrollToBottom implementation remains the same)
     setTimeout(() => {
       if (scrollAreaRef.current) {
         const scrollViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
         if (scrollViewport) scrollViewport.scrollTop = scrollViewport.scrollHeight;
       }
    }, 100);
  };

  // 채팅방 입장 시 읽음 처리
  useEffect(() => {
    if (chatId && user) {
      const markAsReadAsync = async () => {
        console.log(`[ChatInterface Mount/ID Change] Marking messages as read for room: ${chatId}`);
        // Don't set isLoading here, let fetchMessages handle it on initial load
        // setIsLoading(true); // Removed this
        try {
          const { error: markMessagesError } = await supabase.rpc('mark_chat_messages_as_read', { p_room_id: chatId, p_user_id: user.id });

          if (markMessagesError) {
             console.error("Error calling mark_chat_messages_as_read RPC:", markMessagesError);
          } else {
            console.log(`[ChatInterface Mount/ID Change] Successfully called mark_chat_messages_as_read for room: ${chatId}`);
            onMessagesRead?.();

            const { data: notificationIds, error: fetchNotificationError } = await supabase
              .from('notifications')
              .select('id, metadata')
              .eq('user_id', user.id)
              .eq('type', 'new_message')
              .eq('is_read', false);

            if (fetchNotificationError) {
              console.error("Error fetching related notification IDs:", fetchNotificationError);
            } else if (notificationIds && notificationIds.length > 0) {
              const relevantNotificationIds = notificationIds
                .filter(n => typeof n.metadata === 'object' && n.metadata !== null && 'roomId' in n.metadata && n.metadata.roomId === chatId)
                .map(n => n.id);

              if (relevantNotificationIds.length > 0) {
                console.log(`[ChatInterface Mount/ID Change] Marking ${relevantNotificationIds.length} notifications as read...`);
                await Promise.all(relevantNotificationIds.map(id => markNotificationAsRead(id)));
              } else {
                 console.log(`[ChatInterface Mount/ID Change] No relevant unread notifications found for room ${chatId}.`);
              }
            } else {
               console.log(`[ChatInterface Mount/ID Change] No unread 'new_message' notifications found.`);
            }
          }
          // Call fetchMessages using the ref with current user and otherUser state
          await fetchMessagesRef.current(user, otherUser, false);

        } catch (error) {
           console.error("Exception during markAsReadAsync:", error);
           await fetchMessagesRef.current(user, otherUser, false);
        }
        // No finally block needed here as fetchMessages handles its own loading state
      };
      markAsReadAsync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, user, onMessagesRead, markNotificationAsRead]); // Removed fetchMessages from here

  // 상대방 정보 로드
  useEffect(() => { fetchOtherUserInfo(); }, [fetchOtherUserInfo]);

  // otherUser 로드 후 메시지 로드
  useEffect(() => {
      if (otherUser?.id && user) { // Ensure user is also available
          fetchMessagesRef.current(user, otherUser, false); // Initial fetch using ref
      }
  }, [otherUser, user]); // Depend on user and otherUser

  // 실시간 구독 설정
  useEffect(() => {
    if (!chatId || !user) return;

    // 1. 메시지 INSERT 구독
    const messageChannel = supabase
      .channel(`chat-messages-${chatId}`)
      .on<ChatMessage>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${chatId}` },
        async (payload) => {
          // ... (INSERT handling logic remains the same, using user state)
          console.log('[Realtime Message CB] New message received:', payload);
          const newMessage = payload.new;
          let senderProfile = profilesMap[newMessage.sender_id];
          if (!senderProfile) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();
            if (!profileError && profileData) {
              senderProfile = profileData as Profile;
              setProfilesMap(prev => ({ ...prev, [newMessage.sender_id]: senderProfile }));
            } else {
              console.error("[Realtime Message CB] Error fetching sender profile:", profileError);
            }
          }
          const finalSenderProfile = profilesMap[newMessage.sender_id] || senderProfile;
          let fileUrl: string | undefined = undefined;
          let metadataTyped: ChatMessageMetadata | null = null;
          if (isChatMessageMetadata(newMessage.metadata)) {
            metadataTyped = newMessage.metadata;
            if (metadataTyped.file_path) {
              try {
                const { data, error } = await supabase.storage.from('chatattachments').createSignedUrl(metadataTyped.file_path, 3600);
                if (error) console.error(`[Realtime Message CB] Error creating signed URL:`, error);
                else fileUrl = data?.signedUrl;
              } catch (e) { console.error(`[Realtime Message CB] Exception creating signed URL:`, e); }
            }
          }
          const messageWithSender: MessageWithSender = {
            ...newMessage,
            senderProfile: finalSenderProfile,
            metadata: metadataTyped ? { ...(metadataTyped as object), file_url: fileUrl } : newMessage.metadata,
            unread_count: newMessage.sender_id === user.id ? 1 : 0
          };
          setMessages((prevMessages) => [...prevMessages, messageWithSender]);
          scrollToBottom();
          if (newMessage.sender_id !== user.id) {
            console.log(`[Realtime Message CB] Received message from other user, marking as read.`);
            try {
              const { error: markError } = await supabase.rpc('mark_chat_messages_as_read', { p_room_id: chatId, p_user_id: user.id });
              if (markError) {
                console.error("[Realtime Message CB] Error marking message as read via RPC:", markError);
              } else {
                 console.log(`[Realtime Message CB] Successfully marked received message as read.`);
                 onMessagesRead?.();
                 const { data: notificationIds, error: fetchNotifError } = await supabase
                   .from('notifications')
                   .select('id')
                   .eq('user_id', user.id)
                   .eq('type', 'new_message')
                   .eq('metadata->>roomId', chatId)
                   .eq('is_read', false);
                 if (!fetchNotifError && notificationIds && notificationIds.length > 0) {
                   await Promise.all(notificationIds.map(n => markNotificationAsRead(n.id)));
                 }
              }
            } catch (error) {
               console.error("[Realtime Message CB] Exception marking message/notification as read:", error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to messages for chat ${chatId}`);
        } else {
          console.log(`[Realtime] Message subscription status: ${status}`);
        }
      });

    // 2. 읽음 상태 구독 (Using fetchMessages ref)
    const readStatusChannel = supabase
      .channel(`read-status-${chatId}`)
      .on<MessageReadStatus>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_read_status', filter: `room_id=eq.${chatId}` },
        (payload) => {
          // Log 6: Read status change received
          console.log('[Realtime Read CB] Read status change received:', payload);
          // Use the ref to call the latest fetchMessages function
          // Pass the current user and otherUser state values from the outer scope
          // Pass true to indicate it's a subscription refetch
          fetchMessagesRef.current(user, otherUser, true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to read status updates for chat ${chatId}`);
        } else {
          console.log(`[Realtime] Read status subscription status: ${status}`);
        }
      });

    // Cleanup function
    return () => {
      console.log(`[Realtime] Unsubscribing from chat ${chatId}`);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(readStatusChannel);
    };
  // Dependencies: chatId, user, otherUser (for the ref call), onMessagesRead, markNotificationAsRead
  }, [chatId, user, otherUser, onMessagesRead, markNotificationAsRead]);

  // 파일 다운로드 핸들러
  const handleDownload = async (messageId: string, fileUrl?: string, fileName?: string) => {
    // ... (handleDownload implementation remains the same)
     if (!fileUrl || downloadingFiles[messageId]) return;
    setDownloadingFiles(prev => ({ ...prev, [messageId]: true }));
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName || 'download');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({ title: "다운로드 오류", description: error.message || "파일 다운로드 중 오류 발생", variant: "destructive" });
    } finally {
      setDownloadingFiles(prev => ({ ...prev, [messageId]: false }));
    }
  };

  // 메시지 삭제 핸들러
  const handleDeleteMessage = async (messageId: string) => {
    // ... (handleDeleteMessage implementation remains the same)
     if (!user) return;
    const confirmed = confirm("이 메시지를 삭제하시겠습니까?");
    if (confirmed) {
      try {
        const { error } = await supabase.from('chat_messages').delete().eq('id', messageId).eq('sender_id', user.id);
        if (error) throw new Error(error.message || "메시지 삭제 중 오류 발생");
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
        toast({ title: "성공", description: "메시지를 삭제했습니다." });
      } catch (error: any) {
        toast({ title: "오류", description: error.message || "메시지 삭제 중 오류 발생", variant: "destructive" });
      }
    }
  };

  // 사용자 차단/해제 핸들러 (생략)
  const handleBlockUser = async () => {
    // ... (handleBlockUser implementation remains the same)
     if (!user || !otherUser) return;
    const confirmed = confirm(`${otherUser.name}님을 차단하시겠습니까?`);
    if (confirmed) {
      console.log(`Blocking user ${otherUser.id}`);
      setIsBlocked(true);
      toast({ title: "성공", description: `${otherUser.name}님을 차단했습니다.` });
    }
  };
  const handleUnblockUser = async () => {
    // ... (handleUnblockUser implementation remains the same)
     if (!user || !otherUser) return;
    console.log(`Unblocking user ${otherUser.id}`);
    setIsBlocked(false);
    toast({ title: "성공", description: `${otherUser.name}님 차단을 해제했습니다.` });
  };

  // 통화 버튼 핸들러 (생략)
  const handleVoiceCall = () => alert("음성 통화 기능은 현재 개발 중입니다.");
  const handleVideoCall = () => alert("영상 통화 기능은 현재 개발 중입니다.");

  // 채팅방 나가기 핸들러
  const handleLeaveChat = async () => {
    // ... (handleLeaveChat implementation remains the same)
     if (!user || !chatId) return;
    const confirmed = confirm("이 채팅방에서 나가시겠습니까? 대화 내용이 삭제되고 복구할 수 없습니다.");
    if (confirmed) {
      try {
        const { error } = await supabase.rpc('leave_chat_room', { p_room_id: chatId, p_user_id: user.id });
        if (error) throw error;
        toast({ title: "성공", description: "채팅방에서 나갔습니다." });
        onLeaveSuccess?.();
      } catch (error: any) {
        console.error("Error leaving chat room:", error);
        toast({ title: "오류", description: error.message || "채팅방 나가기 중 오류 발생", variant: "destructive" });
      }
    }
  };

  // JSX 렌더링 부분
  return (
    <Card className="flex flex-col h-[600px] max-h-[80vh] glass-card">
      <CardHeader className="flex flex-row items-center p-4 border-b">
        {otherUser ? (
          <>
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={otherUser.avatarUrl ?? undefined} alt={otherUser.name} />
              <AvatarFallback>{otherUser.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg">{otherUser.name}</CardTitle>
              {/* <p className="text-xs text-muted-foreground">Online</p> */}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleVoiceCall}>
                <PhoneCall className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleVideoCall}>
                <Video className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={isBlocked ? handleUnblockUser : handleBlockUser}>
                    <UserX className="mr-2 h-4 w-4" />
                    <span>{isBlocked ? '차단 해제' : '사용자 차단'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLeaveChat} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>채팅방 나가기</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4"> {/* Use space-y for consistent spacing */}
            {messages.map((message) => (
              // Wrap ContextMenu with a div for spacing
              <div key={message.id} className="mb-4">
                <ContextMenu>
                  <ContextMenuTrigger disabled={isBlocked}>
                    <div className={`flex items-end ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      {message.sender_id !== user?.id && message.senderProfile && (
                        <Avatar className="h-8 w-8 mr-2 self-end">
                          <AvatarImage src={message.senderProfile.avatar_url ?? undefined} alt={message.senderProfile.first_name ?? 'User'} />
                          <AvatarFallback>{`${(message.senderProfile.first_name || '').charAt(0)}${(message.senderProfile.last_name || '').charAt(0)}`.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                      )}
                      {/* 시간 표시 추가 */}
                      {message.sender_id === user?.id && (
                        <span className="text-xs text-muted-foreground self-end mr-2 mb-1">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                      <div className={`max-w-[70%] p-3 rounded-lg ${message.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {isChatMessageMetadata(message.metadata)
                          ? (() => {
                              // Assert metadata type to ChatMessageMetadata
                              const metadata = message.metadata as ChatMessageMetadata;
                              if (metadata.file_type?.startsWith('image/')) {
                                return (
                                  <div className="relative group">
                                    <img src={metadata.file_url} alt={metadata.file_name || 'Uploaded image'} className="max-w-xs max-h-60 rounded-md cursor-pointer" onClick={() => window.open(metadata.file_url, '_blank')} />
                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full h-7 w-7" onClick={() => handleDownload(message.id, metadata.file_url, metadata.file_name)} disabled={downloadingFiles[message.id]}>
                                      {downloadingFiles[message.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                );
                              } else if (metadata.file_type?.startsWith('video/')) {
                                return (
                                  <div className="relative group">
                                    <video src={metadata.file_url} controls className="max-w-xs max-h-60 rounded-md" />
                                     <Button variant="ghost" size="icon" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full h-7 w-7" onClick={() => handleDownload(message.id, metadata.file_url, metadata.file_name)} disabled={downloadingFiles[message.id]}>
                                      {downloadingFiles[message.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-center gap-2">
                                    <Paperclip className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate flex-1">{metadata.file_name || '첨부파일'}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(message.id, metadata.file_url, metadata.file_name)} disabled={downloadingFiles[message.id]}>
                                      {downloadingFiles[message.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                );
                              }
                            })()
                          : <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        }
                        {message.sender_id === user?.id && (
                          <div className="text-xs mt-1 text-right opacity-70">
                            {message.unread_count === 0 ? '읽음' : `${message.unread_count} 안 읽음`}
                          </div>
                        )}
                      </div>
                       {/* 시간 표시 추가 */}
                       {message.sender_id !== user?.id && (
                        <span className="text-xs text-muted-foreground self-end ml-2 mb-1">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(message.content || '')}>
                      텍스트 복사
                    </ContextMenuItem>
                    {message.sender_id === user?.id && (
                      <>
                        <DropdownMenuSeparator />
                        <ContextMenuItem onClick={() => handleDeleteMessage(message.id)} className="text-destructive focus:text-destructive">
                          메시지 삭제
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <CardFooter className="p-4 border-t">
        <div className="flex items-center gap-2 w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isUploading || isBlocked}>
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <Image className="mr-2 h-4 w-4" /> 사진/동영상
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Download className="mr-2 h-4 w-4" /> 파일
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            disabled={isUploading || isBlocked}
          />
          <Input
            type="file"
            accept="image/*,video/*"
            ref={imageInputRef}
            onChange={onFileChange}
            className="hidden"
            disabled={isUploading || isBlocked}
          />
          <Input
            placeholder={isBlocked ? "이 사용자와는 대화할 수 없습니다." : "메시지 입력..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isSending || isUploading || isBlocked}
          />
          <Button onClick={() => handleSendMessage()} disabled={!newMessage.trim() || isSending || isUploading || isBlocked}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
