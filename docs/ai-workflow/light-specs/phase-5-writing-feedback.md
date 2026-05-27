# Phase 5 — Writing And Feedback (Light Spec)

## Phase

- ID: phase-5-writing-feedback
- Phase row of `docs/ai-workflow/development-phases.md`: 5
- Started: 2026-05-21
- Owner: Claude Code (Opus 4.7, 1M context)

## Goal

Tier 1 MVP의 쓰기 학습 흐름 전체를 RLS 안에서 작동시킨다. 51/52/53/54 문제 풀이(자동저장 + 제출), AI 분석 결과 보기(점수/항목별/문장별), 이전 제출과의 비교 리포트.

## Out of Scope (deferred)

Phase 5는 sitemap의 D/E/R 그룹(쓰기 + 피드백 + 비교 리포트) 4 routes만 다룬다. 나머지 sitemap-active 항목은 다른 phase 소속이거나 향후 deferred다.

**Sitemap-active 항목 중 Phase 5 스코프 외 (각 phase별 소속 명시):**

| Code | Route | Owning Phase / Status |
| --- | --- | --- |
| X-01, A-01, A-02, X-06 | landing/sign-up/login/password-reset | Phase 2 완료 |
| A-03, B-01, C-01, C-02 | onboarding/dashboard/recommendations/problem list | Phase 4 완료 |
| C-03, R-02 | retry modal / next problem | Phase 6 |
| F-01, F-M1 | library + PDF export | Phase 6 |
| G-01, X-09 | language/notification settings | Phase 6 (현재 placeholder) |
| H-01, X-08, X-10 | admin problems/org/users | Phase 6 (admin role gate는 Phase 3 완료) |
| X-02 | growth dashboard | Phase 6 |
| X-03, X-04 | paywall/subscription | Phase 3 placeholder (Phase 3 carry-forward C7) |
| X-05 | profile | Phase 3 placeholder |
| X-07 | weakness recommendations | Phase 6 |

**Phase 5 자체 OOS (의도적 deferral):**

| ID | Item | Defer to |
| --- | --- | --- |
| OOS-1 | 실제 LLM 호출(OpenAI/Anthropic API) | Phase 6 / 인프라 단계. Phase 5는 **mock feedback fixture**로 흐름만 검증 |
| OOS-2 | D-M2 AI 분석 로딩의 Realtime progress | Phase 6. Phase 5는 `feedback_status` 기반 단순 polling만 |
| OOS-3 | F-M1 PDF export | Phase 6 |
| OOS-4 | X-07 weakness 추천 wiring | Phase 6 |
| OOS-5 | comparison_reports 자동 생성 | Phase 5는 명시적 CTA만. 자동 비교는 Phase 6 |
| OOS-6 | Admin CRUD | Phase 6 |
| OOS-7 | i18n form labels | 향후 |
| OOS-8 | R-02 reading/listening attempt UI | Phase 6 |
| OOS-9 | Growth dashboard 확장 | Phase 6 |
| OOS-10 | Phase 3 carry-forward 3건 (B5/C7/dashboard opt) | 별도 PR |
| OOS-11 | Playwright e2e | Phase 6 |
| OOS-12 | Realtime autosave conflict resolution | Phase 6 |

## Core Functionality

1. **Writing editor** (D-01~D-04, `/writing/[questionId]`):
   - 51/52/53/54 question type별 입력 검증 (글자수 제약, 입력 모드)
   - `writing_drafts` autosave: 입력 debounce(2s) → upsert, autosave_status 상태 배지(clean/dirty/syncing/failed)
   - **D-M1 제출 확인 모달**: 필수 — 글자수 검증 통과 후에만 활성, 제출 시 `writing_submissions` insert + `writing_drafts.autosave_status='superseded'`
2. **Feedback view** (E-01 short / E-02 long, `/writing/feedback/{short,long}/[id]`):
   - 점수/총평 요약 (writing_feedback) + 항목별 카드 (feedback_dimension_scores)
   - long-form 전용: 문장별 첨삭 (sentence_feedback) 리스트
   - 다음 행동 CTA: 다시 풀기 / 다음 문제 / 저장 / 비교 리포트
   - `feedback_status='pending'|'analyzing'`이면 분석 중 상태로 표시 + 페이지 내 polling (5s 간격 최대 60s)
3. **Comparison report** (R-01, `/writing/reports/[id]/compare`):
   - `comparison_reports` row 조회 + 현재/이전 제출 본문 side-by-side
   - metrics(jsonb) 표 + AI narrative(text) 표시 — `previous_submission_id` 없으면 "비교 대상 없음" empty state
4. **Mock feedback service** (Phase 5 한정, server-mediated):
   - `src/lib/writing/feedback-service.ts` — **pure함수**. submission 메타로부터 deterministic mock payload(`{feedback, dimensions, sentences}`) 만 계산. **DB insert 안 함**.
   - `src/lib/writing/server-actions.ts` — Next.js Server Action `submitWritingAction(...)`이 RPC `submit_writing_with_feedback(submission, feedback, dimensions, sentences)`를 호출. 마찬가지로 `createComparisonReportAction(...)`은 `create_comparison_report_with_metrics(current_id, previous_id, metrics, narrative)` 호출.
   - **신규 마이그레이션 `20260521130000_phase_5_writing_rpc.sql`** — 두 RPC를 SECURITY DEFINER로 도입(현재 RLS는 writing_feedback/feedback_dimension_scores/sentence_feedback/comparison_reports에 owner-INSERT가 없고 service_role 전제). **신뢰 모델**: 함수는 `auth.uid()`를 신뢰원으로 사용하며, 페이로드에 포함된 `user_id`/`submission_id` 등 소유권 필드는 **무시하고 항상 `auth.uid()`로 덮어쓴다**. 페이로드는 텍스트/점수/문장 본문 같은 비-소유권 필드만 신뢰된다. 4 테이블 insert + writing_drafts.autosave_status='superseded' 까지 단일 트랜잭션. Phase 6에서 Edge Function이 동일 인터페이스를 대체.
5. **Types snapshot extension**: `src/lib/supabase/types.ts`에 writing 6 테이블 hand-align 추가 (writing_drafts/writing_submissions/writing_feedback/feedback_dimension_scores/sentence_feedback/comparison_reports).
6. **R-TZ resolution**: dayjs/plugin/timezone(`Asia/Seoul`) 도입 + Phase 4 KPI day-boundary 재계산 (Phase 4 R-TZ follow-up).

## Routes (Active)

- `/writing/[questionId]` — D-01~D-04 통합 (questionId ∈ {51,52,53,54}). 검증 실패 시 404.
- `/writing/feedback/short/[id]` — E-01. submission_id로 writing_feedback + dimension_scores fetch. question_no ∈ {51,52}만 허용 (검증 실패 시 redirect to long).
- `/writing/feedback/long/[id]` — E-02. submission_id + writing_feedback + dimension_scores + sentence_feedback. question_no ∈ {53,54}만 허용.
- `/writing/reports/[id]/compare` — R-01. comparison_reports.id 기반.

## State Model (light)

- Server fetch (initial load): submission/feedback/draft 단건은 server component에서 1회.
- Client mutation (TanStack Query):
  - `useUpsertDraft` — 2초 debounce autosave (RLS owner_all 그대로 사용)
  - `useSubmitWriting` — 모달 confirm → `submitWritingAction` Server Action → RPC `submit_writing_with_feedback` → invalidate
  - `useCreateComparisonReport` — "비교 리포트" CTA → `createComparisonReportAction` Server Action → RPC `create_comparison_report_with_metrics`
- Polling: `useFeedbackStatus` 5s 간격 (최대 12회). `refetchInterval`은 status='pending'|'analyzing' 동안만 활성, status='complete'|'failed' 도달 시 자동 정지.

## Data Touched

- 신규 typed: writing_drafts, writing_submissions, writing_feedback, feedback_dimension_scores, sentence_feedback, comparison_reports (RLS는 이미 20260520121100에 정의됨 — owner-only)
- 기존 typed (Phase 4): problems(메타만), problem_attempts(미사용)
- 신규 함수: `feedback-service.ts` (mock LLM), `comparison-service.ts` (metric 계산)

## Audience

Audience: user (학습자 쓰기 풀이 + 피드백 + 비교 리포트 흐름. Admin 영역 X-08/X-10 등은 Phase 6.)

## User Flow Anchor

```
/practice/problems → 클릭 → /writing/[questionId]
                            ↓ autosave + 입력
                            ↓ D-M1 확인 모달 → submit
                            ↓ /writing/feedback/{short,long}/[id]
                            ↓ "비교 리포트" CTA → /writing/reports/[id]/compare
                            ↓ "다음 문제" → /practice/recommendations
```

## File Structure (target)

- `src/lib/writing/` (신규) → types.ts + server.ts + queries.ts + mutations.ts + feedback-service.ts (pure) + comparison-service.ts (pure) + server-actions.ts (Next.js Server Actions)
- `supabase/migrations/20260521130000_phase_5_writing_rpc.sql` (신규) → `submit_writing_with_feedback` + `create_comparison_report_with_metrics` SECURITY DEFINER RPC
- `src/components/writing/` (신규) → WritingEditor, AutosaveBadge, SubmissionConfirmModal, QuestionPrompt, HelpPanel
- `src/components/feedback/` (신규) → FeedbackSummary, DimensionCardGrid, SentenceFeedbackList, NextActionBar, FeedbackPendingPanel
- `src/components/reports/` (신규) → ComparisonReportView, MetricsTable, SubmissionDiffPanel
- `src/app/(workspace)/writing/[questionId]/page.tsx`, `/writing/feedback/short/[id]/page.tsx`, `/writing/feedback/long/[id]/page.tsx`, `/writing/reports/[id]/compare/page.tsx` — 모두 thin server components (target ≤40 lines: requireUser + fetch + delegate to content component, no heavy logic inline)
- `src/lib/supabase/types.ts` (수정) → 6 writing tables 추가
- `src/lib/learning/kpi.ts` (수정) → dayjs/timezone 도입 (R-TZ)

## Acceptance (machine + manual)

- 자동: `pnpm typecheck` + `pnpm lint` + `pnpm test` PASS, build의 모든 writing route 컴파일, `node scripts/ai-workflow-check.mjs --repo .` PASS.
- 수동: question 51 풀이 → autosave 배지 syncing→clean 전환 → 제출 모달 → /writing/feedback/short/[id] 분석 중→완료 → "비교 리포트" CTA → /writing/reports/[id]/compare. question 53도 동일 + sentence_feedback 표시.
- Architecture Pass: route handler/page는 thin, queries는 `src/lib/writing/`이 소유, "use client" 컴포넌트만 TanStack hook 사용.
