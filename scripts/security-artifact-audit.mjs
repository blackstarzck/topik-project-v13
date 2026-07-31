#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  approvedPathAllowlistFromBaseline,
  auditSecurityArtifactChanges,
  auditSecurityArtifacts,
  loadSecurityAuditBaseline,
} from "./lib/security-artifact-audit.mjs";

const SAFE_ERROR_CODES = new Set([
  "BASELINE_RELATION_INVALID",
  "CLI_ARGUMENT_INVALID",
  "EVIDENCE_ALLOWLIST_INVALID",
  "SECURITY_BASELINE_CONFIG_INVALID",
  "HISTORY_LOOKUP_FAILED",
  "HISTORY_PATH_INVALID",
  "REF_INVALID",
  "REF_LOOKUP_FAILED",
  "REPOSITORY_LOOKUP_FAILED",
  "REPOSITORY_PATH_ESCAPE",
  "REPOSITORY_PATH_INVALID",
  "REPOSITORY_PATH_SYMLINK",
  "ROOT_IMAGE_ALLOWLIST_INVALID",
  "TREE_PATH_INVALID",
]);
const INFRASTRUCTURE_ERROR_CODES = new Set([
  "HISTORY_LOOKUP_FAILED",
  "HISTORY_PATH_INVALID",
  "REF_LOOKUP_FAILED",
  "REPOSITORY_LOOKUP_FAILED",
]);

function cliError(code) {
  return Object.assign(new Error(code), { code });
}

function parseArguments(argv) {
  const options = {
    baselineConfigPath: null,
    baselineRef: null,
    mode: null,
    refs: null,
    repoPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    let field;
    if (argument === "--baseline-config") field = "baselineConfigPath";
    else if (argument === "--baseline-ref") field = "baselineRef";
    else if (argument === "--mode") field = "mode";
    else if (argument === "--refs") field = "refs";
    else if (argument === "--repo") field = "repoPath";
    else throw cliError("CLI_ARGUMENT_INVALID");
    if (options[field] !== null || index + 1 >= argv.length) {
      throw cliError("CLI_ARGUMENT_INVALID");
    }
    options[field] = argv[index + 1];
    index += 1;
  }
  const mode = options.mode ?? "report";
  if (
    !new Set(["check", "report"]).has(mode) ||
    typeof options.repoPath !== "string" ||
    options.repoPath.length === 0 ||
    (options.baselineRef !== null && options.refs === null)
  ) {
    throw cliError("CLI_ARGUMENT_INVALID");
  }
  const refs =
    options.refs === null
      ? undefined
      : options.refs.split(",").map((entry) => entry.trim());
  return {
    baselineConfigPath: options.baselineConfigPath,
    baselineRef: options.baselineRef,
    mode,
    refs,
    repoPath: options.repoPath,
  };
}

function errorRecord(code) {
  return {
    schemaVersion: 1,
    recordType: "SecurityArtifactAuditErrorV1",
    code,
  };
}

function safeErrorCode(error) {
  return SAFE_ERROR_CODES.has(error?.code)
    ? error.code
    : "SECURITY_ARTIFACT_AUDIT_FAILED";
}

export function runSecurityArtifactAuditCli({
  audit = auditSecurityArtifacts,
  auditChanges = auditSecurityArtifactChanges,
  argv = process.argv.slice(2),
  loadBaseline = loadSecurityAuditBaseline,
  writeStderr = (value) => process.stderr.write(value),
  writeStdout = (value) => process.stdout.write(value),
} = {}) {
  try {
    const options = parseArguments(argv);
    const auditFunction =
      options.baselineRef === null ? audit : auditChanges;
    // 승인된 예외는 config/security-audit-baseline.json 이 단일 출처다. 이 옵션이
    // 없으면 승격 파이프라인만 예외를 적용하고 CI 는 적용하지 못한다.
    const approvedPathAllowlist =
      options.baselineConfigPath === null
        ? undefined
        : approvedPathAllowlistFromBaseline(
            loadBaseline({ configPath: path.resolve(options.baselineConfigPath) }),
          );
    const report = auditFunction({
      ...(options.baselineRef === null
        ? {}
        : { baselineRef: options.baselineRef }),
      ...(approvedPathAllowlist === undefined ? {} : { approvedPathAllowlist }),
      repoPath: options.repoPath,
      ...(options.refs === undefined ? {} : { refs: options.refs }),
    });
    const output = `${JSON.stringify(report)}\n`;
    if (options.mode === "check" && report.findings.length > 0) {
      writeStderr(output);
      return 1;
    }
    writeStdout(output);
    return 0;
  } catch (error) {
    const code = safeErrorCode(error);
    writeStderr(`${JSON.stringify(errorRecord(code))}\n`);
    return INFRASTRUCTURE_ERROR_CODES.has(code) ? 3 : 2;
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = runSecurityArtifactAuditCli();
}
