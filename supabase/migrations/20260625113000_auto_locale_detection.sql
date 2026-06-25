-- ============================================================================
-- TALKPIK AI - 2026-06-25 - auto UI locale detection provenance
--
-- Store only the resolved UI locale and its provenance. Raw request language
-- hints remain request-scoped and are never persisted.
-- ============================================================================

alter table public.profiles
  add column if not exists ui_locale_source text not null default 'legacy';

alter table public.profiles
  drop constraint if exists profiles_ui_locale_source_check;

alter table public.profiles
  add constraint profiles_ui_locale_source_check
  check (ui_locale_source in ('legacy','default','auto','manual'));

comment on column public.profiles.ui_locale_source is
  'Provenance for profiles.ui_locale: legacy existing row, default bootstrap, auto request hint, or manual user choice.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_attempt int := 0;
  v_affiliation_code text := nullif(btrim(new.raw_user_meta_data->>'affiliation_code'), '');
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

  loop
    v_attempt := v_attempt + 1;
    v_nickname := private.generate_default_nickname();

    begin
      insert into public.profiles (id, display_name, nationality_country_code, affiliation_code, nickname, ui_locale, ui_locale_source)
      values (
        new.id,
        nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
        upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
        v_affiliation_code,
        v_nickname,
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
  'After insert on auth.users, create matching public.profiles row idempotently; seeds profile metadata, generated nickname, and UI locale provenance. SECURITY DEFINER with locked search_path. Auto locale detection 2026-06-25.';
