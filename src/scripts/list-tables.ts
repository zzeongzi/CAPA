import { supabase } from '../integrations/supabase/client';

async function listTables() {
  try {
    // PostgreSQL information_schema에서 테이블 목록 가져오기
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      console.error('테이블 목록 조회 오류:', error);
      return;
    }
    
    console.log('Supabase MCP 서버의 테이블 목록:');
    data.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
  } catch (err) {
    console.error('오류 발생:', err);
  }
}

// 함수 실행
listTables();