# Phase 2 — Data And Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TALKPIK이 Supabase를 backend로 쓰기 시작할 수 있도록 SSR/browser 클라이언트, env 검증, generated types, 인증 경계, profile bootstrap, RLS smoke를 박는다. 이 phase는 인프라만 다루고, 가입/로그인/리셋 UI 페이지나 학습 데이터 CRUD는 만들지 않는다.

**Architecture:** `@supabase/supabase-js`와 `@supabase/ssr`을 사용한 cookie-based 인증. browser 클라이언트(publishable key)와 server 클라이언트(쿠키 세션) 두 진입점을 `src/lib/supabase/`에 둔다. `src/middleware.ts`가 보호 라우트의 unauth redirect를 담당하고, `src/lib/auth/`가 `getCurrentUser`/`requireUser`/`bootstrapProfile` 같은 helper를 제공한다. 16개 기존 마이그레이션은 그대로 사용하고 스키마 변경은 하지 않는다.

**Tech Stack:** `@supabase/supabase-js@2.x`, `@supabase/ssr@0.x`, `zod@4.x`, Next.js 16 App Router, Vitest, Playwright.

---

## Docs Consulted

- `docs/spec.md` (§Backend And Auth Rules, §Source Structure, §Testing And Quality)
- `docs/development/backend-auth.md` (전체 — Supabase/Auth/RLS 정본)
- `docs/development/stack.md` (Supabase 패키지 버전, vitest/playwright 설정 정책)
- `docs/development/deployment.md` (§Environment Variables — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- `docs/sitemap.md` (보호 라우트 결정의 근거; auth 진입 라우트 `/sign-up`, `/login`, `/password-reset`, `/onboarding/learning-goal`)
- `docs/flow/user-flow.md` (인증 진입선 — Phase 2의 사용자 흐름 인용 범위 한정)
- `docs/ai-workflow/light-specs/phase-2-data-and-auth-foundation.md` (이 phase의 light spec; 본 plan보다 짧은 1쪽 의도 요약)
- `supabase/migrations/INDEX.md` + 16개 마이그레이션 파일 (스키마/RLS/트리거/스토리지 정본 — 변경 안 함)
- `docs/ai-development-workflow.md` (§1b Light Spec, §3 Cross-model review, §3b Subagent dispatch, §4b Architecture Pass)

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| Sign-up / Login / Password-reset 페이지 UI 구현 | Phase 3 이후가 채움. 이번엔 redirect 동작과 placeholder 라우트 1개(`/login`)만 보장. |
| 학습/문제/글쓰기/피드백 데이터 CRUD | Phase 4·5의 영역. |
| Admin role / Org admin 흐름 | Phase 6. |
| 추가 OAuth providers(Google/Apple/카카오 등) | 이번 phase는 Supabase Auth 기본 email/password 경계만. OAuth 추가는 별도 plan. |
| Supabase Storage 업로드 UI | Phase 5 이후. 마이그레이션의 buckets/policies는 그대로 두고 손대지 않음. |
| Schema 변경 (1개 예외) | 16개 마이그레이션은 정본. **예외: auth.users → profiles INSERT 트리거 마이그레이션 1개만 신규 추가** — Codex 사전 리뷰가 `20260520121100_rls_policies.sql:46` 주석("auth trigger out of scope") vs `20260520121000_triggers.sql`(트리거 실제 부재)의 self-inconsistency를 잡음. 이 결함은 Phase 2가 발견한 첫 PR이므로 같은 PR에서 해소. 그 외 schema 변경은 별도 PR. |
| `SUPABASE_SERVICE_ROLE_KEY` 사용 | 이번 phase는 admin-only 서버 작업 없음. 도입 보류. |
| Billing / paywall 연동 | `deferred-scope.md` 그대로. |
| TanStack Query 도입 | Phase 4 이후 client-side server state 필요 시점에 도입. 이번 phase에선 server 측 fetch만. |

## Smallest Buildable Unit

env 검증 + Supabase browser/server 클라이언트만 — `src/lib/supabase/{env,browser,server}.ts` + 1개 env 단위 테스트가 통과하는 상태. middleware/auth helper/profile bootstrap/RLS smoke는 그 위에 점진 추가. 이 SBU 단독으론 사용자 가시 효과는 없지만 그 다음 모든 task의 의존이 풀린다.

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json` (modify) | `@supabase/supabase-js`, `@supabase/ssr` 의존성 추가. lockfile 갱신. |
| `.env.example` (new) | publishable key/URL 변수명 명시. `SUPABASE_SERVICE_ROLE_KEY`는 주석으로 표시만, 도입 안 함. |
| `src/lib/supabase/env.ts` (new) | `zod`로 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` fail-fast 검증. server-only는 별도 함수로 분리. |
| `src/lib/supabase/types.ts` (new) | schema-generated types. 생성 명령(`supabase gen types typescript`)을 README 한 줄로 기록. 첫 적용은 manual snapshot 가능. |
| `src/lib/supabase/browser.ts` (new) | `createBrowserClient` 래퍼. publishable key + URL 사용. |
| `src/lib/supabase/server.ts` (new) | `createServerClient` 래퍼. Next.js cookies() 통합. |
| `src/middleware.ts` (new) | 보호 라우트 매칭 + 세션 refresh + unauth redirect to `/login`. |
| `src/lib/auth/session.ts` (new) | `getCurrentUser`, `requireUser` server-side helper. |
| `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` (new) | `auth.users` insert → `public.profiles` INSERT 트리거. `security definer` + 적절한 search_path. idempotent. |
| `supabase/migrations/INDEX.md` (modify) | 신규 마이그레이션 한 줄 추가. 121100 주석의 self-inconsistency 해소 메모. |
| `src/lib/auth/profile.ts` (new) | idempotent `bootstrapProfile()` helper. 트리거가 정상 작동하면 거의 no-op. fail-safe 측면에서만 보강. |
| `tests/integration/profile-trigger.test.ts` (new) | 마이그레이션 트리거가 실제로 작동하는지 Supabase local stack에서 확인. anon signup → profiles row 1개 자동 생성. |
| `src/app/login/page.tsx` (new) | Phase 3가 채울 placeholder. redirect 대상이 존재하도록 최소한의 thin page만. |
| `tests/lib/supabase/env.test.ts` (new) | env 검증 RED/GREEN. |
| `tests/lib/auth/session.test.ts` (new) | `getCurrentUser`/`requireUser` 동작. mock cookies 사용. |
| `tests/lib/auth/profile.test.ts` (new) | profile bootstrap helper 단위. |
| `tests/integration/middleware-redirect.spec.ts` (new) | Playwright: 비로그인이 `/dashboard` 접근 → `/login` redirect. |
| `tests/integration/rls-smoke.test.ts` (new) | Vitest + supabase-js: anon이 `attempts` 같은 user-owned 테이블 못 읽음. |
| `docs/ai-workflow/runs/2026/05/20/<ts>-phase-2-data-and-auth-foundation.md` (new) | 이 phase의 ledger. |

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | 의존성 추가 + `.env.example` + env zod 검증 (RED→GREEN) | `package.json`, `.env.example`, `src/lib/supabase/env.ts`, `tests/lib/supabase/env.test.ts` | Y — 독립 모듈, 다른 task의 입력만 제공 |
| 2 | schema-generated types snapshot + 생성 명령 README | `src/lib/supabase/types.ts`, `supabase/README.md` (수정) | Y — 독립, 다른 task와 인터페이스만 공유 |
| 3 | Supabase browser client wrapper | `src/lib/supabase/browser.ts` | N — Task 1·2 결과 사용, Task 4와 인터페이스 일관성 필요 |
| 4 | Supabase server client wrapper (cookies 통합) | `src/lib/supabase/server.ts` | N — Task 3와 짝, 인터페이스 짝 맞추기 필요 |
| 5 | `getCurrentUser`/`requireUser` helper + 단위 테스트 (RED→GREEN) | `src/lib/auth/session.ts`, `tests/lib/auth/session.test.ts` | N — Task 4에 의존, 시그니처 결정이 후속 task에 영향 |
| 6a | auth.users → profiles 트리거 마이그레이션 + INDEX.md 갱신 | `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql`, `supabase/migrations/INDEX.md` | Y — 독립 SQL, 코드와 분리 |
| 6b | idempotent `bootstrapProfile()` helper + 단위 테스트 | `src/lib/auth/profile.ts`, `tests/lib/auth/profile.test.ts` | N — Task 5(session helper)에 의존, Task 6a 결과 반영 필요 |
| 6c | 트리거 작동 통합 테스트 (Supabase local stack) | `tests/integration/profile-trigger.test.ts` | Y — Task 6a 완료 후 독립 검증 |
| 7 | `src/middleware.ts` + `/login` placeholder 페이지 | `src/middleware.ts`, `src/app/login/page.tsx` | N — Task 4·5에 의존, 보호 라우트 매트릭스 결정이 동시에 일어남 |
| 8 | middleware redirect Playwright 통합 테스트 | `tests/integration/middleware-redirect.spec.ts` | Y — Task 7 완료 후 독립 실행 가능, RED→GREEN 한 사이클 |
| 9 | RLS smoke 통합 테스트 (anon이 user-owned row 못 읽음) — Supabase CLI local stack 사용 | `tests/integration/rls-smoke.test.ts`, `supabase/config.toml`(필요 시 갱신), `scripts/supabase-test-setup.sh`(신규, optional) | Y — Task 6c와 같은 local stack 공유, 독립 검증 |
| 10 | `pnpm lint`/`typecheck`/`test`/`build` 전체 통과 + 미사용 import 제거 | (전체) | N — 종합 검증, main session 결과 통합 |
| 11 | Architecture Pass: route handler/page에 supabase 직접 import 누수 없음, `src/lib/supabase/`와 `src/lib/auth/` 경계 명확, generated types ↔ hand-written types 침범 없음 | (전체) | N — main session 판정 |
| 12 | Cross-model review (Claude 구현이면 Codex 리뷰, 반대도 가능) | (전체 diff) | N — 외부 모델 호출, packet 작성/통합 |

---

### Task 1 — 의존성 + env 검증

**Files:** `package.json`, `.env.example` (new), `src/lib/supabase/env.ts` (new), `tests/lib/supabase/env.test.ts` (new)

- [ ] Step 1: `tests/lib/supabase/env.test.ts`에 env 누락 케이스 / 잘못된 URL 케이스 / 정상 케이스 3개 RED 테스트 작성
- [ ] Step 2: `pnpm test tests/lib/supabase/env.test.ts` — fail 확인
- [ ] Step 3: `src/lib/supabase/env.ts`에 `getPublicEnv()` (browser-safe), `getServerEnv()` (server-only 추후 확장 자리) 구현
- [ ] Step 4: `.env.example` 작성. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 명시. `SUPABASE_SERVICE_ROLE_KEY`는 `# do not enable until admin-only server task requires it` 주석 한 줄로만
- [ ] Step 5: `pnpm add @supabase/supabase-js @supabase/ssr`
- [ ] Step 6: test pass 확인 + lockfile 검토
- [ ] Step 7: commit

### Task 2 — Generated types snapshot

**Files:** `src/lib/supabase/types.ts` (new), `supabase/README.md` (modify)

- [ ] Step 1: 로컬에서 `supabase gen types typescript --project-id <id>` 또는 SQL DDL 기반 manual snapshot으로 `Database` 타입 생성
- [ ] Step 2: `src/lib/supabase/types.ts`로 저장. 파일 상단에 "Generated. Update by running: ..." 주석
- [ ] Step 3: `supabase/README.md`에 types 생성 명령 한 줄 추가
- [ ] Step 4: `pnpm typecheck` 통과 확인
- [ ] Step 5: commit

### Task 3 — Supabase browser client

**Files:** `src/lib/supabase/browser.ts`

- [ ] Step 1: `createBrowserClient<Database>(url, key)` 래퍼 작성. `getPublicEnv()` 사용
- [ ] Step 2: 호출은 client-side 모듈에서만 import 가능하도록 named export 1개로 정리
- [ ] Step 3: `pnpm typecheck` 통과
- [ ] Step 4: commit

### Task 4 — Supabase server client

**Files:** `src/lib/supabase/server.ts`

- [ ] Step 1: `@supabase/ssr`의 `createServerClient`를 `next/headers`의 `cookies()`와 통합한 `createSupabaseServerClient()` async helper 작성
- [ ] Step 2: route handler/server action/RSC에서 호출 가능한 단일 진입점으로 export
- [ ] Step 3: `pnpm typecheck` 통과
- [ ] Step 4: commit

### Task 5 — Session helper (RED→GREEN)

**Files:** `src/lib/auth/session.ts`, `tests/lib/auth/session.test.ts`

- [ ] Step 1: `tests/lib/auth/session.test.ts`에 `getCurrentUser` returns null / returns user / `requireUser` throws or redirects 3 케이스 RED
- [ ] Step 2: `pnpm test tests/lib/auth/session.test.ts` — fail 확인
- [ ] Step 3: `src/lib/auth/session.ts`에 `getCurrentUser()`(server-side, 반환은 user|null), `requireUser()`(없으면 `redirect('/login')`) 구현
- [ ] Step 4: test pass 확인
- [ ] Step 5: commit

### Task 6a — Trigger migration

**Files:** `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` (new), `supabase/migrations/INDEX.md` (modify)

- [ ] Step 1: 마이그레이션 작성. `create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, ...defaults) values (new.id, ...) on conflict (id) do nothing; return new; end $$;` 패턴. `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`
- [ ] Step 2: `supabase/migrations/INDEX.md`에 한 줄 추가 + 121100 self-inconsistency 메모
- [ ] Step 3: 로컬 supabase에 적용(`supabase db reset` 또는 `supabase migration up`) — Task 6c가 이걸 검증
- [ ] Step 4: commit

### Task 6b — bootstrapProfile helper

**Files:** `src/lib/auth/profile.ts`, `tests/lib/auth/profile.test.ts`

- [ ] Step 1: `tests/lib/auth/profile.test.ts`에 idempotent(있는 profile 그대로) + fail-safe(트리거 실패 시 missing profile 감지) 두 케이스 RED
- [ ] Step 2: `pnpm test` fail 확인
- [ ] Step 3: `src/lib/auth/profile.ts`에 `async bootstrapProfile(userId: string): Promise<Profile>` 구현. `select profile by id` → 있으면 반환, 없으면 (트리거 실패 케이스이므로) 명시적 에러. publishable key로는 INSERT 못함을 docs 주석으로 표시
- [ ] Step 4: test pass
- [ ] Step 5: commit

### Task 6c — Trigger integration test

**Files:** `tests/integration/profile-trigger.test.ts`

- [ ] Step 1: Supabase CLI local stack 가정. anon 클라이언트로 `auth.signUp({ email, password })`
- [ ] Step 2: signup 직후 `supabase.from('profiles').select().eq('id', user.id)` → 1행 확인 (트리거 작동 증명)
- [ ] Step 3: cleanup (test 사용자 삭제 또는 격리된 schema)
- [ ] Step 4: commit

### Task 7 — Middleware + /login placeholder

**Files:** `src/middleware.ts`, `src/app/login/page.tsx`

- [ ] Step 1: `src/middleware.ts`에 `@supabase/ssr` 세션 refresh + 라우트 매트릭스 정의. 공개 allowlist: `/`, `/sign-up`, `/login`, `/password-reset`. 보호 라우트: light spec의 목록. `/paywall`, `/subscription`은 보호로 두고 billing 재개 시 재검토(주석으로 표시)
- [ ] Step 2: `src/app/login/page.tsx`에 thin placeholder("로그인 UI는 Phase 3에서 제공" 메시지만)
- [ ] Step 3: `pnpm dev`로 수동 확인: 비로그인이 `/dashboard` → `/login` redirect
- [ ] Step 4: commit

### Task 8 — Middleware Playwright test

**Files:** `tests/integration/middleware-redirect.spec.ts`

- [ ] Step 1: Playwright spec: 익명 컨텍스트로 `/dashboard` 접근 → `/login` redirect 확인
- [ ] Step 2: `pnpm test:e2e tests/integration/middleware-redirect.spec.ts` 통과
- [ ] Step 3: commit

### Task 9 — RLS smoke (Supabase CLI local stack)

**Files:** `tests/integration/rls-smoke.test.ts`, `supabase/config.toml` (modify if needed), `scripts/supabase-test-setup.sh` (new, optional helper)

- [ ] Step 1: Supabase CLI local stack 셋업 확인. `supabase start`로 docker 컨테이너 기동. `.env.test.local`에 local URL/anon key 주입(공개 키만, secret 없음)
- [ ] Step 2: Task 6c와 환경 공유. `supabase db reset`으로 16+1 마이그레이션 모두 적용된 깨끗한 상태
- [ ] Step 3: vitest spec — anon supabase-js로 `attempts` select → empty/forbidden 확인. 또 사용자 A 세션과 B 세션 두 클라이언트로 row 격리 검증(A가 본인 row만 보고, B는 A의 row 안 보임)
- [ ] Step 4: 통과 확인. CI에서 동작하려면 docker-in-docker 또는 service container 필요 — ledger에 환경 결정 기록
- [ ] Step 5: commit

### Task 10 — 전체 검증

- [ ] `pnpm install --frozen-lockfile` (CI 환경과 동일)
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] `pnpm build`
- [ ] `node scripts/ai-workflow-check.mjs --repo .`

### Task 11 — Architecture Pass

다음 checklist를 ledger에 기록하며 통과. 기계 검증 가능한 항목은 grep 명령을 ledger에 함께 기록:

- [ ] route handler / page / layout 어디에도 `@supabase/supabase-js` 또는 `@supabase/ssr` 직접 import 없음(전부 `src/lib/supabase/*` 경유).
  - 검증: `grep -rEn "from ['\"]@supabase/(supabase-js|ssr)['\"]" src/app src/components 2>&1` 결과 0줄 (단, `src/lib/supabase/*` 자체 파일은 검사 범위 제외)
- [ ] `src/lib/supabase/`와 `src/lib/auth/` 폴더 경계 명확 — 학습/글쓰기/피드백 도메인 import 없음.
  - 검증: `grep -rEn "from ['\"](\.\./)+(?:learning|writing|feedback)" src/lib/supabase src/lib/auth 2>&1` 결과 0줄
- [ ] `src/lib/supabase/types.ts`는 generated 단일 소스, hand-written domain types와 섞이지 않음.
  - 검증: 파일 상단에 "Generated ... do not edit" 주석 존재. 그 외 hand-written export 없음(시각 점검)
- [ ] 이름이 도메인 용어와 일치 (`getCurrentUser`, `requireUser`, `bootstrapProfile` — 구현 용어 아닌 도메인 용어). 시각 점검
- [ ] 동일 개념(예: "현재 사용자") 분산 없음 — `grep -rEn "currentUser|getUser\(|auth\.getUser" src 2>&1` 결과를 ledger에 붙이고 중복 정의 없음 확인
- ledger Verification State에 `Architecture Pass: passed`(또는 failed/skipped — reason) 기록. 위 grep 결과 4개를 evidence로 같이

### Task 12 — Cross-model review

- [ ] 모든 task 완료 후 diff에 대해 cross-model review. 구현자가 Claude이면 codex consult로 리뷰, 반대도 가능
- [ ] reviewer가 발견한 항목은 plan-eng-review 절차로 처리 후 ledger에 기록
- [ ] reviewer 단일 모델만 가용하면 ledger에 `Cross-model review: degraded — <reason>` 기록 후 self-review checklist 통과

---

## Verification Strategy

- 단위: `pnpm test`(vitest) — env, session, profile 3개 모듈
- 통합: `pnpm test:e2e`(playwright) — middleware redirect 1 케이스, `pnpm test`(vitest + supabase-js) — RLS smoke 1 케이스
- 정적: `pnpm lint`, `pnpm typecheck`
- 빌드: `pnpm build`
- 워크플로우: `node scripts/ai-workflow-check.mjs --repo .` (ledger의 Light Spec/Cross-model/Architecture Pass 필드 모두 채워야 통과)
- 보안: 시크릿 grep — `NEXT_PUBLIC_` 접두사를 가진 변수가 service_role/secret을 노출하지 않는지 확인

## Risks

- **트리거 마이그레이션 적용 시 기존 dev/prod 데이터** — 이미 사용자 row가 있는 환경에서 트리거 추가는 신규 가입에만 적용. 기존 사용자에게 profiles row가 누락된 경우 보강 SQL이 필요할 수 있음. 현재 환경은 pre-implementation이라 적용 가능, 향후 환경에선 backfill 검토.
- **Playwright의 첫 셋업** — 이미 stack.md에 명시되어 있지만 실제 설치/설정은 처음일 수 있음. Task 8에서 시간 초과 가능. 필요 시 Task 8을 vitest+supertest 변형으로 fallback하고 Playwright 본 도입은 Phase 3 시작 시.
- **Supabase CLI local stack CI 통합** — docker 의존. GitHub Actions에서는 service container 또는 별도 워크플로우 step. 첫 셋업이 시간 투자이지만 향후 Phase 3+ 통합 테스트에 재사용. 시간 초과 시 RLS smoke만 local-only로 두고 CI는 skip+warning으로 degraded.
- **시크릿 노출 위험** — 검사기는 `NEXT_PUBLIC_` 접두사를 따로 검증하지 않음. PR 리뷰의 수동 grep + Architecture Pass에서 점검.
- **트리거 함수의 보안** — `security definer` + `set search_path` 명시 필수. search_path 누락은 권한 escalation 위험. Cross-model review에서 점검 항목.
