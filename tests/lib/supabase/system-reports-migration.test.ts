import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationName = "20260723170000_system_reports.sql";
const rawSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", migrationName),
  "utf8",
).toLowerCase();
const sql = rawSql
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")");

describe("system reports migration", () => {
  it("keeps reports in a private table with a non-identifying reference", () => {
    expect(sql).toContain("create table if not exists private.system_reports");
    expect(sql).toContain("id uuid primary key");
    expect(sql).toContain("reference_code text not null unique");
    expect(sql).toContain("idempotency_key uuid not null unique");
    expect(sql).toContain(
      "user_id uuid references auth.users(id) on delete set null",
    );
    expect(sql).toContain("'sr-' || upper(encode(gen_random_bytes(8), 'hex'))");
    expect(sql).not.toContain("user_id::text");
    expect(sql).not.toContain("email ||");
  });

  it("persists only approved report and coarse diagnostics fields", () => {
    for (const field of [
      "category",
      "email",
      "title",
      "message",
      "pathname",
      "browser",
      "os",
      "device_type",
      "viewport_width",
      "viewport_height",
      "locale",
      "app_version",
      "created_at",
    ]) {
      expect(sql).toContain(field);
    }

    for (const forbidden of [
      "ip_address",
      "referrer",
      "user_agent",
      "query_string",
      "url_hash",
    ]) {
      expect(sql).not.toContain(forbidden);
    }

    expect(sql).toContain("category in ('bug', 'question', 'suggestion')");
    expect(sql).toContain(
      "browser in ('chrome', 'safari', 'firefox', 'edge', 'other')",
    );
    expect(sql).toContain(
      "os in ('windows', 'macos', 'ios', 'android', 'linux', 'other')",
    );
    expect(sql).toContain(
      "device_type in ('desktop', 'tablet', 'mobile', 'unknown')",
    );
    expect(sql).toContain("locale in ('ko', 'en', 'vi')");
  });

  it("denies direct access and exposes only a service-role definer RPC", () => {
    expect(sql).toContain(
      "alter table private.system_reports enable row level security",
    );
    expect(sql).toContain(
      "alter table private.system_reports force row level security",
    );
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      expect(sql).toContain(
        `revoke all on table private.system_reports from ${role}`,
      );
    }

    expect(sql).toContain(
      "create or replace function public.submit_system_report",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, private");
    expect(sql).not.toContain("set search_path = public, private, pg_temp");
    for (const role of ["public", "anon", "authenticated"]) {
      expect(sql).toContain(
        `revoke all on function public.submit_system_report(uuid, uuid, text, text, text, text, text, text, text, text, integer, integer, text, text) from ${role}`,
      );
    }
    expect(sql).toContain(
      "grant execute on function public.submit_system_report(uuid, uuid, text, text, text, text, text, text, text, text, integer, integer, text, text) to service_role",
    );
  });

  it("returns the existing row atomically for duplicate idempotency keys", () => {
    expect(sql).toContain("on conflict (idempotency_key) do nothing");
    expect(sql).toContain(
      "where report.idempotency_key = p_idempotency_key",
    );
    expect(sql).toContain("returns table");
    expect(sql).toContain("inserted boolean");
    expect(sql).toContain("v_inserted := true");
    expect(sql).toContain("v_inserted := false");
  });

  it("does not add unapproved workflow or collection systems", () => {
    for (const forbidden of [
      "captcha",
      "rate_limit",
      "retention",
      "report_status",
      "admin_workflow",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});
