import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260724140000_pdf_export_request_idempotency.sql",
  ),
  "utf8",
);

describe("PDF export request idempotency migration", () => {
  it("adds a per-user unique request id to the export ledger", () => {
    expect(migration).toMatch(
      /alter table public\.export_files[\s\S]*add column if not exists request_id uuid/i,
    );
    expect(migration).toMatch(
      /create unique index[\s\S]*on public\.export_files \(user_id, request_id\)/i,
    );
    expect(migration).toMatch(/add column if not exists attempt_id uuid/i);
    expect(migration).toMatch(
      /add column if not exists lease_expires_at timestamptz/i,
    );
  });

  it("terminates legacy queued work and releases legacy reservations before request backfill", () => {
    expect(migration).toMatch(
      /update public\.export_files[\s\S]*status = 'failed'[\s\S]*failure_code = 'legacy_unknown'[\s\S]*failed_at = coalesce\([\s\S]*ready_at = null[\s\S]*lease_expires_at = null[\s\S]*request_id is null[\s\S]*status = 'queued'/i,
    );
    expect(migration).toMatch(
      /update public\.pdf_export_quota_usages[\s\S]*status = 'released'[\s\S]*release_reason = 'request_identity_cutover'[\s\S]*request_id is null[\s\S]*status = 'reserved'/i,
    );
    const legacyReservationRelease = migration.indexOf(
      "release_reason = 'request_identity_cutover'",
    );
    const requestBackfill = migration.indexOf(
      "set request_id = gen_random_uuid()",
    );
    expect(legacyReservationRelease).toBeGreaterThan(-1);
    expect(requestBackfill).toBeGreaterThan(legacyReservationRelease);
  });

  it("moves authenticated acquisition behind one narrow JWT RPC", () => {
    expect(migration).toMatch(
      /create (?:or replace )?function public\.acquire_pdf_export_attempt\(\s*p_request_id uuid,\s*p_source_type text,\s*p_source_id uuid,\s*p_request_options jsonb,\s*p_render_source text\s*\)/i,
    );
    expect(migration).toMatch(
      /if v_user_id is null[\s\S]*profiles[\s\S]*status(?:::text)? = 'active'/i,
    );
    expect(migration).toMatch(
      /writing_submissions[\s\S]*comparison_reports[\s\S]*library_items/i,
    );
    expect(migration).toMatch(/pg_advisory_xact_lock/i);
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(
      /v_existing\.options - 'source'[\s\S]*p_request_options/i,
    );
    expect(migration).toMatch(
      /v_existing\.lease_expires_at > now\(\)[\s\S]*errcode = '55P03'/i,
    );
    expect(migration).toMatch(
      /v_attempt_id := gen_random_uuid\(\)[\s\S]*interval '5 minutes'/i,
    );
  });

  it("enforces the route option contract and bounded library selection inside the RPC", () => {
    expect(migration).toMatch(/p_source_type\s+is null/i);
    expect(migration).toMatch(/p_render_source\s+is null/i);
    expect(migration).toMatch(/p_request_options\s+is null/i);
    expect(migration).toMatch(
      /octet_length\(p_request_options::text\)\s*>\s*4096/i,
    );
    expect(migration).toMatch(
      /jsonb_object_keys\(p_request_options\)[\s\S]*<>\s*6/i,
    );
    expect(migration).toMatch(
      /char_length\(btrim\(p_request_options->>'filename'\)\)[\s\S]*between 1 and 60/i,
    );
    expect(migration).toMatch(
      /jsonb_typeof\(p_request_options->'includeAnswers'\)\s*<>\s*'boolean'/i,
    );
    expect(migration).toMatch(
      /jsonb_typeof\(p_request_options->'includeFeedback'\)\s*<>\s*'boolean'/i,
    );
    expect(migration).toMatch(
      /p_request_options->>'layout'\s+not in \('paged', 'continuous'\)/i,
    );
    expect(migration).toMatch(
      /p_request_options->>'orientation'\s+not in \('portrait', 'landscape'\)/i,
    );
    expect(migration).toMatch(
      /jsonb_array_length\(p_request_options->'request_item_ids'\)\s+not between 1 and 6/i,
    );
    expect(migration).not.toMatch(/pg_input_is_valid/i);
    expect(migration).toMatch(
      /v_requested_item_id\s*!~\*\s*'\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$'/i,
    );
    expect(migration).toMatch(
      /v_requested_item_uuid\s*=\s*any\(v_requested_item_ids\)/i,
    );
  });

  it("accepts only exportable library items whose target belongs to the JWT owner", () => {
    expect(migration).toMatch(
      /library_items[\s\S]*item_type(?:::text)?\s+in\s+\('submission',\s*'report'\)/i,
    );
    expect(migration).toMatch(
      /left join public\.writing_submissions submission[\s\S]*item\.item_type(?:::text)?\s*=\s*'submission'[\s\S]*submission\.id\s*=\s*item\.submission_id[\s\S]*submission\.user_id\s*=\s*v_user_id/i,
    );
    expect(migration).toMatch(
      /left join public\.comparison_reports report[\s\S]*item\.item_type(?:::text)?\s*=\s*'report'[\s\S]*report\.id\s*=\s*item\.report_id[\s\S]*report\.user_id\s*=\s*v_user_id/i,
    );
  });

  it("keys quota reservations by request and period", () => {
    expect(migration).toMatch(/add column if not exists request_id uuid/i);
    expect(migration).toMatch(/alter column request_id set not null/i);
    expect(migration).toMatch(
      /unique[\s\S]*user_id[\s\S]*request_id[\s\S]*problem_id[\s\S]*period_start/i,
    );
    expect(migration).toMatch(
      /claim_pdf_export_quota\(\s*p_user_id uuid,\s*p_problem_ids uuid\[\],\s*p_request_id uuid\s*\)/i,
    );
  });

  it("reuses released reservations for the same request without crossing a period boundary", () => {
    expect(migration).toMatch(
      /where user_id = p_user_id[\s\S]*request_id = p_request_id[\s\S]*period_start = v_period_start/i,
    );
    expect(migration).toMatch(
      /set status = 'reserved'[\s\S]*released_at = null[\s\S]*release_reason = null/i,
    );
    expect(migration).toMatch(/pdf_export_request_periods/i);
  });

  it("requires an active JWT owner and an acquired export row before quota binding", () => {
    expect(migration).toMatch(
      /claim_pdf_export_quota[\s\S]*profiles[\s\S]*status(?:::text)? = 'active'/i,
    );
    expect(migration).toMatch(
      /claim_pdf_export_quota[\s\S]*pg_advisory_xact_lock[\s\S]*export_files[\s\S]*user_id = p_user_id[\s\S]*request_id = p_request_id[\s\S]*status(?:::text)? in \('queued', 'ready'\)/i,
    );
    const requestPeriodInsert = migration.indexOf(
      "insert into public.pdf_export_request_periods",
    );
    const acquiredExportCheck = migration.indexOf(
      "claim_pdf_export_quota: export acquisition missing",
    );
    expect(acquiredExportCheck).toBeGreaterThan(-1);
    expect(requestPeriodInsert).toBeGreaterThan(acquiredExportCheck);
  });

  it("re-derives the exact bounded problem set from the acquired source before quota mutation", () => {
    expect(migration).toMatch(
      /select[\s\S]*source_type(?:::text)?[\s\S]*source_id[\s\S]*options[\s\S]*from public\.export_files[\s\S]*request_id = p_request_id/i,
    );
    expect(migration).toMatch(
      /cardinality\(p_problem_ids\)\s+not between 1 and 6/i,
    );
    expect(migration).toMatch(
      /p_problem_ids\s+is distinct from\s+v_problem_ids/i,
    );
    expect(migration).toMatch(
      /writing_submissions[\s\S]*submission\.problem_id[\s\S]*submission\.user_id = p_user_id/i,
    );
    expect(migration).toMatch(
      /comparison_reports[\s\S]*current_submission_id[\s\S]*report_submission\.problem_id[\s\S]*report_submission\.user_id = p_user_id/i,
    );
    expect(migration).toMatch(
      /jsonb_array_elements_text\([\s\S]*v_export_options->'request_item_ids'[\s\S]*\)/i,
    );
    expect(migration).toMatch(
      /v_resolved_item_count\s+is distinct from\s+cardinality\(v_export_item_ids\)/i,
    );
    expect(migration).toMatch(
      /v_problem_ids\s+is distinct from\s+v_expected_problem_ids/i,
    );
    const requestPeriodInsert = migration.indexOf(
      "insert into public.pdf_export_request_periods",
    );
    const exactBindingCheck = migration.indexOf(
      "claim_pdf_export_quota: problem set mismatch",
    );
    expect(exactBindingCheck).toBeGreaterThan(-1);
    expect(requestPeriodInsert).toBeGreaterThan(exactBindingCheck);
  });

  it("keeps claim on authenticated JWT and commit/release on service role", () => {
    expect(migration).toMatch(
      /grant execute on function public\.acquire_pdf_export_attempt\(uuid, text, uuid, jsonb, text\)\s+to authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.acquire_pdf_export_attempt\(uuid, text, uuid, jsonb, text\)\s+from service_role/i,
    );
    expect(migration).toMatch(
      /revoke insert, update, delete on public\.export_files from authenticated/i,
    );
    expect(migration).toMatch(
      /drop policy if exists export_files_owner_(?:insert|update|delete)/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.claim_pdf_export_quota\(uuid, uuid\[\], uuid\)\s+to authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.claim_pdf_export_quota\(uuid, uuid\[\], uuid\)\s+from service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.commit_pdf_export_quota\(uuid, uuid\[\], uuid\)\s+to service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.release_pdf_export_quota\(uuid, uuid\[\], text\)\s+to service_role/i,
    );
    expect(migration).toMatch(
      /export_file\.user_id = p_user_id[\s\S]*export_file\.status = 'ready'/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.complete_pdf_export_attempt\(uuid, uuid\[\], uuid, uuid, text\)\s+to service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.fail_pdf_export_attempt\(uuid, uuid\[\], uuid, uuid, text, text\)\s+to service_role/i,
    );
    expect(migration).toMatch(
      /update public\.export_files[\s\S]*attempt_id = p_attempt_id[\s\S]*status = 'queued'[\s\S]*perform public\.commit_pdf_export_quota/i,
    );
    expect(migration).toMatch(
      /status = 'failed'[\s\S]*attempt_id = p_attempt_id[\s\S]*perform public\.release_pdf_export_quota/i,
    );
    expect(
      migration.match(
        /usage\.request_id is distinct from v_export_request_id/gi,
      )?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
  });
});
