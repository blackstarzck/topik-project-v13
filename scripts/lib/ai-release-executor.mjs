import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import {
  assertPromotionRegistryRoot,
  atomicWritePromotionFile,
  cleanupEligibility,
  scanForSecrets,
  validateCandidateMerge,
  validatePromotionRunV1,
  validateVercelPreviewEvidence,
  validateVercelRollbackEvidence,
} from "./ai-release-promotion.mjs";

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const RUN_ID_PATTERN = /^promotion-[0-9]{8}-[a-f0-9]{8}$/u;
const EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/u;
const MAX_MIGRATION_EVIDENCE_BYTES = 256 * 1024;
const MAX_EVIDENCE_SEQUENCE = 999;
const EVIDENCE_REGISTRY_SEGMENTS = Object.freeze([
  "ai-pipeline",
  "promotions",
  "v1",
  "evidence",
]);
const EXECUTOR_FORBIDDEN_EVENT_TYPES = Object.freeze(["PROD_APPROVAL_GRANTED"]);
const SECRET_KEY_PATTERN =
  /(authorization|cookie|credential|password|private.?key|secret|service.?role|token|thread.?id|session.?id|raw.?output|command.?output)/iu;

const BLACK_ACCOUNT = "blackstarzck";
const KEDUALL_ACCOUNT = "guestkeduall-design";

const PREVIEW_EVIDENCE_KEYS = [
  "deploymentId",
  "commitSha",
  "project",
  "state",
  "target",
  "branch",
  "environmentScope",
];
const PRODUCTION_EVIDENCE_KEYS = [
  "deploymentId",
  "commitSha",
  "project",
  "state",
  "target",
  "alias",
  "domain",
  "smokeReadOnly",
  "smokePassed",
  "aliasSwitched",
];
const PRODUCTION_ROLLBACK_HINT_KEYS = ["previousReadyDeploymentId", "previousReadyState"];
const ROLLBACK_EVIDENCE_KEYS = [
  "rollbackDeploymentId",
  "rollbackDeploymentState",
  "alias",
  "databaseChanged",
];

export class ExecutorError extends Error {
  constructor(code) {
    super(code);
    this.name = "ExecutorError";
    this.code = code;
  }
}

function fail(code) {
  throw new ExecutorError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validTimestamp(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function assertTimestamp(at) {
  if (!validTimestamp(at)) fail("EXECUTOR_TIMESTAMP_INVALID");
}

function assertObserved(observed) {
  if (!isPlainObject(observed)) fail("EXECUTOR_OBSERVATION_INVALID");
}

function assertState(record, allowed) {
  if (!isPlainObject(record) || !allowed.includes(record.state)) fail("EXECUTOR_STATE_MISMATCH");
}

function assertSecretFree(value) {
  if (Array.isArray(value)) {
    for (const entry of value) assertSecretFree(entry);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) fail("EXECUTOR_SECRET_FIELD_FORBIDDEN");
    assertSecretFree(entry);
  }
}

function pickKeys(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function assertOrderedParents(observedParents, expectedParents) {
  if (
    !Array.isArray(observedParents) ||
    observedParents.length !== expectedParents.length ||
    observedParents.some((value, index) => value !== expectedParents[index])
  ) {
    fail("EXECUTOR_LINEAGE_MISMATCH");
  }
}

function assertMergeCommitOnly(observed) {
  if (observed.mergeMethod !== "merge") fail("EXECUTOR_MERGE_METHOD_FORBIDDEN");
  if (observed.directMainPush !== false) fail("EXECUTOR_DIRECT_MAIN_PUSH_FORBIDDEN");
}

function accountMatrixEntry(step, operations) {
  const subTasks = operations.map((entry) => Object.freeze({ ...entry }));
  const accounts = [...new Set(subTasks.map((entry) => entry.account).filter((entry) => entry !== null))];
  return Object.freeze({
    step,
    operations: Object.freeze(subTasks),
    accounts: Object.freeze(accounts),
  });
}

export const EXECUTOR_ACCOUNT_MATRIX = Object.freeze({
  CREATE_CANDIDATE: accountMatrixEntry("CREATE_CANDIDATE", [
    { operation: "create", account: BLACK_ACCOUNT },
    { operation: "push", account: BLACK_ACCOUNT },
  ]),
  OPEN_STG_PR: accountMatrixEntry("OPEN_STG_PR", [
    { operation: "create", account: BLACK_ACCOUNT },
  ]),
  MERGE_STG_PR: accountMatrixEntry("MERGE_STG_PR", [
    { operation: "merge", account: KEDUALL_ACCOUNT },
    { operation: "verify", account: null },
  ]),
  EVALUATE_DB_GATE: accountMatrixEntry("EVALUATE_DB_GATE", [
    { operation: "verify", account: null },
  ]),
  OPEN_MAIN_PR: accountMatrixEntry("OPEN_MAIN_PR", [
    { operation: "create", account: BLACK_ACCOUNT },
  ]),
  MERGE_MAIN_PR: accountMatrixEntry("MERGE_MAIN_PR", [
    { operation: "merge", account: KEDUALL_ACCOUNT },
    { operation: "verify", account: null },
  ]),
  VERIFY_PRODUCTION: accountMatrixEntry("VERIFY_PRODUCTION", [
    { operation: "verify", account: null },
  ]),
  ROLLBACK_ALIAS: accountMatrixEntry("ROLLBACK_ALIAS", [
    { operation: "rollback", account: null },
  ]),
  CLEANUP_PROMOTION: accountMatrixEntry("CLEANUP_PROMOTION", [
    { operation: "cleanup", account: KEDUALL_ACCOUNT },
  ]),
});

export function accountForStep(step) {
  if (typeof step !== "string" || !Object.hasOwn(EXECUTOR_ACCOUNT_MATRIX, step)) {
    fail("EXECUTOR_STEP_UNKNOWN");
  }
  return EXECUTOR_ACCOUNT_MATRIX[step];
}

const TERMINAL_PLAN = { step: null, event: null, terminal: true, reason: "EXECUTOR_RUN_TERMINAL" };
const DB_GATE_RETRY_PLAN = {
  step: "EVALUATE_DB_GATE",
  event: "DB_GATE_EVALUATED",
  requiresDbEvidence: true,
  reason: "EXECUTOR_DB_GATE_RETRY_REQUIRED",
};

const NEXT_STEP_BY_STATE = new Map([
  [
    "BOOTSTRAP_REQUIRED",
    {
      step: null,
      event: null,
      terminal: true,
      reason: "EXECUTOR_BOOTSTRAP_NEW_RUN_REQUIRED",
    },
  ],
  ["PLANNED", { step: "CREATE_CANDIDATE", event: "CANDIDATE_VERIFIED" }],
  ["CANDIDATE_VERIFIED", { step: "OPEN_STG_PR", event: "STG_PR_OPEN" }],
  ["STG_PR_OPEN", { step: "MERGE_STG_PR", event: "STG_READY" }],
  [
    "STG_READY",
    { step: "EVALUATE_DB_GATE", event: "DB_GATE_EVALUATED", requiresDbEvidence: true },
  ],
  ["DB_BASELINE_REQUIRED", DB_GATE_RETRY_PLAN],
  ["DB_GATE_BLOCKED", DB_GATE_RETRY_PLAN],
  [
    "AWAITING_PROD_APPROVAL",
    {
      step: "AWAIT_PROD_APPROVAL",
      event: null,
      requiresHumanApproval: true,
      reason: "EXECUTOR_HUMAN_APPROVAL_REQUIRED",
    },
  ],
  ["PROD_APPROVED", { step: "OPEN_MAIN_PR", event: "MAIN_PR_OPEN" }],
  ["MAIN_PR_OPEN", { step: "MERGE_MAIN_PR", event: "MAIN_MERGE_VERIFIED" }],
  ["PRODUCTION_VERIFYING", { step: "VERIFY_PRODUCTION", event: "PRODUCTION_EVALUATED" }],
  ["ALIAS_ROLLBACK_REQUIRED", { step: "ROLLBACK_ALIAS", event: "ALIAS_ROLLBACK_VERIFIED" }],
  ["PRODUCTION_FAILED", TERMINAL_PLAN],
  ["RELEASED", { step: "CLEANUP_PROMOTION", event: "CLEANUP_VERIFIED" }],
  ["CLEANED", TERMINAL_PLAN],
  ["PRESERVED", TERMINAL_PLAN],
  ["SECURITY_INCIDENT_BLOCKED", TERMINAL_PLAN],
]);

export function planNextStep(record) {
  const state = isPlainObject(record) ? record.state : null;
  const plan = typeof state === "string" ? NEXT_STEP_BY_STATE.get(state) : undefined;
  if (plan === undefined) fail("EXECUTOR_STATE_UNKNOWN");
  const step = plan.step ?? null;
  return Object.freeze({
    step,
    event: plan.event ?? null,
    accountProfile:
      step !== null && Object.hasOwn(EXECUTOR_ACCOUNT_MATRIX, step)
        ? EXECUTOR_ACCOUNT_MATRIX[step]
        : null,
    requiresHumanApproval: plan.requiresHumanApproval === true,
    requiresDbEvidence: plan.requiresDbEvidence === true,
    terminal: plan.terminal === true,
    reason: plan.reason ?? "EXECUTOR_STEP_READY",
  });
}

export function buildCandidateVerifiedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["PLANNED"]);
  assertObserved(observed);
  if (observed.candidateBranch !== record.target.candidateBranch) {
    fail("EXECUTOR_CANDIDATE_BRANCH_MISMATCH");
  }
  if (!SHA_PATTERN.test(observed.candidateSha ?? "")) fail("EXECUTOR_SHA_INVALID");
  if (observed.targetBranch !== "stg") fail("EXECUTOR_TARGET_BRANCH_MISMATCH");
  if (observed.noFastForward !== true) fail("EXECUTOR_MERGE_METHOD_FORBIDDEN");
  assertMergeCommitOnly(observed);
  const expectedParents = [record.target.stgBaseSha, record.source.sha];
  if (observed.baseSha !== expectedParents[0] || observed.sourceSha !== expectedParents[1]) {
    fail("EXECUTOR_LINEAGE_MISMATCH");
  }
  assertOrderedParents(observed.parents, expectedParents);
  const event = {
    type: "CANDIDATE_VERIFIED",
    at,
    candidateSha: observed.candidateSha,
    branch: record.target.candidateBranch,
    baseSha: expectedParents[0],
    sourceSha: expectedParents[1],
    actualParents: [...expectedParents],
    mergeMethod: "merge",
    noFastForward: true,
    targetBranch: "stg",
    directMainPush: false,
  };
  const lineage = validateCandidateMerge({
    branch: event.branch,
    baseSha: event.baseSha,
    sourceSha: event.sourceSha,
    mergeMethod: event.mergeMethod,
    noFastForward: event.noFastForward,
    targetBranch: event.targetBranch,
    candidateSha: event.candidateSha,
    expectedParents: [...expectedParents],
    actualParents: event.actualParents,
  });
  if (!lineage.ok) fail("EXECUTOR_LINEAGE_MISMATCH");
  return event;
}

export function buildStgPrOpenEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["CANDIDATE_VERIFIED"]);
  assertObserved(observed);
  if (observed.targetBranch !== "stg") fail("EXECUTOR_TARGET_BRANCH_MISMATCH");
  if (observed.headBranch !== record.target.candidateBranch) {
    fail("EXECUTOR_CANDIDATE_BRANCH_MISMATCH");
  }
  if (!SHA_PATTERN.test(record.target.candidateSha ?? "")) fail("EXECUTOR_SHA_INVALID");
  if (observed.headSha !== record.target.candidateSha) fail("EXECUTOR_SHA_MISMATCH");
  return {
    type: "STG_PR_OPEN",
    at,
    targetBranch: "stg",
    headBranch: record.target.candidateBranch,
    headSha: record.target.candidateSha,
  };
}

export function buildStgReadyEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["STG_PR_OPEN"]);
  assertObserved(observed);
  if (!SHA_PATTERN.test(observed.stgSha ?? "")) fail("EXECUTOR_SHA_INVALID");
  assertMergeCommitOnly(observed);
  const expectedParents = [record.target.stgBaseSha, record.target.candidateSha];
  assertOrderedParents(observed.parents, expectedParents);
  if (!isPlainObject(observed.preview)) fail("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  assertSecretFree(observed.preview);
  const previewEvidence = pickKeys(observed.preview, PREVIEW_EVIDENCE_KEYS);
  const preview = validateVercelPreviewEvidence(previewEvidence, observed.stgSha, {
    expectedProject: record.vercel.project,
  });
  if (!preview.ok) fail("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  return {
    type: "STG_READY",
    at,
    stgSha: observed.stgSha,
    mergeMethod: "merge",
    actualParents: [...expectedParents],
    directMainPush: false,
    previewEvidence,
  };
}

export function buildDbGateEvaluatedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["STG_READY", "DB_BASELINE_REQUIRED", "DB_GATE_BLOCKED"]);
  assertObserved(observed);
  if (!isPlainObject(observed.migrationEvidence)) fail("EXECUTOR_DB_EVIDENCE_REQUIRED");
  assertSecretFree(observed.migrationEvidence);
  if (observed.migrationEvidence.autoApplyEnabled !== false) {
    fail("EXECUTOR_DB_AUTO_APPLY_FORBIDDEN");
  }
  return {
    type: "DB_GATE_EVALUATED",
    at,
    migrationEvidence: structuredClone(observed.migrationEvidence),
  };
}

export function buildMainPrOpenEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["PROD_APPROVED"]);
  assertObserved(observed);
  if (observed.targetBranch !== "main") fail("EXECUTOR_TARGET_BRANCH_MISMATCH");
  if (observed.headBranch !== "stg") fail("EXECUTOR_TARGET_BRANCH_MISMATCH");
  assertMergeCommitOnly(observed);
  if (!SHA_PATTERN.test(record.target.stgSha ?? "")) fail("EXECUTOR_SHA_INVALID");
  if (observed.headSha !== record.target.stgSha) fail("EXECUTOR_SHA_MISMATCH");
  return {
    type: "MAIN_PR_OPEN",
    at,
    targetBranch: "main",
    headBranch: "stg",
    headSha: record.target.stgSha,
    mergeMethod: "merge",
    directMainPush: false,
  };
}

export function buildMainMergeVerifiedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["MAIN_PR_OPEN"]);
  assertObserved(observed);
  if (!SHA_PATTERN.test(observed.mainBaseSha ?? "") || !SHA_PATTERN.test(observed.mainSha ?? "")) {
    fail("EXECUTOR_SHA_INVALID");
  }
  if (observed.targetBranch !== "main") fail("EXECUTOR_TARGET_BRANCH_MISMATCH");
  assertMergeCommitOnly(observed);
  if (observed.headSha !== record.target.stgSha) fail("EXECUTOR_SHA_MISMATCH");
  const expectedParents = [observed.mainBaseSha, record.target.stgSha];
  assertOrderedParents(observed.parents, expectedParents);
  return {
    type: "MAIN_MERGE_VERIFIED",
    at,
    mainBaseSha: observed.mainBaseSha,
    mainSha: observed.mainSha,
    headSha: record.target.stgSha,
    targetBranch: "main",
    mergeMethod: "merge",
    directMainPush: false,
    actualParents: [...expectedParents],
  };
}

export function buildProductionEvaluatedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["PRODUCTION_VERIFYING"]);
  assertObserved(observed);
  if (!isPlainObject(observed.deployment)) fail("EXECUTOR_PRODUCTION_EVIDENCE_INVALID");
  assertSecretFree(observed.deployment);
  const deployment = observed.deployment;
  if (deployment.commitSha !== record.target.mainSha) fail("EXECUTOR_PRODUCTION_SHA_MISMATCH");
  if (deployment.project !== record.vercel.project) fail("EXECUTOR_PRODUCTION_PROJECT_MISMATCH");
  if (deployment.target !== "production") fail("EXECUTOR_PRODUCTION_TARGET_MISMATCH");
  if (deployment.domain !== record.vercel.domain) fail("EXECUTOR_PRODUCTION_DOMAIN_MISMATCH");
  if (deployment.smokeReadOnly !== true) fail("EXECUTOR_SMOKE_MUST_BE_READ_ONLY");
  if (
    typeof deployment.deploymentId !== "string" ||
    deployment.deploymentId.length === 0 ||
    typeof deployment.state !== "string" ||
    typeof deployment.alias !== "string" ||
    typeof deployment.smokePassed !== "boolean" ||
    typeof deployment.aliasSwitched !== "boolean"
  ) {
    fail("EXECUTOR_PRODUCTION_EVIDENCE_INVALID");
  }
  const evidence = pickKeys(deployment, PRODUCTION_EVIDENCE_KEYS);
  for (const key of PRODUCTION_ROLLBACK_HINT_KEYS) {
    if (deployment[key] !== undefined) evidence[key] = deployment[key];
  }
  return { type: "PRODUCTION_EVALUATED", at, evidence };
}

export function buildAliasRollbackVerifiedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["ALIAS_ROLLBACK_REQUIRED"]);
  assertObserved(observed);
  if (!isPlainObject(observed.rollback)) fail("EXECUTOR_ROLLBACK_EVIDENCE_INVALID");
  assertSecretFree(observed.rollback);
  const rollback = observed.rollback;
  if (rollback.rollbackDeploymentId !== record.vercel.rollbackDeploymentId) {
    fail("EXECUTOR_ROLLBACK_TARGET_MISMATCH");
  }
  if (rollback.rollbackDeploymentState !== "READY") fail("EXECUTOR_ROLLBACK_NOT_READY");
  if (rollback.alias !== record.vercel.domain) fail("EXECUTOR_ALIAS_MISMATCH");
  if (rollback.databaseChanged !== false) fail("EXECUTOR_DATABASE_ROLLBACK_FORBIDDEN");
  const evidence = pickKeys(rollback, ROLLBACK_EVIDENCE_KEYS);
  const verified = validateVercelRollbackEvidence(evidence, {
    requiredDeploymentId: record.vercel.rollbackDeploymentId,
    requiredAlias: record.vercel.domain,
  });
  if (!verified.ok) fail("EXECUTOR_ROLLBACK_EVIDENCE_INVALID");
  return { type: "ALIAS_ROLLBACK_VERIFIED", at, evidence };
}

export function buildCleanupVerifiedEvent({ at, record, observed }) {
  assertTimestamp(at);
  assertState(record, ["RELEASED"]);
  assertObserved(observed);
  if (observed.stgFastForwardedToMain !== true) fail("EXECUTOR_STG_NOT_FAST_FORWARDED");
  if (record.workspace.ownership !== "managed") fail("EXECUTOR_WORKSPACE_NOT_MANAGED");
  if (record.vercel.commitSha !== record.target.mainSha) fail("EXECUTOR_PRODUCTION_SHA_MISMATCH");
  if (record.vercel.smokeStatus !== "PASSED") fail("EXECUTOR_SMOKE_NOT_PASSED");
  const eligibility = cleanupEligibility({
    productionReady: true,
    exactMainSha: true,
    smokePassed: true,
    stgFastForwardedToMain: true,
    workspaceOwnership: record.workspace.ownership,
    candidateBranch: record.target.candidateBranch,
  });
  if (!eligibility.eligible) fail("EXECUTOR_CLEANUP_NOT_ELIGIBLE");
  return { type: "CLEANUP_VERIFIED", at, stgFastForwardedToMain: true };
}

export function evaluatePreflight({ record, observed }) {
  if (validatePromotionRunV1(record).length > 0) fail("EXECUTOR_RECORD_INVALID");
  assertObserved(observed);
  const plan = planNextStep(record);
  const blockers = [];
  if (plan.terminal) blockers.push("EXECUTOR_RUN_TERMINAL");
  if (plan.requiresHumanApproval) blockers.push("EXECUTOR_HUMAN_APPROVAL_REQUIRED");

  const expectedStgTip = record.target.stgSha ?? record.target.stgBaseSha;
  if (!SHA_PATTERN.test(observed.stgSha ?? "")) blockers.push("EXECUTOR_STG_TIP_UNVERIFIED");
  else if (observed.stgSha !== expectedStgTip) blockers.push("PROMOTION_BASE_MOVED");

  for (const [actual, expected] of [
    [observed.sourceRepositoryIdentity, record.source.repositoryIdentity],
    [observed.targetRepositoryIdentity, record.target.repositoryIdentity],
  ]) {
    if (typeof actual !== "string" || actual.length === 0) {
      blockers.push("EXECUTOR_REPOSITORY_IDENTITY_UNVERIFIED");
    } else if (actual.toLowerCase() !== expected.toLowerCase()) {
      blockers.push("REPOSITORY_IDENTITY_MISMATCH");
    }
  }

  if (observed.registryLockPresent === true) blockers.push("PROMOTION_REGISTRY_LOCKED");
  else if (observed.registryLockPresent !== false) blockers.push("EXECUTOR_REGISTRY_LOCK_UNVERIFIED");

  const required = plan.accountProfile?.accounts ?? [];
  if (required.length > 0) {
    if (!Array.isArray(observed.verifiedAccounts)) blockers.push("EXECUTOR_ACCOUNT_UNVERIFIED");
    else if (required.some((account) => !observed.verifiedAccounts.includes(account))) {
      blockers.push("EXECUTOR_ACCOUNT_UNAVAILABLE");
    }
  }

  const unique = [...new Set(blockers)];
  return { ok: unique.length === 0, blockers: unique };
}

function pathContains(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function loadMigrationEvidenceFile({ evidencePath, allowedRoot }) {
  if (typeof evidencePath !== "string" || evidencePath.trim() === "" ||
      typeof allowedRoot !== "string" || allowedRoot.trim() === "") {
    fail("DB_EVIDENCE_UNREADABLE");
  }
  const root = path.resolve(allowedRoot);
  const target = path.resolve(evidencePath);
  if (!pathContains(root, target)) fail("DB_EVIDENCE_PATH_ESCAPE");
  let rootReal;
  let targetReal;
  let status;
  try {
    if (lstatSync(root).isSymbolicLink()) fail("DB_EVIDENCE_SYMLINK");
    const link = lstatSync(target);
    if (link.isSymbolicLink()) fail("DB_EVIDENCE_SYMLINK");
    if (!link.isFile()) fail("DB_EVIDENCE_UNREADABLE");
    rootReal = realpathSync.native(root);
    targetReal = realpathSync.native(target);
    status = statSync(targetReal);
  } catch (error) {
    if (error instanceof ExecutorError) throw error;
    fail("DB_EVIDENCE_UNREADABLE");
  }
  if (path.resolve(rootReal).toLowerCase() !== root.toLowerCase()) fail("DB_EVIDENCE_SYMLINK");
  if (!pathContains(rootReal, targetReal)) fail("DB_EVIDENCE_PATH_ESCAPE");
  if (!status.isFile()) fail("DB_EVIDENCE_UNREADABLE");
  if (status.size > MAX_MIGRATION_EVIDENCE_BYTES) fail("DB_EVIDENCE_TOO_LARGE");
  let content;
  try {
    content = readFileSync(targetReal, "utf8");
  } catch {
    fail("DB_EVIDENCE_UNREADABLE");
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail("DB_EVIDENCE_INVALID_JSON");
  }
  return parsed;
}

export function submittedEvidencePath({ gitCommonDir, runId, sequence, eventType }) {
  if (!RUN_ID_PATTERN.test(runId ?? "")) fail("PROMOTION_EVIDENCE_RUN_ID_INVALID");
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_EVIDENCE_SEQUENCE) {
    fail("PROMOTION_EVIDENCE_SEQUENCE_INVALID");
  }
  if (!EVENT_TYPE_PATTERN.test(eventType ?? "")) fail("PROMOTION_EVIDENCE_EVENT_INVALID");
  const root = assertPromotionRegistryRoot(gitCommonDir);
  const directory = path.join(root, ...EVIDENCE_REGISTRY_SEGMENTS, runId);
  return path.join(directory, `${String(sequence).padStart(3, "0")}-${eventType}.json`);
}

export function writeSubmittedEvidence({ gitCommonDir, runId, event, sequence, now }) {
  assertTimestamp(now);
  if (!isPlainObject(event)) fail("PROMOTION_EVIDENCE_EVENT_INVALID");
  const target = submittedEvidencePath({
    gitCommonDir,
    runId,
    sequence,
    eventType: event.type,
  });
  if (scanForSecrets(event).length > 0) fail("PROMOTION_EVIDENCE_SECRET_FORBIDDEN");
  const directory = path.dirname(target);
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) {
    fail("PROMOTION_EVIDENCE_SYMLINK");
  }
  if (existsSync(target)) {
    const status = lstatSync(target);
    if (status.isSymbolicLink() || !status.isFile()) fail("PROMOTION_EVIDENCE_SYMLINK");
  }
  atomicWritePromotionFile(target, {
    schemaVersion: 1,
    recordType: "PromotionSubmittedEvidenceV1",
    runId,
    sequence,
    recordedAt: now,
    event: structuredClone(event),
  });
  return target;
}

export function assertExecutorSubmittableEvent(event) {
  if (!isPlainObject(event) || !EVENT_TYPE_PATTERN.test(event.type ?? "")) {
    fail("EXECUTOR_EVENT_INVALID");
  }
  if (EXECUTOR_FORBIDDEN_EVENT_TYPES.includes(event.type)) {
    fail("EXECUTOR_APPROVAL_EVENT_FORBIDDEN");
  }
  return event;
}

export const EXECUTOR_FORBIDDEN_EVENTS = EXECUTOR_FORBIDDEN_EVENT_TYPES;

export function quoteCommandArgument(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildHumanApprovalCommand({ repository, record, at }) {
  assertTimestamp(at);
  if (typeof repository !== "string" || repository.length === 0) {
    fail("EXECUTOR_REPOSITORY_REQUIRED");
  }
  if (!isPlainObject(record) || record.state !== "AWAITING_PROD_APPROVAL") {
    fail("EXECUTOR_HUMAN_APPROVAL_NOT_PENDING");
  }
  if (!DIGEST_PATTERN.test(record.approval?.approvalFingerprint ?? "")) {
    fail("EXECUTOR_APPROVAL_FINGERPRINT_UNAVAILABLE");
  }
  if (!DIGEST_PATTERN.test(record.fingerprint ?? "") ||
      !Number.isSafeInteger(record.revision) ||
      record.revision < 0) {
    fail("EXECUTOR_RECORD_INVALID");
  }
  return [
    "pnpm release:resume --",
    `--repo ${quoteCommandArgument(repository)}`,
    `--run-id ${record.runId}`,
    `--expected-revision ${record.revision}`,
    `--expected-fingerprint ${record.fingerprint}`,
    "--event PROD_APPROVAL_GRANTED",
    `--event-at ${at}`,
    `--approval ${record.approval.approvalFingerprint}`,
  ].join(" ");
}
