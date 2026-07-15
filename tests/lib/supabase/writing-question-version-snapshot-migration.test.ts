import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260713081559_writing_question_version_snapshot.sql";
const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();
const down = readFileSync(
  join(process.cwd(), "supabase", "migrations", "down", migrationName),
  "utf8",
).toLowerCase();

describe("writing question version snapshot migration", () => {
  it("adds an all-or-none canonical identity, version, hash, and snapshot", () => {
    for (const column of [
      "canonical_question_id",
      "canonical_import_id",
      "canonical_payload_hash",
      "question_snapshot",
    ]) {
      expect(sql).toContain(`add column if not exists ${column}`);
    }
    expect(sql).toContain(
      "constraint writing_submissions_canonical_context_all_or_none",
    );
    expect(sql).toContain("jsonb_typeof(question_snapshot) = 'object'");
    expect(sql).toContain(
      "constraint writing_submissions_canonical_import_id_fkey foreign key (canonical_import_id) references public.topik_writing_question_import(import_id) on delete restrict",
    );
  });

  it("pins the rendered canonical version on resumable drafts", () => {
    expect(sql).toContain(
      "alter table public.writing_drafts add column if not exists canonical_question_id text, add column if not exists canonical_import_id bigint, add column if not exists canonical_payload_hash text, add column if not exists question_snapshot jsonb",
    );
    expect(sql).toContain(
      "constraint writing_drafts_canonical_context_all_or_none",
    );
    expect(sql).toContain(
      "constraint writing_drafts_canonical_import_id_fkey foreign key (canonical_import_id) references public.topik_writing_question_import(import_id) on delete restrict",
    );
    expect(sql).toContain(
      "create index if not exists writing_drafts_canonical_question_version_idx",
    );
    expect(sql).toContain(
      "create trigger writing_drafts_populate_question_snapshot",
    );
    expect(sql).toContain(
      "new.question_snapshot := private.get_writing_question_snapshot_from_catalog",
    );
  });

  it("provides an authenticated atomic supersede-and-copy stale draft path", () => {
    expect(sql).toContain(
      "create or replace function public.replace_stale_writing_draft",
    );
    expect(sql).toContain("set autosave_status = 'superseded'");
    expect(sql).toContain("v_draft.answer_text");
    expect(sql).toContain("v_draft.answer_json");
    expect(sql).toContain(
      "grant execute on function public.replace_stale_writing_draft(uuid, text, bigint, text) to authenticated",
    );
  });

  it("recursively rejects answer, rubric, raw import, and internal snapshot keys", () => {
    expect(sql).toContain(
      "create or replace function private.jsonb_has_forbidden_writing_snapshot_key",
    );
    expect(sql).toContain(
      "private.jsonb_has_forbidden_writing_snapshot_key(v_child)",
    );
    for (const forbidden of [
      "answer_key",
      "resolved_text",
      "model_answer",
      "canonical_answer",
      "accepted_answers",
      "rubric",
      "raw_payload",
      "raw_response_text",
      "content_team_memo",
    ]) {
      expect(sql).toContain(`'${forbidden}'`);
    }
  });

  it("validates snapshot identity and canonical availability before every write", () => {
    expect(sql).toContain(
      "create trigger writing_submissions_validate_canonical_context",
    );
    expect(sql).toContain("canonical_snapshot_identity_mismatch");
    expect(sql).toContain("canonical_snapshot_contains_forbidden_key");
    expect(sql).toContain(
      "perform private.assert_writing_question_submittable( new.problem_id, new.canonical_question_id, new.canonical_import_id, new.canonical_payload_hash, new.question_no, new.user_id )",
    );
    expect(sql).toContain(
      "create or replace function private.assert_writing_submission_snapshot_matches_catalog",
    );
    expect(sql).toContain(
      "from public.get_available_writing_questions( p_item_number, p_problem_id ) canonical",
    );
    expect(sql).toContain(
      "p_snapshot is distinct from v_expected_snapshot",
    );
    expect(sql).toContain("canonical_snapshot_catalog_mismatch");
    expect(sql).toContain("'topik_level', canonical.topik_level");
    expect(sql).toContain("'difficulty', canonical.difficulty");
    expect(sql).toContain(
      "perform private.assert_writing_submission_snapshot_matches_catalog( new.problem_id, new.canonical_question_id, new.canonical_import_id, new.canonical_payload_hash, new.question_no, new.user_id, new.question_snapshot )",
    );
  });

  it("provides a service-role-only canonical writer", () => {
    expect(sql).toContain(
      "create or replace function public.create_external_writing_submission_v2",
    );
    expect(sql).toContain("canonical_submission_context_required");
    expect(sql).toContain(
      "grant execute on function public.create_external_writing_submission_v2(jsonb) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function public.create_external_writing_submission_v2(jsonb) from authenticated",
    );
  });

  it("deduplicates only the exact canonical version for a draft", () => {
    expect(sql.match(/canonical_question_id = submission->>'canonical_question_id'/g)).toHaveLength(2);
    expect(sql.match(/canonical_import_id = \(submission->>'canonical_import_id'\)::bigint/g)).toHaveLength(2);
    expect(sql.match(/canonical_payload_hash = submission->>'canonical_payload_hash'/g)).toHaveLength(2);
    expect(sql.match(/canonical_submission_version_conflict/g)).toHaveLength(2);
    expect(sql).toContain("canonical_draft_version_conflict");
    expect(sql).toContain(
      "v_draft_canonical_import_id is distinct from (submission->>'canonical_import_id')::bigint",
    );
  });

  it("does not erase version evidence on rollback", () => {
    expect(down).not.toMatch(/delete\s+from/);
    expect(down).not.toContain("drop column");
    expect(down).not.toMatch(/drop\s+table/);
    expect(down).not.toContain("drop constraint");
    expect(down).toContain(
      "import fks are retained with the columns",
    );
  });
});
