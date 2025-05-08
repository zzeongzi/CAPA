import { createClient } from '@supabase/supabase-js';

// MCP 설정 파일에서 찾은 정보 사용
const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDYyODA5MywiZXhwIjoyMDYwMjA0MDkzfQ.T24EeKuc-x5Hhz_k6MaG_dN6Fc5BV0Hswp-G6Nz_dh0";

// 서비스 역할 키를 사용한 클라이언트 생성 (높은 권한)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function listTables() {
  console.log('Supabase MCP 도구를 사용하여 테이블 목록을 가져오는 중...');
  
  try {
    // SQL 쿼리 실행 - 서비스 역할 키를 사용하면 이 작업이 가능합니다
    const { data, error } = await supabaseAdmin
      .rpc('mcp_list_tables')
      .catch(async () => {
        // RPC 함수가 없다면 직접 SQL 실행
        console.log('mcp_list_tables RPC가 없습니다. SQL 쿼리로 시도합니다...');
        return await supabaseAdmin.from('pg_catalog.pg_tables')
          .select('schemaname, tablename')
          .eq('schemaname', 'public');
      });
    
    if (error) {
      console.error('첫 번째 시도 오류:', error);
      
      // 두 번째 방법 시도
      console.log('두 번째 방법으로 시도합니다...');
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_schema', 'public');
      
      if (error2) {
        console.error('두 번째 시도 오류:', error2);
        
        // SQL 직접 실행 시도
        console.log('SQL 직접 실행을 시도합니다...');
        const { data: data3, error: error3 } = await supabaseAdmin.rpc(
          'mcp_execute_sql', 
          { sql_query: 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'' }
        );
        
        if (error3) {
          console.error('SQL 실행 오류:', error3);
          return;
        }
        
        if (data3) {
          console.log('\nSupabase MCP 서버의 테이블 목록:');
          console.log(data3);
          return;
        }
      }
      
      if (data2) {
        console.log('\nSupabase MCP 서버의 테이블 목록:');
        data2.forEach((item, index) => {
          console.log(`${index + 1}. ${item.table_name}`);
        });
        return;
      }
    }
    
    if (data) {
      console.log('\nSupabase MCP 서버의 테이블 목록:');
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          const tableName = item.tablename || item.table_name;
          console.log(`${index + 1}. ${tableName}`);
        });
      } else {
        console.log('데이터 형식이 예상과 다릅니다:', data);
      }
    } else {
      console.log('테이블이 없거나 접근 권한이 없습니다.');
    }
    
  } catch (err) {
    console.error('예상치 못한 오류 발생:', err);
  }
}

// 실행
listTables().catch(console.error);