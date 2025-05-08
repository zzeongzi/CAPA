import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useNavigate, useLocation } from "react-router-dom"; // useLocation 추가
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu, BellRing, LogOut, Settings, User, CheckCheck, X,
  MessageSquare, AtSign, CheckCircle2, Activity, Megaphone, Info, ThumbsUp, MessageCircle as MessageCircleIcon, Loader2
} from "lucide-react";
import { ModeToggle } from "./ModeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Database, Json } from "@/integrations/supabase/types";

// 알림 타입 정의
type NotificationType = 'new_message' | 'mention' | 'task_update' | 'announcement' | 'new_comment' | 'new_reaction' | string;
type NotificationRow = Database['public']['Tables']['notifications']['Row'];
interface Notification extends NotificationRow {}

// 알림 아이콘 매핑 함수
const getNotificationIcon = (type: NotificationType | null) => {
  switch (type) {
    case 'new_message': return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'mention': return <AtSign className="h-4 w-4 text-purple-500" />;
    case 'task_update': return <Activity className="h-4 w-4 text-orange-500" />;
    case 'announcement': return <Megaphone className="h-4 w-4 text-yellow-500" />;
    case 'new_comment': return <MessageCircleIcon className="h-4 w-4 text-green-500" />;
    case 'new_reaction': return <ThumbsUp className="h-4 w-4 text-pink-500" />;
    default: return <Info className="h-4 w-4 text-gray-500" />;
  }
};

export function AppHeader() { // pageTitle prop 제거
  const { user, signOut, refreshCounter, triggerNotificationRefresh, markNotificationAsRead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  // 시간 포맷팅 함수
  const formatNotificationTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // 알림 데이터 로드
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    console.log("[AppHeader] Fetching notifications..."); // Log fetch start
    setIsLoadingNotifications(true);
    try {
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') {
           console.warn('Notifications table not found or inaccessible.');
           setNotifications([]);
           setUnreadCount(0);
        } else {
          throw error;
        }
      } else {
        console.log(`[AppHeader] Fetched ${data?.length} notifications.`); // Log fetched count
        setNotifications((data as Notification[]) || []);
        const unread = data?.filter(n => !n.is_read).length ?? 0;
        console.log(`[AppHeader] Setting unread count to: ${unread}`); // Log unread count
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('알림을 불러오는 데 실패했습니다', error);
      toast({ title: "오류", description: "알림 로딩 중 오류 발생", variant: "destructive" });
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoadingNotifications(false);
      console.log("[AppHeader] Fetching notifications finished."); // Log fetch end
    }
  }, [user, toast]);

  // 실시간 알림 구독 (로컬 상태 직접 업데이트 방식 유지)
  useEffect(() => {
    fetchNotifications(); // 초기 로드

    if (!user) return;

    const channel = supabase
      .channel('public:notifications:user_id=eq.' + user.id)
      .on<NotificationRow>(
        'postgres_changes',
        {
          event: '*', // 모든 이벤트(INSERT, UPDATE, DELETE) 구독
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[AppHeader Realtime] Notification change received:', payload);

          // 실시간 변경 감지 시 로컬 상태 직접 업데이트
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev].slice(0, 20));

            // 현재 보고 있는 채팅방인지 확인 로직은 유지 (토스트 표시 및 카운트 증가 여부 결정 위해)
            const pathSegments = location.pathname.split('/');
            const currentChatIdFromUrl = pathSegments.length === 3 && pathSegments[1] === 'chat' ? pathSegments[2] : null;
            const notificationRoomId = (typeof newNotification.metadata === 'object' && newNotification.metadata !== null && 'roomId' in newNotification.metadata)
              ? String(newNotification.metadata.roomId)
              : null;
            const isViewingCurrentChat = newNotification.type === 'new_message' &&
                                         currentChatIdFromUrl &&
                                         notificationRoomId &&
                                         currentChatIdFromUrl === notificationRoomId;

            if (!isViewingCurrentChat && !newNotification.is_read) {
              setUnreadCount(prev => prev + 1); // 안 읽은 개수 증가
              toast({ title: "새 알림", description: newNotification.content });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotification = payload.new as Notification;
            const oldNotification = payload.old as Notification | undefined;
            setNotifications(prev => prev.map(n => n.id === updatedNotification.id ? updatedNotification : n));
            // 읽음 상태 변경 시 카운트 조정
            if (oldNotification && oldNotification.is_read !== updatedNotification.is_read) {
              if (updatedNotification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1)); // 읽음 처리 시 감소
              } else {
                setUnreadCount(prev => prev + 1); // 읽지 않음 처리 시 증가 (드문 경우)
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedNotification = payload.old as Notification;
            setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));
            // 삭제된 알림이 읽지 않은 상태였다면 카운트 감소
            if (!deletedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // location.pathname 추가
  }, [user, fetchNotifications, toast, location.pathname]);

  /* // WebSocket 오류 진단을 위해 실시간 구독 잠시 비활성화
  useEffect(() => {
    fetchNotifications(); // 초기 로드

    if (!user) return;

    const channel = supabase
      .channel('public:notifications:user_id=eq.' + user.id)
      .on<NotificationRow>(
        'postgres_changes',
        {
          event: '*', // 모든 이벤트(INSERT, UPDATE, DELETE) 구독
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[AppHeader Realtime] Notification change received:', payload);

          // 실시간 변경 감지 시 로컬 상태 직접 업데이트
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev].slice(0, 20));

            // 현재 보고 있는 채팅방인지 확인 로직은 유지 (토스트 표시 및 카운트 증가 여부 결정 위해)
            const pathSegments = location.pathname.split('/');
            const currentChatIdFromUrl = pathSegments.length === 3 && pathSegments[1] === 'chat' ? pathSegments[2] : null;
            const notificationRoomId = (typeof newNotification.metadata === 'object' && newNotification.metadata !== null && 'roomId' in newNotification.metadata)
              ? String(newNotification.metadata.roomId)
              : null;
            const isViewingCurrentChat = newNotification.type === 'new_message' &&
                                         currentChatIdFromUrl &&
                                         notificationRoomId &&
                                         currentChatIdFromUrl === notificationRoomId;

            if (!isViewingCurrentChat && !newNotification.is_read) {
              setUnreadCount(prev => prev + 1); // 안 읽은 개수 증가
              toast({ title: "새 알림", description: newNotification.content });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotification = payload.new as Notification;
            const oldNotification = payload.old as Notification | undefined;
            setNotifications(prev => prev.map(n => n.id === updatedNotification.id ? updatedNotification : n));
            // 읽음 상태 변경 시 카운트 조정
            if (oldNotification && oldNotification.is_read !== updatedNotification.is_read) {
              if (updatedNotification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1)); // 읽음 처리 시 감소
              } else {
                setUnreadCount(prev => prev + 1); // 읽지 않음 처리 시 증가 (드문 경우)
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedNotification = payload.old as Notification;
            setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));
            // 삭제된 알림이 읽지 않은 상태였다면 카운트 감소
            if (!deletedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // location.pathname 추가
  }, [user, fetchNotifications, toast, location.pathname]);
  */

  // AuthContext의 refreshCounter 변경 시 알림 새로고침
  useEffect(() => {
    if (refreshCounter > 0) { // 초기 로드 제외
      console.log('[AppHeader] Refresh counter changed, fetching notifications...');
      fetchNotifications();
    }
  // fetchNotifications는 useCallback으로 감싸져 있으므로 의존성 배열에 추가
  }, [refreshCounter, fetchNotifications]);


  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;

    // Optimistic UI update
    const originalNotifications = [...notifications];
    const originalUnreadCount = unreadCount;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error("Error marking all notifications as read:", error);
        // Rollback UI on error
        setNotifications(originalNotifications);
        setUnreadCount(originalUnreadCount);
        toast({ title: "오류", description: "모든 알림 읽음 처리 실패", variant: "destructive" });
      } else {
        toast({ title: "성공", description: "모든 알림을 읽음 처리했습니다." });
        // No need to call triggerNotificationRefresh here as local state is updated
      }
    } catch (error) {
      console.error("Exception marking all notifications as read:", error);
      // Rollback UI on error
      setNotifications(originalNotifications);
      setUnreadCount(originalUnreadCount);
      toast({ title: "오류", description: "모든 알림 읽음 처리 중 예외 발생", variant: "destructive" });
    }
  };

  // 알림 클릭 핸들러 (Reverted to immediate local update + background DB update)
  const handleNotificationClick = (notification: Notification) => { // Removed async
    // 로컬 상태 즉시 업데이트 (UI 반응성 개선 위해 활성화)
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setShowNotifications(false); // Close popup immediately

    // AuthContext의 함수 호출 (DB 업데이트 및 refresh 트리거) - 비동기 백그라운드 처리
    markNotificationAsRead(notification.id).catch(error => {
        // 에러 발생 시 로컬 상태 롤백 (선택적) - UI 일관성을 위해 필요할 수 있음
        console.error("Error marking notification as read in background:", error);
        // Consider rolling back the local state update or refetching
        // fetchNotifications(); // Example: Refetch on error
    });

    // 즉시 페이지 이동
    if (notification.link) {
      console.log(`[AppHeader] Navigating to ${notification.link}`);
      navigate(notification.link);
    }
  };


  // 사용자 이름 이니셜
  const getInitials = () => {
    if (!user) return "?";
    const firstName = user.user_metadata?.first_name || '';
    const lastName = user.user_metadata?.last_name || '';
    if (firstName || lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    const email = user.email || "";
    return email.substring(0, 2).toUpperCase();
  };

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationRef, notificationButtonRef]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleSettingsClick = () => {
    navigate("/settings");
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };


  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 sm:px-6">
        <SidebarTrigger
          size="icon"
          variant="outline"
          className="mr-2"
        >
           <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <div className="flex-grow text-center">
           <Link to="/dashboard" className="text-xl font-semibold tracking-tight">
             Fit<span className="premium-text">Fluent</span>
           </Link>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          {/* 알림 드롭다운 */}
          <div className="relative">
            <Button
              ref={notificationButtonRef}
              variant="outline"
              size="icon"
              className="relative"
              aria-label="Notifications"
              onClick={toggleNotifications}
            >
              <BellRing className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 min-w-[1.1rem] min-h-[1.1rem] flex items-center justify-center p-0 text-[10px]"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>

            {showNotifications && (
              // 알림 카드: 반응형 너비 및 위치 조정, 트랜지션 효과 추가
              <Card
                ref={notificationRef}
                className="fixed top-16 right-0 mt-0 w-96 max-w-[calc(100vw-2rem)] shadow-lg z-50 bg-card transition-all duration-300 ease-in-out"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium">알림</CardTitle>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-auto p-1">
                      <CheckCheck className="h-3 w-3 mr-1" /> 모두 읽음
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    {isLoadingNotifications ? (
                      <div className="flex items-center justify-center h-full py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex items-start p-4 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${
                            !notification.is_read ? 'bg-muted/20' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="mt-1 mr-3">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${!notification.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {notification.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatNotificationTime(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && <div className="w-2 h-2 bg-primary rounded-full ml-auto self-center"></div>}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center p-4">새 알림이 없습니다.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full"
                aria-label="User menu"
              >
                <Avatar className="h-9 w-9">
                  {(() => {
                    console.log("Avatar URL from user metadata:", user?.user_metadata?.avatar_url);
                    return null;
                  })()}
                  <AvatarImage src={user?.user_metadata?.avatar_url || undefined} alt="User" />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            {/* 화면 기준 오른쪽 상단 고정 */}
            {/* 알림 목록 창과 동일한 위치 및 스타일 적용 */}
            {/* 원래 위치 지정 방식으로 복구, align="end" 추가 */}
            {/* 화면 기준 오른쪽 상단 고정 (알림 목록과 동일 위치) */}
            {/* 인라인 스타일로 위치 강제 지정 */}
            {/* 인라인 스타일에 !important 추가하여 위치 강제 지정 */}
            {/* align="end" 복원 및 alignOffset 추가 (이전 상태 복구) */}
            <DropdownMenuContent
              align="end"
              alignOffset={-100} // 오른쪽으로 이동시키기 위한 음수 오프셋 (값 조정 필요)
              className="w-56 mt-2.5 shadow-lg z-50 bg-card transition-all duration-300 ease-in-out" // absolute 제거, mt-2 추가
              forceMount
            >
              <DropdownMenuLabel>내 계정</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfileClick}>
                <User className="mr-2 h-4 w-4" />
                <span>프로필</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSettingsClick}>
                <Settings className="mr-2 h-4 w-4" />
                <span>설정</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
