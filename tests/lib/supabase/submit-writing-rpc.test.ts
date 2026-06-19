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

describe("submit_writing_with_feedback problem visibility guard", () => {
  it("checks that a writing problem is public and active before inserting a submission", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("private.assert_writing_problem_submittable");
    expect(normalized).toContain("p.domain = 'writing'");
    expect(normalized).toContain("p.question_no = p_question_no");
    expect(normalized).toContain("p.publish_status = 'published'");
    expect(normalized).toContain("p.visibility = 'public'");
    expect(normalized).toContain("p.lifecycle_status = 'active'");
    expect(normalized).toContain("raise exception 'problem_not_submittable'");

    const guardIndex = normalized.indexOf(
      "perform private.assert_writing_problem_submittable",
    );
    const insertIndex = normalized.lastIndexOf(
      "insert into public.writing_submissions",
    );

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(guardIndex);
  });
});

describe("create_external_writing_submission", () => {
  it("records externally queued submissions through an RPC without re-enabling direct inserts", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("writing_submissions_no_direct_insert");
    expect(normalized).toContain("with check (false)");
    expect(normalized).toContain("create or replace function public.create_external_writing_submission");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("submission->>'external_submission_id'");
    expect(normalized).toContain("perform private.assert_writing_problem_submittable");
    expect(normalized).toContain("feedback_status");
    expect(normalized).toContain("'analyzing'");
  });

  it("keeps external submission and feedback sync writes on the service role path", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "grant execute on function public.create_external_writing_submission(jsonb) to service_role",
    );
    expect(normalized).not.toContain(
      "grant execute on function public.create_external_writing_submission(jsonb) to authenticated",
    );
    expect(normalized).toContain(
      "grant execute on function public.sync_external_writing_feedback(uuid, text, jsonb, jsonb, jsonb) to service_role",
    );
    expect(normalized).not.toContain(
      "grant execute on function public.sync_external_writing_feedback(uuid, text, jsonb, jsonb, jsonb) to authenticated",
    );
    expect(normalized).toContain("submission->>'user_id'");
    expect(normalized).toContain("and user_id = owner_id");
    expect(normalized).toContain("and problem_id = (submission->>'problem_id')::uuid");
    expect(normalized).toContain("perform private.set_submission_feedback_status");
  });
});
