import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName =
  "20260714140000_writing_problem_identity_registry_cutover.sql";
const rawSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
).toLowerCase();
const rawDown = readFileSync(
  join(process.cwd(), "supabase", "migrations", "down", migrationName),
  "utf8",
).toLowerCase();
const sql = rawSql.replace(/\s+/g, " ");
const down = rawDown.replace(/\s+/g, " ");

describe("writing problem identity registry cutover migration", () => {
  it("creates a private immutable identity registry and deterministic writing registration", () => {
    expect(sql).toContain("create table if not exists private.problem_identities");
    expect(sql).toContain("problem_id uuid primary key");
    expect(sql).toContain("unique (domain, identity_key)");
    expect(sql).toContain("problem_identity_hard_delete_forbidden");
    expect(sql).toContain("problem_identity_immutable");
    expect(sql).toContain(
      "p_problem_id is distinct from (md5(btrim(p_identity_key)))::uuid",
    );
    expect(sql).toContain(
      "grant execute on function private.register_problem_identity(uuid, text, text) to service_role",
    );
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(sql).toContain(
        `revoke all on table private.problem_identities from ${role}`,
      );
    }
  });

  it("provides the narrow v13-owned bridge required by Admin promotion", () => {
    expect(sql).toContain(
      "create or replace function private.ensure_writing_problem_identity",
    );
    expect(sql).toContain("writing_problem_identity_canonical_pin_missing");
    expect(sql).toContain(
      "join private.topik_writing_question_learner_projection question",
    );
    expect(sql).toContain(
      "return private.register_problem_identity( p_problem_id, 'writing', v_question_id )",
    );
    expect(sql).toContain(
      "grant execute on function private.ensure_writing_problem_identity(uuid, text, smallint) to service_role",
    );
  });

  it("backfills both existing problem rows and canonical learner identities", () => {
    expect(sql).toContain("from public.problems problem");
    expect(sql).toContain(
      "from public.topik_writing_question_source_map source_map",
    );
    expect(sql).toContain(
      "source_map.learner_problem_id is distinct from (md5(source_map.question_id))::uuid",
    );
    expect(sql).toContain("existing_problem_identity_backfill_incomplete");
    expect(sql).toContain("canonical_writing_identity_backfill_incomplete");
    expect(sql).toContain("'legacy-public.problems:' || problem.id::text");
    expect(sql).toContain("when problem.domain = 'writing' then 'retired'");
    expect(sql).not.toContain("md5(source_map.legacy_problem_id)");
  });

  it("keeps legacy snapshots learner-safe and separate from canonical version evidence", () => {
    expect(sql).toContain(
      "add column if not exists legacy_cutover_snapshot jsonb",
    );
    expect(sql).toContain("'snapshot_source', 'legacy_cutover'");
    expect(sql).toContain(
      "private.project_writing_mirror_learner_materials",
    );
    expect(sql).toContain(
      "not private.jsonb_has_forbidden_writing_snapshot_key( legacy_cutover_snapshot )",
    );
    expect(sql).toContain("legacy_cutover_snapshot_immutable");
    expect(sql).toContain("legacy_cutover_snapshot_server_backfill_only");

    const draftBackfill = rawSql.slice(
      rawSql.indexOf("update public.writing_drafts draft"),
      rawSql.indexOf("update public.writing_submissions submission"),
    );
    expect(draftBackfill).toContain("set legacy_cutover_snapshot");
    expect(draftBackfill).not.toContain("set canonical_question_id");
    expect(draftBackfill).not.toContain("canonical_import_id =");
    expect(draftBackfill).not.toContain("canonical_payload_hash =");
  });

  it("retargets the complete audited FK graph through not-valid validation", () => {
    for (const table of [
      "problem_assets",
      "problem_attempts",
      "writing_drafts",
      "writing_submissions",
      "recommendation_items",
      "library_items",
      "study_events",
      "pdf_export_quota_usages",
      "pdf_export_quota_resets",
      "writing_submission_metrics",
      ["assign", "ments"].join(""),
    ]) {
      expect(sql).toContain(`public.${table}`);
    }
    expect(sql).toContain("unexpected_public_problems_fk_detected");
    expect(sql).toContain(
      "references private.problem_identities(problem_id)%s%s%s%s not valid",
    );
    expect(sql).toContain("validate constraint %i");
    expect(sql).toContain("public_problems_fk_remains_after_identity_cutover");
    expect(sql.indexOf("validate constraint %i")).toBeLessThan(
      sql.indexOf("drop constraint %i"),
    );
  });

  it("preserves original non-writing delete actions and rejects identity mutation", () => {
    expect(sql).toContain(
      "create or replace function private.preserve_public_problem_delete_semantics",
    );
    expect(sql).toContain("if old.domain = 'writing' then");
    expect(sql).toContain("if v_fk.delete_action = 'c' then");
    expect(sql).toContain("elsif v_fk.delete_action = 'n' then");
    expect(sql).toContain("elsif v_fk.delete_action = 'd' then");
    expect(sql).toContain("elsif v_fk.delete_action in ('a', 'r') then");
    expect(sql).toContain("raise foreign_key_violation");
    expect(sql).toContain(
      "create trigger public_problems_preserve_delete_semantics",
    );
    expect(sql).toContain(
      "public_problem_id_immutable_after_identity_cutover",
    );
    expect(down).toContain(
      "drop trigger if exists public_problems_preserve_delete_semantics",
    );
    expect(down).toContain(
      "drop function if exists private.preserve_public_problem_delete_semantics()",
    );
  });

  it("makes canonical reads permanent while submissions stay fail-closed", () => {
    expect(sql).toContain(
      "rename to writing_read_control_retired_20260714",
    );
    expect(sql).toContain("create table private.writing_submission_control");
    expect(sql).toContain("submission_mode in ('blocked', 'canonical')");
    expect(sql).toContain(
      "create or replace function public.get_writing_submission_control()",
    );
    expect(sql).toContain("drop function if exists public.get_writing_runtime_state()");
    expect(sql).toContain("canonical_submission_evidence_guard_not_installed");
    expect(sql).toContain(
      "drop function if exists private.is_writing_canonical_read_enabled()",
    );
    expect(sql).toContain(
      "drop function if exists public.set_writing_runtime_state( text, text, text, text, text, text )",
    );
    expect(sql).not.toContain("create table private.writing_submission_outbox");
  });

  it("rewrites current and historical consumers away from writing mirror content", () => {
    expect(sql).toContain("and problem.domain <> 'writing'");
    expect(sql).toContain(
      "from public.get_available_writing_questions(null, null) canonical",
    );
    expect(sql).toContain(
      "submission.legacy_cutover_snapshot->>'title'",
    );
    const historyFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function public.get_writing_submission_history_context",
      ),
      rawSql.indexOf(
        "revoke all on function public.get_writing_submission_history_context",
      ),
    );
    expect(historyFunction).not.toContain("join public.problems");
    expect(sql).toContain("list_user_problems_retired_read_dependency_remains");
    expect(sql).toContain("list_user_library_retired_read_dependency_remains");
    expect(sql).toContain("unresolved_writing_content_routine_dependency");
  });

  it("blocks future writing inserts and deletes only after backup and proof gates", () => {
    expect(sql).toContain("writing_content_forbidden_in_public_problems");
    expect(sql).toContain("create trigger public_problems_reject_writing");
    expect(sql).toContain("writing_problem_delete_evidence_incomplete");
    expect(sql).toContain("writing_draft_history_context_incomplete");
    expect(sql).toContain("writing_submission_history_context_incomplete");

    const backupAt = rawSql.indexOf(
      "insert into private.writing_problem_cutover_backup",
    );
    const fkValidationAt = rawSql.indexOf(
      "public_problems_fk_remains_after_identity_cutover",
    );
    const deleteAt = rawSql.indexOf("delete from public.problems problem");
    expect(backupAt).toBeGreaterThan(-1);
    expect(fkValidationAt).toBeGreaterThan(backupAt);
    expect(deleteAt).toBeGreaterThan(fkValidationAt);
    expect(sql).toContain("where problem.domain = 'writing'");
    expect(sql).not.toMatch(/drop function[^;]+cascade/);
  });

  it("provides an honest rollback that restores only exact backups", () => {
    expect(down).toContain(
      "jsonb_populate_record(null::public.problems, backup.problem_row)",
    );
    expect(down).toContain("rollback_backup_corrupt");
    expect(down).toContain("rollback_problem_conflict");
    expect(down).toContain("rollback_unrestorable_reference");
    expect(down).toContain("references public.problems");
    expect(down).toContain("not valid");
    expect(down).toContain("validate constraint %i");
    expect(down).toContain("writing_submission_control_retired_20260714");
    expect(down).toContain(
      "writing_submission_control_audit_rollback_history",
    );
    expect(down).toContain(
      "row_hash = md5(audit_row::text)",
    );
    expect(down).toContain(
      "drop table private.writing_submission_control_audit",
    );
    expect(down).toContain("function_definition");
    expect(down).toContain("policy_backup");
    expect(down).toContain("intentionally retained");
    expect(down).toContain("cron was not rescheduled");
    expect(down).not.toContain("insert into public.problems select canonical");
    expect(down).not.toContain("drop table private.problem_identities");
  });
});
