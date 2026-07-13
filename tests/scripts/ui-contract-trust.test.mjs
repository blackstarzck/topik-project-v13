import { describe, expect, it } from "vitest";

import {
  computeBaselineApprovalDigest,
  selectScannerAuthority,
  validateScannerMigrationManifest,
} from "../../scripts/lib/ui-contract-trust.mjs";

const digest = (character) => character.repeat(64);

describe("trusted UI scanner authority", () => {
  it("uses the base scanner when the candidate source digest is unchanged", () => {
    expect(
      selectScannerAuthority({
        baseBaseline: { scannerVersion: 2, scannerDigest: digest("a") },
        candidateBaseline: { scannerVersion: 2, scannerDigest: digest("a") },
        candidateDigest: digest("a"),
        baseMigrations: { schemaVersion: 1, migrations: [] },
      }),
    ).toBe("base");
  });

  it("rejects same-version weakening and same-PR migration approval", () => {
    const candidateBaseline = { scannerVersion: 2, scannerDigest: digest("b") };
    const candidateApproval = {
      schemaVersion: 1,
      migrations: [
        {
          fromVersion: 2,
          fromDigest: digest("a"),
          toVersion: 2,
          toDigest: digest("b"),
          toBaselineDigest: computeBaselineApprovalDigest(candidateBaseline),
          approvedBy: "candidate",
          reason: "same PR",
        },
      ],
    };

    expect(() =>
      selectScannerAuthority({
        baseBaseline: { scannerVersion: 2, scannerDigest: digest("a") },
        candidateBaseline,
        candidateDigest: digest("b"),
        baseMigrations: { schemaVersion: 1, migrations: [] },
        candidateMigrations: candidateApproval,
      }),
    ).toThrow(expect.objectContaining({ code: "UI_SCANNER_MIGRATION_NOT_APPROVED" }));
  });

  it("allows only an exact, version-increasing migration already present on base", () => {
    const candidateBaseline = { scannerVersion: 3, scannerDigest: digest("b") };
    const baseMigrations = {
      schemaVersion: 1,
      migrations: [
        {
          fromVersion: 2,
          fromDigest: digest("a"),
          toVersion: 3,
          toDigest: digest("b"),
          toBaselineDigest: computeBaselineApprovalDigest(candidateBaseline),
          approvedBy: "@blackstarzck",
          reason: "Detect a reviewed syntax surface.",
        },
      ],
    };
    expect(validateScannerMigrationManifest(baseMigrations)).toBe(baseMigrations);
    expect(
      selectScannerAuthority({
        baseBaseline: { scannerVersion: 2, scannerDigest: digest("a") },
        candidateBaseline,
        candidateDigest: digest("b"),
        baseMigrations,
      }),
    ).toBe("candidate");
  });

  it("rejects an approved scanner digest when the target baseline was not preapproved", () => {
    const candidateBaseline = { scannerVersion: 3, scannerDigest: digest("b") };
    expect(() =>
      selectScannerAuthority({
        baseBaseline: { scannerVersion: 2, scannerDigest: digest("a") },
        candidateBaseline,
        candidateDigest: digest("b"),
        baseMigrations: {
          schemaVersion: 1,
          migrations: [
            {
              fromVersion: 2,
              fromDigest: digest("a"),
              toVersion: 3,
              toDigest: digest("b"),
              toBaselineDigest: digest("c"),
              approvedBy: "@blackstarzck",
              reason: "Reject a substituted target baseline.",
            },
          ],
        },
      }),
    ).toThrow(expect.objectContaining({ code: "UI_SCANNER_MIGRATION_NOT_APPROVED" }));
  });
});
