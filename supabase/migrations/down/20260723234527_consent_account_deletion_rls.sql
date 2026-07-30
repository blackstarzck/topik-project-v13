-- down: 20260723234527_consent_account_deletion_rls 롤백.
--
-- forward 의 5개 절을 역순으로 되돌린다:
--   5' Storage: avatars 버킷을 다시 public 으로, 정책을 직전 버전
--      (20260520121300 원본 + 20260527113000 이메일 인증 hardening)으로 복원.
--      avatars_owner_select 는 forward 가 만들었으므로 제거.
--   4' 7개 SECURITY DEFINER RPC 의 public 래퍼를 제거하고 private.*_unchecked
--      를 원래 이름으로 rename 후 public 스키마로 되돌린다(본문·속성은 이동
--      과정에서 그대로 보존된다). 레거시 submit RPC 의 authenticated EXECUTE
--      를 회복한다.
--   3' profiles 컬럼 권한을 테이블 단위 UPDATE 로 되돌리고,
--      protect_profile_columns / request_account_deletion 을 직전 정의
--      (20260622120000, self active->deleted 예외를 가진 SECURITY DEFINER
--      트리거 + 소프트 삭제 RPC)로 복원. get_my_account_state 제거.
--   2' 33개 restrictive 정책(active_account_only 25 + problems 4 +
--      problem_assets 4)을 제거하고 assert_active_user / is_active_user 를
--      정책 제거 후에 drop 한다.
--   1' user_consents 직접 INSERT 경로 복원: no_direct_insert 정책 제거,
--      user_consents_owner_insert(20260608120000) 재생성, authenticated 에
--      INSERT re-grant.
--
-- 비멱등 경고(정확한 역이 필요한 구간): rename + set schema 7쌍은 재실행이
-- 불가능하다. 이 down 이 중간에 실패하면 재시도 전에
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'private' and p.proname like '%_unchecked';
-- 로 남은 *_unchecked 개수를 확인한다. 7이면 이동 전, 0이면 이동 완료,
-- 1..6이면 부분 커밋으로 남은 쌍만 수동 이동한다.
--
-- 기능 경고: 창 이후 v13 앱은 get_my_account_state() 와 활성계정 게이트에
-- 의존한다. 이 down 은 앱 버전 동시 롤백을 포함한 창 전체 롤백의 일부로만
-- 실행한다(역순: down/20260724120000 다음, down/20260722120000 이전).

begin;

-- ---------------------------------------------------------------------
-- 5'. Storage: 버킷 공개 상태와 정책을 직전 버전으로 복원
-- ---------------------------------------------------------------------
update storage.buckets
   set public = true
 where id = 'avatars';

drop policy if exists avatars_owner_select on storage.objects;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'avatars' );

-- 20260527113000 버전(이메일 인증 조건 포함, is_active_user 없음)
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );

-- 20260520121300 버전
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists exports_owner_select on storage.objects;
create policy exports_owner_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- 20260527113000 버전(이메일 인증 조건 포함)
drop policy if exists exports_owner_insert on storage.objects;
create policy exports_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );

-- 20260520121300 버전
drop policy if exists exports_owner_delete on storage.objects;
create policy exports_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------
-- 4'. 레거시 submit RPC grant 복원 + 7개 RPC 를 public 으로 원위치
-- ---------------------------------------------------------------------
grant execute on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb)
  to authenticated;

drop function if exists public.list_user_library_problem_items();
alter function private.list_user_library_problem_items_unchecked()
  rename to list_user_library_problem_items;
alter function private.list_user_library_problem_items() set schema public;
grant execute on function public.list_user_library_problem_items()
  to authenticated;

drop function if exists public.is_nickname_available(text);
alter function private.is_nickname_available_unchecked(text)
  rename to is_nickname_available;
alter function private.is_nickname_available(text) set schema public;
grant execute on function public.is_nickname_available(text) to authenticated;

drop function if exists public.claim_pdf_export_quota(uuid, uuid[]);
alter function private.claim_pdf_export_quota_unchecked(uuid, uuid[])
  rename to claim_pdf_export_quota;
alter function private.claim_pdf_export_quota(uuid, uuid[]) set schema public;
grant execute on function public.claim_pdf_export_quota(uuid, uuid[])
  to authenticated;

drop function if exists public.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
);
alter function private.create_comparison_report_with_metrics_unchecked(
  uuid,
  uuid,
  jsonb,
  text,
  text
) rename to create_comparison_report_with_metrics;
alter function private.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) set schema public;
grant execute on function public.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) to authenticated;

drop function if exists public.replace_stale_writing_draft(uuid, text, bigint, text);
alter function private.replace_stale_writing_draft_unchecked(uuid, text, bigint, text)
  rename to replace_stale_writing_draft;
alter function private.replace_stale_writing_draft(uuid, text, bigint, text)
  set schema public;
grant execute on function public.replace_stale_writing_draft(
  uuid,
  text,
  bigint,
  text
) to authenticated;

drop function if exists public.get_writing_submission_history_context(uuid[]);
alter function private.get_writing_submission_history_context_unchecked(uuid[])
  rename to get_writing_submission_history_context;
alter function private.get_writing_submission_history_context(uuid[])
  set schema public;
grant execute on function public.get_writing_submission_history_context(uuid[])
  to authenticated;

drop function if exists public.get_dashboard_kpi();
alter function private.get_dashboard_kpi_unchecked() rename to get_dashboard_kpi;
alter function private.get_dashboard_kpi() set schema public;
grant execute on function public.get_dashboard_kpi() to authenticated;

-- ---------------------------------------------------------------------
-- 3'. 계정 상태 RPC / profiles 권한·트리거를 직전 정의로 복원
-- ---------------------------------------------------------------------
drop function if exists public.get_my_account_state();

-- 20260622120000 버전
create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := (select auth.uid());
  cur_status text;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select status into cur_status from public.profiles where id = caller_id;
  if cur_status is null then
    raise exception 'profile not found';
  end if;

  -- 멱등: 이미 deleted 면 deleted_at 재스탬프 없이 성공 반환(30일 시계 보호).
  if cur_status = 'deleted' then
    return;
  end if;

  -- blocked 등 비활성 계정은 self-탈퇴 대상이 아니다(트리거도 차단).
  if cur_status <> 'active' then
    raise exception 'account is not active (status=%)', cur_status;
  end if;

  update public.profiles
    set status = 'deleted',
        deleted_at = now()
    where id = caller_id;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

comment on function public.request_account_deletion() is
  'Authenticated self-service 회원 탈퇴. Sets caller profiles.status=deleted + deleted_at=now(). '
  'Idempotent (no re-stamp if already deleted). Recovery(deleted->active) and hard-delete are out of scope.';

-- 20260622120000 버전(SECURITY DEFINER + self active->deleted 예외)
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Admins (content_admin / platform_admin) bypass entirely.
  if private.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.app_role is distinct from old.app_role then
    raise exception
      'profiles.app_role can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.plan_label is distinct from old.plan_label then
    raise exception
      'profiles.plan_label can only be changed by admins or billing service'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    -- 회원 탈퇴(self-service): 행 소유자 본인이 active → deleted 로만 전환 가능.
    -- 그 외 모든 status 변경(타인, 역방향 deleted→active 복구, blocked 등)은
    -- 계속 admin 전용으로 차단한다.
    if not (
      new.id = (select auth.uid())
      and old.status = 'active'
      and new.status = 'deleted'
    ) then
      raise exception
        'profiles.status can only be changed by admins (self active->deleted excepted)'
        using errcode = '42501';
    end if;
  end if;

  if new.affiliation_code is distinct from old.affiliation_code
     and current_setting('app.claim_affiliation_code', true) is distinct from '1' then
    raise exception
      'profiles.affiliation_code can only be changed by claim_affiliation_code'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_columns() from public;

comment on function private.protect_profile_columns() is
  'BEFORE UPDATE on public.profiles. Blocks app_role/plan_label/status changes for non-admins '
  '(self active->deleted excepted for 회원 탈퇴) and blocks normal affiliation_code edits.';

-- 컬럼 단위 UPDATE 를 회수하고 직전의 테이블 단위 UPDATE 로 복원.
revoke update (
  display_name,
  gender,
  nationality_country_code,
  nickname,
  phone_country_code,
  phone_number,
  phone_number_prompt_dismissed_at,
  avatar_path,
  ui_locale,
  ui_locale_source,
  notification_prefs,
  learning_locale,
  content_prefs,
  bio
) on table public.profiles from authenticated;
grant update on table public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2'. restrictive 정책 33개 제거 후 predicate 함수 제거
-- ---------------------------------------------------------------------
drop policy if exists active_account_only on public.profiles;
drop policy if exists active_account_only on public.learning_goals;
drop policy if exists active_account_only on public.problem_attempts;
drop policy if exists active_account_only on public.writing_drafts;
drop policy if exists active_account_only on public.writing_submissions;
drop policy if exists active_account_only on public.writing_feedback;
drop policy if exists active_account_only on public.feedback_dimension_scores;
drop policy if exists active_account_only on public.sentence_feedback;
drop policy if exists active_account_only on public.comparison_reports;
drop policy if exists active_account_only on public.recommendation_runs;
drop policy if exists active_account_only on public.recommendation_items;
drop policy if exists active_account_only on public.library_items;
drop policy if exists active_account_only on public.study_events;
drop policy if exists active_account_only on public.export_files;
drop policy if exists active_account_only on public.subscriptions;
drop policy if exists active_account_only on public.payment_history;
drop policy if exists active_account_only on public.notification_settings;
drop policy if exists active_account_only on public.notification_log;
drop policy if exists active_account_only on public.user_consents;
drop policy if exists active_account_only on public.user_notifications;
drop policy if exists active_account_only on public.user_marketing_consent;
drop policy if exists active_account_only on public.pdf_export_quota_usages;
drop policy if exists active_account_only on public.pdf_export_quota_resets;
drop policy if exists active_account_only on public.pdf_export_quota_reset_targets;
drop policy if exists active_account_only on public.writing_submission_metrics;

drop policy if exists problems_active_or_public_select on public.problems;
drop policy if exists problems_active_insert on public.problems;
drop policy if exists problems_active_update on public.problems;
drop policy if exists problems_active_delete on public.problems;

drop policy if exists problem_assets_active_or_public_select on public.problem_assets;
drop policy if exists problem_assets_active_insert on public.problem_assets;
drop policy if exists problem_assets_active_update on public.problem_assets;
drop policy if exists problem_assets_active_delete on public.problem_assets;

-- ---------------------------------------------------------------------
-- 1'. user_consents 직접 INSERT 경로 복원
-- ---------------------------------------------------------------------
drop policy if exists user_consents_no_direct_insert on public.user_consents;

-- 20260608120000 버전
drop policy if exists user_consents_owner_insert on public.user_consents;
create policy user_consents_owner_insert
  on public.user_consents
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

grant insert on table public.user_consents to authenticated;

-- 모든 정책·래퍼가 제거된 뒤에만 predicate 함수를 제거할 수 있다.
drop function if exists private.assert_active_user();
drop function if exists private.is_active_user();

commit;
