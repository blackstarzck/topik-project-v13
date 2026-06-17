import { describe, expect, it } from "vitest";

const auditModule = await import("../../scripts/predeploy-data-audit.mjs");

describe("predeploy data audit helpers", () => {
  it("lists the known dev seed markers that must be audited before deploy testing", () => {
    const checks = auditModule.buildSeedAuditChecks();

    expect(checks.map((check) => check.id)).toEqual([
      "audit-seed-problems",
      "wireframe-fixture-problems",
      "published-wireframe-fixtures",
      "dev-q52-seed-promotion",
      "seed-subscription-plans",
      "placeholder-legal-documents",
    ]);
    expect(checks.every((check) => check.table.length > 0)).toBe(true);
  });

  it("marks fixture data as blocking when rows are visible in a predeploy target", () => {
    const checks = auditModule.buildSeedAuditChecks();
    const summary = auditModule.summarizeAuditResults(checks, {
      "audit-seed-problems": 0,
      "wireframe-fixture-problems": 466,
      "published-wireframe-fixtures": 14,
      "dev-q52-seed-promotion": 5,
      "seed-subscription-plans": 3,
      "placeholder-legal-documents": 6,
    });

    expect(summary.blockingIds).toEqual([
      "wireframe-fixture-problems",
      "published-wireframe-fixtures",
      "dev-q52-seed-promotion",
      "placeholder-legal-documents",
    ]);
    expect(summary.warningIds).toEqual(["seed-subscription-plans"]);
    expect(summary.totalBlockingRows).toBe(491);
  });

  it("refuses to target production unless the caller explicitly opts in", () => {
    expect(() =>
      auditModule.assertSafeTarget({ envLabel: "prod", allowProd: false }),
    ).toThrow(/production/i);

    expect(() =>
      auditModule.assertSafeTarget({ envLabel: "staging", allowProd: false }),
    ).not.toThrow();
  });
});
