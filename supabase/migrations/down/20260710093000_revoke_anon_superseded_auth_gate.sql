-- down: 20260710093000_revoke_anon_superseded_auth_gate 롤백.
--
-- 삭제된 locale-aware 6-인자 complete_auth_gate 오버로드를 원 정의
-- (20260625113000_auto_locale_detection.sql) 그대로 재생성한다. 이 오버로드는
-- 4-인자 base 오버로드로 위임하는데, 20260718120000 은 4/7/9-인자 오버로드의
-- 클라이언트 EXECUTE 만 회수하고 함수 자체는 남겨 두었으므로 위임 체인은
-- 여전히 유효하다(SECURITY DEFINER 내부 호출은 소유자 권한으로 실행된다).
--
-- 의도적 비복원 2건:
--   * 원 마이그레이션 코드에는 anon EXECUTE grant 가 존재한 적이 없다.
--     forward 가 닫은 anon 노출은 일부 원격 환경의 grant drift 였으므로
--     down 에서도 재생성하지 않는다.
--   * list_user_library_problem_items() 의 anon EXECUTE 회수 역시 drift
--     정리였으므로 re-grant 하지 않는다.

begin;

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_accept_required_consents boolean,
  p_ui_locale text,
  p_ui_locale_source text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_ui_locale text := case
    when lower(nullif(btrim(p_ui_locale), '')) in ('ko','en','vi')
      then lower(nullif(btrim(p_ui_locale), ''))
    else null
  end;
  v_ui_locale_source text := case
    when lower(nullif(btrim(p_ui_locale_source), '')) in ('auto','manual')
      then lower(nullif(btrim(p_ui_locale_source), ''))
    else null
  end;
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  if v_ui_locale is not null and v_ui_locale_source is not null then
    update public.profiles
       set ui_locale = v_ui_locale,
           ui_locale_source = v_ui_locale_source
     where id = v_user_id
       and status = 'active'
       and ui_locale_source = 'default';
  end if;

  perform public.complete_auth_gate(
    p_display_name,
    p_nickname,
    p_nationality_country_code,
    p_accept_required_consents
  );
end;
$$;

revoke all on function public.complete_auth_gate(text, text, text, boolean, text, text) from public;
grant execute on function public.complete_auth_gate(text, text, text, boolean, text, text) to authenticated;

comment on function public.complete_auth_gate(text, text, text, boolean, text, text) is
  'Completes the auth gate after atomically applying a default-source UI locale seed for the current active user, then delegates profile completion and consent recording to the existing transactional gate.';

commit;
