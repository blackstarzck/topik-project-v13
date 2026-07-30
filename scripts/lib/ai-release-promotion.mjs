import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const RUN_ID_PATTERN = /^promotion-[0-9]{8}-[a-f0-9]{8}$/u;
const BRANCH_PATTERN = /^chore\/promote-[0-9]{8}-[a-f0-9]{8}$/u;
const SECRET_KEY_PATTERN =
  /(authorization|cookie|credential|password|private.?key|secret|service.?role|token|thread.?id|session.?id|raw.?output|command.?output)/iu;
const SECRET_VALUE_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
];
export const PROMOTION_STATES = Object.freeze([
  "BOOTSTRAP_REQUIRED",
  "PLANNED",
  "CANDIDATE_VERIFIED",
  "STG_PR_OPEN",
  "STG_READY",
  "DB_BASELINE_REQUIRED",
  "DB_GATE_BLOCKED",
  "AWAITING_PROD_APPROVAL",
  "PROD_APPROVED",
  "MAIN_PR_OPEN",
  "PRODUCTION_VERIFYING",
  "ALIAS_ROLLBACK_REQUIRED",
  "PRODUCTION_FAILED",
  "RELEASED",
  "CLEANED",
  "PRESERVED",
  "SECURITY_INCIDENT_BLOCKED",
]);
const STATES = new Set(PROMOTION_STATES);

export const PROMOTION_PROFILES = Object.freeze({
  black: Object.freeze({
    name: "black",
    remote: "origin",
    repositoryIdentity: "blackstarzck/topik-project-v13",
    authLogin: "blackstarzck",
    baseBranch: "main",
  }),
  keduall: Object.freeze({
    name: "keduall",
    remote: "collab",
    repositoryIdentity: "keduall/topik-project-v13",
    authLogin: "guestkeduall-design",
    stgBranch: "stg",
    mainBranch: "main",
  }),
});

const RECORD_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "runId",
  "contractVersion",
  "contractFingerprint",
  "profileFingerprint",
  "source",
  "target",
  "security",
  "migration",
  "approval",
  "vercel",
  "workspace",
  "state",
  "revision",
  "blocker",
  "journal",
  "timings",
  "createdAt",
  "updatedAt",
  "fingerprint",
]);
const SOURCE_KEYS = new Set([
  "profile",
  "remote",
  "repositoryIdentity",
  "authLogin",
  "baseBranch",
  "sha",
  "treeHash",
]);
const TARGET_KEYS = new Set([
  "profile",
  "remote",
  "repositoryIdentity",
  "authLogin",
  "stgBranch",
  "mainBranch",
  "stgBaseSha",
  "candidateBranch",
  "candidateSha",
  "candidateParents",
  "stgSha",
  "mainSha",
]);
const SECURITY_KEYS = new Set(["auditFingerprint", "refs", "findingCount"]);
const MIGRATION_KEYS = new Set([
  "manifestDigest",
  "evidenceDigest",
  "status",
  "autoApplyEnabled",
]);
const APPROVAL_KEYS = new Set([
  "mode",
  "consecutiveSuccessCount",
  "approvalFingerprint",
  "policyFingerprint",
]);
const VERCEL_KEYS = new Set([
  "project",
  "environment",
  "deploymentId",
  "commitSha",
  "target",
  "alias",
  "domain",
  "smokeStatus",
  "rollbackDeploymentId",
]);
const WORKSPACE_KEYS = new Set(["ownership", "cleanupStatus"]);
const JOURNAL_KEYS = new Set(["event", "at", "evidenceDigest"]);
const TIMING_KEYS = new Set(["stage", "durationMs"]);
const APPROVAL_POLICY_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "contractFingerprint",
  "profileFingerprint",
  "mode",
  "consecutiveSuccessCount",
  "lastResetReason",
  "revision",
  "fingerprint",
]);
const MIGRATION_EVIDENCE_KEYS = new Set([
  "productionProjectIdentityHash",
  "remoteTrackerDigest",
  "trackerIsExactManifestPrefix",
  "schemaRpcRlsGrantFingerprint",
  "appliedMigrationManifestDigest",
  "backupPitrEvidenceDigest",
  "pinnedToolchainDigest",
  "previousMaxTimestamp",
  "newMigrations",
  "historicalChanges",
  "dryRunDigest",
  "applyDigest",
  "destructiveSql",
  "grantRevocation",
  "compatibilityBreak",
  "nMinusOneTopikDevPassed",
  "nTopikDevPassed",
  "autoApplyEnabled",
]);
const NEW_MIGRATION_KEYS = new Set(["path", "timestamp", "sha256"]);
const HISTORICAL_CHANGE_KEYS = new Set(["path", "change"]);
const SECURITY_AUDIT_KEYS = new Set([
  "schemaVersion",
  "recordType",
  "refs",
  "findings",
  "summary",
  "snapshots",
  "fingerprint",
]);
const SECURITY_DIFF_AUDIT_KEYS = new Set([...SECURITY_AUDIT_KEYS, "baseline"]);
const SECURITY_AUDIT_RECORD_TYPES = new Set([
  "SecurityArtifactAuditV1",
  "SecurityArtifactDiffAuditV1",
]);
const SECURITY_SUMMARY_KEYS = new Set(["refCount", "scannedPathCount", "findingCount"]);
const SECURITY_SNAPSHOT_KEYS = new Set(["ref", "commitHash"]);
const SECURITY_BASELINE_KEYS = new Set(["ref", "commitHash"]);

export class PromotionError extends Error {
  constructor(code) {
    super(code);
    this.name = "PromotionError";
    this.code = code;
  }
}

function fail(code) {
  throw new PromotionError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprint(value) {
  return digest(JSON.stringify(stableValue(value)));
}

export { fingerprint as stableFingerprint };

function recordFingerprint(record) {
  const payload = structuredClone(record);
  delete payload.fingerprint;
  return fingerprint(payload);
}

function issue(code, field) {
  return { code, path: field };
}

function validTimestamp(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function checkClosed(value, allowed, prefix, errors) {
  if (!isPlainObject(value)) {
    errors.push(issue("INVALID_OBJECT", prefix));
    return;
  }
  for (const key of Object.keys(value)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (!allowed.has(key)) errors.push(issue("UNKNOWN_FIELD", field));
    if (SECRET_KEY_PATTERN.test(key)) errors.push(issue("SECRET_FIELD_FORBIDDEN", field));
  }
}

function collectSecrets(value, prefix, errors) {
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push(issue("SECRET_VALUE_FORBIDDEN", prefix));
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => collectSecrets(entry, `${prefix}.${index}`, errors));
  } else if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        errors.push(issue("SECRET_FIELD_FORBIDDEN", prefix ? `${prefix}.${key}` : key));
      }
      collectSecrets(entry, prefix ? `${prefix}.${key}` : key, errors);
    });
  }
}

export function scanForSecrets(value) {
  const errors = [];
  collectSecrets(value, "", errors);
  return uniqueErrors(errors);
}

function validShaOrNull(value) {
  return value === null || SHA_PATTERN.test(value ?? "");
}

function uniqueErrors(errors) {
  return errors.filter(
    (entry, index) =>
      errors.findIndex((other) => other.code === entry.code && other.path === entry.path) === index,
  );
}

export function parseRepositoryIdentity(remoteUrl) {
  if (typeof remoteUrl !== "string" || remoteUrl.length > 2048) {
    fail("REMOTE_URL_INVALID");
  }
  let owner;
  let repository;
  const scp = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(remoteUrl);
  if (scp) {
    [, owner, repository] = scp;
  } else {
    let parsed;
    try {
      parsed = new URL(remoteUrl);
    } catch {
      fail("REMOTE_URL_INVALID");
    }
    if (parsed.hostname.toLowerCase() !== "github.com") fail("REMOTE_HOST_INVALID");
    if (parsed.protocol === "https:" && (parsed.username || parsed.password)) {
      fail("REMOTE_URL_CONTAINS_USERINFO");
    }
    if (parsed.protocol === "ssh:") {
      if (parsed.password || (parsed.username && parsed.username !== "git")) {
        fail("REMOTE_URL_CONTAINS_USERINFO");
      }
    } else if (parsed.protocol !== "https:") {
      fail("REMOTE_URL_INVALID");
    }
    const segments = parsed.pathname.replace(/^\/+/u, "").replace(/\.git$/iu, "").split("/");
    if (segments.length !== 2) fail("REMOTE_URL_INVALID");
    [owner, repository] = segments;
  }
  if (!/^[A-Za-z0-9_.-]+$/u.test(owner) || !/^[A-Za-z0-9_.-]+$/u.test(repository)) {
    fail("REMOTE_URL_INVALID");
  }
  return `${owner}/${repository}`;
}

export function verifyRepositoryProfile({ profile, remoteUrl, authLogin }) {
  if (!isPlainObject(profile)) fail("REPOSITORY_PROFILE_INVALID");
  if (parseRepositoryIdentity(remoteUrl).toLowerCase() !== profile.repositoryIdentity.toLowerCase()) {
    fail("REPOSITORY_IDENTITY_MISMATCH");
  }
  if (authLogin !== profile.authLogin) fail("AUTH_LOGIN_MISMATCH");
  return { ok: true, profile: profile.name };
}

function securityBaselineValidation(audit, expectedBaselineSha) {
  const errors = [];
  checkClosed(audit.baseline, SECURITY_BASELINE_KEYS, "baseline", errors);
  if (
    errors.length > 0 ||
    !isPlainObject(audit.baseline) ||
    typeof audit.baseline.ref !== "string" ||
    audit.baseline.ref.length === 0 ||
    !DIGEST_PATTERN.test(audit.baseline.commitHash ?? "") ||
    audit.refs.includes(audit.baseline.ref)
  ) {
    return { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" };
  }
  if (
    typeof expectedBaselineSha !== "string" ||
    !SHA_PATTERN.test(expectedBaselineSha)
  ) {
    return { ok: false, code: "SECURITY_AUDIT_BASELINE_REQUIRED" };
  }
  if (audit.baseline.commitHash !== digest(expectedBaselineSha.toLowerCase())) {
    return { ok: false, code: "SECURITY_AUDIT_BASELINE_MISMATCH" };
  }
  return { ok: true, code: "SECURITY_AUDIT_BASELINE_BOUND" };
}

function securityAuditValidation(
  audit,
  expectedRefs,
  {
    sourceSha = null,
    stgBaseSha = null,
    stgReady = false,
    expectedBaselineSha = null,
  } = {},
) {
  if (!isPlainObject(audit)) return { ok: false, code: "SECURITY_AUDIT_REQUIRED" };
  const diffAudit = audit.recordType === "SecurityArtifactDiffAuditV1";
  const errors = [];
  checkClosed(
    audit,
    diffAudit ? SECURITY_DIFF_AUDIT_KEYS : SECURITY_AUDIT_KEYS,
    "",
    errors,
  );
  if (audit.schemaVersion !== 1 || !SECURITY_AUDIT_RECORD_TYPES.has(audit.recordType)) {
    return { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" };
  }
  if (errors.length > 0) return { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" };
  const payload = structuredClone(audit);
  delete payload.fingerprint;
  if (!DIGEST_PATTERN.test(audit.fingerprint ?? "") ||
      audit.fingerprint !== digest(JSON.stringify(payload))) {
    return { ok: false, code: "SECURITY_AUDIT_FINGERPRINT_INVALID" };
  }
  if (!Array.isArray(audit.refs) || !Array.isArray(audit.findings) ||
      !Array.isArray(audit.snapshots) || !isPlainObject(audit.summary)) {
    return { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" };
  }
  checkClosed(audit.summary, SECURITY_SUMMARY_KEYS, "summary", errors);
  audit.snapshots.forEach((snapshot, index) =>
    checkClosed(snapshot, SECURITY_SNAPSHOT_KEYS, `snapshots.${index}`, errors));
  collectSecrets(audit, "", errors);
  const invalidSnapshot = audit.snapshots.some((snapshot) => {
    return (
      !isPlainObject(snapshot) ||
      typeof snapshot.ref !== "string" ||
      !DIGEST_PATTERN.test(snapshot.commitHash ?? "") ||
      !audit.refs.includes(snapshot.ref)
    );
  });
  if (errors.length > 0 ||
      !Number.isSafeInteger(audit.summary.refCount) ||
      !Number.isSafeInteger(audit.summary.scannedPathCount) ||
      !Number.isSafeInteger(audit.summary.findingCount) ||
      audit.summary.refCount !== audit.refs.length ||
      audit.snapshots.length !== audit.refs.length ||
      invalidSnapshot ||
      new Set(audit.snapshots.map((snapshot) => snapshot.ref)).size !== audit.refs.length ||
      audit.summary.findingCount !== audit.findings.length) {
    return { ok: false, code: "SECURITY_AUDIT_SCHEMA_INVALID" };
  }
  if (diffAudit) {
    const baseline = securityBaselineValidation(audit, expectedBaselineSha);
    if (!baseline.ok) return baseline;
  }
  const actualRefs = [...audit.refs].sort();
  const requiredRefs = [...expectedRefs].sort();
  if (JSON.stringify(actualRefs) !== JSON.stringify(requiredRefs)) {
    return { ok: false, code: "SECURITY_AUDIT_REFS_MISMATCH" };
  }
  const snapshots = new Map(audit.snapshots.map((snapshot) => [snapshot.ref, snapshot.commitHash]));
  if (sourceSha !== null && snapshots.get("origin/main") !== digest(sourceSha)) {
    return { ok: false, code: "SECURITY_AUDIT_SOURCE_STALE" };
  }
  if (stgBaseSha !== null) {
    const targetRef = stgReady ? "collab/stg" : "collab/main";
    if (snapshots.get(targetRef) !== digest(stgBaseSha)) {
      return { ok: false, code: "SECURITY_AUDIT_STG_STALE" };
    }
  }
  if (audit.findings.length !== 0 || audit.summary.findingCount !== 0) {
    return { ok: false, code: "SECURITY_INCIDENT_BLOCKED" };
  }
  return { ok: true, code: "SECURITY_AUDIT_CLEAR" };
}

export function validateSecurityAuditEvidence(
  audit,
  expectedRefs = ["collab/main", "collab/stg", "origin/main"],
  bindings = {},
) {
  return securityAuditValidation(audit, expectedRefs, bindings);
}

function pathContains(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function loadSecurityAuditEvidence({ evidencePath, allowedRoot }) {
  const root = path.resolve(allowedRoot);
  const target = path.resolve(evidencePath);
  if (!pathContains(root, target)) fail("SECURITY_EVIDENCE_PATH_ESCAPE");
  let rootReal;
  let targetReal;
  try {
    if (lstatSync(root).isSymbolicLink()) fail("SECURITY_EVIDENCE_SYMLINK");
    if (lstatSync(target).isSymbolicLink()) fail("SECURITY_EVIDENCE_SYMLINK");
    rootReal = realpathSync.native(root);
    targetReal = realpathSync.native(target);
  } catch (error) {
    if (error instanceof PromotionError) throw error;
    fail("SECURITY_EVIDENCE_UNREADABLE");
  }
  if (!pathContains(rootReal, targetReal)) fail("SECURITY_EVIDENCE_PATH_ESCAPE");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(targetReal, "utf8"));
  } catch {
    fail("SECURITY_EVIDENCE_INVALID_JSON");
  }
  return parsed;
}

function defaultContractFingerprint() {
  return fingerprint({
    contractVersion: "3.1",
    black: PROMOTION_PROFILES.black,
    keduall: PROMOTION_PROFILES.keduall,
    dbPolicy: "baseline-required-manual-apply-forward-fix",
    vercelPolicy: "stg-preview-main-production-exact-sha-read-only-smoke",
    approvalPolicy: "two-consecutive-successes",
  });
}

export function promotionProfileFingerprint({ vercelProject, vercelDomain }) {
  if (typeof vercelProject !== "string" || vercelProject.trim() === "" ||
      typeof vercelDomain !== "string" || vercelDomain.trim() === "") {
    fail("VERCEL_CONFIGURATION_REQUIRED");
  }
  return fingerprint({
    contractVersion: "3.1",
    black: PROMOTION_PROFILES.black,
    keduall: PROMOTION_PROFILES.keduall,
    dbWorkflow: "trusted-operations-manual-v1",
    dbPolicy: "baseline-prefix-forward-only-v1",
    vercel: {
      project: vercelProject,
      domain: vercelDomain,
      stgEnvironment: "preview",
      productionEnvironment: "production",
    },
  });
}

export function planCandidate({ now, sourceSha, stgBaseSha }) {
  if (!validTimestamp(now)) fail("PROMOTION_TIMESTAMP_INVALID");
  if (!SHA_PATTERN.test(sourceSha ?? "") || !SHA_PATTERN.test(stgBaseSha ?? "")) {
    fail("PROMOTION_SHA_INVALID");
  }
  return {
    branch: `chore/promote-${now.slice(0, 10).replaceAll("-", "")}-${sourceSha.slice(0, 8).toLowerCase()}`,
    baseSha: stgBaseSha.toLowerCase(),
    sourceSha: sourceSha.toLowerCase(),
    mergeMethod: "merge",
    noFastForward: true,
    expectedParents: [stgBaseSha.toLowerCase(), sourceSha.toLowerCase()],
  };
}

export function validateCandidateMerge(input) {
  const ok =
    isPlainObject(input) &&
    BRANCH_PATTERN.test(input.branch ?? "") &&
    input.mergeMethod === "merge" &&
    input.noFastForward === true &&
    input.targetBranch === "stg" &&
    SHA_PATTERN.test(input.candidateSha ?? "") &&
    Array.isArray(input.expectedParents) &&
    Array.isArray(input.actualParents) &&
    input.expectedParents.length === 2 &&
    input.actualParents.length === 2 &&
    input.expectedParents.every((value, index) => value === input.actualParents[index]) &&
    input.expectedParents[0] === input.baseSha &&
    input.expectedParents[1] === input.sourceSha;
  return ok ? { ok: true } : { ok: false, code: "PROMOTION_EXACT_PARENTS_REQUIRED" };
}

export function createPromotionRun({
  runId,
  now,
  sourceSha,
  sourceTreeHash,
  stgBaseSha,
  securityAudit,
  expectedSecurityRefs = ["collab/main", "collab/stg", "origin/main"],
  expectedBaselineSha = null,
  controlPlaneReady = false,
  stgReady = false,
  vercelProject,
  vercelDomain,
  workspaceOwnership = "managed",
}) {
  if (!validTimestamp(now)) fail("PROMOTION_TIMESTAMP_INVALID");
  if (!RUN_ID_PATTERN.test(runId ?? "")) fail("PROMOTION_RUN_ID_INVALID");
  if (!SHA_PATTERN.test(sourceSha ?? "") ||
      !SHA_PATTERN.test(sourceTreeHash ?? "") ||
      !SHA_PATTERN.test(stgBaseSha ?? "")) {
    fail("PROMOTION_SHA_INVALID");
  }
  if (typeof vercelProject !== "string" || vercelProject.trim() === "" ||
      typeof vercelDomain !== "string" || vercelDomain.trim() === "") {
    fail("VERCEL_CONFIGURATION_REQUIRED");
  }
  const auditResult = securityAuditValidation(securityAudit, expectedSecurityRefs, {
    sourceSha,
    stgBaseSha,
    stgReady,
    expectedBaselineSha,
  });
  if (!auditResult.ok) fail(auditResult.code);
  const candidate = planCandidate({ now, sourceSha, stgBaseSha });
  const contractFingerprint = defaultContractFingerprint();
  const profileFingerprint = promotionProfileFingerprint({ vercelProject, vercelDomain });
  const state = controlPlaneReady && stgReady ? "PLANNED" : "BOOTSTRAP_REQUIRED";
  const payload = {
    schemaVersion: 1,
    recordType: "PromotionRunV1",
    runId,
    contractVersion: "3.1",
    contractFingerprint,
    profileFingerprint,
    source: {
      profile: PROMOTION_PROFILES.black.name,
      remote: PROMOTION_PROFILES.black.remote,
      repositoryIdentity: PROMOTION_PROFILES.black.repositoryIdentity,
      authLogin: PROMOTION_PROFILES.black.authLogin,
      baseBranch: PROMOTION_PROFILES.black.baseBranch,
      sha: sourceSha.toLowerCase(),
      treeHash: sourceTreeHash.toLowerCase(),
    },
    target: {
      profile: PROMOTION_PROFILES.keduall.name,
      remote: PROMOTION_PROFILES.keduall.remote,
      repositoryIdentity: PROMOTION_PROFILES.keduall.repositoryIdentity,
      authLogin: PROMOTION_PROFILES.keduall.authLogin,
      stgBranch: PROMOTION_PROFILES.keduall.stgBranch,
      mainBranch: PROMOTION_PROFILES.keduall.mainBranch,
      stgBaseSha: stgBaseSha.toLowerCase(),
      candidateBranch: candidate.branch,
      candidateSha: null,
      candidateParents: [stgBaseSha.toLowerCase(), sourceSha.toLowerCase()],
      stgSha: null,
      mainSha: null,
    },
    security: {
      auditFingerprint: securityAudit.fingerprint,
      refs: [...expectedSecurityRefs].sort(),
      findingCount: 0,
    },
    migration: {
      manifestDigest: null,
      evidenceDigest: null,
      status: "DB_BASELINE_REQUIRED",
      autoApplyEnabled: false,
    },
    approval: {
      mode: "CONFIRM",
      consecutiveSuccessCount: 0,
      approvalFingerprint: null,
      policyFingerprint: null,
    },
    vercel: {
      project: vercelProject,
      environment: "stg=preview;main=production",
      deploymentId: null,
      commitSha: null,
      target: null,
      alias: null,
      domain: vercelDomain,
      smokeStatus: "NOT_RUN",
      rollbackDeploymentId: null,
    },
    workspace: {
      ownership: workspaceOwnership,
      cleanupStatus: "PENDING",
    },
    state,
    revision: 0,
    blocker: state === "BOOTSTRAP_REQUIRED" ? "KEDUALL_BOOTSTRAP_REQUIRED" : null,
    journal: [{ event: "PLAN_CREATED", at: now, evidenceDigest: securityAudit.fingerprint }],
    timings: [],
    createdAt: now,
    updatedAt: now,
  };
  return { ...payload, fingerprint: recordFingerprint(payload) };
}

export function startPromotion(input) {
  const result = securityAuditValidation(
    input?.securityAudit,
    input?.expectedSecurityRefs ?? ["collab/main", "collab/stg", "origin/main"],
    {
      sourceSha: input?.sourceSha ?? null,
      stgBaseSha: input?.stgBaseSha ?? null,
      stgReady: input?.stgReady ?? false,
      expectedBaselineSha: input?.expectedBaselineSha ?? null,
    },
  );
  if (!result.ok) {
    return {
      schemaVersion: 1,
      recordType: "PromotionStartResultV1",
      state: "SECURITY_INCIDENT_BLOCKED",
      blocker: result.code,
      mutationAttempted: false,
    };
  }
  return createPromotionRun(input);
}

export function validatePromotionRunV1(record) {
  const errors = [];
  checkClosed(record, RECORD_KEYS, "", errors);
  if (!isPlainObject(record)) return uniqueErrors(errors);
  checkClosed(record.source, SOURCE_KEYS, "source", errors);
  checkClosed(record.target, TARGET_KEYS, "target", errors);
  checkClosed(record.security, SECURITY_KEYS, "security", errors);
  checkClosed(record.migration, MIGRATION_KEYS, "migration", errors);
  checkClosed(record.approval, APPROVAL_KEYS, "approval", errors);
  checkClosed(record.vercel, VERCEL_KEYS, "vercel", errors);
  checkClosed(record.workspace, WORKSPACE_KEYS, "workspace", errors);
  if (Array.isArray(record.journal)) {
    record.journal.forEach((entry, index) =>
      checkClosed(entry, JOURNAL_KEYS, `journal.${index}`, errors));
  } else errors.push(issue("INVALID_ARRAY", "journal"));
  if (Array.isArray(record.timings)) {
    record.timings.forEach((entry, index) =>
      checkClosed(entry, TIMING_KEYS, `timings.${index}`, errors));
  } else errors.push(issue("INVALID_ARRAY", "timings"));
  collectSecrets(record, "", errors);

  if (record.schemaVersion !== 1) errors.push(issue("INVALID_SCHEMA_VERSION", "schemaVersion"));
  if (record.recordType !== "PromotionRunV1") errors.push(issue("INVALID_RECORD_TYPE", "recordType"));
  if (!RUN_ID_PATTERN.test(record.runId ?? "")) errors.push(issue("INVALID_RUN_ID", "runId"));
  if (record.contractVersion !== "3.1") errors.push(issue("INVALID_CONTRACT_VERSION", "contractVersion"));
  if (!DIGEST_PATTERN.test(record.contractFingerprint ?? "")) {
    errors.push(issue("INVALID_DIGEST", "contractFingerprint"));
  }
  if (!DIGEST_PATTERN.test(record.profileFingerprint ?? "")) {
    errors.push(issue("INVALID_DIGEST", "profileFingerprint"));
  }
  if (!STATES.has(record.state)) errors.push(issue("INVALID_STATE", "state"));
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) {
    errors.push(issue("INVALID_REVISION", "revision"));
  }
  if (!validTimestamp(record.createdAt)) errors.push(issue("INVALID_TIMESTAMP", "createdAt"));
  if (!validTimestamp(record.updatedAt)) errors.push(issue("INVALID_TIMESTAMP", "updatedAt"));
  if (!isPlainObject(record.source) ||
      record.source.repositoryIdentity !== PROMOTION_PROFILES.black.repositoryIdentity ||
      record.source.authLogin !== PROMOTION_PROFILES.black.authLogin ||
      record.source.remote !== "origin" ||
      record.source.baseBranch !== "main") {
    errors.push(issue("SOURCE_PROFILE_MISMATCH", "source"));
  }
  if (!isPlainObject(record.target) ||
      record.target.repositoryIdentity !== PROMOTION_PROFILES.keduall.repositoryIdentity ||
      record.target.authLogin !== PROMOTION_PROFILES.keduall.authLogin ||
      record.target.remote !== "collab" ||
      record.target.stgBranch !== "stg" ||
      record.target.mainBranch !== "main") {
    errors.push(issue("TARGET_PROFILE_MISMATCH", "target"));
  }
  for (const [field, value] of [
    ["source.sha", record.source?.sha],
    ["source.treeHash", record.source?.treeHash],
    ["target.stgBaseSha", record.target?.stgBaseSha],
  ]) {
    if (!SHA_PATTERN.test(value ?? "")) errors.push(issue("INVALID_SHA", field));
  }
  for (const [field, value] of [
    ["target.candidateSha", record.target?.candidateSha],
    ["target.stgSha", record.target?.stgSha],
    ["target.mainSha", record.target?.mainSha],
  ]) {
    if (!validShaOrNull(value)) errors.push(issue("INVALID_SHA", field));
  }
  if (!BRANCH_PATTERN.test(record.target?.candidateBranch ?? "")) {
    errors.push(issue("INVALID_CANDIDATE_BRANCH", "target.candidateBranch"));
  }
  if (record.migration?.autoApplyEnabled !== false) {
    errors.push(issue("DB_AUTO_APPLY_FORBIDDEN", "migration.autoApplyEnabled"));
  }
  if (typeof record.vercel?.project !== "string" || record.vercel.project.trim() === "" ||
      typeof record.vercel?.domain !== "string" || record.vercel.domain.trim() === "" ||
      record.vercel.environment !== "stg=preview;main=production") {
    errors.push(issue("VERCEL_CONFIGURATION_REQUIRED", "vercel"));
  } else if (
    record.profileFingerprint !== promotionProfileFingerprint({
      vercelProject: record.vercel.project,
      vercelDomain: record.vercel.domain,
    })
  ) {
    errors.push(issue("PROFILE_FINGERPRINT_MISMATCH", "profileFingerprint"));
  }
  if (!DIGEST_PATTERN.test(record.fingerprint ?? "") ||
      record.fingerprint !== recordFingerprint(record)) {
    errors.push(issue("FINGERPRINT_MISMATCH", "fingerprint"));
  }
  return uniqueErrors(errors);
}

function migrationBlocked(code = "DB_GATE_BLOCKED") {
  return {
    ok: false,
    code,
    autoApplyAllowed: false,
    recovery: "FORWARD_FIX_ONLY",
  };
}

export function validateMigrationEvidence(evidence) {
  if (!isPlainObject(evidence)) {
    return { ...migrationBlocked("DB_BASELINE_REQUIRED"), recovery: "FORWARD_FIX_ONLY" };
  }
  if (Object.keys(evidence).some((key) => !MIGRATION_EVIDENCE_KEYS.has(key) ||
      SECRET_KEY_PATTERN.test(key))) {
    return migrationBlocked();
  }
  if (evidence.autoApplyEnabled !== false) {
    return migrationBlocked("DB_AUTO_APPLY_DISABLED");
  }
  const digests = [
    evidence.productionProjectIdentityHash,
    evidence.remoteTrackerDigest,
    evidence.schemaRpcRlsGrantFingerprint,
    evidence.appliedMigrationManifestDigest,
    evidence.backupPitrEvidenceDigest,
    evidence.pinnedToolchainDigest,
    evidence.dryRunDigest,
    evidence.applyDigest,
  ];
  if (digests.some((value) => !DIGEST_PATTERN.test(value ?? "")) ||
      !/^[0-9]{14}$/u.test(evidence.previousMaxTimestamp ?? "") ||
      !Array.isArray(evidence.newMigrations) ||
      !Array.isArray(evidence.historicalChanges)) {
    return migrationBlocked("DB_BASELINE_REQUIRED");
  }
  if (evidence.newMigrations.some((entry) =>
    !isPlainObject(entry) ||
    Object.keys(entry).some((key) => !NEW_MIGRATION_KEYS.has(key)) ||
    !/^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/u.test(entry.path ?? "") ||
    !/^[0-9]{14}$/u.test(entry.timestamp ?? "") ||
    !DIGEST_PATTERN.test(entry.sha256 ?? "") ||
    entry.timestamp <= evidence.previousMaxTimestamp)) {
    return migrationBlocked();
  }
  if (evidence.historicalChanges.some((entry) =>
    !isPlainObject(entry) ||
    Object.keys(entry).some((key) => !HISTORICAL_CHANGE_KEYS.has(key)))) {
    return migrationBlocked();
  }
  const blocked =
    evidence.trackerIsExactManifestPrefix !== true ||
    evidence.historicalChanges.length > 0 ||
    evidence.dryRunDigest !== evidence.applyDigest ||
    evidence.destructiveSql !== false ||
    evidence.grantRevocation !== false ||
    evidence.compatibilityBreak !== false ||
    evidence.nMinusOneTopikDevPassed !== true ||
    evidence.nTopikDevPassed !== true;
  if (blocked) return migrationBlocked();
  const payload = structuredClone(evidence);
  return {
    ok: true,
    code: "DB_GATE_PASSED_MANUAL_APPLY",
    autoApplyAllowed: false,
    manifestDigest: evidence.appliedMigrationManifestDigest,
    evidenceDigest: fingerprint(payload),
  };
}

export function validateVercelPreviewEvidence(
  evidence,
  expectedStgSha,
  { expectedProject = null } = {},
) {
  const ok =
    isPlainObject(evidence) &&
    SHA_PATTERN.test(expectedStgSha ?? "") &&
    evidence.commitSha === expectedStgSha &&
    (expectedProject === null || evidence.project === expectedProject) &&
    evidence.state === "READY" &&
    evidence.target === "preview" &&
    evidence.branch === "stg" &&
    evidence.environmentScope === "topik-dev" &&
    typeof evidence.deploymentId === "string" &&
    !Object.keys(evidence).some((key) => SECRET_KEY_PATTERN.test(key));
  return ok
    ? { ok: true, code: "STG_PREVIEW_READY" }
    : { ok: false, code: "STG_PREVIEW_GATE_BLOCKED" };
}

export function validateVercelProductionEvidence(
  evidence,
  { expectedMainSha, requiredProject, requiredAlias, requiredDomain },
) {
  if (!isPlainObject(evidence) || Object.keys(evidence).some((key) => SECRET_KEY_PATTERN.test(key))) {
    return { ok: false, code: "PRODUCTION_EVIDENCE_INVALID" };
  }
  const baseReady =
    evidence.commitSha === expectedMainSha &&
    typeof requiredProject === "string" &&
    requiredProject.length > 0 &&
    evidence.project === requiredProject &&
    evidence.state === "READY" &&
    evidence.target === "production" &&
    evidence.alias === requiredAlias &&
    evidence.domain === requiredDomain &&
    evidence.smokeReadOnly === true &&
    evidence.aliasSwitched === true;
  if (baseReady && evidence.smokePassed === false) {
    if (evidence.previousReadyState !== "READY" ||
        typeof evidence.previousReadyDeploymentId !== "string") {
      return {
        ok: false,
        code: "ROLLBACK_EVIDENCE_REQUIRED",
        databaseRollbackAllowed: false,
      };
    }
    return {
      ok: false,
      code: "ALIAS_ROLLBACK_REQUIRED",
      rollbackDeploymentId: evidence.previousReadyDeploymentId ?? null,
      rollbackScope: "ALIAS_ONLY",
      databaseRollbackAllowed: false,
    };
  }
  return baseReady && evidence.smokePassed === true
    ? { ok: true, code: "PRODUCTION_READY" }
    : {
        ok: false,
        code: evidence.aliasSwitched === false
          ? "PRODUCTION_FAILED_PREVIOUS_ALIAS_PRESERVED"
          : "PRODUCTION_GATE_BLOCKED",
        databaseRollbackAllowed: false,
      };
}

export function validateVercelRollbackEvidence(
  evidence,
  { requiredDeploymentId, requiredAlias },
) {
  const ok =
    isPlainObject(evidence) &&
    evidence.rollbackDeploymentId === requiredDeploymentId &&
    evidence.rollbackDeploymentState === "READY" &&
    evidence.alias === requiredAlias &&
    evidence.databaseChanged === false &&
    !Object.keys(evidence).some((key) => SECRET_KEY_PATTERN.test(key));
  return ok
    ? { ok: true, code: "ALIAS_ROLLBACK_VERIFIED" }
    : { ok: false, code: "ALIAS_ROLLBACK_EVIDENCE_INVALID", databaseRollbackAllowed: false };
}

function approvalPolicyFingerprint(policy) {
  const payload = structuredClone(policy);
  delete payload.fingerprint;
  return fingerprint(payload);
}

export function createApprovalPolicy({ contractFingerprint, profileFingerprint }) {
  if (!DIGEST_PATTERN.test(contractFingerprint ?? "") ||
      !DIGEST_PATTERN.test(profileFingerprint ?? "")) {
    fail("APPROVAL_POLICY_FINGERPRINT_INVALID");
  }
  const payload = {
    schemaVersion: 1,
    recordType: "PromotionApprovalPolicyV1",
    contractFingerprint,
    profileFingerprint,
    mode: "CONFIRM",
    consecutiveSuccessCount: 0,
    lastResetReason: null,
    revision: 0,
  };
  return { ...payload, fingerprint: approvalPolicyFingerprint(payload) };
}

export function validateApprovalPolicy(policy) {
  const errors = [];
  checkClosed(policy, APPROVAL_POLICY_KEYS, "", errors);
  if (!isPlainObject(policy)) return errors;
  if (policy.schemaVersion !== 1 || policy.recordType !== "PromotionApprovalPolicyV1") {
    errors.push(issue("INVALID_APPROVAL_POLICY", "recordType"));
  }
  if (!DIGEST_PATTERN.test(policy.contractFingerprint ?? "") ||
      !DIGEST_PATTERN.test(policy.profileFingerprint ?? "")) {
    errors.push(issue("INVALID_DIGEST", "policy"));
  }
  if (!new Set(["CONFIRM", "AUTO"]).has(policy.mode) ||
      !Number.isSafeInteger(policy.consecutiveSuccessCount) ||
      policy.consecutiveSuccessCount < 0 ||
      policy.consecutiveSuccessCount > 2) {
    errors.push(issue("INVALID_APPROVAL_POLICY", "mode"));
  }
  if (policy.fingerprint !== approvalPolicyFingerprint(policy)) {
    errors.push(issue("FINGERPRINT_MISMATCH", "fingerprint"));
  }
  return uniqueErrors(errors);
}

export function evaluateProductionApproval(policy, snapshotFingerprint) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  if (!DIGEST_PATTERN.test(snapshotFingerprint ?? "")) fail("PROMOTION_FINGERPRINT_INVALID");
  if (policy.mode === "AUTO" && policy.consecutiveSuccessCount >= 2) {
    return { state: "APPROVED", mode: "AUTO", approvalFingerprint: null };
  }
  return {
    state: "AWAITING_PROD_APPROVAL",
    mode: "CONFIRM",
    approvalFingerprint: fingerprint({
      policyFingerprint: policy.fingerprint,
      snapshotFingerprint,
      purpose: "KEDUALL_MAIN_PRODUCTION_MERGE",
    }),
  };
}

export function applyProductionApproval(
  record,
  { policy, approvalFingerprint },
) {
  if (record?.state !== "AWAITING_PROD_APPROVAL" ||
      validateApprovalPolicy(policy).length > 0) {
    fail("PRODUCTION_APPROVAL_STALE");
  }
  if (policy.contractFingerprint !== record.contractFingerprint ||
      policy.profileFingerprint !== record.profileFingerprint) {
    fail("APPROVAL_POLICY_PROFILE_MISMATCH");
  }
  const expectedApprovalFingerprint = productionApprovalFingerprint(record, policy);
  if (approvalFingerprint !== expectedApprovalFingerprint ||
      record.approval?.approvalFingerprint !== expectedApprovalFingerprint ||
      !DIGEST_PATTERN.test(approvalFingerprint ?? "")) {
    fail("PRODUCTION_APPROVAL_STALE");
  }
  return approvalFingerprint;
}

export function recordPromotionSuccess(policy, evidence) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  const complete =
    evidence?.productionReady === true &&
    evidence.exactMainSha === true &&
    evidence.aliasConnected === true &&
    evidence.smokePassed === true &&
    new Set(["CLEANED", "RELEASED"]).has(evidence.cleanupStatus);
  if (!complete) return resetApprovalPolicy(policy, "INCOMPLETE_PRODUCTION_SUCCESS");
  const consecutiveSuccessCount = Math.min(2, policy.consecutiveSuccessCount + 1);
  const payload = {
    ...policy,
    consecutiveSuccessCount,
    mode: consecutiveSuccessCount >= 2 ? "AUTO" : "CONFIRM",
    lastResetReason: null,
    revision: policy.revision + 1,
  };
  delete payload.fingerprint;
  return { ...payload, fingerprint: approvalPolicyFingerprint(payload) };
}

export function resetApprovalPolicy(policy, reason) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  const payload = {
    ...policy,
    mode: "CONFIRM",
    consecutiveSuccessCount: 0,
    lastResetReason: reason,
    revision: policy.revision + 1,
  };
  delete payload.fingerprint;
  return { ...payload, fingerprint: approvalPolicyFingerprint(payload) };
}

export function reconcileApprovalPolicy(
  policy,
  { contractFingerprint, profileFingerprint, reason = "POLICY_CONTRACT_CHANGED" },
) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  if (policy.contractFingerprint === contractFingerprint &&
      policy.profileFingerprint === profileFingerprint) {
    return policy;
  }
  const payload = {
    ...policy,
    contractFingerprint,
    profileFingerprint,
    mode: "CONFIRM",
    consecutiveSuccessCount: 0,
    lastResetReason: reason,
    revision: policy.revision + 1,
  };
  delete payload.fingerprint;
  return { ...payload, fingerprint: approvalPolicyFingerprint(payload) };
}

function productionApprovalSnapshot(record) {
  const snapshot = structuredClone(record);
  delete snapshot.fingerprint;
  snapshot.approval.approvalFingerprint = null;
  return fingerprint(snapshot);
}

function productionApprovalFingerprint(record, policy) {
  return fingerprint({
    policyFingerprint: policy.fingerprint,
    snapshotFingerprint: productionApprovalSnapshot(record),
    purpose: "KEDUALL_MAIN_PRODUCTION_MERGE",
  });
}

function assertPolicy(record, policy) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  if (policy.contractFingerprint !== record.contractFingerprint ||
      policy.profileFingerprint !== record.profileFingerprint) {
    fail("APPROVAL_POLICY_PROFILE_MISMATCH");
  }
}

function candidateLineageValid(record, event) {
  const plan = {
    branch: event.branch,
    baseSha: event.baseSha,
    sourceSha: event.sourceSha,
    mergeMethod: event.mergeMethod,
    noFastForward: event.noFastForward,
    expectedParents: [record.target.stgBaseSha, record.source.sha],
    candidateSha: event.candidateSha,
    actualParents: event.actualParents,
    targetBranch: event.targetBranch,
  };
  return (
    event.directMainPush === false &&
    event.branch === record.target.candidateBranch &&
    event.baseSha === record.target.stgBaseSha &&
    event.sourceSha === record.source.sha &&
    validateCandidateMerge(plan).ok
  );
}

function eventDigest(event) {
  const safe = structuredClone(event);
  delete safe.at;
  return fingerprint(safe);
}

function finalizeTransition(record, next, policy, nextPolicy, event) {
  next.revision = record.revision + 1;
  next.updatedAt = event.at;
  next.journal.push({
    event: event.type,
    at: event.at,
    evidenceDigest: eventDigest(event),
  });
  if (next.state === "AWAITING_PROD_APPROVAL") {
    next.approval.approvalFingerprint = productionApprovalFingerprint(
      next,
      nextPolicy ?? policy,
    );
  }
  next.fingerprint = recordFingerprint(next);
  if (validatePromotionRunV1(next).length > 0) fail("PROMOTION_TRANSITION_INVALID");
  return { record: next, policy: nextPolicy ?? policy };
}

export function advancePromotionRun(
  record,
  { expectedRevision, expectedFingerprint, event, policy },
) {
  if (validatePromotionRunV1(record).length > 0) fail("PROMOTION_RECORD_INVALID");
  if (record.revision !== expectedRevision) fail("PROMOTION_REVISION_STALE");
  if (record.fingerprint !== expectedFingerprint) fail("PROMOTION_FINGERPRINT_STALE");
  if (!isPlainObject(event) || !validTimestamp(event.at)) fail("PROMOTION_EVENT_INVALID");
  assertPolicy(record, policy);
  const terminal = new Set([
    "CLEANED",
    "PRESERVED",
    "SECURITY_INCIDENT_BLOCKED",
    "PRODUCTION_FAILED",
  ]);
  if (terminal.has(record.state)) fail("PROMOTION_TRANSITION_NOT_ALLOWED");

  const next = structuredClone(record);
  let nextPolicy = policy;

  if (record.state === "PLANNED" && event.type === "CANDIDATE_VERIFIED") {
    if (!candidateLineageValid(record, event)) fail("CANDIDATE_LINEAGE_INVALID");
    next.target.candidateSha = event.candidateSha;
    next.state = "CANDIDATE_VERIFIED";
  } else if (record.state === "CANDIDATE_VERIFIED" && event.type === "STG_PR_OPEN") {
    if (event.targetBranch !== "stg" ||
        event.headBranch !== record.target.candidateBranch ||
        event.headSha !== record.target.candidateSha) {
      fail("STG_PR_EVIDENCE_INVALID");
    }
    next.state = "STG_PR_OPEN";
  } else if (record.state === "STG_PR_OPEN" && event.type === "STG_READY") {
    if (!SHA_PATTERN.test(event.stgSha ?? "") ||
        event.mergeMethod !== "merge" ||
        event.directMainPush !== false ||
        !Array.isArray(event.actualParents) ||
        event.actualParents.length !== 2 ||
        event.actualParents[0] !== record.target.stgBaseSha ||
        event.actualParents[1] !== record.target.candidateSha ||
        !validateVercelPreviewEvidence(event.previewEvidence, event.stgSha, {
          expectedProject: record.vercel.project,
        }).ok) {
      fail("STG_READY_EVIDENCE_INVALID");
    }
    next.target.stgSha = event.stgSha;
    next.vercel.deploymentId = event.previewEvidence.deploymentId;
    next.vercel.commitSha = event.previewEvidence.commitSha;
    next.vercel.target = "preview";
    next.state = "STG_READY";
  } else if (
    new Set(["STG_READY", "DB_BASELINE_REQUIRED", "DB_GATE_BLOCKED"]).has(record.state) &&
    event.type === "DB_GATE_EVALUATED"
  ) {
    const gate = validateMigrationEvidence(event.migrationEvidence);
    next.migration.status = gate.code;
    next.migration.autoApplyEnabled = false;
    if (!gate.ok) {
      next.state = gate.code === "DB_BASELINE_REQUIRED"
        ? "DB_BASELINE_REQUIRED"
        : "DB_GATE_BLOCKED";
      next.blocker = gate.code;
    } else {
      next.migration.manifestDigest = gate.manifestDigest;
      next.migration.evidenceDigest = gate.evidenceDigest;
      next.blocker = null;
      next.approval.mode = policy.mode;
      next.approval.consecutiveSuccessCount = policy.consecutiveSuccessCount;
      next.approval.policyFingerprint = policy.fingerprint;
      if (policy.mode === "AUTO" && policy.consecutiveSuccessCount >= 2) {
        next.state = "PROD_APPROVED";
        next.approval.approvalFingerprint = null;
      } else {
        next.state = "AWAITING_PROD_APPROVAL";
        next.approval.approvalFingerprint = productionApprovalFingerprint(next, policy);
      }
    }
  } else if (
    record.state === "AWAITING_PROD_APPROVAL" &&
    event.type === "PROD_APPROVAL_GRANTED"
  ) {
    applyProductionApproval(record, {
      policy,
      approvalFingerprint: event.approvalFingerprint,
    });
    next.state = "PROD_APPROVED";
    next.approval.approvalFingerprint = null;
  } else if (record.state === "PROD_APPROVED" && event.type === "MAIN_PR_OPEN") {
    if (event.targetBranch !== "main" ||
        event.headBranch !== "stg" ||
        event.headSha !== record.target.stgSha ||
        event.mergeMethod !== "merge" ||
        event.directMainPush !== false) {
      fail("MAIN_PR_EVIDENCE_INVALID");
    }
    next.state = "MAIN_PR_OPEN";
  } else if (record.state === "MAIN_PR_OPEN" && event.type === "MAIN_MERGE_VERIFIED") {
    if (!SHA_PATTERN.test(event.mainBaseSha ?? "") ||
        !SHA_PATTERN.test(event.mainSha ?? "") ||
        event.headSha !== record.target.stgSha ||
        event.targetBranch !== "main" ||
        event.mergeMethod !== "merge" ||
        event.directMainPush !== false ||
        !Array.isArray(event.actualParents) ||
        event.actualParents.length !== 2 ||
        event.actualParents[0] !== event.mainBaseSha ||
        event.actualParents[1] !== record.target.stgSha) {
      fail("MAIN_MERGE_EVIDENCE_INVALID");
    }
    next.target.mainSha = event.mainSha;
    next.state = "PRODUCTION_VERIFYING";
  } else if (
    record.state === "PRODUCTION_VERIFYING" &&
    event.type === "PRODUCTION_EVALUATED"
  ) {
    const verification = validateVercelProductionEvidence(event.evidence, {
      expectedMainSha: record.target.mainSha,
      requiredProject: record.vercel.project,
      requiredAlias: record.vercel.domain,
      requiredDomain: record.vercel.domain,
    });
    if (verification.ok) {
      next.vercel.deploymentId = event.evidence.deploymentId;
      next.vercel.commitSha = event.evidence.commitSha;
      next.vercel.target = "production";
      next.vercel.alias = event.evidence.alias;
      next.vercel.domain = event.evidence.domain;
      next.vercel.smokeStatus = "PASSED";
      next.workspace.cleanupStatus = "RELEASED";
      next.state = "RELEASED";
    } else if (verification.code === "ALIAS_ROLLBACK_REQUIRED") {
      next.vercel.rollbackDeploymentId = verification.rollbackDeploymentId;
      next.vercel.smokeStatus = "FAILED";
      next.state = "ALIAS_ROLLBACK_REQUIRED";
      next.blocker = verification.code;
    } else {
      next.state = "PRODUCTION_FAILED";
      next.blocker = verification.code;
      nextPolicy = resetApprovalPolicy(policy, "DEPLOYMENT_FAILURE");
    }
  } else if (
    record.state === "ALIAS_ROLLBACK_REQUIRED" &&
    event.type === "ALIAS_ROLLBACK_VERIFIED"
  ) {
    const rollback = validateVercelRollbackEvidence(event.evidence, {
      requiredDeploymentId: record.vercel.rollbackDeploymentId,
      requiredAlias: record.vercel.domain,
    });
    if (!rollback.ok) fail("ALIAS_ROLLBACK_EVIDENCE_INVALID");
    next.state = "PRESERVED";
    next.blocker = "PRODUCTION_SMOKE_FAILED_ALIAS_ROLLED_BACK";
    nextPolicy = resetApprovalPolicy(policy, "ROLLBACK");
  } else if (record.state === "RELEASED" && event.type === "CLEANUP_VERIFIED") {
    const cleanup = cleanupEligibility({
      productionReady: true,
      exactMainSha: record.vercel.commitSha === record.target.mainSha,
      smokePassed: record.vercel.smokeStatus === "PASSED",
      stgFastForwardedToMain: event.stgFastForwardedToMain,
      workspaceOwnership: record.workspace.ownership,
      candidateBranch: record.target.candidateBranch,
    });
    if (!cleanup.eligible) fail("PROMOTION_CLEANUP_NOT_ELIGIBLE");
    next.state = "CLEANED";
    next.workspace.cleanupStatus = "CLEANED";
    nextPolicy = recordPromotionSuccess(policy, {
      productionReady: true,
      exactMainSha: true,
      aliasConnected: true,
      smokePassed: true,
      cleanupStatus: "CLEANED",
    });
  } else {
    fail("PROMOTION_TRANSITION_NOT_ALLOWED");
  }
  return finalizeTransition(record, next, policy, nextPolicy, event);
}

export function transitionPromotionRun(
  record,
  { expectedRevision, expectedFingerprint, event, policy = null },
) {
  if (event?.type === "PLAN_CREATED" &&
      record.journal.some((entry) => entry.event === "PLAN_CREATED" && entry.at === event.at)) {
    if (record.revision !== expectedRevision) fail("PROMOTION_REVISION_STALE");
    if (record.fingerprint !== expectedFingerprint) fail("PROMOTION_FINGERPRINT_STALE");
    return record;
  }
  return advancePromotionRun(record, {
    expectedRevision,
    expectedFingerprint,
    event,
    policy,
  }).record;
}

export function cleanupEligibility(input) {
  const eligible =
    input?.productionReady === true &&
    input.exactMainSha === true &&
    input.smokePassed === true &&
    input.stgFastForwardedToMain === true &&
    input.workspaceOwnership === "managed" &&
    BRANCH_PATTERN.test(input.candidateBranch ?? "");
  return eligible
    ? {
        eligible: true,
        preserveBranches: ["stg", "main"],
        removableBranches: [input.candidateBranch],
      }
    : {
        eligible: false,
        preserveBranches: ["stg", "main"],
        removableBranches: [],
      };
}

export function persistPromotionTransition({
  currentRecord,
  currentPolicy,
  result,
  writeRun,
  writePolicy,
}) {
  const policyChanged = result.policy.fingerprint !== currentPolicy.fingerprint;
  const resetState = new Set(["PRODUCTION_FAILED", "PRESERVED", "SECURITY_INCIDENT_BLOCKED"])
    .has(result.record.state);
  if (policyChanged && resetState) writePolicy(result.policy, currentPolicy.fingerprint);
  writeRun(result.record, currentRecord.fingerprint);
  if (policyChanged && !resetState) writePolicy(result.policy, currentPolicy.fingerprint);
  return result.record;
}

function assertRegistryRoot(gitCommonDir) {
  if (typeof gitCommonDir !== "string" || gitCommonDir.length === 0) {
    fail("GIT_COMMON_DIR_INVALID");
  }
  const root = path.resolve(gitCommonDir);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) fail("GIT_COMMON_DIR_INVALID");
  const physical = realpathSync.native(root);
  if (path.resolve(physical).toLowerCase() !== root.toLowerCase()) fail("GIT_COMMON_DIR_INVALID");
  return physical;
}

function runPath(gitCommonDir, runId) {
  if (!RUN_ID_PATTERN.test(runId ?? "")) fail("PROMOTION_RUN_ID_INVALID");
  const root = assertRegistryRoot(gitCommonDir);
  return path.join(root, "ai-pipeline", "promotions", "v1", "runs", `${runId}.json`);
}

export function promotionRunLockPath({ gitCommonDir, runId }) {
  return `${runPath(gitCommonDir, runId)}.lock`;
}

function atomicWrite(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, filePath);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function withRegistryLock(target, callback) {
  mkdirSync(path.dirname(target), { recursive: true });
  const lockPath = `${target}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
  } catch {
    fail("PROMOTION_REGISTRY_LOCKED");
  }
  try {
    return callback();
  } finally {
    closeSync(descriptor);
    if (existsSync(lockPath)) unlinkSync(lockPath);
  }
}

export function writePromotionRun({ gitCommonDir, record, expectedFingerprint = null }) {
  const errors = validatePromotionRunV1(record);
  if (errors.length > 0) fail("PROMOTION_RECORD_INVALID");
  const target = runPath(gitCommonDir, record.runId);
  withRegistryLock(target, () => {
    if (expectedFingerprint === null) {
      if (existsSync(target)) fail("PROMOTION_RUN_EXISTS");
    } else {
      if (!existsSync(target)) fail("PROMOTION_RECORD_NOT_FOUND");
      const existing = readPromotionRun({ gitCommonDir, runId: record.runId });
      if (existing.fingerprint !== expectedFingerprint) fail("PROMOTION_FINGERPRINT_STALE");
    }
    atomicWrite(target, record);
  });
  return target;
}

export function readPromotionRun({ gitCommonDir, runId }) {
  const target = runPath(gitCommonDir, runId);
  let record;
  try {
    if (lstatSync(target).isSymbolicLink()) fail("PROMOTION_REGISTRY_SYMLINK");
    record = JSON.parse(readFileSync(target, "utf8"));
  } catch (error) {
    if (error instanceof PromotionError) throw error;
    fail("PROMOTION_RECORD_NOT_FOUND");
  }
  if (validatePromotionRunV1(record).length > 0) fail("PROMOTION_RECORD_INVALID");
  return record;
}

function policyPath(gitCommonDir) {
  const root = assertRegistryRoot(gitCommonDir);
  return path.join(root, "ai-pipeline", "promotions", "v1", "approval-policy.json");
}

export function writeApprovalPolicy({ gitCommonDir, policy, expectedFingerprint = null }) {
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  const target = policyPath(gitCommonDir);
  withRegistryLock(target, () => {
    if (expectedFingerprint === null) {
      if (existsSync(target)) fail("APPROVAL_POLICY_EXISTS");
    } else {
      if (!existsSync(target)) fail("APPROVAL_POLICY_NOT_FOUND");
      const existing = readApprovalPolicy({ gitCommonDir });
      if (existing.fingerprint !== expectedFingerprint) fail("APPROVAL_POLICY_STALE");
    }
    atomicWrite(target, policy);
  });
  return target;
}

export { assertRegistryRoot as assertPromotionRegistryRoot };
export { atomicWrite as atomicWritePromotionFile };

export function readApprovalPolicy({ gitCommonDir }) {
  const target = policyPath(gitCommonDir);
  let policy;
  try {
    if (lstatSync(target).isSymbolicLink()) fail("APPROVAL_POLICY_SYMLINK");
    policy = JSON.parse(readFileSync(target, "utf8"));
  } catch (error) {
    if (error instanceof PromotionError) throw error;
    fail("APPROVAL_POLICY_NOT_FOUND");
  }
  if (validateApprovalPolicy(policy).length > 0) fail("APPROVAL_POLICY_INVALID");
  return policy;
}
