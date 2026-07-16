import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260713083000_writing_canonical_read_security_gate.sql";
const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();
const down = readFileSync(
  join(process.cwd(), "supabase", "migrations", "down", migrationName),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("writing canonical read security gate migration", () => {
  it("uses one DB singleton for read, submission, and verified contract state", () => {
    expect(sql).toContain("create table if not exists private.writing_read_control");
    expect(sql).toContain("read_mode in ('legacy', 'shadow', 'canonical')");
    expect(sql).toContain("submission_mode in ('blocked', 'legacy', 'canonical')");
    expect(sql).toContain("'provider_verified', 'local_outbox_verified'");
    expect(sql).toContain("read_mode = 'canonical' and submission_mode = 'blocked'");
    expect(sql).toContain("canonical_submission_contract_evidence_required");
    expect(sql).toContain(
      "values (true, 'legacy', 'legacy', 'unverified', 'migration', 'initial_state')",
    );
  });

  it("exposes one atomic service-role setter and an application read RPC", () => {
    expect(sql).toContain(
      "create or replace function public.set_writing_runtime_state",
    );
    expect(sql).toContain(
      "grant execute on function public.set_writing_runtime_state(text, text, text, text, text, text) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function public.set_writing_runtime_state(text, text, text, text, text, text) from authenticated",
    );
    expect(sql).toContain(
      "create or replace function public.get_writing_runtime_state()",
    );
    expect(sql).toContain(
      "grant execute on function public.get_writing_runtime_state() to authenticated",
    );
  });

  it("records append-only structured runtime transition evidence", () => {
    expect(sql).toContain(
      "create table if not exists private.writing_runtime_state_audit",
    );
    expect(sql).toContain("'writing_runtime_state_changed'");
    expect(sql).toContain("old_read_mode");
    expect(sql).toContain("new_submission_contract_state");
    expect(sql).toContain("reason_hash");
    expect(sql).toContain("md5(btrim(p_reason))");
    expect(sql).toContain(
      "revoke all on table private.writing_runtime_state_audit from service_role",
    );
  });

  it("validates learner IDs, pinned imports, content parity, and draft snapshots before canonical reads", () => {
    expect(sql).toContain("perform private.assert_writing_canonical_content_parity()");
    expect(sql).toContain("source_map.learner_problem_id is null");
    expect(sql).toContain(
      "left join public.problems anchor on anchor.id = source_map.learner_problem_id",
    );
    expect(sql).toContain("canonical_source_version_links_incomplete");
    expect(sql).toContain("canonical_active_draft_version_pins_incomplete");
    expect(sql).toContain("canonical_draft_reconciliation_evidence_missing");
    expect(sql).toContain("jsonb_typeof(draft.question_snapshot) = 'object'");
    expect(sql).not.toContain("source_map.legacy_problem_id = problem.id");
  });

  it("reconciles active non-empty drafts only on exact retained-mirror/import parity", () => {
    expect(sql).toContain(
      "create or replace function public.reconcile_active_writing_draft_versions",
    );
    expect(sql).toContain("writing_draft_reconciliation_requires_shadow_blocked");
    expect(sql).toContain(
      "private.writing_mirror_learner_projection_matches",
    );
    expect(sql).toContain(
      "private.project_writing_mirror_learner_materials",
    );
    expect(sql).toContain("raw_diagnostic_mismatch_count");
    expect(sql).toContain("diagnostic only");
    expect(sql).toContain(
      "problem.topik_level = (p_canonical_snapshot->>'topik_level')::smallint",
    );
    expect(sql).toContain(
      "problem.difficulty is not distinct from (p_canonical_snapshot->>'difficulty')::smallint",
    );
    expect(sql).toContain(
      "lock table public.topik_writing_question_import in share row exclusive mode",
    );
    expect(sql).toContain(
      "lock table public.topik_writing_question_source_map in share row exclusive mode",
    );
    expect(sql).toContain(
      "lock table public.problems in share row exclusive mode",
    );
    expect(sql).toContain(
      "lock table public.writing_drafts in share row exclusive mode",
    );
    expect(sql).toContain(
      "v_pinned_count is distinct from v_candidate_count",
    );
    expect(sql).toContain(
      "writing_draft_reconciliation_candidate_set_changed",
    );
    expect(sql).toContain("status in ('pinned', 'blocked_mismatch')");
    expect(sql).toContain("if v_mismatch_count = 0 then");
    expect(sql).toContain("update public.writing_drafts");
    expect(sql).toContain(
      "question_snapshot = private.get_writing_question_snapshot_for_reconciliation",
    );
    expect(sql).toContain(
      "create or replace function private.get_writing_question_snapshot_for_reconciliation",
    );
    expect(sql).toContain("question.service_status = 'available'");
    expect(sql).toContain("import_row.payload_hash = p_payload_hash");
    expect(sql).toContain(
      "revoke all on function private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint) from service_role",
    );
    expect(sql).toContain(
      "set_config('app.writing_draft_reconciliation', 'on', true)",
    );
    expect(sql).toContain(
      "current_setting('app.writing_draft_reconciliation', true) = 'on'",
    );
    expect(sql).toContain(
      "raise exception 'writing_draft_reconciliation_snapshot_mismatch'",
    );
    expect(sql).toContain(
      "grant execute on function public.reconcile_active_writing_draft_versions(text, text) to service_role",
    );
  });

  it("does not expose the private runtime singleton even to service role", () => {
    expect(sql).toContain(
      "revoke all on table private.writing_read_control from service_role",
    );
  });

  it("blocks submission independently from reads and requires v2 context in canonical submission mode", () => {
    expect(sql.match(/writing_submission_temporarily_blocked/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/canonical_submission_v2_required/g)).toHaveLength(2);
    expect(sql).toContain("canonical_submission_context_required");
    expect(sql).toContain("canonical_submission_contract_evidence_required");
    expect(sql).not.toContain("grading_version_contract");
  });

  it("rejects active versionless draft writes on canonical anchors", () => {
    expect(sql).toContain("canonical_draft_context_required");
    expect(sql).toContain("new.autosave_status <> 'superseded'");
    expect(sql).toContain("private.is_writing_canonical_read_enabled()");
    expect(sql).toContain("private.is_canonical_writing_problem_anchor(new.problem_id)");
    expect(sql).toContain(
      "answer_text, answer_json, autosave_status, canonical_question_id",
    );
    expect(down).toContain(
      "create or replace function private.populate_writing_draft_question_snapshot()",
    );
  });

  it("allows owner telemetry for learner-visible canonical anchors only", () => {
    expect(sql).toContain(
      "create or replace function private.is_canonical_writing_problem_visible_to_user",
    );
    expect(sql).toContain("p_user_id = (select auth.uid())");
    expect(sql).toContain("private.is_writing_canonical_read_enabled()");
    expect(sql).toContain(
      "from public.get_available_writing_questions(null, p_problem_id)",
    );
    expect(sql).toContain(
      "grant execute on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) to authenticated",
    );
    expect(sql).toContain(
      "drop policy if exists study_events_owner_insert on public.study_events",
    );
    expect(sql).toContain(
      "or private.is_canonical_writing_problem_visible_to_user( study_events.problem_id, (select auth.uid()) )",
    );
    expect(down).toContain(
      "drop function if exists private.is_canonical_writing_problem_visible_to_user(uuid, uuid)",
    );
    expect(down).not.toContain(
      "or private.is_canonical_writing_problem_visible_to_user( study_events.problem_id, (select auth.uid()) )",
    );
  });

  it("switches only current content consumers while retaining history paths", () => {
    expect(sql).toContain("create or replace function public.list_user_problems");
    expect(sql).toContain("from public.get_available_writing_questions(null, null) canonical");
    expect(sql).toContain("create or replace function public.list_user_library_problem_items");
    expect(sql).toContain("coalesce(latest_draft.answer_text, latest_submission.answer_text)");
    expect(sql).toContain("private.is_canonical_writing_problem_anchor");
    expect(sql).toContain(
      "create or replace function public.get_writing_submission_history_context",
    );
    expect(sql).toContain(
      "submission.user_id = (select auth.uid())",
    );
    expect(sql).toContain(
      "nullif(btrim(submission.question_snapshot->>'title'), ''), problem.title",
    );
    expect(sql).toContain(
      "grant execute on function public.get_writing_submission_history_context(uuid[]) to authenticated",
    );
    expect(down).toContain(
      "drop function if exists public.get_writing_submission_history_context(uuid[])",
    );
  });

  it("restores captured legacy interfaces on schema rollback", () => {
    expect(down).toContain("set read_mode = 'legacy'");
    expect(down).toContain("submission_mode = 'legacy'");
    expect(down).toContain("execute v_function.function_definition");
    expect(down).toContain(
      "drop function if exists public.reconcile_active_writing_draft_versions(text, text)",
    );
    expect(down).toContain("drop table if exists private.writing_runtime_state_audit");
    expect(down).not.toMatch(/delete\s+from/);
  });
});
