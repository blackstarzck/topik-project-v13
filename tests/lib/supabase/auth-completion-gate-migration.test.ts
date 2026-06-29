import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const authCompletionMigrationName = "20260623103000_auth_completion_gate.sql";

function readMigration(name: string) {
  return readFileSync(join(migrationsDir, name), "utf8");
}

function readMigrationsAfter(name: string) {
  return readdirSync(migrationsDir)
    .filter((candidate) => candidate.endsWith(".sql") && candidate > name)
    .sort()
    .map((candidate) => readMigration(candidate))
    .join("\n");
}

describe("auth completion gate migration contract", () => {
  it("exposes the single transactional auth completion RPC to authenticated users only", () => {
    const sql = readMigration(authCompletionMigrationName);
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function public.complete_auth_gate( p_display_name text, p_nickname text, p_nationality_country_code text, p_accept_required_consents boolean )",
    );
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = pg_catalog, public, private");
    expect(normalized).toContain("v_user_id uuid := auth.uid()");
    expect(normalized).toContain(
      "revoke all on function public.complete_auth_gate(text, text, text, boolean) from public",
    );
    expect(normalized).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, boolean) to authenticated",
    );
  });

  it("keeps profile completion and required consent recording in one RPC body", () => {
    const sql = readMigration(authCompletionMigrationName);
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("from public.profiles");
    expect(normalized).toContain("for update");
    expect(normalized).toContain("update public.profiles");
    expect(normalized).toContain("set display_name = v_display_name");
    expect(normalized).toContain("nickname = v_nickname::citext");
    expect(normalized).toContain("nationality_country_code = v_country");
    expect(normalized).toContain("insert into public.user_consents");
    expect(normalized).toContain("'signup'");
    expect(normalized).toContain("auth_completion_required: consent");
  });

  it("restores auth bootstrap nickname seeding after later handle_new_user redefinitions", () => {
    const sql = readMigration(authCompletionMigrationName);
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("update public.profiles");
    expect(normalized).toContain("where nickname is null or btrim(nickname::text) = ''");
    expect(normalized).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code, affiliation_code, nickname)",
    );
    expect(normalized).toContain("private.generate_default_nickname()");
    expect(normalized).toContain("execute function public.handle_new_user()");
  });

  it("does not drop the auth completion RPC or nickname bootstrap in later migrations", () => {
    const laterSql = readMigrationsAfter(authCompletionMigrationName)
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(laterSql).not.toContain("drop function public.complete_auth_gate");
    expect(laterSql).not.toContain("drop function private.generate_default_nickname");
    expect(laterSql).not.toContain("drop trigger if exists on_auth_user_created");
  });

  it("removes explicit anon execution from the auth completion RPC if remote grants drift", () => {
    const laterSql = readMigrationsAfter(authCompletionMigrationName)
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(laterSql).toContain(
      "revoke execute on function public.complete_auth_gate(text, text, text, boolean) from anon",
    );
    expect(laterSql).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, boolean) to authenticated",
    );
  });

  it("adds profile locale provenance for auto detection without storing request headers", () => {
    const laterSql = readMigrationsAfter(authCompletionMigrationName)
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(laterSql).toContain(
      "add column if not exists ui_locale_source text not null default 'legacy'",
    );
    expect(laterSql).toContain(
      "check (ui_locale_source in ('legacy','default','auto','manual'))",
    );
    expect(laterSql).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code, affiliation_code, nickname, ui_locale, ui_locale_source)",
    );
    expect(laterSql).toContain("new.raw_user_meta_data->>'ui_locale'");
    expect(laterSql).toContain("new.raw_user_meta_data->>'ui_locale_source'");
    expect(laterSql).toContain(
      "create or replace function public.complete_auth_gate( p_display_name text, p_nickname text, p_nationality_country_code text, p_accept_required_consents boolean, p_ui_locale text, p_ui_locale_source text )",
    );
    expect(laterSql).toContain(
      "revoke all on function public.complete_auth_gate(text, text, text, boolean, text, text) from public",
    );
    expect(laterSql).toContain(
      "grant execute on function public.complete_auth_gate(text, text, text, boolean, text, text) to authenticated",
    );
    expect(laterSql).toContain("ui_locale_source = 'default'");
    expect(laterSql).toContain("perform public.complete_auth_gate(");
    expect(laterSql).not.toContain("accept-language");
  });

  it("guards auth completion and direct consent insert behind confirmed email", () => {
    const laterSql = readMigrationsAfter(authCompletionMigrationName)
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(laterSql).toContain("private.is_email_confirmed(v_user_id)");
    expect(laterSql).toContain("auth_completion_required: email_unverified");
    expect(laterSql).toContain(
      "create policy user_consents_owner_insert on public.user_consents for insert to authenticated with check",
    );
    expect(laterSql).toContain(
      "private.is_email_confirmed((select auth.uid()))",
    );
    expect(laterSql).toContain("from public.profiles");
    expect(laterSql).toContain("profiles.id = (select auth.uid())");
    expect(laterSql).toContain("profiles.status = 'active'");
  });
});
