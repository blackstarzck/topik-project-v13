# Onboarding/Dashboard Shard — AI-First UX Review Result

## Result Packet

- Agent: Claude Code Opus 4.7 (subagent)
- Role: IA Phase 5 AI-first UX reviewer for onboarding-dashboard shard (A-03, B-01, X-02)
- Objective completed: First-pass AI UX review of 3 IA items, with `needs-human-judgment` surfaced for all because rendered evidence is missing and X-02 is a placeholder. Two artifacts written to delegated write scope.
- Audience verified: yes — all 3 IA are `user` audience pages (no admin actions inspected, no public-only copy touched). Inspection limited to read-only review of `src/app/(workspace)/...` plus `docs/IA/<folder>/description.md`. No code or docs modified.
- Files inspected:
  - `docs/IA/03-A-03-learning-goal-setup/description.md`
  - `docs/IA/04-B-01-home-dashboard/description.md`
  - `docs/IA/24-X-02-growth-dashboard/description.md`
  - `docs/sitemap.md` (Target React Route Map, audience matrix, mermaid flow)
  - `docs/flow/user-flow.md` (B-01 outgoing edges, A-03 → B-01)
  - `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` (§4, §5, §6, §9)
  - `docs/ai-workflow/agent-packets.md` (Result Packet template)
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json` (shard scope)
  - `reports/ia-verification/runs/20260528-141731/source-map-results.json` (A-03, B-01, X-02 all PASS source-map)
  - `reports/ia-verification/runs/20260528-141731/browser-results.json` (3 IA × multiple viewports — all `navigation error: page.goto: Timeout 15000ms exceeded`)
  - `reports/ia-verification/runs/20260528-141731/security-navigation-results.json` (BLOCKED, 0 rows)
  - `reports/ia-verification/runs/20260528-141731/ai-ux-review.json` (existing cards mark all 3 BLOCKED)
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json` (all 3 present)
  - `reports/ia-verification/runs/20260528-141731/screenshots/` directory listing — confirmed no `coverage-A-03-*.png`, `coverage-B-01-*.png`, `coverage-X-02-*.png` files exist
  - `src/app/(workspace)/layout.tsx` (session guard → `/login`)
  - `src/app/(workspace)/onboarding/learning-goal/page.tsx`
  - `src/app/(workspace)/dashboard/page.tsx`
  - `src/app/(workspace)/growth/page.tsx`
  - `src/components/learning/LearningGoalForm.tsx`
  - `src/components/learning/DashboardContent.tsx`
  - `src/components/learning/KpiSummary.tsx`
  - `src/components/learning/EmptyDashboard.tsx`
  - `src/components/shared/PlaceholderPage.tsx`
- Files changed:
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-onboarding-dashboard-result.md` (this file)
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-onboarding-dashboard-cards.json`
- Decisions made:
  - All 3 IA carry `AI UX result = BLOCKED` because rendered evidence is missing per checklist §9 ("No rendered screenshot or browser evidence exists" ⇒ must not PASS). Confidence is `medium`–`high` for the BLOCKED label itself (multiple JSON evidence rows + missing screenshots converge).
  - `Human confirmation = needs-human-judgment` for all 3, because: (a) BLOCKED requires human (§11), (b) B-01 has visible doc/impl drift on KPI labels, and (c) X-02 is a `PlaceholderPage` stub — the docs describe 6 substantive regions, none of which are implemented; a human must decide whether to relabel as DEFERRED or treat as DOC-GAP.
  - Did not run a fresh browser navigation attempt or modify any dev-server state — out of scope for read-only subagent review.
- Tests/checks run:
  - Document existence checks for description.md (3/3 present, wireframes present).
  - Source-map evidence cross-check (3/3 PASS in source-map-results.json).
  - Browser evidence cross-check (3/3 navigation timeouts; 0 screenshots on disk).
  - Implementation read-through (A-03 form schema, B-01 guard + KPI mapping, X-02 placeholder).
- Results: PASS 0 / PARTIAL 0 / FAIL 0 / BLOCKED 3 / DOC-GAP 0 / DEFERRED 0.
- Blockers:
  - Phase 2 browser navigation timed out for all 3 protected routes (consistent with shard-wide `student.json` storageState session not resolving on the dev server at the time of capture). Until protected-route screenshots exist, no member of this shard can move past BLOCKED in AI UX review.
  - `security-navigation-results.json` is empty (`status: BLOCKED`, 0 rows), so direct-URL, refresh, browser-back, owner-mismatch lanes for these 3 routes have no evidence.
- Assumptions:
  - `src/app/(workspace)/...` files are read-only inspection only (filesNotToTouch lists `src/**`); not modifying them is correct.
  - The dispatch plan's `iaFolder` paths in `docs/IA/<n>-<code>-<slug>/description.md` are authoritative; only those 3 description.md files were read.
  - `getLearningGoal` returns `null` when the row is absent; this matches the `if (!goal) redirect("/onboarding/learning-goal")` guard in `dashboard/page.tsx` (cannot be unit-verified here, but the code path is unambiguous).
- Scope concerns:
  - X-02 is a placeholder in code (`PlaceholderPage`), but `docs/sitemap.md` lists it as a real `user` page, and the description.md specifies 6 substantive areas (KPI/charts/weakness matrix/insights/etc.). This is a real product-decision gap that the main session must adjudicate. I flagged it as `needs-human-judgment` rather than unilaterally writing it off as DEFERRED.
  - B-01 KPI labels in `KpiSummary.tsx` ("오늘 시도", "누적 시도", "시험까지", "연속 학습일") do not match B-01 description.md ("오늘 제출", "최근 첨삭", "목표 달성", "연속 학습"). This is a content/wording mismatch — flagged to the human reviewer rather than scored as FAIL because the underlying intent (today/cumulative activity + exam D-day + streak) is preserved.
  - A-03 has no guard that redirects an already-onboarded user (existing learning goal) to `/dashboard`; the form simply pre-fills. Description.md does not require this redirect explicitly, but the user flow shows A-03 → B-01 as forward-only. Flagged for human review.
- Recommended follow-up:
  - **P0**: Restore Phase 2 protected-route browser evidence (student storageState session) so this shard can move past BLOCKED. Reproducer: `npx playwright test tests/e2e/coverage/coverage-matrix.spec.ts --project=desktop-1280` for the three routes after confirming `tests/e2e/auth-state/student.json` is valid.
  - **P1**: Decide X-02 product status — is it DEFERRED (placeholder is intentional for this phase) or DOC-GAP (description.md should be archived/updated)? Update `docs/IA/24-X-02-growth-dashboard/description.md` or `docs/sitemap.md` to reflect the chosen state.
  - **P1**: Reconcile B-01 KPI labels — either update `KpiSummary.tsx` to match description.md or update description.md to match the implementation. "최근 첨삭" specifically should be re-evaluated — the implementation surfaces "최근 첨삭" inside `RecentFeedbackCard` row 2, not in the KPI strip, which may be the right call but should be made explicit in the doc.
  - **P2**: Add an A-03 re-entry decision: when a user with an existing `learning_goal` row lands on `/onboarding/learning-goal` (via bookmark or direct URL), is that "edit goal" or "redirect to dashboard"? Currently the form silently pre-fills, which is reasonable but ambiguous against the "first-run" framing in description.md.
- Context ledger updates needed: Main session should record this shard's `needs-human-judgment` items in the run ledger so they survive into Phase 5 human review and Phase 6 audit.

---

## AI UX Review Cards

### A-03 Learning goal setup

- Route or host route: `/onboarding/learning-goal`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/03-A-03-learning-goal-setup/description.md`
- Implementation anchors:
  - `src/app/(workspace)/onboarding/learning-goal/page.tsx`
  - `src/components/learning/LearningGoalForm.tsx`
  - `src/app/(workspace)/layout.tsx` (session guard)
  - `src/lib/learning/server.ts` (`getLearningGoal`)
  - `src/lib/learning/mutations.ts` (`useSaveLearningGoal`)
- Required evidence:
  - mobile 360 screenshot: missing (`screenshots/coverage-A-03-360.png` absent)
  - tablet 768 screenshot: missing
  - desktop 1280 screenshot: missing (browser nav timed out 15000ms)
  - direct URL: not verified (security-navigation lane BLOCKED, 0 rows)
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: form is wired (`mutation.isPending` loading, `notification.error` on save failure, zod schema with past-date refinement) but no rendered evidence captured
- AI UX result: `BLOCKED`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear in code (Title "학습 목표 설정", Paragraph "목표 설정은 맞춤 추천의 기반이 됩니다."). No rendered evidence.
- Entry context: clear from session guard chain (`/login` → workspace layout → page) and from user-flow.md (A-01 → A-03). Direct-URL entry by an already-onboarded user is unverified — see scope concern.
- Primary action: clear in code — single primary `Button` "저장하고 대시보드로 이동" with `block` style. No competing CTAs.
- Flow continuity: pass in code (router.push("/dashboard") on success). Browser-back behaviour from this page not verified.
- AI behavior: not applicable (no AI surface on this screen).
- Form/error UX: partial in code. Required fields (`topik_level`, `target_grade`) are flagged with antd `required` and have a zod schema. Date past-date rejection is enforced both in `DatePicker.disabledDate` and zod `.refine`. Save failure path shows `notification.error` with provider error message — checklist §6.9 ("Raw provider errors are not shown to users") may be violated when the underlying mutation throws a Supabase error with raw message; needs human inspection of typical error copy.
- Keyboard/focus: not verified — antd `Form` is generally keyboard-accessible but tab order and focus return after notification dismissal need a rendered check.
- Responsive: not verified at 360/768/1280. Page uses `maxWidth: 640` container; antd `Select`/`DatePicker`/`InputNumber` are `width: "100%"`.
- Policy/trust copy: not applicable (no policy or trust claims on this screen).

Top gaps:
- No rendered screenshots; cannot confirm the antd `Form` actually renders the description's "온보딩 진행 단계" indicator (1/3 progress) — the code does **not** include any progress/step indicator component, which is a region defined in description.md §1. This is a wireframe-fidelity gap.
- "안내/마스코트" region (description.md §2) is partially covered by the Paragraph "목표 설정은 맞춤 추천의 기반이 됩니다." — no mascot or visual; humans must decide if the text-only treatment is acceptable.
- No re-entry guard for users who already have a `learning_goal`. Form silently pre-fills; description.md calls this "first-run", implying a guard may be expected.
- Save failure message reuses raw error message (`err.message`) when mutation fails. Need a wrapper that maps Supabase errors to safe user copy.

Human reviewer should inspect:
- Whether the missing "온보딩 진행 단계" (step 1/3) indicator is a real omission or intentionally trimmed for a single-page goal form.
- Whether re-entry on an existing learning goal should redirect or edit.
- Whether `err.message` shown via antd `notification.error` ever leaks Supabase/Postgres error text to learners.
- Whether mobile 360 keyboard interaction with antd `Select mode="multiple"` (weak_areas) is usable.

Evidence still needed: 360/768/1280 screenshots after successful auth, error-state screenshot (forced save failure), keyboard-focus video for the Form, and direct-URL entry test for already-onboarded user.

---

### B-01 Home dashboard

- Route or host route: `/dashboard`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/04-B-01-home-dashboard/description.md`
- Implementation anchors:
  - `src/app/(workspace)/dashboard/page.tsx`
  - `src/components/learning/DashboardContent.tsx`
  - `src/components/learning/KpiSummary.tsx`, `KpiCard.tsx`
  - `src/components/learning/EmptyDashboard.tsx`
  - `src/components/learning/RecommendationCard.tsx`, `UpcomingExamCard.tsx`, `RecentFeedbackCard.tsx`, `AlertsCard.tsx`
  - `src/components/app/WorkspaceShell.tsx` (sidebar nav, region 1)
  - `src/lib/learning/kpi.ts` (`getDashboardKpi`)
- Required evidence:
  - mobile 360 screenshot: missing
  - tablet 768 screenshot: missing
  - desktop 1280 screenshot: missing (nav timed out)
  - direct URL: not verified
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: empty-state branch (`EmptyDashboard`) exists in code, but no rendered evidence
- AI UX result: `BLOCKED`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear in code (single Title via WorkspaceShell; KpiSummary + recommendation cards + alerts).
- Entry context: clear via `requireUser()` + guard `if (!goal) redirect("/onboarding/learning-goal")` — strong A-03 ⇄ B-01 flow continuity in code.
- Primary action: partial. Description requires "이어 풀 문제, 추천 유형, 최근 피드백" three card types. Code renders only one `RecommendationCard` ("이어 풀 문제") and a separate `RecentFeedbackCard` row; the explicit "추천 유형" card is missing.
- Flow continuity: pass in code for the implemented edges (RecommendationCard → `/practice/recommendations`, EmptyDashboard → `/practice/recommendations`). user-flow.md outgoing edges (`B-01 → C-01`, `B-01 → F-01`, `B-01 → X-02`, `B-01 → X-09`, `B-01 → G-01`, `B-01 → X-05`, `B-01 → X-04`) — most are reachable via the workspace sidebar, not the dashboard body; needs rendered verification.
- AI behavior: not applicable on this page (no AI-generated copy is rendered directly here; recent feedback only shows score totals).
- Form/error UX: not applicable.
- Keyboard/focus: not verified.
- Responsive: not verified. Code uses antd `Row gutter` with `xs={12} md={6}` for KPI and `xs={24} md={16/8}` for the row split — looks responsive on paper.
- Policy/trust copy: pass in code (no billing/notification claims surfaced; alerts use plain "시험 D-N" / "작성 중인 답안" copy).

Top gaps:
- **KPI label drift (doc/impl mismatch)**: description.md §2 specifies "오늘 제출 / 최근 첨삭 / 목표 달성 / 연속 학습"; implementation renders "오늘 시도 / 누적 시도 / 시험까지 / 연속 학습일". Three of four labels differ. "목표 달성" KPI is absent entirely. "시험까지" (D-day) replaces "최근 첨삭". Human must reconcile.
- **Missing "추천 유형" card** (description.md §3 requires 3 card types; code shows 1 + RecentFeedback).
- Empty-state copy "아직 학습 기록이 없어요. 추천 문제부터 시작해보세요." satisfies description's §2 exception ("신규 사용자는 0값 대신 시작 유도 문구") but the KPI strip itself still shows 0s above the empty state CTA — needs human judgment on whether that double-surface is desirable.
- No loading state evidence; `dashboard/page.tsx` is async server component so a Next.js suspense boundary (`loading.tsx`) is the loading UI — need to confirm one exists.

Human reviewer should inspect:
- Whether the KPI label drift is acceptable or must be reconciled to description.md.
- Whether the "추천 유형" card omission is intentional (Phase 7 partial) or a gap.
- Whether the workspace sidebar (region 1) actually shows "홈/문제 풀기/쓰기 연습/내 서재/성장 리포트/설정" in the exact order with 10-char-or-less labels per description.md.
- Whether the in-app alerts list capped at "5개 이하" is enforced anywhere or just a soft constraint.

Evidence still needed: 360/768/1280 dashboard screenshots, empty-state screenshot (new user with no submissions, no goal? — currently impossible because no-goal redirects to A-03; consider new user *with* goal but no submissions), recent-feedback render with non-empty data, alert row render, sidebar render with active route highlight.

---

### X-02 Growth dashboard

- Route or host route: `/growth`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/24-X-02-growth-dashboard/description.md`
- Implementation anchors:
  - `src/app/(workspace)/growth/page.tsx`
  - `src/components/shared/PlaceholderPage.tsx`
- Required evidence:
  - mobile 360 screenshot: missing
  - tablet 768 screenshot: missing
  - desktop 1280 screenshot: missing
  - direct URL: not verified
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: not applicable to current placeholder
- AI UX result: `BLOCKED`
- Confidence: `high`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: implementation is a placeholder card with `phaseHint="진척/성장 분석 차트는 Phase 4에서 채워집니다."`. Description.md specifies 6 substantive regions (sidebar, KPI cards, growth chart, weakness matrix, AI insights, bottom summary/recs); none are implemented.
- Entry context: workspace session guard applies. Direct-URL entry by a paid/free user is unverified.
- Primary action: missing — placeholder has no CTA. Description.md §6 expects "다음 추천 문제" CTA.
- Flow continuity: blocked — outgoing edges `B-01 → X-02` and `X-02 → ...` (none documented inbound back to B-01 explicitly in user-flow.md) cannot be verified.
- AI behavior: missing — description.md §5 "인사이트" is a clear AI surface ("AI가 학습 패턴과 최근 성과를 짧은 문장으로 해석"). The checklist §6.4 requires the user can tell where AI is involved and can dispute/regenerate. Placeholder offers none of this.
- Form/error UX: not applicable.
- Keyboard/focus: placeholder card is keyboard-trivial; not verified.
- Responsive: placeholder is trivially responsive.
- Policy/trust copy: pass — placeholder copy makes no claims.

Top gaps:
- **Implementation/doc gap is total**: description.md describes a 6-region analytics surface; implementation is a one-line placeholder. This is either DEFERRED (intentional placeholder per `phaseHint`) or DOC-GAP (description.md should be marked as future scope) — must be reconciled by a human before this can leave BLOCKED.
- No "성장 리포트만 활성" sidebar state verified.
- AI insights surface (§5) is missing — when implemented, will need explicit "AI" labeling and regenerate/dispute affordance per checklist §6.4.
- Color-only meaning warning in description.md §4 ("색상만으로 의미 전달 금지") cannot be checked against an unimplemented matrix.

Human reviewer should inspect:
- Whether X-02 should be relabeled DEFERRED in the IA verification report (matching the in-code `phaseHint`) or whether the description.md scope should be archived/trimmed.
- Whether the placeholder copy "Phase 4에서 채워집니다" is up to date — current run is Phase 5 of IA verification; the phaseHint may itself be stale.

Evidence still needed: a product decision on X-02 status. Once decided, either drop the page from the active IA set, or implement enough of the 6 regions for a meaningful rendered review.

---

## Summary — needs-human-judgment items

1. **A-03 — `needs-human-judgment`**:
   - Missing "온보딩 진행 단계" (step indicator) — description.md §1 requirement.
   - Raw error message leak risk in `notification.error` save-failure path.
   - Re-entry behavior on existing learning_goal (redirect vs edit) is undecided.
2. **B-01 — `needs-human-judgment`**:
   - KPI label drift (description.md §2 vs `KpiSummary.tsx`).
   - Missing "추천 유형" card (description.md §3 requires 3 card types).
   - Sidebar fidelity vs description.md §1 (10-char labels, exact order, lock state) unverified.
3. **X-02 — `needs-human-judgment`**:
   - Implementation is a placeholder; description.md describes a full analytics page. Product-status decision required (DEFERRED vs DOC-GAP).
   - AI insights surface (§5) will need checklist §6.4 treatment when implemented.

All 3 IA items remain `BLOCKED` for AI UX result until rendered evidence (screenshots + security-navigation rows + hosted-surface results where applicable) is restored. Per checklist §9, BLOCKED is the honest label when "No rendered screenshot or browser evidence exists." Per §11, human confirmation is required for every BLOCKED item.
