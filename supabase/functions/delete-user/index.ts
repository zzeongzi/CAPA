// @deno-types="https://deno.land/x/servest@v1.3.1/types/react/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Supabase 클라이언트 생성 함수 (환경 변수 사용)
function getSupabaseAdminClient(): SupabaseClient {
  console.log('[delete-user] Attempting to get Supabase environment variables...');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  console.log(`[delete-user] SUPABASE_URL loaded: ${!!supabaseUrl}`);
  console.log(`[delete-user] SUPABASE_SERVICE_ROLE_KEY loaded: ${!!serviceRoleKey}`);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[delete-user] Missing Supabase environment variables.');
    throw new Error('Missing Supabase environment variables (URL or Service Role Key).');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req: Request) => {
  console.log('[delete-user] Function invoked. Request method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('[delete-user] Responding to OPTIONS request.');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[delete-user] Parsing request body...');
    const { userIdToDelete } = await req.json();
    console.log('[delete-user] Request body parsed:', { userIdToDelete });

    if (!userIdToDelete) {
      console.error('[delete-user] Missing userIdToDelete in request body.');
      return new Response(JSON.stringify({ error: 'Missing userIdToDelete in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[delete-user] Target user ID: ${userIdToDelete}`);

    console.log('[delete-user] Initializing Supabase admin client...');
    const supabaseAdmin = getSupabaseAdminClient();
    console.log('[delete-user] Supabase admin client initialized.');

    // --- 중요: 데이터 삭제 순서 및 범위 확인 ---
    // Foreign Key에 ON DELETE CASCADE 설정 여부에 따라 수동 삭제 필요
    // CASCADE 설정이 없다면 관련 테이블 데이터를 먼저 삭제해야 함
    // 이 예시에서는 CASCADE가 설정되어 있다고 가정하고 관련 테이블 삭제 로직은 주석 처리
    console.log(`[delete-user] Deleting related data for user ${userIdToDelete} (assuming CASCADE or manual deletion elsewhere if needed)...`);
    // await supabaseAdmin.from('chat_participants').delete().eq('user_id', userIdToDelete);
    // await supabaseAdmin.from('memberships').delete().eq('member_id', userIdToDelete);
    // await supabaseAdmin.from('center_users').delete().eq('user_id', userIdToDelete);
    // await supabaseAdmin.from('user_roles').delete().eq('user_id', userIdToDelete);
    // await supabaseAdmin.from('members').delete().eq('user_id', userIdToDelete);
    // await supabaseAdmin.from('profiles').delete().eq('id', userIdToDelete);
    // ... 기타 관련 테이블 ...
    console.log(`[delete-user] Related data deletion step complete/skipped.`);

    // --- Auth 사용자 삭제 ---
    console.log(`[delete-user] Attempting to delete user from auth.users: ${userIdToDelete}`);
    const { data: deletionData, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.error(`[delete-user] Failed to delete user ${userIdToDelete} from auth:`, deleteError);
      console.error('[delete-user] Delete Error details:', JSON.stringify(deleteError, null, 2));
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    console.log(`[delete-user] User ${userIdToDelete} deleted successfully.`, deletionData);

    // --- 관련 스토리지 파일 삭제 (선택적) ---
    // try {
    //   console.log(`[delete-user] Attempting to delete storage files for user ${userIdToDelete}...`);
    //   const { data: avatarFiles, error: listAvatarError } = await supabaseAdmin.storage.from('avatars').list(`avatars/${userIdToDelete}`);
    //   if (listAvatarError) console.error('[delete-user] Error listing avatar files:', listAvatarError);
    //   else if (avatarFiles && avatarFiles.length > 0) {
    //     const avatarPaths = avatarFiles.map(file => `avatars/${userIdToDelete}/${file.name}`);
    //     await supabaseAdmin.storage.from('avatars').remove(avatarPaths);
    //     console.log(`[delete-user] Deleted avatar files:`, avatarPaths);
    //   }
    //
    //   const { data: chatFiles, error: listChatError } = await supabaseAdmin.storage.from('chatattachments').list(`${userIdToDelete}`); // 경로 규칙 확인 필요
    //   if (listChatError) console.error('[delete-user] Error listing chat files:', listChatError);
    //   else if (chatFiles && chatFiles.length > 0) {
    //      // 채팅 파일 경로 규칙에 따라 삭제 로직 구현
    //   }
    // } catch (storageError) {
    //   console.error(`[delete-user] Error deleting storage files for user ${userIdToDelete}:`, storageError);
    //   // 스토리지 삭제 실패는 전체 프로세스를 중단시키지 않을 수 있음 (정책에 따라 결정)
    // }

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[delete-user] Edge function execution error:', error);
    console.error('[delete-user] Error details (raw):', error);
    console.error('[delete-user] Error details (stringified):', JSON.stringify(error, null, 2));
    if (error instanceof Error) {
        console.error('[delete-user] Error stack:', error.stack);
    }

    // 롤백 로직은 필요 없음 (이미 삭제 시도 후 오류 발생)

    const errorMessage = (error instanceof Error) ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: `Internal Server Error: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// CORS 헤더 유틸리티 파일 예시 (supabase/functions/_shared/cors.ts)
/*
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 실제 운영 환경에서는 특정 도메인으로 제한
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
*/