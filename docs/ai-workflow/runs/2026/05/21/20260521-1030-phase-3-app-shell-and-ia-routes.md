# Phase 3 — App Shell And IA Routes Ledger

## Run Metadata

- Run id: 20260521-1030-phase-3-app-shell-and-ia-routes
- Created: 2026-05-21 10:30 KST
- Updated: 2026-05-21 10:30 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: complete
- Phase: 3-app-shell-and-ia-routes  # phase marker for the checker

## Task

- User goal: Phase 3 시작 — 27개 active sitemap route shell, 보호 workspace 레이아웃, role-aware navigation, App Router 경계, onboarding/admin redirect 가드.
- Accepted scope: light spec(`docs/ai-workflow/light-specs/phase-3-app-shell-and-ia-routes.md`)의 6 core functionality + plan(`docs/ai-workflow/plans/20260521-phase-3-app-shell-and-ia-routes.md`)의 16 task.
- Out of scope: 실제 페이지 콘텐츠, 인증 form UI, 학습 데이터 fetch, 글쓰기 흐름, admin CRUD 본격 구현, billing, @supabase/ssr cache headers, RLS smoke 확장, 새 마이그레이션, 모든 보호 라우트에 onboarding redirect 강제.
- Current next action: codex consult로 plan 사전 리뷰 → 사용자 승인 → Task 1(types regen) 진입.

## Docs Consulted

- Exact files read:
  - `AGENTS.md`, `CLAUDE.md` (system reminder)
  - `docs/agent-index.md`
  - `docs/spec.md`
  - `docs/development/stack.md`
  - `docs/development/backend-auth.md` (Phase 2에서 이미 정독)
  - `docs/sitemap.md` (27 active route + 5 modal surface)
  - `docs/ai-workflow/light-specs/phase-3-app-shell-and-ia-routes.md`
  - `docs/ai-development-workflow.md` (§1b, §3, §3b, §4b)
  - `supabase/migrations/INDEX.md` (17개 정본)
  - Phase 2 ledger (이월 4건의 위치)
- Extracted requirements:
  - 27 active route 모두 thin placeholder 또는 layout 응답
  - Ant Design 우선, ConfigProvider/App provider 적용
  - role 기반 admin gate
  - Phase 2 이월 2건(types regen + getCurrentProfile)을 이 Phase에서 처리
  - 모바일/데스크탑 기본 반응형
- Doc conflicts: none
- Untouched relevant docs and reason:
  - `docs/IA/{...}/description.md` 매칭 화면별 description — Phase 3는 placeholder만 만들므로 task별 deep dive는 후속 phase. 다만 Task 6~12 진행 중 의문 시 해당 description 읽음.
  - `docs/ant-design/README.md` — Task 3 진행 직전에 deep dive(component 선택, 토큰 사용).

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 10:30 | Phase 2 이월 4건 중 types regen + getCurrentProfile은 Phase 3에서, 나머지(@supabase/ssr cache headers, RLS A/B 확장)는 별도 PR / Phase 4로 | scope 균형. types와 getCurrentProfile은 Phase 3 task가 직접 의존. cache headers는 라이브러리 검증 필요, RLS 확장은 problem seed 필요 | Phase 2 cross-model review |
| 2026-05-21 10:30 | (workspace) Route Group으로 보호 라우트를 묶음 | sitemap의 보호/공개 분리에 부합하고, layout 한 곳에서 가드 적용 가능 | spec.md §Source Structure |
| 2026-05-21 10:30 | onboarding redirect는 `/dashboard` + 핵심 진입에만 | 모든 라우트에 강제하면 placeholder 단계에서 부작용 큼. 본격 적용은 Phase 4 | light spec |
| 2026-05-21 10:30 | writing 라우트를 `[questionId]` dynamic으로 단일화(51~54만 허용) | DRY. 4개 별도 page.tsx보다 1개 + validation이 명확 | sitemap.md D-01~D-04 |
| 2026-05-21 10:30 | sign-up/password-reset placeholder는 workspace shell 없이 plain | 공개 라우트라 layout 적용 안 함. login placeholder와 동일 패턴 | Phase 2 login page |
| 2026-05-21 11:00 | Admin role 매트릭스를 route별 분리 + `requireRole(roles)` helper로 한 곳에 모음 | Codex P1 #1: 단일 게이트가 X-08(org_admin-only)을 위반. IA description.md `30-X-08-organization-admin-dashboard:29-31` 인용 | Codex Phase 3 plan 사전 리뷰 |
| 2026-05-21 11:00 | 기존 라우트(`/`, `/login`) "existing, verify only" 행을 File Structure에 명시 | Codex P1 #2: 27 route coverage 주장의 정합성. matrix test가 silent skip하지 않도록 | Codex Phase 3 plan 사전 리뷰 |
| 2026-05-21 11:00 | Task 1 fallback scope를 profiles + learning_goals minimum으로 축소(CLI 부재 시) | Codex P2: 17 마이그레이션 전체 hand-align은 부담 + Phase 5/6에서 자연 확장 | Codex Phase 3 plan 사전 리뷰 |
| 2026-05-21 11:00 | Onboarding gate를 (workspace)/layout.tsx가 아니라 /dashboard/page.tsx에서 | Codex P2: Next.js 16 server layout은 pathname을 직접 모름. dashboard 한 곳에 책임 두면 의도(dashboard에만 적용)와 구현이 일치 | Codex Phase 3 plan 사전 리뷰 |
| 2026-05-21 11:00 | Task 6-11에 "Task 4 merged 후 시작" barrier 명시 | Codex P2: PlaceholderPage props가 frozen된 후 subagent 분산 안전 | Codex Phase 3 plan 사전 리뷰 |
| 2026-05-21 11:00 | feedback/report id format validation은 Phase 5의 data fetch와 함께 도입 (Phase 3는 raw 표시) | Codex P2: 의도된 deferral을 plan에 명시 | Codex Phase 3 plan 사전 리뷰 |

## Active Files

- Files expected to change/create: plan §File Structure 표 참고 (37개 신규 + 2개 변경)
- Files inspected: 위 Docs Consulted와 동일
- Files changed:
  - 변경 (`modify`):
    - `src/lib/supabase/types.ts` — learning_goals 테이블 추가 (Task 1)
    - `src/lib/auth/profile.ts` — getCurrentProfile + requireRole + getSessionAndProfile + ADMIN_ROLES/AppRole re-export (Task 2 + Codex P2 #1 + P2 #2 fix)
    - `vitest.config.ts` — `@/*` alias 추가 (test infra)
  - 신규 (`new`):
    - `src/lib/auth/roles.ts` — client-safe AppRole + ADMIN_ROLES (Codex 빌드 에러 fix로 분리)
    - `src/components/app/{WorkspaceShell,SidebarNav,AppHeader}.tsx` — Task 3
    - `src/components/shared/{PlaceholderPage,AppLoading,AppError,AppNotFound}.tsx` — Task 4
    - `src/app/(workspace)/{layout,loading,error,not-found}.tsx` — Task 5 (force-dynamic)
    - `src/app/(workspace)/dashboard/page.tsx` — Task 6 (onboarding gate 포함)
    - `src/app/(workspace)/{growth,library,profile,settings/{language,notifications},practice/{recommendations,problems,next,weakness},onboarding/learning-goal,subscription,paywall}/page.tsx` — Task 6,7,8,11 (15 placeholder)
    - `src/app/(workspace)/writing/{[questionId],feedback/short/[id],feedback/long/[id],reports/[id]/compare}/page.tsx` — Task 9 (dynamic 포함, 4 page)
    - `src/app/(workspace)/admin/{layout,page,problems/page,org/page,users/page}.tsx` — Task 10 (1차+2차 게이트, Codex P2 #2 fix 후 positive allowlist + admin/page에 requireRole 추가)
    - `src/app/{sign-up,password-reset}/page.tsx` — Task 12 (공개 placeholder)
    - `tests/lib/auth/profile-getCurrentProfile.test.ts` — Task 2 단위 5 케이스
    - `tests/integration/route-matrix.test.ts` — Task 13 52 케이스
    - `tests/integration/admin-role-matrix.test.ts` — Task 13 보강 21 케이스 (Opus P1 #7 fix)
- Files explicitly not to touch:
  - `supabase/migrations/*.sql` (schema 수정 없음)
  - `AGENTS.md`, `CLAUDE.md`
  - `scripts/ai-workflow-check.mjs` (확정)
  - `src/middleware.ts` (Phase 2에서 박힌 동작 유지. cache headers는 별도 PR)
  - `src/theme/*` (Phase 1 산출물)

## Agent Assignments

| Agent | Role | Scope | Status | Packet location or summary |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정자 + 구현 | plan 전체 | active | this ledger |
| codex (gstack) | plan 사전 리뷰어 | plan 단독 검수 | pending | task packet — plan/light spec path 전달 |
| TBD | Cross-model review reviewer (Task 16) | 구현 완료 diff | pending | 구현자의 반대 모델 |

## Child Result Packets

(미생성)

## Verification State

- Required checks:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`(가능 시), `pnpm build`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run:
  - Task 1: types.ts에 learning_goals 추가 — `pnpm typecheck` PASS
  - Task 2: getCurrentProfile + requireRole — 단위 테스트 5/5 PASS
  - Task 3-5: components + workspace layout/loading/error/not-found — typecheck PASS
  - Task 6-12: 27 route shells + admin index + 공개 라우트 — typecheck PASS
  - Task 13: route-matrix.test.ts — 52 케이스 PASS (anon public allow + anon protected redirect + auth pass-through)
  - Task 13 보강: admin-role-matrix.test.ts — 21 케이스 PASS (admin layout layer 1 + admin pages layer 2)
  - Task 14 §전체 검증 (cross-model fix + roles 분리 후):
    - `pnpm test` — 98 passed / 3 skipped (10 test files)
    - `pnpm typecheck` PASS
    - `pnpm lint` PASS
    - `pnpm build` PASS — 27 route + 4 공개 컴파일, middleware는 Proxy로 출력
    - `node scripts/ai-workflow-check.mjs --repo .` PASS
- Latest results: ALL GREEN (98/98 + 3 의도된 skip)
- Known failures: none
- Skipped checks and reason:
  - profile-trigger integration (Phase 2): SUPABASE_LOCAL_STACK gated
  - rls-smoke integration (Phase 2): 동일
  - admin role matrix (이 phase): 통합 시드 없이 layout/page 함수 직접 호출 + mock 패턴으로 검증. Playwright e2e는 별도 PR 또는 Phase 4 시점에.
- Cross-model review: Opus 4.7 (CONCERN, P1 1 + P2 7) + Codex GPT 5.5 (CONCERN, P2 8). 두 모델 동시 발견 4건 — admin gate test 누락(Opus P1), admin layout "non-learner" loose(양측 P2 #2), double getUser round-trip(양측 P2 #1), types.ts partial(양측 P2 #6/#5). 같은 PR fix 3건(P1 #7 + P2 #1 + P2 #2), Phase 4 이월 4건(SidebarNav 단일 source 분리, paywall/subscription static, id validation Phase 5, types 14 테이블 full regen).
- Architecture Pass: passed — 4 grep 모두 깨끗. (A) src/app·src/components 어디에도 @supabase/* 직접 import 없음. (B) lib/supabase·lib/auth에 도메인 import 누수 없음. (C) admin role 체크는 lib/auth/profile.ts(요청-스코프 helper) + lib/auth/roles.ts(client-safe 상수) + admin/* 4파일(2차 gate) + SidebarNav(메뉴 가시성 only) — 의도된 분리. (D) page.tsx에 antd 직접 import 없음(providers.tsx에 ConfigProvider/AntdApp만).
- Light Spec: docs/ai-workflow/light-specs/phase-3-app-shell-and-ia-routes.md
- Final report: docs/ai-workflow/runs/2026/05/21/20260521-1030-phase-3-app-shell-and-ia-routes.html (ledger 옆에 위치)

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: n/a
- Evidence collected: n/a
- Completion allowed: pending
- Remaining fallback risk:
  - supabase CLI 부재 시 types regen이 manual hand-align — 시간 부담, 실수 위험. typecheck가 1차 안전망
  - Playwright 첫 셋업 시간 초과 시 Task 13 vitest 변형(이미 Task 13의 default가 vitest, Playwright는 추가 옵션)

## Ledger/File-State Consistency

- Files changed match accepted scope: pending (구현 전)
- Docs consulted match implemented behavior: pending
- Child result packets integrated: pending
- Verification state current: pending
- Remaining risks listed: yes (아래)

## Risks And Follow-Up

- Remaining risks:
  - types regen 정확성 (manual 시)
  - 27 route 매트릭스 테스트의 무게 → describe 그룹 분리로 완화
  - dynamic route param validation 분산 위험 → 단일 helper로 일관성
  - mobile UX는 깨지지 않는 수준만 — 본격 polish는 Phase 4
- Assumptions:
  - Ant Design v6 + Next.js 16 App Router가 Phase 1 셋업 그대로 호환
  - Phase 2의 middleware가 그대로 작동하고 PUBLIC_PATHS 변경 불필요(sign-up/password-reset placeholder가 추가되어도 이미 public allowlist에 있음)
- Follow-up needed:
  - Task 1 진입 직전: supabase CLI 가용성 재확인
  - Task 13 직전: Playwright 셋업 가능 여부 확인 후 vitest fallback 결정
  - Phase 4 진입 시 모바일 UX 보강 + 학습 데이터 fetch
