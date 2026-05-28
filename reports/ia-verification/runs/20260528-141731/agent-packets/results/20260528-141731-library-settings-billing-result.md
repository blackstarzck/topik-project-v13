# Library/Settings/Billing Shard — IA Phase 5 AI-First UX Review

## Result Packet

- Agent: Claude Opus 4.7 (1M context) — child subagent
- Role: Library/Settings/Billing shard AI-First UX reviewer (IA Phase 5)
- Objective completed: Reviewed 7 IA items (F-01, F-M1, G-01, X-03, X-04, X-05, X-09) against `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`. Produced one AI UX review card per item, recorded result labels + confidence + needs-human-judgment, cited file paths.
- Audience verified: yes — all 7 IA are `audience: user`; no admin/public boundary crossed. Source code inspected (read-only). No `src/**` or `docs/IA/**` files modified.
- Files inspected:
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json`
  - `reports/ia-verification/runs/20260528-141731/ia-manifest.json`
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json`
  - `reports/ia-verification/runs/20260528-141731/source-map-results.json`
  - `reports/ia-verification/runs/20260528-141731/browser-results.json` (rows for F-01, F-M1, G-01, X-03, X-04, X-05, X-09)
  - `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/development/deferred-scope.md`
  - `docs/IA/18-F-01-my-library/description.md`
  - `docs/IA/19-F-M1-pdf-export-modal/description.md`
  - `docs/IA/20-G-01-language-settings/description.md`
  - `docs/IA/25-X-03-paywall/description.md`
  - `docs/IA/26-X-04-subscription-management/description.md`
  - `docs/IA/27-X-05-profile-editing/description.md`
  - `docs/IA/31-X-09-notification-settings/description.md`
  - `src/app/(workspace)/library/page.tsx`
  - `src/app/(workspace)/paywall/page.tsx`
  - `src/app/(workspace)/subscription/page.tsx`
  - `src/app/(workspace)/profile/page.tsx`
  - `src/app/(workspace)/settings/language/page.tsx`
  - `src/app/(workspace)/settings/notifications/page.tsx`
  - `src/components/library/ExportPdfButton.tsx`
  - `src/components/settings/LanguageForm.tsx`
  - `src/components/settings/NotificationPrefsForm.tsx`
  - `src/components/profile/ProfileForm.tsx`
  - `src/components/shared/PlaceholderPage.tsx`
- Files changed:
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-library-settings-billing-result.md` (this file — new)
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-library-settings-billing-cards.json` (new — 7 cards array)
- Decisions made:
  - Marked F-M1 as **FAIL** because the implementation diverges substantively from the description.md modal spec (window.print() trigger button vs full modal with filename/options/preview/CTA). This is a description-vs-implementation gap, not just missing screenshot evidence.
  - Marked G-01 as **PARTIAL** with copy-honesty risk: the saved text says "변경사항이 즉시 반영됩니다" but the source code comment confirms i18n catalogs are deferred. The DB write happens but UI doesn't actually switch language — implied promise not delivered.
  - Marked X-03, X-04, X-09 as **DEFERRED** because the implementation is a faithful shell+honest-disclosure pattern. X-03/X-04 use `PlaceholderPage` with explicit `phaseHint` referencing `deferred-scope.md`. X-09 ships full toggles+persistence plus an explicit `Alert` "알림 전송 인프라는 곧 도입됩니다. 지금은 환경설정만 저장됩니다." — copy does not imply live email/push delivery.
  - Marked F-01 and X-05 as **PARTIAL** — implementations exist with the right scope shape, but multiple description regions are unimplemented or differ, and no rendered evidence exists. X-05 OWNER-CHECK is structurally satisfied because the route has no `:id` param (only `/profile`) and the server component uses `requireUser()` + `user.id`-scoped queries.
- Tests/checks run:
  - Cross-referenced each IA against doc-receipts.json (all 7 are status `filled`).
  - Cross-referenced against source-map-results.json (all 7 are PASS).
  - Cross-referenced against browser-results.json (all 7 are PARTIAL with navigation timeout to 127.0.0.1:3000 — Phase 2 lane could not reach dev server).
  - Read every description.md region map and matched against actual source.
  - Inspected copy strings in source code for billing-deferred / transport-deferred honesty.
- Results: see `20260528-141731-library-settings-billing-cards.json` for per-IA cards. Aggregate: 0 PASS, 2 PARTIAL (F-01, G-01, X-05), 1 FAIL (F-M1), 0 BLOCKED, 0 DOC-GAP, 3 DEFERRED (X-03, X-04, X-09). *(Note: X-05 also PARTIAL — count = 3 PARTIAL, 1 FAIL, 3 DEFERRED.)*
- Blockers:
  - No rendered browser evidence for any of the 7 IA (Phase 2 dev server timeout — `browser-results.json` lists this as the navigation failure across all 34 IA, including this shard).
  - `hosted-surface-results.json` is 0 rows BLOCKED for F-M1 — trigger from `/library` and the 3 feedback/report host routes was not verified.
  - `security-navigation-results.json` is 0 rows BLOCKED for X-05 OWNER-CHECK and F-01 owner-scoped data. (X-05 is structurally safe because no `:id` URL param exists.)
- Assumptions:
  - Description-vs-implementation gaps in F-M1 are treated as implementation deficiencies rather than DOC-GAP because the description is clear and concrete (filename 1-60자, 미리보기, 옵션, 다운로드 CTA) and the implementation is unambiguously a print-dialog trigger.
  - G-01 i18n deferral is treated as code-confirmed (LanguageForm comment lines 26-32 explicitly state i18n catalogs are OOS for Phase 6) — not a documentation conflict.
  - For X-03/X-04, source inspection of 15-line `PlaceholderPage` shells is sufficient evidence to confirm shell-only state without a screenshot. Recommend human reviewer still validate visually.
- Scope concerns:
  - F-M1 FAIL is a substantive finding; the main session should decide whether to (a) update `docs/IA/19-F-M1-pdf-export-modal/description.md` to match the print-dialog reality (DOC-GAP retroactive), or (b) escalate to engineering as an implementation gap. This conflict warrants escalation per dispatch plan's `escalationTriggers`.
  - G-01 copy "변경사항이 즉시 반영됩니다" should be revised to disclose the deferred i18n catalog — same TRANSPORT-DEFERRED pattern as X-09.
  - All 7 IA need rendered screenshot evidence before any can move to PASS. The dev server must be running and reachable for Phase 2/3/4 evidence to be valid.
- Recommended follow-up:
  - **P0** — Fix G-01 copy or implement i18n catalogs (current copy is a false-promise).
  - **P0** — Resolve F-M1 doc-vs-impl conflict (either revise description.md or implement the modal).
  - **P1** — Re-run Phase 2 browser lane with dev server up; capture 360/768/1280 screenshots for F-01, G-01, X-05, X-09 (X-03/X-04 shells are low-priority).
  - **P1** — Re-run Phase 3 hosted-surface lane for F-M1 across all 4 host routes once the modal exists or scope is clarified.
  - **P2** — Record X-05 OWNER-CHECK structural protection in security-navigation evidence (no `:id` param → no direct-URL PII leak vector).
  - **P2** — Add 변경값 없으면 비활성 (description ⑤/⑥) to ProfileForm 저장 and LanguageForm 저장 buttons for polish.
- Context ledger updates needed:
  - Run ledger should record: deferred-billing copy honesty PASSES (X-03/X-04/X-09); G-01 copy fails honesty check; F-M1 implementation diverges from description.
  - The "보고서 정직성" memory note applies — this packet does not soften the F-M1 FAIL or G-01 copy issue.

---

## AI UX Review Cards

The 7 cards below correspond to the JSON entries in `20260528-141731-library-settings-billing-cards.json`. JSON is the authoritative machine-readable form; this section is for human reviewers.

### F-01 My library — PARTIAL · confidence medium · needs-human-judgment

- Route: `/library`
- Audience: user
- IA source: `docs/IA/18-F-01-my-library/description.md`
- Implementation: `src/app/(workspace)/library/page.tsx`, `src/components/library/LibraryTabs.tsx`
- Required evidence: 360/768/1280 screenshots — **all missing** (browser timeout)

Findings:
- Page job: clear from heading, but full region map (검색/필터 #1, 우측 통계 #4, 페이지 이동 #5) cannot be verified without screenshot.
- Implementation has LibraryTabs but description's 5 regions (search/filter, export/generate, list, right-side stats, pagination) cannot be confirmed visually.
- Hosts F-M1 PDF export modal — see F-M1 card.

Top gaps:
- No browser/hosted-surface evidence.
- Description regions #1, #4, #5 not visibly present in current source.

Human reviewer should inspect:
- Whether the LibraryTabs UI actually exposes search, filter, stats, pagination per description.
- Empty library state copy.

---

### F-M1 PDF export modal — **FAIL** · confidence medium · needs-human-judgment

- Route (hosted): `/library`, `/writing/feedback/short/:id`, `/writing/feedback/long/:id`, `/writing/reports/:id/compare`
- Audience: user
- IA source: `docs/IA/19-F-M1-pdf-export-modal/description.md`
- Implementation: `src/components/library/ExportPdfButton.tsx`

Findings:
- description.md mandates a real modal with filename input (1-60자), options, preview pane, and "내보내기 → 다운로드" CTA.
- Implementation is a single antd `Button` that calls `triggerPdfExport()` → `window.print()`. **There is no modal.**
- Success toast `"PDF 출력 대화상자가 열렸습니다."` partially discloses this but does not match the description's spec.
- Failure recovery (description ④ 예외 "재시도와 문의 링크") is a `message.error` toast only.

Top gaps:
- Implementation does not match description.md.
- No modal focus trap to verify (because no modal).
- Hosted-surface evidence at 4 host routes — 0 rows BLOCKED.

Human reviewer should decide:
- Is the print-dialog approach intentional (then update description.md), or is the full modal still planned (then this is an implementation gap)?

---

### G-01 Language settings — PARTIAL · confidence medium · needs-human-judgment

- Route: `/settings/language`
- Audience: user
- IA source: `docs/IA/20-G-01-language-settings/description.md`
- Implementation: `src/components/settings/LanguageForm.tsx`, `src/app/(workspace)/settings/language/page.tsx`

Findings:
- 3 locales supported (ko/en/vi). Description allows up to 6 — within budget.
- **Copy honesty risk:** UI shows "변경사항이 즉시 반영됩니다." but `LanguageForm.tsx` lines 26-32 confirm "i18n message catalogs are OOS-7 (Phase 6 light spec); Phase 6 only persists the preference." DB write happens, UI does not switch language → implied promise not delivered.
- Description regions ③ 학습 언어, ④ 콘텐츠 설정, ⑤ 도움말 not implemented (light-spec scope reduction not surfaced to user).
- 저장 button is always enabled (description ⑥ 변경값 없으면 비활성 not implemented).

Top gaps:
- Copy overpromises live UI switch.
- Unsaved-changes confirmation missing (description ① 예외).

Human reviewer should decide:
- Whether to revise copy ("환경설정만 저장됩니다. UI 언어 적용은 곧 도입됩니다.") similar to X-09's honest disclosure, or implement i18n catalogs now.

---

### X-03 Paywall — **DEFERRED** · confidence high · needs-human-judgment

- Route: `/paywall`
- Audience: user
- IA source: `docs/IA/25-X-03-paywall/description.md`
- Implementation: `src/app/(workspace)/paywall/page.tsx` (15 lines — `PlaceholderPage`)

Findings:
- PlaceholderPage renders Tag `[X-03]` + Title "구독 가입" + secondary "billing scope는 deferred-scope.md 기준으로 보류 상태입니다."
- No 결제 주기 카드, no CTA, no 혜택 패널, no pricing strings. Matches `docs/development/deferred-scope.md §Billing` policy exactly.
- Copy is honest: explicitly references the deferred-scope doc.

Verdict: DEFERRED is the correct label. The shell is doing the right thing and disclosing it.

Human reviewer should confirm: rendered screenshot matches the source-inspected shell, and that this is the intended Phase 6 behavior.

---

### X-04 Subscription management — **DEFERRED** · confidence high · needs-human-judgment

- Route: `/subscription`
- Audience: user
- IA source: `docs/IA/26-X-04-subscription-management/description.md`
- Implementation: `src/app/(workspace)/subscription/page.tsx` (15 lines — `PlaceholderPage`)

Findings:
- Same template as X-03. No "다음 결제일", no "cancel subscription" CTA, no 결제 이력 fake data.
- Copy "billing scope는 deferred-scope.md 기준으로 보류 상태입니다." is direct and honest.

Verdict: DEFERRED is correct.

Human reviewer should confirm screenshot matches and that no Phase 6 subscription-management features were expected.

---

### X-05 Profile editing — PARTIAL · confidence medium · needs-human-judgment

- Route: `/profile`
- Audience: user
- IA source: `docs/IA/27-X-05-profile-editing/description.md`
- Implementation: `src/app/(workspace)/profile/page.tsx`, `src/components/profile/ProfileForm.tsx`, `ExamInfoCard.tsx`, `StatusHelpCard.tsx`

Findings:
- OWNER-CHECK structurally satisfied — no `:id` URL param; route is `/profile` only; server component uses `requireUser()` + `user.id`-scoped queries.
- ProfileForm has display_name (maxLength 80) + nickname (maxLength 40) + bio (maxLength 160). Description ② says "이름 2-30자, 닉네임 2-20자" — implementation looser but not a security issue.
- No email field, no avatar upload (description ② ③). Copy "아바타 업로드는 다음 업데이트에서 지원됩니다." is HONEST deferred disclosure.
- 저장 button always enabled (description ⑤ 변경값 없으면 비활성 not implemented).
- 이탈 확인 (description ①) not implemented.

Top gaps:
- No rendered evidence.
- Several description regions unimplemented (light-spec scope reduction).

Human reviewer should inspect:
- StatusHelpCard copy (description ④ 공개 범위/데이터 활용).
- Whether the looser maxLength values (80/40) are intentional vs description's tighter caps.

---

### X-09 Notification settings — **DEFERRED** · confidence high · needs-human-judgment

- Route: `/settings/notifications`
- Audience: user
- IA source: `docs/IA/31-X-09-notification-settings/description.md`
- Implementation: `src/components/settings/NotificationPrefsForm.tsx`, `src/app/(workspace)/settings/notifications/page.tsx`

Findings:
- 3 antd Switch toggles (weekly_summary, feedback_ready, study_reminder) + Save button.
- **Exemplary honest copy**: explicit `Alert` "알림 전송 인프라는 곧 도입됩니다. 지금은 환경설정만 저장됩니다." (notification transport infra coming soon; for now only preferences are saved).
- No fake 알림 채널 탭 (Email/Zalo — description ②), no fake 발송 이력 (description ④). Implementation correctly omits transport-bound features.

Verdict: DEFERRED is correct and this is a reference example for how TRANSPORT-DEFERRED copy should sound. G-01 should adopt the same pattern.

Human reviewer should confirm: screenshot matches, and that Switch + Alert combination renders accessibly on mobile.

---

## Needs-Human-Judgment Summary

All 7 IA in this shard require human confirmation because:
- Confidence is medium for 4 items (F-01, F-M1, G-01, X-05) — copy-tone and visual-hierarchy questions cannot be answered without rendered evidence.
- Confidence is high for 3 items (X-03, X-04, X-09) — but result labels are DEFERRED, which the checklist §11 requires human confirmation for.
- Browser/hosted-surface/security-navigation lanes are all degraded for this shard (timeouts / 0 rows) — final PASS cannot be claimed from code inspection per §9 of the checklist.

Top 3 risks for main session attention:
1. **F-M1 implementation diverges from description.md** — escalation trigger per dispatch plan. Either revise description (DOC-GAP retroactive) or implement the full modal.
2. **G-01 copy "변경사항이 즉시 반영됩니다" overpromises** — i18n catalogs are explicitly deferred in source comments. Same TRANSPORT-DEFERRED pattern as X-09 should be applied to the copy.
3. **No rendered evidence for any of the 7 IA** — Phase 2/3/4 must be re-run with dev server reachable before any item can move beyond PARTIAL/FAIL/DEFERRED.

Honesty notes (per CLAUDE.md feedback-report-honesty-cross-audit):
- This packet does not soften the F-M1 FAIL into a PARTIAL.
- This packet does not soften the G-01 copy issue into a "minor polish" note.
- DEFERRED labels for X-03/X-04/X-09 are NOT a free pass — human reviewer must still confirm rendered screenshot matches the source-inspected shell, since shells could be modified between snapshot and review.
- X-05 OWNER-CHECK was confirmed structurally (no `:id` param), not via test execution. Recorded as a structural finding rather than a verified test.
