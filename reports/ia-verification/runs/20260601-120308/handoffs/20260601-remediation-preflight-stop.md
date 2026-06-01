# Remediation Preflight — STOPPED before dispatch

- createdBy: Claude (Opus 4.8), coordinator
- scope: ia-remediation-multi-agent Phase 0 preflight only
- auditRunDirectory: reports/ia-verification/runs/20260601-120308
- status: **STOPPED at user request ("일단 중지"). No IA execution agents dispatched. No product/source code changed during remediation. No run-control artifacts created (run-state/lock/cross-ia/reconciliation intentionally NOT written).**

## What was done
- Read the full remediation plan (README + 00-06) and review-profiles README + map shape.
- Ran Phase 0 preflight reconnaissance only.

## Preflight blockers found (why the plan says stop before dispatch)
1. `ui-ux-pro-max` skill NOT available in this host (`~/.claude/skills/ui-ux-pro-max` absent). Plan 00/02 require it for UX/UI review and forbid auto-install during remediation -> UX/UI-dependent items are blocked_terminal unless a coordinator-authored tool-install packet exists, OR a degraded_with_defined_fallback is accepted (available alternatives: web-design-guidelines, ant-design, talkpik-ui-system, design-review).
2. No `supabase-fixture-manifest.json` in the run dir. Security/data/auth/storage/RBAC/owner/admin items are `security-fixture` blocked. Admin RBAC fixtures need `profiles.app_role` elevation (disabling a protect trigger) and owner-negative + learning-goal rows need dev-DB mutation — both require explicit user authorization (coordinator fail-closed earlier).
3. No remediation run-control artifacts exist yet (would be created fresh by Phase 0).

## Audit input correction (reconciliation needed on resume)
- Plan 00 "Current Audit Input" points at the STALE run `20260528-141731`.
- The fresh, post-React-#130-fix audit is `reports/ia-verification/runs/20260601-120308` (use THIS as the remediation input). Open a reconciliation item for the stale reference on resume.

## Remediation target buckets (from the post-fix audit)
- (A) Implementable product/copy fixes, no tool/fixture block: e.g. X-11 '도움말' link routes to home (misleading), G-01 '변경사항이 즉시 반영됩니다' overclaims (i18n deferred), A-01 social-login decision + brand/mascot region, A-03 onboarding step indicator, plus missing description regions per page.
- (B) Test-tooling fix (not product): CTA/heading regex in `tests/e2e/coverage/ia-catalog.ts` false-negatives (e.g. '내 라이브러리', '이어 풀 문제').
- (C) Fixture/DB-blocked (need authorization): B-01 (learning-goal seed), E-01/E-02 (owner-seed), H-01/X-08/X-10 (admin role elevation).
- (D) Deferred shells: X-02, X-03, X-04 (honest placeholders).
- (E) Evidence-only gaps: UX states not captured (loading/error/success) — re-collection, not product fixes.

## Pending user decisions before resume
1. Execution approach (pragmatic-scoped vs full-ceremony vs unblock-first).
2. `ui-ux-pro-max` fallback acceptance (use available design skills as degraded_with_defined_fallback?).
3. DB-fixture authorization (seed owner/learning-goal rows + elevate admin roles on the dev Supabase project — includes briefly disabling the profiles protect trigger).

## Resume point
Re-read this note + the remediation plan README. Decide the 3 items above, then run Phase 0 proper (create run-state/lock/cross-ia/reconciliation + fixture manifest decision + fresh task packets) before any IA dispatch.
