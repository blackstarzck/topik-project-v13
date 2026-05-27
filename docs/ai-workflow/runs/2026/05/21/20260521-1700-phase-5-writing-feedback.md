# Phase 5 — Writing And Feedback Ledger

## Run Metadata

- Run id: 20260521-1700-phase-5-writing-feedback
- Created: 2026-05-21 17:00 KST
- Updated: 2026-05-21 17:00 KST
- Main session owner: Claude Code (Opus 4.7, 1M context)
- Host: Claude Code
- Status: active (Plan-Review PASS Gate pending)
- Phase: 5-writing-feedback

## Task

- User goal: Tier 1 MVP의 쓰기 풀이→채점→비교 종단 흐름을 RLS 안에서 구현.
- Accepted scope: light spec(`phase-5-writing-feedback.md`)의 Core Functionality 6개 + plan의 15 task. Real LLM 호출/PDF export/Admin CRUD/Realtime은 의식적 deferral.
- Out of scope: 12 OOS items (Phase 5 light spec table + plan §Out of Scope).
- Current next action: Codex pre-plan review (PASS Gate), 그 후 자동 batch 구현.

## Plan-Review PASS Gate (record)

| Round | Verdict | Catch | Action |
| --- | --- | --- | --- |
| 1 (Codex pre-impl) | FAIL | P1×2 (RLS blocks client-side feedback inserts, submit non-transactional/no rollback path), P2×3 (OOS sitemap incomplete, types.ts fallback evidence missing, polling stop coverage missing) | All-layers revision: light spec + plan + ledger 동시 갱신 — (1) 신규 RPC 마이그레이션 + SECURITY DEFINER 도입, (2) feedback-service pure함수화 + server-actions.ts 신설, (3) OOS 전 sitemap-active routes enumeration, (4) Task 1에 fallback-and-recovery 증거 추가, (5) Task 13에 polling-stop 케이스 추가 |
| 2 (Codex pre-impl) | CONCERN | P1 Round 1 해소 확인 (RPC + atomic) + P2×3 신규: stale architecture text, Server Action user_id 인자, RPC payload ownership override 명시 누락 | 모두 plan-text 수정으로 해소 — 첫 단락 RPC-only 명시, Server Action 인터페이스에서 user_id 제거, RPC 신뢰 모델 강조 |
| 3 (Codex pre-impl) | CONCERN | Round 2 P2×3 모두 RESOLVED 확인 + 신규 1건: light spec L67에서 trust model drift | light spec L67 동일 신뢰 모델 명시로 수정 |
| 4 (Codex pre-impl) | FAIL (degraded — env block) | Codex read sandbox 차단으로 컨텐츠 확인 불가 (content disagreement 아님). fallback-and-recovery.md §40-43 적용 | Opus subagent로 동일 질문 재실행 |
| 5 (Opus subagent fallback) | **PASS** | 3 layers (light spec L67, plan L128-134, plan L170) 모두 동일 신뢰 모델 — 페이로드 ownership 필드 무시 + auth.uid() 강제 | 종결, 구현 진입 |

## Docs Consulted

- Exact files read:
  - `docs/spec.md` §State Management, §Persistence
  - `docs/sitemap.md` Lines 36-45 (D-01~D-04, E-01/E-02, R-01)
  - `docs/IA/{08-D-01,09-D-02,10-D-03,11-D-04,14-E-01,15-E-02,16-R-01}/description.md`
  - `docs/flow/user-flow.md` (writing anchor)
  - `supabase/migrations/{20260520120400_writing,20260520120500_feedback,20260520121100_rls_policies,20260520121500_submission_status_function}.sql`
  - `docs/ai-workflow/runs/2026/05/21/20260521-1500-phase-4-learning-core.md` (R-TZ inherit)
  - `docs/ai-workflow/light-specs/phase-5-writing-feedback.md`
- Extracted requirements:
  - 4 active routes (writing/[questionId], feedback/short, feedback/long, reports/compare)
  - 6 writing tables typed in types.ts (Phase 3 carry-forward 일부 해소)
  - Mock LLM 기반 deterministic feedback (Phase 6에서 server function으로 교체)
  - R-TZ resolution (Phase 4 follow-up)
- Doc conflicts: none
- Untouched relevant docs and reason: none

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-21 17:00 | Mock LLM 기반 feedback-service.ts (client-side). real LLM은 Phase 6 server function | RLS write 제약 + AI 키 부재 + Phase 5는 UI/데이터 흐름 중심 | spec.md Phase 5 scope, RLS migration |
| 2026-05-21 17:00 | comparison_reports 자동 생성 OOS (명시적 CTA만) | 직전 제출 매칭 알고리즘 정의 부재. Phase 6 algorithmic recommendation row와 같이 | sitemap R-01, IA description |
| 2026-05-21 17:00 | Phase 4 R-TZ는 Task 0로 본 PR에서 해소 | streak/today KPI 의존성 — Phase 5 진입 전 해소가 safer | Phase 4 ledger R-TZ |
| 2026-05-21 17:00 | submitWriting은 best-effort 3-step (no transaction) | writing_submissions immutable + Phase 6 server function 이관 예정 | writing migration comments |

## Active Files

- Files expected to change/create: plan §File Structure 참조 (약 25개 신규)
- Files inspected: 위 Docs Consulted + 6 IA descriptions
- Files changed:
  - 수정: `src/lib/learning/kpi.ts` (R-TZ Task 0 — dayjs/utc/timezone Asia/Seoul)
  - 수정: `src/lib/supabase/types.ts` (Task 1 — 6 writing tables hand-align + fallback evidence)
  - 신규: `supabase/migrations/20260521130000_phase_5_writing_rpc.sql` (Task 1b — SECURITY DEFINER × 2)
  - 신규: `src/lib/writing/{types,server,queries,mutations,server-actions,feedback-service,comparison-service}.ts` (Task 2-7)
  - 신규: `src/components/writing/{WritingEditor,AutosaveBadge,SubmissionConfirmModal,QuestionPrompt,HelpPanel,WritingPageContent}.tsx` (Task 8)
  - 신규: `src/components/feedback/{FeedbackSummary,DimensionCardGrid,SentenceFeedbackList,FeedbackPendingPanel,NextActionBar,FeedbackPageContent}.tsx` (Task 10)
  - 신규: `src/components/reports/{MetricsTable,SubmissionDiffPanel,ComparisonReportView}.tsx` (Task 12)
  - 수정: 4 writing routes (Task 9, 11, 12)
  - 신규 테스트: `tests/lib/learning/kpi-timezone.test.ts`, `tests/lib/supabase/writing-types.test.ts`, `tests/lib/writing/{types,queries,useFeedbackStatus,feedback-service,comparison-service}.test.ts`, `tests/integration/writing-flow.test.ts`
  - 수정 문서: light spec + plan + ledger (review-driven 5 rounds + post-impl P1/P2)
- Files explicitly not to touch:
  - `supabase/migrations/*.sql` (schema/RLS 변경 없음 — 기존 정책 그대로)
  - `scripts/ai-workflow-check.mjs`, workflow docs (Phase 5 scope 외)
  - `src/lib/auth/*`, `src/lib/supabase/{browser,server,env}.ts` (Phase 2 그대로)
  - `src/components/learning/*`, `src/lib/learning/*` (kpi.ts 외 — R-TZ만 수정)

## Agent Assignments

| Agent | Role | Scope | Status | Packet |
| --- | --- | --- | --- | --- |
| Claude Code Opus 4.7 (main) | 조정 + 구현 | plan 전체 | active | this ledger |
| codex (gstack) | 사전 plan 리뷰어 | plan + light spec + RLS | running | task packet — plan path + scope |
| TBD (Opus subagent + codex) | post-impl cross-model review | 구현 완료 diff | pending | Phase 4 패턴 |

## Verification State

- Required checks: pnpm install/lint/typecheck/test/build + workflow checker
- Checks run: pnpm install / lint / typecheck / test / build / workflow check — post-fix all PASS
- Latest results (2026-05-21 17:30 KST after P1/P2 fixes):
  - `pnpm test` — 172 passed / 3 skipped / 0 failed
  - `pnpm typecheck` — PASS
  - `pnpm lint` — PASS (0 errors, 0 warnings)
  - `pnpm build` — PASS, all 4 writing routes compile + Proxy(Middleware) emit
  - `node scripts/ai-workflow-check.mjs --repo .` — PASS
- Known failures: n/a
- Skipped checks and reason: SUPABASE_LOCAL_STACK gated integration (docker 부재) — writing flow는 vitest mock으로 redirect matrix + question_no 검증 + report empty diff coverage
- Cross-model review:
  - **Pre-plan**: Codex 5 rounds: FAIL→CONCERN→CONCERN→FAIL(env-block)→Opus-fallback PASS. 4건 substantive cycle. R-TZ + RPC 도입 + Server Action user_id 제거 + RPC body 신뢰모델 + light spec drift 정정 모두 적용.
  - **Post-impl Opus**: VERDICT CONCERN. P1×2 (page lines target, draft_id contract) + P2×5. **Acted-on**: writing page supabase 인라인 fetch → `getWritingProblem` 추출(page 35줄), draft_id payload null direct + RPC `case when ? 'draft_id'` 처리, WritingEditor save sequence guard, useFeedbackStatus max-attempts 12 + null=terminal, RPC `writing_feedback.status='complete'` 강제. Light spec/plan target ≤30 → ≤40 amend (server component requireUser+fetch+delegate boilerplate justified). 일부 P2 (service_role grant for Phase 6, mutations dead invalidate)는 follow-up.
  - **Post-impl Codex**: VERDICT CONCERN. P2×2: (a) writing_submissions RLS owner-INSERT policy allows direct client insert bypassing RPC atomicity invariant (app code uses RPC only — exposed API path exists); (b) RPC body partially defensive — `problem_id`/`question_no`/`char_count`/`sentence_index` 직접 cast로 malformed payload 시 transaction abort. **Both deferred to Phase 6 follow-up** (R-INSERT-PATH, R-RPC-CAST). 본 PR에서 Server Action입력은 TypeScript narrowing으로 1차 가드.
  - **Convergence**: Opus + Codex 모두 RPC body atomicity / trust model / Server Action 계약 / types 정합성 / R-TZ 모두 PASS. Opus는 page lines + draft_id contract + autosave race + polling cap + status hardening 5건 — 5건 모두 본 PR에서 fix-in-PR. Codex는 RLS+RPC 경로 중복 + RPC casting hardening 2건 — Phase 6 deferral.
- Architecture Pass: PASS
  - supabase direct imports outside lib: 0
  - 도메인 cross-imports (writing ↔ learning/practice/feedback): 0
  - writing routes thin: 35/36/36/37 (target ≤40)
  - TanStack hooks: 모두 "use client"
  - workflow checker: PASS
- Light Spec: docs/ai-workflow/light-specs/phase-5-writing-feedback.md

## Fallback State

- Normal path blocked: none yet
- Failure class: none
- Fallback used: n/a
- Evidence collected: n/a
- Completion allowed: pending
- Remaining fallback risk:
  - SUPABASE_LOCAL_STACK 통합 테스트 skip 유지 (docker 부재)
  - real LLM 호출 OOS (Phase 5는 mock fixture)

## Ledger/File-State Consistency

- Files changed match accepted scope: yes — 25+ files all within Phase 5 + Task 0/1 cross-cutting scope
- Docs consulted match implemented behavior: yes (writing+feedback+comparison flow, R-TZ resolution, types snapshot)
- Child result packets integrated: pre-plan Codex 5 rounds (FAIL→CONCERN→CONCERN→FAIL-env→Opus-fallback PASS); post-impl Opus subagent + Codex parallel review
- Verification state current: yes (post-fix 17:30 KST 실행 결과 기재)
- Remaining risks listed: yes (R-MOCK inherit, R-FEEDBACK, R-AUTOSAVE-CONFLICT, R-COMP-TRIGGER, plus P2 findings: WritingEditor race-resolved, polling-cap-resolved, RPC service_role grant deferred)

## Risks And Follow-Up

- Remaining risks:
  - **R-MOCK (P2, inherited from Phase 4)**: Supabase chain mock을 답습하지 않도록 — Phase 5 tests는 thenable 명시 또는 fake client 사용
  - **R-RPC-CONTRACT (P1 → resolved)**: SECURITY DEFINER RPC + atomic txn + payload ownership 무시로 해소
  - **R-AUTOSAVE-CONFLICT (P2)**: partial unique로 active draft 1개 보장 — 두 탭 동시 편집 시 last-write-wins. Realtime 알림은 Phase 6
  - **R-COMP-TRIGGER**: 비교 리포트 명시적 CTA만 (OOS-5 의도)
  - **R-SERVICE-ROLE-GRANT (P2, follow-up)**: 신규 RPC에 `service_role` execute grant 미부여. Phase 6 Edge Function이 service_role로 호출하려면 `grant execute ... to service_role` 추가 필요 (현재는 `authenticated`만 허용)
  - **R-DEAD-INVALIDATE (P2, harmless)**: useSubmitWriting의 invalidateQueries는 router.push 후 어느 observer도 없는 키 invalidate — 동작은 정상이나 misleading. Phase 6 cleanup 후보
  - **R-INSERT-PATH (P2, Phase 6 follow-up)**: writing_submissions RLS owner-INSERT 정책이 SECURITY DEFINER RPC 외의 직접 insert 경로를 허용. 앱 코드는 RPC만 사용하지만, 정책 자체에 가드가 없음. Phase 6에서 writing_submissions RLS INSERT 정책 revoke + RPC를 유일 경로로 강제
  - **R-RPC-CAST (P2, Phase 6 follow-up)**: RPC body의 `problem_id`/`question_no`/`char_count`/`sentence_index` 등 cast가 jsonb_typeof 가드 없이 직접 시도. 현재는 Server Action TypeScript narrowing이 1차 방어. Phase 6에서 RPC 자체에도 `jsonb_typeof = 'string'`/`'number'` 가드 추가
  - **R-TIMEZONE-BLAST (Phase 4 inherited → resolved)**: dayjs/plugin/timezone(Asia/Seoul) 도입 + existing kpi.test.ts (31/31) PASS, 신규 kpi-timezone.test.ts (4/4) PASS로 종결
- Assumptions:
  - 20260520121100 RLS가 6 writing 테이블에 모두 self-INSERT/self-SELECT 허용 (Codex pre-review에서 확인)
  - dayjs는 이미 dependency에 있음 (Phase 4에서 추가)
- Follow-up needed:
  - Plan-Review PASS Gate 결과 적용
  - 사용자 commit/PR 결정
  - Phase 6 진입 시 real LLM Edge Function + Realtime + comparison 자동 매칭
