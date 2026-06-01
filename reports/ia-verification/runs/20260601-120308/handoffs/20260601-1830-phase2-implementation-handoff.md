# Remediation Phase 2 — Shard Implementation COMPLETE + verified (resume point)

- handoffId: ho-20260601-1830-phase2-implementation
- createdAt: 2026-06-01T09:30:00Z
- createdBy: Claude (Opus 4.8) — root coordinator
- scope: Phase 1 fixtures + Phase 1b/2 shard implementation + coordinator integration. Supersedes ho-20260601-1701-phase0-foundation.
- runStatePath: reports/ia-verification/runs/20260601-120308/remediation-run-state.json
- ledgerPath: docs/ai-workflow/runs/2026/06/01/20260601-1701-ia-remediation-full-ceremony.md
- lastHeartbeatAt: 2026-06-01T09:30:00Z
- activeAgents: none (3 subagent runs completed: 6-shard impl workflow + test-reconciliation + coordinator-integration)

## Verification gate (coordinator-run, no server needed)
- `pnpm typecheck`: PASS (exit 0)
- `pnpm lint`: 0 errors (18 pre-existing warnings in unrelated tasks/ scripts)
- `pnpm test` (vitest): 489 passed | 3 skipped, 0 failed. New tests/setup.ts adds ResizeObserver+matchMedia polyfill.
- NOT yet run (need running app): `pnpm test:e2e` (Playwright coverage), `pnpm test:e2e:ia`, coverage screenshot recapture, audit JSON regeneration.

## Per-IA status after Phase 2 (code/copy/doc-sync)
- public-auth: X-01 FIXED (logged-in CTA branch + 4 documented feature cards), A-01 FIXED (field order, brand/benefit region, honest social-login 준비중, email max-80), X-06 FIXED (link-expiry copy + confirm-form recovery), X-11 FIXED (removed misleading 도움말, de-duped escape row), A-02 + X-12 EVIDENCE-ONLY (code already clean).
- onboarding-dashboard: A-03 FIXED (step indicator), B-01 FIXED (학습 시작 header CTA; populated dashboard now renders with seeded goal+data), X-02 FIXED (honest deferred growth shell + non-color-only weakness matrix + load-error retry).
- practice-writing: C-01 FIXED (empty/error CTAs), C-03 FIXED (mode picker + 시작 CTA + start-failure recovery + fresh param honored), D-01..D-04 FIXED (responsive layout, beforeunload dirty guard, antd Button submit, D-M1 summary props), D-M1 FIXED (제출 요약 + consent checkbox gating + dup-submit guard), D-M3 FIXED (AutosaveWarningModal now wired in LongFormEditor too), C-02 NO-CHANGE, D-M2 DEFERRED-SYNC (lives in feedback shard's components — see follow-ups).
- feedback-reports-recommendations: E-01 FIXED (추천 학습 카드 region), E-02 FIXED (PDF 저장 action + 다시 작성 label), R-01 FIXED (region-5 다음 CTA bar — was a flow dead-end + AI-attribution copy), X-07 FIXED (real bug: 0..1 avgScore now scaled to 0..100), R-02 NO-CHANGE.
- library-settings-billing: F-01 FIXED (heading 내 라이브러리→내 서재, search/filter region, export action region), F-M1 DEFERRED-SYNC (browser-print MVP supersede — deferred-scope.md + ia-catalog.ts updated), G-01 FIXED (removed 즉시 반영 overclaim, added 학습언어/콘텐츠/도움말/미지원 regions, leave guard), X-03/X-04 FIXED (honest deferred-billing shells, no price/provider), X-09 FIXED (channel tabs + reminder HH:mm preview-only + transport-deferred copy + leave guard), X-05 EVIDENCE-ONLY (page already correct; re-auth copy fix applied by coordinator in ProfileForm.tsx).
- admin: H-01 PARTIAL, X-08 PARTIAL, X-10 PARTIAL — code fixes applied (CTAs, X-08 React #418 hydration fix + graceful RPC + honest 운영 카드, X-10 role-change/focus/search-reset, date-cell hydration guards). Admin roles ELEVATED+verified on dev, but admin-ALLOWED render screenshots still need storageState recapture (evidence).

## Coordinator integration applied
- src/lib/auth/error-mapping.ts: X-11 unknown-reason support-channel overpromise removed. (help→login kind change SKIPPED — flow_state_not_found would double-render /login.)
- src/components/profile/ProfileForm.tsx: X-05 re-auth copy tightened. (ProfileForm.test.tsx updated to match.)
- tests/e2e/coverage/ia-catalog.ts: X-11 (no 도움말), F-M1 (browser-print MVP: dropped MODAL pack + formEvidenceRequired), B-01/C-01 CTA regex broadened.
- docs/development/deferred-scope.md: added OOS section (F-M1, G-01 i18n, X-09 transport, D-04/D-M2 support channel).

## Cross-IA / reconciliation
- rec-005 (F-M1 modal-vs-print): RESOLVED via supersede — deferred-scope.md + ia-catalog.ts updated; description.md relabel still pending (tracked rec-006).
- rec-006 (NEW): description.md product-spec decisions proposed by shards (DOC-GAP, owner=product/coordinator). See list below.

## Open follow-ups (NEXT coordinator actions)
1. PRODUCT-SPEC decisions (user/product owner): R-01 — is an antd Table acceptable for documented '점수 그래프' (chart) or build a real chart? D-03 — does q53 need a 평가 기준 카드 like 54? X-08 — accept honest org-admin partial scope (3 KPI + nav to /admin/users + 준비중 운영카드) OR build org/assignment tables (net-new scope, needs approval; fixtures contract forbids creating organizations tables without docs update). Minor: D-02 manual-save vs autosave; D-M3 tri-state recovery indicator. + apply the agreed description.md honest-reality notes (A-01 social-login deferred, X-11 도움말, X-09 preview-only, F-M1 relabel).
2. D-M2 (AI analysis loading) code lives in src/components/feedback/AnalysisLoadingModal.tsx — was NOT in any shard's edit scope this run; needs a small follow-up (overlay-vs-standalone + fixture-timer honesty) — assign to feedback cluster.
3. EVIDENCE PHASE (needs running app — user environment): (a) `pnpm dev` (or prod build) + `pnpm test:ia:storage-state --apply` to rebuild storageState (incl. now-elevated admin sessions); (b) owner-negative seed (2nd learner + cross rows) — coordinator can run via service-role; (c) `pnpm test:e2e:ia` coverage recapture (screenshots 360/768/1280) — prefer prod build to avoid dev-server degradation; (d) regenerate ia-implementation-audit.json (merge) and re-validate.
4. After evidence: final verifier + per-IA completion gate + run closeout + re-enable/confirm profiles protect trigger + close reconciliation items.

## Risk notes
- Admin items (H-01/X-08/X-10) cannot reach PASS until storageState recapture under elevated roles + screenshots.
- Owner-scoped items (E-01/E-02/R-01/F-01/X-05/X-10) need owner-negative seed for RLS evidence.
- public-auth shard edited src/components/landing/Hero.tsx (X-01-owned, outside its declared lock paths) — harmless (disjoint, no other cluster owns landing); recorded.
