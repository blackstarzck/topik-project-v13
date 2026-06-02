import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

type ManifestEntry = {
  iaCode: string;
  descriptionPath: string;
};

type SupportSurface = {
  routeOrHostRoute: string;
};

type SourceMapRow = {
  kind: string;
  iaCode?: string;
  routeOrHostRoute?: string;
  status: string;
};

type DispatchShard = {
  iaCodes: string[];
  subagentEligible: {
    value: boolean;
  };
};

type AuditEntry = {
  finalLabel: string;
  topGaps: string[];
};

function runNode(
  scriptPath: string,
  auditDir: string,
  extraArgs: string[] = [],
  extraEnv: Record<string, string> = {},
) {
  return spawnSync(process.execPath, [scriptPath, "--audit-dir", auditDir, ...extraArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      ...extraEnv,
    },
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("IA audit setup scripts", () => {
  it("builds a 39-entry IA manifest, validates source anchors, and plans one shard owner per IA item", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "ia-audit-"));

    try {
      const manifestRun = runNode("scripts/audit-setup/build-ia-manifest.mjs", auditDir);
      expect(manifestRun.status, manifestRun.stderr || manifestRun.stdout).toBe(0);

      const manifestPath = join(auditDir, "ia-manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = readJson<{ entries: ManifestEntry[]; supportSurfaces: SupportSurface[] }>(manifestPath);
      expect(manifest.entries).toHaveLength(39);
      expect(manifest.entries.map((entry) => entry.iaCode)).toEqual(
        expect.arrayContaining(["X-11", "X-12", "X-13", "X-14", "X-15", "X-16", "X-17", "D-M3", "F-M1"]),
      );
      expect(new Set(manifest.entries.map((entry) => entry.iaCode)).size).toBe(39);
      expect(manifest.entries.every((entry) => entry.descriptionPath.endsWith("description.md"))).toBe(true);
      expect(manifest.entries.every((entry) => entry.descriptionPath.startsWith("docs/Wireframe/"))).toBe(true);
      expect(manifest.supportSurfaces.map((surface) => surface.routeOrHostRoute)).toEqual(
        expect.arrayContaining(["/auth/callback", "/auth/sign-out"]),
      );

      const sourceMapRun = runNode("scripts/audit-setup/validate-ia-source-map.mjs", auditDir);
      expect(sourceMapRun.status, sourceMapRun.stderr || sourceMapRun.stdout).toBe(0);

      const sourceMap = readJson<{
        rows: SourceMapRow[];
        supportRows: SourceMapRow[];
        summary: { totalIa: number };
      }>(join(auditDir, "source-map-results.json"));
      expect(sourceMap.rows.filter((row) => row.kind === "ia")).toHaveLength(39);
      expect(sourceMap.summary.totalIa).toBe(39);
      expect(sourceMap.rows.find((row) => row.iaCode === "X-01")?.status).toBe("PASS");
      expect(sourceMap.rows.find((row) => row.iaCode === "X-11")?.status).toBe("PASS");
      expect(sourceMap.rows.find((row) => row.iaCode === "X-17")?.status).toBe("PASS");
      // /auth/sign-out route handler was implemented in this run; previous
      // version of the test expected FAIL because the handler was missing.
      expect(sourceMap.supportRows.find((row) => row.routeOrHostRoute === "/auth/sign-out")?.status).toBe("PASS");

      const dispatchRun = runNode("scripts/audit-setup/build-agent-dispatch-plan.mjs", auditDir);
      expect(dispatchRun.status, dispatchRun.stderr || dispatchRun.stdout).toBe(0);

      const dispatch = readJson<{ shards: DispatchShard[] }>(join(auditDir, "agent-dispatch-plan.json"));
      const assignedCodes = dispatch.shards.flatMap((shard) => shard.iaCodes);
      expect(assignedCodes).toHaveLength(39);
      expect(new Set(assignedCodes).size).toBe(39);
      expect(dispatch.shards.every((shard) => shard.subagentEligible.value === true)).toBe(true);
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("blocks document receipt validation when receipts are missing", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "ia-audit-"));

    try {
      const manifestRun = runNode("scripts/audit-setup/build-ia-manifest.mjs", auditDir);
      expect(manifestRun.status, manifestRun.stderr || manifestRun.stdout).toBe(0);

      const docsRun = runNode("scripts/audit-setup/verify-doc-receipts.mjs", auditDir);
      expect(docsRun.status).toBe(1);

      const results = readJson<{ status: string; rows: { status: string }[] }>(
        join(auditDir, "doc-receipt-validation-results.json"),
      );
      expect(results.status).toBe("BLOCKED");
      expect(results.rows).toHaveLength(39);
      expect(results.rows.every((row) => row.status === "BLOCKED")).toBe(true);
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("builds a 39-entry doc-receipts skeleton that the validator then fails by design until extractedRequirements are filled", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "ia-audit-"));

    try {
      for (const scriptPath of [
        "scripts/audit-setup/build-ia-manifest.mjs",
        "scripts/audit-setup/build-agent-dispatch-plan.mjs",
      ]) {
        const setup = runNode(scriptPath, auditDir);
        expect(setup.status, setup.stderr || setup.stdout).toBe(0);
      }

      const builderRun = runNode("scripts/audit-setup/build-doc-receipts.mjs", auditDir, [], {
        IA_AUDIT_SKELETON_ONLY: "1",
      });
      expect(builderRun.status, builderRun.stderr || builderRun.stdout).toBe(0);

      const receiptsPath = join(auditDir, "doc-receipts.json");
      expect(existsSync(receiptsPath)).toBe(true);

      const receiptsDoc = readJson<{
        receipts: Array<{
          iaCode: string;
          docsConsulted: string[];
          extractedRequirements: string[];
          wireframe: { status: string };
          assignedShard: string;
          receiptStatus: string;
        }>;
      }>(receiptsPath);

      expect(receiptsDoc.receipts).toHaveLength(39);
      expect(new Set(receiptsDoc.receipts.map((r) => r.iaCode)).size).toBe(39);

      for (const receipt of receiptsDoc.receipts) {
        expect(receipt.extractedRequirements).toEqual([]);
        expect(receipt.receiptStatus).toBe("skeleton");
        expect(receipt.docsConsulted).toEqual(
          expect.arrayContaining(["docs/sitemap.md", "docs/flow/user-flow.md", "docs/prd.md"]),
        );
        expect(receipt.assignedShard).toMatch(/.+/);
        expect(["present", "missing", "not-applicable"]).toContain(receipt.wireframe.status);
      }

      const authReceipt = receiptsDoc.receipts.find((r) => r.iaCode === "A-01");
      expect(authReceipt?.docsConsulted).toContain("docs/development/auth-overview.md");

      const adminReceipt = receiptsDoc.receipts.find((r) => r.iaCode === "H-01");
      expect(adminReceipt?.docsConsulted).toContain("docs/development/backend-auth.md");

      const validatorRun = runNode("scripts/audit-setup/verify-doc-receipts.mjs", auditDir);
      expect(validatorRun.status).toBe(1);

      const validatorResult = readJson<{
        status: string;
        rows: Array<{ status: string; blockingReasons: string[] }>;
      }>(join(auditDir, "doc-receipt-validation-results.json"));
      expect(validatorResult.status).toBe("FAIL");
      expect(validatorResult.rows).toHaveLength(39);
      expect(validatorResult.rows.every((row) => row.status === "FAIL")).toBe(true);
      expect(
        validatorResult.rows.every((row) =>
          row.blockingReasons.some((reason) => reason.toLowerCase().includes("extractedrequirements")),
        ),
      ).toBe(true);
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("merges missing downstream evidence into a non-PASS audit and validates it", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "ia-audit-"));

    try {
      for (const scriptPath of [
        "scripts/audit-setup/build-ia-manifest.mjs",
        "scripts/audit-setup/validate-ia-source-map.mjs",
        "scripts/audit-setup/build-agent-dispatch-plan.mjs",
      ]) {
        const result = runNode(scriptPath, auditDir);
        expect(result.status, result.stderr || result.stdout).toBe(0);
      }

      const mergeRun = runNode("scripts/merge-ia-audit-results.mjs", auditDir);
      expect(mergeRun.status, mergeRun.stderr || mergeRun.stdout).toBe(0);

      const audit = readJson<{ entries: AuditEntry[] }>(join(auditDir, "ia-implementation-audit.json"));
      expect(audit.entries).toHaveLength(39);
      expect(audit.entries.every((entry) => entry.finalLabel !== "PASS")).toBe(true);
      expect(audit.entries.some((entry) => entry.topGaps.includes("missing doc-receipts.json"))).toBe(true);

      const validateRun = runNode("scripts/validate-ia-audit-report.mjs", auditDir);
      expect(validateRun.status, validateRun.stderr || validateRun.stdout).toBe(0);
    } finally {
      rmSync(auditDir, { recursive: true, force: true });
    }
  });
});
