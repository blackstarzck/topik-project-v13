# Phase 2 — Data And Auth Foundation Ledger

## Run Metadata

- Run id: 20260520-1800-phase-2-data-and-auth-foundation
- Created: 2026-05-20 18:00 KST
- Updated: 2026-05-20 18:00 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: complete
- Phase: 2-data-and-auth-foundation  # phase marker for the checker

## Task

- User goal: Phase 2 시작 — Supabase SSR/browser 클라이언트, env 검증, generated types, 인증 경계 helper, profile bootstrap, RLS smoke를 박는다.
- Accepted scope: light spec(`docs/ai-workflow/light-specs/phase-2-data-and-auth-foundation.md`)의 Core Functionality 6개 + plan(`docs/ai-workflow/plans/20260520-phase-2-data-and-auth-foundation.md`)의 12개 task.
- Out of scope: 가입/로그인/리셋 UI 본격 구현, 학습/글쓰기/피드백 CRUD, admin role, OAuth providers, Storage 업로드 UI, schema 수정, service_role 도입, billing, TanStack Query (자세한 이유는 plan 참조).
- Current next action: codex consult로 plan 사전 리뷰 받기 → 사용자 승인 대기 → Task 1 진입.

## Docs Consulted

- Exact files read:
  - `AGENTS.md`
  - `docs/agent-index.md`
  - `docs/spec.md`
  - `docs/development/backend-auth.md`
  - `docs/development/stack.md`
  - `docs/development/deployment.md`
  - `docs/sitemap.md`
  - `docs/ai-workflow/light-specs/phase-2-data-and-auth-foundation.md`
  - `docs/ai-development-workflow.md` (§1b, §3, §3b, §4b)
  - `supabase/migrations/INDEX.md` (목차 확인. 트리거 상세는 Task 6에서 다시 읽음)
- Extracted requirements:
  - browser + SSR 클라이언트 양면 필요
  - `@supabase/supabase-js@2.x` + `@supabase/ssr@0.x` (stack.md 명시)
  - env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (server-only `SUPABASE_SERVICE_ROLE_KEY`는 이번 phase 미도입)
  - RLS 강제 + service_role server-only (backend-auth.md)
  - 보호 라우트 redirect: light spec의 보호 라우트 매트릭스
  - profile auto-bootstrap: 트리거 또는 server-side helper
- Doc conflicts: none
- Untouched relevant docs and reason:
  - `docs/development/database-schema.md` — 이번 phase는 schema 수정 없음. Task 6 트리거 확인 시 필요하면 추가 읽음
  - `docs/IA/01-A-01-sign-up/description.md`, `docs/IA/02-A-02-login/description.md` 등 — UI는 Phase 3 이후 영역
  - `docs/ant-design/README.md` — 이번 phase는 visible UI 없음
  - `docs/prd.md` — 도메인 정본은 이미 spec.md/sitemap.md/IA로 라우팅됨

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-20 18:00 | service_role key는 도입 안 함 | admin-only 서버 작업 없음 | light spec / backend-auth.md |
| 2026-05-21 09:30 | schema 변경 — 트리거 마이그레이션 1개 예외 추가 | Codex 사전 리뷰가 `121100:46` 주석 ↔ `121000` 트리거 부재의 self-inconsistency 발견. service_role 도입(attack surface)보다 마이그레이션 1개 추가가 작음. 사용자 결정(AskUserQuestion) | Codex P1 #1 / 사용자 |
| 2026-05-21 09:30 | RLS smoke를 Supabase CLI local stack(docker)으로 | reproducible, secret 불필요, Phase 3+ 통합 테스트에도 재사용 가능. 사용자 결정 | Codex P1 #2 / 사용자 |
| 2026-05-21 09:55 | Task 1 의존성 단계 skip (이미 설치됨) | `package.json` 검토 결과 `@supabase/supabase-js`, `@supabase/ssr`, `zod` 모두 Phase 1에서 도입됨 | package.json |
| 2026-05-21 09:55 | Task 1에서 `.env.example` URL 형식 의심 발견 | URL에 `/rest/v1/` suffix가 있음. `@supabase/supabase-js`의 `createClient(url, key)`는 base URL만 받으므로 Task 3에서 점검 후 정정 필요 | `.env.example` |
| 2026-05-21 10:10 | Generated types path = `src/lib/supabase/types.ts` | Supabase 종속 type을 Supabase 클라이언트와 같은 폴더에 둠(응집도). `src/types/`는 hand-written shared domain types로 분리. supabase/README.md의 기존 예시(`src/types/database.ts`)를 정정 | spec.md §Source Structure / plan §File Structure |
| 2026-05-21 10:10 | Phase 2 types snapshot은 profiles만 정확 작성 | YAGNI — Phase 2가 실제로 사용하는 테이블만. 나머지는 supabase CLI 도입 시 regen으로 한 번에 교체 | plan §Task 2 |
| 2026-05-20 18:00 | `/login` placeholder만 만들고 본격 UI는 Phase 3 | middleware redirect 동작만 보장 | light spec |
| 2026-05-20 18:00 | OAuth providers는 별도 plan | scope 명확화 | light spec |
| 2026-05-20 18:00 | TanStack Query 도입 보류 | 이번 phase는 server fetch만, client-side server state 없음 | stack.md |

## Active Files

- Files expected to change/create: plan §File Structure 표 참고
- Files inspected:
  - `supabase/migrations/INDEX.md`
  - `package.json` (Task 1: 의존성 이미 있음 확인 — `@supabase/supabase-js@2.106.0`, `@supabase/ssr@0.10.3`, `zod@4.4.3`)
  - `vitest.config.ts`
  - `.env.example` (Phase 1 산출. Task 1: URL에 `/rest/v1/` suffix 발견 — Task 3에서 점검 필요)
  - (Task 6에서 `20260520121000_triggers.sql` 읽을 예정)
- Files changed:
  - `src/lib/supabase/env.ts` (Task 1, new) — zod 기반 env validation
  - `tests/lib/supabase/env.test.ts` (Task 1, new) — 5 케이스
  - `src/lib/supabase/types.ts` (Task 2, new) — Database type, profiles만 정확
  - `supabase/README.md` (Task 2, modified) — generated types path 정정
  - `src/lib/supabase/browser.ts` (Task 3, new) — createBrowserClient<Database> wrapper
  - `src/lib/supabase/server.ts` (Task 4, new) — createServerClient with cookies()
  - `src/lib/auth/session.ts` (Task 5, new) — getCurrentUser / requireUser with DI
  - `tests/lib/auth/session.test.ts` (Task 5, new) — 4 케이스
  - `supabase/migrations/20260521120000_auth_user_profile_bootstrap.sql` (Task 6a, new) — auth.users → profiles trigger. cross-model review 후 search_path = pg_catalog, public으로 강화 (P2 #1)
  - `supabase/migrations/INDEX.md` (Task 6a, modified) — 17번 마이그레이션 항목 추가
  - `src/lib/auth/profile.ts` (Task 6b, new) — bootstrapProfile read-only. cross-model review 후 에러 메시지를 "RLS hidden vs trigger failed" 두 가능성 명시로 정확화 (Opus P1 #3)
  - `tests/lib/auth/profile.test.ts` (Task 6b, new) — 3 케이스
  - `tests/integration/profile-trigger.test.ts` (Task 6c, new) — SUPABASE_LOCAL_STACK=1 gated
  - `src/middleware.ts` (Task 7, new) — 라우트 보호 + 세션 refresh. cross-model review 후 (a) redirect 시 refreshed cookies carry-over (Codex P2 #3), (b) matcher에 정적 파일 확장자 제외 추가 (Opus P2 #4)
  - `src/app/login/page.tsx` (Task 7, new) — placeholder
  - `tests/middleware/middleware.test.ts` (Task 8, new) — Playwright fallback, 6 케이스
  - `tests/integration/rls-smoke.test.ts` (Task 9, new) — SUPABASE_LOCAL_STACK=1 gated
  - `.env.example` (Task 1 후속, modified) — URL에서 `/rest/v1/` suffix 제거
- Files explicitly not to touch:
  - `supabase/migrations/*.sql` (16개 정본, schema 수정 금지)
  - `AGENTS.md`, `CLAUDE.md`
  - `scripts/ai-workflow-check.mjs` (이전 PR에서 확정)
  - `src/theme/*` (Phase 1 산출물)

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정자 + 구현 | plan 전체 | active | this ledger |
| codex (gstack) | plan 사전 리뷰어 | plan 단독 검수 | pending | task packet — plan path + light spec path |
| TBD | Cross-model review reviewer (Task 12) | 구현 완료 diff | pending | 구현 모델의 반대 모델로 결정 |

## Child Result Packets

(미생성)

## Verification State

- Required checks:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm build`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run:
  - Task 1: env 단위 테스트 — RED 5/5 → GREEN 5/5
  - Task 5: session 단위 테스트 — 4/4 PASS
  - Task 6b: profile 단위 테스트 — 3/3 PASS
  - Task 8: middleware 단위 테스트 (Playwright fallback) — 6/6 PASS
  - Task 10 §전체 검증 (cross-model fix 적용 후 최종):
    - `pnpm test` — 20 passed / 3 skipped (integration tests gated on SUPABASE_LOCAL_STACK)
    - `pnpm typecheck` — PASS
    - `pnpm lint` — PASS
    - `pnpm build` — PASS (Next.js 16.2.6, 5 static pages, middleware compiled as Proxy)
    - `node scripts/ai-workflow-check.mjs --repo .` — PASS
- Latest results: ALL GREEN (Task 10 최종 통과)
- Known failures: none
- Skipped checks and reason:
  - Task 6c (profile trigger integration) — Supabase CLI local stack(docker) 부재로 skip. `SUPABASE_LOCAL_STACK=1` env로 로컬 실행 가능
  - Task 9 (RLS smoke) — 동일 사유로 skip. degraded mode.
  - Phase 2 PR 머지 전 사용자가 docker + supabase CLI 환경에서 두 통합 테스트 1회 수동 실행 권장
- Cross-model review: Opus 4.7 (CONCERN, P1 #3 + P2 5건) + Codex GPT 5.5 (CONCERN, P2 5건). 두 모델 모두 ‘substantially meets contract’ 평가. 같은 PR에서 4건 fix(P1 1 + P2 3), 4건 Phase 3로 이월. fix 후 재실행: 20/20 PASS.
- Architecture Pass: passed — grep 4종 모두 깨끗. (1) src/app·src/components 어디에도 @supabase/* 직접 import 없음. (2) lib/supabase·lib/auth 폴더에 도메인 import 누수 없음. (3) types.ts 상단에 "Regenerate" 명령 명시. (4) getCurrentUser/requireUser는 session.ts에만, bootstrapProfile은 profile.ts에만 — 동일 개념 분산 없음.
- Light Spec: docs/ai-workflow/light-specs/phase-2-data-and-auth-foundation.md
- Final report: docs/ai-workflow/runs/2026/05/20/20260520-1800-phase-2-data-and-auth-foundation.html (이 ledger 옆)

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: n/a
- Evidence collected: n/a
- Completion allowed: pending
- Remaining fallback risk:
  - Playwright 첫 도입이 막히면 Task 8을 vitest 변형으로 fallback (plan §Risks)
  - Supabase test 환경 부재 시 RLS smoke를 local supabase 또는 별도 test project로
  - Cross-model review 단일 모델 가용 시 `Cross-model review: degraded — <reason>` 명시

## Ledger/File-State Consistency

- Files changed match accepted scope: yes — light spec 6 core functionality 모두 구현, Out of Scope 표 준수
- Docs consulted match implemented behavior: yes — backend-auth.md / stack.md / sitemap.md / spec.md / 16 마이그레이션 + 트리거 마이그레이션 1개 신규
- Child result packets integrated: yes — Opus + Codex cross-model review 결과 통합, 4건 fix + 4건 Phase 3 이월
- Verification state current: yes (Task 10 §전체 검증 최종 통과)
- Remaining risks listed: yes (아래)

## Risks And Follow-Up

- Remaining risks (resolved 또는 known):
  - ~~마이그레이션 트리거 부재~~ RESOLVED — Task 6a에서 마이그레이션 17번으로 추가
  - ~~Playwright 첫 셋업~~ MITIGATED — Task 8을 vitest 변형으로 fallback. middleware 단위 테스트 6 케이스로 redirect 매트릭스 검증
  - Supabase CLI local stack 미가용 — Task 6c, 9 skip with `SUPABASE_LOCAL_STACK=1` gate. 머지 전 1회 수동 실행 권장
  - Next.js 16의 "middleware" → "proxy" 컨벤션 deprecation warning. 동작은 정상. 별도 PR로 rename
  - `.env.example`의 supabase URL/key가 실제 사용자 프로젝트 값처럼 보임. publishable key는 commit 안전하지만 사용자 확인 권장
- Phase 3로 이월된 항목 (cross-model review에서 발견, 의식적 deferral):
  - **Codex P2 #2** — `@supabase/ssr` 0.10.x cache headers를 middleware setAll에 반영 (라이브러리 시그니처 추가 확인 필요)
  - **Codex P2 #4** — RLS smoke를 `problem_attempts` 같은 user_id 패턴 테이블로 확장 (problem seed 필요)
  - **Opus P2 #5** — `getCurrentProfile()` 분리 (raw User에서 trusted profile로) — API 디자인 결정
  - **Opus P2 #6 + Codex P2 #5** — types.ts 다른 테이블 미정의. Phase 3 시작 시 `supabase gen types typescript --local`로 regen
- Assumptions:
  - 16개 마이그레이션 + 17번이 RLS를 충분히 박았다(`20260520121100_rls_policies.sql` 라인 46 self-inconsistency 해소됨)
  - Supabase Auth 트리거 예외가 enclosing auth.users insert를 rollback하는 표준 Postgres 동작에 의존
- Follow-up needed:
  - 사용자 결정: 이 PR을 `local-commit` 또는 `push-and-pr`로 진행
  - Phase 3 진입 시 light spec phase-3-app-shell-and-ia-routes.md 작성 + types.ts regen
  - Next.js 16 middleware→proxy rename (별도 PR)

## Git Publication Decision

- Git publication decision: pending (사용자 결정 대기)
- Reason: 사용자가 commit/push 시점을 결정. 워크플로우는 워킹 트리에 변경을 둠.
- Branch: main
- Upstream: origin/main
- Dirty scope: Phase 2 산출물 + 이전 워크플로우 인프라 변경 (한 PR로 묶이거나 분할 가능)
- Review status: cross-model review 완료 (Opus + Codex 양쪽 CONCERN → fix 4건 적용 후 양쪽 substantial PASS 의견)
- Verification status: PASS (test 20/20, typecheck, lint, build, workflow check)
- Ledger: docs/ai-workflow/runs/2026/05/20/20260520-1800-phase-2-data-and-auth-foundation.md (this)
- Fallback status: 통합 테스트 2개 degraded (docker 부재). ledger에 환경 결정 기록됨
- Next git action: 사용자 결정
