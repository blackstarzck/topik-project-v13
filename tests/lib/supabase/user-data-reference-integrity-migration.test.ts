import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260724120000_user_data_reference_integrity.sql";
const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("user data reference integrity migration", () => {
  it("removes broad learner updates and grants only current learner write columns", () => {
    for (const table of [
      "library_items",
      "recommendation_items",
      "export_files",
    ]) {
      expect(sql).toContain(
        `revoke update on table public.${table} from public, anon, authenticated`,
      );
    }

    expect(sql).toContain(
      "grant update (tags) on table public.library_items to authenticated",
    );
    expect(sql).toContain(
      "grant update (status) on table public.recommendation_items to authenticated",
    );
    expect(sql).toContain(
      "grant update (storage_path, status, ready_at) on table public.export_files to authenticated",
    );

    expect(sql).not.toContain(
      "grant update on table public.library_items to authenticated",
    );
    expect(sql).not.toContain(
      "grant update on table public.recommendation_items to authenticated",
    );
    expect(sql).not.toContain(
      "grant update on table public.export_files to authenticated",
    );
  });

  it("preserves explicit service-role table access for system jobs", () => {
    for (const table of [
      "library_items",
      "recommendation_items",
      "export_files",
    ]) {
      expect(sql).toContain(
        `grant select, insert, update, delete on table public.${table} to service_role`,
      );
    }
  });

  it("validates review set payloads with an ordinary invoker trigger", () => {
    expect(sql).toContain(
      "create or replace function private.validate_review_set_study_event()",
    );
    expect(sql).toContain("security invoker");
    expect(sql).not.toContain(
      "private.validate_review_set_study_event() security definer",
    );
    expect(sql).toContain("jsonb_typeof(new.payload) <> 'object'");
    expect(sql).toContain(
      "jsonb_typeof(new.payload -> 'item_ids') <> 'array'",
    );
    expect(sql).toContain("jsonb_array_length(new.payload -> 'item_ids')");
    expect(sql).toContain("count(distinct selected.item_id)");
    expect(sql).not.toMatch(/count\s*\(\s*distinct\s+item_id\s*\)/);
    expect(sql).toContain("item.user_id = new.user_id");
    expect(sql).toContain(
      "before insert or update of user_id, event_type, payload on public.study_events",
    );
    expect(sql).toContain("for each row execute function");
  });

  it("does not change problem-assets or privileged system ownership", () => {
    expect(sql).not.toContain("problem-assets");
    expect(sql).not.toContain("storage.buckets");
    expect(sql).not.toContain("institution");
    expect(sql).not.toContain("notification");
  });
});
