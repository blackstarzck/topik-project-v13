# Practice/Writing Shard — Phase 5 AI-First UX Review (Result Packet)

- Run ID: `20260528-141731`
- Source commit: `b7b7189681aaf7f5aed8a3b2ec7d34c187f365ff`
- Evidence bundle ID: `96e5d23b0ad1221f`
- Shard ID: `practice-writing`
- IA codes: C-01, C-02, C-03, D-01, D-02, D-03, D-04, D-M1, D-M2, D-M3

## Result Packet

- Agent: Subagent (practice-writing shard, Opus 4.7 1M)
- Role: Phase 5 AI-first UX reviewer for 10 IA items (practice selection + writing surfaces + 4 hosted modals)
- Objective completed: Yes — read all 10 description.md, all required JSON evidence inputs, the AI-first UX checklist, sitemap, user-flow, and produced one card per IA plus the JSON sidecar.
- Audience verified: yes — all 10 IA are `user` audience per docs/IA + dispatch plan; no admin scope was touched. No source code under `src/**` or `docs/IA/**` was modified.
- Files inspected:
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json`
  - `reports/ia-verification/runs/20260528-141731/ia-manifest.json` (via dispatch plan entries)
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json` (C-01..D-M3 entries)
  - `reports/ia-verification/runs/20260528-141731/source-map-results.json` (10 entries PASS)
  - `reports/ia-verification/runs/20260528-141731/browser-results.json` (10 entries PARTIAL — navigation timeout)
  - `reports/ia-verification/runs/20260528-141731/hosted-surface-results.json` (BLOCKED, 0 rows)
  - `reports/ia-verification/runs/20260528-141731/security-navigation-results.json` (BLOCKED, 0 rows)
  - `reports/ia-verification/runs/20260528-141731/screenshots/` (no C-/D- screenshots present)
  - `docs/IA/05-C-01-…/description.md` through `docs/IA/22-D-M3-…/description.md`
  - `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/sitemap.md` (rows 33-46)
  - `docs/flow/user-flow.md` (mermaid edges C01→DM2→E01/E02 + DM3 back-loops)
  - Directory listings of `src/app/(workspace)/practice/`, `/writing/`, `src/components/writing/`, `src/components/practice/`, `src/components/feedback/` (verification only — no read of source content for UX judgment)
- Files changed:
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-practice-writing-result.md` (this file)
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-practice-writing-cards.json`
- Decisions made:
  1. **4 hosted modals (C-03, D-M1, D-M2, D-M3) graded `BLOCKED`** for the AI UX result because `hosted-surface-results.json` is 0 rows BLOCKED and the checklist §9 forbids PASS when hosted modal triggers are unverified.
  2. **6 page IA (C-01, C-02, D-01..D-04) graded `PARTIAL`** because source-map and doc-receipt lanes PASS but every `browser-results.json` row records a 15s navigation timeout, declared screenshot paths are not in `screenshots/`, and `uxStatesCaptured: []` for all of them.
  3. Confidence set `low` across all 10 — no rendered evidence exists for any item; UX judgment from docs alone cannot reach `medium`.
  4. `Human confirmation` = `not-ready` for the 4 BLOCKED hosted modals (need hosted-surface evidence first), `needs-human-judgment` for the 6 PARTIAL pages.
  5. Followed checklist §9 strictly: no PASS from source-map or HTTP-route existence alone.
- Tests/checks run:
  - Cross-checked every IA against doc-receipts `receiptStatus: filled` — all 10 confirmed.
  - Cross-checked source-map status — all 10 PASS with valid `sourceFiles` paths.
  - Cross-checked browser-results — all 10 PARTIAL with identical "page.goto: Timeout 15000ms" reason.
  - Cross-checked hosted-surface-results + security-navigation-results — both `"rows": []`, `"status": "BLOCKED"`.
  - Verified existence of every declared implementation anchor file on disk.
  - Verified `screenshots/` directory contains only A-01, A-02, X-01, X-06, X-11, X-12 (Public/Auth shard) — confirms no rendered evidence exists for my shard.
- Results: see "Summary counts" below and the 10 IA cards.
- Blockers:
  - **Run-wide**: dev server cache + HMR noise caused every page navigation in this shard to time out at 15s. No mitigation possible from within this packet.
  - **Hosted-surface lane**: 0 rows BLOCKED for the whole run. Affects 4/10 IA in this shard directly.
  - **Security-navigation lane**: 0 rows BLOCKED. Affects C-02 (DIRECT-ID malformed-id check) and all auth-guard checks indirectly.
- Assumptions:
  - The dispatch plan's "Recommend BLOCKED for hosted-surface lane while marking description.md + source-map as PASS" guidance applies at the *lane* level. Overall `aiUxResult` follows checklist §9, which forces `BLOCKED` when the hosted-modal trigger from the host route is unverified.
  - No new docs were created. No `reports/ia-verification/latest` symlink/file touched.
- Scope concerns: none — write scope strictly inside `reports/ia-verification/runs/20260528-141731/agent-packets/results/`.
- Recommended follow-up:
  1. Re-run the Phase 3 browser + hosted-surface + security-navigation suites with a stable dev server (fresh `.next` cache, no HMR) to populate screenshots and hosted-surface/security rows.
  2. After re-run, the 6 PARTIAL pages and 4 BLOCKED modals can be re-graded with rendered evidence.
  3. D-M2 (AI analysis loading) needs targeted Korean copy review by a human reviewer regardless of evidence state — most policy-sensitive surface in the shard.
- Context ledger updates needed: main session should append a row to the active run ledger noting the practice-writing shard's evidence shortfall (browser timeouts, hosted-surface 0 rows) and that 4/10 IA are BLOCKED until those lanes produce data.

## Summary counts

| Result | IA codes | Count |
| --- | --- | --- |
| PASS | (none) | 0 |
| PARTIAL | C-01, C-02, D-01, D-02, D-03, D-04 | 6 |
| FAIL | (none) | 0 |
| BLOCKED | C-03, D-M1, D-M2, D-M3 | 4 |
| DOC-GAP | (none) | 0 |
| DEFERRED | (none) | 0 |
| **Total** | | **10** |

| Human confirmation | IA codes | Count |
| --- | --- | --- |
| ready | (none) | 0 |
| needs-human-judgment | C-01, C-02, D-01, D-02, D-03, D-04 | 6 |
| not-ready | C-03, D-M1, D-M2, D-M3 | 4 |

Confidence: `low` for all 10 (no rendered evidence available in this run).

## Top 3 shard-level risks

1. **D-M2 AI analysis loading is the highest-risk policy surface in the shard.** The IA spec promises "예상 대기 시간", "분석 단계 메시지", "10초 이상 지연 시 갱신", and "재시도 오류 / 분석 실패는 고객지원 링크" — all unverified. Per Microsoft HAX G1 + Google PAIR explainability, this is exactly the surface where overpromising AI capability or hiding uncertainty causes user trust damage. Needs human review of Korean copy on the rendered screen, not just the component file.
2. **D-M1 + D-M3 hosted modals (irreversible-action + autosave-failure) lack trigger evidence.** Both gate user data integrity. Without hosted-surface evidence we cannot confirm focus trap, focus return, scroll lock, dim, duplicate-submit prevention, or that destructive '끄기' CTA properly outranks the safe '취소' CTA.
3. **D-03/D-04 long-form/essay 3-column layouts at 360px are unknown.** WCAG 2.2 Reflow compliance for the 좌측 자료 + 본문 + 우측 체크리스트 layout is unverified. If the layout doesn't collapse cleanly, mobile users lose access to either the rubric or the reference materials during writing — a core-task failure.

## needs-human-judgment items (6)

| IA | Top question for human reviewer |
| --- | --- |
| C-01 | Is the AI recommendation reasoning copy plain and reviewable? Does the calc-failure fallback to direct-select feel safe? |
| C-02 | What happens when entering /practice/problems with a malformed or expired problem id (DIRECT-ID pack)? |
| D-01 | Is the autosave status (saved/saving/delayed/failed) distinguishable at a glance? |
| D-02 | Do the 저장 vs 제출 labels read clearly to a non-engineer (no English fallback)? |
| D-03 | Does the 3-column layout reflow acceptably at 360px without losing rubric or source materials? |
| D-04 | Is the 'submit-after-no-edit' irreversible warning shown before D-M1 opens, not only inside it? |

## not-ready items (4 hosted modals)

| IA | Why not ready |
| --- | --- |
| C-03 | Hosted-surface 0 rows; focus trap, focus return, default-mode preselect, expired-problem branch all unverified |
| D-M1 | Hosted-surface 0 rows; consent checkbox + duplicate-submit prevention + restore-on-cancel unverified; irreversible-action pack |
| D-M2 | Hosted-surface 0 rows; AI policy copy (most sensitive in shard) unverified; reduced-motion fallback unverified |
| D-M3 | Hosted-surface 0 rows; destructive CTA hierarchy, autosave-failure copy, network-disconnect branch unverified |

---

## IA Review Cards (10)

### C-01 Problem type recommendations

- Route or host route: `/practice/recommendations`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/05-C-01-problem-type-recommendations/description.md`
- Implementation anchors:
  - `src/app/(workspace)/practice/recommendations/page.tsx`
  - `src/components/practice/RecommendationsView.tsx`
  - `src/components/practice/ProblemTypeTabs.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent** (no coverage-C-01-360.png in screenshots/)
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent** (browser-results.json#C-01 references `screenshots\coverage-C-01-1280.png` but navigation timed out before capture)
  - direct URL: **not exercised** (security-navigation 0 rows)
  - browser back: **not exercised**
  - keyboard/focus: **not exercised**
  - error/empty/loading state: **uxStatesCaptured=[]**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear (from description.md — "사용자 상태 기반으로 풀 문제 유형을 추천한다")
- Entry context: clear (B-01 dashboard '추천 학습' edge in user-flow.md line 35)
- Primary action: missing evidence (expected 시작/선택/문제 풀기 CTA — none captured)
- Flow continuity: partial (docs trace C-01 → C-02 cleanly; render not verified)
- AI behavior: missing evidence (RECOMMEND pack — recommendation reasoning not captured)
- Form/error UX: not applicable
- Keyboard/focus: missing evidence
- Responsive: missing evidence (no 360/768/1280)
- Policy/trust copy: not applicable

Top gaps:
- AI recommendation reasoning ('추천 사유 2줄 이하') visibility unverified.
- Calc-failure fallback ('직접 선택 카드 + 재시도') not exercised.
- 4 type tabs at 360px (가로 스크롤 허용) — touch usability unverified.

Human reviewer should inspect:
- Whether recommendation reasoning copy is plain Korean and reviewable (Microsoft HAX G2-G4).
- Whether retry on failed recommendation calc feels safe.
- Whether 권한 잠금 유형 잠금 배지 communicates 'why locked' without paywall confusion.

---

### C-02 Problem list

- Route or host route: `/practice/problems`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/06-C-02-problem-list/description.md`
- Implementation anchors:
  - `src/app/(workspace)/practice/problems/page.tsx`
  - `src/components/practice/ProblemListView.tsx`
  - `src/components/practice/ProblemListControls.tsx`
  - `src/components/practice/ProblemListPagination.tsx`
  - `src/components/practice/ProblemRow.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent**
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent**
  - direct URL (DIRECT-ID malformed-id): **not exercised** (security-navigation 0 rows)
  - browser back: **not exercised**
  - keyboard/focus: **not exercised**
  - error/empty/loading state: **uxStatesCaptured=[]**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear ("문제를 탐색하고 조건별로 선택할 수 있게 한다")
- Entry context: clear (C-01 → C-02, also from B-01)
- Primary action: missing evidence (시작/선택/풀기/상세)
- Flow continuity: partial
- AI behavior: not applicable
- Form/error UX: missing evidence (검색 2-40자, debounce 300ms, 금칙어)
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: not applicable

Top gaps:
- DIRECT-ID pack: malformed/expired/wrong-owner id entry path completely unverified.
- 빈 결과 화면 + 초기화 CTA not visually verified.
- 비공개/만료 문제 비활성 + 사유 표시 unverified.
- 페이지 이동: 첫/마지막 페이지 비활성 unverified.

Human reviewer should inspect:
- What the user sees when entering /practice/problems with a malformed or expired problem id.
- Whether filter/sort chips (5개 이하) read clearly on 360px.
- Whether 총 건수 표시 sits in a discoverable position (상단/하단).

---

### C-03 Retry modal

- Route or host route: hosted by `/practice/problems`
- Route type: `hosted modal`
- Audience: `user`
- IA source: `docs/IA/07-C-03-retry-modal/description.md`
- Implementation anchors:
  - `src/components/practice/RetryModal.tsx`
  - host: `src/app/(workspace)/practice/problems/page.tsx`
- Required evidence:
  - host-route screenshot: **declared but file absent**
  - modal trigger (row click → modal open): **NOT CAPTURED** (hosted-surface-results.json 0 rows BLOCKED)
  - focus entry into modal: **not verified**
  - focus return on close: **not verified**
  - keyboard Esc / backdrop click: **not verified**
  - expired-problem branch: **not verified**
- AI UX result: `BLOCKED`
- Confidence: `low`
- Human confirmation: `not-ready`

AI findings:
- Page job: clear ("재풀이 시작 전 조건을 확인하고 학습을 시작한다")
- Entry context: clear (C-02 row → C-03 → D-01..D-04)
- Primary action: missing evidence (시작 CTA, 중복 실행 차단)
- Flow continuity: missing evidence (취소 → C-02; 시작 → D-0X)
- AI behavior: not applicable
- Form/error UX: missing evidence (선택 전 시작 비활성, 시작 실패 재시도)
- Keyboard/focus: missing evidence (포커스는 모달 내부 고정 — checklist §6.7 핵심)
- Responsive: missing evidence
- Policy/trust copy: not applicable

Top gaps:
- Per checklist §9, hosted modals must NOT be PASS when only component file inspected — and hosted-surface lane is 0 rows.
- Default mode pre-selection + start-disabled-until-selected unverified.
- 만료 문제 시 시작 대신 만료 안내 + 닫기만 제공 — exception branch unverified.
- 배경 클릭 닫기 (위험 상태에서는 비활성) — conditional behavior unverified.

Human reviewer should inspect:
- Whether opening retry modal from a row moves focus into the modal and returns on close (WCAG 2.2 focus order).
- Whether the start CTA is genuinely disabled before mode selection.
- Whether the expired-problem state replaces the start CTA with safe close-only affordance.

---

### D-01 Short-answer writing 51

- Route or host route: `/writing/51`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/08-D-01-short-answer-writing-51/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/WritingPageContent.tsx`
  - `src/components/writing/WritingEditor.tsx`
  - `src/components/writing/AutosaveBadge.tsx`
  - `src/components/writing/QuestionPrompt.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent**
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent**
  - autosave state (saved/saving/delayed/failed): **not captured**
  - refresh with draft: **not captured** (REFRESH pack)
  - browser back with draft: **not captured** (BACK pack)
  - submit confirmation trigger: **not captured**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear ("단답 문제를 읽고 답안을 저장/제출한다")
- Entry context: clear (C-03 → D-01)
- Primary action: missing evidence (제출/저장 CTA)
- Flow continuity: partial (D-01 → DM1 → DM2 → E-01 documented; render not verified)
- AI behavior: not applicable (D-01 itself; AI begins at D-M2)
- Form/error UX: missing evidence (10-120자 검증, blur+제출 검증)
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: not applicable

Top gaps:
- Autosave visible status differentiation (4 states) unverified.
- Refresh and browser-back with draft data not exercised — REFRESH/BACK packs both required.
- 글자수 미달/초과 즉시 표시 위치 unverified.
- 도움말 카드 3개 이하, 16자/2줄 제약 unverified.
- 이미지 로드 실패 대체 텍스트 unverified.

Human reviewer should inspect:
- Whether autosave timestamp updates as a real "상대 시간" (e.g. "방금 저장됨") and feels trustworthy.
- Whether 글자수 표시 sits where users can see it while typing on 360px.
- Whether 도움말 cards distract from primary writing task.

---

### D-02 Answer writing 52

- Route or host route: `/writing/52`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/09-D-02-answer-writing-52/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/SectionEditor.tsx`
  - `src/components/writing/HelpPanel.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent**
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent**
  - autosave state: **not captured**
  - refresh/back with draft: **not captured**
  - 저장 vs 제출 CTA separation: **not visually verified**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear ("조건 카드와 가이드를 참고해 단문 답안을 작성한다")
- Entry context: clear (C-03 → D-02)
- Primary action: missing evidence (저장/제출 분리 + 중복 제출 차단)
- Flow continuity: partial (D-02 → DM1; sidebar 이탈 → DM3)
- AI behavior: not applicable
- Form/error UX: missing evidence (10-160자, 시간/글자수 초과)
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: not applicable

Top gaps:
- 임시 저장 vs 최종 제출 CTA 분리 displayed correctly unverified.
- Sidebar 이탈 → D-M3 trigger not captured (hosted-surface BLOCKED).
- 조건 누락/로드 실패 시 제출 CTA 비활성 unverified.
- 도움말 로드 실패 시 접힘 + 재시도 unverified.

Human reviewer should inspect:
- Whether "저장" vs "제출" Korean labels are unambiguous for a non-engineer.
- Whether 조건 카드 충족도 표시 is actionable, not decorative.
- Whether 10-160자 실시간 카운터 stays visible on 360px keyboard-open state.

---

### D-03 Long-form writing 53

- Route or host route: `/writing/53`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/10-D-03-long-form-writing-53/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/LongFormEditor.tsx`
  - `src/components/writing/ManuscriptPreview.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent**
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent**
  - 3-column layout reflow: **not verified**
  - 평가 기준 카드 상태: **not captured**
  - 자동저장 실패 경고 색상: **not captured**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear ("자료 요약과 기준을 바탕으로 장문 답안을 작성한다")
- Entry context: clear (C-03 → D-03)
- Primary action: missing evidence
- Flow continuity: partial (D-03 → DM1; 이탈 → DM3; 재작성 from E-02)
- AI behavior: not applicable
- Form/error UX: missing evidence (200-300자 권장, 최소 120자)
- Keyboard/focus: missing evidence
- Responsive: missing evidence (CRITICAL — 3-column layout requires 360/768/1280 verification)
- Policy/trust copy: not applicable

Top gaps:
- 3-column layout (좌측 자료 + 본문 + 우측 평가) reflow at 360px UNKNOWN — WCAG 2.2 Reflow concern.
- 평가 기준 카드 상태(충족/주의/미충족) — color-only vs color+text/icon unverified.
- 자료 누락 / 이미지 실패 시 대체 텍스트 unverified.
- 자동저장 실패 경고 색상 + 재시도 액션 표시 unverified.
- 문단 수 표시 + 원고지 형식 not visually verified.

Human reviewer should inspect:
- Whether 3-column layout collapses to single-column readable order at 360px (does the rubric come before or after the body input?).
- Whether 평가 카드 status uses color+text+icon together (not color alone) — accessibility.
- Whether 그래프/자료 image fallback is genuinely informative.

---

### D-04 Essay writing 54

- Route or host route: `/writing/54`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/11-D-04-essay-writing-54/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/EssayChecklist.tsx`
  - `src/components/writing/ChecklistRow.tsx`
  - `src/components/writing/LongFormEditor.tsx`
- Required evidence:
  - mobile 360 screenshot: **absent**
  - tablet 768 screenshot: **absent**
  - desktop 1280 screenshot: **declared but file absent**
  - 600-700자 권장 / 최소 300자 분량 경고 모달: **not captured**
  - "제출 후 수정 불가" irreversible-action copy: **not captured**
  - 우측 체크리스트 6개 이하 상태: **not captured**
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear ("개요와 루브릭을 참고해 에세이 답안을 작성한다")
- Entry context: clear (C-03 → D-04)
- Primary action: missing evidence
- Flow continuity: partial
- AI behavior: not applicable (D-04 itself; AI at D-M2)
- Form/error UX: missing evidence (300자 미만 경고)
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: partial — "제출 후 수정 불가" is irreversible-action copy but not visually verified

Top gaps:
- "제출 후 수정 불가" copy positioning (before D-M1 opens vs only inside it) unverified.
- 분량 부족 경고 모달 wording tone not verified — checklist §6.5 plain-language requirement.
- 조건 로드 실패 시 본문 작성 + 제출 잠금 unverified.
- 체크리스트 6개 이하 상태 표시 unverified.
- 600-700자 권장에 대한 글자수 카운터 UX unverified.

Human reviewer should inspect:
- Whether "제출 후 수정 불가" warning surfaces BEFORE D-M1 opens (so user can still edit) — irreversible-action UX principle.
- Whether 분량 부족 경고 wording reads as helpful, not punishing (Korean tone).
- Whether 루브릭 요약 3항목 are scannable at glance.

---

### D-M1 Submission confirmation

- Route or host route: hosted by `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54`
- Route type: `hosted modal`
- Audience: `user`
- IA source: `docs/IA/12-D-M1-submission-confirmation-modal/description.md`
- Implementation anchors:
  - `src/components/writing/SubmissionConfirmModal.tsx`
  - host: `src/app/(workspace)/writing/[questionId]/page.tsx`
- Required evidence:
  - host-route screenshot: **declared but file absent**
  - modal trigger (제출 button click → modal open): **NOT CAPTURED** (hosted-surface 0 rows)
  - focus entry into modal: **not verified**
  - focus return on close: **not verified**
  - 동의 체크 → 제출 enable 전환: **not verified**
  - 중복 제출 차단 visual state: **not verified**
  - 취소 시 작성 화면 입력값 복구: **not verified**
  - 제출 실패 모달 유지 + 재시도: **not verified**
- AI UX result: `BLOCKED`
- Confidence: `low`
- Human confirmation: `not-ready`

AI findings:
- Page job: clear ("제출 전 답안 요약과 동의 상태를 확인한다")
- Entry context: clear (D-01..D-04 제출 → D-M1)
- Primary action: missing evidence (제출 CTA + 중복 제출 차단)
- Flow continuity: missing evidence (확인 → D-M2)
- AI behavior: missing evidence (IRREVERSIBLE-ACTION + AI-handoff signal)
- Form/error UX: missing evidence (동의 체크 활성화)
- Keyboard/focus: missing evidence (modal focus — checklist §6.7 mandatory)
- Responsive: missing evidence
- Policy/trust copy: missing evidence ("제출 후 AI 분석 시작과 대기 가능성" notice — sensitive AI copy)

Top gaps:
- Per checklist §9, hosted modals must NOT be PASS when only component file inspected.
- 동의 체크 → CTA enable transition unverified.
- 중복 제출 차단 — disabled state visibility unverified.
- 취소 시 입력값 복구 unverified.
- 제출 실패 시 모달 유지 + 오류 원인 + 재시도 unverified.
- Summary truncation behavior (답안 글자수만 표시) unverified.

Human reviewer should inspect:
- Whether "제출 후 AI 분석 시작" notice signals where AI takes over (HAX G1).
- Whether the consent checkbox copy is plain Korean, not legalese, and does not over-promise AI outcomes.
- Whether the duplicate-submit prevention produces a visible disabled state, not just a silent noop.
- Whether 취소 truly restores draft input state without loss.

---

### D-M2 AI analysis loading

- Route or host route: hosted by writing submission flow
- Route type: `hosted state` (transitional)
- Audience: `user`
- IA source: `docs/IA/13-D-M2-ai-analysis-loading/description.md`
- Implementation anchors:
  - `src/components/feedback/AnalysisLoadingModal.tsx`
  - `src/components/feedback/AnalysisCharacter.tsx`
- Required evidence:
  - host-route screenshot: **declared but file absent**
  - 분석 진행 4단계 (문법/구성/표현/점수) 순차 표시: **not captured**
  - 예상 대기 시간 copy: **not captured**
  - 10초 이상 지연 시 메시지 갱신: **not captured**
  - 분석 실패 → 고객지원 링크: **not captured**
  - 뒤로가기 → 분석 중단 경고: **not captured**
  - 모션 비활성 시 정적 이미지 대체: **not captured**
- AI UX result: `BLOCKED`
- Confidence: `low`
- Human confirmation: `not-ready`

AI findings:
- Page job: clear ("제출 후 AI 분석 진행 상태를 제공한다")
- Entry context: clear (D-M1 확인 → D-M2)
- Primary action: not applicable (transitional state)
- Flow continuity: missing evidence (분석 완료 → E-01/E-02)
- AI behavior: missing evidence (CRITICAL — most AI-sensitive surface in shard)
- Form/error UX: not applicable
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: missing evidence (CRITICAL — '예상 대기 시간', '재시도 오류', '고객지원')

Top gaps:
- Most policy-sensitive surface in the shard. Per checklist §6.4 (Human-AI behavior), every assertion below must be verifiable:
  - "User can tell where AI is involved" — character + step animation must communicate AI clearly, not as generic loading.
  - "Page explains why the AI recommendation/feedback appears" — 4 step labels (문법/구성/표현/점수) must reflect actual backend pipeline, not be performative.
  - "Uncertainty is not hidden behind confident copy" — 예상 대기 시간 must be honest range, not false precision.
  - "Reject/retry/regenerate/report path exists" — 뒤로가기 분석 중단 경고 path unverified.
- Motion-reduced fallback (정적 이미지) — WCAG 2.2 accessibility concern unverified.
- AI-OUTPUT pack browser screenshot absent.

Human reviewer should inspect:
- Whether '예상 대기 시간' gives a real range (e.g. "약 20-40초") and what shows when range is exceeded — Google PAIR explainability requirement.
- Whether the 4-step progress reflects backend reality or is decorative animation that misleads (HAX G2: clear how well the system can do what it can do).
- Whether '분석 실패' surfaces a recovery path that doesn't lose the submitted answer.
- Whether Korean copy avoids over-promising framing like "AI가 정확하게 분석합니다" — should hedge to "AI가 분석을 시도합니다" or similar.
- Whether the loading state is dismissible by 뒤로가기 with clear warning, not trapped.

---

### D-M3 Autosave warning

- Route or host route: hosted by `/writing/51`, `/writing/52`, `/writing/53`, `/writing/54`
- Route type: `hosted modal`
- Audience: `user`
- IA source: `docs/IA/22-D-M3-autosave-warning/description.md`
- Implementation anchors:
  - `src/components/writing/AutosaveWarningModal.tsx`
  - host: `src/app/(workspace)/writing/[questionId]/page.tsx`
  - `src/components/writing/AutosaveBadge.tsx`
- Required evidence:
  - host-route screenshot: **declared but file absent**
  - autosave-failure trigger (network down / sidebar leave): **NOT CAPTURED** (hosted-surface 0 rows)
  - 마지막 저장 시각 / 복구 상태 (가능/불가/확인중) copy: **not captured**
  - 위험 CTA '끄기' confirm 문구 + 중복 클릭 차단: **not captured**
  - 네트워크 끊김 '복구 불가' branch: **not captured**
  - 아이콘 로드 실패 시 텍스트 배지 대체: **not captured**
- AI UX result: `BLOCKED`
- Confidence: `low`
- Human confirmation: `not-ready`

AI findings:
- Page job: clear ("저장되지 않은 변경 이탈을 방지한다")
- Entry context: clear (D-01..D-04 저장 경고/이탈 → D-M3)
- Primary action: missing evidence (취소 vs 끄기 destructive CTA)
- Flow continuity: missing evidence (DM3 → D-0X 또는 → C-02 '저장 안 함')
- AI behavior: not applicable
- Form/error UX: missing evidence (FAILURE + RECOVERY packs)
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: missing evidence (손실 범위 명시 — what exactly will be lost)

Top gaps:
- Per checklist §9, hosted modals must NOT be PASS when only component file inspected; hosted-surface 0 rows BLOCKED.
- Destructive '끄기' CTA visual hierarchy vs safe '취소' CTA unverified.
- Warning copy must explain WHAT will be lost (글자/단락), not just THAT data could be lost — unverified.
- False-positive risk: warning firing on routine delays (not true failures) unverified.
- 네트워크 끊김 + '복구 불가' branch copy unverified.
- 위험 CTA 중복 클릭 차단 unverified.

Human reviewer should inspect:
- Whether '끄기' (destructive) CTA visually outranks '취소' or matches risk hierarchy — checklist §6.5 "errors explain what happened, why it matters".
- Whether the warning copy quantifies the loss ("최근 5문장, 약 200자가 사라집니다") rather than vague threats.
- Whether the warning fires only on true autosave failures, not routine 1-2s delays (false-positive trust damage).
- Whether 마지막 저장 시각 is shown in human-readable form (상대 시간 권장).

---

## Honesty notes

- No PASS issued for any of the 10 IA. Browser timeouts and 0-row hosted-surface/security-navigation lanes mean the AI reviewer has only doc + source-map evidence — checklist §9 explicitly forbids PASS on that alone.
- All hosted modals (C-03, D-M1, D-M2, D-M3) are graded BLOCKED per dispatch plan guidance and checklist §9.
- All 6 page IA are graded PARTIAL because doc-receipts and source-map lanes are PASS but rendered evidence is absent — the docs-and-code dimension is verified, the user-visible dimension is not.
- Confidence is `low` across all 10 — none of the cards can be raised without rendered evidence.
- No claim is made about Korean copy quality; that is explicitly deferred to the human reviewer questions listed per card.
- The dispatch plan's hint to recommend BLOCKED for hosted-modal lanes is applied at the overall aiUxResult level, since checklist §9 is stricter than the per-lane suggestion.
