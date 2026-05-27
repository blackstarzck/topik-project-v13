# Cross-Model Review · Round 2
# Auth Error / Callback Pages — Response to Round 1

Continuing review with Opus 4.7. Round 1 verdict: CONCERN with multiple P0 items. Opus accepts most findings; below is the revised proposal. Decide ACCEPTED / NEEDS REVISION / REJECTED for each, and whether the revised proposal is ready to integrate into the HTML report.

## Author response to each Round 1 finding

### Pattern findings

- **P1 (F1) Single page pattern.** ACCEPTED. Keep single `/auth/error?reason=...`.
- **P2 (F2) Callback contract.** ACCEPTED — critical fix. `/auth/callback` Route Handler must dispatch by URL params:
  - `token_hash` + `type` (email confirm, recovery, email_change, magiclink) → `supabase.auth.verifyOtp({ token_hash, type })`
  - `code` (PKCE / OAuth) → `supabase.auth.exchangeCodeForSession(code)`
  - Both share the same route; success goes to validated `next` else `/dashboard`; failure goes to `/auth/error?reason=<supabase_error_code>`.
- **P3 (F3) Route Handler type.** ACCEPTED. `src/app/auth/callback/route.ts`, no UI.
- **P4 (F4) Cache safety.** ACCEPTED. Document `export const dynamic = 'force-dynamic'` for `/auth/error` and `/auth/verify-email`; rely on `@supabase/ssr` cookie cache headers on the Route Handler.

### Route catalog findings

- **R1 (P1) `/auth/verify-email` route value.** ACCEPTED-P1. Keep proposed P1. Reason: deep-linkable post-signup state + reload survival + central resend control.
- **R2 (P0) Magic link redirect.** ACCEPTED. `LoginForm` magic-link `emailRedirectTo` must be `${origin}/auth/callback?next=/dashboard`. Same for `SignUpForm`. This is a follow-up code change explicitly noted in the report; current state breaks if we add callback routing without updating these.
- **R3 (P1) `/auth/sign-out`.** ACCEPTED. Add to catalog as POST Route Handler (server-side cookie clear). Out of this report's primary scope but listed in follow-ups.
- **R4 (P2) OAuth share callback.** ACCEPTED. Mark as future scope (Google/Kakao not in current phase). Same route works.
- **R5 (P1) Session expiry redirect.** ACCEPTED. Middleware redirects expired-JWT cases to `/login?reason=session_expired`. `/login` reads this query and shows friendly inline notice.

### Reason classification — expanded to 11 reasons

- **C1 (P0) 5 reasons too thin.** ACCEPTED. Final reason map (mapping from Supabase `error.code` to UX message):

  | `reason` (URL slug) | Source Supabase code | Korean message (warm, plain) | Primary CTA | Secondary |
  | --- | --- | --- | --- | --- |
  | `otp_expired` | `otp_expired` | "인증 링크가 만료됐어요. 이메일을 다시 입력하면 새 메일을 보내드릴게요." | 이메일 입력 → 인증 메일 재전송 | 로그인하기 |
  | `flow_state_expired` | `flow_state_expired` | "인증 절차가 만료됐어요. 처음부터 다시 시도해주세요." | 다시 시도하기 | 로그인하기 |
  | `flow_state_not_found` | `flow_state_not_found` | "인증 요청을 찾을 수 없어요. 다른 기기/브라우저에서 시작한 링크일 수 있어요." | 다시 시도하기 | 도움말 |
  | `bad_code_verifier` | `bad_code_verifier` | "보안 검증에 실패했어요. 같은 브라우저에서 끝까지 진행해주세요." | 처음부터 다시 | — |
  | `user_not_found` | `user_not_found` | "이 계정은 더 이상 존재하지 않아요. 다시 가입하시면 됩니다." | **다시 가입하기** | 로그인하기 |
  | `over_email_send_rate_limit` | `over_email_send_rate_limit` | "메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요." (Retry-After 분 표시) | 잠시 후 자동 활성 | — |
  | `over_request_rate_limit` | `over_request_rate_limit` | "요청이 너무 많아요. 잠시 기다려주세요." | 잠시 후 자동 활성 | — |
  | `email_not_confirmed` | `email_not_confirmed` | "이메일 인증이 아직 완료되지 않았어요. 받은편지함을 확인해주세요." | 인증 메일 재전송 | — |
  | `access_denied` | `access_denied` | "인증이 거부됐어요. 다시 시도해주세요." | 다시 가입하기 | — |
  | `signup_disabled` | `signup_disabled` | "현재 신규 가입이 일시 중단됐어요. 잠시 후 다시 시도해주세요." | 홈으로 | — |
  | `unknown` | (catchall) | "처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." | 홈으로 | 도움말 |

- **C2 (P1) signup-form errors.** ACCEPTED. `user_already_exists`/`email_exists` stay inline on `/sign-up` form (do NOT redirect to `/auth/error`). Document the split rule.
- **C3 (P1) `email_change_failed` invented label.** ACCEPTED. Replaced — email-change failures map via Supabase official codes above. No new invented label.
- **C4 (P0) Rate-limit explicit UI.** ACCEPTED. `over_email_send_rate_limit` and `over_request_rate_limit` rows above include disabled CTA + Retry-After countdown.

### UX findings

- **U1 (P1) Tone change.** ACCEPTED. Removed "바이브 코더" framing for end-user copy. All messages above use warm, plain Korean. The "바이브 코더" rule remains for our internal reports/docs only.
- **U2 (P1) `invalid_token` CTA.** RESOLVED by removing the `invalid_token` umbrella and mapping to specific codes (`otp_expired`, `flow_state_expired`, `bad_code_verifier`, `user_not_found`), each with appropriate primary CTA.
- **U3 (P1) Email prefill untrusted.** ACCEPTED. `email` query param only pre-fills a visible editable input. No auto-resend.
- **U4 (P1) Hide raw error_description.** ACCEPTED. `/auth/callback` logs raw `error_description` server-side and forwards only the canonical `reason` slug to `/auth/error`.

### Cleanup-synergy findings

- **S1 (P0) deleted user → maybe `user_not_found`.** ACCEPTED. Both `otp_expired` and `user_not_found` paths exist in the table.
- **S2 (P0) deleted user CTA.** ACCEPTED. `user_not_found` primary CTA = **"다시 가입하기"**.
- **S3 (P1) live test deferral.** ACCEPTED as **explicit follow-up before code lands**: create unconfirmed user → run cleanup manually → click old link → record actual Supabase code → confirm reason map.

### Resend cooldown findings

- **D1 (P0) 30s client cooldown vs Supabase 60s default.** ACCEPTED. UI cooldown raised to **60s** matching `auth.email.send_interval` Supabase default.
- **D2 (P0) Server enforcement.** ACCEPTED. Server side relies on Supabase's own rate-limits (30 OTP/hour project-wide cap on free tier per https://supabase.com/docs/guides/auth/rate-limits) plus our `/auth/error?reason=over_email_send_rate_limit` mapping. Our app does NOT add a custom additional rate limit in this iteration — Supabase's caps are sufficient for an MVP-stage learning service. Acceptable?
- **D3 (P1) Product cap 3/hour vs Supabase 30/hour.** ACCEPTED. Dropped the "3 attempts/hour" product cap from the proposal; rely on Supabase's 30/hour. Documented which cap applies.
- **D4 (P1) Visible email input.** ACCEPTED. Resend always requires the visible email input to submit (no fire-and-forget from URL query).

### Docs-process findings

- **G1 (P0) Add `docs/sitemap.md`.** ACCEPTED. Doc update path now: `docs/sitemap.md` + `docs/IA/README.md` + `docs/IA/<new-folders>/description.md` + `docs/flow/user-flow.md`. Office-hours not required (narrow auth recovery edge, not product pivot).
- **G2 (P1) Code only after docs.** ACCEPTED. Report integration ≠ implementation. Implementation requires docs update or approved implementation brief first.
- **G3 (P2) Office-hours not required.** ACCEPTED. Lightweight docs update path.

### NEW findings from Round 1

- **N1 (P1) `SignUpForm` resend no cooldown.** ACCEPTED. Cooldown UI to add when implementation phase starts (60s, then Retry-After-driven for 429).
- **N2 (P1) `LoginForm` magic-link redirect.** ACCEPTED — same as R2 above.
- **N3 (P0) `PUBLIC_PATHS` middleware.** ACCEPTED. `/auth/callback`, `/auth/error`, `/auth/verify-email` to be added to public path allowlist. Without this, middleware bounces anonymous users to `/login` and the callback exchange never runs.
- **N4 (P1) `next` open redirect protection.** ACCEPTED. Validate `next` is relative (starts with `/`, no scheme, no `//`).
- **N5 (P2) Workflow checker workaround.** Noted for separate workflow task. Not blocking this review.

## Revised route catalog (final)

| Route | Type | Role | Priority |
| --- | --- | --- | --- |
| `src/app/auth/callback/route.ts` | Route Handler | Dispatch token_hash → verifyOtp, code → exchangeCodeForSession. Validate `next` (relative only). On success redirect to `next` or `/dashboard`. On failure redirect to `/auth/error?reason=<canonical>` with raw error_description logged server-side only. Add `dynamic = 'force-dynamic'`. | P0 |
| `src/app/auth/error/page.tsx` | Page | Read `reason` query, map to message + CTA from the 11-reason table. Optional `email` query for editable prefill on `otp_expired` / `email_not_confirmed`. Honor `Retry-After` for rate-limit reasons. | P0 |
| `src/app/auth/verify-email/page.tsx` | Page | Post-signup "check inbox" + resend button with 60s cooldown. Reads `email` from session/query for display. | P1 |
| `src/app/auth/sign-out/route.ts` | Route Handler (POST) | Server-side session cookie clear. Out of primary scope but cataloged. | P2 |
| (Middleware update) | n/a | `PUBLIC_PATHS` allowlist += `/auth/*`. `/login` reads `?reason=session_expired` for friendly notice. | P0 |
| (LoginForm + SignUpForm magic-link `emailRedirectTo`) | n/a | Change to `${origin}/auth/callback?next=/dashboard`. | P0 |

## Your task (Round 2)

For each finding above, mark ACCEPTED / NEEDS REVISION / REJECTED with one-line reason.

Then answer:
- Is the revised proposal mergeable into the HTML report as a new section?
- Open question: D2 — is it acceptable to rely only on Supabase native rate-limits for MVP, with no app-level extra layer?

## Output format

```
VERDICT: PASS | CONCERN | FAIL

ROUND 1 RESOLUTION:
| ID | Status | Note |

REVISED PROPOSAL ASSESSMENT:
- mergeable to HTML report: YES / NO
- blockers (if NO): ...

D2 QUESTION ANSWER:
- ACCEPTED / NEEDS CUSTOM LAYER
- reason:

NEW FINDINGS (if any):
- ...

OVERALL:
- One paragraph: consensus close, or material disputes?
```
