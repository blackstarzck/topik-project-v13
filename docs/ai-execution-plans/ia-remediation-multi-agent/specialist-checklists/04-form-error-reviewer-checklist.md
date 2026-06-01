# Form/Error Reviewer Checklist

## Purpose

Review forms, validation, disabled states, error messages, retry behavior, and recovery paths.

## Required Inputs

- IA profile row.
- Required packs, especially `FORM`, `AUTH`, `EMAIL`, `TOKEN`, `WRITE`, `SUBMIT`, `RETRY`, `RATE-LIMIT`, and `RECOVERY`.
- Current implementation and test evidence.
- Relevant product policy docs for auth, email, writing, and account behavior.

## Applies When

- The IA includes form input, writing input, authentication input, email actions, retry, submit, or user-correctable errors.

## Does Not Apply When

- The IA has no user input, retry action, or recoverable error state.

## Checklist Items

- [ ] Every input has a label or clear instruction.
- [ ] Required, invalid, disabled, loading, success, and failure states are covered.
- [ ] Error messages describe what failed and how to recover.
- [ ] Submit actions prevent accidental duplicate side effects.
- [ ] Retry and resend actions respect cooldown and rate-limit behavior.
- [ ] Auth and email flows avoid raw provider errors in UI or URLs.
- [ ] Writing flows handle draft, autosave, stale state, and final submit behavior where applicable.
- [ ] Recovery keeps the user in a safe state after failed submit, network failure, or expired session.

## Detailed Checklist Matrix

### Field Structure

- [ ] Every input has a persistent visible label or equivalent programmatic label.
- [ ] Placeholder text is supplementary only.
- [ ] Required fields are clear before submit.
- [ ] Optional fields are clear where ambiguity affects completion.
- [ ] Help text is near the field it explains.
- [ ] Field format examples are shown for constrained input.
- [ ] Input purpose is clear for email, password, profile, language, and writing fields.
- [ ] Autocomplete behavior is intentional for auth/profile fields.
- [ ] Sensitive fields avoid unnecessary prefill.
- [ ] Field grouping matches the user's mental model.

### Validation Rules

- [ ] Required validation.
- [ ] Format validation.
- [ ] Length validation.
- [ ] Min/max validation where applicable.
- [ ] Duplicate or already-used validation where applicable.
- [ ] Server rejection validation.
- [ ] Rate-limit validation.
- [ ] Token-expired validation.
- [ ] Session-expired validation.
- [ ] Cross-field validation where fields depend on each other.
- [ ] Validation timing is clear: on blur, on submit, or after server response.
- [ ] Client validation and server validation do not contradict each other.

### Error Presentation

- [ ] Field-level error appears next to the related field.
- [ ] Multi-error forms provide a summary or equivalent route to errors.
- [ ] Error summary appears before form fields when the user needs it.
- [ ] Focus moves to summary or first error after failed submit.
- [ ] Error text names the field or action.
- [ ] Error text explains how to fix the issue.
- [ ] Error text avoids raw provider wording.
- [ ] Error text avoids leaking account existence.
- [ ] Error state is visible by more than color.
- [ ] Error state remains until the user can understand and fix it.

### Submit And Duplicate Prevention

- [ ] Submit is disabled or guarded while request is pending.
- [ ] Pending state labels the action in progress.
- [ ] Double click does not duplicate side effects.
- [ ] Enter key behavior matches expected submit behavior.
- [ ] Browser refresh after submit does not repeat irreversible actions.
- [ ] Browser back after submit does not repeat irreversible actions.
- [ ] User can recover if submit fails.
- [ ] User input is preserved after recoverable failure.
- [ ] Final submit has confirmation when required by pack.
- [ ] Success state makes the next action clear.

### Retry, Cooldown, And Recovery

- [ ] Retry CTA is visible when retry is allowed.
- [ ] Retry CTA is hidden or disabled when retry is unsafe.
- [ ] Cooldown state shows remaining wait when docs require it.
- [ ] Cooldown state re-enables action correctly.
- [ ] Rate-limit state gives safe next action.
- [ ] Network failure state gives retry or save path.
- [ ] External service failure has fallback copy.
- [ ] Expired token state explains safe restart path.
- [ ] Expired session state preserves safe return path.
- [ ] Recovery does not expose secret or provider details.

### IA-Specific Form Cases

- [ ] Sign-up covers invalid email, existing email, weak password, provider failure, and email verification next step.
- [ ] Login covers invalid credentials, unverified email, disabled signup, rate limit, and password reset path.
- [ ] Password reset covers unknown email safety, resend, expired token, malformed token, and cooldown.
- [ ] Onboarding covers incomplete selection, skip/resume, already-completed state, and save failure.
- [ ] Writing covers empty answer, too short/long answer, draft restore, autosave conflict, final submit, and analysis handoff.
- [ ] Profile covers PII editing, save failure, cancel, persisted value, and masking where applicable.
- [ ] Settings covers saved, unsaved, saving, failed, and persisted preference.
- [ ] Admin forms cover permission failure, validation failure, audit evidence, and rollback path.

### Evidence To Capture

- [ ] Happy-path submit evidence.
- [ ] At least one validation failure evidence per form.
- [ ] Server failure evidence.
- [ ] Duplicate-submit evidence for side-effect actions.
- [ ] Cooldown/rate-limit evidence where applicable.
- [ ] Field focus/error summary evidence.
- [ ] Recovery path evidence.
- [ ] Safe-copy review for auth and token flows.

## Research-Backed Detailed Checks

- [ ] Each field has a visible label or programmatic label; placeholder text is not the only label.
- [ ] Help text is placed before the user needs it and is linked to the field when useful.
- [ ] Required fields are identified before submit, not only after an error.
- [ ] Validation preserves entered values unless clearing is required for security.
- [ ] Field-level errors appear next to the field they describe.
- [ ] Page-level or section-level error summary appears when multiple errors are possible.
- [ ] Error summary links or focus behavior take the user to the first actionable error.
- [ ] The browser/page title indicates error state when that pattern is used.
- [ ] Error text names the field or question and gives a specific fix.
- [ ] Error copy avoids blame, raw provider language, stack traces, and internal codes.
- [ ] Client-side and server-side validation produce equivalent user-facing meaning.
- [ ] Disabled submit states explain why the action is unavailable when not obvious.
- [ ] Pending submit prevents duplicate actions and keeps recovery available.
- [ ] Retry/resend controls show cooldown state, remaining wait when documented, and re-enable behavior.
- [ ] Password reset and email verification avoid account enumeration in public copy.
- [ ] Auth failures use safe generic copy where security requires it, while still giving a useful next action.
- [ ] Writing inputs preserve draft/autosave state across recoverable errors.
- [ ] Final writing submit distinguishes validation error, network failure, analysis pending, and accepted submission.
- [ ] Rate-limit and abuse-prevention states do not reveal sensitive backend thresholds beyond documented user-facing policy.
- [ ] Error evidence includes at least one negative case per required pack, not only the happy path.

## Rating Criteria

- `PASS`: form/error behavior and recovery evidence cover the relevant packs.
- `PARTIAL`: baseline input works but edge states or evidence are incomplete.
- `FAIL`: users can submit invalid data, repeat side effects, see unsafe raw errors, or become trapped.
- `BLOCKED`: form cannot be exercised because data, service, or route access is unavailable.
- `N/A`: no form, retry, or recoverable error behavior exists in scope.

## Required Evidence

- Validation evidence.
- Error-state evidence.
- Duplicate-submit or cooldown evidence when relevant.
- Recovery path evidence.
- Test or browser output.

## Result Packet Fields

- `inputCoverage`
- `validationCoverage`
- `errorCopy`
- `retryCooldown`
- `duplicatePrevention`
- `recoveryEvidence`

## External References

- NHS form guidance.
- WCAG 2.2 error identification.
- WCAG 2.2 labels or instructions.
- [GOV.UK error message component](https://design-system.service.gov.uk/components/error-message/)
- [GOV.UK error summary component](https://design-system.service.gov.uk/components/error-summary/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Project-Specific No-Pass Rules

- Do not pass auth, email, token, or rate-limit flows without negative-case evidence.
- Do not pass writing submit flows without duplicate-submit and failure-recovery evidence.
- Do not pass a form IA if users can see an error but cannot identify the field and next action.
