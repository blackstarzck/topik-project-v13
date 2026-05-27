import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../../../src/lib/supabase/types";

describe("Phase 6 types snapshot — 4 new tables + 1 column + 4 new RPCs", () => {
  it("library_items row has polymorphic *_id columns + tags + item_type union", () => {
    type Row = Tables<"library_items">;
    const sample: Row = {
      id: "x",
      user_id: "u",
      item_type: "submission",
      attempt_id: null,
      submission_id: "s",
      report_id: null,
      export_id: null,
      problem_id: null,
      note: null,
      tags: [],
      saved_at: "2026-05-22T00:00:00Z",
    };
    expect(sample.item_type).toBe("submission");
    expectTypeOf<Row["item_type"]>().toEqualTypeOf<
      "attempt" | "submission" | "report" | "export" | "problem"
    >();
  });

  it("library_items insert allows defaulted columns to be omitted", () => {
    const insert: TablesInsert<"library_items"> = {
      user_id: "u",
      item_type: "report",
      report_id: "r",
    };
    expect(insert.report_id).toBe("r");
  });

  it("export_files row has source_type union + status union + options Json", () => {
    type Row = Tables<"export_files">;
    expectTypeOf<Row["source_type"]>().toEqualTypeOf<
      "submission" | "report" | "library_selection"
    >();
    expectTypeOf<Row["status"]>().toEqualTypeOf<
      "queued" | "ready" | "failed"
    >();
    const sample: Row = {
      id: "e",
      user_id: "u",
      source_type: "library_selection",
      source_id: null,
      storage_path: "browser-print://abc",
      options: { source: "browser_print" },
      status: "ready",
      created_at: "2026-05-22T00:00:00Z",
      ready_at: "2026-05-22T00:00:01Z",
    };
    expect(sample.status).toBe("ready");
  });

  it("study_events row has event_type string + FK columns nullable", () => {
    type Row = Tables<"study_events">;
    expectTypeOf<Row["event_type"]>().toBeString();
    const sample: Row = {
      id: "ev",
      user_id: "u",
      event_type: "submission_submitted",
      occurred_at: "2026-05-22T00:00:00Z",
      problem_id: null,
      submission_id: "s",
      attempt_id: null,
      session_id: null,
      payload: { sentence_count: 5 },
    };
    expect(sample.event_type).toBe("submission_submitted");
  });

  it("admin_audit_logs row has diff + payload Json columns", () => {
    type Row = Tables<"admin_audit_logs">;
    const sample: Row = {
      id: "log",
      admin_user_id: "admin-id",
      action: "profile.role_change",
      target_table: "profiles",
      target_id: "user-id",
      diff: { from: "learner", to: "content_admin" },
      payload: { target_user_id: "user-id" },
      created_at: "2026-05-22T00:00:00Z",
    };
    expect(sample.action).toBe("profile.role_change");
  });

  it("profiles.notification_prefs column exists and is required (Json)", () => {
    type Row = Tables<"profiles">;
    expectTypeOf<Row["notification_prefs"]>().not.toBeNever();
    // insert can omit the defaulted column
    const insert: TablesInsert<"profiles"> = { id: "u" };
    expect(insert.id).toBe("u");
    // update accepts a partial Json
    const update: TablesUpdate<"profiles"> = {
      notification_prefs: { weekly_summary: true },
    };
    expect(update.notification_prefs).toBeTruthy();
  });

  it("Functions snapshot covers 4 Phase 6 RPCs", () => {
    type Fns = Database["public"]["Functions"];
    expectTypeOf<Fns["get_dashboard_kpi"]["Returns"]>().toEqualTypeOf<
      {
        today_attempts: number;
        total_attempts: number;
        exam_days_left: number | null;
        streak_days: number;
      }[]
    >();
    expectTypeOf<Fns["get_admin_org_dashboard"]["Returns"]>().toMatchTypeOf<
      Array<{
        learner_count: number;
        active_7d_count: number;
        submissions_7d_count: number;
      }>
    >();
    expectTypeOf<Fns["admin_change_user_role"]["Args"]>().toEqualTypeOf<{
      target_id: string;
      new_role: string;
    }>();
    expectTypeOf<Fns["admin_toggle_problem_publish"]["Args"]>().toEqualTypeOf<{
      problem_id: string;
      new_status: string;
    }>();
  });
});
