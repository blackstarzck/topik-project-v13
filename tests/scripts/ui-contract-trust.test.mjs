import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  UI_SCANNER_SOURCE_PATHS,
  computeBaselineApprovalDigest,
  computeScannerDigest,
  selectScannerAuthority,
  validateScannerMigrationManifest,
} from "../../scripts/lib/ui-contract-trust.mjs";
import { runTrustedUiContract } from "../../scripts/run-trusted-ui-contract.mjs";

const digest = (character) => character.repeat(64);

describe("trusted UI scanner authority", () => {
  it("covers the runner and isolated runtime in the scanner digest", () => {
    expect(UI_SCANNER_SOURCE_PATHS).toEqual(
      expect.arrayContaining([
        "scripts/run-trusted-ui-contract.mjs",
        "config/ui-contract-runtime/package.json",
        "config/ui-contract-runtime/package-lock.json",
      ]),
    );
  });

  it("rejects local scanner imports that are outside the digest surface", () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-closure-"));
    for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
      const absolutePath = path.join(rootDir, ...relativePath.split("/"));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export {};\n");
    }
    writeFileSync(
      path.join(rootDir, "scripts", "check-ui-contract.mjs"),
      'import "./unlisted-helper.mjs";\n',
    );
    writeFileSync(path.join(rootDir, "scripts", "unlisted-helper.mjs"), "export {};\n");

    expect(() => computeScannerDigest({ rootDir })).toThrow(
      expect.objectContaining({ code: "UI_SCANNER_SOURCE_UNLISTED" }),
    );
  });

  it.each([
    ["computed import", 'const target = "./unlisted-helper.mjs"; await import(target);\n'],
    ["CommonJS require", 'require("./unlisted-helper.mjs");\n'],
    ["eval", 'eval(\'import("./" + "unlisted-helper.mjs")\');\n'],
    ["Function constructor", 'new Function(\'return import("./" + "unlisted-helper.mjs")\')();\n'],
    [
      "createRequire",
      'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("./unlisted-helper.mjs");\n',
    ],
  ])("rejects %s in trusted scanner sources", (_label, source) => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-dynamic-loader-"));
    for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
      const absolutePath = path.join(rootDir, ...relativePath.split("/"));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export {};\n");
    }
    writeFileSync(path.join(rootDir, "scripts", "check-ui-contract.mjs"), source);
    writeFileSync(path.join(rootDir, "scripts", "unlisted-helper.mjs"), "export {};\n");

    expect(() => computeScannerDigest({ rootDir })).toThrow(
      expect.objectContaining({ code: "UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN" }),
    );
  });

  it.each([
    ["file URL import", 'import "file:///tmp/unlisted-helper.mjs";\n'],
    ["absolute path import", 'import "/tmp/unlisted-helper.mjs";\n'],
    ["unlisted bare import", 'import "unlisted-scanner-package";\n'],
  ])("rejects %s outside the fixed scanner module graph", (_label, source) => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-unlisted-loader-"));
    for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
      const absolutePath = path.join(rootDir, ...relativePath.split("/"));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export {};\n");
    }
    writeFileSync(path.join(rootDir, "scripts", "check-ui-contract.mjs"), source);

    expect(() => computeScannerDigest({ rootDir })).toThrow(
      expect.objectContaining({ code: "UI_SCANNER_SOURCE_UNLISTED" }),
    );
  });

  it.each([
    ["eval alias", 'const execute = eval; execute("export default 1");\n'],
    ["sequence eval", '(0, eval)("export default 1");\n'],
    ["Function alias", 'const Build = Function; new Build("return 1")();\n'],
    [
      "Reflect.construct Function",
      'Reflect.construct(Function, ["return import(\\"./unlisted-helper.mjs\\")"])();\n',
    ],
    [
      "process.getBuiltinModule loader alias",
      'const makeRequire = process.getBuiltinModule("node:module").createRequire; const load = makeRequire(import.meta.url); load("./unlisted-helper.mjs");\n',
    ],
    [
      "Reflect.get eval alias",
      'const execute = Reflect.get(globalThis, "eval"); execute("export default 1");\n',
    ],
    [
      "constructor-chain code generation",
      'const Build = process.constructor.constructor; new Build("return 1")();\n',
    ],
  ])("rejects %s aliases in trusted scanner sources", (_label, source) => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-loader-alias-"));
    for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
      const absolutePath = path.join(rootDir, ...relativePath.split("/"));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export {};\n");
    }
    writeFileSync(path.join(rootDir, "scripts", "check-ui-contract.mjs"), source);

    expect(() => computeScannerDigest({ rootDir })).toThrow(
      expect.objectContaining({ code: "UI_SCANNER_DYNAMIC_LOADING_FORBIDDEN" }),
    );
  });

  it("allows listed static dynamic imports without matching comments or strings", () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-static-loader-"));
    for (const relativePath of UI_SCANNER_SOURCE_PATHS) {
      const absolutePath = path.join(rootDir, ...relativePath.split("/"));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, "export {};\n");
    }
    writeFileSync(
      path.join(rootDir, "scripts", "check-ui-contract.mjs"),
      [
        '// require("./unlisted-helper.mjs")',
        'const example = \'eval("ignored")\';',
        'await import("./lib/ui-contract.mjs");',
        "export {};",
        "",
      ].join("\n"),
    );

    expect(() => computeScannerDigest({ rootDir })).not.toThrow();
  });

  it("never executes an approved candidate scanner from the workspace", () => {
    const runner = readFileSync(
      path.join(process.cwd(), "scripts", "run-trusted-ui-contract.mjs"),
      "utf8",
    );
    expect(runner).toContain('UI_TRUSTED_MIGRATION_BASE_SCAN: "1"');
    expect(runner).not.toContain("materializeApprovedScanner");
  });

  it("fails closed when the base does not contain a trusted runner", () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "ui-contract-bootstrap-"));
    execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir });
    execFileSync("git", ["config", "user.name", "UI Trust Test"], { cwd: rootDir });
    writeFileSync(path.join(rootDir, "README.md"), "bootstrap\n");
    execFileSync("git", ["add", "README.md"], { cwd: rootDir });
    execFileSync("git", ["commit", "-m", "bootstrap"], { cwd: rootDir, stdio: "ignore" });
    const baseRef = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();

    expect(() => runTrustedUiContract({ rootDir, baseRef })).toThrow(
      "UI_TRUSTED_BASE_RUNNER_REQUIRED",
    );
  });

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
