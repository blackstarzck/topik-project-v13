import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260714141000_writing_submission_outbox.sql";
const rawSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
).toLowerCase();
const rawDown = readFileSync(
  join(process.cwd(), "supabase", "migrations", "down", migrationName),
  "utf8",
).toLowerCase();
const rawLiveTest = readFileSync(
  join(
    process.cwd(),
    "tests",
    "integration",
    "writing-submission-outbox-live.test.ts",
  ),
  "utf8",
).toLowerCase();
const sql = rawSql.replace(/\s+/g, " ");
const down = rawDown.replace(/\s+/g, " ");
const liveTest = rawLiveTest.replace(/\s+/g, " ");

describe("writing submission outbox migration", () => {
  it("keeps provider intents and their answer payload private", () => {
    expect(sql).toContain("create table private.writing_submission_intents");
    expect(sql).toContain("create table private.writing_submission_intent_audit");
    expect(sql).toContain(
      "alter table private.writing_submission_intents force row level security",
    );
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(sql).toContain(
        `revoke all on table private.writing_submission_intents from ${role}`,
      );
      expect(sql).toContain(
        `revoke all on table private.writing_submission_intent_audit from ${role}`,
      );
    }

    const resultFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function private.writing_submission_intent_result",
      ),
      rawSql.indexOf(
        "revoke all on function private.writing_submission_intent_result",
      ),
    );
    expect(resultFunction).toContain("'answer_hash'");
    expect(resultFunction).not.toContain("'answer_text'");
    expect(resultFunction).not.toContain("'answer_json'");

    const auditTable = rawSql.slice(
      rawSql.indexOf("create table private.writing_submission_intent_audit"),
      rawSql.indexOf(
        "alter table private.writing_submission_intent_audit enable row level security",
      ),
    );
    expect(auditTable).not.toContain("answer_text");
    expect(auditTable).not.toContain("answer_json");
    expect(auditTable).toContain("external_id_hash text");
  });

  it("separates the local intent UUID from the provider text identifier", () => {
    expect(sql).toContain("local_submission_id uuid not null unique");
    expect(sql).toContain("local_submission_id = intent_id");
    expect(sql).toContain("provider_dispatch_key = intent_id::text");
    expect(sql).toContain("external_submission_id text unique");
    expect(sql).toContain(
      "add constraint writing_submissions_external_submission_id_key unique (external_submission_id)",
    );
    expect(sql).toContain("set external_submission_id = id::text");
    expect(sql).toContain("writing_submission_external_id_immutable");
    expect(sql).not.toContain("external_submission_id uuid");
  });

  it("prepares an exact version-pinned and deduplicated intent", () => {
    expect(sql).toContain(
      "create or replace function public.prepare_writing_submission_intent",
    );
    expect(sql).toContain("canonical_draft_version_conflict");
    expect(sql).toContain("writing_submission_intent_draft_not_owned");
    expect(sql).toContain(
      "perform private.assert_writing_question_submittable",
    );
    expect(sql).toContain(
      "perform private.assert_writing_submission_snapshot_matches_catalog",
    );
    expect(sql).toContain("dedup_key text not null");
    expect(sql).toContain(
      "create unique index writing_submission_intents_active_dedup_unique on private.writing_submission_intents (dedup_key) where state <> 'failed'",
    );
    expect(sql).not.toContain("dedup_key text not null unique");
    expect(sql).toContain("writing_submission_intent_id_conflict");
    expect(sql).toContain("or intent.dedup_key = v_dedup_key");
    expect(sql).toContain("(intent.state <> 'failed') desc");
    expect(sql).toContain(
      "references public.writing_drafts(id) on delete restrict",
    );
    expect(sql).not.toContain(
      "references public.writing_drafts(id) on delete cascade",
    );
  });

  it("claims pending work once and never authorizes automatic redispatch", () => {
    const claimFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function public.claim_writing_submission_intent",
      ),
      rawSql.indexOf(
        "revoke all on function public.claim_writing_submission_intent",
      ),
    );
    expect(claimFunction).toContain("v_intent.state <> 'pending'");
    expect(claimFunction).toContain(
      "from private.writing_submission_control control",
    );
    expect(claimFunction).toContain("for share");
    expect(claimFunction.indexOf("for share")).toBeLessThan(
      claimFunction.indexOf("for update"),
    );
    expect(claimFunction).toContain("return private.writing_submission_intent_result(v_intent, false)");
    expect(claimFunction).toContain("set state = 'dispatching'");
    expect(claimFunction).toContain("attempt_count = attempt_count + 1");
    expect(claimFunction).toContain("private.writing_submission_intent_result(v_intent, true)");
    expect(sql).not.toContain("dispatching' and new.state = 'pending");
    expect(sql).not.toContain("ambiguous' and new.state = 'dispatching");
  });

  it("makes provider transitions explicit and confines ambiguous resolution to operations", () => {
    expect(sql).toContain(
      "create or replace function public.mark_writing_submission_intent_accepted",
    );
    expect(sql).toContain(
      "create or replace function public.mark_writing_submission_intent_ambiguous",
    );
    expect(sql).toContain(
      "create or replace function public.mark_writing_submission_intent_failed",
    );
    expect(sql).toContain("writing_submission_acceptance_conflict");
    expect(sql).toContain("writing_submission_ambiguous_reason_conflict");
    expect(sql).toContain("writing_submission_failure_reason_conflict");
    expect(sql).toContain(
      "old.state = 'accepted' and new.state = 'materialized'",
    );
    expect(sql).toContain(
      "old.state = 'ambiguous' and new.state in ('accepted', 'failed')",
    );
    expect(sql).not.toContain("old.state = 'ambiguous' and new.state = 'dispatching'");
    expect(sql).not.toContain("old.state = 'failed' and new.state");
  });

  it("materializes only an accepted private capability and supports local recovery", () => {
    const materializeFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function public.materialize_writing_submission_intent",
      ),
      rawSql.indexOf(
        "revoke all on function public.materialize_writing_submission_intent",
      ),
    ).replace(/\s+/g, " ");
    expect(sql).toContain("materialization_token uuid not null");
    expect(sql).toContain("writing_submission_outbox_intent_required");
    expect(materializeFunction).toContain("('accepted', 'materialized')");
    expect(materializeFunction).toContain(
      "select * into v_submission from public.writing_submissions",
    );
    expect(materializeFunction).toContain(
      "app.writing_outbox_materialization_token",
    );
    expect(materializeFunction).toContain(
      "insert into public.writing_submissions",
    );
    expect(materializeFunction).toContain(
      "perform private.ensure_submission_library_item",
    );
    expect(materializeFunction).toContain("set state = 'materialized'");
    expect(materializeFunction).toContain(
      "when lower(v_intent.provider_status) = 'failed' then 'failed'",
    );
    expect(materializeFunction).toContain("where id = v_intent.draft_id");
    expect(sql).toContain(
      "before insert or update of problem_id, question_no, user_id, draft_id, answer_text, answer_json, char_count, parent_submission_id, canonical_question_id, canonical_import_id, canonical_payload_hash, question_snapshot on public.writing_submissions",
    );
    expect(sql).toContain(
      "drop function public.create_external_writing_submission_v2(jsonb)",
    );
    expect(sql).toContain("writing_submission_direct_writer_still_present");
  });

  it("provides a service-only reconciliation path without exposing answer payloads", () => {
    const listStart = rawSql.indexOf(
      "create or replace function public.list_writing_submission_intents_for_reconciliation",
    );
    const reconcileStart = rawSql.indexOf(
      "create or replace function public.reconcile_writing_submission_intent",
    );
    const listBody = rawSql.slice(listStart, reconcileStart);
    expect(listStart).toBeGreaterThan(-1);
    expect(reconcileStart).toBeGreaterThan(listStart);
    expect(listBody).not.toContain("intent.answer_text");
    expect(listBody).not.toContain("intent.answer_json");
    expect(listBody).not.toContain("intent.question_snapshot");
    expect(listBody).not.toContain("external_submission_id text,");
    expect(listBody).toContain("external_id_hash text,");
    expect(listBody).toContain("external_submission_id");
    expect(listBody).toContain("sha256");
    expect(sql).toContain(
      "v_intent.state not in ('dispatching', 'ambiguous')",
    );
    expect(sql).toContain(
      "grant execute on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) to service_role",
    );
    expect(sql).toContain(
      "create or replace function public.list_writing_submission_intent_audit",
    );
    expect(sql).toContain(
      "grant execute on function public.list_writing_submission_intent_audit(uuid) to service_role",
    );
    expect(sql).toContain(
      "revoke all on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) from authenticated",
    );
    expect(down).toContain(
      "drop function if exists public.reconcile_writing_submission_intent",
    );
    expect(down).toContain(
      "drop function if exists public.list_writing_submission_intents_for_reconciliation",
    );
    expect(down).toContain(
      "drop function if exists public.list_writing_submission_intent_audit(uuid)",
    );
  });

  it("requires explicit live-verification evidence and leaves activation manual", () => {
    expect(sql).toContain(
      "create table private.writing_submission_contract_evidence",
    );
    expect(sql).toContain("writing_submission_contract_evidence_immutable");
    expect(sql).toContain(
      "private.assert_writing_outbox_contract_evidence",
    );
    expect(sql).toContain(
      "private.assert_current_writing_outbox_activation",
    );
    expect(sql).toContain("verification_report_hash text not null");
    expect(sql).toContain(
      "create or replace function public.record_writing_submission_contract_evidence",
    );
    expect(sql).toContain("p_verification_report jsonb");
    expect(sql).toContain(
      "p_verification_report->>'contract' is distinct from 'writing-outbox-v2'",
    );
    expect(sql).toContain(
      "p_verification_report->>'schemaversion' is distinct from '2'",
    );
    expect(sql).toContain(
      "p_verification_report->>'contractdigest' is distinct from v_contract_digest",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,concurrentduplicate,onefulfilled}' is distinct from 'true'",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,timeout,quarantined}' is distinct from 'true'",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,deterministicfailure,retrysucceededwithnewintent}' is distinct from 'true'",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,deterministicfailure,providerdispatches}' is distinct from '2'",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,acceptedmarkerfailure,quarantined}' is distinct from 'true'",
    );
    expect(sql).toContain(
      "p_verification_report#>>'{scenarios,materializationrecovery,recovered}' is distinct from 'true'",
    );
    expect(sql).toContain(
      "sha256(convert_to(p_verification_report::text, 'utf8'))",
    );
    expect(sql).toContain("writing_submission_verification_evidence_invalid");
    expect(sql).toContain(
      "grant execute on function public.record_writing_submission_contract_evidence",
    );
    expect(sql).toContain(
      "new.submission_contract_state <> 'local_outbox_verified'",
    );
    expect(sql).toContain("canonical_submission_outbox_evidence_required");
    expect(sql).toContain(
      "writing_outbox_migration_must_leave_submissions_blocked",
    );
    expect(sql).not.toContain(
      "set submission_mode = 'canonical'",
    );
    expect(sql).not.toContain(
      "insert into private.writing_submission_contract_evidence ( evidence_id, evidence_type, contract_digest, verified_by",
    );
    expect(down).toContain(
      "drop function if exists public.record_writing_submission_contract_evidence( text, jsonb, text, text )",
    );
    expect(liveTest).toContain(
      "writing-outbox-v2|prepare|claim-once|accepted-recovery|ambiguous-no-retry|confirmed-failure-new-intent|external-text-id|local-intent-uuid",
    );
    expect(liveTest).toContain('contract: "writing-outbox-v2"');
    expect(liveTest).toContain("contractdigest: outbox_contract_digest");
    expect(liveTest).toContain("schemaversion: 2");
    expect(liveTest).toContain("retrysucceededwithnewintent: true");
    expect(liveTest).toContain("expect(number(liveevidence?.intents)).tobe(6)");
    expect(liveTest).toContain("expect(number(liveevidence?.submissions)).tobe(3)");
    expect(liveTest).toContain("expect(number(liveevidence?.audit_rows)).tobe(21)");
    expect(
      liveTest.indexOf(
        '"close service-only live outbox fault verification"',
      ),
    ).toBeLessThan(liveTest.indexOf("await cleanuprun(config, draftids, intentids)"));
    expect(liveTest).toContain("const recoveryerrors: unknown[] = []");
    expect(liveTest).toContain(
      "primaryerror === undefined ? recoveryerrors : [primaryerror, ...recoveryerrors]",
    );
    expect(liveTest).toContain(
      "if (primaryerror !== undefined) throw primaryerror",
    );
    expect(liveTest).toContain('"live outbox recovery failed."');
  });

  it("opens a service-only verification window without certifying user submissions", () => {
    expect(sql).toContain(
      "constraint writing_submission_control_submission_mode_check check (submission_mode in ('blocked', 'verification', 'canonical'))",
    );
    expect(sql).toContain(
      "constraint_row.conname like 'writing_submission_control_submission_mode_check%'",
    );
    expect(sql).toContain(
      "submission_mode = 'verification' and submission_contract_state = 'unverified' and evidence_id is null",
    );

    const prepareFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function public.prepare_writing_submission_intent",
      ),
      rawSql.indexOf(
        "revoke all on function public.prepare_writing_submission_intent",
      ),
    ).replace(/\s+/g, " ");
    expect(prepareFunction).toContain(
      "v_submission_mode not in ('verification', 'canonical')",
    );
    expect(prepareFunction).toContain(
      "if v_submission_mode = 'canonical' then perform private.assert_current_writing_outbox_activation();",
    );

    const claimFunction = rawSql.slice(
      rawSql.indexOf(
        "create or replace function public.claim_writing_submission_intent",
      ),
      rawSql.indexOf(
        "revoke all on function public.claim_writing_submission_intent",
      ),
    ).replace(/\s+/g, " ");
    expect(claimFunction).toContain(
      "v_submission_mode not in ( 'verification', 'canonical' )",
    );
    expect(claimFunction).toContain(
      "if v_submission_mode = 'canonical' then perform private.assert_current_writing_outbox_activation();",
    );

    expect(sql).toContain(
      "p_submission_mode not in ('blocked', 'verification', 'canonical')",
    );
    expect(sql).toContain("writing_submission_verification_state_invalid");
    expect(sql).toContain(
      "new.submission_mode = 'verification'",
    );
    expect(sql).toContain(
      "p_submission_mode = 'verification'",
    );

    expect(down).toContain(
      "constraint writing_submission_control_submission_mode_check check (submission_mode in ('blocked', 'canonical'))",
    );
    expect(down).toContain(
      "constraint_row.conname like 'writing_submission_control_submission_mode_check%'",
    );
    expect(down).toContain(
      "constraint writing_submission_control_evidence_shape check",
    );
    expect(down).not.toContain(
      "submission_mode in ('blocked', 'verification', 'canonical')",
    );
  });

  it("provides a fail-closed rollback only before the outbox is used", () => {
    expect(down).toContain(
      "writing_outbox_down_requires_blocked_submissions",
    );
    expect(down).toContain("writing_outbox_down_refuses_existing_intents");
    expect(down).toContain("private.writing_submission_intent_audit");
    expect(down).toContain(
      "writing_outbox_down_external_id_not_legacy_compatible",
    );
    expect(down).toContain("function_definition");
    expect(down).toContain("service_role_had_execute");
    expect(down).toContain("drop column external_submission_id");
    expect(down).toContain("submission mode remains blocked");
    expect(down).toContain(
      "lock table private.writing_submission_control in access exclusive mode",
    );
    expect(down).toContain(
      "lock table private.writing_submission_intents in access exclusive mode",
    );
    expect(down).toContain(
      "lock table private.writing_submission_intent_audit in access exclusive mode",
    );
    expect(down).toContain(
      "lock table public.writing_submissions in access exclusive mode",
    );
    expect(down.indexOf("begin;")).toBeLessThan(down.indexOf("do $$"));
    expect(down.trimEnd().endsWith("commit;")).toBe(true);
    expect(down).not.toContain("delete from private.writing_submission_intents");
  });
});
