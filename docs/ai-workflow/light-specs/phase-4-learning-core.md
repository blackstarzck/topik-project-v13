# Phase 4 — Learning Core (Light Spec)

> 1쪽 분량. 결정은 ledger, task는 plan.

## Core Functionality

1. **Learning Goal Setup 폼 완성 (A-03)** — 사용자가 TOPIK 급수, 목표 등급, 시험 일정, 학습 빈도, 취약 영역을 입력해 `learning_goals` row 생성/갱신. 저장 후 `/dashboard` redirect.
2. **Dashboard 실 콘텐츠 (B-01)** — KPI 요약 4개(오늘 시도 수 / 총 시도 수 / 시험 D-day / 연속 학습일) + 추천/진행 카드 + 시험 일정 카드 + 빈 상태(신규 사용자) 처리. **KPI는 server component에서 1회 fetch**(RSC + Supabase server client) → props로 KpiSummary에 전달. TanStack Query는 mutation/recommendation/problem list refetch 위주. "최근 첨삭"은 writing/feedback 도메인이라 Phase 5에서 추가.
3. **Problem Type Recommendations (C-01)** — 51/52/53/54 탭 + 추천 문제 카드 + 유형별 직접 선택 카드. `recommendation_runs`/`recommendation_items`에서 fetch.
4. **Problem List (C-02)** — `problems` 테이블에서 fetch + 유형/난이도/상태 필터 + 검색(debounce 300ms) + 정렬 + 페이지네이션(10/page).
5. **TanStack Query 도입** — client-side server state(추천 fetch, 문제 목록, KPI 집계). `@tanstack/react-query` 5.x은 이미 설치됨, provider만 추가.
6. **Phase 3 이월(types.ts) 일부 흡수** — Phase 4가 실제 fetch하는 테이블에 한해. learning_goals/problems/problem_assets/problem_attempts/recommendation_runs/recommendation_items 6 테이블은 이미 typed. 추가 없음.

## Out of Scope — Intentional Cuts

| 제외 | 이유 |
| --- | --- |
| Writing 문제 풀이 (D-01~D-04 실제 에디터) | Phase 5 (Writing And Feedback) 영역 |
| Attempt submission UI/페이지 (시도 객관식 객체 선택 후 채점) | Reading/listening 문제 seed 부재 + 풀이 UI 자체가 큰 작업 → Phase 4b 또는 다음 phase 분리 |
| Retry modal (C-03) | 풀이 흐름 일부 → 풀이 UI와 함께 다음 phase |
| Next problem recommendation (R-02 실 데이터) | 피드백 흐름 종속 → Phase 5 |
| Weakness recommendations (X-07 실 데이터) | `recommendation_runs.source_type='weakness'` 분기. Phase 4는 'dashboard' + 'next_problem' 기본만, weakness 분기는 다음 phase |
| Growth dashboard 실 데이터 (X-02) | KPI 충분, growth 분석은 Phase 5/6 |
| Problem CRUD admin (H-01) | Phase 6 admin scope |
| 실제 problem seed 데이터 입력 | DB 데이터 입력은 사용자 환경 또는 별도 seed PR (구조만 준비) |
| @supabase/ssr cache headers (Phase 3 carry-forward) | docker로 시그니처 검증 후 별도 PR. Phase 4 scope 외. |
| paywall/subscription `(workspace)` 이동 결정 (Phase 3 carry-forward) | billing scope 재개 시점에 결정. Phase 4 scope 외. |
| dashboard supabase query 최적화 (Phase 3 carry-forward) | cache headers와 짝지어 별도 PR. Phase 4는 TanStack Query 도입까지만. |
| types.ts 9개 미정의 테이블(writing/feedback/library/audit 도메인) | Phase 5·6 진입 또는 supabase CLI regen 시 |
| Browser e2e Playwright | 환경 의존, 별도 PR |
| Real-time subscriptions | TanStack Query refetch on focus만. Realtime은 다음 phase. |

## Minimum Acceptable Behavior

- 로그인 사용자가 `/onboarding/learning-goal` 진입 → 필수 필드 입력 → 저장 성공 → `/dashboard`로 redirect.
- 학습 목표 없는 사용자가 `/dashboard` 진입 → middleware/page가 `/onboarding/learning-goal`로 redirect (Phase 3 동작 유지).
- 학습 목표 있는 사용자가 `/dashboard` 진입 → KPI 4개 + 추천 카드 + 시험 일정 표시. 데이터 없으면 빈 상태 메시지.
- `/practice/recommendations` 진입 → 51/52/53/54 탭 + 사용자 맞춤 추천 카드. 추천 없으면 직접 선택 카드만.
- `/practice/problems` 진입 → 문제 행 10개 (페이지당) + 필터 + 검색 + 정렬. RLS 안에서 자기에게 보이는 problems만.
- 모든 fetch는 loading/error/empty 상태 표시.
- 모바일 반응형 깨지지 않음 (sidebar collapse, 카드 stacked layout).

## User Flow

`docs/flow/user-flow.md` 기준. Phase 4 진입선:

```
Login → /dashboard → (no goal) → /onboarding/learning-goal → 입력 → 저장 → /dashboard
       → (has goal) → KPI + 추천 카드 → /practice/recommendations
                                     → /practice/problems → (Phase 5에서 풀이)
```

## Domain Boundary

폴더(정본은 코드 폴더, `docs/domain-glossary.md` 참조):

- `src/lib/learning/` (신규) — `learning_goals` queries/mutations, KPI 집계 helpers
- `src/lib/practice/` (신규) — `problems`/`recommendation_*` queries
- `src/components/learning/` (신규) — KPI card, recommendation card, empty state
- `src/components/practice/` (신규) — problem row, filter/search/sort controls, pagination
- `src/app/providers.tsx` (변경) — TanStack QueryClientProvider 추가
- `src/app/(workspace)/onboarding/learning-goal/page.tsx` (변경) — 폼 본격 구현
- `src/app/(workspace)/dashboard/page.tsx` (변경) — placeholder → 실 콘텐츠
- `src/app/(workspace)/practice/recommendations/page.tsx`, `/problems/page.tsx` (변경) — placeholder → 실 콘텐츠

손대지 않는 도메인: `src/lib/writing/` (Phase 5), `src/lib/feedback/` (Phase 5), `src/lib/auth/`, `src/lib/supabase/` (Phase 2 그대로).

## Success Criteria

- `pnpm test`: 신규 단위 + 통합 테스트 추가. 기존 98+ 유지.
- `pnpm test:e2e` 또는 vitest 통합: onboarding → dashboard → recommendations → problem list 흐름 1회 (mock 또는 SUPABASE_LOCAL_STACK gated).
- `pnpm lint`, `pnpm typecheck`, `pnpm build` PASS.
- `node scripts/ai-workflow-check.mjs --repo .` PASS.
- Architecture Pass: route handler/page는 thin, queries는 `src/lib/learning|practice/`에 집중, 도메인 간 import 누수 없음, TanStack Query usage는 client 컴포넌트에만.
- Cross-model review PASS (Opus + Codex, 5-pass 한도 내).
- Plan-Review PASS Gate (§3a) — 사전 리뷰 FAIL 시 재리뷰 PASS 확인 후 구현.
