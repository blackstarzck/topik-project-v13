# Cross-Model Review · Round 3
# Email Confirmation Policy Report — Resolving Round 2 SQL blockers

You are continuing the cross-model review with Opus 4.7 (report author). Round 2 verdict was CONCERN with 3 NEW FINDINGS (NF1/NF2/NF3). All Round 1 findings were ACCEPTED.

## Author's response to Round 2

### NF1 (move function out of `public` schema). ACCEPTED.

Verified by direct DB inspection (2026-05-26):
- `private` schema already exists in remote DB
- Already used by `private.is_admin()` in storage_policies (line 72-73 of `20260520121300_storage_policies.sql`)

→ New location: `private.cleanup_unconfirmed_users(...)`. cron job calls fully qualified name.

### NF2 (max_batch positive guard). ACCEPTED. Added explicit guard.

### NF3 (Storage ownership blocks deletion). ACCEPTED — with caveat.

Verified by inspecting `20260520121300_storage_policies.sql`:
- `avatars_owner_insert` permits any `authenticated` user to insert into `avatars/{auth.uid()}/...`. **No `email_confirmed_at` check.** So an unconfirmed user with a valid JWT CAN upload avatars during the 30-day retention window.
- `exports_owner_insert` similarly permits authenticated insert, but exports are written by service_role (server-side regeneration), not by users directly. Lower risk but same theoretical path.
- `problem_assets_admin_write` requires `private.is_admin()` — irrelevant to unconfirmed users.

Verified by DB inspection: `storage.objects` has `owner uuid` column.

**Author's chosen resolution: cleanup function deletes Storage objects FIRST, then `auth.users`.**

```sql
delete from storage.objects where owner = any(victim_ids);
delete from auth.users where id = any(victim_ids);
```

This is safer than reordering and resilient to either of two Supabase behaviors:
- Supabase Auth Admin delete API errors when user owns Storage objects
- Direct SQL delete-cascade behavior (still avoids leaving orphan storage rows)

Author proposes a separate **follow-up task (out of this PR scope)**: harden RLS to block storage uploads for unconfirmed users — e.g. add `and (select email_confirmed_at from auth.users where id = auth.uid()) is not null` to `avatars_owner_insert`. Reason for deferring: requires a coordinated migration + test sweep; the cleanup function alone removes the operational risk.

Acceptable to defer that, or do you require it in this PR?

## Final consolidated migration

```sql
-- supabase/migrations/2026XXXXxxxxxx_cleanup_unconfirmed_users.sql
-- =====================================================================
-- TALKPIK AI · Phase 7+ · Unconfirmed user retention policy
-- Deletes auth.users + cascading public.profiles + owned storage.objects
-- where email_confirmed_at IS NULL and created_at older than retention_days.
-- Default 30d. Called daily by pg_cron at 04:00 UTC / 13:00 KST.
-- =====================================================================

create or replace function private.cleanup_unconfirmed_users(
  retention_days int default 30,
  dry_run boolean default false,
  max_batch int default 1000
)
returns int
language plpgsql security definer
set search_path = pg_catalog, public, auth, storage
as $$
declare
  victim_ids uuid[];
  deleted_count int;
begin
  if retention_days < 1 then
    raise exception 'retention_days must be >= 1 (got %)', retention_days;
  end if;
  if max_batch < 1 then
    raise exception 'max_batch must be >= 1 (got %)', max_batch;
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
    raise log 'cleanup_unconfirmed_users dry_run: would delete % users older than % days',
      deleted_count, retention_days;
    return deleted_count;
  end if;

  if deleted_count > 0 then
    -- Storage objects first to avoid Auth delete conflict
    delete from storage.objects where owner = any(victim_ids);

    -- public.profiles auto-removed via FK ON DELETE CASCADE (verified invariant 2026-05-26)
    delete from auth.users where id = any(victim_ids);

    raise log 'cleanup_unconfirmed_users: deleted % users older than % days',
      deleted_count, retention_days;
  end if;

  return deleted_count;
end;
$$;

revoke all on function private.cleanup_unconfirmed_users(int, boolean, int)
  from public, anon, authenticated;

comment on function private.cleanup_unconfirmed_users(int, boolean, int) is
  'Delete unconfirmed auth.users older than N days (default 30) and their owned storage objects. '
  'SECURITY DEFINER with locked search_path. dry_run=true returns count without deleting. '
  'max_batch caps deletes per call. profiles row removed via FK ON DELETE CASCADE.';
```

Cron registration (run once after the migration above is applied):

```sql
create extension if not exists pg_cron;

select cron.unschedule('cleanup-unconfirmed-users')
  where exists (select 1 from cron.job where jobname = 'cleanup-unconfirmed-users');

select cron.schedule(
  'cleanup-unconfirmed-users',
  '0 4 * * *',  -- 04:00 UTC / 13:00 KST
  $$ select private.cleanup_unconfirmed_users(30) $$
);
```

Post-deploy verification:

```sql
-- Verify scheduled
select jobid, jobname, schedule, command, active from cron.job
  where jobname = 'cleanup-unconfirmed-users';

-- Smoke test (dry-run, no mutation)
select private.cleanup_unconfirmed_users(retention_days => 30, dry_run => true);

-- After first scheduled run, inspect history
select start_time, end_time, status, return_message
  from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'cleanup-unconfirmed-users')
  order by start_time desc limit 5;
```

## Your task (Round 3)

For each NF, answer ACCEPTED RESOLUTION / NEEDS REVISION / REJECTED.

Then state whether the final migration is mergeable.

Decide: is the storage RLS hardening (block unconfirmed user uploads) acceptable as a separate follow-up task, or must it be in the same PR?

## Output format

```
VERDICT: PASS | CONCERN | FAIL

ROUND 2 NF RESOLUTION:
| ID | Status | Note |
| NF1 | ... |
| NF2 | ... |
| NF3 | ... |

FINAL SQL ASSESSMENT:
- mergeable: YES / NO
- blockers (if NO): ...

STORAGE RLS HARDENING DEFERRAL:
- ACCEPTED-AS-FOLLOWUP / REQUIRED-IN-THIS-PR
- reason:

NEW FINDINGS (if any):
- ...

OVERALL:
- One paragraph: consensus reached or still disputing?
```
