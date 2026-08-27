import { spawnSync } from "node:child_process";
import {
  lstat,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  UI_CONTRACT_SCHEMA_VERSION,
  UiContractError,
  applyUiContractExceptions,
  assertCandidateMatchesCurrent,
  compareAgainstBase,
  createUiContractBaseline,
  formatUiContractReport,
  normalizeRepoPath,
  partitionUiContractViolations,
  scanUiContract,
  validateApprovalManifest,
  validateExceptionManifest,
  validateUiContractBaseline,
} from "./lib/ui-contract.mjs";
import {
  computeScannerDigest,
  selectApprovedBaselineTransition,
  selectScannerAuthority,
  validateScannerMigrationManifest,
} from "./lib/ui-contract-trust.mjs";

const BASELINE_PATH = "config/ui-contract-baseline.json";
const APPROVAL_PATH = "config/ui-contract-exception-approvals.json";
const EXCEPTION_PATH = "config/ui-contract-exceptions.json";
const MIGRATION_PATH = "config/ui-contract-scanner-migrations.json";
const CONTRACT_PATHS = [BASELINE_PATH, APPROVAL_PATH, EXCEPTION_PATH, MIGRATION_PATH];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_FILES = 20_000;
const EMPTY_APPROVALS = Object.freeze({
  schemaVersion: UI_CONTRACT_SCHEMA_VERSION,
  approvals: Object.freeze([]),
});
const EMPTY_EXCEPTIONS = Object.freeze({
  schemaVersion: UI_CONTRACT_SCHEMA_VERSION,
  exceptions: Object.freeze([]),
});
const EMPTY_MIGRATIONS = Object.freeze({
  schemaVersion: 1,
  migrations: Object.freeze([]),
});

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function publicError(error) {
  const code = error instanceof UiContractError ? error.code : "UI_CONTRACT_INTERNAL_ERROR";
  const id =
    error instanceof UiContractError &&
    typeof error.details?.id === "string" &&
    error.details.id.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(error.details.id)
      ? error.details.id
      : null;
  return id ? `${code} id=${id}\n` : `${code}\n`;
}

function errorExitCode(error) {
  return error instanceof UiContractError && error.code === "UI_BASELINE_CURRENT_MISMATCH"
    ? 1
    : 2;
}

export async function collectUiSources(rootDir) {
  const canonicalRoot = await realpath(rootDir);
  const sourceRoot = path.join(canonicalRoot, "src");
  let sourceRootStat;
  try {
    sourceRootStat = await lstat(sourceRoot);
  } catch {
    throw new UiContractError("UI_SOURCE_ROOT_INVALID");
  }
  if (sourceRootStat.isSymbolicLink() || !sourceRootStat.isDirectory()) {
    throw new UiContractError("UI_SOURCE_LINK_FORBIDDEN");
  }

  const sources = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const walk = async (directory) => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareNames(left.name, right.name),
    );
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const entryStat = await lstat(fullPath);
      if (entryStat.isSymbolicLink()) {
        throw new UiContractError("UI_SOURCE_LINK_FORBIDDEN");
      }
      if (entryStat.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entryStat.isFile()) {
        throw new UiContractError("UI_SOURCE_NOT_REGULAR");
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (entryStat.size > MAX_SOURCE_BYTES) {
        throw new UiContractError("UI_SOURCE_TOO_LARGE");
      }
      if (sources.length >= MAX_SOURCE_FILES) {
        throw new UiContractError("UI_SOURCE_COUNT_LIMIT");
      }
      const buffer = await readFile(fullPath);
      let content;
      try {
        content = decoder.decode(buffer);
      } catch {
        throw new UiContractError("UI_SOURCE_UTF8_INVALID");
      }
      sources.push({
        path: normalizeRepoPath(fullPath, canonicalRoot),
        content,
      });
    }
  };
  await walk(sourceRoot);
  sources.sort((left, right) => compareNames(left.path, right.path));
  return sources;
}

export function resolveBaseRef(cliBaseRef, env, mode) {
  const envBaseRef = env.UI_CONTRACT_BASE_REF || null;
  const normalize = (value) => {
    if (value === null) return null;
    if (typeof value !== "string" || !/^[a-f0-9]{40}$/iu.test(value)) {
      throw new UiContractError("UI_BASE_REF_INVALID");
    }
    return value.toLowerCase();
  };
  const cliValue = normalize(cliBaseRef);
  const envValue = normalize(envBaseRef);
  if (cliValue && envValue && cliValue !== envValue) {
    throw new UiContractError("UI_BASE_REF_MISMATCH");
  }
  const resolved = cliValue ?? envValue;
  if (env.CI === "true" && (mode === "diff-block" || mode === "error") && !resolved) {
    throw new UiContractError("UI_BASE_REF_REQUIRED");
  }
  return resolved;
}

function runGit(spawnSyncImpl, rootDir, args) {
  const result = spawnSyncImpl("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status === null) {
    throw new UiContractError("UI_GIT_BASE_READ_FAILED");
  }
  return result;
}

function parseJsonText(text, code) {
  try {
    return JSON.parse(text);
  } catch {
    throw new UiContractError(code);
  }
}

export function readBaseContractTuple({
  rootDir,
  baseRef,
  today,
  spawnSyncImpl = spawnSync,
}) {
  const commit = runGit(spawnSyncImpl, rootDir, ["cat-file", "-e", `${baseRef}^{commit}`]);
  if (commit.status !== 0) throw new UiContractError("UI_GIT_BASE_READ_FAILED");

  const presence = new Map();
  for (const repoPath of CONTRACT_PATHS) {
    const result = runGit(spawnSyncImpl, rootDir, ["cat-file", "-e", `${baseRef}:${repoPath}`]);
    if (result.status !== 0 && result.status !== 128) {
      throw new UiContractError("UI_GIT_BASE_READ_FAILED");
    }
    presence.set(repoPath, result.status === 0);
  }
  const presentCount = [...presence.values()].filter(Boolean).length;
  if (presentCount === 0) {
    return Object.freeze({
      bootstrap: true,
      baseline: null,
      approvals: EMPTY_APPROVALS,
      exceptions: EMPTY_EXCEPTIONS,
      migrations: EMPTY_MIGRATIONS,
    });
  }
  if (presentCount !== CONTRACT_PATHS.length) {
    throw new UiContractError("UI_BOOTSTRAP_STATE_INVALID");
  }

  const values = new Map();
  for (const repoPath of CONTRACT_PATHS) {
    const result = runGit(spawnSyncImpl, rootDir, ["show", `${baseRef}:${repoPath}`]);
    if (result.status !== 0) throw new UiContractError("UI_GIT_BASE_READ_FAILED");
    values.set(repoPath, parseJsonText(result.stdout, "UI_BASE_CONFIG_INVALID"));
  }
  const baseline = values.get(BASELINE_PATH);
  const approvals = values.get(APPROVAL_PATH);
  const exceptions = values.get(EXCEPTION_PATH);
  const migrations = values.get(MIGRATION_PATH);
  // A trusted base may use an older scanner during an exact, base-approved migration.
  // selectScannerAuthority binds this historical version to its base-owned digest tuple.
  validateUiContractBaseline(baseline, {
    expectedScannerVersion: baseline?.scannerVersion,
  });
  validateApprovalManifest(approvals, { today, role: "base" });
  validateExceptionManifest(exceptions);
  try {
    validateScannerMigrationManifest(migrations);
  } catch {
    throw new UiContractError("UI_SCANNER_MIGRATION_INVALID");
  }
  return Object.freeze({ bootstrap: false, baseline, approvals, exceptions, migrations });
}

function parseCliOptions(argv) {
  const options = {
    mode: null,
    format: "text",
    baseRef: null,
    writeBaseline: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--mode", "--format", "--base-ref", "--write-baseline"].includes(argument)) {
      throw new UiContractError("UI_CLI_ARGUMENT_INVALID");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new UiContractError("UI_CLI_ARGUMENT_INVALID");
    index += 1;
    if (argument === "--mode") options.mode = value;
    if (argument === "--format") options.format = value;
    if (argument === "--base-ref") options.baseRef = value;
    if (argument === "--write-baseline") options.writeBaseline = value;
  }
  if (!new Set(["report", "diff-block", "error"]).has(options.mode)) {
    throw new UiContractError("UI_CLI_ARGUMENT_INVALID");
  }
  if (!new Set(["text", "json"]).has(options.format)) {
    throw new UiContractError("UI_CLI_ARGUMENT_INVALID");
  }
  if (
    options.writeBaseline &&
    (options.mode !== "report" || options.writeBaseline !== BASELINE_PATH)
  ) {
    throw new UiContractError("UI_CLI_ARGUMENT_INVALID");
  }
  return options;
}

async function readCandidateJson(rootDir, repoPath, code) {
  try {
    return parseJsonText(await readFile(path.join(rootDir, ...repoPath.split("/")), "utf8"), code);
  } catch (error) {
    if (error instanceof UiContractError) throw error;
    throw new UiContractError(code);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

function filterApprovedBaselineTransition(violations, transition) {
  if (!transition) return violations;
  return violations.filter(
    (violation) =>
      !(
        transition.paths.includes(violation.path) &&
        transition.ruleIds.includes(violation.ruleId)
      ),
  );
}

export function serializeStableJson(value) {
  return `${JSON.stringify(stableJson(value), null, 2)}\n`;
}

async function existingBaseline(rootDir) {
  try {
    const baseline = parseJsonText(
      await readFile(path.join(rootDir, ...BASELINE_PATH.split("/")), "utf8"),
      "UI_BASELINE_INVALID",
    );
    if (baseline?.schemaVersion === 1) return null;
    validateUiContractBaseline(baseline);
    return baseline;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof UiContractError && error.code === "UI_BASELINE_VERSION_MISMATCH") {
      return null;
    }
    throw error;
  }
}

export async function runUiContractCli(
  argv,
  {
    cwd = process.cwd(),
    env = process.env,
    clock = () => new Date(),
    spawnSyncImpl = spawnSync,
    computeScannerDigestImpl = computeScannerDigest,
  } = {},
) {
  try {
    const options = parseCliOptions(argv);
    const rootDir = await realpath(cwd);
    const today = clock().toISOString().slice(0, 10);
    const scannerDigest = computeScannerDigestImpl({ rootDir });
    const sources = await collectUiSources(rootDir);
    const raw = scanUiContract(sources);
    const candidateApprovals = await readCandidateJson(
      rootDir,
      APPROVAL_PATH,
      "UI_APPROVAL_INVALID",
    );
    const candidateExceptions = await readCandidateJson(
      rootDir,
      EXCEPTION_PATH,
      "UI_EXCEPTION_INVALID",
    );
    const candidateMigrations = await readCandidateJson(
      rootDir,
      MIGRATION_PATH,
      "UI_SCANNER_MIGRATION_INVALID",
    );
    try {
      validateScannerMigrationManifest(candidateMigrations);
    } catch {
      throw new UiContractError("UI_SCANNER_MIGRATION_INVALID");
    }
    const baseRef = resolveBaseRef(options.baseRef, env, options.mode);
    const useCiAuthority =
      (options.mode === "diff-block" || options.mode === "error") && Boolean(baseRef);
    const trustedMigrationBaseScan = env.UI_TRUSTED_MIGRATION_BASE_SCAN === "1";
    if (trustedMigrationBaseScan && !useCiAuthority) {
      throw new UiContractError("UI_TRUSTED_MIGRATION_MODE_INVALID");
    }
    let baseTuple = null;
    let scannerAuthority = null;
    let approvedBaselineTransition = null;
    let applied;

    if (useCiAuthority) {
      baseTuple = readBaseContractTuple({
        rootDir,
        baseRef,
        today,
        spawnSyncImpl,
      });
      if (
        baseTuple.bootstrap &&
        (candidateApprovals.approvals?.length !== 0 ||
          candidateExceptions.exceptions?.length !== 0 ||
          candidateMigrations.migrations?.length !== 0 ||
          (candidateMigrations.baselineTransitions?.length ?? 0) !== 0)
      ) {
        throw new UiContractError("UI_BOOTSTRAP_STATE_INVALID");
      }
      applied = applyUiContractExceptions(raw.violations, {
        mode: "ci",
        today,
        baseApprovals: baseTuple.approvals,
        candidateApprovals,
        candidateExceptions,
      });
    } else {
      applied = applyUiContractExceptions(raw.violations, {
        mode: "local",
        today,
        candidateApprovals,
        candidateExceptions,
      });
    }

    if (options.writeBaseline) {
      if (applied.policyErrors.length > 0) {
        return {
          exitCode: 1,
          stdout: formatUiContractReport(applied, { format: options.format }),
          stderr: "",
        };
      }
      const previousBaseline = await existingBaseline(rootDir);
      const baseline = createUiContractBaseline(applied.violations, {
        generatedAt: clock().toISOString(),
        previousBaseline,
        scannerDigest,
      });
      await writeFile(
        path.join(rootDir, ...BASELINE_PATH.split("/")),
        serializeStableJson(baseline),
        "utf8",
      );
      return {
        exitCode: applied.policyErrors.length > 0 ? 1 : 0,
        stdout: formatUiContractReport(applied, { format: options.format }),
        stderr: "",
      };
    }

    if (options.mode === "report") {
      return {
        exitCode: applied.policyErrors.length > 0 ? 1 : 0,
        stdout: formatUiContractReport(applied, { format: options.format }),
        stderr: "",
      };
    }

    const candidateBaseline = await readCandidateJson(
      rootDir,
      BASELINE_PATH,
      "UI_BASELINE_INVALID",
    );
    if (baseTuple && !baseTuple.bootstrap) {
      try {
        scannerAuthority = selectScannerAuthority({
          baseBaseline: baseTuple.baseline,
          candidateBaseline,
          candidateDigest: scannerDigest,
          baseMigrations: baseTuple.migrations,
        });
      } catch (error) {
        throw new UiContractError(error?.code ?? "UI_SCANNER_AUTHORITY_INVALID");
      }
    }
    if (trustedMigrationBaseScan) {
      if (scannerAuthority !== "candidate") {
        throw new UiContractError("UI_TRUSTED_MIGRATION_MODE_INVALID");
      }
    } else {
      assertCandidateMatchesCurrent(applied.violations, candidateBaseline, { scannerDigest });
    }
    if (baseTuple && !baseTuple.bootstrap) {
      try {
        approvedBaselineTransition = selectApprovedBaselineTransition({
          baseManifest: baseTuple.migrations,
          baseBaseline: baseTuple.baseline,
          candidateBaseline,
          candidateScannerDigest: scannerDigest,
        });
      } catch (error) {
        throw new UiContractError(error?.code ?? "UI_SCANNER_AUTHORITY_INVALID");
      }
    }
    const canCompareAgainstBase =
      baseTuple &&
      !baseTuple.bootstrap &&
      (scannerAuthority !== "candidate" || trustedMigrationBaseScan);
    const comparisonBaseline =
      trustedMigrationBaseScan && scannerAuthority === "candidate"
        ? candidateBaseline
        : baseTuple?.baseline;
    let blockingViolations;
    if (options.mode === "error") {
      const { structuralViolations, actionableViolations } =
        partitionUiContractViolations(applied.violations);
      const comparedStructuralViolations = canCompareAgainstBase
        ? compareAgainstBase(structuralViolations, comparisonBaseline).newViolations
        : baseTuple?.bootstrap
          ? structuralViolations
          : [];
      const newStructuralViolations = filterApprovedBaselineTransition(
        comparedStructuralViolations,
        approvedBaselineTransition,
      );
      blockingViolations = [...actionableViolations, ...newStructuralViolations];
    } else {
      const newViolations = canCompareAgainstBase
        ? compareAgainstBase(applied.violations, comparisonBaseline).newViolations
        : [];
      blockingViolations = filterApprovedBaselineTransition(
        newViolations,
        approvedBaselineTransition,
      );
    }
    const marker = baseTuple?.bootstrap
      ? "BOOTSTRAP_NOT_INDEPENDENTLY_TAMPER_PROOF"
      : applied.marker;
    const report = {
      marker,
      violations: blockingViolations,
      suppressedViolations: applied.suppressedViolations,
      policyErrors: applied.policyErrors,
    };
    return {
      exitCode:
        blockingViolations.length > 0 || applied.policyErrors.length > 0 ? 1 : 0,
      stdout: formatUiContractReport(report, { format: options.format }),
      stderr: "",
    };
  } catch (error) {
    return {
      exitCode: errorExitCode(error),
      stdout: "",
      stderr: publicError(error),
    };
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = await runUiContractCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
