import { createClient } from '@supabase/supabase-js';
// Supabase 직접 접근을 위한 설정
const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDYyODA5MywiZXhwIjoyMDYwMjA0MDkzfQ.T24EeKuc-x5Hhz_k6MaG_dN6Fc5BV0Hswp-G6Nz_dh0";

// Node.js 환경용 Supabase 클라이언트 생성
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function listTablesWithSupabase() {
  console.log('Supabase 클라이언트를 통해 테이블 목록 가져오는 중...');
  
  try {
    // service_role 권한으로 테이블 메타데이터 쿼리
    const { data, error } = await supabaseAdmin
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (error) {
      throw new Error(`테이블 목록 조회 오류: ${error.message}`);
    }
    
    console.log('\nSupabase 서버의 테이블 목록:');
    
    if (data && Array.isArray(data) && data.length > 0) {
      data.forEach((row, index) => {
        console.log(`${index + 1}. ${row.tablename}`);
      });
    } else {
      console.log('테이블이 없거나 접근 권한이 없습니다.');
      console.log('응답 데이터:', JSON.stringify(data, null, 2));
  }
    
  } catch (err) {
    console.error('오류 발생:', err);
}
}

listTablesWithSupabase();
