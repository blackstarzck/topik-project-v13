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
    expect(normalized).toContain(
      "and public.is_writing_problem_visible_to_caller(p.id, p.question_no)",
    );
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
  it("accepts language as a normalized feedback dimension", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "feedback_dimension_scores_dimension_check check (dimension in ('grammar','vocab','structure','content','expression','topic_fit','language'))",
    );
    expect(normalized).toContain(
      "dim_name not in ('grammar','vocab','structure','content','expression','topic_fit','language')",
    );
  });

  it("records externally queued submissions through an RPC without re-enabling direct inserts", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("writing_submissions_no_direct_insert");
    expect(normalized).toContain("with check (false)");
    expect(normalized).toContain("create or replace function public.create_external_writing_submission");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("submission->>'external_submission_id'");
    expect(normalized).toContain("perform private.assert_writing_problem_submittable");
    expect(normalized).toContain(
      "perform private.assert_writing_problem_submittable_for_user",
    );
    expect(normalized).toContain("owner_id");
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

  it("auto-saves externally queued submissions to the user's library idempotently", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain(
      "create or replace function private.ensure_submission_library_item",
    );
    expect(normalized).toContain("insert into public.library_items");
    expect(normalized).toContain("values (p_user_id, 'submission', p_submission_id)");
    expect(normalized).toContain(
      "on conflict (user_id, submission_id) where submission_id is not null do nothing",
    );
    expect(normalized).toContain(
      "grant execute on function private.ensure_submission_library_item(uuid, uuid) to service_role",
    );

    const existingReturnIndex = normalized.indexOf(
      "if existing_id is not null then perform private.ensure_submission_library_item(owner_id, existing_id); return existing_id;",
    );
    const insertIndex = normalized.lastIndexOf(
      "insert into public.writing_submissions",
    );
    const newSubmissionSaveIndex = normalized.indexOf(
      "perform private.ensure_submission_library_item(owner_id, external_submission_id)",
      insertIndex,
    );

    expect(existingReturnIndex).toBeGreaterThanOrEqual(0);
    expect(newSubmissionSaveIndex).toBeGreaterThan(insertIndex);
  });

  it("persists a validated parent submission for feedback retries", () => {
    const sql = readMigrations();
    const normalized = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalized).toContain("v_parent_submission_id");
    expect(normalized).toContain("submission ? 'parent_submission_id'");
    expect(normalized).toContain("raise exception 'parent_submission_not_owned'");
    expect(normalized).toContain(
      "answer_text, answer_json, char_count, feedback_status, parent_submission_id",
    );
    expect(normalized).toContain("v_parent_submission_id");
  });
});
