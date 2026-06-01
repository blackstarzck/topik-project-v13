# IA Remediation Task Packet

Generated: 2026-05-29T09:33:27.517Z
Run: 20260528-141731
Coordinator rule: use this packet only. Do not use the full IA remediation plan as your direct prompt.

## Global Guardrails
- Stay inside the declared write scope.
- Follow TDD: add/adjust focused failing tests first, run and record RED, then implement minimal changes and record GREEN.
- Do not alter unrelated dirty files: test-results/.last-run.json, tests/e2e/coverage/failure-log.json.
- Do not mark security, hosted-surface, or flow-edge gates PASS. Report them as blocked/degraded unless you produce the required evidence.
- Do not add dependencies.
- Result packet must include docs consulted, files changed, RED/GREEN commands, residual risks, and exact blockers.

## IA Slice
- IA: X-07 Weakness-based recommendations
- Route: /practice/weakness
- Current audit label: BLOCKED
- Owner: ia-worker-x07-weakness
- Write lock: lock-x07-weakness

## Must Read
- docs/IA/29-X-07-weakness-based-recommendations/description.md
- docs/ai-workflow/agent-packets.md (packet/result format only)
- docs/user-communication-style.md (if you write a result packet)
- docs/development/deferred-scope.md billing/paywall constraints
- docs/spec.md practice/weakness constraints

## Evidence Inputs
- Audit gaps: missing manual-review row | Primary CTA matching /(시작|선택|연습)/i not visible | Missing description ④ insights panel (reason/example/strategy) | Missing description ⑤ '추천 사유 1줄' per card | PAYWALL-ENTRY not implemented (description ① ⑤ 예외, user-flow L138) | AI confidence framing too strong — HAX guideline 11 violation | browser timeout; no rendered evidence
- getWeaknessRecommendations already returns reason/source; page currently drops them.
- Browser evidence had timeout; do not upgrade browser gate without rerun evidence.
- Paywall/provider is deferred; entry may point to deferred paywall surface but must not promise active billing.

## Required Changes
- Pass recommendation reason/source into the view and render a per-card reason.
- Add an insight panel with why/example/strategy copy for the leading weak dimension.
- Make the recommendation start action visibly primary and test its click behavior.
- Add an honest paywall/deeper-recommendation entry without provider or payment promises.
- Keep AI confidence cautious; avoid deterministic overclaiming.

## Write Scope
- src/components/practice/WeaknessView.tsx
- src/app/(workspace)/practice/weakness/page.tsx
- tests/components/practice/WeaknessView.test.tsx
- Stop before editing billing/provider or unrelated practice files.

## Expected Verification
- Focused component test proves insights, reasons, primary CTA, and paywall entry.
- Typecheck-safe props between page and component.
- Result packet path: reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x07-weakness-remediation-result.md
