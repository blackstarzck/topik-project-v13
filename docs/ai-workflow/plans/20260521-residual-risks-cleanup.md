# Residual Risks Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1·2·3 보고서들이 적어둔 7개 잔여 위험 + A1(통합 테스트 환경)을 처리. Codex 사전 리뷰 결과 **5건을 이 PR에서 종결, 2건(B5, C7)을 Phase 4로 이월**. docker 부재 환경이라 A1은 코드-side 준비 + TESTING.md 안내까지.

**Architecture:** 이 PR이 실제로 ship하는 5건:
- **A. 환경/인프라**: types.ts manual hand-align **5 테이블** (problems, problem_assets, problem_attempts, recommendation_runs, recommendation_items — Phase 4가 소비할 것만) + `.env.example` placeholder 정리 + `TESTING.md` + `test:supabase:local` script.
- **B. 라이브러리/프레임워크**: Next.js 16 `middleware.ts` → `proxy.ts` rename.
- **C. 구조**: `src/lib/routes.ts` 신설 — 3 narrow export(`PUBLIC_PATHS`, `PROTECTED_ROUTE_CASES`, `SIDEBAR_ITEMS`+`SIDEBAR_ADMIN_SECTION`)으로 SidebarNav·proxy·route-matrix.test의 3중 source-of-truth 통합.

Phase 4로 이월된 2건:
- **B5 `@supabase/ssr` cache headers** — 시그니처를 docker 없이 검증 불가, false-fix 위험.
- **C7 `/paywall`, `/subscription` `(workspace)` 밖 이동** — Phase 3 light spec L8,L58-60 "모든 보호 라우트는 `(workspace)` 안 + shared shell" 위반.

새 마이그레이션, 새 의존성(cross-env devDep는 test infra), 새 phase 없음. 기존 phase 산출물의 기술 부채만 정리.

**Tech Stack:** 기존과 동일. Node.js 24, Next.js 16, React 19, Ant Design 6, Supabase, Vitest 4, Playwright 1.x.

---

## Docs Consulted

- `docs/ai-workflow/runs/2026/05/20/20260520-1800-phase-2-data-and-auth-foundation.{md,html}` — Phase 2 잔여 위험
- `docs/ai-workflow/runs/2026/05/21/20260521-1030-phase-3-app-shell-and-ia-routes.{md,html}` — Phase 3 잔여 위험 + Phase 4 이월
- `docs/development/stack.md` — 패키지 버전, 테스트 정책
- `docs/development/deployment.md` — env vars
- `docs/sitemap.md` — `/paywall`, `/subscription` 분류
- `supabase/migrations/` 16개 + 17번 — types regen용 schema 정본
- `@supabase/ssr` 0.10.x 패키지 docs (필요 시 web fetch)
- Next.js 16 [middleware-to-proxy](https://nextjs.org/docs/messages/middleware-to-proxy) 가이드

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| 새 마이그레이션, 새 의존성 | 잔여 위험 정리는 schema/dep 변경 동반 안 함. 발견된 추가 issue는 별도 PR. |
| Phase 4 진입 (Learning Core) | Phase 4는 별도. 이 PR은 phase 이전 cleanup. |
| docker 환경에서 통합 테스트 실제 실행 | docker 미가용. 코드-side 준비 + TESTING.md 안내까지만. 사용자가 docker 셋업 후 1회 수동 실행 권장. |
| onboarding gate를 다른 보호 라우트에 확장 | Phase 4 real content 도입 시. Phase 3 light spec의 의식적 deferral. |
| feedback/report id format validation | Phase 5 data fetch와 함께. Phase 3 plan에 명시. |
| @supabase/ssr 0.10.x를 그 이상 버전으로 업그레이드 | 같은 major(0.x) 안의 시그니처 반영만 검토. **단 시그니처 확인 안 되면 Phase 4 이월** (Codex P2 #5 반영). |
| 새 e2e Playwright 셋업 | 환경 의존, 별도 PR. |
| **B5 cache headers (Phase 4 이월)** | Codex 사전 리뷰 P2 #5: `@supabase/ssr` 0.10.3 정확한 시그니처 확인 필요. docker 부재 환경에서 추측 fix는 false-fix 위험. Phase 4 docker 도입 + 라이브러리 docs 확인 후. |
| **C7 paywall/subscription `(workspace)` 밖으로 이동 (Phase 4 이월)** | Codex 사전 리뷰 P1 #2: Phase 3 light spec L8,L58-60이 "모든 보호 라우트는 `(workspace)` 안 + shared shell" 명시. 이동은 spec 위반. Phase 4 진입 시 (a) shell 안에 유지 + force-dynamic 수용, (b) shell 밖 + spec 갱신, (c) 자체 protected layout 중 결정. |
| **A2 14 테이블 full hand-align (5 테이블로 축소)** | Codex 사전 리뷰 P1 #1: 14 vs 15 내부 불일치 + hand-align 실수 위험. Phase 4가 실제 소비하는 5 테이블만: `problems`, `problem_assets`, `problem_attempts`, `recommendation_runs`, `recommendation_items`. 나머지(writing/feedback/library/audit 등)는 Phase 5·6에서 supabase CLI regen으로 도입. |
| Dashboard supabase query optimization | Codex 사전 리뷰 P2 #7: 현재 dashboard/page.tsx가 onboarding gate 외 supabase 호출. 캐싱/최적화는 cache headers와 짝지어 Phase 4. |

## Smallest Buildable Unit

`.env.example` 정리(A3) + `routes.ts` 3 export split(C6) + `middleware.ts` → `proxy.ts` rename(B4) 3건만 — 도커 없이 즉시 검증 가능한 가장 작은 슬라이스. **순서 명시**(Codex P2 #3,#4 반영): (1) `routes.ts` 신설 + `middleware.ts`의 PUBLIC_PATHS와 SidebarNav, route-matrix.test.ts import 변경, (2) tests 그대로 PASS 확인, (3) `middleware.ts` → `proxy.ts` rename + tests import path 변경, (4) build 통과 확인. 이 SBU 이후의 작업은 모두 incremental.

## File Structure

| Path | Responsibility |
| --- | --- |
| `.env.example` (modify) | URL/key를 placeholder 형태로 정리(개인 프로젝트 값 제거). 주석 강화. |
| `src/lib/supabase/types.ts` (modify) | **5개 테이블만** hand-align (Codex P1 #1 반영): `problems`, `problem_assets`, `problem_attempts`, `recommendation_runs`, `recommendation_items`. 나머지 9개는 Phase 5·6에서 CLI regen 시 도입. |
| `src/lib/routes.ts` (new) | **3개 named export로 split** (Codex P2 #6 반영): `PUBLIC_PATHS`(string[]), `PROTECTED_ROUTE_CASES`(테스트용 path + meta), `SIDEBAR_ITEMS`(SidebarNav nested menu). 각 export 자체가 도메인 단위. |
| `TESTING.md` (new) | A1 degraded 명시(Codex P2 #8 반영): docker 부재 시 어떤 test가 skip되는지, 어떻게 활성화할지, `pnpm test:supabase:local` 사용법. |
| `package.json` (modify) | `test:supabase:local` script 추가: `SUPABASE_LOCAL_STACK=1 vitest run tests/integration/{profile-trigger,rls-smoke}.test.ts` |
| `src/components/app/SidebarNav.tsx` (modify) | hard-coded paths → `SIDEBAR_ITEMS` import from `routes.ts`. |
| `tests/integration/route-matrix.test.ts` (modify) | hard-coded 배열 → `PUBLIC_PATHS` + `PROTECTED_ROUTE_CASES` import. 또 import 경로 `../../src/middleware` → `../../src/proxy`. |
| `src/proxy.ts` (new, rename) | `src/middleware.ts` 내용을 옮기고 export 함수 이름 `middleware` → `proxy`. PUBLIC_PATHS도 `routes.ts` import로. |
| `src/middleware.ts` (delete) | rename 완료 후 제거. |
| `tests/middleware/middleware.test.ts` (modify) | import path `src/middleware` → `src/proxy`. |
| `tests/integration/admin-role-matrix.test.ts` (no change) | proxy import 안 함. |
| `docs/ai-workflow/runs/2026/05/21/<ts>-residual-risks-cleanup.md` (new) | 이 PR ledger. |

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | `.env.example` placeholder 정리 (A3) | `.env.example` | Y — 독립 1파일 |
| 2 | `src/lib/routes.ts` 신설(3 export split) + 모든 consumer 갱신 (C6) | `src/lib/routes.ts`(new), `src/middleware.ts`(temp, PUBLIC_PATHS 변경), `src/components/app/SidebarNav.tsx`, `tests/integration/route-matrix.test.ts` | N — Task 3와 같은 파일 다중 touch, 순서 강제 |
| 3 | `middleware.ts` → `proxy.ts` rename (B4) — **Task 2 PASS 확인 후 시작** | `src/proxy.ts`(new), `src/middleware.ts`(delete), `tests/middleware/middleware.test.ts`, `tests/integration/route-matrix.test.ts` import path | N — Task 2와 같은 파일 다시 touch, 단일 owner |
| 4 | types.ts 5 테이블 manual hand-align (A2 축소) | `src/lib/supabase/types.ts` | N — Phase 4 의존성, 정확성 우선 |
| 5 | A1 통합 테스트 실행 안내 — `TESTING.md` + `test:supabase:local` script | `TESTING.md`(new), `package.json` | Y — 독립 |
| 6 | 전체 검증 (pnpm test/lint/typecheck/build + workflow check) | (전체) | N — 종합 |
| 7 | Architecture Pass + Cross-model review (Opus + Codex 병렬) | (전체) | N — main session 조정 |

**이번 PR scope 변경 요약** (Codex 사전 리뷰 반영):
- 원래 7건 → **5건 처리** (A3, C6 split, B4, A2 축소, A1+TESTING.md)
- **2건 Phase 4 이월**: B5 cache headers (시그니처 추측 위험), C7 paywall/subscription 이동 (Phase 3 shell contract 보호)

---

> **NOTE (post-revision)**: The per-task sections below were originally written for the 7-item scope. After Codex pre-review FAIL, scope was reduced to 5 items and the task table at the top is the authoritative source. The detail sections for B5 (cache headers) and C7 (paywall move) are kept here as **archived/superseded specs** — they describe what was deferred to Phase 4, not what this PR ships. Task 5's detail has been edited down to the 5-table scope; Task 6 below describes the **deferred** move.

### Task 1 — `.env.example` placeholder

- [ ] Step 1: 현재 URL/key를 generic placeholder로 교체 (`https://YOUR-PROJECT.supabase.co`, `sb_publishable_REPLACE_ME` 등).
- [ ] Step 2: 주석 강화 — 시크릿 절대 NEXT_PUBLIC_ 금지, 가입 후 Settings → API에서 값 복사 안내.
- [ ] Step 3: commit message: `docs(env): replace example values with generic placeholders`

### Task 2 — `routes.ts` 3 export split (post-revision)

- [ ] Step 1: `src/lib/routes.ts` 신설 — 3 narrow exports (Codex pre-review P2 #6):
  - `PUBLIC_PATHS: readonly string[]` (proxy/middleware allowlist)
  - `PROTECTED_ROUTE_CASES: readonly { path: string; iaCode: string }[]` (route-matrix 테스트 fixture)
  - `SIDEBAR_ITEMS: readonly SidebarItem[]` + `SIDEBAR_ADMIN_SECTION: SidebarGroup` (SidebarNav 메뉴)
- [ ] Step 2: SidebarNav에서 hard-coded items → `SIDEBAR_ITEMS` + admin이면 `SIDEBAR_ADMIN_SECTION` append.
- [ ] Step 3: `route-matrix.test.ts`에서 하드코드 배열 → `PROTECTED_ROUTE_CASES.map(c => c.path)` import.
- [ ] Step 4: middleware의 `PUBLIC_PATHS`도 routes.ts import.
- [ ] Step 5: typecheck + test 통과 확인.

### Task 3 — middleware → proxy rename

- [ ] Step 1: `src/middleware.ts` 내용을 `src/proxy.ts`로 복사. export `async function middleware` → `proxy`.
- [ ] Step 2: `src/middleware.ts` 삭제.
- [ ] Step 3: tests import path 갱신 (`../../src/middleware` → `../../src/proxy`).
- [ ] Step 4: `pnpm build` 통과 + deprecation warning 사라짐 확인.

### ~~Task 4~~ — cache headers (**DEFERRED to Phase 4**)

> Codex pre-review P2 #5: `@supabase/ssr` 0.10.x setAll의 cache-header 시그니처를 docker 없이 검증 불가. 추측 fix는 false-fix 위험. 이번 PR에서 빼고 Phase 4 진입 시 docker 셋업 + 라이브러리 docs 확인 후 진행. **현재 이 cleanup PR은 cache headers를 수정하지 않음.**

Phase 4가 다룰 변경 예정 location: `src/proxy.ts:22-38` (setAll), `src/lib/supabase/server.ts:11-22` (setAll). middleware test mock도 cache header 검증 추가 가능.

### Task 4 — types.ts 5 테이블 hand-align (post-revision: 14 → 5, Phase 4가 직접 소비할 것만)

- [ ] Step 1: 마이그레이션 3개를 읽고 5 테이블의 Row/Insert/Update/Relationships 작성:
  - `problems`, `problem_assets` (`20260520120200`)
  - `problem_attempts` (`20260520120300`)
  - `recommendation_runs`, `recommendation_items` (`20260520120600`)
- [ ] Step 2: types.ts에 추가. profiles/learning_goals 그대로.
- [ ] Step 3: 파일 상단 주석 — 어떤 phase가 어떤 테이블을 소비하는지 + schema vs TS 정밀도 갭(int union not narrowed, numeric(5,2) → number) 명시.
- [ ] Step 4: `pnpm typecheck` 통과 확인.

> Codex pre-review P1 #1: 원래 14 테이블 hand-align은 실수 위험 + Phase 5/6 영역. Phase 4가 직접 소비하는 5 테이블로 축소. 나머지 9(writing_drafts, writing_submissions, writing_feedback, feedback_dimension_scores, sentence_feedback, comparison_reports, library_items, study_events, export_files, admin_audit_logs)는 Phase 5/6 진입 또는 supabase CLI regen 시.

### ~~Task 6~~ — paywall/subscription 정적화 (**DEFERRED to Phase 4**)

> Codex pre-review P1 #2: Phase 3 light spec L8,L58-60이 "모든 보호 라우트는 `(workspace)` 안 + shared shell" 명시. `(workspace)` 밖으로 빼면 spec 위반. **이번 cleanup PR은 paywall/subscription을 손대지 않음.** Phase 4 진입 시 옵션 결정:
> - (a) `(workspace)` 안 유지 + force-dynamic 수용 (현 상태)
> - (b) light spec 갱신 + `(workspace)` 밖으로 이동
> - (c) `(workspace)` 안에 자체 layout 만들어 dynamic 면제

Phase 4 결정 후 변경할 location: `src/app/(workspace)/paywall/page.tsx`, `src/app/(workspace)/subscription/page.tsx`, `src/lib/routes.ts`의 `PROTECTED_ROUTE_CASES`.

### Task 5 — A1 docs 보강 (`TESTING.md` + `test:supabase:local` script)

- [ ] Step 1: 신규 `TESTING.md` — Vitest 명령, SUPABASE_LOCAL_STACK gated 테스트 안내, 활성화 명령, http URL 사용 범위 명시.
- [ ] Step 2: `package.json`에 `test:supabase:local` script + `cross-env` devDependency 추가.
- [ ] Step 3: cleanup ledger Decision에 "통합 테스트는 docker 환경에서 사용자가 1회 수동 실행" 명시.

### Task 6 — 전체 검증

- [ ] `pnpm test` (단위 + integration mock 모두 PASS, docker 의존 skip 유지)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [ ] `node scripts/ai-workflow-check.mjs --repo .`

### Task 7 — Architecture Pass + Cross-model

- [ ] grep 4종: 직접 supabase import 0, SidebarNav 하드코드 0, route-matrix 하드코드 0, middleware.ts 삭제 확인
- [ ] Cross-model review (Opus + Codex 병렬). 같은 PR 안에서 추가 fix가 필요한 항목은 즉시, 큰 디자인 결정은 다음 phase 또는 별도 PR.

---

## Verification Strategy

- 단위: `pnpm test` — 기존 98 케이스 + Task 2의 routes import 변경 + Task 3의 import path 변경 + Task 5의 type 호환 (없으면 기존 케이스가 깨짐) 모두 PASS.
- 통합: docker 부재로 supabase 통합 테스트는 skip 유지. 그러나 unit-mock 기반 admin/middleware matrix는 그대로 PASS.
- 빌드: `pnpm build` — deprecation warning 사라짐. (paywall/subscription `Static` 전환은 C7 Phase 4 이월 결정 후이므로 이 PR에선 검증 대상 아님.)

## Risks

- types.ts **5 테이블** hand-align 시 enum/jsonb/array/citext 처리 실수 가능. typecheck가 1차 안전망. Phase 4 진입 시 supabase CLI 도입되면 즉시 regen으로 교체 + 나머지 9 테이블 추가.
- middleware → proxy rename은 Next.js 16 컨벤션. 우리 deprecation warning 외 의존하는 외부 도구 없음(CI는 pnpm build 통과 여부만 본다).
- B5 cache headers Phase 4 이월: 시그니처 미검증인 채 Phase 4까지 ledger에 carry-forward로 남아 있어야 함. 잊혀질 위험 → cleanup ledger와 Phase 4 light spec 양쪽에 명시.
- C7 paywall/subscription Phase 4 이월: Phase 3 shell contract와 `(workspace)` 안 force-dynamic이 부딪힘이 그대로 남음. Phase 4가 옵션 (a/b/c) 결정해야 종결.
