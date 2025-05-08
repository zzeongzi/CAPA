import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MjgwOTMsImV4cCI6MjA2MDIwNDA5M30.8-tFZoxywupfDzFGfXdLPVPWU234aDtPg1jdAatnJnI";

// Node.js 환경용 Supabase 클라이언트 생성
const supabaseNode = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function listTables() {
  console.log('Supabase MCP 테이블 목록 가져오는 중...');
  
  try {
    // 먼저 연결 확인
    console.log('Supabase 연결 테스트 중...');
    
    // SQL 쿼리 직접 실행
    console.log('SQL 쿼리 직접 실행 중...');
    const { data: sqlData, error: sqlError } = await supabaseNode.rpc('get_tables', {});
    
    if (sqlError) {
      console.log('RPC 메소드 호출 오류:', sqlError);
      
      // 일반 쿼리 시도
      console.log('일반 쿼리로 시도 중...');
      const { data, error } = await supabaseNode
        .from('pg_tables')
        .select('tablename, schemaname')
        .eq('schemaname', 'public');
      
      if (error) {
        console.error('pg_tables 쿼리 오류:', error);
        
        // 마지막 방법으로 시도
        console.log('information_schema.tables로 시도 중...');
        const { data: infoData, error: infoError } = await supabaseNode
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public');
          
        if (infoError) {
          console.error('information_schema.tables 쿼리 오류:', infoError);
          return;
        }
        
        console.log('information_schema.tables 쿼리 결과:', infoData);
        
        if (infoData && infoData.length > 0) {
          console.log('\nSupabase MCP 서버의 테이블 목록 (information_schema):');
          infoData.forEach((table, index) => {
            console.log(`${index + 1}. ${table.table_name}`);
          });
        } else {
          console.log('테이블이 없거나 접근 권한이 없습니다.');
        }
        return;
      }
      
      console.log('pg_tables 쿼리 결과:', data);
      
      if (data && data.length > 0) {
        console.log('\nSupabase MCP 서버의 테이블 목록 (pg_tables):');
        data.forEach((table, index) => {
          console.log(`${index + 1}. ${table.tablename}`);
        });
      } else {
        console.log('테이블이 없거나 접근 권한이 없습니다.');
      }
      return;
    }
    
    // RPC 메소드가 성공적으로 호출된 경우
    console.log('RPC 호출 결과:', sqlData);
    
    if (sqlData && Array.isArray(sqlData) && sqlData.length > 0) {
      console.log('\nSupabase MCP 서버의 테이블 목록 (RPC):');
      sqlData.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name || table.tablename || JSON.stringify(table)}`);
      });
    } else {
      console.log('테이블이 없거나 접근 권한이 없습니다.');
    }
    
  } catch (err) {
    console.error('예상치 못한 오류 발생:', err);
  }
  
  // 스크립트가 완전히 실행될 때까지 대기하기 위한 타임아웃 추가
  console.log('스크립트 실행 완료.');
}

// 비동기 함수를 실행하고 완료될 때까지 기다림
(async () => {
  await listTables();
  // 스크립트가 갑자기 종료되지 않도록 잠시 대기
  console.log('처리 중...');
  setTimeout(() => {
    console.log('스크립트 정상 종료.');
  }, 3000);
})();