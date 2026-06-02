-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- Admin/org EXTENSIONS to close X-08 / X-10 documented features.
--
-- Builds on 20260602120300_org.sql (org tables) + 20260602120400_admin_and_user_rpcs.sql.
-- Follows the same conventions:
--   - SECURITY DEFINER, set search_path = pg_catalog, public
--   - caller_id := auth.uid(); raise 'unauthenticated' if null
--   - guard with private.is_org_admin / is_platform_admin
--   - mutations write public.admin_audit_logs
--   - revoke all from public; grant execute to authenticated
--
-- Three changes:
--   1. get_admin_org_dashboard  -> + assignment_submission_rate  (X-08 region 2:
--      documented KPI "과제 제출률"; replaces the stop-gap of showing only
--      submissions_7d. Additive column; existing 6 columns unchanged.)
--   2. create_organization      -> bootstrap RPC. org RLS (organizations_manager_write)
--      requires is_org_manager, but a brand-new org has no members yet -> nobody
--      can insert the first row. This SECURITY DEFINER RPC creates the org AND
--      the creator's owner membership atomically. (X-08 region 3 운영: assignment
--      creation needs an org to attach to.)
--   3. get_admin_users          -> + org_names + 기관명 search (X-10 region 3 검색
--      "기관명", region 5 상세 "기관 소속"). Additive column.
--
-- NB: RETURNS TABLE column-set changes require DROP + CREATE (Postgres forbids
-- changing the return type via CREATE OR REPLACE). Drops are idempotent and the
-- whole migration runs in one transaction.
-- =====================================================================


-- =====================================================================
-- 1. get_admin_org_dashboard — add assignment_submission_rate (7th column).
-- submission rate = submitted/reviewed assignment_submissions over all, as a
-- 0-100 percentage rounded to 1 decimal. NULL when there are no assignment
-- submissions yet (UI renders "—" rather than a misleading 0%).
-- =====================================================================
drop function if exists public.get_admin_org_dashboard();
create or replace function public.get_admin_org_dashboard()
returns table (
  learner_count             int,
  active_7d_count           int,
  submissions_7d_count      int,
  recent_events             jsonb,
  avg_writing_score         numeric,
  per_user                  jsonb,
  assignment_submission_rate numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_org_admin(caller_id) then
    raise exception 'forbidden: org_admin required';
  end if;

  return query
  select
    (select count(*)::int from public.profiles where app_role = 'learner') as learner_count,
    (select count(distinct user_id)::int from public.problem_attempts
       where started_at >= (now() - interval '7 days')) as active_7d_count,
    (select count(*)::int from public.writing_submissions
       where submitted_at >= (now() - interval '7 days')) as submissions_7d_count,
    (select coalesce(jsonb_agg(jsonb_build_object(
              'event_type', se.event_type,
              'occurred_at', se.occurred_at,
              'user_id', se.user_id,
              'payload', se.payload
            ) order by se.occurred_at desc), '[]'::jsonb)
       from (
         select * from public.study_events
         order by occurred_at desc
         limit 100
       ) se) as recent_events,
    (select round(avg(wf.score_total), 2) from public.writing_feedback wf
       where wf.score_total is not null) as avg_writing_score,
    (select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'learner_id',       u.learner_id,
                  'display_name',     u.display_name,
                  'submission_count', u.submission_count,
                  'avg_score',        u.avg_score,
                  'last_activity',    u.last_activity
                )
                order by u.last_activity desc nulls last
              ),
              '[]'::jsonb)
       from (
         select
           p.id                                   as learner_id,
           p.display_name                         as display_name,
           (select count(*)::int from public.writing_submissions ws
              where ws.user_id = p.id)            as submission_count,
           (select round(avg(wf2.score_total), 2) from public.writing_feedback wf2
              where wf2.user_id = p.id and wf2.score_total is not null) as avg_score,
           (select max(se2.occurred_at) from public.study_events se2
              where se2.user_id = p.id)           as last_activity
         from public.profiles p
         where p.app_role = 'learner'
         order by last_activity desc nulls last
         limit 200
       ) u) as per_user,
    -- NEW KPI (X-08 region 2 "과제 제출률"): submitted/reviewed over all
    -- assignment_submissions. NULL when none exist yet.
    (select case
              when count(*) = 0 then null
              else round(
                100.0 * count(*) filter (where status in ('submitted','reviewed'))
                      / count(*), 1)
            end
       from public.assignment_submissions) as assignment_submission_rate;
end;
$$;
revoke all on function public.get_admin_org_dashboard() from public;
grant execute on function public.get_admin_org_dashboard() to authenticated;
comment on function public.get_admin_org_dashboard() is
  'Org/platform admin dashboard. Phase 6 KPIs + avg_writing_score + per_user + ADDED assignment_submission_rate (X-08 region 2 과제 제출률). Additive: prior 6 columns unchanged.';


-- =====================================================================
-- 2. create_organization — bootstrap RPC (solves the first-org chicken/egg).
-- Guard: org_admin or platform_admin. Creates the org + the caller's owner
-- membership atomically, then audits. Returns the new org id.
-- =====================================================================
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_name    text := nullif(btrim(coalesce(p_name, '')), '');
  new_id    uuid;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not (private.is_org_admin(caller_id) or private.is_platform_admin(caller_id)) then
    raise exception 'forbidden: org_admin or platform_admin required';
  end if;
  if v_name is null then raise exception 'organization name required'; end if;

  insert into public.organizations (name, created_by)
  values (v_name, caller_id)
  returning id into new_id;

  -- Creator becomes owner so the org RLS (is_org_manager) lets them manage it.
  insert into public.org_members (org_id, user_id, role)
  values (new_id, caller_id, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'organization.create',
    'organizations',
    new_id::text,
    jsonb_build_object('name', v_name),
    jsonb_build_object('owner_user_id', caller_id)
  );

  return new_id;
end;
$$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;
comment on function public.create_organization(text) is
  'Bootstrap RPC: org_admin/platform_admin creates an organization + own owner membership atomically (org RLS would otherwise block the first insert). Audited.';


-- =====================================================================
-- 3. get_admin_users — add org_names (X-10 기관 소속) + 기관명 search.
-- Recreated to add a 12th column. Signature/grants unchanged otherwise.
-- =====================================================================
drop function if exists public.get_admin_users(text, text, int, int);
create or replace function public.get_admin_users(
  search    text default null,
  sort      text default 'activity',
  page      int  default 1,
  page_size int  default 20
)
returns table (
  user_id          uuid,
  email            text,
  display_name     text,
  app_role         text,
  plan_label       text,
  status           text,
  submission_count int,
  last_activity    timestamptz,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  org_names        text,
  total_count      bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_page    int  := greatest(coalesce(page, 1), 1);
  v_size    int  := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset  int;
  v_search  text := nullif(btrim(coalesce(search, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with base as (
    select
      p.id              as user_id,
      u.email::text     as email,
      p.display_name    as display_name,
      p.app_role        as app_role,
      p.plan_label      as plan_label,
      p.status          as status,
      (select count(*)::int from public.writing_submissions ws
         where ws.user_id = p.id) as submission_count,
      (select max(se.occurred_at) from public.study_events se
         where se.user_id = p.id) as last_activity,
      u.last_sign_in_at as last_sign_in_at,
      p.created_at      as created_at,
      (select string_agg(o.name, ', ' order by o.name)
         from public.org_members om
         join public.organizations o on o.id = om.org_id
         where om.user_id = p.id) as org_names
    from public.profiles p
    left join auth.users u on u.id = p.id
    where v_search is null
       or p.display_name ilike '%' || v_search || '%'
       or u.email ilike '%' || v_search || '%'
       or exists (
         select 1 from public.org_members om2
         join public.organizations o2 on o2.id = om2.org_id
         where om2.user_id = p.id
           and o2.name ilike '%' || v_search || '%'
       )
  ),
  counted as (
    select base.*, count(*) over () as total_count
    from base
  )
  select
    counted.user_id, counted.email, counted.display_name, counted.app_role,
    counted.plan_label, counted.status, counted.submission_count,
    counted.last_activity, counted.last_sign_in_at, counted.created_at,
    counted.org_names, counted.total_count
  from counted
  order by
    case when sort = 'created'  then counted.created_at end desc nulls last,
    case when sort = 'name'     then counted.display_name end asc  nulls last,
    case when sort = 'activity' or sort is null
         then counted.last_activity end desc nulls last,
    counted.created_at desc
  limit v_size offset v_offset;
end;
$$;
revoke all on function public.get_admin_users(text, text, int, int) from public;
grant execute on function public.get_admin_users(text, text, int, int) to authenticated;
comment on function public.get_admin_users(text, text, int, int) is
  'Platform-admin user directory (X-10). Joins auth.users + profiles + submission_count + last_activity + org_names (기관 소속). Window total_count. Search matches name/email/org name.';
