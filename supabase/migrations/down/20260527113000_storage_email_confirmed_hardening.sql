-- down: 20260527113000_storage_email_confirmed_hardening 롤백.
--
-- storage 정책 3개(avatars_owner_insert / avatars_owner_update /
-- exports_owner_insert)를 20260520121300_storage_policies.sql 원본
-- (이메일 인증 조건 없음)으로 되돌리고 private.is_email_confirmed(uuid)를
-- 제거한다.
--
-- 실행 순서 경고:
--   * 공유 dev/운영 적용 창(topik-ai manifest v13-shared-dev.json)의 전체
--     롤백에서 이 파일은 마지막(B1)이다. 20260723234527(B6)의 down이 먼저
--     실행되어 정책이 본 마이그레이션 버전으로 복원되어 있어야 한다.
--     B6 버전 정책이 남아 있으면 is_email_confirmed 를 참조하는 정책의
--     의존성 때문에 drop function 이 실패한다(그 실패가 순서 보호막이다).
--
-- 기능 경고:
--   * 이미 적용된 20260718120000 의 complete_auth_gate(jsonb 오버로드)는
--     함수 본문에서 private.is_email_confirmed 를 호출한다. plpgsql 본문은
--     pg_depend 에 잡히지 않아 drop 자체는 성공하지만, 이후 온보딩 게이트는
--     42883 을 다시 던진다. 그것이 B1 적용 전의 원래 상태다. 이 down 은
--     앱 버전 동시 롤백을 포함한 창 전체 롤백의 일부로만 실행한다.

begin;

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
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
  );

drop policy if exists exports_owner_insert on storage.objects;
create policy exports_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop function if exists private.is_email_confirmed(uuid);

commit;
