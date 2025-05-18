import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import * as djwt from 'https://deno.land/x/djwt@v2.8/mod.ts' // dJWT 라이브러리

// Supabase Admin 클라이언트 초기화
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Firebase 서비스 계정 정보 (Supabase Secrets에서 가져옴)
const FB_PROJECT_ID = Deno.env.get('FB_PROJECT_ID') ?? '';
const FB_CLIENT_EMAIL = Deno.env.get('FB_CLIENT_EMAIL') ?? '';
const FB_PRIVATE_KEY = Deno.env.get('FB_PRIVATE_KEY') ?? '';

interface UserPushToken {
  user_id: string;
  push_token: string;
}

// Google OAuth 2.0 액세스 토큰 발급 함수
async function getAccessToken() {
  if (!FB_CLIENT_EMAIL || !FB_PRIVATE_KEY) {
    throw new Error('Firebase service account credentials (FB_CLIENT_EMAIL, FB_PRIVATE_KEY) are not set in environment variables.');
  }
  // private_key의 '\n'을 실제 개행 문자로 변경
  const privateKey = FB_PRIVATE_KEY.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: FB_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 hour
    iat: now,
  };

  const jwt = await djwt.create(
    { alg: 'RS256', typ: 'JWT' },
    claims,
    await crypto.subtle.importKey(
        "pkcs8",
        pemToBinary(privateKey),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    )
  );
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('Failed to get access token:', tokenResponse.status, errorBody);
    throw new Error(`Failed to get access token: ${tokenResponse.status} ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// PEM 형식의 private key를 ArrayBuffer로 변환하는 헬퍼 함수
function pemToBinary(pem: string) {
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "");
    const binaryDer = atob(pemContents);
    const buffer = new ArrayBuffer(binaryDer.length);
    const byteArray = new Uint8Array(buffer);
    for (let i = 0; i < binaryDer.length; i++) {
        byteArray[i] = binaryDer.charCodeAt(i);
    }
    return buffer;
}

// HTML 내용에서 첫 번째 이미지 URL을 추출하는 함수
function extractFirstImageUrl(htmlContent: string): string | null {
  if (!htmlContent) return null;
  // 간단한 정규식 사용, 더 견고한 파싱이 필요할 수 있음
  const match = htmlContent.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { announcementId } = await req.json()
    if (!announcementId) {
      throw new Error('Missing announcementId in request body')
    }
    if (!FB_PROJECT_ID) {
      throw new Error('FB_PROJECT_ID is not set in environment variables.');
    }

    console.log(`Processing announcementId: ${announcementId}`);

    const { data: announcement, error: announcementError } = await supabaseAdmin
      .from('announcements')
      .select('title, content, target_audience_type, target_center_id')
      .eq('id', announcementId)
      .single()

    if (announcementError) throw announcementError
    if (!announcement) throw new Error('Announcement not found')
    console.log('Announcement data:', announcement);

    let targetUserIds: string[] = [];
    if (announcement.target_audience_type === 'ALL') {
      const { data: allUsers, error: allUsersError } = await supabaseAdmin
        .from('profiles')
        .select('id');
      if (allUsersError) throw allUsersError;
      targetUserIds = allUsers?.map(u => u.id) || [];
    } else if (announcement.target_audience_type === 'CENTER' && announcement.target_center_id) {
      const { data: centerUsers, error: centerUsersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('center_id', announcement.target_center_id);
      if (centerUsersError) throw centerUsersError;
      targetUserIds = centerUsers?.map(u => u.id) || [];
    }

    if (targetUserIds.length === 0) {
      console.log('No target users found for push notification.');
      return new Response(JSON.stringify({ message: 'No target users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }
    console.log(`Found ${targetUserIds.length} target users.`);

    const { data: pushTokensData, error: tokensError } = await supabaseAdmin
      .from('user_push_tokens')
      .select('push_token')
      .in('user_id', targetUserIds)

    if (tokensError) throw tokensError
    const pushTokens: string[] = pushTokensData?.map(t => t.push_token).filter(Boolean) || [];

    if (pushTokens.length === 0) {
      console.log('No push tokens found for target users.');
      return new Response(JSON.stringify({ message: 'No push tokens found for target users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }
    console.log(`Sending push to ${pushTokens.length} tokens.`);

    const accessToken = await getAccessToken();
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${FB_PROJECT_ID}/messages:send`;

    // FCM HTTP v1 API는 각 토큰에 대해 개별 메시지를 보내거나, 여러 토큰을 포함하는 멀티캐스트 메시지를 보낼 수 있습니다.
    // 여기서는 각 토큰에 대해 개별적으로 보내는 예시를 보입니다. (더 효율적인 방법은 배치 전송)
    const results = [];
    for (const token of pushTokens) {
      const plainTextBody = announcement.content.replace(/<[^>]+>/g, '').substring(0, 100) + (announcement.content.replace(/<[^>]+>/g, '').length > 100 ? '...' : '');
      const imageUrl = extractFirstImageUrl(announcement.content);

      const notificationPayload: { title: string; body: string; image?: string } = {
        title: announcement.title,
        body: plainTextBody,
      };

      if (imageUrl) {
        notificationPayload.image = imageUrl;
        console.log(`[PushNotification] Image found for notification: ${imageUrl}`);
      }

      const message = {
        message: {
          token: token,
          notification: notificationPayload,
          data: { // data 페이로드에는 문자열 값만 사용하는 것이 안전합니다.
            type: 'announcement',
            announcementId: announcementId,
            // 클릭 시 열릴 앱 내부 경로 또는 URL 스킴
            // 일반 사용자용 공지사항 상세 페이지 경로로 변경
            click_action_url: `com.fitfluent.connect://app/announcements?id=${announcementId}`
          },
        },
      };

      const fcmResponse = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
      const result = await fcmResponse.json();
      results.push({ token, status: fcmResponse.status, result });

      if (!fcmResponse.ok) {
        console.error(`FCM send error for token ${token}:`, fcmResponse.status, result);
        // 개별 실패는 전체를 중단시키지 않고 로깅만 할 수 있음
      } else {
        console.log(`FCM send success for token ${token}:`, result);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Push notifications attempt finished.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (e) {
    let errorMessage = 'An unknown error occurred in Edge Function.';
    if (e instanceof Error) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    } else if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
      errorMessage = (e as any).message;
    }
    console.error('Error in Edge Function:', errorMessage, e);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
