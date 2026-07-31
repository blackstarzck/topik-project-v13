import {
  lstatSync as nodeLstatSync,
  readFileSync as nodeReadFileSync,
  statSync as nodeStatSync,
} from "node:fs";
import path from "node:path";

import { resolvePipelineSharedRoot } from "./ai-task-sweep.mjs";

const DEFAULT_BASE_URL = "https://api.vercel.com";
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_SMOKE_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_TIMED_OUT = Symbol("VERCEL_REQUEST_TIMED_OUT");

const CREDENTIAL_SUBDIRECTORY = "credentials";
const CREDENTIAL_FILE = "vercel.env";
const CREDENTIAL_ALLOWED_KEYS = Object.freeze(["VERCEL_TOKEN", "VERCEL_TEAM_ID"]);
const CREDENTIAL_REDACTION = "[VercelCredentialProvider]";

const PREVIEW_ENVIRONMENT_SCOPE = "topik-dev";
const DEPLOYMENT_TARGETS = new Set(["preview", "production"]);
const TERMINAL_FAILED_STATES = new Set(["ERROR", "CANCELED", "CANCELLED", "DELETED"]);

const SHA_PATTERN = /^[a-f0-9]{40}$/iu;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const STATE_PATTERN = /^[A-Z][A-Z_]{0,31}$/u;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/u;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const HEADER_VALUE_PATTERN = /^[!-~]+$/u;
const SMOKE_PATH_PATTERN = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/u;

export class VercelError extends Error {
  constructor(code) {
    super(code);
    this.name = "VercelError";
    this.code = code;
  }
}

function fail(code) {
  throw new VercelError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSha(value, code = "VERCEL_API_UNAVAILABLE") {
  if (typeof value !== "string" || !SHA_PATTERN.test(value)) fail(code);
  return value.toLowerCase();
}

function assertIdentifier(value, code = "VERCEL_API_UNAVAILABLE") {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) fail(code);
  return value;
}

function assertDomain(value, code = "VERCEL_ALIAS_MISMATCH") {
  if (typeof value !== "string" || !DOMAIN_PATTERN.test(value)) fail(code);
  return value;
}

function assertBranch(value, code = "VERCEL_API_UNAVAILABLE") {
  if (typeof value !== "string" || !BRANCH_PATTERN.test(value) || value.includes("..")) fail(code);
  return value;
}

function assertTarget(value, code = "VERCEL_API_UNAVAILABLE") {
  if (typeof value !== "string" || !DEPLOYMENT_TARGETS.has(value)) fail(code);
  return value;
}

function assertPositiveInteger(value, code) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(code);
  return value;
}

function assertBoolean(value, code) {
  if (typeof value !== "boolean") fail(code);
  return value;
}

function assertNonEmptyText(value, code) {
  if (typeof value !== "string" || value.trim() === "") fail(code);
  return value;
}

function credentialFilePath(localAppData, env) {
  let root;
  try {
    root = resolvePipelineSharedRoot({ localAppData, env }).root;
  } catch {
    return null;
  }
  return path.join(root, CREDENTIAL_SUBDIRECTORY, CREDENTIAL_FILE);
}

function assertNoReparseAncestor(file, lstat) {
  let current = path.dirname(file);
  for (;;) {
    let status;
    try {
      status = lstat(current);
    } catch {
      fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    }
    if (status.isSymbolicLink() || !status.isDirectory()) {
      fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function assertPlainCredentialFile(file, statuses) {
  const { lstat, stat } = statuses;
  let linkStatus;
  try {
    linkStatus = lstat(file);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
  }
  if (linkStatus.isSymbolicLink() || !linkStatus.isFile()) {
    fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
  }
  let resolvedStatus;
  try {
    resolvedStatus = stat(file);
  } catch {
    fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
  }
  if (!resolvedStatus.isFile()) fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
  assertNoReparseAncestor(file, lstat);
  return true;
}

function parseCredentialFile(content) {
  const allowed = new Set(CREDENTIAL_ALLOWED_KEYS);
  const values = new Map();
  for (const line of String(content).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    const key = trimmed.slice(0, separator).trim();
    if (!ENV_KEY_PATTERN.test(key) || !allowed.has(key) || values.has(key)) {
      fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    }
    values.set(key, trimmed.slice(separator + 1).trim());
  }
  return values;
}

function assertCredentialToken(value, code) {
  if (typeof value !== "string" || !HEADER_VALUE_PATTERN.test(value)) fail(code);
  return value;
}

function assertCredentialTeamId(value, code) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) fail(code);
  return value;
}

function sealedCredentialProvider(token, teamId, source) {
  return Object.freeze({
    authorizationHeader() {
      return `Bearer ${token}`;
    },
    teamId() {
      return teamId;
    },
    source() {
      return source;
    },
    toJSON() {
      return { recordType: "VercelCredentialProviderV1", source };
    },
    toString() {
      return CREDENTIAL_REDACTION;
    },
    inspect() {
      return CREDENTIAL_REDACTION;
    },
    [Symbol.for("nodejs.util.inspect.custom")]() {
      return CREDENTIAL_REDACTION;
    },
    [Symbol.toPrimitive]() {
      return CREDENTIAL_REDACTION;
    },
  });
}

export function createVercelCredentialProvider({
  localAppData = process.env.LOCALAPPDATA,
  readFileSync = nodeReadFileSync,
  statSync = nodeStatSync,
  lstatSync = nodeLstatSync,
  env = process.env,
} = {}) {
  for (const dependency of [readFileSync, statSync, lstatSync]) {
    if (typeof dependency !== "function") fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
  }
  if (env === null || typeof env !== "object") fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");

  const file = credentialFilePath(localAppData, env);
  if (file !== null && assertPlainCredentialFile(file, { lstat: lstatSync, stat: statSync })) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    }
    if (typeof content !== "string") fail("EXECUTOR_VERCEL_CREDENTIAL_INVALID");
    const values = parseCredentialFile(content);
    const token = assertCredentialToken(
      values.get("VERCEL_TOKEN"),
      "EXECUTOR_VERCEL_CREDENTIAL_INVALID",
    );
    const teamId = assertCredentialTeamId(
      values.get("VERCEL_TEAM_ID"),
      "EXECUTOR_VERCEL_CREDENTIAL_INVALID",
    );
    return sealedCredentialProvider(token, teamId, "file");
  }

  const fallbackToken = typeof env?.VERCEL_TOKEN === "string" ? env.VERCEL_TOKEN.trim() : "";
  if (fallbackToken === "") fail("VERCEL_TOKEN_MISSING");
  const token = assertCredentialToken(fallbackToken, "VERCEL_TOKEN_MISSING");
  const rawTeamId = typeof env?.VERCEL_TEAM_ID === "string" ? env.VERCEL_TEAM_ID.trim() : "";
  const teamId = assertCredentialTeamId(
    rawTeamId === "" ? undefined : rawTeamId,
    "VERCEL_TOKEN_MISSING",
  );
  return sealedCredentialProvider(token, teamId, "env");
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function defaultClock() {
  return Date.now();
}

async function withRequestDeadline(timeoutMs, invoke) {
  const controller = new AbortController();
  let timer = null;
  const expiry = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(REQUEST_TIMED_OUT);
    }, timeoutMs);
    if (typeof timer?.unref === "function") timer.unref();
  });
  try {
    const outcome = await Promise.race([invoke(controller.signal), expiry]);
    return outcome === REQUEST_TIMED_OUT ? null : outcome;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readyStateOf(entry) {
  const state = entry.readyState ?? entry.state;
  if (typeof state !== "string" || !STATE_PATTERN.test(state)) fail("VERCEL_API_UNAVAILABLE");
  return state;
}

function deploymentIdOf(entry) {
  return assertIdentifier(entry.uid ?? entry.id);
}

function commitShaOf(entry) {
  const meta = isPlainObject(entry.meta) ? entry.meta : {};
  const sha = meta.githubCommitSha ?? entry.commitSha;
  return typeof sha === "string" && SHA_PATTERN.test(sha) ? sha.toLowerCase() : null;
}

function branchOf(entry) {
  const meta = isPlainObject(entry.meta) ? entry.meta : {};
  const branch = meta.githubCommitRef ?? entry.branch;
  return typeof branch === "string" && BRANCH_PATTERN.test(branch) ? branch : null;
}

function targetOf(entry) {
  return typeof entry.target === "string" && DEPLOYMENT_TARGETS.has(entry.target)
    ? entry.target
    : null;
}

export function createVercelAdapter({
  credentialProvider,
  fetchImplementation,
  sleep = defaultSleep,
  clock = defaultClock,
  baseUrl = DEFAULT_BASE_URL,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}) {
  if (
    credentialProvider === null ||
    typeof credentialProvider !== "object" ||
    typeof credentialProvider.authorizationHeader !== "function" ||
    typeof credentialProvider.teamId !== "function" ||
    typeof credentialProvider.source !== "function"
  ) {
    fail("VERCEL_TOKEN_MISSING");
  }
  if (typeof fetchImplementation !== "function" || typeof sleep !== "function" ||
      typeof clock !== "function") {
    fail("VERCEL_API_UNAVAILABLE");
  }
  const requestTimeout = assertPositiveInteger(requestTimeoutMs, "VERCEL_API_UNAVAILABLE");
  let origin;
  try {
    origin = new URL(baseUrl);
  } catch {
    return fail("VERCEL_API_UNAVAILABLE");
  }
  if (origin.protocol !== "https:") fail("VERCEL_API_UNAVAILABLE");

  const buildUrl = (endpoint, query) => {
    const url = new URL(endpoint, origin.origin);
    for (const [name, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) url.searchParams.set(name, String(value));
    }
    const teamId = credentialProvider.teamId();
    if (typeof teamId === "string" && teamId !== "") url.searchParams.set("teamId", teamId);
    return url.toString();
  };

  const sendRequest = async (method, endpoint, query, body) => {
    const headers = { accept: "application/json" };
    headers.authorization = credentialProvider.authorizationHeader();
    if (body !== undefined) headers["content-type"] = "application/json";
    const outcome = await withRequestDeadline(requestTimeout, async (signal) => {
      const response = await fetchImplementation(buildUrl(endpoint, query), {
        method,
        headers,
        redirect: "error",
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response === null || response === undefined) return null;
      const status = Number(response.status);
      if (!Number.isInteger(status)) return null;
      if (status === 404) return { status, payload: null };
      if (status < 200 || status >= 300 || typeof response.json !== "function") return null;
      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return isPlainObject(payload) ? { status, payload } : null;
    });
    if (outcome === null || outcome === undefined) fail("VERCEL_API_UNAVAILABLE");
    return outcome;
  };

  const readJson = (endpoint, query = {}) => sendRequest("GET", endpoint, query);

  const listDeployments = async (projectId, target) => {
    const { payload } = await readJson("/v6/deployments", {
      projectId,
      target,
      limit: DEFAULT_LIST_LIMIT,
    });
    if (payload === null || !Array.isArray(payload.deployments)) fail("VERCEL_API_UNAVAILABLE");
    return payload.deployments.filter((entry) => isPlainObject(entry));
  };

  const getAliasTarget = async ({ domain }) => {
    const alias = assertDomain(domain);
    const { status, payload } = await readJson(`/v4/aliases/${encodeURIComponent(alias)}`);
    if (status === 404 || payload === null) return null;
    const deployment = isPlainObject(payload.deployment) ? payload.deployment : payload;
    const deploymentId = deployment.id ?? deployment.deploymentId;
    return Object.freeze({ deploymentId: assertIdentifier(deploymentId) });
  };

  return Object.freeze({
    async findDeploymentByCommit({ projectId, commitSha, target }) {
      const project = assertIdentifier(projectId);
      const sha = assertSha(commitSha);
      const scope = assertTarget(target);
      const deployments = await listDeployments(project, scope);
      const match = deployments.find((entry) => commitShaOf(entry) === sha);
      if (match === undefined) return null;
      return Object.freeze({
        deploymentId: deploymentIdOf(match),
        state: readyStateOf(match),
        target: targetOf(match),
        branch: branchOf(match),
      });
    },

    async waitForReady({ deploymentId, maxAttempts, intervalMs }) {
      const id = assertIdentifier(deploymentId);
      const attempts = assertPositiveInteger(maxAttempts, "VERCEL_NOT_READY");
      const interval = assertPositiveInteger(intervalMs, "VERCEL_NOT_READY");
      const deadline = clock() + (attempts + 1) * interval;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const { status, payload } = await readJson(`/v13/deployments/${encodeURIComponent(id)}`);
        if (status === 404 || payload === null) fail("VERCEL_DEPLOYMENT_NOT_FOUND");
        const state = readyStateOf(payload);
        if (state === "READY") return Object.freeze({ state: "READY" });
        if (TERMINAL_FAILED_STATES.has(state)) fail("VERCEL_NOT_READY");
        if (attempt === attempts || clock() > deadline) break;
        await sleep(interval);
      }
      return fail("VERCEL_NOT_READY");
    },

    getAliasTarget,

    async assignAlias({ deploymentId, domain }) {
      const id = assertIdentifier(deploymentId);
      const alias = assertDomain(domain);
      const { status } = await sendRequest(
        "POST",
        `/v2/deployments/${encodeURIComponent(id)}/aliases`,
        {},
        { alias },
      );
      if (status === 404) fail("VERCEL_DEPLOYMENT_NOT_FOUND");
      const assigned = await getAliasTarget({ domain: alias });
      if (assigned === null || assigned.deploymentId !== id) fail("VERCEL_ALIAS_MISMATCH");
      return Object.freeze({ assigned: true });
    },

    async findPreviousReadyProduction({ projectId, beforeDeploymentId }) {
      const project = assertIdentifier(projectId);
      const before = assertIdentifier(beforeDeploymentId);
      const deployments = await listDeployments(project, "production");
      const index = deployments.findIndex((entry) => deploymentIdOf(entry) === before);
      if (index === -1) fail("VERCEL_DEPLOYMENT_NOT_FOUND");
      const previous = deployments
        .slice(index + 1)
        .find((entry) => readyStateOf(entry) === "READY");
      if (previous === undefined) return null;
      return Object.freeze({ deploymentId: deploymentIdOf(previous), state: "READY" });
    },

    async verifyPreviewEnvironmentScope({ projectId, branch }) {
      const project = assertIdentifier(projectId);
      const gitBranch = assertBranch(branch);
      const { payload } = await readJson(`/v9/projects/${encodeURIComponent(project)}/env`, {
        gitBranch,
      });
      if (payload === null || !Array.isArray(payload.envs)) fail("VERCEL_API_UNAVAILABLE");
      const scoped = payload.envs.filter((entry) => {
        if (!isPlainObject(entry)) return false;
        const named = typeof entry.key === "string" && ENV_KEY_PATTERN.test(entry.key);
        const previewTargeted = Array.isArray(entry.target) && entry.target.includes("preview");
        const branchScoped =
          entry.gitBranch === null ||
          entry.gitBranch === undefined ||
          entry.gitBranch === gitBranch;
        return named && previewTargeted && branchScoped;
      });
      return Object.freeze({
        environmentScope: scoped.length > 0 ? PREVIEW_ENVIRONMENT_SCOPE : null,
      });
    },
  });
}

export function previewObservation({ deployment, project, expectedStgSha, environmentScope }) {
  if (!isPlainObject(deployment)) fail("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  const expected = assertSha(expectedStgSha, "EXECUTOR_SHA_INVALID");
  const measured = assertSha(deployment.commitSha ?? expected, "EXECUTOR_SHA_INVALID");
  if (measured !== expected) fail("EXECUTOR_PREVIEW_EVIDENCE_INVALID");
  return {
    deploymentId: assertIdentifier(deployment.deploymentId, "EXECUTOR_PREVIEW_EVIDENCE_INVALID"),
    commitSha: expected,
    project: assertNonEmptyText(project, "EXECUTOR_PREVIEW_EVIDENCE_INVALID"),
    state: assertNonEmptyText(deployment.state, "EXECUTOR_PREVIEW_EVIDENCE_INVALID"),
    target: deployment.target ?? null,
    branch: deployment.branch ?? null,
    environmentScope: environmentScope ?? null,
  };
}

export function productionObservation({
  deployment,
  project,
  domain,
  alias,
  aliasSwitched,
  smoke,
  previousReady,
}) {
  if (!isPlainObject(deployment)) fail("EXECUTOR_PRODUCTION_EVIDENCE_INVALID");
  if (!isPlainObject(smoke)) fail("EXECUTOR_PRODUCTION_EVIDENCE_INVALID");
  if (smoke.smokeReadOnly !== true) fail("EXECUTOR_SMOKE_MUST_BE_READ_ONLY");
  const observation = {
    deploymentId: assertIdentifier(deployment.deploymentId, "EXECUTOR_PRODUCTION_EVIDENCE_INVALID"),
    commitSha: assertSha(deployment.commitSha, "EXECUTOR_SHA_INVALID"),
    project: assertNonEmptyText(project, "EXECUTOR_PRODUCTION_EVIDENCE_INVALID"),
    state: assertNonEmptyText(deployment.state, "EXECUTOR_PRODUCTION_EVIDENCE_INVALID"),
    target: deployment.target ?? null,
    alias: assertDomain(alias, "EXECUTOR_ALIAS_MISMATCH"),
    domain: assertDomain(domain, "EXECUTOR_ALIAS_MISMATCH"),
    smokeReadOnly: true,
    smokePassed: assertBoolean(smoke.smokePassed, "EXECUTOR_PRODUCTION_EVIDENCE_INVALID"),
    aliasSwitched: assertBoolean(aliasSwitched, "EXECUTOR_PRODUCTION_EVIDENCE_INVALID"),
  };
  if (previousReady === null || previousReady === undefined) return observation;
  if (!isPlainObject(previousReady)) fail("EXECUTOR_PRODUCTION_EVIDENCE_INVALID");
  observation.previousReadyDeploymentId = assertIdentifier(
    previousReady.deploymentId,
    "EXECUTOR_PRODUCTION_EVIDENCE_INVALID",
  );
  observation.previousReadyState = assertNonEmptyText(
    previousReady.state,
    "EXECUTOR_PRODUCTION_EVIDENCE_INVALID",
  );
  return observation;
}

export function rollbackObservation({ deployment, alias }) {
  if (!isPlainObject(deployment)) fail("EXECUTOR_ROLLBACK_EVIDENCE_INVALID");
  return {
    rollbackDeploymentId: assertIdentifier(
      deployment.deploymentId,
      "EXECUTOR_ROLLBACK_EVIDENCE_INVALID",
    ),
    rollbackDeploymentState: assertNonEmptyText(
      deployment.state,
      "EXECUTOR_ROLLBACK_EVIDENCE_INVALID",
    ),
    alias: assertDomain(alias, "EXECUTOR_ALIAS_MISMATCH"),
    databaseChanged: false,
  };
}

function smokeCheckPlan(check, base) {
  if (!isPlainObject(check)) fail("EXECUTOR_SMOKE_CHECK_INVALID");
  const { path: checkPath, expectedStatus } = check;
  if (
    typeof checkPath !== "string" ||
    !SMOKE_PATH_PATTERN.test(checkPath) ||
    checkPath.startsWith("//")
  ) {
    fail("EXECUTOR_SMOKE_CHECK_INVALID");
  }
  if (!Number.isSafeInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    fail("EXECUTOR_SMOKE_CHECK_INVALID");
  }
  let url;
  try {
    url = new URL(checkPath, base.origin);
  } catch {
    return fail("EXECUTOR_SMOKE_CHECK_INVALID");
  }
  if (url.origin !== base.origin) fail("EXECUTOR_SMOKE_CHECK_INVALID");
  return { url: url.toString(), expectedStatus };
}

export async function runReadOnlySmoke({
  baseUrl,
  checks,
  fetchImplementation,
  timeoutMs = DEFAULT_SMOKE_TIMEOUT_MS,
}) {
  if (typeof fetchImplementation !== "function") fail("EXECUTOR_SMOKE_CHECK_INVALID");
  if (!Array.isArray(checks) || checks.length === 0) fail("EXECUTOR_SMOKE_CHECK_INVALID");
  const timeout = assertPositiveInteger(timeoutMs, "EXECUTOR_SMOKE_CHECK_INVALID");
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return fail("EXECUTOR_SMOKE_CHECK_INVALID");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    fail("EXECUTOR_SMOKE_CHECK_INVALID");
  }
  const plans = checks.map((check) => smokeCheckPlan(check, base));

  let failedCheckCount = 0;
  for (const plan of plans) {
    const status = await withRequestDeadline(timeout, async (signal) => {
      const response = await fetchImplementation(plan.url, {
        method: "GET",
        redirect: "manual",
        signal,
      });
      const observed = Number(response?.status);
      return Number.isInteger(observed) ? observed : null;
    });
    if (status !== plan.expectedStatus) failedCheckCount += 1;
  }

  return Object.freeze({
    smokePassed: failedCheckCount === 0,
    smokeReadOnly: true,
    checkCount: plans.length,
    failedCheckCount,
  });
}

export const VERCEL_CREDENTIAL_ALLOWED_KEYS = CREDENTIAL_ALLOWED_KEYS;
export const VERCEL_CREDENTIAL_RELATIVE_PATH = Object.freeze([
  CREDENTIAL_SUBDIRECTORY,
  CREDENTIAL_FILE,
]);
export const VERCEL_PREVIEW_ENVIRONMENT_SCOPE = PREVIEW_ENVIRONMENT_SCOPE;
