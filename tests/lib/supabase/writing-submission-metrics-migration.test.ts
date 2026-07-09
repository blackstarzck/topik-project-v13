import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260708113000_writing_submission_metrics.sql",
  ),
  "utf8",
);

function normalize(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("writing_submission_metrics migration", () => {
  it("ties inserted metric rows to the referenced writing submission facts", () => {
    const normalized = normalize(migration);

    expect(normalized).toContain(
      "create policy writing_submission_metrics_owner_insert",
    );
    expect(normalized).toContain(
      "ws.id = writing_submission_metrics.submission_id",
    );
    expect(normalized).toContain("ws.user_id = (select auth.uid())");
    expect(normalized).toContain(
      "ws.problem_id is not distinct from writing_submission_metrics.problem_id",
    );
    expect(normalized).toContain(
      "ws.question_no is not distinct from writing_submission_metrics.question_no",
    );
  });
});
