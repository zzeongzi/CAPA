import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client'; // Supabase 클라이언트 경로 확인 필요

// FCM 토큰을 Supabase DB에 저장하는 함수
async function saveTokenToSupabase(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[PushNotifications] User not logged in, cannot save push token.');
    return;
  }

  const deviceType = Capacitor.getPlatform(); // 'ios' 또는 'android'

  try {
    console.log(`[PushNotifications] Saving token: ${token.substring(0,20)}... for user: ${user.id} on device: ${deviceType}`);
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        { 
          user_id: user.id, 
          push_token: token, 
          device_type: deviceType, 
          updated_at: new Date().toISOString() 
        },
        { 
          onConflict: 'user_id, push_token' // user_id와 push_token 조합이 이미 있다면 업데이트
        }
      );

    if (error) {
      console.error('[PushNotifications] Error saving/upserting push token to Supabase:', error);
    } else {
      console.log('[PushNotifications] Push token saved/updated successfully to Supabase.');
    }
  } catch (e) {
    console.error('[PushNotifications] Exception saving push token:', e);
  }
}

// 푸시 알림 리스너 추가 함수
const addPushNotificationListeners = async () => {
  // FCM 토큰 등록 성공 시
  PushNotifications.addListener('registration', async (token: Token) => {
    console.info('[PushNotifications] Registration success, token: ', token.value.substring(0,20) + "...");
    await saveTokenToSupabase(token.value);
  });

  // FCM 토큰 등록 오류 시
  PushNotifications.addListener('registrationError', (err: any) => {
    console.error('[PushNotifications] Registration error: ', err);
  });

  // 푸시 알림 수신 시 (앱이 포그라운드에 있을 때)
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[PushNotifications] Push notification received: ', notification);
    // TODO: 앱 내 알림 UI 표시 또는 상태 업데이트 (예: unread count 증가)
    // 예시: alert(`${notification.title}\n${notification.body}`);
  });

  // 푸시 알림 클릭(액션 수행) 시
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[PushNotifications] Push notification action performed. Data:', action.notification.data);
    // 여기서 직접 라우팅을 시도하는 대신, App.tsx의 appUrlOpen 리스너가 처리하도록 합니다.
    // 만약 click_action_url이 data 페이로드에 있다면, Capacitor가 자동으로 해당 URL로 앱을 열려고 시도합니다.
    // 이 리스너는 주로 알림 액션에 따른 추가적인 로직(예: '읽음'으로 표시)을 처리하는 데 사용될 수 있습니다.
    // 현재는 특별한 추가 로직이 없으므로 로그만 남깁니다.
    if (action.notification.data?.click_action_url) {
        console.log('[PushNotifications] Click action URL found in notification data:', action.notification.data.click_action_url);
    }
  });
};

// 푸시 알림 권한 요청 및 기기 등록 함수
const requestAndRegisterPushNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('[PushNotifications] Push notifications are not configured for web in this setup.');
    return false;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] User denied push notification permissions.');
      // TODO: 사용자에게 권한이 필요함을 안내하는 UI (예: 토스트 메시지)
      return false;
    }

    // 모든 리스너를 추가한 후 register 호출
    await addPushNotificationListeners(); // 리스너는 한 번만 추가하는 것이 좋으므로, 앱 초기화 시점에 호출
    await PushNotifications.register(); 
    console.log('[PushNotifications] Push notifications registered.');
    return true;
  } catch (e) {
    console.error('[PushNotifications] Error in requestAndRegisterPushNotifications:', e);
    return false;
  }
};

// 앱 초기화 시 호출할 메인 함수
export const initializePushNotifications = async () => {
  // 로그인 상태를 확인하고, 로그인된 사용자일 경우에만 토큰 등록 및 저장 시도
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    console.log('[PushNotifications] User is logged in, attempting to initialize push notifications.');
    await requestAndRegisterPushNotifications();
  } else {
    console.log('[PushNotifications] User not logged in, skipping push notification initialization.');
  }

  // 인증 상태 변경 시 다시 초기화 시도 (선택적, 앱 로직에 따라)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      console.log('[PushNotifications] Auth state changed to SIGNED_IN, re-initializing push notifications.');
      await requestAndRegisterPushNotifications();
    } else if (event === 'SIGNED_OUT') {
      console.log('[PushNotifications] User signed out, push token might need to be invalidated.');
      // TODO: 서버에서 해당 사용자의 푸시 토큰 삭제 또는 비활성화 로직 (필요시)
    }
  });
};