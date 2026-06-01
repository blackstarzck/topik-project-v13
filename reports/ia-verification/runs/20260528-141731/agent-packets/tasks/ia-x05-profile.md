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
- IA: X-05 Profile editing
- Route: /profile
- Current audit label: BLOCKED
- Owner: ia-worker-x05-profile
- Write lock: lock-x05-profile

## Must Read
- docs/IA/27-X-05-profile-editing/description.md
- docs/ai-workflow/agent-packets.md (packet/result format only)
- docs/user-communication-style.md (if you write a result packet)
- docs/spec.md profile/account constraints
- docs/development/backend-auth.md owner-check/auth constraints

## Evidence Inputs
- Audit gaps: missing manual-review row | security-navigation-results.json 0 rows — wrong-owner scenario could not be exercised. However, route has no :id param so direct-URL PII leak is structurally prevented — recommend security lane records this as a structural-protection note rather than running test | Description vs impl gaps: name length 80 vs 30, no email field (description ②), no avatar (③), no 변경값 비활성 (⑤), no 이탈 확인 (①), no 재인증 (① 예외) — multiple unimplemented description regions
- Source-map says /profile implementation exists. OWNER-CHECK is structural because route has no :id and server uses requireUser()+user.id scope.
- Security navigation evidence remains blocked; do not upgrade security result.
- Current source commit drift: audit b7b7189681aaf7f5aed8a3b2ec7d34c187f365ff, current cd2758b43ebe800c17b331dfb7e5a76951285965.

## Required Changes
- Align editable text limits with IA description: display name 30 chars, nickname 20 chars.
- Render read-only email/account identity field from authenticated user data.
- Add visible avatar/profile image area with honest state and security/reauth guidance. Do not claim upload is live unless implemented and tested.
- Disable Save when there are no profile changes; enable only on dirty state.
- Add unsaved-change leave protection for dirty profile edits.
- Keep current bio behavior unless directly affected.

## Write Scope
- src/components/profile/ProfileForm.tsx
- src/app/(workspace)/profile/page.tsx
- tests/components/profile/ProfileForm.test.tsx
- Stop before editing data-layer files unless the coordinator widens scope.

## Expected Verification
- Focused component test proves new profile behavior.
- Typecheck-safe props between page and component.
- Result packet path: reports/ia-verification/runs/20260528-141731/agent-packets/results/ia-x05-profile-remediation-result.md
