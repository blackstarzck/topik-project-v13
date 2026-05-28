# Feedback/Reports/Recommendations Shard — Result Packet

## Result Packet

- Agent: Claude Opus 4.7 child agent (feedback-reports-recommendations shard)
- Role: IA Phase 5 AI-first UX reviewer
- Objective completed: yes — 5 IA review cards produced (E-01, E-02, R-01, R-02, X-07) plus this result packet
- Audience verified: yes (all 5 IA are `user` audience; reviewer touched only `reports/ia-verification/runs/20260528-141731/agent-packets/results/`; no `src/**`, no `docs/IA/**`, no `reports/ia-verification/latest` write)
- Files inspected:
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json` (shard scope, IA codes, escalation triggers)
  - `reports/ia-verification/runs/20260528-141731/ia-manifest.json`
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json`
  - `reports/ia-verification/runs/20260528-141731/source-map-results.json`
  - `reports/ia-verification/runs/20260528-141731/static-results.json`
  - `reports/ia-verification/runs/20260528-141731/browser-results.json`
  - `reports/ia-verification/runs/20260528-141731/hosted-surface-results.json` (status=BLOCKED, rows=[])
  - `reports/ia-verification/runs/20260528-141731/security-navigation-results.json` (status=BLOCKED, rows=[])
  - `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/IA/14-E-01-short-answer-feedback/description.md`
  - `docs/IA/15-E-02-long-form-feedback/description.md`
  - `docs/IA/16-R-01-comparison-report/description.md`
  - `docs/IA/17-R-02-next-problem-recommendation/description.md`
  - `docs/IA/29-X-07-weakness-based-recommendations/description.md`
  - `docs/sitemap.md` (lines 33-187 for the 5 routes)
  - `docs/flow/user-flow.md` (lines 53-138 for E-01/E-02/R-01/R-02/X-07 transitions)
  - `src/app/(workspace)/writing/feedback/short/[id]/page.tsx`
  - `src/app/(workspace)/writing/feedback/long/[id]/page.tsx`
  - `src/app/(workspace)/writing/reports/[id]/compare/page.tsx`
  - `src/app/(workspace)/practice/next/page.tsx`
  - `src/app/(workspace)/practice/weakness/page.tsx`
  - `src/components/feedback/FeedbackPageContent.tsx`
  - `src/components/feedback/FeedbackSummary.tsx`
  - `src/components/feedback/DimensionCardGrid.tsx`
  - `src/components/feedback/NextActionBar.tsx`
  - `src/components/feedback/FeedbackPendingPanel.tsx`
  - `src/components/feedback/SentenceFeedbackList.tsx`
  - `src/components/reports/ComparisonReportView.tsx`
  - `src/components/reports/MetricsTable.tsx`
  - `src/components/practice/NextProblemView.tsx`
  - `src/components/practice/AlternativeCardsGrid.tsx`
  - `src/components/practice/WeaknessView.tsx`
  - `src/components/practice/DiagnosticCard.tsx`
  - `tests/e2e/coverage/session-navigation.spec.ts` (SN-9 placeholder verified)
- Files changed:
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-feedback-reports-recommendations-result.md` (this file)
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-feedback-reports-recommendations-cards.json`
- Decisions made:
  - All 5 IA marked `PARTIAL` (none `PASS`): browser-results timed out and no rendered screenshots exist, so the AI-first-UX-checklist §9 "AI must not pass when…" rule applies to every card.
  - All 5 IA marked `needs-human-judgment` for human-confirmation: each has at least one of (missing rendered evidence, low/medium confidence, AI behavior gap, paywall gap, or RLS gap).
  - E-01/E-02/R-01 RLS lanes recorded as BLOCKED with `needs-human-judgment` per shard task: SN-9 in `tests/e2e/coverage/session-navigation.spec.ts` (lines 252-258) records `blockingReasons` and storageState-missing annotation but **does not assert** anything against a real other-user row. This matches the project-known SN-9 placeholder issue. `security-navigation-results.json.status = BLOCKED, rows = []`.
  - R-02 paywall-entry pack flagged FAIL on policy/trust lane: `doc-receipts.json` extractedRequirements explicitly require `유료 잠금은 X-03 paywall로 진입`, `user-flow.md` L137 shows `R02 -. 유료 잠금 진입 .-> X03`, but `src/components/practice/NextProblemView.tsx` and `AlternativeCardsGrid.tsx` contain no paywall/유료/업그레이드 strings (grep verified). With DEFERRED-BILLING policy, copy must either be added (and remain billing-deferred-safe) or removed from active scope.
  - X-07 paywall-entry + AI HAX framing flagged FAIL: same paywall absence; additionally `DiagnosticCard.tsx` uses confident probabilistic copy ("점수가 빠르게 오를 가능성이 있습니다") with no uncertainty band or sample-size signal, and description ④ insights panel (reason / example / strategy) is not implemented.
  - R-01 flagged with the most severe UX-flow gap: `ComparisonReportView.tsx` has **no outbound action bar** — description ⑤ and `user-flow.md` L110-111 (R-01 → X-07, R-01 → R-02) cannot be navigated from the page. Also: chart visualization (description ②) is not implemented — `MetricsTable` is a permanent fallback.
  - E-02 flagged for missing PDF/export CTA: description ④ requires four CTAs including 'PDF 저장' (F-M1 entry); grep across `src/components/feedback/*` finds zero PDF/export references. `NextActionBar` only emits 3 buttons (다시 풀기 / 다음 문제 / 비교 리포트).
  - Both E-01 and E-02 use `nextHref="/practice/recommendations"` for the 다음 문제 button instead of `/practice/next` (R-02) per `user-flow.md` L100, L107 — recorded as a flow-continuity partial.
- Tests/checks run:
  - Cross-referenced 5 IA description.md files against current source.
  - Parsed `browser-results.json` rows for the 5 IA — all PARTIAL (uniform timeout to `bbbbbbbb-2222-...` seeded id; no UX states captured at 360/768/1280).
  - Verified `security-navigation-results.json` and `hosted-surface-results.json` BLOCKED (rows=[]).
  - Inspected `session-navigation.spec.ts` SN-9 — confirmed placeholder (no `expect()` against actual cross-owner :id; only records `blockingReasons` in audit-meta).
  - Grepped `src/components/practice/**` for paywall|유료|업그레이드|premium|locked — zero matches.
  - Grepped `src/components/feedback/**` for PDF|export — zero matches.
- Results: 5 cards delivered. Distribution: 5 × PARTIAL · 0 × PASS · 0 × FAIL · 0 × BLOCKED · 0 × DOC-GAP · 0 × DEFERRED. Human-confirmation: 5 × `needs-human-judgment`. The cards are in `…-cards.json`; per-card detail follows below.
- Blockers:
  - browser-results timeout means no rendered screenshots at any viewport for any of the 5 IA — every PARTIAL would need new browser evidence to upgrade.
  - hosted-surface and security-navigation lanes are blocked at the build script (per task brief: Playwright PASSed but build scripts could not parse attachments). Without those rows, RLS cannot be confirmed.
  - SN-9 needs an actual `expect()` against a seeded cross-owner row. Until that is implemented, RLS lane for E-01/E-02/R-01 stays BLOCKED.
- Assumptions:
  - DEFERRED-BILLING policy is still active (per CLAUDE.md project state and sitemap.md L52 "Payment provider integration is deferred"); accordingly, paywall-entry pack on R-02/X-07 needs copy that **does not** imply real upgrade flow.
  - `tests/e2e/coverage/session-navigation.spec.ts` is the canonical RLS coverage source; if a separate `auth-route-handlers.spec.ts` or future spec covers cross-owner RLS, this packet's RLS lane finding should be reconciled by the coordinator.
- Scope concerns:
  - F-M1 PDF export modal sits in the library-settings-billing shard but is the binding CTA for E-02 description ④ and R-01 / E-01 'export' packs. If F-M1 itself is BLOCKED, the upstream feedback-page CTA gap is moot — coordinator should reconcile.
  - R-02 / X-07 paywall gap intersects with X-03 paywall (library-settings-billing shard) — finding should be considered shard-cross-cutting.
- Recommended follow-up:
  - P0: Implement SN-9 with real `expect()` against a seeded cross-owner row (requires SUPABASE_SERVICE_ROLE_KEY rotation per existing Phase 2 P0 note) so E-01 / E-02 / R-01 RLS can graduate from BLOCKED.
  - P0: Add outbound action bar to `ComparisonReportView` (R-01) covering `R01 → X07 약점 인사이트`, `R01 → R02 다음 문제`, plus retry — currently users are stuck on R-01.
  - P0: Add PDF export CTA to long-form feedback (E-02) — wire F-M1 trigger from `NextActionBar`.
  - P1: Fix `nextHref` on E-01/E-02 NextActionBar from `/practice/recommendations` to `/practice/next` per user-flow.md L100/L107.
  - P1: Decide R-02 + X-07 paywall-entry contract under DEFERRED-BILLING — either render a deferred-billing-safe locked card with copy, or document the gap as out-of-scope in active docs.
  - P1: Add HAX-style "왜 이 추천인지" rationale tied to user's recent answers in X-07 DiagnosticCard; soften confident copy "점수가 빠르게 오를 가능성이 있습니다" to reflect sample-size uncertainty.
  - P1: Add description ④ insights panel (reason / example / strategy) to X-07 WeaknessView.
  - P2: Add per-sentence retry affordance in E-02 SentenceFeedbackList (description ② 예외 '재분석').
  - P2: Capture rendered evidence at 360 / 768 / 1280 for all 5 IA once browser harness stabilizes — required before any can graduate to PASS.
- Context ledger updates needed:
  - Main session should append this result packet to the latest IA-verification run ledger and note the three top RLS / flow / paywall risks for Phase 6 routing.

## AI UX Review Cards (Phase 5)

### E-01 Short-answer feedback

- Route or host route: `/writing/feedback/short/:id`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/14-E-01-short-answer-feedback/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/feedback/short/[id]/page.tsx`
  - `src/components/feedback/FeedbackPageContent.tsx`
  - `src/components/feedback/FeedbackSummary.tsx`
  - `src/components/feedback/DimensionCardGrid.tsx`
  - `src/components/feedback/NextActionBar.tsx`
  - `src/components/feedback/FeedbackPendingPanel.tsx`
- Required evidence:
  - mobile 360 screenshot: missing (browser timeout)
  - tablet 768 screenshot: missing (browser timeout)
  - desktop 1280 screenshot: missing (`screenshots\coverage-E-01-1280.png` referenced but PARTIAL — page.goto timeout 15000ms)
  - direct URL: BLOCKED (timeout to seeded id; navigation precondition unclear)
  - browser back: missing
  - keyboard/focus: missing
  - error/empty/loading state: pending state via `FeedbackPendingPanel` exists in code but unrendered; loading/empty/error captures absent
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear (heading + score + summary lay out description ① intent)
- Entry context: clear (server `requireUser` + `getSubmission` + question-no mismatch redirects)
- Primary action: competing (3 buttons in NextActionBar; only 다시 풀기 is `type=primary`)
- Flow continuity: partial (`nextHref` points to `/practice/recommendations`, not `/practice/next` per user-flow.md L100; F-01 결과 저장 CTA missing)
- AI behavior: partial (no AI attribution label, no regenerate/dispute, fallback copy '총평이 준비되는 중입니다' is generic)
- Form/error UX: not applicable
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: pass

Top gaps:
- 결과 저장(F-01) CTA absent from `NextActionBar`.
- `nextHref` mismatch with user-flow.md.
- No AI uncertainty / re-analyze affordance per Microsoft HAX.

Human reviewer should inspect:
- Whether the score+summary card hierarchy reads correctly on mobile (no rendered screenshot to verify).
- Whether the three CTAs in `NextActionBar` feel like one primary + secondaries or three competing equals.
- RLS lane: **BLOCKED until SN-9 actually asserts cross-owner 404**.

### E-02 Long-form feedback

- Route or host route: `/writing/feedback/long/:id`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/15-E-02-long-form-feedback/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/feedback/long/[id]/page.tsx`
  - `src/components/feedback/FeedbackPageContent.tsx` (withSentences=true)
  - `src/components/feedback/SentenceFeedbackList.tsx`
  - `src/components/feedback/NextActionBar.tsx`
- Required evidence:
  - mobile 360 / tablet 768 / desktop 1280 screenshot: missing (browser timeout)
  - direct URL / browser back / keyboard / error-empty-loading: missing
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear
- Entry context: clear
- Primary action: fail — description ④ requires 4 CTAs (다시 작성 / PDF 저장 / 비교 리포트 / 다음 문제 추천); **PDF 저장 CTA missing** (grep `src/components/feedback/**` for PDF|export → zero matches; `NextActionBar` only has 3 buttons)
- Flow continuity: partial — E-02 → F-M1 PDF path broken; same `nextHref` mismatch as E-01
- AI behavior: partial — sentence-level corrected_text shown without AI label or "why corrected" reason
- Form/error UX: not applicable
- Keyboard/focus: missing
- Responsive: missing
- Policy/trust copy: pass

Top gaps:
- Missing PDF/export CTA — fails description ④.
- No per-sentence retry for description ② 예외 ('첨삭 생성 실패 문장은 원문만 표시 + 재분석').

Human reviewer should inspect:
- Whether the corrected vs original Text contrast (delete + secondary tone) is readable per WCAG 1.4.3 (no rendered screenshot to verify).
- F-M1 integration plan — should `NextActionBar` mount a PDF export trigger, or should E-02 host F-M1 separately?
- RLS lane: **BLOCKED until SN-9 implemented**.

### R-01 Comparison report

- Route or host route: `/writing/reports/:id/compare`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/16-R-01-comparison-report/description.md`
- Implementation anchors:
  - `src/app/(workspace)/writing/reports/[id]/compare/page.tsx`
  - `src/components/reports/ComparisonReportView.tsx`
  - `src/components/reports/MetricsTable.tsx`
  - `src/components/reports/SubmissionDiffPanel.tsx`
- Required evidence:
  - mobile / tablet / desktop screenshot: missing
  - direct URL / browser back / keyboard / error-empty-loading: missing
- AI UX result: `PARTIAL`
- Confidence: `low`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear (Title '비교 리포트' + narrative + metrics + diff)
- Entry context: partial (only entry is via E-01/E-02 `useCreateComparisonReport` mutation; direct URL with bad id → notFound, acceptable)
- Primary action: **fail — no action bar at all**. `ComparisonReportView` renders three Cards (narrative, MetricsTable, SubmissionDiffPanel) and stops. description ⑤ requires `다시 풀기 / 약점 추천 / 다음 문제` CTAs; user-flow.md L110-111 specifies `R01 → X07` and `R01 → R02` — neither is reachable.
- Flow continuity: **fail** — user can only leave via browser back.
- AI behavior: partial — `narrative` rendered as plain `Paragraph` with `—` fallback; no length cap (description ④ '3줄 이하'); no retry on '분석 생성 실패' per description ④ 예외
- Form/error UX: not applicable
- Keyboard/focus: missing
- Responsive: missing — description ② requires chart with '범례 5개 이하, 모바일은 가로 스크롤 또는 요약 차트'; **`MetricsTable` is a flat table only — chart never rendered, so '차트 로드 실패 시 표 형태 대체' (② 예외) is the permanent state, not a fallback**.
- Policy/trust copy: pass

Top gaps:
- No outbound CTAs / action bar (severe stuck-state).
- No chart implementation (description ② core requirement is absent, not just '실패 fallback').
- No narrative length cap.

Human reviewer should inspect:
- Whether '비교 리포트' page is intentionally read-only-dead-end pending Phase X work.
- Whether `MetricsTable` rendering of `dimension_deltas` keys (e.g. "grammar 차원 변화") is human-readable for Korean learners.
- RLS lane: **BLOCKED (SN-9 placeholder)**.

### R-02 Next problem recommendation

- Route or host route: `/practice/next`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/17-R-02-next-problem-recommendation/description.md`
- Implementation anchors:
  - `src/app/(workspace)/practice/next/page.tsx`
  - `src/components/practice/NextProblemView.tsx`
  - `src/components/practice/SummaryCardRow.tsx`
  - `src/components/practice/AlternativeCardsGrid.tsx`
- Required evidence:
  - mobile / tablet / desktop screenshot: missing (browser timeout to `/practice/next`)
  - empty state: code-only evidence (`primaryTier===4 || !primary` → `Empty` with CTA)
  - paywall-locked state: **does not exist in code**
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear
- Entry context: clear
- Primary action: pass (single '시작하기' on primary card)
- Flow continuity: pass (router.push to `/practice/problems/:id`)
- AI behavior: partial (static `TIER_META.description` strings give generic 'why' but not tied to user-specific signals; `primary.reason` conditionally surfaced — partial HAX compliance)
- Form/error UX: not applicable
- Keyboard/focus: missing evidence
- Responsive: missing evidence
- Policy/trust copy: **fail** — PAYWALL-ENTRY pack absent. `doc-receipts.json` R-02 extractedRequirements explicitly require `권한 잠금 카드는 비활성 + 업그레이드 안내; 유료 잠금은 X-03 paywall로 진입`. user-flow.md L137 documents R-02 → X-03. Code grep: zero paywall/유료/업그레이드 in `NextProblemView` or `AlternativeCardsGrid`. With DEFERRED-BILLING active, paywall copy must be present **and** safe.

Top gaps:
- PAYWALL-ENTRY pack not implemented (deferred-billing concern: silent gap, not safe-copy gap).
- AI rationale not personalized; tier strings only.
- No double-click guard on '시작하기'.

Human reviewer should inspect:
- Whether tier 1/2/3 descriptions are personalized enough for Korean learners ('선생님이 추천한 문제예요' phrasing — soft but generic).
- Confirm DEFERRED-BILLING decision: should locked card render and link to `/paywall`, or is paywall-entry deferred to a later phase and active docs need an explicit out-of-scope note?

### X-07 Weakness-based recommendations

- Route or host route: `/practice/weakness`
- Route type: `page`
- Audience: `user`
- IA source: `docs/IA/29-X-07-weakness-based-recommendations/description.md`
- Implementation anchors:
  - `src/app/(workspace)/practice/weakness/page.tsx`
  - `src/components/practice/WeaknessView.tsx`
  - `src/components/practice/DiagnosticCard.tsx`
  - `src/components/practice/DimensionTabs.tsx`
- Required evidence:
  - mobile / tablet / desktop screenshot: missing (browser timeout)
  - empty state: code-only (`weakDimensions.length === 0` → '글쓰기를 5건 이상 제출하면…')
  - paywall-locked state: **does not exist in code**
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: clear
- Entry context: clear
- Primary action: partial (description ⑥ '대표 CTA 1개' — populated view has multiple equal-weight recommendation Cards, no single primary CTA. Empty state has one '문제 풀기' Button — partial compliance)
- Flow continuity: pass (X-07 → C-02 via `handleRecommendationClick`)
- AI behavior: **fail — HAX violations**:
  1. `DiagnosticCard` says "점수가 빠르게 오를 가능성이 있습니다" — confident probabilistic claim without uncertainty band or sample-size signal (HAX guideline 11: 'make clear how confident the system is').
  2. description ④ requires an insights panel with '약점 발생 이유, 예시 오류, 개선 전략' — **not implemented** in `WeaknessView` or `DiagnosticCard`.
  3. description ⑤ requires '추천 사유 1줄' per card — recommendation Cards render only question_no + title; **no reason field**.
- Form/error UX: not applicable
- Keyboard/focus: missing
- Responsive: partial (Col xs/md grid is single-column stack)
- Policy/trust copy: **fail** — same paywall absence as R-02 (description ① 예외, ⑤ 예외, user-flow.md L138 'X07 -. 유료 잠금 진입 .-> X03'); zero paywall code in component tree.

Top gaps:
- Missing insights panel (description ④).
- Missing '추천 사유' on recommendation cards (description ⑤).
- AI confidence framing too strong (HAX 11).
- PAYWALL-ENTRY absent.

Human reviewer should inspect:
- Whether the DiagnosticCard probability copy needs softening for learner trust ("점수가 빠르게 오를 가능성이 있습니다" → suggest "이 영역을 더 연습하면 점수 개선에 도움이 될 수 있어요" or similar).
- Whether DEFERRED-BILLING decision is consistent between R-02 and X-07 (both have the same gap; coordinator should reconcile).
- Whether description ④ insights are intentionally deferred to a later phase or actually missing from current implementation.

## Needs-Human-Judgment Summary

| IA | Lane | Reason |
| --- | --- | --- |
| E-01 | Visual hierarchy + AI tone + RLS | No rendered screenshots; HAX gap; SN-9 placeholder |
| E-02 | Missing PDF CTA + RLS | Description ④ violation; SN-9 placeholder |
| R-01 | Stuck-state + chart + RLS | No outbound CTAs; no chart implementation; SN-9 placeholder |
| R-02 | Paywall under DEFERRED-BILLING + AI rationale | PAYWALL-ENTRY pack silently dropped; tier strings generic |
| X-07 | Paywall + HAX confidence + missing insights | Same paywall gap; confident probabilistic copy; description ④ panel absent |

All five rows wait on (a) rendered browser evidence at 360/768/1280, (b) SN-9 RLS implementation (for the three OWNER-CHECK IA), and (c) human review of the paywall/HAX/flow judgment questions surfaced above.
