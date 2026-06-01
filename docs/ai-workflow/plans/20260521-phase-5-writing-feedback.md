# Phase 5 — Writing And Feedback Plan

## Architecture (one paragraph + 한 줄 SBU)

Phase 5는 쓰기 풀이→채점→비교의 종단 흐름을 RLS 안에서 한 PR로 완성한다. 데이터 레이어는 `src/lib/writing/`에 모이고, 자동저장은 client-side TanStack mutation(debounce 2s) + writing_drafts upsert(RLS owner_all). **쓰기 제출 + mock feedback + comparison report 생성은 모두 Next.js Server Action을 거쳐 SECURITY DEFINER RPC로 처리한다** — client/JS는 DB에 직접 feedback row를 insert하지 않는다. `feedback-service.ts`는 RPC 인자로 넘길 payload를 계산하는 **순수 함수**일 뿐이며 DB 접촉이 없다. 피드백 페이지는 server component에서 1회 fetch + status=pending|analyzing일 때만 5s polling. 비교 리포트는 명시적 CTA만(자동 매칭은 Phase 6). Phase 4 R-TZ는 본 PR에서 dayjs/plugin/timezone Asia/Seoul로 해소.

**Vertical SBU (smallest buildable unit)**: 사용자가 `/writing/51`에서 답안 작성 → writing_drafts autosave dirty→clean → 제출 모달 confirm → **Server Action `submitWritingAction`** → RPC `submit_writing_with_feedback(submission, feedback, dimensions, sentences)` (SECURITY DEFINER, atomic) → writing_submissions + writing_feedback + feedback_dimension_scores + (long-form) sentence_feedback 4 insert + writing_drafts.autosave_status='superseded' 단일 트랜잭션 → 클라이언트 redirect → `/writing/feedback/short/[id]` → server fetch 후 점수/항목/CTA 표시 → "비교 리포트" CTA → Server Action `createComparisonReportAction` → RPC `create_comparison_report_with_metrics` → `/writing/reports/[id]/compare` (previous 있으면 metrics+diff, 없으면 empty). long-form(53/54)에서는 sentence_feedback 추가 표시. **transaction은 DB function이 보장 — JS rollback 불필요**.

## Docs Consulted

- `docs/spec.md` §State Management (useWritingStore/useFeedbackStore 의도) + §Persistence (autosave 정책)
- `docs/sitemap.md` Lines 36-45 (D-01~D-04, E-01/E-02, R-01)
- `docs/Wireframe/{08-D-01,09-D-02,10-D-03,11-D-04,14-E-01,15-E-02,16-R-01}/description.md`
- `docs/flow/user-flow.md` (writing 흐름 anchor)
- `supabase/migrations/20260520120400_writing.sql` + `20260520120500_feedback.sql` (테이블 + 인덱스)
- `supabase/migrations/20260520121100_rls_policies.sql` (writing 6 테이블 RLS — owner-only `for all using (user_id = auth.uid())`)
- `supabase/migrations/20260520121500_submission_status_function.sql` (feedback_status 업데이트 함수)
- `docs/ai-workflow/runs/2026/05/21/20260521-1500-phase-4-learning-core.md` §Risks R-TZ
- `docs/ai-workflow/light-specs/phase-5-writing-feedback.md` (본 phase 정본)

## Plan-Review PASS Gate (record)

| Round | Verdict | Catch | Action |
| --- | --- | --- | --- |
| 1 (Codex pre-impl) | FAIL | P1×2 (RLS blocks client-side feedback inserts, submit non-transactional/no rollback path) + P2×3 (OOS sitemap enumeration, types.ts fallback evidence, polling stop coverage) | All-layers revision: 신규 RPC migration + Server Action 경로 + OOS sitemap enumeration + fallback 증거 + Task 13 polling-stop 케이스 |
| 2 (Codex pre-impl) | CONCERN | P2×3: 첫 단락의 stale architecture text(직접 insert 인상), Server Action user_id 인자 수용, RPC body가 페이로드 ownership 필드 override 명시 누락 | 첫 단락 RPC-only로 명확화, Server Action에서 user_id 인자 제거(`auth.getUser()`로 도출), RPC body 신뢰 모델 명시 (페이로드 user_id/submission_id 무시 + auth.uid() 강제) |
| 3 (Codex pre-impl) | CONCERN | P2×1: light spec line 67이 plan과 drift — "auth.uid() = submission.user_id 검증" 표현이 user_id 페이로드 의존 인상 | light spec 신뢰 모델 명시 정정 (plan과 동일하게 "페이로드 ownership 필드 무시 + auth.uid() 강제") |
| 4 (Codex pre-impl) | pending | — | — |

## Smallest Buildable Unit

위 §Architecture 두 번째 단락(Vertical SBU)을 참조. 요약: `/writing/51` → autosave dirty→clean → 제출 confirm → Server Action `submitWritingAction` → RPC `submit_writing_with_feedback` → atomic 4-table insert → redirect → feedback page → "비교 리포트" CTA → RPC `create_comparison_report_with_metrics` → compare page. long-form은 sentence_feedback 추가.

## Out of Scope — Intentional Cuts

Phase 5는 sitemap D/E/R 4 routes만 다룬다. 나머지 sitemap-active routes는 다른 phase에 이미 소속.

**Sitemap-active routes 중 Phase 5 외 소속 (전부 enumeration)**:

| Code | Route | Owning Phase | Status |
| --- | --- | --- | --- |
| X-01 | `/` landing | Phase 3 | shipped |
| A-01 | `/sign-up` | Phase 2 | shipped |
| A-02 | `/login` | Phase 2 | shipped |
| X-06 | `/password-reset` | Phase 2 | shipped |
| A-03 | `/onboarding/learning-goal` | Phase 4 | shipped |
| B-01 | `/dashboard` | Phase 4 | shipped |
| C-01 | `/practice/recommendations` | Phase 4 | shipped |
| C-02 | `/practice/problems` | Phase 4 | shipped |
| C-03 | retry modal | Phase 6 | placeholder |
| R-02 | `/practice/next` | Phase 6 | placeholder |
| F-01, F-M1 | `/library` + PDF export | Phase 6 | placeholder |
| G-01 | `/settings/language` | Phase 6 | placeholder |
| H-01 | `/admin/problems` | Phase 6 | placeholder |
| X-02 | `/growth` | Phase 6 | (not yet created — defer) |
| X-03 | `/paywall` | Phase 3 placeholder | placeholder |
| X-04 | `/subscription` | Phase 3 placeholder | placeholder |
| X-05 | `/profile` | Phase 3 placeholder | placeholder |
| X-07 | `/practice/weakness` | Phase 6 | placeholder |
| X-08 | `/admin/org` | Phase 6 | placeholder |
| X-09 | `/settings/notifications` | Phase 6 | placeholder |
| X-10 | `/admin/users` | Phase 6 | placeholder |

**Phase 5 자체 OOS (의도적 deferral)**:

| ID | Item | Defer to |
| --- | --- | --- |
| OOS-1 | 실제 LLM 호출 | Phase 6 / 인프라 |
| OOS-2 | Realtime 분석 progress | Phase 6 |
| OOS-3 | F-M1 PDF export | Phase 6 |
| OOS-4 | X-07 weakness 추천 wiring | Phase 6 |
| OOS-5 | comparison_reports 자동 생성 | Phase 5는 명시적 CTA만 |
| OOS-6 | Admin CRUD | Phase 6 |
| OOS-7 | i18n | 향후 |
| OOS-8 | R-02 reading/listening attempt | Phase 4/5 외부 |
| OOS-9 | Growth dashboard 확장 | Phase 6 |
| OOS-10 | Phase 3 carry-forward 3건 | 별도 PR |
| OOS-11 | Playwright e2e | Phase 6 |
| OOS-12 | Realtime autosave conflict | Phase 6 |
| OOS-13 | submission RLS 정책 변경(self-INSERT 허용) | Phase 5는 SECURITY DEFINER RPC만 사용 — Phase 6 Edge Function 이관 시 RPC 자체를 deprecate 검토 |

## File Structure (target)

- 신규: `src/lib/writing/{types,server,queries,mutations,feedback-service,comparison-service,server-actions}.ts`
- 신규: `supabase/migrations/20260521130000_phase_5_writing_rpc.sql`
- 신규: `src/components/writing/{WritingEditor,AutosaveBadge,SubmissionConfirmModal,QuestionPrompt,HelpPanel}.tsx`
- 신규: `src/components/feedback/{FeedbackSummary,DimensionCardGrid,SentenceFeedbackList,NextActionBar,FeedbackPendingPanel}.tsx`
- 신규: `src/components/reports/{ComparisonReportView,MetricsTable,SubmissionDiffPanel}.tsx`
- 수정: `src/app/(workspace)/writing/[questionId]/page.tsx`, `/writing/feedback/short/[id]/page.tsx`, `/writing/feedback/long/[id]/page.tsx`, `/writing/reports/[id]/compare/page.tsx` — 모두 thin server components, target ≤40 lines (requireUser + fetch + content component delegation)
- 수정: `src/lib/supabase/types.ts` — 6 writing tables 추가
- 수정: `src/lib/learning/kpi.ts` — dayjs/plugin/timezone Asia/Seoul (R-TZ)
- 신규 테스트: `tests/lib/writing/*.test.ts`, `tests/lib/learning/kpi-timezone.test.ts`, `tests/integration/writing-flow.test.ts`

## Verification Strategy

자동 gate (모두 PASS 필수):

- `pnpm install --frozen-lockfile`
- `pnpm typecheck` — 0 errors
- `pnpm lint` — 0 errors, 0 warnings
- `pnpm test` — 신규 단위 + 통합 모두 GREEN (docker gated integration은 SUPABASE_LOCAL_STACK으로 skip)
- `pnpm build` — 4 writing route 모두 컴파일
- `node scripts/ai-workflow-check.mjs --repo .` — PASS

수동 gate:

- question 51/53 풀이 flow 1회 (UI 확인 docker 없이 mock fixture 기준 비활성 화면 + 단위 테스트로 대체)
- Architecture Pass grep: writing/feedback/reports 모듈에 domain cross-import 0, page.tsx ≤30 lines, supabase 직접 import 0 outside lib/

## Tasks

| # | Title | Status | Subagent-eligible? (Y/N + reason) |
| --- | --- | --- | --- |
| 0 | Phase 4 R-TZ 해소 (dayjs/timezone Asia/Seoul) | done | N — cross-phase contract change, main session owner |
| 1 | types.ts 6 writing tables (fallback hand-align) | done | N — touches Phase 2/3/4 shared types snapshot |
| 1b | 신규 RPC 마이그레이션 (SECURITY DEFINER × 2) | done | N — schema migration with security implications |
| 2 | src/lib/writing/types.ts | done | Y — domain type module, isolated |
| 3 | src/lib/writing/server.ts | done | Y — fetch helpers, isolated |
| 4 | src/lib/writing/queries.ts | done | Y — client query keys + hooks, isolated |
| 5 | src/lib/writing/mutations.ts + server-actions.ts | done | N — RPC contract + identity model, main session |
| 6 | feedback-service.ts (pure) | done | Y — pure function, fully spec'd |
| 7 | comparison-service.ts (pure) | done | Y — pure function, fully spec'd |
| 8 | Writing UI components | done | Y — independent components |
| 9 | Writing page (`/writing/[questionId]`) | done | N — wires Server Action + RPC + RLS-bound fetch |
| 10 | Feedback UI components | done | Y — independent components |
| 11 | Feedback pages (short + long) | done | N — redirect matrix + RLS-bound fetch |
| 12 | Comparison report UI + page | done | N — fetch composition |
| 13 | Integration test (writing-flow) | done | N — multi-page mock orchestration |
| 14 | Full verification (lint/test/build/checker) | done | N — main session gate |
| 15 | Cross-model review (Opus + Codex) | pending | N — main session |

### Task 0 — Phase 4 R-TZ 해소 (dayjs timezone plugin)

- [ ] Step 1: `tests/lib/learning/kpi-timezone.test.ts` RED — `Asia/Seoul`에서 22:00 UTC = 다음날 07:00 KST이므로 today bucket이 KST 기준이어야 함을 검증.
- [ ] Step 2: `package.json`에 dayjs는 이미 있음 — `kpi.ts`에 `import utc from "dayjs/plugin/utc"; import timezone from "dayjs/plugin/timezone"; dayjs.extend(utc); dayjs.extend(timezone);` 추가 + `startOfToday`/`endOfToday`/`dayKey`를 `dayjs.tz(Asia/Seoul)` 기반으로 재구현.
- [ ] Step 3: 기존 kpi.test.ts mock도 KST 기준으로 재계산 — boundaries 변경.
- [ ] Step 4: 코드 주석에서 "R-TZ accepted-for-Phase-4" 문구 제거, plan/ledger Risks에서 resolved 표시.
- [ ] Step 5: pnpm test GREEN.

### Task 1 — types.ts 6 writing tables 추가 (fallback: hand-align)

**Fallback evidence**: `pnpm dlx supabase gen types typescript --local`은 Supabase CLI + 로컬 stack(docker) 필요 — 현재 host에 docker 부재(확인: Phase 2/3/4 ledger). 따라서 fallback-and-recovery.md §40-43에 따라 **schema 정본 직접 참조 후 hand-align**으로 degraded 진행. 증거: 이 plan의 `Docs Consulted` (writing.sql + feedback.sql 두 마이그레이션 + 인덱스). Phase 6에서 CI에 docker 도입 시 `supabase gen types`로 1회 regenerate해 hand-align 결과와 diff 검증.

- [ ] Step 1: `tests/lib/supabase/writing-types.test.ts` RED — `Tables<"writing_drafts">`, `<"writing_submissions">`, `<"writing_feedback">`, `<"feedback_dimension_scores">`, `<"sentence_feedback">`, `<"comparison_reports">` 키 존재 + nullability 검증 (writing_drafts.answer_text는 null 허용, writing_submissions.answer_text는 not null 등).
- [ ] Step 2: `src/lib/supabase/types.ts` Database['public']['Tables']에 6 항목 hand-align (`Row`/`Insert`/`Update`/`Relationships`). 주석의 `Phase 5/6` → `Phase 5`로 갱신 + fallback evidence 추가.
- [ ] Step 3: typecheck GREEN.

### Task 1b — 신규 RPC 마이그레이션 (Phase 5 핵심)

- [ ] Step 1: `supabase/migrations/20260521130000_phase_5_writing_rpc.sql` 작성.
  - `create or replace function public.submit_writing_with_feedback(submission jsonb, feedback jsonb, dimensions jsonb, sentences jsonb) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $...$`
    - **신뢰 모델**: 함수는 `auth.uid()`를 신뢰원으로 사용한다. 페이로드의 `user_id` / `submission_id` 필드가 있더라도 **무시하고 항상 `auth.uid()`로 덮어쓴다**. 페이로드는 텍스트/점수/문장 본문 같은 비-소유권 필드만 신뢰된다.
    - 절차:
      1. `caller_id := auth.uid()`; `if caller_id is null then raise exception 'unauthenticated'; end if;`
      2. writing_submissions row insert — `user_id := caller_id`, `problem_id`, `draft_id`, `question_no`, `answer_text`, `answer_json`, `char_count`는 페이로드에서 가져오고, `feedback_status := 'complete'` (Phase 5 mock은 즉시 complete). `returning id into new_submission_id`.
      3. writing_feedback row insert — `submission_id := new_submission_id`, `user_id := caller_id`, 페이로드의 user_id/submission_id 무시. `status := 'complete'`, `ai_model := 'mock-v1'`, `ai_model_version := 'phase-5'`.
      4. feedback_dimension_scores `for each` insert (jsonb_array_elements) — `submission_id := new_submission_id`, `user_id := caller_id` 강제 주입.
      5. sentences가 빈 배열이 아니면 sentence_feedback insert — `submission_id := new_submission_id`, `user_id := caller_id` 강제 주입.
      6. writing_drafts where `user_id = caller_id and problem_id = (submission->>'problem_id')::uuid and autosave_status <> 'superseded'` → `autosave_status='superseded'` update.
      7. return new_submission_id.
  - `create or replace function public.create_comparison_report_with_metrics(current_id uuid, previous_id uuid, metrics jsonb, narrative text, ai_model text) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $...$`
    - **신뢰 모델**: 동일 — current_id / previous_id 인자는 신뢰하지만 그 submission row가 `auth.uid()` 소유인지 검증. 통과 시 comparison_reports insert (`user_id := auth.uid()`).
    - 절차:
      1. `caller_id := auth.uid()`; null이면 raise.
      2. `select user_id from writing_submissions where id = current_id` → caller_id와 다르면 raise. previous_id가 null이 아니면 동일 검증.
      3. comparison_reports insert — `user_id := caller_id`, `current_submission_id := current_id`, `previous_submission_id := previous_id`, `metrics`, `narrative`, `ai_model`. `returning id`.
      4. return inserted id.
  - 권한: `revoke all on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) from public; grant execute on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) to authenticated;` (comparison 함수도 동일).
- [ ] Step 2: `tests/lib/writing/rpc-contract.test.ts` — Supabase mock으로 두 RPC 호출 shape 검증 (arg shape + return type).
- [ ] Step 3: 마이그레이션 dry-run 검사 (psql syntax check만 — local stack 부재로 실 실행은 SUPABASE_LOCAL_STACK gated).

### Task 2 — src/lib/writing/types.ts (domain types)

- [ ] Step 1: `tests/lib/writing/types.test.ts` RED — `QuestionNo` 51-54 narrowing(`isShortAnswer`/`isLongForm`), `AutosaveStatus` discriminated union, `FeedbackDimension` enum 6종.
- [ ] Step 2: `src/lib/writing/types.ts` — `QuestionNo`, `AutosaveStatus`, `FeedbackStatus`, `FeedbackDimensionKey`(grammar/vocab/structure/content/expression/topic_fit), `isShortAnswer(n) => n===51||n===52`, `isLongForm(n) => n===53||n===54`, `WritingDraftRow`/`WritingSubmissionRow`/`WritingFeedbackRow`/`FeedbackDimensionScoreRow`/`SentenceFeedbackRow`/`ComparisonReportRow` (Tables<...> 별칭).
- [ ] Step 3: types.test.ts GREEN.

### Task 3 — src/lib/writing/server.ts (server fetch)

- [ ] Step 1: `tests/lib/writing/server.test.ts` RED — `getActiveDraft(userId, problemId)` returns single row or null; `getSubmission(id)` returns row + 본인이 아니면 RLS로 null; `getFeedbackBundle(submissionId)` returns `{feedback, dimensions, sentences}`; `getComparisonReport(id)` returns row.
- [ ] Step 2: `src/lib/writing/server.ts` — 4 server helpers, `SupabaseServerClient` factory injection, 모두 `maybeSingle()` 또는 일반 select.
- [ ] Step 3: server.test.ts GREEN.

### Task 4 — src/lib/writing/queries.ts (client fetch)

- [ ] Step 1: `tests/lib/writing/queries.test.ts` RED — `draftQueryKey`/`submissionQueryKey`/`feedbackBundleKey`/`comparisonReportKey` stable shape, `useFeedbackStatus(submissionId)` returns query with `refetchInterval` only when status pending|analyzing.
- [ ] Step 2: `src/lib/writing/queries.ts` — 4 query keys + `fetchDraft`/`fetchSubmission`/`fetchFeedbackBundle`/`fetchComparisonReport` + hooks(`useDraft`/`useFeedbackStatus`). `useFeedbackStatus`는 `refetchInterval: (q) => isPending(q.state.data) ? 5000 : false`, `refetchIntervalInBackground: false`.
- [ ] Step 3: queries.test.ts GREEN.

### Task 5 — src/lib/writing/mutations.ts + server-actions.ts (RPC 경유)

- [ ] Step 1: `tests/lib/writing/server-actions.test.ts` RED — `submitWritingAction(input)` 가 mock supabase rpc `submit_writing_with_feedback`를 한 번 호출하고 반환된 submission_id를 반환; `createComparisonReportAction(input)` 가 rpc `create_comparison_report_with_metrics` 호출; `upsertDraft(input)` (Server Action 아님, 직접 supabase upsert)은 owner-all RLS로 그대로 작동.
- [ ] Step 2: `src/lib/writing/server-actions.ts` ("use server")
  - **identity 신뢰 모델**: 모든 Server Action은 인자에 `user_id`를 받지 않는다. server-side `createSupabaseServerClient()` + `await supabase.auth.getUser()`로 user를 도출하고, 검증 실패 시 `redirect("/login")`. user_id가 필요한 곳은 서버에서 도출한 값만 사용한다.
  - `submitWritingAction({draft_id, problem_id, question_no, answer_text, answer_json, char_count})`:
    1) supabase server client + auth.getUser → user. null이면 redirect.
    2) `feedback-service.generateMockFeedback({question_no, char_count, answer_text})` 호출해 `{feedback, dimensions, sentences}` payload 생성 (비-소유권 필드만)
    3) `supabase.rpc("submit_writing_with_feedback", { submission: {...non-ownership fields}, feedback, dimensions, sentences })` 호출. **user_id는 RPC가 auth.uid()로 채움**.
    4) return `{ submissionId, questionNo }`
  - `createComparisonReportAction({current_id, previous_id?})`:
    1) supabase server client + auth.getUser → user. null이면 redirect.
    2) current/previous submission fetch (RLS로 owner-only) + feedback fetch
    3) `comparison-service.computeComparisonMetrics(...)` 호출해 metrics + narrative 계산
    4) `supabase.rpc("create_comparison_report_with_metrics", {...})` 호출. **user_id는 RPC가 auth.uid()로 채움**.
    5) return `{ reportId }`
- [ ] Step 3: `src/lib/writing/mutations.ts` — `upsertDraft(input)` (writing_drafts owner-all로 직접 upsert), `useUpsertDraft`/`useSubmitWriting`/`useCreateComparisonReport` (TanStack mutation, mutationFn은 Server Action을 await; onSuccess에서 invalidate).
- [ ] Step 4: mutations.test.ts GREEN.

### Task 6 — src/lib/writing/feedback-service.ts (pure deterministic mock)

- [ ] Step 1: `tests/lib/writing/feedback-service.test.ts` RED — `generateMockFeedback({question_no, char_count, answer_text})` returns deterministic `{feedback, dimensions[6], sentences[]}` shape. 51/52는 sentences=[], 53/54는 답안 문장 수에 비례. score는 deterministic 식.
- [ ] Step 2: `src/lib/writing/feedback-service.ts` — **순수 함수만**. `generateMockFeedback(input)` 반환 payload는 RPC `submit_writing_with_feedback` 인자 그대로 사용. ai_model="mock-v1", ai_model_version="phase-5". **DB insert 없음**.
- [ ] Step 3: feedback-service.test.ts GREEN.

### Task 7 — src/lib/writing/comparison-service.ts (metric 계산)

- [ ] Step 1: `tests/lib/writing/comparison-service.test.ts` RED — `computeComparisonMetrics({current, previous, dimsCurrent, dimsPrevious})` returns `{score_delta, dimension_deltas: {[dim]: number}, char_delta}`. previous null이면 모두 null + flag `noPrevious=true`.
- [ ] Step 2: `src/lib/writing/comparison-service.ts` — pure function + `generateNarrative({metrics})` mock narrative ("이번 답안은 어휘 차원에서 +3.5점 향상되었습니다." 같은 deterministic 문장).
- [ ] Step 3: comparison-service.test.ts GREEN.

### Task 8 — Writing UI components

- [ ] Step 1: `WritingEditor` ("use client") — react-hook-form 없이 Ant Design `Input.TextArea` + 글자수 표시 + autosave dirty 감지(setValue → debounce 2s → `useUpsertDraft`). Props: `defaultValue`, `questionNo`, `problemId`, `userId`, `onSubmitClick` (모달 트리거).
- [ ] Step 2: `AutosaveBadge` — `clean/dirty/syncing/failed` 4상태 Ant `Tag` + last_saved_at 분 단위.
- [ ] Step 3: `SubmissionConfirmModal` — `Modal` confirm, "제출 후 수정 불가" 문구, 글자수 미달 시 disabled.
- [ ] Step 4: `QuestionPrompt` (server-rendered allowed but kept thin) — problem.title + question.prompt body 3줄.
- [ ] Step 5: `HelpPanel` ("use client") — 우측 도움말 카드 3개 (props로 받음, 없으면 빈 상태).
- [ ] Step 6: 단위 테스트 — AutosaveBadge 상태 매핑 + SubmissionConfirmModal disabled 조건.

### Task 9 — Writing page

- [ ] Step 1: `src/app/(workspace)/writing/[questionId]/page.tsx` — `requireUser`, `params.questionId` 검증(51-54 외 → notFound), `problemId` 선택 로직(현재 가장 최근 active draft 또는 URL `?problem=...`), `getActiveDraft(userId, problemId)`, `<WritingEditor>` + `<QuestionPrompt>` + `<HelpPanel>` 조립. ≤30 lines.
- [ ] Step 2: 단위 테스트 — invalid questionId redirect/notFound.

### Task 10 — Feedback UI components

- [ ] Step 1: `FeedbackSummary` — `Statistic` score + narrative 3줄.
- [ ] Step 2: `DimensionCardGrid` — 6 dimension 중 분석 완료된 항목만 카드(grammar/vocab/structure/content/expression/topic_fit) — props로 `Array<DimensionScore>` 받음, score 없으면 회색.
- [ ] Step 3: `SentenceFeedbackList` (long-form 전용) — original_text strikethrough + corrected_text + comment.
- [ ] Step 4: `FeedbackPendingPanel` — `feedback_status=pending|analyzing`일 때 spinner + 안내, useFeedbackStatus polling 트리거.
- [ ] Step 5: `NextActionBar` — Ant `Space` + 다시 풀기 / 다음 문제 / 비교 리포트 (3 CTA, 중복 클릭 차단).
- [ ] Step 6: 단위 테스트 — DimensionCardGrid empty/일부 누락 시 fallback, NextActionBar 중복 클릭 차단.

### Task 11 — Feedback pages

- [ ] Step 1: `/writing/feedback/short/[id]/page.tsx` — `requireUser` + `getSubmission(id)` (없으면 notFound) + question_no 검증 (51|52, 아니면 long으로 redirect) + `getFeedbackBundle(id)` + status에 따라 `<FeedbackPendingPanel>` 또는 `<FeedbackSummary>+<DimensionCardGrid>+<NextActionBar>`. ≤30 lines.
- [ ] Step 2: `/writing/feedback/long/[id]/page.tsx` — short와 동일 + `<SentenceFeedbackList>` 추가, question_no 검증 (53|54). ≤30 lines.

### Task 12 — Comparison report UI + page

- [ ] Step 1: `MetricsTable` — score_delta / char_delta / dimension_deltas 표.
- [ ] Step 2: `SubmissionDiffPanel` — current.answer_text vs previous.answer_text side-by-side.
- [ ] Step 3: `ComparisonReportView` — `MetricsTable` + `SubmissionDiffPanel` + narrative.
- [ ] Step 4: `src/app/(workspace)/writing/reports/[id]/compare/page.tsx` — `requireUser` + `getComparisonReport(id)` (없으면 notFound) + current/previous submission fetch → `<ComparisonReportView>`. ≤30 lines.
- [ ] Step 5: 단위 테스트 — MetricsTable noPrevious=true 시 "—" 표시.

### Task 13 — Integration test (writing-flow)

- [ ] Step 1: `tests/integration/writing-flow.test.ts` — vitest mock 기반 케이스:
  1) writing/[questionId] 페이지가 questionId=99일 때 notFound
  2) submitWritingAction 호출 시 mock supabase가 rpc('submit_writing_with_feedback', ...) 정확히 1회 호출 + 반환된 submission_id로 redirect
  3) /writing/feedback/short/[id] redirect: question_no=53인 submission으로 short 페이지 진입 시 long으로 redirect
  4) /writing/reports/[id]/compare 가 previous=null인 report에서 empty diff panel 표시
  5) **useFeedbackStatus polling stop**: refetchInterval이 status='pending'에서 5000을 반환, status='complete' 도달 시 false를 반환 — TanStack `QueryClient` mock으로 직접 검증 (이 케이스로 P2c 해소).

### Task 14 — Full verification

- [ ] Step 1: `pnpm install` (lockfile 변경 없음 — dayjs 자체 이미 있음)
- [ ] Step 2: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- [ ] Step 3: `node scripts/ai-workflow-check.mjs --repo .` PASS
- [ ] Step 4: Architecture Pass grep — supabase direct imports 0, domain cross-imports 0, TanStack only in client, all page.tsx ≤30 lines.

### Task 15 — Cross-model review (Opus + Codex parallel)

- [ ] Step 1: Opus subagent 호출 — phase-5 light spec/plan/ledger + 신규 코드/테스트 read, P1/P2 triage.
- [ ] Step 2: Codex CLI read-only review (background).
- [ ] Step 3: 두 verdict 결합, P1 항목 fix-in-PR 또는 follow-up 명시, P2는 ledger Risks에 등록.

## Risks

- **R-MOCK (Phase 4 inherited, partial)**: Phase 4 kpi.test.ts mock 패턴을 Phase 5 writing tests에서 답습하지 않도록 — Supabase chain mock을 명시적 thenable로 작성(`then` impl 포함).
- **R-RPC-CONTRACT (P1 → resolved by design)**: ~~client-side feedback insert는 RLS에 막힘~~ → Task 1b의 SECURITY DEFINER RPC로 해소. RPC 내부에서 `auth.uid()` 일치 검증 필수.
- **R-RPC-SECURITY (P2)**: SECURITY DEFINER 함수는 `search_path` 고정 + `revoke from public`/`grant to authenticated`로 권한 좁힘 필수. 누락 시 권한 escalation 위험.
- **R-AUTOSAVE-CONFLICT (P2)**: 동일 user+problem의 active draft가 partial unique index로 1개 보장되지만, 두 탭 동시 편집 시 마지막 upsert가 winner. Realtime conflict 알림은 Phase 6.
- **R-COMP-TRIGGER**: 비교 리포트는 명시적 CTA만 — 자동 직전 제출 매칭은 OOS-5. 사용자가 CTA 안 누르면 report row 미생성(의도).
- **R-TIMEZONE-BLAST**: Task 0 dayjs timezone 도입 시 Phase 4 KPI 영향. kpi.test.ts의 모든 시간 boundary는 KST 기준으로 재계산. 별도 Phase 4 retro test 추가.
- **R-DOCKER-FALLBACK (P2 — fallback evidence)**: types.ts hand-align은 supabase CLI + docker 부재로 인한 degraded path. 정본은 마이그레이션 SQL — 추가 작업 시 마이그레이션과 동시 갱신 필수. Phase 6 CI docker 도입 시 `supabase gen types`로 1회 regenerate해 검증.

## Lightweight Path Decision

❌ Not eligible. 6 신규 테이블 + 4 routes + AI mock + 약 25개 파일 변경. Full workflow.
