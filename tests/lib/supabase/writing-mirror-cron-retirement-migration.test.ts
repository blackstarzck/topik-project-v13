import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260713084500_retire_writing_problem_mirror_cron.sql";
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

describe("writing mirror cron retirement migration", () => {
  it("fails closed unless reads are canonical and submissions remain blocked", () => {
    expect(sql).toContain("v_read_mode is distinct from 'canonical'");
    expect(sql).toContain("v_submission_mode is distinct from 'blocked'");
    expect(sql).toContain(
      "writing_mirror_cron_retirement_requires_canonical_blocked",
    );
  });

  it("unschedules exactly the named mirror job and rejects ambiguity", () => {
    expect(sql).toContain("where jobname = 'sync-writing-problems'");
    expect(sql).toContain("writing_mirror_cron_duplicate_jobs");
    expect(sql).toContain("where run.jobid = v_job_id");
    expect(sql).toContain("run.status = 'running'");
    expect(sql).toContain("writing_mirror_cron_run_in_progress");
    expect(sql).toContain("perform cron.unschedule(v_job_id)");
    expect(sql).not.toContain("writing-tasks/ingest");
  });

  it("stores an exact private definition snapshot and redacted retirement evidence", () => {
    expect(sql).toContain(
      "create table if not exists private.writing_scheduler_event",
    );
    expect(sql).toContain(
      "create table if not exists private.writing_cron_definition_snapshot",
    );
    expect(sql).toContain("'writing_cron_retired'");
    expect(sql).toContain("md5(job.command)");
    expect(sql).toContain("command_digest");
    expect(sql).toContain("command text not null");
    expect(sql).toContain("database_name text not null");
    expect(sql).toContain("run_as_username text not null");
    expect(sql).toContain("active boolean not null");
    expect(sql).toContain("nodename text not null");
    expect(sql).toContain("nodeport integer not null");
    expect(sql).toContain(
      "revoke all on table private.writing_cron_definition_snapshot from service_role",
    );
    expect(sql).toContain(
      "writing_mirror_cron_missing_without_retirement_evidence",
    );
  });

  it("retains a fail-closed mirror implementation for explicit audited rollback only", () => {
    expect(sql).toContain("writing_mirror_sync_retired");
    expect(sql).toContain(
      "create or replace function public.run_writing_mirror_rollback_sync",
    );
    expect(sql).toContain("'writing_mirror_rollback_sync'");
    expect(sql).toContain("md5(btrim(p_reason))");
    expect(sql).toContain(
      "grant execute on function public.run_writing_mirror_rollback_sync(text, text) to service_role",
    );
  });

  it("restores the captured definition without hardcoded schedule or command", () => {
    expect(down).toContain(
      "perform private.set_writing_runtime_state( 'legacy', 'blocked', 'unverified', 'down_migration', 'explicit_schema_rollback', null )",
    );
    expect(down.indexOf("perform private.set_writing_runtime_state("))
      .toBeLessThan(down.indexOf("perform cron.schedule_in_database("));
    expect(down).toContain(
      "perform cron.schedule_in_database( 'sync-writing-problems', v_schedule, v_command, v_database_name, null, v_active )",
    );
    expect(down).toContain(
      "v_run_as_username is distinct from current_user",
    );
    expect(down).toContain("writing_mirror_cron_restore_role_mismatch");
    expect(down).not.toContain("'* * * * *'");
    expect(down).toContain("md5(v_command) is distinct from v_command_digest");
    expect(down).toContain(
      "v_actual_command_digest is distinct from v_command_digest",
    );
    expect(down).toContain("v_actual_nodename is distinct from v_nodename");
    expect(down).toContain("v_actual_nodeport is distinct from v_nodeport");
    expect(down).toContain("writing_mirror_cron_restored_definition_mismatch");
    expect(down).toContain("writing_mirror_cron_duplicate_jobs");
    expect(down).toContain("'writing_cron_restored'");
    expect(down).toContain("keep private.writing_scheduler_event");
  });
});
