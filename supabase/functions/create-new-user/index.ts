// @deno-types="https://deno.land/x/servest@v1.3.1/types/react/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Supabase 클라이언트 생성 함수 (환경 변수 사용)
function getSupabaseAdminClient(): SupabaseClient {
  console.log('[getSupabaseAdminClient] Attempting to get Supabase environment variables...');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  console.log(`[getSupabaseAdminClient] SUPABASE_URL loaded: ${!!supabaseUrl}`);
  console.log(`[getSupabaseAdminClient] SUPABASE_SERVICE_ROLE_KEY loaded: ${!!serviceRoleKey}`);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[getSupabaseAdminClient] Missing Supabase environment variables.');
    throw new Error('Missing Supabase environment variables (URL or Service Role Key).');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

serve(async (req: Request) => {
  console.log('[Handler] Function invoked. Request method:', req.method); // 핸들러 시작 로그

  if (req.method === 'OPTIONS') {
    console.log('[Handler] Responding to OPTIONS request.');
    return new Response('ok', { headers: corsHeaders });
  }

  let newUserId: string | undefined;

  try {
    console.log('[Handler] Parsing request body...');
    const body = await req.json();
    console.log('[Handler] Request body parsed:', body);
    const {
      email,
      password,
      name,
      phone_number,
      birth_date,
      gender,
      avatar_url,
      role,
      centerId,
      creatorId,
    } = body;

    console.log('[Handler] Checking required fields...');
    if (!email || !password || !name || !role || !centerId || !creatorId) {
      console.error('[Handler] Missing required fields:', { email: !!email, password: !!password, name: !!name, role: !!role, centerId: !!centerId, creatorId: !!creatorId });
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, name, role, centerId, creatorId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[Handler] Required fields check passed.');

    console.log('[Handler] Initializing Supabase admin client...');
    const supabaseAdmin = getSupabaseAdminClient();
    console.log('[Handler] Supabase admin client initialized.');

    console.log('[Handler] Constructing user metadata...');
    const userMetadata = {
      full_name: name,
      phone_number: phone_number,
      birth_date: birth_date,
      gender: gender,
      avatar_url: avatar_url,
    };
    console.log('[Handler] User metadata:', userMetadata);

    // --- 1. 사용자 생성 ---
    console.log(`[Handler] Step 1: Attempting to create user with email: ${email}`);
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createError) {
      console.error('[Handler] Step 1 FAILED: Supabase Admin createUser error:', createError);
      console.error('[Handler] Error details:', JSON.stringify(createError, null, 2)); // 상세 로깅
      if (createError.message && createError.message.includes('already been registered')) {
        console.log('[Handler] Email already registered error detected.');
        return new Response(JSON.stringify({ error: 'EMAIL_ALREADY_EXISTS', message: '이미 등록된 이메일 주소입니다.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let errorMessage = 'Failed to create user.';
      let statusCode = 500;
      if (createError.message && createError.message.includes('Password should be at least 6 characters')) {
         errorMessage = 'Password should be at least 6 characters.';
         statusCode = (typeof createError === 'object' && createError !== null && 'status' in createError && typeof createError.status === 'number') ? createError.status : 400;
      }
      console.log(`[Handler] Returning unhandled/generic error from createUser with status ${statusCode}`);
      throw new Error(`User creation failed: ${createError.message}`);
    }

    if (!userData || !userData.user) {
       console.error('[Handler] Step 1 FAILED: User created but no user data returned.');
       throw new Error('User created but no user data returned.');
    }

    newUserId = userData.user.id;
    console.log(`[Handler] Step 1 SUCCESS: User created successfully with ID: ${newUserId}`);

    // --- 2. user_roles 테이블 삽입 ---
    console.log(`[Handler] Step 2: Inserting role '${role}' for user ID: ${newUserId}`);
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUserId, role: role });

    if (roleError) {
      console.error('[Handler] Step 2 FAILED: Error inserting into user_roles table:', roleError);
      console.error('[Handler] Role Error details:', JSON.stringify(roleError, null, 2));
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }
    console.log(`[Handler] Step 2 SUCCESS: Role '${role}' inserted successfully.`);

    // --- 3. profiles 테이블 업데이트 (이름 정보 추가) ---
    console.log(`[Handler] Step 3: Updating profiles table for user ID: ${newUserId}`);
    // 이름 분리 (간단한 방식, 필요시 로직 개선)
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        // avatar_url은 user_metadata에서 자동으로 동기화될 수 있으나, 명시적으로 업데이트할 수도 있음
        avatar_url: avatar_url, // avatar_url 추가
        phone_number: phone_number,
        birth_date: birth_date,
        gender: gender,
        center_id: centerId, // center_id 추가
      })
      .eq('id', newUserId);

    if (profileUpdateError) {
      console.error('[Handler] Step 3 FAILED: Error updating profiles table:', profileUpdateError);
      console.error('[Handler] Profile Update Error details:', JSON.stringify(profileUpdateError, null, 2));
      // 롤백 필요 (user, role 데이터 삭제 등 고려)
      throw new Error(`Failed to update profile data: ${profileUpdateError.message}`);
    }
    console.log(`[Handler] Step 3 SUCCESS: Profiles table updated successfully.`);


    // --- 4. members 테이블 삽입 ---
    console.log(`[Handler] Step 4: Inserting into members table for user ID: ${newUserId}`);
    const { error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        user_id: newUserId, // members 테이블에 user_id 컬럼을 추가했으므로 다시 포함
        center_id: centerId,
        name: name,
        email: email,
        status: 'active',
        phone_number: phone_number,
        birth_date: birth_date,
        gender: gender,
        profile_image_url: avatar_url, // 프로필 이미지 URL 추가
      });

    if (memberError) {
      console.error('[Handler] Step 4 FAILED: Error inserting into members table:', memberError); // 로그 번호 수정
      console.error('[Handler] Member Error details:', JSON.stringify(memberError, null, 2));
      throw new Error(`Failed to insert member data: ${memberError.message}`);
    }
    console.log('[Handler] Step 4 SUCCESS: Member data inserted successfully.');

    // --- 5. center_users 테이블 삽입/업데이트 ---
    console.log(`[Handler] Step 5: Upserting into center_users table for user ID: ${newUserId}`);
    const { error: centerUserError } = await supabaseAdmin
      .from('center_users')
      .upsert({ user_id: newUserId, center_id: centerId }, { onConflict: 'user_id' });

    if (centerUserError) {
      console.error('[Handler] Step 5 FAILED: Error upserting into center_users table:', centerUserError); // 로그 번호 수정
      console.error('[Handler] Center User Error details:', JSON.stringify(centerUserError, null, 2));
      throw new Error(`Failed to link user to center: ${centerUserError.message}`);
    }
    console.log('[Handler] Step 5 SUCCESS: User linked to center successfully.');

    // --- 6. memberships 테이블 삽입 ---
    console.log(`[Handler] Step 6: Inserting initial membership for user ID: ${newUserId}`);
    const { error: membershipError } = await supabaseAdmin
      .from('memberships')
      .insert({
        member_id: newUserId,
        // center_id: centerId, // memberships 테이블에 center_id 컬럼이 없으므로 제거
        trainer_id: creatorId,
        plan: '기본',
        total_sessions: 0,
        remaining_sessions: 0,
        start_date: new Date().toISOString(),
      });

    if (membershipError) {
      console.error('[Handler] Step 6 FAILED: Error inserting into memberships table:', membershipError); // 로그 번호 수정
      console.error('[Handler] Membership Error details:', JSON.stringify(membershipError, null, 2));
      throw new Error(`Failed to create initial membership: ${membershipError.message}`);
    }
    console.log('[Handler] Step 6 SUCCESS: Initial membership created successfully.');

    // --- 모든 작업 성공 ---
    console.log('[Handler] All database operations successful. Returning success response.');
    return new Response(JSON.stringify({ userId: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[Handler] Edge function execution error:', error);
    // 오류 객체의 다양한 속성 로깅 시도
    console.error('[Handler] Error details (raw):', error);
    console.error('[Handler] Error details (stringified):', JSON.stringify(error, null, 2));
    if (error instanceof Error) {
        console.error('[Handler] Error stack:', error.stack);
    }

    // 롤백 로직
    if (newUserId) {
      console.log(`[Handler] Attempting to delete user ${newUserId} due to error: ${error.message}`);
      try {
        const supabaseAdminForRollback = getSupabaseAdminClient();
        const { error: deleteError } = await supabaseAdminForRollback.auth.admin.deleteUser(newUserId);
        if (deleteError) {
          console.error(`[Handler] Failed to delete user ${newUserId} during rollback:`, deleteError);
          console.error('[Handler] Delete Error details:', JSON.stringify(deleteError, null, 2));
        } else {
          console.log(`[Handler] User ${newUserId} deleted successfully during rollback.`);
        }
      } catch (rollbackError) {
        console.error(`[Handler] Exception during user deletion rollback for ${newUserId}:`, rollbackError);
      }
    }

    // 클라이언트에 구체적인 오류 메시지 반환
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