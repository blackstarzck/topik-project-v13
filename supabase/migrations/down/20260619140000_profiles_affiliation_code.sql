-- down: revert profiles.affiliation_code + claim RPC; restore handle_new_user
-- to the 2026-06-17 nationality version (display_name + nationality_country_code).
drop function if exists public.claim_affiliation_code(text);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name, nationality_country_code)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.profiles drop constraint if exists profiles_affiliation_code_format;
alter table public.profiles drop column if exists affiliation_code;
