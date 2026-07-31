// 승인된 보안 감사 기준선(config/security-audit-baseline.json)의 단일 정의.
//
// 이 모듈은 ai-release.mjs 에서 분리해 왔다. 승격 파이프라인(release:start)과
// CI 의 감사 스텝이 같은 승인 인벤토리를 읽어야 하는데, 이전에는 검증·로딩이
// ai-release.mjs 안에만 있어 CI 는 예외를 전혀 적용하지 못했다. 그 결과
// supabase/migrations/down/*.sql 처럼 정당하지만 규칙상 승인되지 않는 경로를
// 추가하는 PR 이 항상 CI 에서 실패했다.
//
// 검증 로직은 복제하지 않는다. 두 소비자 모두 여기의 구현을 쓴다.

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadSecurityAuditEvidence,
  stableFingerprint,
} from "./ai-release-promotion.mjs";
import {
  SECURITY_ARTIFACT_RULE_NAMES,
  unsafeTreePath,
} from "./security-artifact-audit.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const SECURITY_BASELINE_CONFIG_PATH = path.join(
  REPOSITORY_ROOT,
  "config",
  "security-audit-baseline.json",
);
const BASELINE_CONFIG_KEYS = [
  "approvedAt",
  "baselineSha",
  "exceptions",
  "fingerprint",
  "recordType",
  "refs",
  "schemaVersion",
];
const BASELINE_EXCEPTION_KEYS = ["path", "reason", "rule"];
const BASELINE_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const BASELINE_RULE_NAMES = new Set(SECURITY_ARTIFACT_RULE_NAMES);

function cliError(code) {
  return Object.assign(new Error(code), { code });
}

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!plainObject(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function exactIsoTimestamp(value) {
  if (!nonEmptyString(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function validateSecurityBaselineConfig(config) {
  if (!exactKeys(config, BASELINE_CONFIG_KEYS)) {
    throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
  }
  if (
    config.schemaVersion !== 1 ||
    config.recordType !== "SecurityAuditBaselineV1" ||
    !BASELINE_SHA_PATTERN.test(config.baselineSha ?? "") ||
    !exactIsoTimestamp(config.approvedAt) ||
    !Array.isArray(config.refs) ||
    config.refs.length === 0 ||
    config.refs.some((ref) => !nonEmptyString(ref)) ||
    new Set(config.refs).size !== config.refs.length ||
    JSON.stringify(config.refs) !== JSON.stringify([...config.refs].sort()) ||
    !Array.isArray(config.exceptions)
  ) {
    throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
  }
  const seen = new Set();
  for (const exception of config.exceptions) {
    if (
      !exactKeys(exception, BASELINE_EXCEPTION_KEYS) ||
      unsafeTreePath(exception.path) ||
      !BASELINE_RULE_NAMES.has(exception.rule) ||
      !nonEmptyString(exception.reason)
    ) {
      throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
    }
    const key = `${exception.path}\0${exception.rule}`;
    if (seen.has(key)) throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
    seen.add(key);
  }
  const payload = structuredClone(config);
  delete payload.fingerprint;
  if (
    !/^[a-f0-9]{64}$/u.test(config.fingerprint ?? "") ||
    config.fingerprint !== stableFingerprint(payload)
  ) {
    throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
  }
  return config;
}

export function loadSecurityAuditBaseline({
  configPath = SECURITY_BASELINE_CONFIG_PATH,
  allowedRoot = REPOSITORY_ROOT,
} = {}) {
  let parsed;
  try {
    parsed = loadSecurityAuditEvidence({ evidencePath: configPath, allowedRoot });
  } catch {
    throw cliError("SECURITY_BASELINE_CONFIG_INVALID");
  }
  return validateSecurityBaselineConfig(parsed);
}

// 감사 함수가 받는 (path, rule) 쌍만 남긴다. reason 은 사람이 읽는 승인 근거라
// 감사 입력에 넘기지 않는다.
export function approvedPathAllowlistFromBaseline(config) {
  return validateSecurityBaselineConfig(config).exceptions.map((exception) => ({
    path: exception.path,
    rule: exception.rule,
  }));
}
