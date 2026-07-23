export const SUPABASE_DEV_PROJECT_REF = "fglggyfvzjdsbyckinqa";
export const SUPABASE_PROD_PROJECT_REF = "eymlabowhfgtxbiqwxqh";

export const STANDARD_PLAYWRIGHT_TEST_IGNORE = Object.freeze([
  "**/phase-6-smoke.spec.mjs",
]);

const PRIVILEGED_LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const LOCAL_ORIGIN_PATTERN =
  /^(https?):\/\/(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]+))?\/?$/u;
const HOSTED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/u;
const ASCII_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const DEFAULT_PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000";
const PRIVILEGED_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
];

function hasValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

function policyError(message) {
  return new Error(message);
}

function normalizePublicValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function classifyApprovedRawOrigin(value) {
  if (typeof value !== "string" || ASCII_CONTROL_PATTERN.test(value)) {
    return null;
  }

  const localMatch = LOCAL_ORIGIN_PATTERN.exec(value);
  if (localMatch?.[0] === value) {
    return {
      hostname: localMatch[2].replace(/^\[|\]$/gu, ""),
      kind: "local",
    };
  }

  const hostedMatch = HOSTED_ORIGIN_PATTERN.exec(value);
  if (hostedMatch?.[0] !== value) return null;

  const ref = hostedMatch[1];
  if (ref === SUPABASE_DEV_PROJECT_REF) {
    return {
      environment: "development",
      kind: "remote",
      ref: SUPABASE_DEV_PROJECT_REF,
    };
  }
  if (ref === SUPABASE_PROD_PROJECT_REF) {
    return {
      environment: "production",
      kind: "remote",
      ref: SUPABASE_PROD_PROJECT_REF,
    };
  }

  return null;
}

function parseApprovedOrigin(value) {
  const target = classifyApprovedRawOrigin(value);
  if (target === null) return null;

  try {
    return { target, url: new URL(value) };
  } catch {
    return null;
  }
}

function hasAnonJwtRole(value) {
  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part)) ||
    parts[1].length % 4 === 1 ||
    typeof globalThis.atob !== "function"
  ) {
    return false;
  }

  try {
    const payloadPart = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const paddedPayload = payloadPart.padEnd(
      payloadPart.length + ((4 - (payloadPart.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(globalThis.atob(paddedPayload));
    return (
      payload !== null &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.role === "anon"
    );
  } catch {
    return false;
  }
}

function isApprovedPublicKey(value) {
  return (
    /^sb_publishable_[A-Za-z0-9._-]+$/u.test(value) || hasAnonJwtRole(value)
  );
}

export function resolvePublicSupabaseKey(env) {
  const candidates = [
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ]
    .map(normalizePublicValue)
    .filter((value) => value !== "");

  if (
    candidates.length === 0 ||
    candidates.some((value) => !isApprovedPublicKey(value))
  ) {
    throw policyError("Public Supabase key is not approved.");
  }

  return candidates[0];
}

export function hasPrivilegedEnvironment(env) {
  return PRIVILEGED_ENV_KEYS.some((key) => hasValue(env[key]));
}

export function parseSupabaseTarget(value) {
  const parsed = parseApprovedOrigin(value);
  if (parsed === null) {
    throw policyError("Supabase target is not approved.");
  }
  return parsed.target;
}

export function assertPublicRemoteReadTarget(env) {
  resolvePublicSupabaseKey(env);
  if (hasPrivilegedEnvironment(env)) {
    throw policyError("Public remote access forbids privileged credentials.");
  }
  const target = parseSupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  if (target.kind !== "remote") {
    throw policyError("Public remote read access requires an approved target.");
  }
  return target;
}

export function assertRuntimeSupabaseTarget(env) {
  let target;
  try {
    target = parseSupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw policyError("Runtime Supabase target is not approved.");
  }

  const vercelEnvironment = normalizePublicValue(env.VERCEL_ENV).toLowerCase();
  const usesExpectedHostedProject =
    (vercelEnvironment === "production" &&
      target.kind === "remote" &&
      target.ref === SUPABASE_PROD_PROJECT_REF) ||
    (vercelEnvironment === "preview" &&
      target.kind === "remote" &&
      target.ref === SUPABASE_DEV_PROJECT_REF);
  const usesExpectedDevelopmentTarget =
    (vercelEnvironment === "" || vercelEnvironment === "development") &&
    ((target.kind === "remote" && target.ref === SUPABASE_DEV_PROJECT_REF) ||
      (target.kind === "local" && env.SUPABASE_LOCAL_STACK === "1"));

  if (!usesExpectedHostedProject && !usesExpectedDevelopmentTarget) {
    throw policyError("Runtime Supabase target is not approved.");
  }

  return target;
}

export function assertLiveDevProjectTarget({ projectRef, supabaseUrl }) {
  let target;
  try {
    target = parseSupabaseTarget(supabaseUrl);
  } catch {
    throw policyError("Live development target is not approved.");
  }

  if (
    target.kind !== "remote" ||
    target.ref !== SUPABASE_DEV_PROJECT_REF ||
    projectRef !== SUPABASE_DEV_PROJECT_REF
  ) {
    throw policyError("Live development target is not approved.");
  }

  return target;
}

export function assertPublicDevMutationTarget(env, options) {
  resolvePublicSupabaseKey(env);
  const expectedProjectRef = options?.expectedProjectRef;
  let target;
  try {
    target = parseSupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw policyError("Public development mutation is not approved.");
  }

  if (
    target.kind !== "remote" ||
    target.ref !== SUPABASE_DEV_PROJECT_REF ||
    expectedProjectRef !== SUPABASE_DEV_PROJECT_REF ||
    env.SUPABASE_ENV_LABEL?.trim().toLowerCase() !== "dev" ||
    env.E2E_ALLOW_DEV_DB_MUTATION !== "1" ||
    hasValue(env.VERCEL_ENV) ||
    hasPrivilegedEnvironment(env)
  ) {
    throw policyError("Public development mutation is not approved.");
  }

  return target;
}

export function assertLocalPublicMutationTarget(env) {
  resolvePublicSupabaseKey(env);
  let target;
  try {
    target = parseSupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw policyError("Local public mutation is not approved.");
  }

  if (
    target.kind !== "local" ||
    !PRIVILEGED_LOOPBACK_HOSTS.has(target.hostname) ||
    env.SUPABASE_LOCAL_STACK !== "1" ||
    env.E2E_ALLOW_DEV_DB_MUTATION !== "1"
  ) {
    throw policyError("Local public mutation is not approved.");
  }

  return target;
}

export function assertLocalPrivilegedMutationTarget(env) {
  resolvePublicSupabaseKey(env);
  let target;
  try {
    target = parseSupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw policyError("Local privileged mutation is not approved.");
  }

  if (
    target.kind !== "local" ||
    !PRIVILEGED_LOOPBACK_HOSTS.has(target.hostname) ||
    env.SUPABASE_LOCAL_STACK !== "1" ||
    env.E2E_ALLOW_DEV_DB_MUTATION !== "1" ||
    !hasPrivilegedEnvironment(env)
  ) {
    throw policyError("Local privileged mutation is not approved.");
  }

  return target;
}

export function assertLoopbackRuntimeTarget(
  value = DEFAULT_PLAYWRIGHT_BASE_URL,
) {
  const parsed = parseApprovedOrigin(value);
  if (parsed?.target.kind !== "local") {
    throw policyError("Playwright runtime is not approved.");
  }

  return parsed.url.origin;
}

export function resolveStandardPlaywrightSafety(env) {
  assertLocalPrivilegedMutationTarget(env);
  return {
    baseUrl: assertLoopbackRuntimeTarget(env.E2E_BASE_URL),
    testIgnore: STANDARD_PLAYWRIGHT_TEST_IGNORE,
  };
}

export function resolvePublicPlaywrightSafety(env) {
  assertPublicRemoteReadTarget(env);
  return {
    baseUrl: assertLoopbackRuntimeTarget(env.E2E_BASE_URL),
    testIgnore: STANDARD_PLAYWRIGHT_TEST_IGNORE,
  };
}
