# Cross-Model Review · Round 1
# Email Confirmation Policy Research Report (2026-05-26)

You are a senior reviewer (GPT 5.5) performing an independent fact-check + critique of a research report authored by Opus 4.7.

## Source of truth

Read the report at: `reports/email-confirmation-policy-research-20260526.html`

## Project context

- Stack: Next.js 16 + Supabase (Postgres + Auth).
- Current state on remote Supabase (`fglggyfvzjdsbyckinqa.supabase.co`):
  - 22 migrations applied incl. `20260521120000_auth_user_profile_bootstrap.sql` (trigger `on_auth_user_created` AFTER INSERT on auth.users → public.profiles).
  - `public.profiles.id` references `auth.users.id` (FK CASCADE status to be verified — report claims this needs checking).
  - `public.admin_audit_logs` schema uses `admin_user_id`, `action`, `target_type`, `payload`, `occurred_at` columns (confirmed in earlier audit phase).
- Live test confirmed: trigger fires immediately on INSERT regardless of `email_confirmed_at`. So profile rows are created at signup time, BEFORE email confirmation.
- Question that triggered the report: should we keep unconfirmed users indefinitely or clean them up?

## Your task

Fact-check the report against these specific claims, and critique the recommendation + SQL implementation.

### A. Factual claims to verify

1. **Supabase signup confirmation token default expiry = 24 hours.** Is this correct per current Supabase docs (May 2026)?
2. **Supabase known bug**: re-signup with same email + different password does NOT update the password while email is unconfirmed (referenced Discussion #14994). Still true / unfixed as of May 2026?
3. **Auth0 verification link default = 5 days.** Correct?
4. **Firebase Auth recommended path = Admin SDK + periodic cleanup.** Correct characterization?
5. **OWASP guidance**: email verification tokens should expire within 24 hours; pre-account takeover is a documented risk class. Correct?

### B. SQL / implementation correctness

6. The `cleanup_unconfirmed_users(retention_days int)` function:
   - Does the WHERE clause correctly target unconfirmed users older than N days?
   - Is `is_sso_user = false` filter appropriate?
   - Will SECURITY DEFINER with locked search_path work safely?
   - Is the interval syntax `(retention_days || ' days')::interval` safe / correct in plpgsql?

7. The `admin_audit_logs` insert: are column names `admin_user_id`, `action`, `target_type`, `payload`, `occurred_at` correct? Will `admin_user_id = NULL` violate any FK or NOT NULL constraint?

8. The pg_cron schedule:
   - `create extension if not exists pg_cron with schema extensions` — correct for Supabase?
   - Cron expression `'0 4 * * *'` is UTC (not KST). Report claims this = KST 13:00. Correct conversion?
   - Will the schedule survive Supabase project restarts / paused-resume?

9. FK CASCADE behavior on `public.profiles.id → auth.users.id`: report says "verify this". Should the report be more prescriptive about WHICH state to expect, given Supabase scaffold defaults?

### C. Recommendation soundness

10. **Default retention = 30 days**: justified vs alternatives (7d, 90d)? Any industry data point to anchor?
11. **Trade-off discussion**: does the report adequately cover the "user comes back after 31 days" failure mode?
12. **Missing controls?** Anything material the report omitted (e.g., rate limiting signup, RLS hardening for unconfirmed users, audit log retention)?

## Output format

Respond in the format below. Do not write any other prose outside this block.

```
VERDICT: PASS | CONCERN | FAIL

FACTUAL FINDINGS:
| # | Claim | Verdict | Evidence / correction |
| 1 | Supabase 24h token | ... | ... |
| 2 | ...

SQL FINDINGS:
| # | Issue | Severity (P0/P1/P2) | Recommended fix |
| 6 | ...

RECOMMENDATION FINDINGS:
| # | Concern | Severity | Note |

NEW FINDINGS (not in report):
- ...

OVERALL:
- One paragraph: is the report ready to act on, or what must change?
```

Constraints:
- Cite specific URLs only when you can verify them. If uncertain, say "uncertain" in evidence.
- Severity P0 = must fix before merging; P1 = should fix this iteration; P2 = nice-to-have.
- Do not write code patches longer than 3 lines in this round — flag and describe instead.
