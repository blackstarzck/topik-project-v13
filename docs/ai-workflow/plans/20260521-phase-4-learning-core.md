# Phase 4 — Learning Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learning Goal Setup 폼(A-03) + Dashboard 실 콘텐츠(B-01) + Problem Type Recommendations(C-01) + Problem List(C-02)를 실 데이터(Supabase RLS)로 동작. TanStack Query로 client-side server state 도입. Reading/listening 문제 풀이 흐름과 attempt submission은 의식적 deferral (Phase 5 또는 Phase 4b).

**Architecture:** TanStack Query를 root provider에 추가. KPI 집계는 **server component에서 1회 fetch** (RSC + Supabase server client, props로 전달). 추천 카드/문제 목록/mutation은 TanStack Query 사용 (client). 도메인 query/mutation helper를 `src/lib/learning/` + `src/lib/practice/`에 분리. KPI 데이터는 Phase 4가 typed한 6 테이블(`learning_goals`, `problems`, `problem_assets`, `problem_attempts`, `recommendation_runs`, `recommendation_items`)만으로 계산 — 4개 KPI는 `오늘 시도 수 / 총 시도 수 / 시험 D-day / 연속 학습일`. "최근 첨삭"은 writing/feedback 도메인이라 Phase 5에서. RLS는 Phase 2/3에서 박힌 정책 그대로. Architecture Pass에서 page 두께 + 도메인 경계 점검.

**Tech Stack:** Next.js 16, React 19, Ant Design 6, `@tanstack/react-query@5.x` (이미 설치), `react-hook-form@7.x` + `zod@4.x` (form), Supabase server/browser client (Phase 2 wrapper).

---

## Docs Consulted

- `docs/spec.md` (§State Management Model: TanStack Query 도입 시점)
- `docs/development/stack.md` (TanStack Query 5.x 확정)
- `docs/development/backend-auth.md` (RLS 정책 그대로 사용)
- `docs/sitemap.md` (B-01, A-03, C-01, C-02 라우트)
- `docs/Wireframe/{04-B-01,03-A-03,05-C-01,06-C-02}/description.md` (UI 요구사항)
- `docs/flow/user-flow.md` (학습 흐름)
- `docs/ai-workflow/light-specs/phase-4-learning-core.md` (이 phase의 의도)
- `docs/ai-workflow/runs/2026/05/21/20260521-1200-residual-risks-cleanup.md` (Phase 3 carry-forward)
- `supabase/migrations/*.sql` (learning_goals, problems, problem_attempts, recommendation_runs/items 스키마)

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| Writing 문제 풀이 (D-01~D-04 에디터/자동저장/제출) | Phase 5 영역 |
| Attempt submission UI + 채점 흐름 | reading/listening problem seed 부재 + 풀이 UI 큰 작업. Phase 4b 또는 다음 phase |
| Retry modal (C-03), Next problem recommendation (R-02 실 데이터) | 풀이/피드백 흐름과 짝 → 다음 phase |
| Weakness recommendations (X-07 실 데이터) | recommendation_runs `source_type='weakness'` 분기. Phase 4는 'dashboard' + 'next_problem' 기본만 |
| Growth dashboard 실 데이터 (X-02) | Phase 5/6 |
| Admin CRUD (H-01, X-08, X-10) | Phase 6 |
| Problem seed 데이터 입력 | DB 데이터는 사용자 환경 또는 별도 seed PR. Phase 4 코드는 0건/N건 모두 정상 동작 |
| @supabase/ssr cache headers (Phase 3 carry-forward) | docker로 시그니처 검증 후 별도 PR |
| paywall/subscription `(workspace)` 이동 결정 (Phase 3 carry-forward) | billing scope 재개 시점 |
| dashboard supabase query 최적화 (Phase 3 carry-forward) | cache headers와 짝지어 별도 PR. Phase 4는 TanStack Query 도입까지만 |
| types.ts 9개 미정의 테이블(writing/feedback/library/audit) | Phase 5/6 또는 supabase CLI regen |
| Playwright e2e 풀 셋업 | 환경 의존, 별도 PR |
| Realtime subscriptions | TanStack Query refetch on focus만. Realtime은 다음 phase |
| 폼 i18n | UI 정책상 ko 우선. en/vi는 Phase 6 hardening |

## Smallest Buildable Unit

TanStack QueryClientProvider + server helpers(`getLearningGoal`/`hasLearningGoal`) + `useSaveLearningGoal()` mutation + Learning Goal Setup 폼(A-03 with success redirect + error notification) — 사용자가 처음 로그인했을 때 onboarding 폼을 채우고 저장하면 `learning_goals` row가 생기고 `/dashboard`로 redirect, 저장 실패 시 notification으로 안내. 이 SBU 단독으로 학습 흐름 entry point가 완성 동작 (성공 path + 실패 path 모두).

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/app/providers.tsx` (modify) | TanStack `QueryClientProvider` 추가. 기존 Ant Design `ConfigProvider`/`AntdApp` 유지 |
| `src/lib/learning/queries.ts` (new) | `useLearningGoal()`, `useDashboardKpi()`, `useUpcomingExam()` query hooks |
| `src/lib/learning/mutations.ts` (new) | `useSaveLearningGoal()` mutation hook |
| `src/lib/learning/server.ts` (new) | server-side `getLearningGoal(userId)`, `hasLearningGoal(userId)` (RSC + redirect gate에서 사용) |
| `src/lib/practice/queries.ts` (new) | `useProblemRecommendations({ questionNo })`, `useProblemList({ filters, page })` |
| `src/lib/practice/types.ts` (new) | `ProblemFilter`, `ProblemListItem`, `RecommendationCard` 등 도메인 type |
| `src/components/learning/KpiCard.tsx` (new) | Ant Design `Statistic` 기반 단일 KPI 카드 |
| `src/components/learning/KpiSummary.tsx` (new) | 4개 KPI 카드 grid + 빈 상태 |
| `src/components/learning/RecommendationCard.tsx` (new) | 추천 카드(추천 이유 포함) |
| `src/components/learning/UpcomingExamCard.tsx` (new) | 시험 일정 카드 |
| `src/components/learning/EmptyDashboard.tsx` (new) | 신규 사용자(KPI 0) 빈 상태 |
| `src/components/learning/LearningGoalForm.tsx` (new) | A-03 폼 — react-hook-form + zod, Ant Design `Form` |
| `src/components/practice/ProblemTypeTabs.tsx` (new) | 51/52/53/54 탭 |
| `src/components/practice/ProblemRow.tsx` (new) | 문제 행(번호/유형/난이도/상태/시작 액션) |
| `src/components/practice/ProblemListControls.tsx` (new) | 필터 + 검색(debounce 300ms) + 정렬 |
| `src/components/practice/ProblemListPagination.tsx` (new) | 페이지네이션 |
| `src/app/(workspace)/onboarding/learning-goal/page.tsx` (modify) | placeholder → LearningGoalForm 실 콘텐츠. 기존 goal 있으면 prefill |
| `src/app/(workspace)/dashboard/page.tsx` (modify) | placeholder → KpiSummary + RecommendationCard 묶음 + UpcomingExamCard. 기존 onboarding gate 유지 |
| `src/app/(workspace)/practice/recommendations/page.tsx` (modify) | placeholder → ProblemTypeTabs + RecommendationCard 묶음 |
| `src/app/(workspace)/practice/problems/page.tsx` (modify) | placeholder → ProblemListControls + ProblemRow list + ProblemListPagination |
| `tests/lib/learning/server.test.ts` (new) | `hasLearningGoal` + `getLearningGoal` 단위 |
| `tests/lib/practice/queries.test.ts` (new) | filter/sort/page param 합성 단위 |
| `tests/components/learning/LearningGoalForm.test.tsx` (new) | 필수 필드 검증, submit, 저장 실패 처리 |
| `tests/integration/learning-flow.test.ts` (new) | onboarding → dashboard redirect 매트릭스 (mock-based) |

## Tasks

| # | Task | Files | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 1 | TanStack QueryClientProvider 추가 + 기본 옵션 (staleTime 30s, refetchOnFocus true) | `src/app/providers.tsx` | N — 모든 후속 task의 prerequisite |
| 2a | `src/lib/learning/server.ts` (server helpers) + 단위 테스트 | `src/lib/learning/server.ts`, `tests/lib/learning/server.test.ts` | N — RED→GREEN, server-only |
| 2b | `src/lib/learning/queries.ts` (`useLearningGoal` client hook) + 단위 테스트 | `src/lib/learning/queries.ts`, `tests/lib/learning/queries.test.tsx` | Y — TanStack mock test 독립 |
| 2c | `src/lib/learning/mutations.ts` (`useSaveLearningGoal` upsert) + 단위 테스트 | `src/lib/learning/mutations.ts`, `tests/lib/learning/mutations.test.tsx` | Y — TanStack mock test 독립 |
| 2d | KPI server-aggregator (`src/lib/learning/kpi.ts`) + 단위 테스트 — 오늘 시도/총 시도/D-day/연속 학습일 계산 (problem_attempts + learning_goals만) | `src/lib/learning/kpi.ts`, `tests/lib/learning/kpi.test.ts` | Y — 순수 server함수, mock supabase client |
| 3 | `src/lib/practice/{queries,types}.ts` 작성 + 단위 테스트 | `src/lib/practice/*`, `tests/lib/practice/*` | Y — learning과 독립 모듈 |
| 4 | LearningGoalForm + 단위 테스트 (A-03 실 콘텐츠) | `src/components/learning/LearningGoalForm.tsx`, `tests/components/learning/LearningGoalForm.test.tsx` | N — Task 2 mutation에 의존, form 검증 동시 |
| 5 | Onboarding page를 폼으로 교체 + 기존 goal prefill | `src/app/(workspace)/onboarding/learning-goal/page.tsx` | N — Task 2·4 통합 |
| 6 | KpiCard/KpiSummary/RecommendationCard/UpcomingExamCard/EmptyDashboard 컴포넌트 | `src/components/learning/{KpiCard,KpiSummary,RecommendationCard,UpcomingExamCard,EmptyDashboard}.tsx` | Y — Task 2 query hook 시그니처 확정 후 시작. UI 독립 |
| 7 | Dashboard page에 KpiSummary + Recommendation 묶음 + UpcomingExam 통합 | `src/app/(workspace)/dashboard/page.tsx` | N — Task 6 후 통합 |
| 8 | ProblemTypeTabs/ProblemRow/ProblemListControls/ProblemListPagination 컴포넌트 | `src/components/practice/*` | Y — Task 3 query hook 시그니처 확정 후 시작 |
| 9 | Recommendations + Problem List 페이지에 실 콘텐츠 통합 | `src/app/(workspace)/practice/{recommendations,problems}/page.tsx` | N — Task 3·8 통합 |
| 10 | onboarding → dashboard redirect 통합 테스트 (mock-based) | `tests/integration/learning-flow.test.ts` | Y — Task 5·7 완료 후 독립 검증 |
| 11 | 전체 검증 (pnpm test/lint/typecheck/build + workflow check) | (전체) | N — main session 종합 |
| 12 | Architecture Pass (grep) + Cross-model review (Opus + Codex) | (전체 + ledger) | N — main session 조정 |

---

### Task 1 — TanStack QueryClientProvider

- [ ] Step 1: `src/app/providers.tsx`에 `QueryClient` 인스턴스 + `QueryClientProvider` 추가. `staleTime: 30_000`, `refetchOnWindowFocus: true` 기본. 기존 `ConfigProvider`/`AntdApp` wrap 유지.
- [ ] Step 2: `pnpm typecheck` 통과 확인 (이미 `@tanstack/react-query` 설치됨).
- [ ] Step 3: 빌드 확인 (`pnpm build`).

### Task 2a — Learning server helpers (RED→GREEN)

- [ ] Step 1: `tests/lib/learning/server.test.ts` RED — `hasLearningGoal(userId)` true/false, `getLearningGoal(userId)` row/null. mock supabase server client.
- [ ] Step 2: `src/lib/learning/server.ts` — server-only. `createSupabaseServerClient` 사용. RLS로 자기 row만.
- [ ] Step 3: test GREEN.

### Task 2b — useLearningGoal client query hook (RED→GREEN)

- [ ] Step 1: `tests/lib/learning/queries.test.tsx` RED — query key 정합성(`['learning-goal', userId]`), loading 상태, error 상태.
- [ ] Step 2: `src/lib/learning/queries.ts` — `useLearningGoal()` using TanStack Query + browser supabase client. queryKey 인자로 userId.
- [ ] Step 3: test GREEN.

### Task 2c — useSaveLearningGoal mutation (RED→GREEN)

- [ ] Step 1: `tests/lib/learning/mutations.test.tsx` RED — upsert 성공/실패, onSuccess 시 invalidate `['learning-goal']`, error 발생 시 message 노출.
- [ ] Step 2: `src/lib/learning/mutations.ts` — `useSaveLearningGoal()` (browser, upsert). onSuccess에서 queryClient.invalidateQueries.
- [ ] Step 3: test GREEN.

### Task 2d — KPI server-aggregator (RED→GREEN)

- [ ] Step 1: `tests/lib/learning/kpi.test.ts` RED — 4 KPI 계산 케이스:
  - 오늘 시도 수: `problem_attempts` count where `started_at >= today (KST)`
  - 총 시도 수: `problem_attempts` count
  - 시험 D-day: `learning_goals.exam_date - today` (없거나 과거면 null)
  - 연속 학습일: `problem_attempts.started_at`의 unique date streak
  Phase 5 wiring 준비를 위해 "최근 첨삭"은 시그니처에 placeholder(null)로 노출.
- [ ] Step 2: `src/lib/learning/kpi.ts` — `getDashboardKpi(userId, supabase)` 순수 함수 형태. server에서 호출.
- [ ] Step 3: test GREEN. dayjs로 timezone(KST) 처리.

### Task 3 — Practice queries/types

- [ ] Step 1: `src/lib/practice/types.ts` — `ProblemFilter` (question_no/difficulty/status), `ProblemListItem`, `RecommendationCard`.
- [ ] Step 2: `src/lib/practice/queries.ts` — `useProblemRecommendations({ questionNo })`, `useProblemList({ filters, page, pageSize: 10 })`.
- [ ] Step 3: 단위 테스트 — query param 합성 (filter null/빈 배열, page 1-based, sort 옵션).
- [ ] Step 4: GREEN.

### Task 4 — LearningGoalForm

- [ ] Step 1: react-hook-form + zod schema 정의 — topik_level, target_grade, exam_date(과거 날짜 불가), weekly_goal_minutes, weak_areas (multi-select).
- [ ] Step 2: Ant Design `Form` + `Select`/`DatePicker`/`InputNumber`. 필수값 누락 시 submit 비활성.
- [ ] Step 3: submit → `useSaveLearningGoal()` 호출 → 성공 시 `router.push('/dashboard')`. 실패 시 `App.notification.error()`.
- [ ] Step 4: 단위 테스트 — 필수값 검증, 과거 날짜 reject, submit 성공/실패 path.

### Task 5 — Onboarding page

- [ ] Step 1: server component로 `getLearningGoal(userId)` 1회 prefetch (기존 goal 있으면 prefill 데이터).
- [ ] Step 2: `<LearningGoalForm defaultValues={...}>` 렌더.
- [ ] Step 3: 페이지 thin 유지 (20줄 이하).

### Task 6 — Learning UI components

- [ ] Step 1: KpiCard — Ant Design `Statistic` + label, value, hint. props로 다양화.
- [ ] Step 2: KpiSummary — 4 KpiCard grid (`md:grid-cols-4`). 0값일 때 EmptyDashboard로 fallback.
- [ ] Step 3: RecommendationCard — 카드 제목 28자 truncate, 본문 2줄. props: title, reason, ctaHref.
- [ ] Step 4: UpcomingExamCard — exam_date 까지 D-day 계산 + dayjs format.
- [ ] Step 5: EmptyDashboard — Ant Design `Empty` + "시작하기" CTA → `/practice/recommendations`.

### Task 7 — Dashboard page

- [ ] Step 1: server component로 `requireUser` + `hasLearningGoal` 체크. goal 없으면 `redirect('/onboarding/learning-goal')` (Phase 3 동작 유지).
- [ ] Step 2: `getDashboardKpi(user.id, supabase)` (Task 2d) 호출. 결과(kpi) props로 KpiSummary에 전달. 모든 4 KPI가 0이거나 D-day null이면 EmptyDashboard 렌더, 아니면 KpiSummary + RecommendationCard 묶음(최대 3개) + UpcomingExamCard.
- [ ] Step 3: 페이지 30줄 이하 유지. KPI 4개: 오늘 시도 / 총 시도 / 시험 D-day / 연속 학습일.

### Task 8 — Practice UI components (controlled, page가 owner)

> **URL state owner**: `/practice/problems/page.tsx`가 search params 파싱/쓰기 owner. components는 controlled (props로 받고 callback으로 알림). `useDeferredValue` 또는 `useDebounce`는 controls 안에서 input → callback debounce, 다만 URL 갱신은 page 책임. 라우터 리렌더 무한 루프 방지 — 컴포넌트가 직접 `router.push` 호출 금지.

- [ ] Step 1: ProblemTypeTabs (`active: '51'|'52'|'53'|'54'`, `onChange`) — Ant Design `Tabs` controlled.
- [ ] Step 2: ProblemRow — Ant Design `List.Item`. 번호/유형/난이도(`Tag`)/상태(`Badge`)/시작 액션(`Button`). 비활성 problem(`publish_status !== 'published'`)은 disabled.
- [ ] Step 3: ProblemListControls (`filters`, `search`, `sort`, `onFiltersChange`, `onSearchChange`, `onSortChange`) — 필터 칩(Ant Design `Tag.CheckableTag`) + Search input (내부 debounce 300ms via `useDebounce`/`useDeferredValue` → `onSearchChange`로 콜백) + Sort `Select`.
- [ ] Step 4: ProblemListPagination (`current`, `total`, `pageSize=10`, `onChange`) — controlled.

### Task 9 — Recommendations + Problem List 페이지 (URL state owner)

- [ ] Step 1: `/practice/recommendations/page.tsx` — server fetch + ProblemTypeTabs (controlled) + RecommendationCard list. 추천 없음 시 직접 선택 카드 4개. `?type=51` URL sync는 client wrapper에서 `useSearchParams` + `router.replace` (page가 owner).
- [ ] Step 2: `/practice/problems/page.tsx` — Controls + Row list + Pagination 모두 controlled. URL params `?type=51&difficulty=3&status=published&q=...&sort=newest&page=2` 파싱 + 갱신은 page 책임. search debounce 300ms는 Controls 안에서 처리하되 최종 commit만 URL.
- [ ] Step 3: 페이지 두께 30-50줄 정도 (URL state owner라 약간 두꺼움. 단 로직은 helpers/components로).
- [ ] Step 4: 통합 테스트 — type/filter/search/sort/page 갱신 후 URL 동기, page 갱신 후 무한 루프 없음.

### Task 10 — learning flow integration test

- [ ] Step 1: vitest mock — anon user goal 없으면 dashboard 진입 시 onboarding redirect, goal 있으면 dashboard 통과.
- [ ] Step 2: submit 시 mutation 호출 + redirect 검증.

### Task 11 — 전체 검증

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [ ] `node scripts/ai-workflow-check.mjs --repo .`

### Task 12 — Architecture Pass + Cross-model

- [ ] grep: page.tsx 두께(≤30), supabase 직접 import in src/app·components(0), 도메인 cross-import(0), TanStack `use*` hook은 client component에만
- [ ] Cross-model review (Opus + Codex 병렬). FAIL 시 §3a Plan-Review PASS Gate 적용 (재리뷰 PASS까지). CONCERN은 ledger에 accepted 또는 fix.

---

## Verification Strategy

- 단위: `pnpm test` — learning server/queries/mutations/kpi, practice queries, LearningGoalForm.
- 통합: learning-flow.test.ts — onboarding/dashboard redirect 매트릭스 + problem list URL sync 무한 루프 검증.
- 정적: lint, typecheck.
- 빌드: `pnpm build` — 페이지 모두 컴파일, TanStack provider 정상.
- 워크플로우 (자동): `node scripts/ai-workflow-check.mjs --repo .` — plan 필수 섹션, Subagent-eligible 컬럼, ledger Cross-model review + Light Spec 필드 검증.
- 워크플로우 (수동 gate, 검사기 미강제):
  - **Plan-Review PASS Gate (§3a)**: 사전 리뷰 FAIL 시 재리뷰 PASS 확인 후 구현. ledger Decisions 표에 round별 기록.
  - **Round 한도**: 기본 3-pass, workflow-governing 또는 첫 FAIL 시 4-5. 5+ 시 escalation 강제.
  - **Disagreement resolution**: commitment-level 충돌 시 입장+근거 ledger 명시 → 정량 기준 → 자기 약점 인정 라운드 → 사용자 escalation.

## Risks

- 실제 problem seed 부재로 list/recommendations 페이지가 빈 상태만 표시 가능. 의도된 동작 (사용자 환경에서 seed 후 검증).
- KPI 집계 query가 실제 데이터로 무거울 수 있음. 이번 phase는 단순 count + percent 계산. 최적화는 Phase 3 carry-forward dashboard query 최적화와 함께 별도 PR.
- TanStack Query staleTime 30s 기본. 학습 데이터 fetch가 너무 자주 일어나면 다음 phase에서 키 단위 조정.
- learning_goals upsert에서 RLS가 정상 작동하는지 — `profiles_self_select` 그대로지만 `learning_goals` insert/update 정책 확인 필요. 단위 테스트로 검증 안 됨 → integration test에서 mock 또는 SUPABASE_LOCAL_STACK gated.
- **R-TZ (P1, accepted-for-Phase-4)**: `getDashboardKpi`는 system timezone 기준 day math를 사용한다 (dayjs timezone plugin 미사용). Vercel 프로덕션(UTC)에서는 "오늘"이 UTC-day가 되어, 00:00–09:00 KST 사이 시도가 어제로 계산되는 off-by-one이 발생할 수 있다. Phase 4 단순화로 수용 — `kpi.ts:21-26` 주석에 명시. **Phase 5 follow-up**: `dayjs/plugin/timezone` + `Asia/Seoul` 도입 후 todayAttempts/streakDays/examDaysLeft 경계를 KST 기준으로 재계산.
- **R-MOCK (P2, follow-up)**: `tests/lib/learning/kpi.test.ts`의 Supabase chain mock은 `.from().select(..., {count, head})` 객체를 그대로 await하는 시나리오에 의존한다. 실제 PostgrestFilterBuilder의 thenable 계약을 정확히 재현하지 않으므로, Supabase 클라이언트 API 변경에 회귀가 통과될 수 있다. Phase 5에서 SUPABASE_LOCAL_STACK gated integration test로 보강.
