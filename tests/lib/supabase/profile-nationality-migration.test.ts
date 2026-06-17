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
});
