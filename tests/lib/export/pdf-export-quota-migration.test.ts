import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260707120000_pdf_export_quota.sql",
  ),
  "utf8",
);

describe("PDF export quota migration", () => {
  it("orders problem ids before taking advisory locks", () => {
    expect(migration).toMatch(/array_agg\(\s*pid\s+order\s+by\s+pid\s*\)/i);
    expect(migration).toMatch(
      /from\s+unnest\([^)]*p_problem_ids[\s\S]+as\s+u\(pid\)/i,
    );
  });

  it("does not expose global reset audit headers to every authenticated user", () => {
    const policyMatch = migration.match(
      /create\s+policy\s+pdf_export_quota_resets_select[\s\S]+?;\s*\n/im,
    );

    expect(policyMatch?.[0]).toBeDefined();
    expect(policyMatch?.[0]).not.toMatch(/reset_scope\s*=\s*'global'/i);
    expect(policyMatch?.[0]).toMatch(/pdf_export_quota_reset_targets/i);
    expect(policyMatch?.[0]).toMatch(/private\.is_platform_admin/i);
  });

  it("requires materialized reset targets when applying reset cutoffs", () => {
    const functionMatch = migration.match(
      /create\s+or\s+replace\s+function\s+public\.claim_pdf_export_quota[\s\S]+?\$\$;/im,
    );

    expect(functionMatch?.[0]).toBeDefined();
    expect(functionMatch?.[0]).not.toMatch(/r\.reset_scope\s*=\s*'global'/i);
    expect(functionMatch?.[0]).toMatch(/pdf_export_quota_reset_targets/i);
  });
});
