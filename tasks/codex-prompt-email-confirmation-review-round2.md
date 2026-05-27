# Cross-Model Review · Round 2
# Email Confirmation Policy Report — Response to Round 1

You are continuing the cross-model review with Opus 4.7 (report author). Round 1 verdict was CONCERN.

## Author's response to Round 1 (read carefully)

Below is Opus 4.7's position on each Round 1 finding. Decide if you ACCEPT each resolution, PARTIALLY accept, or DISPUTE.

### Factual findings — author's position

- **F1 (Supabase 24h token = FAIL).** ACCEPTED. Report wording will change to: "Confirmation/OTP token default = 1 hour, configurable up to 24 hours maximum (`auth.email.otp_expiry`)." Source: Supabase docs CLI config + auth-email-passwordless.
- **F2 (#14994 still-true claim = CONCERN).** PARTIALLY ACCEPTED. Report will change "Still unfixed" → "Discussion #14994 remains open as of 2026-05; no public fix announcement located. Behavior should be re-tested before relying on this risk vector."
- **F3 (Auth0 5d = PASS).** No change.
- **F4 (Firebase phrasing = CONCERN).** ACCEPTED. Report will change "공식 권장: Admin SDK + 주기적 cleanup" → "Admin SDK는 정리에 필요한 primitives (list/metadata/delete) 제공. 정리 정책은 앱이 직접 정의."
- **F5 (OWASP 24h phrasing = CONCERN).** ACCEPTED. Report will drop the explicit "OWASP가 24h 권고" wording → "OWASP은 토큰을 단기·일회용으로 만료할 것을 권고 (구체 시간은 명시 X). 24h는 업계 통용치." Pre-account takeover risk class retained — OWASP documents account-takeover patterns.

### SQL findings — author's position (P0 verification result)

- **S6a (retention_days > 0 guard + make_interval).** ACCEPTED. Will use `make_interval(days => greatest(retention_days, 1))`.
- **S6b (SECURITY DEFINER privilege).** ACCEPTED. Will add explicit `revoke all ... from public, anon, authenticated` and grant only to `postgres` (which pg_cron uses by default in Supabase).
- **S7 (audit_logs P0).** **CONFIRMED by direct DB inspection.** Remote schema (verified just now):

  ```
  admin_audit_logs columns:
    id            uuid NOT NULL DEFAULT gen_random_uuid()
    admin_user_id uuid NOT NULL  (FK → public.profiles(id) ON DELETE RESTRICT)
    action        text NOT NULL
    target_table  text NOT NULL
    target_id     text NOT NULL
    diff          jsonb (nullable)
    payload       jsonb (nullable)
    created_at    timestamptz NOT NULL DEFAULT now()
  ```

  Report's SQL columns (`target_type`, `occurred_at`) are wrong; `admin_user_id = NULL` would violate NOT NULL + FK.

  **Author's proposed resolution: drop the `admin_audit_logs` insert entirely.** Rationale: `pg_cron` already records every run in `cron.job_run_details` with `start_time`, `end_time`, `status`, `return_message`. Adding a second audit row for system-initiated cleanup duplicates state and forces us to invent a synthetic actor or change schema. Operational visibility is preserved via `cron.job_run_details`. The function will instead `RAISE LOG` the deleted count, which Supabase ships to logs.

  Do you agree with dropping the audit insert, or do you require an alternative (system actor profile / schema change)?

- **S8a (pg_cron extension syntax).** ACCEPTED. Will use Supabase's documented pattern: enable via Dashboard, then `create extension if not exists pg_cron;` (no explicit schema clause).
- **S8b (UTC/KST wording).** ACCEPTED. Will write "04:00 UTC / 13:00 KST" explicitly.
- **S8c (post-resume verification).** ACCEPTED. Will add verification query: `select * from cron.job where jobname = 'cleanup-unconfirmed-users';` to post-deployment checklist.
- **S8d (idempotent scheduling).** ACCEPTED. Will use:

  ```sql
  select cron.unschedule('cleanup-unconfirmed-users') where exists
    (select 1 from cron.job where jobname = 'cleanup-unconfirmed-users');
  select cron.schedule('cleanup-unconfirmed-users', '0 4 * * *', $$ select public.cleanup_unconfirmed_users(30) $$);
  ```

- **S9 (FK CASCADE).** **CONFIRMED by direct DB inspection.** `profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE` already exists on remote. Report will reframe as **invariant**: "FK ON DELETE CASCADE is required and confirmed present in current schema (verified 2026-05-26)."

### Recommendation findings — author's position

- **R10 (30-day anchor).** ACCEPTED. Will reframe as "Product UX grace period choice, not industry default. Anchored to: (a) Supabase/Auth0 token windows are far shorter (1h-5d), (b) Learning app: a user who hasn't confirmed within a month is functionally lost."
- **R11 (31-day return UX).** ACCEPTED. Will add explicit subsection:
  - Old link → expired (24h ago)
  - Old account → deleted (cron ran)
  - `/sign-up` with same email → succeeds as fresh signup
  - Resend flow → unchanged (only relevant within retention window)
  - Admin visibility → daily Slack/log summary of deletion counts
- **R12 (missing controls).** ACCEPTED with one caveat. Will add to follow-up section:
  - Signup/resend rate limits (already partially handled by Supabase Auth defaults; explicit doc + monitoring)
  - Dry-run mode: `cleanup_unconfirmed_users(retention_days int, dry_run boolean default false)` — returns count without deleting
  - Per-run deletion cap (e.g., `limit 1000` clause) to prevent runaway in a bad scenario
  - Cron failure alerting via `cron.job_run_details` polling (separate ops doc)
  - Audit-log retention itself — separate concern, out of scope here
  - **Caveat**: "RLS hardening so profile existence never grants unconfirmed users access" — Author wants Codex's specific RLS attack scenario. Current RLS: profiles row visible only to its own `auth.uid()`. Author argues an unconfirmed user holding a valid JWT can already see/edit their own profile, which is intentional UX (let them complete profile before confirming). What specific access vector does Codex believe needs blocking?

## Updated SQL (combining all accepted findings)

```sql
-- supabase/migrations/2026XXXXxxxxxx_cleanup_unconfirmed_users.sql

create or replace function public.cleanup_unconfirmed_users(
  retention_days int default 30,
  dry_run boolean default false,
  max_batch int default 1000
)
returns int
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  victim_ids uuid[];
  deleted_count int;
begin
  if retention_days < 1 then
    raise exception 'retention_days must be >= 1';
  end if;

  select array_agg(id) into victim_ids
  from (
    select id from auth.users
    where email_confirmed_at is null
      and created_at < now() - make_interval(days => retention_days)
      and is_sso_user = false
    order by created_at
    limit max_batch
  ) sub;

  deleted_count := coalesce(array_length(victim_ids, 1), 0);

  if dry_run then
    raise log 'cleanup_unconfirmed_users dry_run: would delete % users older than % days', deleted_count, retention_days;
    return deleted_count;
  end if;

  if deleted_count > 0 then
    delete from auth.users where id = any(victim_ids);
    -- public.profiles auto-removed via FK ON DELETE CASCADE (verified invariant)
    raise log 'cleanup_unconfirmed_users: deleted % users older than % days', deleted_count, retention_days;
  end if;

  return deleted_count;
end;
$$;

revoke all on function public.cleanup_unconfirmed_users(int, boolean, int) from public, anon, authenticated;
comment on function public.cleanup_unconfirmed_users(int, boolean, int) is
  'Delete unconfirmed users older than N days (default 30). SECURITY DEFINER. dry_run=true returns count without deleting. max_batch caps per-call deletes.';
```

Cron setup (separate migration block or dashboard):

```sql
create extension if not exists pg_cron;

select cron.unschedule('cleanup-unconfirmed-users')
where exists (select 1 from cron.job where jobname = 'cleanup-unconfirmed-users');

select cron.schedule(
  'cleanup-unconfirmed-users',
  '0 4 * * *',  -- 04:00 UTC / 13:00 KST
  $$ select public.cleanup_unconfirmed_users(30) $$
);
```

## Your task (Round 2)

For each numbered finding above, answer:
- ACCEPTED RESOLUTION / NEEDS REVISION / REJECTED
- One-line reason

Then state whether the new SQL is mergeable.

Open question for you to answer (from R12 caveat):
- What specific RLS attack vector should we block for unconfirmed users that the current "self-row only" policy does not already cover? Provide a concrete scenario or withdraw the finding.

## Output format

```
VERDICT: PASS | CONCERN | FAIL

ROUND 1 RESOLUTION:
| ID | Status | Note |
| F1 | ACCEPTED | ... |
...

NEW SQL ASSESSMENT:
- mergeable: YES / NO
- blockers (if NO): ...

R12 RLS QUESTION ANSWER:
- specific vector OR "withdrawn"

NEW FINDINGS (if any):
- ...

OVERALL:
- One paragraph: are we converging to consensus or do material disputes remain?
```
