# Public/Auth shard — Phase 5 AI-first UX review result

## Result Packet

- Agent: Claude (Opus 4.7 · 1M context) — child agent dispatched by main session
- Role: Phase 5 AI-first UX reviewer for shard `public-auth`
- Objective completed: yes — reviewed all 6 IA items (X-01, A-01, A-02, X-06, X-11, X-12) + 3 support route handlers per `docs/ai-workflow/ia-ai-first-ux-review-checklist.md` §5 IA Review Card template; produced this result packet + sibling JSON cards file
- Audience verified: yes — all assigned IA codes audience=`public`; support surfaces audience=`public`; no admin/user-route boundary touched
- Files inspected:
  - `reports/ia-verification/runs/20260528-141731/agent-dispatch-plan.json` (shard `public-auth`)
  - `reports/ia-verification/runs/20260528-141731/ia-manifest.json`
  - `reports/ia-verification/runs/20260528-141731/doc-receipts.json`
  - `reports/ia-verification/runs/20260528-141731/source-map-results.json` (all PASS)
  - `reports/ia-verification/runs/20260528-141731/browser-results.json` (all 6 PARTIAL — nav timeout)
  - `reports/ia-verification/runs/20260528-141731/hosted-surface-results.json` (BLOCKED, 0 rows — script parse failure)
  - `reports/ia-verification/runs/20260528-141731/security-navigation-results.json` (BLOCKED, 0 rows — same)
  - `reports/ia-verification/runs/20260528-141731/screenshots/` (18 screenshots for 6 IA × 3 viewports — captured after timeout, partial fidelity)
  - `docs/ai-workflow/ia-ai-first-ux-review-checklist.md`
  - `docs/ai-workflow/agent-packets.md`
  - `docs/IA/23-X-01-product-landing/description.md`
  - `docs/IA/01-A-01-sign-up/description.md`
  - `docs/IA/02-A-02-login/description.md`
  - `docs/IA/28-X-06-password-reset/description.md`
  - `docs/IA/33-X-11-auth-error/description.md`
  - `docs/IA/34-X-12-auth-verify-email/description.md`
  - `docs/development/auth-overview.md` (§4.1, §4.2, §5, §10 Known drift)
  - `src/app/page.tsx`, `src/components/landing/Hero.tsx`, `src/components/landing/FeatureCard.tsx`
  - `src/app/sign-up/page.tsx`, `src/components/auth/SignUpForm.tsx`
  - `src/app/login/page.tsx`, `src/components/auth/LoginForm.tsx`
  - `src/app/password-reset/page.tsx`, `src/components/auth/PasswordResetRequestForm.tsx`, `src/components/auth/PasswordResetConfirmForm.tsx`
  - `src/app/auth/error/page.tsx`, `src/components/auth/AuthErrorCard.tsx`
  - `src/app/auth/verify-email/page.tsx`, `src/components/auth/VerifyEmailCard.tsx`
  - `src/app/auth/callback/route.ts`
  - `src/app/auth/callback-fragment/page.tsx`, `src/components/auth/CallbackFragmentFallback.tsx` (referenced only)
  - `src/app/auth/sign-out/route.ts`
- Files changed:
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-public-auth-result.md` (this file)
  - `reports/ia-verification/runs/20260528-141731/agent-packets/results/20260528-141731-public-auth-cards.json`
- Decisions made:
  - All 6 IA marked `PARTIAL` rather than PASS because (a) checklist §1 forbids PASS from code inspection / HTTP status alone, (b) browser-results PARTIAL with empty `uxStatesCaptured`, (c) hosted-surface and security-navigation JSONs both BLOCKED (0 rows).
  - X-11 and X-12 NOT marked DOC-GAP despite `wireframeStatus=missing`: description.md for both is detailed (Codex 3-round consensus) and provides enough requirements for an error/verify-email card. Recording as evidence-gap (wireframe.png absent), not doc-gap.
  - A-01 and X-06 PW `min(8).max(64)` drift confirmed in code — already logged in `docs/development/auth-overview.md §10` (2026-05-27). No new ledger entry needed; recommend code fix in a separate PR per existing doc guidance.
  - Newly observed drift on A-01: description ③ specifies `이름 2-30자` but `displayName` field in SignUpForm.tsx has NO min/max rule. Surfacing as a top risk.
  - Newly observed drift on A-02: description ③ specifies `ID 4-80자, PW 8-64자, blur 후 형식 검증` — LoginForm.tsx enforces only `required`. Surfacing as a top risk.
  - All inline `message.error(\`...: ${error.message}\`)` patterns in Sign-up / Login / Password-reset forms are partial violations of §6.9 "Raw provider errors are not shown to users". /auth/error path is the gold-standard fix (REASON_CONTENT mapping) — these inline forms have not been migrated to the same pattern.
- Tests/checks run:
  - Reviewer-only — no code edits, no test runs. Relied on existing this-session evidence: source-map PASS, browser PARTIAL (nav timeout from dev-server cache/HMR per task brief), Playwright spec runs reported in task brief (81 + 102 PASS) including `tests/e2e/coverage/auth-route-handlers.spec.ts` PASS for AUTH-RH-1~7.
- Results:
  - PASS: 0
  - PARTIAL: 6 (X-01, A-01, A-02, X-06, X-11, X-12)
  - FAIL: 0
  - BLOCKED: 0 (treated as PARTIAL because rendered evidence partially exists via screenshots even after nav timeout)
  - DOC-GAP: 0 (only candidate was X-11/X-12 missing wireframe — judged not DOC-GAP because description.md is sufficient)
  - DEFERRED: 0
  - needs-human-judgment: 6 (all six, due to medium confidence + missing rendered keyboard/responsive evidence + raw-error-toast judgment)
- Blockers:
  - browser-results lane is PARTIAL across the shard (cache + HMR noise) — visibleH1/CTA never captured.
  - hosted-surface and security-navigation result JSONs both BLOCKED (0 rows) — script parse failure noted in task brief. Playwright specs themselves PASSed this session, but the result JSON variant the validator consumes is missing. Cannot mechanically prove keyboard-focus, OTP/code expiry, or session-expired navigation flows.
- Assumptions:
  - Trusted the task brief's assertion that `auth-route-handlers.spec.ts` AUTH-RH-1~7 PASSed this session for /auth/callback, /auth/callback-fragment, /auth/sign-out behavior.
  - Treated screenshots that exist for all 6 IA × 3 viewports as low-fidelity layout evidence; they were taken after `page.goto` timed out so they may not represent fully-loaded UI state.
- Scope concerns:
  - none — work stayed inside `exactWriteScope` (only two files under `reports/ia-verification/runs/20260528-141731/agent-packets/results/`).
- Recommended follow-up:
  1. **P0** — Re-run browser, hosted-surface, security-navigation lanes against a cold dev/prod build so evidence JSONs surface (`auth-overview.md` integration tests have already PASSed but the IA verification JSON variant is empty). Without this, none of the six IA can move from PARTIAL to PASS.
  2. **P0** — Fix raw-Supabase-error-text leakage in `SignUpForm.tsx:47`, `LoginForm.tsx:43,63`, `PasswordResetRequestForm.tsx:26`, `PasswordResetConfirmForm.tsx:27`, `VerifyEmailCard.tsx:160`. Replace `\`X 실패: ${error.message}\`` with mapped friendly strings (mirror the `/auth/error` REASON_CONTENT pattern). Checklist §6.9 + §9.
  3. **P1** — Apply `z.string().min(8).max(64)` (and equivalents for email/displayName per description.md) to SignUpForm, LoginForm, PasswordResetConfirmForm. Aligns A-01/X-06 with description and closes the §10 known drift entry.
  4. **P1** — Implement missing UI surfaces per description.md:
     - X-01 wireframe ① 헤더/내비, ④ 제품 프리뷰, ⑤ 마스코트; logged-in-user branch '대시보드 CTA'.
     - A-01 wireframe ① 브랜드 메시지, ② 마스코트/혜택 영역.
     - A-02 wireframe ① 환영/브랜드 영역, ② 마스코트 안내.
     - X-06 wireframe ② 단계 표시 (Steps), ⑤ 마스코트, request-side resend cooldown (description ④), confirm-side '링크 재발송' CTA (description ⑥).
  5. **P2** — Forward Retry-After header from `/auth/callback` route handler to `/auth/error?retry_after_seconds=<n>` so X-11 countdown reflects real Supabase limits instead of 60s fallback (Codex C-ε intent in description.md §4).
  6. **P2** — `formatCountdown` (X-11 and X-12) does not roll over to hours; values >3600s display as `1440분`. Add hour-level branch.
- Context ledger updates needed:
  - No new ledger required for review-only output. Existing audit-flow-monitor.json under the run folder should pick this packet up automatically. If main session integrates results, suggest adding a follow-up ledger entry for the P0 raw-error-leakage finding.

---

## Per-IA AI UX Review Cards

The full structured findings live in `20260528-141731-public-auth-cards.json` (same folder). Cards below summarize each IA against checklist §5 template.

### X-01 Product landing

- Route or host route: `/`
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/23-X-01-product-landing/description.md`
- Wireframe status: `present`
- Implementation anchors:
  - `src/app/page.tsx`
  - `src/components/landing/Hero.tsx`
  - `src/components/landing/FeatureCard.tsx`
- Required evidence:
  - mobile 360 screenshot: `reports/.../screenshots/coverage-X-01-360.png` (captured post-timeout)
  - tablet 768 screenshot: `reports/.../screenshots/coverage-X-01-768.png` (captured post-timeout)
  - desktop 1280 screenshot: `reports/.../screenshots/coverage-X-01-1280.png` (captured post-timeout)
  - direct URL: source PASS; browser navigation timeout (PARTIAL)
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: marketing page — N/A loading/empty/error per browser-results uxStatesUnavailableReason
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: partial (Hero present; wireframe areas ①④⑤ unimplemented)
- Entry context: clear
- Primary action: competing (two side-by-side CTAs of similar weight)
- Flow continuity: pass
- AI behavior: not applicable
- Form/error UX: not applicable
- Keyboard/focus: pass (low-confidence)
- Responsive: pass (low-confidence)
- Policy/trust copy: pass

Top gaps:
- No header/nav implemented despite wireframe ① + description constraint '메뉴 4개 이하'.
- No product preview / mascot per wireframe ④⑤.
- No session-aware branch ('로그인 사용자는 시작 대신 대시보드 CTA').

Human reviewer should inspect:
- Whether two equal-weight CTAs (가입/로그인) read as one primary on mobile, or whether they compete.
- Whether the absence of mascot/preview affects landing conversion intent.

---

### A-01 Sign-up

- Route or host route: `/sign-up`
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/01-A-01-sign-up/description.md`
- Wireframe status: `present`
- Implementation anchors:
  - `src/app/sign-up/page.tsx`
  - `src/components/auth/SignUpForm.tsx`
- Required evidence:
  - mobile/tablet/desktop screenshots: present but post-timeout
  - direct URL: source PASS; browser PARTIAL
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: uxStatesCaptured=[] (browser-results)
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: pass
- Entry context: pass
- Primary action: pass
- Flow continuity: pass (→ X-12 verify-email)
- AI behavior: not applicable
- Form/error UX: partial (PW max(64) missing; displayName length missing; raw provider errors in toasts)
- Keyboard/focus: pass (low-confidence)
- Responsive: pass (low-confidence)
- Policy/trust copy: partial (terms checkbox without link targets)

Top gaps:
- Password drift `min(8).max(64)` already logged in auth-overview §10 — still present.
- displayName has no min/max validation despite description '이름 2-30자' (NEW finding).
- Sign-up error reaches the user as `가입 실패: ${error.message}` — raw Supabase message text.
- Wireframe ①② (브랜드 메시지, 마스코트/혜택) absent.

Human reviewer should inspect:
- Whether terms checkbox needs working hyperlinks to legal pages, or if those pages are still DEFERRED.
- Whether '가입 실패: {raw}' is acceptable Korean copy, or needs the same REASON_CONTENT mapping treatment as `/auth/error`.

---

### A-02 Login

- Route or host route: `/login`
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/02-A-02-login/description.md`
- Wireframe status: `present`
- Implementation anchors:
  - `src/app/login/page.tsx`
  - `src/components/auth/LoginForm.tsx`
- Required evidence:
  - mobile/tablet/desktop screenshots: present but post-timeout
  - direct URL: source PASS; browser PARTIAL
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: uxStatesCaptured=[] (browser-results)
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: pass
- Entry context: pass (`?reason=session_expired` Alert wired via `SESSION_NOTICE`)
- Primary action: pass
- Flow continuity: pass (success → /dashboard; magic-link → confirmation state)
- AI behavior: not applicable
- Form/error UX: partial (no email length, no password length, no lockout copy, raw errors in toast)
- Keyboard/focus: pass (low-confidence)
- Responsive: pass (low-confidence)
- Policy/trust copy: pass

Top gaps:
- Description ③ field-length constraints `4-80자 / 8-64자` and `blur 후 형식 검증` not implemented (NEW finding for A-02).
- '3회 실패 시 잠금 안내' (description ③) not surfaced client-side.
- Raw Supabase error text inlined into `로그인 실패: ${error.message}` toast.
- Wireframe ①② (브랜드, 마스코트) absent.

Human reviewer should inspect:
- Whether ID 4-80자 is necessary (Supabase already enforces email format) or whether description ③ should be relaxed to match implementation.
- Whether lockout copy belongs in this form or only in /auth/error after Supabase server returns 429.

---

### X-06 Password reset

- Route or host route: `/password-reset` (+ `/password-reset/confirm`)
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/28-X-06-password-reset/description.md`
- Wireframe status: `present`
- Implementation anchors:
  - `src/app/password-reset/page.tsx`
  - `src/app/password-reset/confirm/page.tsx`
  - `src/components/auth/PasswordResetRequestForm.tsx`
  - `src/components/auth/PasswordResetConfirmForm.tsx`
- Required evidence:
  - mobile/tablet/desktop screenshots: present but post-timeout
  - direct URL: source PASS; browser PARTIAL
  - browser back: not verified
  - keyboard/focus: not verified
  - error/empty/loading state: uxStatesCaptured=[] (browser-results)
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: pass
- Entry context: pass
- Primary action: pass
- Flow continuity: pass (request → email → confirm → /login)
- AI behavior: not applicable
- Form/error UX: partial (PW max(64) drift; raw errors in toast; no link-resend CTA on confirm side)
- Keyboard/focus: pass (low-confidence)
- Responsive: pass (low-confidence)
- Policy/trust copy: partial (no Steps indicator per wireframe ②; no resend-cooldown UI on request side per description ④)

Top gaps:
- PW max(64) drift carries over from A-01 — same auth-overview §10 known issue.
- Wireframe ② 단계 표시 (Steps component) absent.
- Description ④ resend-cooldown UI absent on request side.
- Description ⑥ '저장 실패/만료는 재시도와 링크 재발송 CTA 제공' — confirm-side has no 재발송 CTA.

Human reviewer should inspect:
- Whether Steps indicator is mandatory or whether two-screen flow (request → confirm) is sufficient.
- Whether confirm-side '링크 재발송' is needed when failure already redirects via callback to /auth/error.

---

### X-11 Auth error

- Route or host route: `/auth/error`
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/33-X-11-auth-error/description.md`
- Wireframe status: **missing** (Codex 3-round spec — no wireframe.png)
- Implementation anchors:
  - `src/app/auth/error/page.tsx`
  - `src/components/auth/AuthErrorCard.tsx`
  - `src/lib/auth/error-mapping.ts` (referenced)
- Required evidence:
  - mobile/tablet/desktop screenshots: present but post-timeout
  - direct URL: source PASS; browser PARTIAL
  - browser back: not verified
  - keyboard/focus: not verified (aria-live present)
  - error/empty/loading state: page IS the error state; cooldown branch not captured live
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: pass (REASON_CONTENT mapping)
- Entry context: pass
- Primary action: pass (countdown disables primary as required)
- Flow continuity: pass (always shows escape route per description ⑥)
- AI behavior: not applicable
- Form/error UX: pass (editable email field per description ⑤ Codex C-ε)
- Keyboard/focus: pass (low-confidence; aria-live=polite)
- Responsive: pass (low-confidence)
- Policy/trust copy: pass (strongest in shard — raw error text never surfaces to UI; console.error server-side only)

Top gaps:
- Retry-After value from Supabase isn't forwarded by `src/app/auth/callback/route.ts buildErrorUrl` (always passes null) — so countdown always defaults to 60s even when Supabase returned a different value.
- `formatCountdown` does not handle hours; large Retry-After values render as '1440분'.
- wireframeStatus=missing — Phase 5 review accepts because description is comprehensive (11 reason codes + CTA mapping + countdown semantics + escape route + raw-error suppression). Recording as evidence gap, not DOC-GAP.

Human reviewer should inspect:
- Whether 60s default is operationally fine vs. forwarding the real Retry-After.
- Whether '홈으로 돌아가기' bottom anchor is sufficient escape, or whether a help-link should be added (description ⑥ lists '도움말' in the spec).

---

### X-12 Auth verify-email

- Route or host route: `/auth/verify-email`
- Route type: `page`
- Audience: `public`
- IA source: `docs/IA/34-X-12-auth-verify-email/description.md`
- Wireframe status: **missing** (Codex 3-round spec — no wireframe.png)
- Implementation anchors:
  - `src/app/auth/verify-email/page.tsx`
  - `src/components/auth/VerifyEmailCard.tsx`
- Required evidence:
  - mobile/tablet/desktop screenshots: present but post-timeout
  - direct URL: source PASS; browser PARTIAL
  - browser back: not verified
  - keyboard/focus: not verified (aria-live present)
  - error/empty/loading state: cooldown timer exposed via `data-testid=verify-email-countdown`; failure path not captured live
- AI UX result: `PARTIAL`
- Confidence: `medium`
- Human confirmation: `needs-human-judgment`

AI findings:
- Page job: pass
- Entry context: pass (`?email=` query survives reload; localStorage cooldown survives reload — explicitly hardened in Phase 8 follow-up v2.3)
- Primary action: pass (single primary; cooldown-aware disabled)
- Flow continuity: pass (3 escapes: 로그인 / 다른 이메일로 가입 / 홈)
- AI behavior: not applicable
- Form/error UX: partial (editable email always present per Codex C-ε; raw error text leaks via `재전송에 실패했어요: ${error.message}` for non-rate-limit failures)
- Keyboard/focus: pass (low-confidence)
- Responsive: pass (low-confidence)
- Policy/trust copy: pass (correctly chose 60s default rather than misreading HTTP 429 as seconds — comment lines 151-154)

Top gaps:
- Same raw-error-text leakage pattern as A-01/A-02/X-06 for non-rate-limit branches.
- formatCountdown shared characteristic with X-11 (no hour roll-over).
- wireframeStatus=missing — accepted on the same grounds as X-11.

Human reviewer should inspect:
- Whether the resend failure copy needs the same REASON_CONTENT treatment as /auth/error.
- Whether '받은편지함 열기' shortcut should be added (description ⑤ secondary action — currently only spam reminder + alternate email + signup paths).

---

## Route handlers (support surfaces inside this shard)

Per `agent-dispatch-plan.json` `supportSurfaceShard.routeHandlers`, the public-auth shard also owns:

### `/auth/callback` (Route Handler, AUTH-RH-1~5)

- File: `src/app/auth/callback/route.ts` (Route Handler, not page — explicitly noted in inline comments lines 1-18 as a Phase 8 P0 fix to escape Server-Component cookie silent-fail)
- Behavior verified via reading:
  - PKCE main flow: `token_hash + type` → `verifyOtp` → success redirect to sanitized `next`, failure redirect to `/auth/error?reason=<mapped>`.
  - OAuth code flow: `code` → `exchangeCodeForSession` → same redirect pattern.
  - Provider error in query: `error_code` query present → redirect to `/auth/error?reason=<mapped>`.
  - Malformed callback (`token_hash` without valid `type`): redirect to `/auth/error?reason=unknown` (explicit Codex follow-up guard).
  - Fragment fallback: no server-readable token → redirect to `/auth/callback-fragment?next=<n>`. Browser RFC 7231 preserves `#fragment` across the redirect.
- Raw error text never reaches UI — all errors mapped via `mapSupabaseErrorCode` to `?reason=` query consumed by AuthErrorCard.
- Per task brief: `tests/e2e/coverage/auth-route-handlers.spec.ts` AUTH-RH-1~5 PASSED this session — taken on trust because the JSON variant is missing.
- Gap: `buildErrorUrl(..., null)` discards any Supabase Retry-After value — see X-11 follow-up #5.

### `/auth/callback-fragment` (Page, AUTH-RH-6)

- File: `src/app/auth/callback-fragment/page.tsx` + `src/components/auth/CallbackFragmentFallback.tsx` (not read in detail, referenced only).
- Behavior verified via reading: Server Component wraps a client component in `<Suspense>` so window.location.hash parsing can run client-side. `sanitizeNext` applied to `?next=` query before passing to child.
- Per task brief: AUTH-RH-6 PASSED this session.

### `/auth/sign-out` (Route Handler, AUTH-RH-7)

- File: `src/app/auth/sign-out/route.ts`
- Behavior verified via reading:
  - POST: `supabase.auth.signOut()` → `NextResponse.redirect('/login', {status: 303})`. 303 forces POST→GET conversion (correct semantic for redirect-after-action).
  - GET: returns `405 Method Not Allowed` with `Allow: POST` header — CSRF protection (link/img tags can't trigger logout).
  - Errors logged via `console.error` server-side; user is redirected to /login regardless (graceful degradation).
- Per task brief: AUTH-RH-7 PASSED this session.

UX implication for the shard: route handler hygiene is the strongest part of the shard — clean separation of concerns, no raw-error leakage, server-side logging, CSRF-safe sign-out, hardened fragment fallback.

---

## Summary list of `needs-human-judgment` items

All 6 IA in this shard are flagged `needs-human-judgment`. Specific questions for human reviewer:

| IA | Question | Stakes |
| --- | --- | --- |
| X-01 | Do two equal-weight CTAs (가입/로그인) read as one primary action on mobile, or as competing? Does the landing need a header/nav and mascot per wireframe? | Conversion / brand |
| A-01 | Are missing benefit chips + mascot affecting sign-up confidence? Is `가입 실패: {raw}` Korean copy acceptable? | Trust / conversion |
| A-02 | Is description ③ field-length spec (4-80자/8-64자) authoritative, or should description be relaxed to match implementation? Is '3회 실패 잠금' client-side or server-side? | Spec alignment |
| X-06 | Is a Steps indicator (wireframe ②) mandatory for a two-screen reset flow? Does confirm side need '링크 재발송'? | Onboarding clarity |
| X-11 | Is 60s default countdown sufficient vs. forwarding Supabase Retry-After? Should a help-link be added next to '홈으로'? | Rate-limit UX |
| X-12 | Should resend failure get REASON_CONTENT treatment like /auth/error? Add '받은편지함 열기' shortcut? | Email verification completion |

Cross-cutting:
- Raw provider error text leaks via toast in 5 of 6 IA forms. Single recommended pattern: REASON_CONTENT mapping (already exists at `src/lib/auth/error-mapping.ts`) extended to cover signup/login/reset error codes. This is the single highest-leverage P0 in the shard.

---

## Top 3 risks (for main session integration)

1. **Raw Supabase error text reaches users via toasts in 5 forms (SignUpForm, LoginForm × 2 modes, PasswordResetRequestForm, PasswordResetConfirmForm, VerifyEmailCard non-rate-limit branch).** Checklist §6.9 + §9 violation, but soft (toast text, not card). Recommended fix: reuse REASON_CONTENT pattern from `/auth/error`. **P0.**
2. **Browser, hosted-surface, and security-navigation evidence lanes are PARTIAL/BLOCKED** for the entire shard. Cannot mechanically prove keyboard focus, responsive 320–360 no horizontal scroll, or session-expired navigation. Cold-build re-run is required before any IA can move PARTIAL → PASS. **P0.**
3. **Multiple description.md ↔ implementation drifts** beyond the already-logged A-01/X-06 PW max(64): displayName length (A-01), email/password length (A-02), Steps indicator (X-06), resend cooldown on /password-reset (X-06), Retry-After forwarding (/auth/callback → X-11). Decision needed: tighten implementation OR relax description. **P1.**

---

## Confirmation

Two result files were written inside `reports/ia-verification/runs/20260528-141731/agent-packets/results/`:

- `20260528-141731-public-auth-result.md` (this file)
- `20260528-141731-public-auth-cards.json` (machine-readable cards array)

No files outside `exactWriteScope` were modified.
