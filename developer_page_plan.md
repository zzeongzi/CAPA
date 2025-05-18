# 개발자 전용 페이지 기능 구현 상세 계획

## 1. 개요

본 문서는 FitFluent Connect 애플리케이션의 개발자 전용 페이지에 구현될 주요 기능들에 대한 상세 계획을 기술합니다. 개발자 페이지는 애플리케이션 현황 모니터링, 공지사항 관리, 시스템 주요 설정 변경, 사용자 관리 등의 기능을 제공하여 앱 운영 및 관리를 용이하게 하는 것을 목표로 합니다.

## 2. 공통 사항

*   **UI/UX**:
    *   전체적인 디자인은 기존 애플리케이션과의 통일성을 유지하며, [Shadcn/ui](https://ui.shadcn.com/) 컴포넌트를 기반으로 깔끔하고 직관적인 인터페이스를 제공합니다.
    *   반응형 디자인을 고려하여 다양한 디바이스에서 사용성을 확보합니다.
*   **인증/인가**:
    *   개발자 페이지 접근은 특정 역할(예: `admin`, `developer` 등 Supabase `auth.users.role`에 정의된 역할)을 가진 인증된 사용자만 가능하도록 제한합니다.
    *   클라이언트 측 라우팅 가드 및 Supabase RLS(Row Level Security)를 활용하여 접근 제어를 구현합니다.

## 3. 기능별 상세 설계

### 3.1. 애플리케이션 현황 대시보드

*   **목표**: 앱의 주요 운영 지표 및 현황을 시각적으로 제공하여 데이터 기반 의사결정을 지원합니다.
*   **표시 항목 및 데이터 소스/집계/시각화**:
    *   **활성 사용자 수 (일일/주간/월간)**:
        *   기준: 앱 실행 기준 (Supabase `auth.users` 테이블의 `last_sign_in_at` 필드 활용).
        *   데이터 집계: Supabase Edge Function 또는 PostgreSQL 함수를 사용하여 주기별 고유 사용자 수 집계.
        *   시각화: 숫자 카드 (현재 값), 라인 차트 (시간에 따른 추세).
    *   **신규 가입자 수 (일일/주간/월간)**:
        *   기준: Supabase `auth.users` 테이블의 `created_at` 필드 활용.
        *   데이터 집계: Supabase Edge Function 또는 PostgreSQL 함수를 사용하여 주기별 신규 가입자 수 집계.
        *   시각화: 숫자 카드, 라인 차트.
    *   **센터별 사용자 수**:
        *   기준: `public.profiles` 테이블의 `center_id` (또는 `public.members` 테이블의 `center_id`)를 기준으로 `public.centers` 테이블과 조인하여 센터명과 함께 사용자 수 집계.
        *   데이터 집계: Supabase Edge Function 또는 PostgreSQL 함수.
        *   시각화: 바 차트 또는 파이 차트.
    *   **오류 모니터링 요약 (Sentry 연동 가정)**:
        *   표시 정보: 최근 발생한 주요 오류 목록, 해결되지 않은 오류 수, 오류 발생 빈도 등.
        *   구현: Sentry API 호출을 위한 Supabase Edge Function 개발 또는 클라이언트 측에서 직접 호출 (API 키 보안 처리 필요).
        *   시각화: 숫자 카드, 간단한 오류 목록 테이블.
*   **UI 구성**: 각 통계 항목을 개별 카드 형태로 구성하고, 사용자가 기간(일/주/월)을 선택하여 조회할 수 있는 필터 제공.

### 3.2. 공지사항 관리

*   **목표**: 앱 사용자에게 중요 정보를 효과적으로 전달하고, 공지사항을 체계적으로 관리합니다.
*   **데이터 모델 (`public.announcements` 테이블)**:
    ```mermaid
    erDiagram
        announcements {
            uuid id PK "고유 ID"
            text title NOT_NULL "제목"
            text content NOT_NULL "내용 (HTML 저장)"
            uuid author_id FK "작성자 ID (auth.users.id 참조)"
            timestamptz created_at "생성일시"
            timestamptz updated_at "수정일시"
            timestamptz published_at "게시(예약)일시"
            boolean is_published "게시여부"
            text target_audience_type "대상 (ALL, CENTER)"
            uuid target_center_id FK "대상 센터 ID (centers.id 참조, nullable)"
            jsonb image_urls "이미지 URL 목록 (nullable)"
        }
        users {
            uuid id PK
            -- 기타 users 컬럼 --
        }
        centers {
            uuid id PK
            -- 기타 centers 컬럼 --
        }
        announcements ||--o{ users : author_id
        announcements ||--o{ centers : target_center_id
    ```
*   **주요 기능**:
    *   **목록 조회**: 제목, 작성자, 게시일, 게시 상태 등을 테이블 형태로 표시. 페이징 및 검색/필터 기능 제공.
    *   **작성/수정**:
        *   에디터: 위지윅(WYSIWYG) 에디터 사용 (예: React Quill, TipTap).
        *   이미지 첨부: 에디터 내에서 Supabase Storage에 이미지 업로드 후 URL 삽입. `image_urls` 필드는 대표 이미지 등에 활용.
        *   입력 필드: 제목, 내용, 게시 대상(전체/센터 선택), 게시 예약 시간(시간 단위).
    *   **게시/게시 취소**: `is_published`, `published_at` 상태 관리.
    *   **삭제**: 공지사항 삭제.
    *   **푸시 알림 발송**:
        *   트리거: "게시" 버튼 클릭 시 (즉시 발송) 또는 `published_at` 도달 시 (예약 발송 - Supabase Scheduled Functions 활용).
        *   대상: `target_audience_type`에 따라 전체 사용자 또는 특정 `target_center_id` 소속 사용자. (사용자 프로필에서 센터 정보 조회 필요)
        *   구현: Supabase Edge Function을 통해 FCM/APNS 등 푸시 서비스로 요청 전송.
        *   클릭 시 동작: 앱 내 해당 공지사항의 상세 보기 화면으로 이동 (딥링킹 또는 푸시 페이로드에 `announcement_id` 포함).
*   **앱 내 사용자 기능 (연동 필요)**:
    *   공지사항 목록 페이지 (최신순 정렬).
    *   공지사항 상세 보기 페이지 (HTML 렌더링).
*   **UI 구성**: 공지사항 목록은 테이블, 작성/수정은 폼과 위지윅 에디터 사용.

### 3.3. 시스템 설정

*   **목표**: 앱의 주요 기능 상태 및 동작을 개발자가 유연하게 제어.
*   **데이터 모델 (`public.system_settings` 테이블)**:
    ```mermaid
    erDiagram
        system_settings {
            text setting_key PK "설정 키 (예: page_status:/schedule)"
            jsonb setting_value NOT_NULL "설정 값 (예: {\"status\": \"UNDER_MAINTENANCE\", \"message\": \"점검 중입니다.\"}")
            text description "설명"
            timestamptz updated_at "최종 수정일시"
            uuid updated_by FK "최종 수정자 (auth.users.id 참조)"
        }
        users {
            uuid id PK
            -- 기타 users 컬럼 --
        }
        system_settings ||--o{ users : updated_by
    ```
*   **관리 대상 및 UI**:
    *   **페이지별 상태 관리**:
        *   대상 페이지: "페이지 이름" 기준. (관리할 페이지 이름 목록은 `system_settings` 테이블에 초기 데이터로 저장하거나, 개발자 페이지에서 추가/관리할 수 있도록 UI 제공)
        *   UI: 관리 대상 페이지 목록 표시. 각 페이지별 상태(드롭다운: 정상, 긴급 점검, 준비 중 등) 변경. "긴급 점검" 선택 시 점검 메시지 입력 필드 활성화.
    *   **신규 기능 베타 테스트 활성화**:
        *   UI: 기능별 이름과 함께 ON/OFF 토글 스위치 제공.
*   **설정 변경 적용**:
    *   **즉시 반영**: Supabase Realtime을 구독하여 클라이언트 앱에서 설정 변경을 실시간으로 감지하고 UI/동작에 반영. 또는 앱의 중요 지점에서 주기적으로 설정 값을 다시 불러와 적용.
    *   "긴급 점검 모드"의 경우, 즉시 반영이 필수적이므로 Realtime 사용을 권장.
*   **변경 이력**: `updated_by`, `updated_at`을 통해 기본적인 추적이 가능. 더 상세한 로그는 별도 `audit_log` 테이블 고려.

### 3.4. 사용자 관리

*   **목표**: 사용자 정보 조회 및 주요 역할 관리.
*   **데이터 소스**: Supabase `auth.users` 테이블과 `public.profiles` 테이블 (필요시 `public.centers` 테이블과 조인).
*   **사용자 목록 조회**:
    *   표시 항목: 사용자 ID (`auth.users.id`), 이메일 (`auth.users.email`), 이름 (`profiles.first_name`, `profiles.last_name`), 가입일 (`auth.users.created_at`), 마지막 접속일 (`auth.users.last_sign_in_at`), 현재 역할 (`auth.users.role`).
    *   검색 기능: 센터 이름 (입력 또는 선택), 이름, 이메일 기준.
    *   UI: 테이블 형태, 페이징 및 정렬 기능 제공.
*   **사용자 역할 변경**:
    *   관리 대상 역할: `trainer`, (추후 확장 가능성 고려) `admin`.
    *   UI: 사용자 목록에서 특정 사용자 선택 후, 드롭다운 메뉴를 통해 역할 변경.
    *   주의사항: 역할 변경 시 명확한 경고 메시지 표시. (예: "사용자 역할을 변경하면 접근 권한이 크게 달라질 수 있습니다. 계속하시겠습니까?")
    *   구현: Supabase Admin API (Supabase Edge Function 내에서 안전하게 호출)를 사용하여 `auth.users.role` 필드 업데이트.
*   **사용자 상태 관리**: 현재 요구사항에서는 개발자 페이지에서의 직접적인 사용자 상태(활성/비활성) 변경 기능은 제외. (사용자 앱 내 회원 탈퇴 로직은 별도 구현)

## 4. 데이터베이스 스키마 요약 (Mermaid ERD - 신규/주요 변경)

```mermaid
erDiagram
    users {
        uuid id PK
        varchar role
        timestamptz created_at
        timestamptz last_sign_in_at
        varchar email
        -- 기타 auth.users 컬럼 --
    }
    profiles {
        uuid id PK_FK "FK to auth.users.id"
        text first_name
        text last_name
        uuid center_id FK "FK to centers.id"
        -- 기타 profiles 컬럼 --
    }
    centers {
        uuid id PK
        text name "센터 이름"
        -- 기타 centers 컬럼 --
    }
    announcements {
        uuid id PK
        text title
        text content
        uuid author_id FK "FK to auth.users.id"
        timestamptz published_at
        boolean is_published
        text target_audience_type
        uuid target_center_id FK "FK to centers.id"
    }
    system_settings {
        text setting_key PK
        jsonb setting_value
        uuid updated_by FK "FK to auth.users.id"
        timestamptz updated_at
    }
    members {
        uuid id PK
        uuid user_id FK "FK to auth.users.id"
        uuid center_id FK "FK to centers.id"
        text name
        -- 기타 members 컬럼 --
    }

    users ||--o{ profiles : "has"
    profiles ||--o{ centers : "belongs to"
    announcements ||--o{ users : "authored by"
    announcements ||--o{ centers : "targeted at"
    system_settings ||--o{ users : "updated by"
    members ||--o{ users : "is_user"
    members ||--o{ centers : "belongs_to_center"

```
*참고: 위 ERD는 주요 관계를 나타내며, 실제 구현 시 더 많은 컬럼과 관계가 포함될 수 있습니다.*

## 5. 기술 스택 및 주요 라이브러리 (예상)

*   **프론트엔드**: React, TypeScript, Vite
*   **UI 컴포넌트**: [Shadcn/ui](https://ui.shadcn.com/)
*   **백엔드/데이터베이스**: Supabase (Authentication, PostgreSQL Database, Storage, Edge Functions, Realtime, Scheduled Functions)
*   **상태 관리**: React Context API, Zustand, 또는 Recoil (프로젝트 규모 및 복잡도에 따라 선택)
*   **데이터 페칭**: React Query (TanStack Query) 또는 SWR
*   **차트 라이브러리 (대시보드용)**: Recharts, Chart.js, 또는 Nivo
*   **위지윅 에디터 (공지사항용)**: React Quill, TipTap, 또는 Editor.js
*   **라우팅**: React Router

이 계획을 검토해주시고, 의견이나 수정사항이 있다면 알려주시면 반영하도록 하겠습니다. 계획이 확정되면 실제 구현을 위한 다음 단계로 진행할 수 있습니다.