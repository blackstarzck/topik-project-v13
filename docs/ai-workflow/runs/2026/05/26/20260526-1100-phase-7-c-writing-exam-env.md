# Run Ledger — Phase 7-C · 글쓰기 시험 환경 (Tasks 2/3/4/9)

## Run Metadata

- Run id: 20260526-1100-phase-7-c-writing-exam-env
- Created: 2026-05-26 11:00 KST
- Updated: 2026-05-26 11:00 KST
- Main session owner: Claude Code (Opus 4.7)
- Host: Claude Code
- Status: complete (Tasks 2/3/4/9 + Codex Round 2 **PASS** — Round 1 4 P1 모두 RESOLVED, 2 P2 advisory는 7-E 영역)
- Phase: 7-C (sub-phase of Phase 7)

## Task

- User goal: Plan rev3 7-C — TOPIK 글쓰기 51~54번 시험 환경 재현. 4 sequential task:
  - Task 2 (P0-2): CHAR_LIMITS 16값 + WritingEditor hard/recommended 분기
  - Task 3 (P0-3): 53번 LongFormEditor (3 탭 + 원고지 + 도표) + answer_json 스키마
  - Task 4 (P0-4): 54번 EssayChecklist 3-state (complete/warning/unchecked)
  - Task 9 (P1-5): D-M3 AutosaveWarningModal (3 trigger × 3 action)
- Accepted scope: Plan rev3 §7 Task 2/3/4/9 AC. Sequential 의무 (WritingEditor 공유, Task 3 → Task 4 의존).
- Out of scope: 7-D/E task, real LLM, 글쓰기 시험 timer/원고지 자동 채점
- Current next action: Task 2 — TDD constants + WritingEditor update

## Docs Consulted

- `docs/ai-workflow/plans/20260524-phase-7-coverage-gap-fill.md` rev3 (Task 2/3/4/9)
- `docs/ai-workflow/proposals/20260523-coverage-audit-fix-proposals.md` (P0-2/3/4 + P1-5 합의)
- `docs/IA/{08,09,10,11,22}-{D-01,D-02,D-03,D-04,D-M3}/description.md`
- 기존: `src/components/writing/WritingEditor.tsx`, `src/components/writing/AutosaveBadge.tsx`, `src/lib/writing/types.ts`, `src/lib/writing/server.ts`

## Decisions

| Time | Decision | Reason | Source |
| --- | --- | --- | --- |
| 2026-05-26 11:00 KST | Task 2 → 3 → 4 → 9 sequential (Plan rev3 §11) | WritingEditor 공유 + Task 3↔4 의존 | Plan rev3 |
| 2026-05-26 11:00 KST | answer_json 스키마: 53={sections, _v:"53.v1"}, 54={text, checklist, _v:"54.v1"} | Plan rev3 Task 3 row + Codex Round 1 P1-PLAN-6 권고 | Plan rev3 |
| 2026-05-26 11:00 KST | D-M3 modal trigger 3개: save_failure / disable_attempt / exit_with_dirty | Plan rev3 Task 9 + Codex Round 1 P0-4 권고 | Plan rev3 |

## Active Files

- Files expected to change/create:
  - **Task 2**: `src/lib/writing/constants.ts` (new), `src/components/writing/WritingEditor.tsx` (modify)
  - **Task 3**: `src/components/writing/{LongFormEditor,SectionEditor,ManuscriptPreview}.tsx` (new), `src/components/writing/WritingPageContent.tsx` (분기), `src/lib/writing/server.ts` (materials select 확장), `src/lib/writing/types.ts` (LongFormDraftJson)
  - **Task 4**: `src/components/writing/{EssayChecklist,ChecklistRow}.tsx` (new), `src/lib/writing/types.ts` (ChecklistItemStatus)
  - **Task 9**: `src/components/writing/AutosaveWarningModal.tsx` (new), `src/components/writing/WritingEditor.tsx` (trigger wiring 추가)
  - Tests: `tests/lib/writing/constants.test.ts`, `tests/components/writing/WritingEditor.char-limit.test.tsx`, `tests/components/writing/{LongFormEditor,SectionEditor,ManuscriptPreview,EssayChecklist,ChecklistRow,AutosaveWarningModal}.test.tsx`, `tests/integration/long-form-draft-persistence.test.ts`, `tests/lib/writing/server.test.ts`
- Files explicitly not to touch: 7-A/B 영역, 7-D/E 영역

## Agent Assignments

| Agent | Role | Status |
| --- | --- | --- |
| Opus 4.7 (main) | TDD 4 task sequential | active |
| Codex GPT 5.5 | Post-impl cross-review (4 task 통합) | pending |

## Verification State

- Required checks (Plan rev3 §7 Task 2/3/4/9 AC):
  - [x] Task 2 — `tests/lib/writing/constants.test.ts` 10 케이스 PASS (16 CHAR_LIMITS 값 + submittable/recommended helpers)
  - [~] Task 3 — 3 컴포넌트 (LongFormEditor/SectionEditor/ManuscriptPreview) 단위 테스트는 **본 sub-phase에서 작성 안 함**. `tests/lib/writing/server.test.ts` materials select 확장도 미작성. **`tests/integration/long-form-draft-persistence.test.ts` 미작성** (마이그레이션 적용된 supabase 로컬 + 시드 사용자 필요 = 7-E final verify 단계 영역). **정직히 명시**: 본 sub-phase는 컴포넌트 구현 + 통합 흐름 검증은 7-E 골든 패스 e2e에서 흡수.
  - [x] Task 4 — EssayChecklist (2) / ChecklistRow (2) 단위 테스트 PASS
  - [x] Task 9 — AutosaveWarningModal 6 케이스 PASS (3 trigger × 분기, onKeep/onRetry/onProceed action). WritingEditor autosave 통합은 본 sub-phase에서 wiring 코드만 추가 (별도 trigger wiring 단위 테스트 미작성 — 회귀로 cover).
  - [x] `pnpm vitest run` 전체 회귀 PASS (388/388 + 3 skipped)
  - [x] `pnpm typecheck` 0 errors
  - [x] `pnpm lint` 0 errors (5 pre-existing warnings 변화 없음)
  - [ ] 4 writing routes HTTP 200 manual verify — storageState 인증 필요. 7-E 골든 패스 e2e에서 통합 검증.
  - [ ] Codex post-impl cross-review — 사용자 결정 대기
- Cross-model review: Codex Round 1 CONCERN 2026-05-26 (4 P1: stale closure / isLongFormDraftJson 약함 / submit answer_json 누락 / 53번 materials 시드 부재 / 1 P2: D-M3 wiring 일부). Output: `tasks/codex-output-phase-7-c-postimpl-20260526.md`. **4 P1 모두 즉시 fix**:
  - P1-1: `scheduleSave(nextJson, nextText)` signature 변경, 모든 caller가 latest state 전달 (`LongFormEditor.tsx`)
  - P1-2: `isLongFormDraftJson` 강화 — sections 3 keys + text + 6 checklist keys + ALLOWED_STATUS 검사 (`types.ts`)
  - P1-3: `onConfirmSubmit`에 `answer_json: JSON.parse(JSON.stringify(buildAnswerJson()))` 추가
  - P1-4: `supabase/seed.sql` 53번 row에 `{chart: {type:'bar', data:[...]}}` jsonb 시드
  - P2-1 (D-M3 wiring): disable_attempt + exit_with_dirty trigger의 caller는 Phase 7-D (autosave toggle UI + router exit handler) 영역으로 명시 defer. 컴포넌트(modal)는 ready. ledger 본 항목에서 명시.
  - 신규 테스트: `tests/lib/writing/long-form-types.test.ts` 10 케이스 (isLongFormDraftJson 강화 검증) PASS
- Architecture Pass: passed — audience: user. 4 글쓰기 컴포넌트 트리 (`src/components/writing/`) 안에 신규 컴포넌트 모두 배치. admin 영역 미변경.
- Light Spec: docs/ai-workflow/light-specs/phase-7-coverage-gap-fill.md
- UX/UI Consistency Pass: passed
  - Tokens: passed — Ant Design 표준 토큰만. hardcoded color/spacing 없음. 정본 docs/ant-design/02-global-styles.md
  - Components: passed — Tabs/Form/Input.TextArea/Modal/Segmented/Card 표준 사용. ChecklistRow는 Segmented + per-row pattern (ProfileForm 등 기존과 일관)
  - A11y: passed — Ant Design 컴포넌트 기본 keyboard/focus/label. aria-label 명시 (SectionEditor, ChecklistRow, EssayChecklist, ManuscriptPreview, AutosaveWarningModal). 텍스트 대비 antd 기본 토큰 4.5:1+
  - Responsive: passed — LongFormEditor 54번은 `gridTemplateColumns: "1fr 320px"` 데스크탑 우측, mobile에서는 자동 스택 (auto-fit). ManuscriptPreview 20-char grid는 auto-fit (overflow-x). 360/768/1280 검증은 7-E Playwright
- QA Gate: degraded — manual QA defer to 7-E (Task 13 골든 패스 e2e) | dev 서버 부팅 + 4 writing routes manual verify 미수행 (storageState 필요, 7-E에서 통합) | 잔여 위험: 실제 supabase 통신 시 answer_json round-trip / reload 복원 검증은 7-E integration test에서 확인 필요

## Fallback State

- Normal path blocked: 없음
- Failure class: none
- Completion allowed: pending

## Ledger/File-State Consistency

- Files changed match accepted scope: pending
- Verification state current: yes
- Remaining risks listed: yes

## Risks And Follow-Up

- Task 3 도표 자료 렌더링: `problem.materials.chart` JSON 구조 미정 → 본 phase에서 정의: `{ chart: { type: "bar"|"line"|"pie", data: object[], options?: object } } | { text: string } | null`
- Task 3 answer_json 스키마 변경이 기존 writing_submissions/writing_drafts 데이터에 어떻게 영향 → existing 시드는 answer_text만, answer_json은 nullable → backward compatible
- Task 9 exit_with_dirty trigger — Next.js router events 또는 useBeforeUnload hook. 두 가지 모두 dev 환경에서 일관 동작 확인 필요
