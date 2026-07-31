-- down: 20260724140000_pdf_export_request_idempotency 롤백.
--
-- 수행 내용(역순):
--   * 신규 attempt 함수 2개(complete/fail_pdf_export_attempt) 제거.
--   * commit / release_pdf_export_quota 를 직전 정의(20260707120000)로 복원.
--   * 3-인자 claim_pdf_export_quota 를 제거하고 2-인자 public 래퍼
--     (20260723234527 B6 버전 — private.claim_pdf_export_quota_unchecked 위임)
--     를 재생성한다. 따라서 이 down 은 B6 가 적용된 상태를 전제한다
--     (창 전체 롤백 역순의 두 번째: down/20260710095000 다음).
--   * pdf_export_request_periods 테이블 제거.
--   * pdf_export_quota_usages: cutover 가 강제 해제한 예약 행 복원 후
--     request_id 컬럼/unique 제약 제거.
--   * export_files: request_id / attempt_id / lease_expires_at 컬럼과
--     부분 unique 인덱스 제거, 소유자 RLS 정책(20260520121100
--     export_files_owner_all)과 직전 테이블 권한 복원.
--
-- 운영 경고: forward 와 동일한 유지보수 창 요구가 역방향에도 적용된다 —
-- PDF 요청 quiesce, 구/신 워커 정리, 앱 버전 동시 롤백(창 이후 앱은
-- acquire_pdf_export_attempt / 3-인자 claim 에 의존한다).
--
-- 데이터 손실 경고:
--   * pdf_export_request_periods 행(요청-기간-문제집합 바인딩)과
--     export_files.request_id / attempt_id / lease_expires_at,
--     pdf_export_quota_usages.request_id 는 drop 과 함께 소실된다.
--     운영 환경에서는 실행 전 백업 필수.
--   * cutover 가 'failed/legacy_unknown' 으로 닫은 legacy queued 행은
--     되돌리지 않는다. 20260722120000 의 legacy 백필과 같은 failure_code 를
--     공유해 선별 복원이 불가능하고, stale queue 를 되살리는 것 자체가
--     부적절하다(일방향 정규화).
--   * 반대로 cutover 가 'request_identity_cutover' 사유로 해제한 예약 행은
--     마커가 남아 있으므로 reserved 로 복원한다. 복원된 오래된 예약은 구
--     claim() 의 15분 reservation_timeout 이 다음 호출에서 자연 정리한다.

begin;

-- ---------------------------------------------------------------------
-- 1. 신규 attempt 함수 제거
-- ---------------------------------------------------------------------
drop function if exists public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text);
drop function if exists public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text);
drop function if exists public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text);

-- ---------------------------------------------------------------------
-- 2. commit / release 를 20260707120000 정의로 복원
-- ---------------------------------------------------------------------
create or replace function public.commit_pdf_export_quota(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_export_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer;
  v_updated integer;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as u(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  if not exists (
    select 1
    from public.export_files e
    where e.id = p_export_file_id
      and e.user_id = p_user_id
  ) then
    raise exception 'commit_pdf_export_quota: export file mismatch'
      using errcode = '42501';
  end if;

  update public.pdf_export_quota_usages
     set status = 'committed',
         export_file_id = p_export_file_id,
         committed_at = now()
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'commit_pdf_export_quota: usage count mismatch'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.release_pdf_export_quota(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer;
  v_updated integer;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as u(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  update public.pdf_export_quota_usages
     set status = 'released',
         released_at = now(),
         release_reason = p_reason
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'release_pdf_export_quota: usage count mismatch'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from public;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from anon;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from authenticated;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from public;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from anon;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from authenticated;

grant execute on function public.commit_pdf_export_quota(uuid, uuid[], uuid) to service_role;
grant execute on function public.release_pdf_export_quota(uuid, uuid[], text) to service_role;

comment on function public.commit_pdf_export_quota(uuid, uuid[], uuid) is
  'Commits reserved PDF export quota usages after export_files is ready.';
comment on function public.release_pdf_export_quota(uuid, uuid[], text) is
  'Releases reserved PDF export quota usages when PDF generation or print preparation fails.';

-- ---------------------------------------------------------------------
-- 3. claim: 3-인자 제거, 2-인자 래퍼(B6 버전) 복원
-- ---------------------------------------------------------------------
drop function if exists public.claim_pdf_export_quota(uuid, uuid[], uuid);

create or replace function public.claim_pdf_export_quota(
  p_user_id uuid,
  p_problem_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return private.claim_pdf_export_quota_unchecked(p_user_id, p_problem_ids);
end;
$$;

revoke all on function public.claim_pdf_export_quota(uuid, uuid[])
  from public, anon;
grant execute on function public.claim_pdf_export_quota(uuid, uuid[])
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. 요청-기간 바인딩 테이블 제거 (데이터 손실 — 위 경고 참조)
-- ---------------------------------------------------------------------
drop table if exists public.pdf_export_request_periods;

-- ---------------------------------------------------------------------
-- 5. pdf_export_quota_usages: cutover 해제 복원 후 request_id 제거
-- ---------------------------------------------------------------------
update public.pdf_export_quota_usages
   set status = 'reserved',
       released_at = null,
       release_reason = null
 where status = 'released'
   and release_reason = 'request_identity_cutover';

alter table public.pdf_export_quota_usages
  drop constraint if exists pdf_export_quota_usages_request_problem_period_uniq;

alter table public.pdf_export_quota_usages
  drop column if exists request_id;

-- ---------------------------------------------------------------------
-- 6. export_files: 요청 식별 컬럼/인덱스 제거 (데이터 손실 — 위 경고 참조)
-- ---------------------------------------------------------------------
drop index if exists public.export_files_user_request_uniq;

alter table public.export_files
  drop column if exists request_id,
  drop column if exists attempt_id,
  drop column if exists lease_expires_at;

-- ---------------------------------------------------------------------
-- 7. 소유자 RLS 정책(20260520121100)과 직전 테이블 권한 복원
-- ---------------------------------------------------------------------
drop policy if exists export_files_owner_all on public.export_files;
create policy export_files_owner_all
  on public.export_files
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- forward 가 회수한 authenticated 권한을 직전 상태로 복원:
-- INSERT/DELETE 는 테이블 단위, UPDATE 는 20260724120000 이 부여한 컬럼 단위.
-- (forward 의 owner_insert/update/delete 정책 drop 은 방어적이었고 직전
--  상태에 그 정책들은 존재하지 않았으므로 재생성하지 않는다. anon 의
--  INSERT/UPDATE/DELETE 는 default-privilege drift 였으므로 재부여하지 않는다.)
grant insert, delete on table public.export_files to authenticated;
grant update (storage_path, status, ready_at)
  on table public.export_files to authenticated;

commit;
