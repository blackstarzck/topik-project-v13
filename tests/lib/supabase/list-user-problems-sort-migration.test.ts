import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

function readMigrations() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
}

function readLatestListUserProblemsDefinition() {
  const matches =
    readMigrations().match(
      /create or replace function public\.list_user_problems\([\s\S]*?\$\$;/gi,
    ) ?? [];
  return matches.at(-1) ?? "";
}

describe("list_user_problems sort migration contract", () => {
  it("uses a deterministic tie-breaker after UI sort keys", () => {
    const normalized = readLatestListUserProblemsDefinition()
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(normalized).toContain("order by");
    expect(normalized).toContain(
      "case when v_sort in ('newest', 'recent', 'difficulty', 'difficulty-asc', 'difficulty-desc') then counted.created_at end desc nulls last",
    );
    expect(normalized).toContain("counted.id asc");
  });
});
