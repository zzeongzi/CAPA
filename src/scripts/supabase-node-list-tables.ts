import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MjgwOTMsImV4cCI6MjA2MDIwNDA5M30.8-tFZoxywupfDzFGfXdLPVPWU234aDtPg1jdAatnJnI";

// Node.js 환경용 Supabase 클라이언트 생성
const supabaseNode = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Node.js 환경에서는 localStorage를 사용하지 않습니다.
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function listTables() {
  try {
    console.log('Supabase MCP 테이블 목록 가져오는 중...');
    
    // PostgreSQL information_schema에서 테이블 목록 가져오기
    const { data, error } = await supabaseNode
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      console.error('테이블 목록 조회 오류:', error);
      return;
    }
    
    console.log('\nSupabase MCP 서버의 테이블 목록:');
    if (data && data.length > 0) {
      data.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log('테이블이 없거나 접근 권한이 없습니다.');
    }
  } catch (err) {
    console.error('오류 발생:', err);
  }
}

// 함수 실행
listTables();