# Context Ledger

## Run Metadata

- Run id: 20260520-1530-schema-implementation
- Created: 2026-05-20 15:30 +09:00
- Updated: 2026-05-20 16:05 +09:00
- Main session owner: Claude (Opus 4.7)
- Host: Claude Code
- Status: complete
- Predecessor ledger: `docs/ai-workflow/runs/2026/05/20/20260520-1149-schema-parallel-analysis.md` (스키마 분석 + round-2 종합 완료)

## Task

- User goal: 결정된 종합 스키마를 정본 docs(`docs/development/database-schema.md`) + 도메인별 분할 SQL 마이그레이션(`supabase/migrations/`)으로 등재.
- Accepted scope:
  - 정본 spec 문서 1개
  - Supabase 마이그레이션 SQL 12개 파일 (도메인별 분할)
  - `docs/spec.md` Required Reading Map 한 줄 추가
  - 자가 검토 (FK 순서, RLS 누락, 이름 일치)
- Out of scope:
  - 실제 마이그레이션 적용 (`pnpm supabase`/Supabase CLI 미설치 — pre-implementation 상태)
  - TypeScript type generation
  - Tier 2 placeholder 테이블 DDL (사용자 결정: 완전 보류)
  - RLS 테스트 슈트 작성 (별도 ledger)
- Current next action: ledger 생성 후 database-schema.md 작성으로 진행.

## Docs Consulted

- 직접 읽음:
  - 선행 ledger: `docs/ai-workflow/runs/2026/05/20/20260520-1149-schema-parallel-analysis.md` (round-2 종합 스키마)
  - `docs/prd.md`, `docs/spec.md` (Fixed Baseline + Required Reading Map)
  - `docs/development/backend-auth.md` (Supabase Auth + RLS + ORM 미사용 정책)
  - `docs/development/deferred-scope.md` (billing/모의고사/게시판/단어장 deferred)
  - `docs/sitemap.md`, `docs/flow/user-flow.md`, `docs/IA/README.md`
- 사용자 결정 4건 (이번 작업 시작 시점):
  - SQL 분할: **도메인별 분할**
  - Tier 2 placeholder: **완전 보류**
  - PK 구현: **`gen_random_uuid()`** (uuidv7 확장 미사용, MVP 단계 단순성 우선)
  - 정본 문서명: **`database-schema.md`**
- Untouched relevant docs and reason: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 15:30 | 새 ledger 시작 (이전 ledger와 분리) | 분석 → 구현으로 단계 전환, 변경 파일 종류가 다름 | CLAUDE.md ai-development-workflow |
| 15:30 | 12개 SQL 파일로 도메인별 분할 (timestamp prefix 순차) | PR 리뷰/롤백 용이, 적용 순서 명시적 | 사용자 결정 |
| 15:30 | PK는 `gen_random_uuid()` (uuidv4) 사용 | Supabase pgcrypto 기본, 즉시 동작; MVP 인덱스 fragmentation 부하 미검증 | 사용자 결정 |
| 15:30 | Tier 2 placeholder는 DDL 미작성 — docs에만 설계 설명 | IA 확정 전 컬럼 설계 흔들림 위험 | 사용자 결정 |
| 15:30 | 정본 문서명 `docs/development/database-schema.md` | 다른 development docs(stack/backend-auth/deployment/deferred-scope)와 동등 위상 | 사용자 결정 |
| 15:30 | 실제 마이그레이션 적용은 out-of-scope | `package.json`/Supabase CLI 미설치, pre-implementation 상태 | 환경 점검 |
| 15:30 | `pgcrypto` + `citext` extension 활성화 | gen_random_uuid + profiles.nickname 위해 | DDL 요구 |
| 15:30 | `private` 스키마 신설 (admin SECURITY DEFINER 함수 격리) | RLS-bypass 함수는 일반 사용자에 노출되면 안 됨 | superpowers schema-primary-keys + security-rls-basics |

## Active Files

- Files expected to change/create:
  - `docs/ai-workflow/runs/2026/05/20/20260520-1530-schema-implementation.md` (본 ledger, 작성 중)
  - `docs/development/database-schema.md` (신규)
  - `docs/spec.md` (Required Reading Map 한 줄 추가)
  - `supabase/migrations/20260520120000_extensions_and_schemas.sql`
  - `supabase/migrations/20260520120100_profiles_goals.sql`
  - `supabase/migrations/20260520120200_problems.sql`
  - `supabase/migrations/20260520120300_attempts.sql`
  - `supabase/migrations/20260520120400_writing.sql`
  - `supabase/migrations/20260520120500_feedback.sql`
  - `supabase/migrations/20260520120600_recommendations.sql`
  - `supabase/migrations/20260520120700_library_events_exports.sql`
  - `supabase/migrations/20260520120800_audit.sql`
  - `supabase/migrations/20260520120900_functions.sql`
  - `supabase/migrations/20260520121000_triggers.sql`
  - `supabase/migrations/20260520121100_rls_policies.sql`
- Files explicitly not to touch:
  - production source 없음 (pre-implementation)
  - `docs/` 의 PRD/IA/flow/sitemap/ant-design (스키마와 무관)
  - Tier 2 placeholder 테이블 DDL

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| 없음 | n/a | n/a | n/a | 본 작업은 메인 세션 단독 진행 — 자식 에이전트 불필요. |

## Child Result Packets

None.

## Verification State

- Required checks:
  - 모든 user-owned 테이블에 RLS enable + force
  - 모든 FK 참조 테이블이 먼저 정의되는지 (마이그레이션 순서)
  - `profiles.id = auth.users.id` FK (cascade)
  - `private.is_admin()` 함수가 RLS 정책보다 먼저 정의
  - `library_items`의 check constraint (정확히 하나의 *_id non-null)
  - `writing_drafts`의 partial unique index (활성 draft 1개 보장)
  - `writing_submissions` insert-only RLS (update/delete 정책 없음)
  - `feedback_dimension_scores` unique `(submission_id, dimension)`
- Checks run:
  - Glob 으로 12개 SQL 파일 존재 확인 (12개 일치).
  - Grep `create table if not exists public\.(\w+)` 으로 17개 테이블 정의 확인.
  - Grep `alter table public\.(\w+) enable row level security` 로 17개 RLS enable 확인 — **누락 0건**.
  - Grep `references public\.(\w+)` 으로 FK 36건 분포 확인. 도메인별 분할 순서가 FK 의존을 만족.
  - FK 의존 수동 검토: profiles → 모든 user_id, problems → assets/attempts/recommendations/library/events, writing_submissions → feedback/comparison/library/events. 순서 OK.
  - 함수 의존: `private.is_admin` (120900) → profiles (120100) 이전 정의. `supersede_active_draft` → writing_drafts (120400) 이전 정의. RLS 정책 (121100)은 함수 (120900) 이후 적용.
- Latest results: 모든 정적 검토 통과. 17 테이블 / 17 RLS enable / 12 마이그레이션 파일 / 1 정본 문서 / 1 spec map 업데이트.
- Skipped checks and reason: 실제 `psql`/Supabase 적용은 환경 미설치로 불가 — 작성된 SQL은 정적 검토만 수행. 실제 적용은 별도 ledger.
- Cross-model review: degraded — historical, pre-rule (single-AI authored before 2026-05-21 cross-review rule was introduced)

## Fallback State

- Normal path blocked: none.
- Failure class: none.
- Fallback used: none.
- Evidence collected: 환경 점검(`supabase/`, `package.json`, `.env` 확인) — pre-implementation 확정.
- Completion allowed: yes (artifact-only 작업).
- Remaining fallback risk: 실제 적용 단계에서 SQL 오류가 발견될 수 있음 → 별도 ledger의 적용 작업에서 처리.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes — 14개 파일 생성/수정 모두 위 Active Files 목록과 일치.
- Docs consulted match implemented behavior: yes — Round-2 종합 스키마 + 사용자 결정 4건이 SQL/spec docs에 일관 반영.
- Child result packets integrated: n/a
- Verification state current: yes — 정적 검토 결과 위 Verification State에 반영.
- Remaining risks listed: yes (아래).

## Risks And Follow-Up

- Remaining risks:
  - SQL 파일이 실제 Supabase에서 검증되지 않음 — 처음 적용 시 문법/순서 오류 가능.
  - `gen_random_uuid()`는 `pgcrypto` extension 필요 — 01/12에서 `create extension if not exists` 처리하지만 Supabase 프로젝트 권한 확인 필요.
  - **`profiles_self_update` 정책의 protected-column 검사** (`app_role`/`plan_label`/`status` 변경 차단)는 PostgreSQL RLS의 `with check` 서브쿼리 평가 시점에 의존. 실제 적용 시 cross-user 시나리오 + 권한 상승 시도 테스트 필요. 차선책: BEFORE UPDATE 트리거로 `OLD.app_role IS DISTINCT FROM NEW.app_role then RAISE` 패턴 추가.
  - **`private.is_admin()`의 RLS 호출 비용**: 현재 정책들이 `private.is_admin((select auth.uid()))` 패턴. stable 함수라 plan 최적화 가능하나 query plan에 따라 매 행 호출될 수 있음. RLS-heavy 테이블(`problems`, `writing_submissions`)에서 핫스팟 확인 시 `(select private.is_admin((select auth.uid())))` 형태로 외부 select 추가 권장.
  - `writing_submissions` immutable 정책은 application 코드 + service_role 경로에서 UPDATE/DELETE를 시도하지 않는다는 모델 contract에 의존. `feedback_status` 갱신은 service_role.
  - draft → submission 승격 트리거는 같은 `(user_id, problem_id)`에 활성 draft가 1개라는 invariant 의존 — partial unique index와 결합 검증 필요. 동시 submit 경합 시 race 가능성은 application-level 잠금으로 보완.
  - profile cascade delete는 user-owned 데이터 전부 삭제 — 운영에서는 `profile.status='deleted'` 마킹 + 별도 soft-delete 패턴이 더 안전. 본 마이그레이션은 cascade로 두되 운영 정책에서 hard delete 금지 권장.
  - Storage bucket RLS 정책은 본 마이그레이션 scope 밖 — 별도 SQL(`storage.objects` 정책) 필요.
  - AI 출력 contract(`feedback_dimension_scores.dimension` enum, `study_events.event_type`, `comparison_reports.metrics` 키, `writing_drafts.autosave_status` 값 집합)는 LLM 프롬프트 + UI 와이어프레임 확정 후 별도 동결 필요.
- Assumptions:
  - Supabase Postgres 15+ (Supabase 현재 기본 — `gen_random_uuid`/`citext` 가용).
  - `auth` schema와 `auth.users` 테이블은 Supabase가 제공.
  - RLS 정책의 `auth.uid()` 호출은 `(select auth.uid())` 패턴으로 감싸 InitPlan 최적화.
- Follow-up needed:
  - 별 ledger로 실제 마이그레이션 적용 + RLS 테스트 슈트 작성 (owner/admin/cross-user/protected-column 시나리오).
  - Supabase types 생성: `pnpm supabase gen types typescript --local > src/types/database.ts` (pre-implementation 해제 후).
  - `package.json` 작성 시 `supabase` CLI dev dependency 추가.
  - Storage bucket 생성 + `storage.objects` RLS 정책 (avatars / problem-assets / generated-exports).
  - 위 "Remaining risks"의 protected-column 트리거 보강 결정.
  - event_type / dimension / metrics 키 카탈로그 동결 후 enum 또는 lookup table 도입 검토.

---

## Round-2 (마이그레이션 보강, 2026-05-20 16:30 +09:00)

### Round-2 Task

- User goal: Round-1에서 등록한 위험 노트 2~3건을 SQL/트리거로 해결하고, 적용 단계에서 빠지면 안 되는 storage 정책을 마이그레이션에 포함.
- Accepted scope:
  - Storage buckets 정의 (avatars / problem-assets / generated-exports) 3개
  - `storage.objects` RLS 정책 (본인 경로 write, 가시성 정책)
  - `profiles_self_update` 정책 단순화 + protected-column BEFORE UPDATE 트리거
  - `writing_submissions.feedback_status` 갱신용 SECURITY DEFINER 함수 (service_role 전용)
- Out of scope:
  - 실제 Supabase 적용 (별 ledger)
  - storage.objects pgTAP 테스트 (별 ledger)
  - billing 관련 storage 정책

### Round-2 Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 16:30 | 같은 ledger에 round-2 append (별 ledger 신설 안 함) | 동일 implementation 작업의 후속 보강 — 추적 단순성 | CLAUDE.md ledger 패턴 |
| 16:30 | 신규 마이그레이션 4개 timestamp prefix `2026052012120X` 순차 | 기존 12개와 같은 timestamp 패턴 유지 (적용 순서 = timestamp 오름차순) | Supabase 관례 |
| 16:30 | `profiles_self_update` 정책의 protected-column with check 제거 + BEFORE UPDATE 트리거로 이전 | RLS with check 서브쿼리 평가 시점 의존성 위험 제거. 트리거는 OLD/NEW 직접 비교라 명확. | Round-1 위험 노트 |
| 16:30 | feedback_status 전이 함수는 service_role 전용 (`grant execute ... to service_role`) | immutable submission RLS는 owner-side update를 차단. 시스템 전이는 server function. | Round-1 모델 contract |
| 16:30 | Storage RLS는 `storage.foldername(name)[N]` 패턴으로 path 분해 | Supabase 표준. 본인 user_id 경로 검증. | Supabase storage docs |

### Round-2 Active Files

- 신규 SQL 마이그레이션 (4개):
  - `supabase/migrations/20260520121200_storage_buckets.sql`
  - `supabase/migrations/20260520121300_storage_policies.sql`
  - `supabase/migrations/20260520121400_profiles_protected_columns.sql`
  - `supabase/migrations/20260520121500_submission_status_function.sql`
- 수정:
  - `docs/development/database-schema.md` (Migration Index 4행 추가, Storage Buckets 섹션 확장, §7 invariants에 protected-column 트리거 노트)
  - 본 ledger (round-2 섹션)

### Round-2 Verification

- Checks run:
  - SQL 자가 검토 (storage 정책 path 분해 인덱스 확인, protected-column 트리거의 admin bypass, function 권한)
  - Glob으로 16개 마이그레이션 파일 확인
  - database-schema.md 마이그레이션 인덱스와 실제 파일명 일치
- Skipped: 실제 Supabase storage policy 적용 테스트 — 별 ledger.

### Round-2 Risks / Notes

- `storage.foldername(name)[2]`는 `exports/{user_id}/{file}` path 가정. application이 다른 path를 쓰면 정책 우회 가능 — 코드 컨벤션 문서화 필요.
- `set_submission_feedback_status` 함수는 service_role에만 execute 권한. 일반 사용자가 호출하면 permission denied. Edge Function / Next.js route handler에서 service_role JWT로 호출.
- protected-column 트리거는 admin bypass 포함 — admin이 직접 SQL로 변경하거나 RPC로 변경 가능. JWT-level admin 판정은 여전히 `private.is_admin()` 의존.
- Storage policy 적용 후 기존 객체에는 영향 없음 (정책은 새 요청에 평가).

### Round-2 Follow-up

- 별 ledger로 실제 마이그레이션 적용 + storage policy 통합 테스트.
- application 단의 storage path 컨벤션 정의 문서.
- protected-column 트리거 동작 테스트 (admin self-update 시도, learner의 role 상승 시도).
