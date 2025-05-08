import fetch from 'node-fetch';

const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDYyODA5MywiZXhwIjoyMDYwMjA0MDkzfQ.T24EeKuc-x5Hhz_k6MaG_dN6Fc5BV0Hswp-G6Nz_dh0";

async function fetchTableList() {
  try {
    // PostgreSQL 쿼리를 사용하여 테이블 목록 가져오기
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('Supabase MCP 도구를 사용하여 테이블 목록 가져오는 중...');
    
    // Supabase의 REST SQL 엔드포인트 사용
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    
    console.log('\nSupabase MCP 서버의 테이블 목록:');
    if (data && data.length > 0) {
      data.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log('테이블이 없거나 접근 권한이 없습니다.');
      console.log('받은 데이터:', JSON.stringify(data, null, 2));
    }
    
  } catch (err) {
    console.error('오류 발생:', err);
  }
}

fetchTableList();