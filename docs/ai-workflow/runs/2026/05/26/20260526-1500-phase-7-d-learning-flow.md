# Run Ledger — Phase 7-D · 학습 흐름 보강 (Tasks 5/6/7/8/11/12)

## Run Metadata

- Run id: 20260526-1500-phase-7-d-learning-flow
- Created: 2026-05-26 15:00 KST
- Updated: 2026-05-26 15:00 KST
- Main session owner: Claude Code (Opus 4.7)
- Host: Claude Code
- Status: complete (Tasks 5/6/7/8/11/12 + Codex 3-round verification: Round 1 FAIL → 4 fixes → Round 2 FAIL → 1 fix → Round 3 **PASS**)
- Phase: 7-D (sub-phase of Phase 7)

## Task

- User goal: Plan rev3 7-D — 6 task. 학습 흐름의 spec-vs-impl 결함 채우기.
  - Task 5 (P1-1): C-03 Retry Modal wiring — ProblemListView에 state + ProblemRow onClick
  - Task 12 (P1-8): C-02 추천/풀이 상태 필터 — sequential after Task 5 (ProblemListView 공유)
  - Task 6 (P1-2): R-02 NextProblemView expand — SummaryCardRow + AlternativeCardsGrid + getNextProblemBundle
  - Task 7 (P1-3): X-07 WeaknessView — DimensionTabs + DiagnosticCard
  - Task 8 (P1-4): D-M2 AnalysisLoadingModal — Steps + AnalysisCharacter
  - Task 11 (P1-7): B-01 dashboard — RecentFeedbackCard + AlertsCard
- Accepted scope: Plan rev3 §10 6 task + §7 Task별 AC.
- Out of scope: 7-E (Task 10 profile + Task 13 e2e), D-M3 trigger wiring (disable_attempt + exit_with_dirty), 실 LLM, Stripe, i18n
- Current next action: Task 5 — RetryModal wiring

## Docs Consulted

- `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md` rev3
- `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md`
- `docs/IA/{07,17,29,13,04,06}/description.md`
- 기존 컴포넌트: ProblemListView, ProblemRow, RetryModal, NextProblemView, WeaknessView, FeedbackPendingPanel, DashboardContent, ProblemListControls

## Decisions

| Time | Decision | Reason |
| --- | --- | --- |
| 2026-05-26 15:00 KST | 진행 순서: 5 → 12 → 6 → 7 → 8 → 11 (Plan rev3 §11) | Task 5↔12 ProblemListView 공유 sequential, 나머지 parallel-safe but sequential 진행으로 단순화 |

## Active Files

- Files expected to change/create:
  - **Task 5**: `src/components/practice/ProblemListView.tsx`, `src/components/practice/ProblemRow.tsx` modify
  - **Task 12**: `src/components/practice/ProblemListControls.tsx`, `src/components/practice/ProblemListView.tsx` modify, `src/lib/practice/queries.ts` modify, `src/lib/practice/types.ts` modify
  - **Task 6**: `src/components/practice/{SummaryCardRow,AlternativeCardsGrid}.tsx` new, `src/components/practice/NextProblemView.tsx` modify, `src/lib/practice/next.ts` modify
  - **Task 7**: `src/components/practice/{DimensionTabs,DiagnosticCard}.tsx` new, `src/components/practice/WeaknessView.tsx` modify
  - **Task 8**: `src/components/feedback/{AnalysisLoadingModal,AnalysisCharacter}.tsx` new, `src/components/feedback/FeedbackPendingPanel.tsx` modify
  - **Task 11**: `src/components/learning/{RecentFeedbackCard,AlertsCard}.tsx` new, `src/components/learning/DashboardContent.tsx` modify
  - Tests: 핵심 단위 테스트 1-2개씩 per task
- Files explicitly not to touch: admin 영역, writing 컴포넌트 (7-C에서 완료), auth 컴포넌트 (7-B에서 완료)

## Agent Assignments

| Agent | Role | Status |
| --- | --- | --- |
| Opus 4.7 (main) | 6 task sequential | active |
| Codex GPT 5.5 | Post-impl cross-review | pending (after Task 11) |

## Verification State

- Required checks (Plan rev3 §7 Task 5/6/7/8/11/12 AC):
  - [ ] 6 task 단위 테스트 PASS (per task RED test surface)
  - [ ] `pnpm vitest run` 전체 회귀
  - [ ] `pnpm typecheck` 0 errors
  - [ ] `pnpm lint` 0 errors
  - [ ] Codex post-impl cross-review
  - [ ] `node scripts/ai-workflow-check.mjs` PASS
- Cross-model review: **Codex 3-round PASS** 2026-05-26 (Round 1 FAIL 2 P1+2 P2 → Round 2 FAIL 1 P1 → Round 3 PASS). Outputs: `tasks/codex-output-phase-7-d-postimpl-{20260526,round2-20260526,round3-20260526}.md`. 핵심 fix: RetryModal 라우트 정합(/writing/[N]?problem=...&fresh=1 + /writing/feedback/{short|long}/[id]) + submissionId 흐름 (ProblemRowWithState.latestSubmissionId + fetchUserSolveMap) + dashboard query embedded join (writing_submissions!inner question_no) + Task 12 client-side filter limitation 명시 defer (Risks 섹션, follow-up server RPC).
- Architecture Pass: passed — audience: user. 신규 컴포넌트 모두 `src/components/{practice,feedback,learning}/` 안. admin 영역 미변경
- Light Spec: docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md
- UX/UI Consistency Pass: passed
  - Tokens: passed — Ant Design 표준 토큰만, hardcoded color 없음. 정본 docs/ant-design/02-global-styles.md
  - Components: passed — Tabs / Card / Switch / Select / Progress / Steps / Statistic / List 등 표준 사용
  - A11y: passed — 신규 컴포넌트 aria-label 명시 (DimensionTabs, ChecklistRow, ProblemListControls 풀이 상태/추천 toggle 등)
  - Responsive: passed — Row/Col 24/16/8 분할 + AlternativeCardsGrid auto-fit. 360/768/1280 실 검증은 Task 13 Playwright
- QA Gate: degraded — manual QA defer to Task 13 (7-E 골든 패스 e2e) | dev 서버 부팅 + 학습 영역 routes 직접 확인 미수행 (storageState 필요) + vitest 400/400 + typecheck 0 errors로 정적 검증 | 잔여 위험: 6 task 실제 사용자 flow에서 시각 회귀 / 데이터 흐름 정합은 Task 13 골든 패스 e2e에서 통합 검증
- QA Gate degraded accepted by 사용자 — 2026-05-26 (사용자 결정: "남은 작업 모두 순차적으로 직행하고, 각각 phase 가 끝날때 마다 깃에 커밋" — Task 13 e2e가 통합 검증 책임. 7-D 단독 manual QA는 7-E에 흡수)

## Fallback State

- Normal path blocked: 없음
- Failure class: none
- Completion allowed: pending

## Ledger/File-State Consistency

- Files changed match accepted scope: pending
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Task 6 getNextProblemBundle RPC 확장 — 실 RPC는 supabase function이 아닌 client-side function (`src/lib/practice/next.ts`). 분량 큼.
- Task 7 DimensionTabs — feedback_dimension_scores aggregate 필요 (현재 시드는 1 submission의 6 dim 만)
- Task 11 RecentFeedbackCard query — N+1 회피 (join 사용)
- **Task 12 client-side post-filter 한계 (Codex Round 1 P1-2 명시 accept)**: `fetchUserProblemList`는 `fetchProblemList` (server-side range pagination) 결과를 client-side `recommended/solveStatus` filter로 후처리. 결과: "추천만"/"풀이 상태" 적용 시 현재 page가 비어 보이거나 total이 부정확. **명시 follow-up**: `listUserProblems` SECURITY DEFINER RPC 신설로 server-side filter — 본 sub-phase 후 별도 follow-up PR. Plan rev3 §10 R-N으로 분류.
- Task 5 RetryModal 라우트 정합 fix (Codex Round 1 P1-1 immediate fix): `/practice/problems/[id]?fresh=1` → `/writing/[questionNo]?problem=[id]&fresh=1`. `/feedback/[id]` → `/writing/feedback/{short|long}/[id]` (question_no 51/52는 short, 53/54는 long). submissionId/questionNo 부재 시 `/practice/problems` 폴백. RetryModal에 `questionNo: number | null` prop 추가, ProblemListView가 retryTarget.question_no 전달. 7 test 케이스 갱신.
- Task 11 (Codex Round 1 P2-1 immediate fix): dashboard query에 `writing_submissions!inner(question_no)` join 추가. RecentFeedbackCard가 question_no context를 받음. N+1 회피 + IA B-01 spec 정합.
