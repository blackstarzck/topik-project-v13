import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  computeScannerDigest,
  selectScannerAuthority,
} from "./lib/ui-contract-trust.mjs";

const BASELINE_PATH = "config/ui-contract-baseline.json";
const MIGRATION_PATH = "config/ui-contract-scanner-migrations.json";

function git(rootDir, args) {
  return spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
}

function readBaseJson(rootDir, baseRef, repoPath) {
  const result = git(rootDir, ["show", `${baseRef}:${repoPath}`]);
  if (result.status !== 0) throw new Error("UI_TRUSTED_BASE_READ_FAILED");
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("UI_TRUSTED_BASE_CONFIG_INVALID");
  }
}

function baseHasTrustedRunner(rootDir, baseRef) {
  return (
    git(rootDir, ["cat-file", "-e", `${baseRef}:scripts/run-trusted-ui-contract.mjs`])
      .status === 0
  );
}

export function runTrustedUiContract({ rootDir, baseRef, scannerArgs = [] }) {
  if (!/^[a-f0-9]{40}$/iu.test(baseRef ?? "")) {
    throw new Error("UI_BASE_REF_INVALID");
  }
  const candidateEntry = path.join(rootDir, "scripts", "check-ui-contract.mjs");
  let scannerEntry = candidateEntry;

  if (baseHasTrustedRunner(rootDir, baseRef)) {
    const baseBaseline = readBaseJson(rootDir, baseRef, BASELINE_PATH);
    const baseMigrations = readBaseJson(rootDir, baseRef, MIGRATION_PATH);
    const candidateBaseline = JSON.parse(
      readFileSync(path.join(rootDir, ...BASELINE_PATH.split("/")), "utf8"),
    );
    const candidateDigest = computeScannerDigest({ rootDir });
    const authority = selectScannerAuthority({
      baseBaseline,
      candidateBaseline,
      candidateDigest,
      baseMigrations,
    });
    if (authority === "base") {
      scannerEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-ui-contract.mjs");
    }
  }

  const result = spawnSync(
    process.execPath,
    [scannerEntry, "--mode", "diff-block", "--base-ref", baseRef, ...scannerArgs],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: process.env,
      shell: false,
      windowsHide: true,
    },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 2;
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  const baseIndex = process.argv.indexOf("--base-ref");
  const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.UI_CONTRACT_BASE_REF;
  try {
    process.exitCode = runTrustedUiContract({ rootDir: process.cwd(), baseRef });
  } catch (error) {
    console.error(error?.code ?? error?.message ?? "UI_TRUSTED_SCANNER_FAILED");
    process.exitCode = 2;
  }
}
