import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

type Inventory = {
  pages: Array<{
    iaCode: string;
    folder: string;
    routeOrHostRoute: string;
    audience: string;
  }>;
  dbObjects: {
    tables: Array<{ name: string; columns: Array<{ name: string }> }>;
    rpcs: Array<{ name: string; schema: string }>;
    storageBuckets: Array<{ name: string }>;
  };
  sourceUsages: Array<{
    kind: string;
    objectName: string;
    sourceFile: string;
  }>;
  pageDataLinks: Array<{
    iaCode: string;
    objectType: string;
    objectName: string;
    columns: string[];
    usage: string;
  }>;
  unmappedDbObjects: Array<{
    objectType: string;
    objectName: string;
    classification: string;
  }>;
  docConflicts: Array<{ id: string; detail: string }>;
  summary: {
    pageCount: number;
    unclassifiedDbObjectCount: number;
  };
};

function runInventory(auditDir: string, extraArgs: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      "scripts/audit-setup/build-wireframe-data-inventory.mjs",
      "--audit-dir",
      auditDir,
      ...extraArgs,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    },
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("wireframe data inventory", () => {
  it("extracts migrations, source DB usage, and page data links for all 39 Wireframe pages", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "wireframe-data-"));

    try {
      const result = runInventory(auditDir);
      expect(result.status, result.stderr || result.stdout).toBe(0);

      const inventoryPath = join(auditDir, "data-inventory.json");
      expect(existsSync(inventoryPath)).toBe(true);

      const inventory = readJson<Inventory>(inventoryPath);
      expect(inventory.summary.pageCount).toBe(39);
      expect(inventory.pages).toHaveLength(39);
      expect(new Set(inventory.pages.map((page) => page.iaCode)).size).toBe(39);
      expect(
        inventory.pages.find((page) => page.iaCode === "X-09"),
      ).toMatchObject({
        routeOrHostRoute: "/settings/notifications",
        audience: "user",
      });
      expect(
        inventory.pages.find((page) => page.iaCode === "X-17"),
      ).toMatchObject({
        routeOrHostRoute: "/auth/callback-fragment",
        audience: "public",
      });

      const profiles = inventory.dbObjects.tables.find(
        (table) => table.name === "profiles",
      );
      expect(profiles?.columns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          "id",
          "app_role",
          "plan_label",
          "status",
          "notification_prefs",
          "bio",
        ]),
      );

      expect(inventory.dbObjects.tables.map((table) => table.name)).toEqual(
        expect.arrayContaining([
          "learning_goals",
          "problems",
          "problem_assets",
          "problem_attempts",
          "writing_drafts",
          "writing_submissions",
          "writing_feedback",
          "feedback_dimension_scores",
          "sentence_feedback",
          "comparison_reports",
          "recommendation_runs",
          "recommendation_items",
          "library_items",
          "study_events",
          "export_files",
          "admin_audit_logs",
        ]),
      );
      expect(
        inventory.dbObjects.rpcs.map((rpc) => `${rpc.schema}.${rpc.name}`),
      ).toEqual(
        expect.arrayContaining([
          "public.get_dashboard_kpi",
          "public.submit_writing_with_feedback",
          "public.create_comparison_report_with_metrics",
          "public.admin_change_user_role",
          "public.admin_toggle_problem_publish",
          "public.get_admin_org_dashboard",
          "private.cleanup_unconfirmed_users",
        ]),
      );
      expect(
        inventory.dbObjects.storageBuckets.map((bucket) => bucket.name),
      ).toEqual(
        expect.arrayContaining([
          "avatars",
          "problem-assets",
          "generated-exports",
        ]),
      );

      expect(inventory.sourceUsages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "table",
            objectName: "writing_feedback",
            sourceFile: "src/app/(workspace)/dashboard/page.tsx",
          }),
          expect.objectContaining({
            kind: "rpc",
            objectName: "get_dashboard_kpi",
            sourceFile: "src/lib/learning/kpi.ts",
          }),
        ]),
      );

      expect(inventory.pageDataLinks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            iaCode: "B-01",
            objectType: "rpc",
            objectName: "get_dashboard_kpi",
            usage: "rpc",
          }),
          expect.objectContaining({
            iaCode: "X-09",
            objectType: "table",
            objectName: "profiles",
            columns: expect.arrayContaining(["notification_prefs"]),
          }),
          expect.objectContaining({
            iaCode: "H-01",
            objectType: "rpc",
            objectName: "admin_toggle_problem_publish",
            usage: "rpc",
          }),
          expect.objectContaining({
            iaCode: "X-08",
            objectType: "rpc",
            objectName: "get_admin_org_dashboard",
            usage: "rpc",
          }),
        ]),
      );

      expect(inventory.unmappedDbObjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            objectName: "private.cleanup_unconfirmed_users",
            classification: "infrastructure/security",
          }),
        ]),
      );
      expect(inventory.summary.unclassifiedDbObjectCount).toBe(0);
      expect(inventory.docConflicts.map((conflict) => conflict.id)).toEqual(
        expect.arrayContaining(["database-schema-drift"]),
      );
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });
});
