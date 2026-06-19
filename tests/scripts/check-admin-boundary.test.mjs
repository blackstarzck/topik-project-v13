import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateAdminBoundary,
  findTermsInText,
  formatAdminBoundaryReport,
} from "../../scripts/check-admin-boundary.mjs";

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "v13-admin-boundary-"));
  tempDirs.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  mkdirSync(join(root, "docs", "Wireframe"), { recursive: true });
  mkdirSync(join(root, "docs", "superpowers", "plans"), { recursive: true });
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content, "utf8");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("check-admin-boundary", () => {
  it("fails when v13 source references removed admin island objects", () => {
    const root = createTempRoot();
    write(root, "src/page.ts", "export const rpc = 'admin_update_problem';\n");

    const result = evaluateAdminBoundary({ rootDir: root });

    expect(result.codeFailures).toContainEqual({
      file: "src/page.ts",
      term: "admin_update_problem",
    });
    expect(formatAdminBoundaryReport(result)).toContain(
      "FAIL: v13 code/tests reference admin-owned objects",
    );
  });

  it("allows documented transition route references but still records shared evidence", () => {
    const root = createTempRoot();
    write(
      root,
      "src/app/api/notifications/dispatch-email/route.ts",
      "notification_templates notification_dispatches notification_delivery_attempts",
    );

    const result = evaluateAdminBoundary({ rootDir: root });

    expect(result.codeFailures).toEqual([]);
    expect(result.sharedEvidence).toContainEqual({
      file: "src/app/api/notifications/dispatch-email/route.ts",
      term: "notification_delivery_attempts",
    });
  });

  it("warns for active docs that still contain admin ownership cleanup terms", () => {
    const root = createTempRoot();
    write(
      root,
      "docs/Wireframe/data-usage-index.md",
      "| rpc | public.get_admin_users | admin app |",
    );

    const result = evaluateAdminBoundary({ rootDir: root });

    expect(result.codeFailures).toEqual([]);
    expect(result.docWarnings).toContainEqual({
      file: "docs/Wireframe/data-usage-index.md",
      term: "get_admin_users",
    });
    expect(formatAdminBoundaryReport(result)).toContain("WARN: active docs");
  });

  it("fails when v13 source references expanded topik-ai admin-owned objects", () => {
    const root = createTempRoot();
    write(
      root,
      "src/admin-leak.ts",
      "operation_faqs commerce_coupons system_metadata_groups admin_audit_logs",
    );

    const result = evaluateAdminBoundary({ rootDir: root });

    expect(result.codeFailures).toEqual(
      expect.arrayContaining([
        { file: "src/admin-leak.ts", term: "operation_faqs" },
        { file: "src/admin-leak.ts", term: "commerce_coupons" },
        { file: "src/admin-leak.ts", term: "system_metadata_groups" },
        { file: "src/admin-leak.ts", term: "admin_audit_logs" },
      ]),
    );
  });

  it("finds terms in text without filesystem access", () => {
    expect(
      findTermsInText("inline.ts", "notification_settings user_notifications", [
        "notification_settings",
        "admin_update_problem",
      ]),
    ).toEqual([{ file: "inline.ts", term: "notification_settings" }]);
  });
});
