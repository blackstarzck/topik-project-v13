import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260713084000_writing_cutover_serialization_guard.sql";
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

describe("writing cutover serialization guard migration", () => {
  it("validates only the latest matching reconciliation evidence", () => {
    expect(sql).toContain(
      "order by audit.checked_at desc, audit.audit_id desc limit 1",
    );
    expect(sql).toContain("v_latest.status is distinct from 'pinned'");
    expect(sql).toContain(
      "v_latest.evidence_id is distinct from btrim(p_evidence_id)",
    );
    expect(sql).toContain(
      "canonical_latest_draft_reconciliation_evidence_invalid",
    );
  });

  it("revalidates the frozen candidate count, exact pins, and safe snapshots", () => {
    expect(sql).toContain(
      "canonical_draft_reconciliation_candidate_set_changed",
    );
    expect(sql).toContain("canonical_draft_reconciliation_current_pin_mismatch");
    expect(sql).toContain(
      "canonical_draft_reconciliation_current_snapshot_mismatch",
    );
    expect(sql).toContain(
      "private.get_writing_question_snapshot_for_reconciliation",
    );
  });

  it("serializes runtime, promotion, and exact Cron retirement on one lock", () => {
    expect(sql.match(/pg_advisory_xact_lock\(731971029691967530::bigint\)/g)?.length)
      .toBeGreaterThanOrEqual(4);
    expect(sql).toContain("before insert or update on private.writing_read_control");
    expect(sql).toContain(
      "before insert or update on private.writing_cron_definition_snapshot",
    );
    expect(sql).toContain("writing_mirror_cron_removal_requires_canonical_blocked");
    expect(sql).toContain("writing_mirror_cron_restore_requires_legacy_blocked");
    expect(sql).not.toContain("create trigger writing_mirror_cron_runtime_guard");
  });

  it("verifies unschedule success before accepting retirement evidence", () => {
    expect(sql).toContain("writing_cron_retirement_event_requires_absent_job");
    expect(sql).toContain("before insert on private.writing_scheduler_event");
  });

  it("removes only the corrective interfaces on schema rollback", () => {
    expect(down).toContain(
      "drop trigger if exists writing_cron_retirement_snapshot_guard on private.writing_cron_definition_snapshot",
    );
    expect(down).toContain(
      "drop function if exists private.assert_latest_writing_draft_reconciliation(text)",
    );
    expect(down).not.toContain("delete from");
  });
});
