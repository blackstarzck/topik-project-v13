-- down: 20260701140000_accept_affiliation_invite 롤백.
--
-- public.accept_affiliation_invite(text, boolean) 를 제거하고
-- public.claim_affiliation_code(text) 를 직전 정의(20260619140000, 위임 없는
-- 단독 구현)로 되돌린다.
--
-- 실행 순서 경고: 20260724130000(B8)이 적용된 상태에서는 두 함수 모두 이미
-- 삭제되어 있다. 창 전체 롤백에서는 down/20260724130000 이 두 함수를 먼저
-- 재생성하므로, 이 down 은 반드시 그 이후(역순)에 실행한다.

begin;

drop function if exists public.accept_affiliation_invite(text, boolean);

create or replace function public.claim_affiliation_code(p_code text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := btrim(coalesce(p_code, ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then return null; end if;

  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_code
   where id = caller_id
     and (affiliation_code is null or affiliation_code = '');

  return v_code;
end;
$$;

revoke all    on function public.claim_affiliation_code(text) from public;
grant  execute on function public.claim_affiliation_code(text) to authenticated;

comment on function public.claim_affiliation_code(text) is
  'Caller backfills their own profiles.affiliation_code once (no-op if already set). Used by the OAuth sign-up path where Auth metadata is unavailable. 2026-06-19.';

commit;
