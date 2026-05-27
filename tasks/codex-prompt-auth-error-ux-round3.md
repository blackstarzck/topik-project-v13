# Cross-Model Review · Round 3
# Auth Error / Callback UX — Resolving Round 2 NEEDS REVISION items

Round 2 verdict: CONCERN. 4 NEEDS REVISION items + 2 NEW FINDINGS. All other findings ACCEPTED. Below are the final wording fixes.

## Round 2 NEEDS REVISION — author resolutions

### F2 (verifyOtp `type` values)

ACCEPTED. The callback Route Handler dispatches by Supabase-documented `type` values, not invented ones. Final mapping:

| Incoming URL params | Supabase call | Supabase docs `type` value |
| --- | --- | --- |
| `token_hash=...&type=signup` | `supabase.auth.verifyOtp({ type: 'signup', token_hash })` | `signup` |
| `token_hash=...&type=recovery` | `verifyOtp({ type: 'recovery', token_hash })` | `recovery` |
| `token_hash=...&type=email_change` | `verifyOtp({ type: 'email_change', token_hash })` | `email_change` |
| `token_hash=...&type=email` (PKCE magic link) | `verifyOtp({ type: 'email', token_hash })` | `email` |
| `code=...` (PKCE OAuth / SSR PKCE) | `exchangeCodeForSession(code)` | — |

The report's table will be updated with these exact `type` values. Source: https://supabase.com/docs/guides/auth/auth-email-passwordless and https://supabase.com/docs/guides/auth/server-side/advanced-guide

### C1 (`access_denied` source labeling)

ACCEPTED. `access_denied` is NOT in Supabase's published `error.code` list — it comes from:
- OAuth provider callback denial (e.g. Google "Cancel"), surfaced via URL fragment `#error=access_denied&error_code=access_denied`
- Currently out of phase (no OAuth wired up yet)

Final treatment in the reason table:
- `access_denied` row labeled **"(OAuth provider 거부 — 현 phase 외, OAuth 도입 시 활성)"**.
- The current callback handler treats unknown `error_code` values as `reason=unknown`. `access_denied` becomes active only when OAuth providers are added later.

### C4 (Retry-After propagation)

ACCEPTED. Supabase's `Retry-After` header reaches `/auth/callback` Route Handler only; a redirect drops it. Resolution: Route Handler forwards the seconds value as a query param.

Contract:
```
on rate-limit error:
  retryAfter = response.headers.get('retry-after') ?? null
  redirect to /auth/error?reason=over_email_send_rate_limit&retry_after_seconds=<number-or-omitted>
```

`/auth/error` page reads `retry_after_seconds`:
- If present (1..86400): show countdown timer; disable CTA until expired.
- If absent: show fallback message "잠시 후 다시 시도해주세요" with a generic 60s countdown (matching Supabase same-user OTP window).

### D2 (Supabase rate-limit full citation)

ACCEPTED. Report wording will cite the full Supabase rate-limit table, not only "30/hour":

> Supabase 기본 인증 한도 (2026-05 기준, 출처: https://supabase.com/docs/guides/auth/rate-limits)
> - OTP / Magic link (`/auth/v1/otp`): 같은 사용자에게 **60초 이내 재요청 불가**, 프로젝트 전체 **시간당 30회**.
> - Email send (signup confirm / recover / email-change) 빌트인 SMTP 사용 시: **시간당 2회**. 커스텀 SMTP 사용 시 더 높음.
> - 일반 요청 endpoint: `over_request_rate_limit` 트리거 가능 (수치는 endpoint별 가변).

MVP 단계에서는 앱 레벨 추가 limiter 없이 위 한도에 의존. 한계 도달 시 `/auth/error?reason=over_email_send_rate_limit` 또는 `over_request_rate_limit`로 우아하게 안내.

## Round 2 NEW FINDINGS — author resolutions

### NEW-1 (`token_hash` type tightening)

ACCEPTED. Resolved by F2 above — the `type` mapping table now uses exact Supabase values, including `type=email` for PKCE magic link.

### NEW-2 (`access_denied` separate source)

ACCEPTED. Resolved by C1 above — `access_denied` is documented as OAuth-fragment-origin, not Supabase `error.code`.

## Final reason table (revised — same 11 reasons, just C1 + C4 wording tightened)

| `reason` | Source | Korean message (warm, plain) | Primary CTA | Notes |
| --- | --- | --- | --- | --- |
| `otp_expired` | Supabase `error.code` | "인증 링크가 만료됐어요. 이메일을 다시 입력하면 새 메일을 보내드릴게요." | 이메일 입력 → 인증 메일 재전송 (60s cooldown) | |
| `flow_state_expired` | Supabase `error.code` | "인증 절차가 만료됐어요. 처음부터 다시 시도해주세요." | 다시 시도하기 | |
| `flow_state_not_found` | Supabase `error.code` | "인증 요청을 찾을 수 없어요. 다른 기기/브라우저에서 시작한 링크일 수 있어요." | 다시 시도하기 | |
| `bad_code_verifier` | Supabase `error.code` | "보안 검증에 실패했어요. 같은 브라우저에서 끝까지 진행해주세요." | 처음부터 다시 | |
| `user_not_found` | Supabase `error.code` | "이 계정은 더 이상 존재하지 않아요. 다시 가입하시면 됩니다." | **다시 가입하기** | cleanup-deleted user 경로 |
| `over_email_send_rate_limit` | Supabase `error.code` | "메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요." | (Retry-After countdown) | retry_after_seconds query 활용 |
| `over_request_rate_limit` | Supabase `error.code` | "요청이 너무 많아요. 잠시 기다려주세요." | (Retry-After countdown) | retry_after_seconds query 활용 |
| `email_not_confirmed` | Supabase `error.code` | "이메일 인증이 아직 완료되지 않았어요. 받은편지함을 확인해주세요." | 인증 메일 재전송 | |
| `signup_disabled` | Supabase `error.code` | "현재 신규 가입이 일시 중단됐어요." | 홈으로 | |
| `access_denied` | OAuth fragment (현 phase 외) | "인증이 거부됐어요." | 다시 시도 | OAuth 도입 시 활성 |
| `unknown` | catchall | "처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." | 홈으로 | raw error_description은 서버 로그에만 |

## Your task (Round 3)

For each Round 2 NEEDS REVISION (F2 / C1 / C4 / D2) and NEW (NEW-1 / NEW-2), state ACCEPTED RESOLUTION / NEEDS FURTHER REVISION / REJECTED.

Then state whether the revised proposal is mergeable into the HTML report.

## Output format

```
VERDICT: PASS | CONCERN | FAIL

ROUND 2 NEEDS REVISION RESOLUTION:
| ID | Status | Note |
| F2 | ... |
| C1 | ... |
| C4 | ... |
| D2 | ... |
| NEW-1 | ... |
| NEW-2 | ... |

REVISED PROPOSAL ASSESSMENT:
- mergeable to HTML report: YES / NO
- blockers: ...

NEW FINDINGS (if any):
- ...

OVERALL:
- One paragraph.
```
