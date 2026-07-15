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

function readIdentityCutoverMigration() {
  return readFileSync(
    join(
      migrationsDir,
      "20260714140000_writing_problem_identity_registry_cutover.sql",
    ),
    "utf8",
  );
}

describe("list_user_problems sort migration contract", () => {
  it("uses a deterministic tie-breaker after UI sort keys", () => {
    const normalized = readLatestListUserProblemsDefinition()
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(normalized).toContain("order by");
    expect(normalized).toMatch(
      /case when v_sort in \(\s*'newest',\s*'recent',\s*'difficulty',\s*'difficulty-asc',\s*'difficulty-desc'\s*\) then counted\.created_at end desc nulls last/,
    );
    expect(normalized).toContain("counted.id asc");
  });

  it("rewrites the writing catalog to canonical rows and rejects retired read dependencies", () => {
    const normalized = readIdentityCutoverMigration()
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(normalized).toContain(
      "from public.get_available_writing_questions(null, null) canonical",
    );
    expect(normalized).toContain(
      "list_user_problems_retired_read_dependency_remains",
    );
    expect(normalized).toContain("problem.domain <> 'writing'");
  });
});
