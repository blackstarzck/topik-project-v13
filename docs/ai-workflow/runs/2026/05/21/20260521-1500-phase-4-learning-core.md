# Phase 4 — Learning Core Ledger

## Run Metadata

- Run id: 20260521-1500-phase-4-learning-core
- Created: 2026-05-21 15:00 KST
- Updated: 2026-05-21 16:30 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: review-closeout (post-implementation cross-review applied)
- Phase: 4-learning-core

## Task

- User goal: Learning Goal Setup 폼 + Dashboard 실 콘텐츠 + Problem Type Recommendations + Problem List를 RLS 안에서 실 데이터로 동작. TanStack Query 도입.
- Accepted scope: light spec(`phase-4-learning-core.md`)의 Core Functionality 6개 + plan의 12 task. Reading/listening 풀이/attempt submission/writing은 의식적 deferral.
- Out of scope: Writing 풀이(Phase 5), Attempt submission UI, Retry modal, Next problem 실 데이터, Growth dashboard, Admin CRUD, problem seed 입력, Phase 3 carry-forward 3건(B5 cache headers / C7 paywall move / dashboard query 최적화), types.ts 9 테이블 추가, Playwright e2e, Realtime, 폼 i18n.
- Current next action: Plan-Review PASS Gate 종결 (3-pass: FAIL→CONCERN→PASS). 구현 진입.

## Plan-Review PASS Gate (record)

| Round | Verdict | Catch | Action |
| --- | --- | --- | --- |
| 1 (pre-implementation) | FAIL | P1×2 + P2×4: KPI inconsistency, Task 2 narrow RED/GREEN, SBU mutation 누락, URL state owner 분산, X-07 누락, manual gate 명시 누락 | All layers 동시 갱신 (cleanup PR 5-pass 학습) |
| 2 | CONCERN | light spec L8 KPI 표현 + Out of Scope X-07 미반영 (Edit cache silent fail) | Read 후 명시 Edit 재시도 |
| 3 | **PASS** | 두 항목 모두 closed | 종결 |

## Docs Consulted

- Exact files read:
  - `docs/spec.md`, `docs/development/{stack,backend-auth}.md`
  - `docs/sitemap.md`
  - `docs/IA/{04-B-01-home-dashboard,03-A-03-learning-goal-setup,05-C-01-problem-type-recommendations,06-C-02-problem-list}/description.md`
  - `docs/flow/user-flow.md` (Phase 4 진입선만)
  - `docs/ai-workflow/light-specs/phase-4-learning-core.md`
  - `docs/ai-workflow/runs/2026/05/21/20260521-1200-residual-risks-cleanup.md` (Phase 3 carry-forward)
  - `supabase/migrations/{20260520120100_profiles_goals,20260520120200_problems,20260520120300_attempts,20260520120600_recommendations,20260520121100_rls_policies}.sql`
  - `src/lib/supabase/types.ts` (이미 hand-aligned 7 테이블 활용)
- Extracted requirements:
  - TanStack Query 5.x 도입 (stack.md 확정)
  - RLS 그대로 사용 (Phase 2 정책)
  - A-03 폼 필수: 목표/시험일/언어, 과거 날짜 불가
  - B-01 KPI 4개 + 추천 카드 3개 + 시험 일정
  - C-01 51/52/53/54 탭 + 추천 카드
  - C-02 필터/검색/정렬/페이지네이션 10/page
- Doc conflicts: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 15:00 | Phase 4 scope에서 attempt submission UI + writing 풀이 제외 | Phase 5 영역 + problem seed 부재. Phase 4b로 분리 가능성 | sitemap + light spec |
| 2026-05-21 15:00 | TanStack Query 도입(stale 30s, refetchOnFocus true) | stack.md 확정 + client-side server state 필요 첫 phase | docs/development/stack.md |
| 2026-05-21 15:00 | Phase 3 carry-forward 3건은 별도 PR | scope 분리. Phase 4는 학습 도메인 본격에 집중 | Phase 3 ledger |
| 2026-05-21 15:00 | KPI 집계는 server 측 1회 fetch, TanStack Query는 mutation/refetch 위주 | server component 활용도 + 초기 렌더 빠르게 | spec.md State Management |
| 2026-05-21 16:00 | Codex 사전 리뷰 P1×2 + P2×4 반영 — 모든 layer 동시 갱신 (cleanup PR 5-pass 학습) | (1) KPI를 4개로 정밀화(오늘 시도/총 시도/D-day/연속 학습일) — Phase 4 typed 6 테이블만으로 계산. "최근 첨삭"은 Phase 5. (2) Task 2를 2a/2b/2c/2d로 분리(server/queries/mutations/kpi 각각 RED→GREEN). (3) SBU에 mutation + error notification 포함. (4) URL state owner를 problem list page로 명확화. (5) Out of Scope에 X-07 weakness 추가. (6) Verification Strategy에 자동/수동 gate 분리 명시. | Codex Phase 4 plan pre-review |
| 2026-05-21 15:00 | onboarding gate 동작 Phase 3 그대로 유지 | dashboard/page.tsx에 hasLearningGoal 체크 + redirect | Phase 3 light spec L31 |
| 2026-05-21 15:00 | Plan revision은 모든 layer 동시 갱신 (cleanup PR 5-pass 학습) | scope summary + task body + prose + verification 동시 | docs/ai-development-workflow.md §1c |

## Active Files

- Files expected to change/create: plan §File Structure 참조
- Files inspected: 위 Docs Consulted + supabase 마이그레이션 5개 + Phase 3에서 만든 placeholder pages
- Files changed:
  - 신규: `src/app/providers.tsx` (TanStack QueryClientProvider 추가) — Task 1
  - 신규: `src/lib/learning/{server,queries,mutations,kpi}.ts` — Task 2a/2b/2c/2d
  - 신규: `src/lib/practice/{types,queries}.ts` — Task 3
  - 신규: `src/components/learning/{LearningGoalForm,KpiCard,KpiSummary,RecommendationCard,UpcomingExamCard,EmptyDashboard,DashboardContent}.tsx` — Task 4/6 + 리뷰 후 추가
  - 신규: `src/components/practice/{ProblemTypeTabs,ProblemRow,ProblemListControls,ProblemListPagination,ProblemListView,RecommendationsView}.tsx` — Task 8/9
  - 수정: `src/app/(workspace)/{onboarding/learning-goal,dashboard,practice/recommendations,practice/problems}/page.tsx` — Task 5/7/9
  - 신규: `tests/lib/learning/{server,queries,mutations,kpi}.test.ts` (RED→GREEN per 2a/2b/2c/2d)
  - 신규: `tests/lib/practice/queries.test.ts` (Task 3 GREEN)
  - 신규: `tests/integration/learning-flow.test.ts` — onboarding gate + 리뷰 후 submit→save→dashboard load 추가
  - 수정: `docs/ai-workflow/{light-specs/phase-4-learning-core.md, plans/20260521-phase-4-learning-core.md}` — review-driven R-TZ/R-MOCK Risks 추가
- Files explicitly not to touch:
  - `supabase/migrations/*.sql` (schema 변경 없음 — RLS 정책 그대로)
  - `scripts/ai-workflow-check.mjs`, selftest, workflow docs (Phase 4 scope 외)
  - `src/middleware.ts` 대체 `src/proxy.ts` 그대로
  - `src/lib/supabase/*` (Phase 2 그대로)
  - `src/lib/auth/*` (Phase 2/3 그대로)

## Agent Assignments

| Agent | Role | Scope | Status | Packet |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정 + 구현 | plan 전체 | active | this ledger |
| codex (gstack) | 사전 plan 리뷰어 | plan 단독 | pending | task packet — plan path + Phase 4 scope |
| TBD (Opus subagent or codex) | Cross-model review reviewer (Task 12) | 구현 완료 diff | pending | 구현자의 반대 모델 |

## Verification State

- Required checks:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
  - `node scripts/ai-workflow-check.mjs --repo .`
- Checks run: pnpm install / lint / typecheck / test / build / workflow check — all post-fix runs PASS
- Latest results (2026-05-21 16:25 KST):
  - `pnpm test` — 139 passed / 3 skipped / 0 failed (14 test files passed, 2 skipped, integration submit-save-load 추가)
  - `pnpm typecheck` — PASS (0 errors)
  - `pnpm lint` — PASS (0 errors, 0 warnings)
  - `pnpm build` — PASS, all routes including dashboard/onboarding/practice 컴파일 + Proxy(Middleware) emit
  - `node scripts/ai-workflow-check.mjs --repo .` — PASS
- Known failures: n/a
- Skipped checks and reason:
  - learning-flow Supabase 실 fetch integration → SUPABASE_LOCAL_STACK gated (docker 부재). vitest mock 형태로 redirect matrix + submit→save→dashboard load 경로 coverage.
- Cross-model review:
  - Opus 4.7 (general-purpose) — VERDICT: CONCERN. P1×2: (a) KPI total-count test mock fragility, (b) R-TZ Vercel UTC. P2×7: 일관성, RED/GREEN 명시 부족, dashboard 47 lines, OoS i18n 드리프트, control stale-input. **Acted-on**: dashboard 47 → DashboardContent 추출(page 18 lines), R-TZ는 plan/ledger Risks + 코드 주석 명시(P5 follow-up).
  - codex (gstack) — VERDICT: CONCERN. P1×1: R-TZ (Opus와 일치). P2×2: recommendations nested-select cast unsafe, integration form-to-dashboard 커버리지 누락. **Acted-on**: `normalizeJoined` 헬퍼로 array/object/null 정규화(queries.ts:114-150), integration test에 submit→save→dashboard load 추가(learning-flow.test.ts:75-117).
  - Convergence: 두 리뷰어 모두 R-TZ를 P1로 식별 — 동일 결론 ⇒ 명시적 P5 follow-up + 코드 주석으로 수용. 나머지는 둘 중 하나만 catch했으며 모두 반영.
- Architecture Pass: PASS (grep 결과)
  - A. supabase 직접 import in src/app or src/components: 0
  - B. 도메인 cross-import (learning ↔ practice, writing, feedback): 0
  - C. page.tsx 두께: onboarding 16 / dashboard 18 (post-refactor) / recommendations 8 / problems 8 — 모두 30줄 target 충족
  - D. TanStack hook은 모두 "use client" 컴포넌트 한정
  - E. workflow checker PASS
- Light Spec: docs/ai-workflow/light-specs/phase-4-learning-core.md

## Fallback State

- Normal path blocked: none
- Failure class: none
- Fallback used: n/a
- Evidence collected: n/a
- Completion allowed: pending
- Remaining fallback risk:
  - 실제 problem seed 부재 — list/recommendations 페이지 빈 상태만 표시. Phase 4 코드 자체는 0건/N건 모두 작동
  - docker 부재 → SUPABASE_LOCAL_STACK 통합 테스트 skip 유지

## Ledger/File-State Consistency

- Files changed match accepted scope: yes (light spec Out-of-Scope 12건 모두 미터치)
- Docs consulted match implemented behavior: yes (KPI 4개, A-03 폼 필수값, B-01/C-01/C-02 표면 모두 구현 또는 placeholder + Phase 5 defer 명시)
- Child result packets integrated: yes (Codex pre-review + Opus post-review + Codex post-review 3건 모두 ledger 반영)
- Verification state current: yes (post-fix 16:25 KST 실행 결과 기재)
- Remaining risks listed: yes (R-TZ P1, R-MOCK P2, problem seed, RLS unit-coverage gap)

## Risks And Follow-Up

- Remaining risks:
  - 실 problem seed 부재 → 사용자 환경에서 seed 후 실 흐름 검증 권장
  - KPI 집계 query가 무거울 수 있음 → Phase 3 carry-forward dashboard 최적화와 함께 별도 PR
  - learning_goals upsert RLS 정상 작동은 단위 테스트로 검증 안 됨 → integration test mock 또는 SUPABASE_LOCAL_STACK
  - **R-TZ (P1, accepted-for-Phase-4)**: `getDashboardKpi` system timezone day math. Vercel UTC에서 "오늘" boundary가 UTC-day가 되어, 00:00–09:00 KST 윈도우의 todayAttempts/streakDays off-by-one. 코드 (kpi.ts:21-26) + 플랜 Risks에 명시. Phase 5 follow-up: dayjs/plugin/timezone Asia/Seoul 도입.
  - **R-MOCK (P2, follow-up)**: kpi.test.ts Supabase chain mock이 PostgrestFilterBuilder thenable 계약과 정확히 일치하지 않음. 회귀 시 자동 검출 어려움. Phase 5 SUPABASE_LOCAL_STACK gated integration으로 보강.
  - **R-CAST (resolved-in-PR)**: fetchProblemRecommendations 의 unsafe nested cast → `normalizeJoined` 헬퍼로 array/object/null 모두 처리하도록 수정 (queries.ts:114-150). 추가 follow-up 없음.
- Assumptions:
  - Phase 2/3 RLS 정책이 learning_goals + problems + recommendation_* 에 충분
  - TanStack Query 5.x가 Next.js 16 + React 19와 호환 (stack.md 확정)
- Follow-up needed:
  - PASS 후 사용자 commit/PR 결정
  - Phase 5 진입 시 carry-forward 정리(B5/C7/dashboard query 최적화 + writing 도메인 추가 + R-TZ 타임존 도입 + R-MOCK 통합테스트 강화)
