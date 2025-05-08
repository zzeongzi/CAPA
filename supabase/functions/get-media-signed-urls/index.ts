import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('get-media-signed-urls function initializing...');

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { exerciseId } = await req.json();
    if (!exerciseId) {
      throw new Error('Missing exerciseId parameter');
    }
    console.log('Received request for exerciseId:', exerciseId);

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch media paths for the given exerciseId
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from('workout_media')
      .select('storage_path, file_name, mime_type')
      .eq('workout_exercise_id', exerciseId);

    if (mediaError) throw mediaError;
    console.log(`Found ${mediaData?.length || 0} media items for exerciseId: ${exerciseId}`);

    if (!mediaData || mediaData.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Generate signed URLs for each media item
    const signedUrlPromises = mediaData.map(async (media) => {
      const storagePath = media.storage_path; // 예: "public/..."

      // storagePath 유효성 검사 (필요 시)
      if (!storagePath) {
        console.error(`Invalid storage path found: ${storagePath}`);
        return { ...media, signedUrl: null, error: 'Invalid storage path' };
      }

      // "public/" 접두사 제거 로직 삭제 - storagePath 그대로 사용
      console.log(`Generating signed URL for path: ${storagePath}`);
      try { // try-catch 블록 추가하여 개별 URL 생성 오류 처리 강화
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
          .from('workoutmedia') // Correct bucket name
          .createSignedUrl(storagePath, 3600); // 1 hour validity - storagePath 직접 사용

        if (signedUrlError) {
          // 오류 객체 전체 로깅
          console.error(`Error generating signed URL for ${storagePath}:`, JSON.stringify(signedUrlError, null, 2));
          // 클라이언트에 전달할 오류 메시지 개선 (signedUrlError 객체 구조에 따라 조정 필요)
          let errorMessage = signedUrlError.message || 'Unknown error generating signed URL';
          // Supabase StorageError 객체 확인 (타입스크립트 환경이 아니므로 instanceof 대신 구조적 타이핑 확인)
          if (typeof signedUrlError === 'object' && signedUrlError !== null && 'status' in signedUrlError && typeof signedUrlError.status === 'number') {
             errorMessage = `Status ${signedUrlError.status}: ${errorMessage}`;
          }
          // HTML 응답 감지 시 더 명확한 메시지 제공
          if (errorMessage.includes("Unexpected token '<'")) {
              errorMessage = "Failed to generate video URL. Received HTML response instead of JSON.";
          }
          return { ...media, signedUrl: null, error: errorMessage };
        }

        console.log(`Generated signed URL for ${media.file_name}`);
        return { ...media, signedUrl: signedUrlData?.signedUrl };

      } catch (individualError) { // 개별 URL 생성 중 예외 발생 시 처리
          console.error(`Exception during signed URL generation for ${storagePath}:`, individualError);
          return { ...media, signedUrl: null, error: `Exception: ${individualError.message}` };
      }
    });

    const mediaWithSignedUrls = await Promise.all(signedUrlPromises);
    console.log('Returning media with signed URLs:', mediaWithSignedUrls);

    return new Response(JSON.stringify(mediaWithSignedUrls), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-media-signed-urls function:', error);
    // 전체 함수 오류 시에도 JSON 형식 유지 및 상태 코드 변경
    return new Response(JSON.stringify({ error: `Function error: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // 내부 서버 오류 상태 코드 사용
    });
  }
});
