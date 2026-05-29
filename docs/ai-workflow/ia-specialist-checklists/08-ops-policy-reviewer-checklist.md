# Ops/Policy Reviewer Checklist

## Purpose

Review operational behavior and policy boundaries, including deferred billing, notification transport, email, cooldown, rate limits, admin audit, logging, language, and unresolved business rules.

## Required Inputs

- IA profile row.
- Required packs, especially `POLICY`, `DEFERRED-BILLING`, `TRANSPORT-DEFERRED`, `EMAIL`, `COOLDOWN`, `RATE-LIMIT`, `OPS`, `AUDIT`, `I18N`, `PERSISTENCE`, and `COPY-POLICY`.
- Current policy and deferred-scope docs.
- Audit evidence and implementation evidence.

## Applies When

- The IA includes billing, subscription, paywall, notification settings, email, cooldown, rate-limit, admin audit, language settings, external service failure, or operational logging.

## Does Not Apply When

- The IA has no policy, external service, operational, or deferred-scope behavior.

## Checklist Items

- [ ] Deferred billing surfaces do not imply live checkout, invoice, plan change, or payment-provider integration.
- [ ] Notification settings do not imply transport delivery unless implemented.
- [ ] Email resend, verification, and password reset respect documented cooldown and rate limits.
- [ ] Admin or system actions produce audit evidence where required.
- [ ] Operational failures have user-facing recovery and server-side diagnostics when required.
- [ ] Language settings persist as documented and do not imply unsupported translation scope.
- [ ] Business, legal, pricing, retention, or policy gaps are labeled `DOC-GAP`.
- [ ] Human confirmation is recorded when the profile requires it.

## Detailed Checklist Matrix

### Deferred Billing And Subscription

- [ ] Paywall UI matches deferred billing scope.
- [ ] Subscription UI matches deferred billing scope.
- [ ] No live checkout is implied unless implemented.
- [ ] No invoice, receipt, refund, or payment method management is implied unless implemented.
- [ ] Plan comparison copy avoids unsupported pricing promises.
- [ ] Billing CTA is disabled, informational, or safely routed according to docs.
- [ ] Billing error states do not refer to provider behavior that is not integrated.
- [ ] Locked feature entry explains current availability and next action.
- [ ] Subscription status distinguishes mock, shell, inactive, active, and unavailable where applicable.
- [ ] Human confirmation is recorded for pricing/policy assumptions when required.

### Notifications And Email

- [ ] Notification settings distinguish saved preference from actual delivery.
- [ ] Transport-deferred copy is explicit where notification sending is not implemented.
- [ ] Email verification copy matches auth policy.
- [ ] Password reset email copy matches auth policy.
- [ ] Resend cooldown is visible.
- [ ] Resend provider failure is handled.
- [ ] Email rate-limit state is handled.
- [ ] Email prefill is treated as untrusted and editable when applicable.
- [ ] Email-related copy avoids account enumeration.
- [ ] User can recover if email delivery is unavailable.

### Rate Limits, Cooldowns, And Abuse Prevention

- [ ] Cooldown duration matches active docs.
- [ ] Retry-after behavior is visible when docs require it.
- [ ] Disabled action explains wait state.
- [ ] Countdown re-enables action correctly.
- [ ] Abuse-prevention copy avoids exposing internal thresholds beyond documented values.
- [ ] Repeated failures do not trap the user.
- [ ] Rate-limit state is covered in tests or manual evidence.
- [ ] Admin or support path is documented if user cannot self-recover.

### Operational Failure And Diagnostics

- [ ] External service failure has user-facing recovery.
- [ ] Long-running operation has pending, timeout, success, and failure states.
- [ ] Server-side failure has useful diagnostic log when required.
- [ ] Logs avoid secrets, tokens, raw PII, and raw provider payloads.
- [ ] User-facing copy does not expose stack traces or internal service names unless approved.
- [ ] Retry is safe and idempotent where offered.
- [ ] Non-idempotent operations block duplicate retry.
- [ ] Operational alert/audit needs are documented for admin actions.
- [ ] Manual fallback is documented when automation/service is unavailable.
- [ ] Completion report records degraded operations separately from product pass.

### Admin Audit And Policy

- [ ] Admin create action requires audit evidence.
- [ ] Admin update action requires audit evidence.
- [ ] Admin delete action requires audit evidence.
- [ ] Admin role/privilege action requires audit evidence.
- [ ] Audit record includes actor, target, action, time, and result where docs require it.
- [ ] Audit record does not include secrets or raw PII beyond policy.
- [ ] Policy gaps are labeled by category.
- [ ] Retention or deletion ambiguity is labeled `DOC-GAP`.
- [ ] Legal/compliance ambiguity is labeled `DOC-GAP`.
- [ ] Human confirmation cannot be replaced by AI-generated notes.

### Language And Persistence

- [ ] Language setting saves successfully.
- [ ] Language setting survives reload.
- [ ] Language setting survives new session where docs require it.
- [ ] Unsupported language fallback is clear.
- [ ] Mixed-language UI is intentional or recorded as issue.
- [ ] Preference save failure is visible.
- [ ] Unsaved changes are visible.
- [ ] Cancel/revert behavior is visible.
- [ ] Persistence does not leak preference across users.
- [ ] Language scope does not imply full localization beyond docs.

### Evidence To Capture

- [ ] Deferred billing no-overpromise review.
- [ ] Notification transport-deferred review.
- [ ] Email cooldown/rate-limit evidence.
- [ ] External failure recovery evidence.
- [ ] Admin audit evidence.
- [ ] Log redaction evidence where feasible.
- [ ] Language persistence evidence.
- [ ] Human confirmation artifact where required.
- [ ] `DOC-GAP` list for unresolved policy decisions.

## Research-Backed Detailed Checks

- [ ] Deferred billing copy names the current state as unavailable, simulated, informational, or shell-only when appropriate.
- [ ] Paywall and subscription pages do not show live checkout promises, payment method management, invoices, receipts, refunds, or provider logos unless implemented.
- [ ] Billing-related CTAs are disabled, redirected to safe explanation, or clearly scoped to current docs.
- [ ] Notification settings distinguish preference persistence from actual delivery transport.
- [ ] Email resend and password reset paths show cooldown, retry, provider failure, and rate-limit states without unsafe account disclosure.
- [ ] Rate-limit copy gives a useful next action without exposing abuse-prevention internals beyond documented values.
- [ ] Operational failures show user recovery and leave server-side diagnostic evidence when the pack requires `OPS`.
- [ ] Admin create/update/delete/role actions write audit evidence or explicitly document why audit is not applicable.
- [ ] Logs avoid tokens, raw PII, provider secrets, raw model prompts, and user answer content unless active docs allow it.
- [ ] Language settings verify selected language, fallback language, reload behavior, and unsupported-string behavior.
- [ ] Persistence checks include reload, new tab, session continuation, and signed-out/signed-in transition when relevant.
- [ ] Policy gaps are separated into pricing, legal, retention, notification, billing, email, and data categories.
- [ ] Human confirmation records include who confirmed, what was confirmed, when, and which IA/profile it affects.
- [ ] Operational fallback does not weaken security, privacy, or deferred-scope boundaries.

## Rating Criteria

- `PASS`: policy boundary, operational behavior, evidence, and required human confirmation are complete.
- `PARTIAL`: policy is mostly respected but a recovery, logging, or evidence item is incomplete.
- `FAIL`: UI or behavior overpromises deferred scope, violates cooldown/rate-limit policy, or omits required audit.
- `BLOCKED`: required policy docs, service evidence, or human confirmation are unavailable.
- `N/A`: no ops or policy concern applies.

## Required Evidence

- Deferred-scope evidence.
- Policy source references.
- Rate-limit or cooldown evidence when relevant.
- Audit/log evidence when relevant.
- Human confirmation record when required.

## Result Packet Fields

- `policyBoundary`
- `deferredScope`
- `cooldownRateLimit`
- `auditLogging`
- `externalFailureRecovery`
- `humanConfirmation`

## External References

- NN/g usability heuristics.
- Project deferred-scope and policy docs.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [GOV.UK error message component](https://design-system.service.gov.uk/components/error-message/)

## Project-Specific No-Pass Rules

- Do not pass deferred billing or notification transport surfaces without explicit no-overpromise review.
- Do not pass a `humanConfirmationRequired` IA without a human confirmation artifact.
- Do not pass an operational failure state if the user sees no recovery path or diagnostics are unavailable where required.
