import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
}

function readLatestHandleNewUserDefinition() {
  const matches =
    readMigrations().match(
      /create or replace function public\.handle_new_user\(\)[\s\S]*?\$\$;/gi,
    ) ?? [];
  return matches.at(-1) ?? "";
}

describe("profiles nationality migration", () => {
  it("adds profiles.nationality_country_code and seeds it from auth metadata", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "alter table public.profiles add column if not exists nationality_country_code text",
    );
    expect(normalized).toContain(
      "profiles_nationality_country_code_format",
    );
    expect(sql).toContain("nationality_country_code ~ '^[A-Z]{2}$'");
    expect(normalized).toContain("nationality_country_code = any (array[");
    for (const code of ["KR", "VN", "US", "JP"]) {
      expect(normalized).toContain(`'${code.toLowerCase()}'::text`);
    }
    expect(normalized).not.toContain("'zz'::text");
    expect(normalized).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code)",
    );
    expect(normalized).toContain(
      "upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), ''))",
    );
    expect(normalized).not.toContain(
      "alter table public.profiles add column if not exists nationality text",
    );
    expect(normalized).toContain("execute function public.handle_new_user()");
  });

  it("seeds a required non-identifying random nickname for new profiles", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code, nickname)",
    );
    expect(normalized).toContain("'talkpik-'");
    expect(normalized).toContain("gen_random_uuid()");
    expect(normalized).not.toContain("split_part(new.email");
    expect(normalized).not.toContain("new.raw_user_meta_data->>'nickname'");
  });

  it("adds a security-definer RPC for nickname availability checks", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function public.is_nickname_available(candidate text)",
    );
    expect(normalized).toContain("returns boolean");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("auth.uid()");
    expect(normalized).toContain("lower(nickname::text)");
    expect(normalized).toContain("id <> caller_id");
    expect(normalized).toContain(
      "grant execute on function public.is_nickname_available(text) to authenticated",
    );
  });

  it("adds affiliation_code with validated trigger seeding and one-shot claim protection", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "alter table public.profiles add column if not exists affiliation_code text",
    );
    expect(normalized).toContain("profiles_affiliation_code_format");
    expect(sql).toContain("affiliation_code ~ '^[A-Za-z0-9_-]{2,64}$'");
    expect(normalized).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code, affiliation_code)",
    );
    expect(normalized).toContain(
      "new.raw_user_meta_data->>'affiliation_code'",
    );
    expect(normalized).toContain(
      "create or replace function public.claim_affiliation_code(p_code text)",
    );
    expect(normalized).toContain("set_config('app.claim_affiliation_code'");
    expect(normalized).toContain("new.affiliation_code is distinct from old.affiliation_code");
    expect(normalized).toContain(
      "grant execute on function public.claim_affiliation_code(text) to authenticated",
    );
  });

  it("keeps the final auth bootstrap trigger aligned with all profile seed fields", () => {
    const normalized = readLatestHandleNewUserDefinition()
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(normalized).toContain(
      "insert into public.profiles (id, display_name, nationality_country_code, affiliation_code, nickname)",
    );
    expect(normalized).toContain("private.generate_default_nickname()");
    expect(normalized).toContain(
      "new.raw_user_meta_data->>'affiliation_code'",
    );
    expect(normalized).toContain(
      "new.raw_user_meta_data->>'nationality_country_code'",
    );
  });
});
