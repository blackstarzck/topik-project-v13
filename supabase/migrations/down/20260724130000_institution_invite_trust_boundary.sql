-- down: 20260724130000_institution_invite_trust_boundary 롤백.
--
-- handle_new_user() 를 직전 정의(20260709165000, raw_user_meta_data 의
-- affiliation_code 시딩 포함)로 되돌리고, 삭제된 두 legacy 브라우저 RPC 를
-- 직전 정의(20260701140000: accept_affiliation_invite + 위임 래퍼
-- claim_affiliation_code)로 재생성한다.
--
-- 보안 경고: 이 down 은 forward 가 닫은 신뢰 경계를 다시 연다 —
-- Auth 메타데이터의 raw affiliation_code 를 다시 신뢰하고, 브라우저에서
-- 호출 가능한 코드 클레임 RPC 2개가 부활한다. topik-ai 초대 응답 플로우로
-- 전환된 뒤에는 창 전체 롤백의 일부로만 실행한다(역순: down/20260724140000
-- 다음, down/20260724120000 이전).

begin;

-- 20260709165000 버전
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_attempt int := 0;
  v_affiliation_code text := nullif(btrim(new.raw_user_meta_data->>'affiliation_code'), '');
  v_gender text := lower(nullif(btrim(new.raw_user_meta_data->>'gender'), ''));
  v_phone_country_code text := upper(nullif(btrim(new.raw_user_meta_data->>'phone_country_code'), ''));
  v_phone_number text := nullif(btrim(new.raw_user_meta_data->>'phone_number'), '');
  v_requested_ui_locale text := lower(nullif(btrim(new.raw_user_meta_data->>'ui_locale'), ''));
  v_requested_ui_locale_source text := lower(nullif(btrim(new.raw_user_meta_data->>'ui_locale_source'), ''));
  v_ui_locale text := case
    when v_requested_ui_locale in ('ko','en','vi') then v_requested_ui_locale
    else 'ko'
  end;
  v_ui_locale_source text := case
    when v_requested_ui_locale in ('ko','en','vi')
         and v_requested_ui_locale_source in ('auto','manual') then v_requested_ui_locale_source
    when v_requested_ui_locale in ('ko','en','vi') then 'auto'
    else 'default'
  end;
  v_nickname citext;
begin
  if v_affiliation_code is not null
     and v_affiliation_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    v_affiliation_code := null;
  end if;

  if v_gender is not null
     and v_gender not in ('male', 'female') then
    v_gender := null;
  end if;

  if v_phone_country_code is not null
     and v_phone_country_code !~ '^[A-Z]{2}$' then
    v_phone_country_code := null;
  end if;

  v_phone_number := nullif(left(regexp_replace(coalesce(v_phone_number, ''), '[^0-9]', '', 'g'), 20), '');
  if v_phone_number is null then
    v_phone_country_code := null;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_nickname := private.generate_default_nickname();

    begin
      insert into public.profiles (
        id,
        display_name,
        gender,
        nationality_country_code,
        affiliation_code,
        nickname,
        phone_country_code,
        phone_number,
        ui_locale,
        ui_locale_source
      )
      values (
        new.id,
        nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
        v_gender,
        upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
        v_affiliation_code,
        v_nickname,
        v_phone_country_code,
        v_phone_number,
        v_ui_locale,
        v_ui_locale_source
      )
      on conflict (id) do nothing;
      return new;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently; seeds required profile metadata, optional gender/split-phone metadata, generated nickname, and UI locale provenance. SECURITY DEFINER with locked search_path.';

-- 20260701140000 버전
create or replace function public.accept_affiliation_invite(
  p_code text,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_code text := btrim(coalesce(p_code, ''));
  v_current_code text;
  v_profile_status text;
  v_updated_code text;
begin
  if v_caller_id is null then
    return jsonb_build_object('status', 'failed');
  end if;

  if p_confirmed is distinct from true then
    return jsonb_build_object('status', 'failed');
  end if;

  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select nullif(btrim(affiliation_code), ''), status
    into v_current_code, v_profile_status
    from public.profiles
   where id = v_caller_id;

  if not found then
    return jsonb_build_object('status', 'profile_not_found');
  end if;

  if v_profile_status is distinct from 'active' then
    return jsonb_build_object('status', 'failed');
  end if;

  if v_current_code is not null then
    if v_current_code = v_code then
      return jsonb_build_object('status', 'already_affiliated_same');
    end if;

    return jsonb_build_object('status', 'already_affiliated_other');
  end if;

  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_code
   where id = v_caller_id
     and status = 'active'
     and (affiliation_code is null or affiliation_code = '')
  returning affiliation_code into v_updated_code;

  if v_updated_code = v_code then
    return jsonb_build_object('status', 'accepted');
  end if;

  select nullif(btrim(affiliation_code), '')
    into v_current_code
    from public.profiles
   where id = v_caller_id;

  if v_current_code = v_code then
    return jsonb_build_object('status', 'already_affiliated_same');
  end if;

  if v_current_code is not null then
    return jsonb_build_object('status', 'already_affiliated_other');
  end if;

  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.accept_affiliation_invite(text, boolean) from public;
revoke all on function public.accept_affiliation_invite(text, boolean) from anon;
grant execute on function public.accept_affiliation_invite(text, boolean) to authenticated;

comment on function public.accept_affiliation_invite(text, boolean) is
  'Confirmed one-shot affiliation invite acceptance. Updates only the authenticated caller profile when active and affiliation_code is empty. 2026-07-01.';

create or replace function public.claim_affiliation_code(p_code text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb := public.accept_affiliation_invite(p_code, true);
  v_status text := v_result->>'status';
  v_code text := btrim(coalesce(p_code, ''));
begin
  if v_status in ('accepted', 'already_affiliated_same') then
    return v_code;
  end if;

  return null;
end;
$$;

revoke all on function public.claim_affiliation_code(text) from public;
grant execute on function public.claim_affiliation_code(text) to authenticated;

comment on function public.claim_affiliation_code(text) is
  'Deprecated compatibility wrapper for accept_affiliation_invite(p_code, true). New v13 UX must use explicit invite confirmation. 2026-07-01.';

commit;
