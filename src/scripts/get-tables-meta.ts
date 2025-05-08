import fetch from 'node-fetch';

const SUPABASE_URL = "https://eemsbitvwxhyrfxoqzhl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbXNiaXR2d3hoeXJmeG9xemhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDYyODA5MywiZXhwIjoyMDYwMjA0MDkzfQ.T24EeKuc-x5Hhz_k6MaG_dN6Fc5BV0Hswp-G6Nz_dh0";

async function listTablesWithClient() {
  console.log('Supabase MCP 도구를 사용하여 테이블 목록 가져오는 중...');
  
  try {
    // Supabase의 메타데이터 API 호출
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 호출 실패: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    // 응답 헤더에서 테이블 목록을 추출
    const contentType = response.headers.get('content-type');
    console.log('응답 콘텐츠 타입:', contentType);
    
    const responseBody = await response.text();
    
    try {
      // JSON 형식으로 파싱 시도
      const data = JSON.parse(responseBody);
      
      if (data.definitions) {
        console.log('\nSupabase MCP 서버의 테이블 목록:');
        
        // OpenAPI 스키마에서 테이블 이름 추출
        const tableNames = Object.keys(data.definitions)
          .filter(key => !key.includes('Join') && !key.includes('Rpc'))
          .map(key => key.replace('definitions/', ''));
        
        tableNames.forEach((tableName, index) => {
          console.log(`${index + 1}. ${tableName}`);
        });
      } else if (data.paths) {
        console.log('\nSupabase MCP 서버의 테이블 목록:');
        
        // API 경로에서 테이블 이름 추출 시도
        const paths = Object.keys(data.paths)
          .filter(path => path.startsWith('/'))
          .map(path => path.split('/')[1])
          .filter((value, index, self) => value && self.indexOf(value) === index);
        
        paths.forEach((tableName, index) => {
          console.log(`${index + 1}. ${tableName}`);
        });
      } else {
        console.log('\nAPI 응답에서 테이블 목록을 추출할 수 없습니다.');
        console.log('수신된 데이터:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      }
    } catch (jsonError) {
      // JSON이 아닐 경우 응답 본문 출력
      console.log('\nAPI 응답이 JSON 형식이 아닙니다:');
      console.log(responseBody.substring(0, 500) + '...');
      console.log('\n직접 Supabase 대시보드를 통해 테이블 목록을 확인하세요.');
    }
    
  } catch (err) {
    console.error('오류 발생:', err);
    console.log('\n대체 방법:');
    console.log('1. Supabase 대시보드(https://app.supabase.com)에 로그인하여 테이블 편집기에서 확인하세요.');
    console.log('2. 개발 중인 애플리케이션에서 이미 접근하고 있는 테이블이 있다면 해당 코드를 참조하세요.');
  }
}

listTablesWithClient();