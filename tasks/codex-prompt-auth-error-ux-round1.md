# Cross-Model Review · Round 1
# Auth Error / Callback Pages — UX/UI Proposal

You are GPT 5.5 acting as senior reviewer on a UX/UI proposal authored by Opus 4.7. The proposal is a follow-up to the email confirmation policy (see `reports/email-confirmation-policy-research-20260526.html`, already PASS) and will be integrated into that same HTML as a new section.

## Background

Live state of the codebase (verified 2026-05-26):
- Next.js 16 App Router + Supabase Auth (publishable + service_role keys, PKCE-ready).
- Existing routes: `/`, `/sign-up`, `/login`, `/password-reset`, `/password-reset/confirm`, `(workspace)/...` (post-auth).
- **No `/auth/callback` Route Handler.** **No `/auth/error` (or any error route) page.** Grep across `src/app` for `expired|invalid.token|otp_expired|access_denied|error_code|error_description` returns ZERO matches.
- `docs/flow/user-flow.md` does not mention `/auth/callback`, expired/invalid token UX, or any error scenarios for the email confirmation flow.
- The recently-agreed 30-day cleanup policy (rev2 of the report) WILL increase frequency of `otp_expired` / `user_not_found` callback responses because old accounts get deleted.

## Opus 4.7's proposal (the thing you are reviewing)

### Pattern: single error page + reason query

| Route | Type | Role | Priority |
| --- | --- | --- | --- |
| `/auth/callback` | Route Handler (`route.ts`) | Token-hash exchange via `supabase.auth.exchangeCodeForSession`. Success → `/dashboard`. Failure → `/auth/error?reason=...&error_description=...` | P0 |
| `/auth/error` | Page | Reads `reason` query, renders matching card + CTA | P0 |
| `/auth/verify-email` | Page | Post-signup "check your inbox" landing + resend button (with cooldown) | P1 |
| `/auth/confirmed` | Page (optional) | Success welcome, otherwise just redirect to `/dashboard` | P2 |

### Reason → message + CTA matrix (proposed)

| reason | Message (Korean, vibe-coder tone) | Primary CTA |
| --- | --- | --- |
| `otp_expired` | "인증 링크가 만료됐어요 (24시간 후 만료). 메일을 다시 받으시려면 아래 버튼을 눌러주세요." | "인증 메일 다시 받기" → POST to resend endpoint |
| `invalid_token` | "유효하지 않은 링크예요. 링크가 잘못 복사됐거나 이미 사용됐을 수 있어요." | "로그인하기" / "다시 가입하기" (secondary) |
| `access_denied` | "인증을 거부하셨어요. 다시 시도하시려면 가입 페이지로 가세요." | "가입 페이지로" → `/sign-up` |
| `email_change_failed` | "이메일 변경 링크가 만료됐어요. 설정 페이지에서 다시 시도해주세요." | "설정으로" → `/profile` |
| `unknown` | "처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." | "홈으로" → `/` |

### Resend cooldown (newly added based on research)

- 30-second client-side cooldown on the resend button after click.
- After 3 attempts within 1 hour: server-side rate limit returns `Retry-After: 3600`; UI shows "잠시 후 다시 시도해주세요" with countdown.

### Cleanup policy synergy

Once 30-day cleanup runs, users who click old confirmation links get `otp_expired` or implicit `user_not_found`. The `/auth/error` page makes this graceful with a "다시 가입하기" CTA. Without these pages, the cleanup policy's UX is broken on the recovery edge.

### Docs gaps to fill alongside (not code, just docs)

- `docs/IA/<new-folder>/description.md` for `/auth/callback`, `/auth/error`, `/auth/verify-email`.
- `docs/flow/user-flow.md` add expired/invalid scenarios + resend cooldown rule.
- `docs/spec.md` reference + IA index update.

## External research summary (already done by Opus, here for your fact-check)

- **Supabase Next.js best practice**: PKCE flow + `@supabase/ssr` + `export const dynamic = 'force-dynamic'` on auth-sensitive routes. Prevent prefetch on callback. Race condition risk if multiple layouts use server client.
  Source: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- **Supabase error codes** (signup/OTP/refresh) documented at: https://supabase.com/docs/guides/auth/debugging/error-codes
- **General UX guidance**: never lock user in error without escape route (resend / login / signup). Pre-fill email if known.
  Sources: https://www.authgear.com/post/login-signup-ux-guide/ , https://www.learnui.design/blog/tips-signup-login-ux.html
- **Resend cooldown standard**: Keycloak 30s default; rate-limit via 429 + `Retry-After`. Common ceiling 3 attempts/hour.
  Sources: https://github.com/idNoRD/keycloak-spi-limit-resend-email , https://laracasts.com/discuss/channels/laravel/how-to-add-rate-limit-to-resend-verification-email-on-page-emailverify-for-laravel-jetstream
- **Expired email UX pattern**: clear message + CTA to request new link. 24h expiry common.
  Source: https://supertokens.medium.com/implementing-the-right-email-verification-flow-bba9283e1d63

## Your task (Round 1)

Verify and challenge:

### A. Pattern correctness
1. Single `/auth/error` + reason vs separate routes — is the recommendation appropriate for our small route surface? Any reason to split?
2. Is `/auth/callback` correctly typed as Route Handler (not a Page)? Supabase PKCE flow + `@supabase/ssr` confirmation.

### B. Route catalog completeness
3. Are there other auth pages we're missing? Specifically:
   - `/auth/verify-email` — needed? Or is it enough to show a success Modal on `/sign-up`?
   - `/auth/sign-out` — needed as a server-side handler?
   - Magic link login flow (passwordless) — covered? Phase 7-B's `/login` has Segmented(password/magic-link).
   - OAuth callbacks (Google/Kakao) — same `/auth/callback` or separate?
   - In-app session expired (JWT expired during use) — middleware handles, but does it need a friendly redirect target like `/login?reason=session_expired`?

### C. Reason classification completeness
4. Beyond the 5 reasons proposed (`otp_expired`, `invalid_token`, `access_denied`, `email_change_failed`, `unknown`), are there Supabase-specific error_codes we should explicitly handle? Reference: https://supabase.com/docs/guides/auth/debugging/error-codes . Specifically — what about `signup_disabled`, `user_already_exists`, `over_email_send_rate_limit`?

### D. UX correctness
5. Message tone — does "바이브 코더" tone fit user-facing app users (the actual end users, not Claude users)? Should it be more neutral?
6. CTA priority — for `invalid_token`, is "로그인하기" the right primary CTA, or should it be "다시 가입하기"?
7. Pre-fill email — should `/auth/error?reason=otp_expired` accept an `email` query and pre-fill the resend form?

### E. Cleanup policy synergy
8. When the 30-day cleanup deletes a user and they click the old link, Supabase will return `otp_expired` (token still valid by time, but user gone) — OR will it return `user_not_found` / different code? Without testing, can we trust the `otp_expired` mapping?

### F. Resend cooldown
9. Is client-side 30s cooldown sufficient, or do we need server-side enforcement too? Supabase itself enforces some limits — what are they?
10. Should the resend CTA on `/auth/error?reason=otp_expired` require the user to type their email (anti-abuse) or accept it from query if present?

### G. Docs gap
11. Is the proposed docs update path correct given project rules in `CLAUDE.md`? Should this need office-hours + docs proposal before code, or is it a lightweight extension?

## Output format

```
VERDICT: PASS | CONCERN | FAIL

PATTERN FINDINGS:
| # | Issue | Severity | Recommended fix |

ROUTE CATALOG FINDINGS:
| # | Missing/Wrong | Severity | Note |

REASON CLASSIFICATION FINDINGS:
| # | Concern | Severity | Note |

UX FINDINGS:
| # | Concern | Severity | Note |

CLEANUP-SYNERGY FINDINGS:
| # | Concern | Severity | Note |

RESEND COOLDOWN FINDINGS:
| # | Concern | Severity | Note |

DOCS-PROCESS FINDINGS:
| # | Concern | Severity | Note |

NEW FINDINGS (not in proposal):
- ...

OVERALL:
- One paragraph: is the proposal ready to integrate into the HTML report, or what must change?
```

Constraints:
- Cite URLs only when verified. Severity P0/P1/P2 same as before.
- Do NOT write code beyond 3 lines per finding. Flag-and-describe.
