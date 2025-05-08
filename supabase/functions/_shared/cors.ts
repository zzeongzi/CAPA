// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 개발 중에는 '*' 사용, 운영 시에는 'http://localhost:8082' 또는 실제 배포된 프론트엔드 URL로 변경
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // GET 메서드 추가
};