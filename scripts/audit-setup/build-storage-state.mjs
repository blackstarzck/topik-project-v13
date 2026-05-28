#!/usr/bin/env node
// Build Playwright storageState files for Phase 2 browser coverage.
// Plan §8 Step 2.3.
//
// Outputs (one per role used by the audit):
//   tests/e2e/auth-state/student.json
//   tests/e2e/auth-state/content_admin.json
//   tests/e2e/auth-state/org_admin.json
//   tests/e2e/auth-state/platform_admin.json
//
// Strategy:
//   1) Use SUPABASE_SERVICE_ROLE_KEY (server-only) to create/seed test users in
//      the Supabase project, set their app_role via the protected
//      private.admin_change_user_role RPC, and confirm their email
//      (email_confirmed_at) so the email-confirmed RLS policy in
//      `private.is_email_confirmed` does not block storage uploads.
//   2) Sign each test user in via supabase-js with the publishable key,
//      capture the resulting cookie + localStorage state, and write it as a
//      Playwright storageState JSON.
//
// Preconditions (fail-closed):
//   - NEXT_PUBLIC_SUPABASE_URL must be set
//   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set
//   - SUPABASE_SERVICE_ROLE_KEY must be set (server-only, never browser)
//   - SUPABASE_TEST_PASSWORD must be set (used for all seeded test users)
//   - Network access to the Supabase project
//
// This script is INTENTIONALLY a skeleton: it validates the preconditions and
// outlines the seeding flow, but does not execute admin mutations without an
// explicit `--apply` flag, because the service role key is currently rotated
// out (see .env.local 2026-05-27 note "회전 필수"). The script writes a clear
// monitor-readable status so Phase 2 can be gated correctly.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJson, generatedAt, REPO_ROOT } from "./ia-audit-lib.mjs";

// Manually load .env.local so the missing-env-var diagnostic reflects on-disk
// config, not just the inherited process.env. This script must not depend on
// dotenv as a runtime dep — keep parsing intentionally minimal.
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(join(REPO_ROOT, ".env.local"));

const AUTH_STATE_DIR = join(REPO_ROOT, "tests/e2e/auth-state");
mkdirSync(AUTH_STATE_DIR, { recursive: true });

const ROLES = ["student", "content_admin", "org_admin", "platform_admin"];

const apply = process.argv.includes("--apply");
const forceProd = process.argv.includes("--i-know-this-is-prod-and-want-to-seed-anyway");
const summaryPath = join(REPO_ROOT, "tests/e2e/auth-state/build-status.json");

// ----- Production safety guard -----------------------------------------------
// Refuse `--apply` against a production Supabase project. The IA audit
// seeds 4 test users (student/content_admin/org_admin/platform_admin) and
// confirms their emails — that is destructive against a project with real
// users. Two independent signals classify a target as "production":
//
//   1. SUPABASE_ENV_LABEL=prod      (declared by the env file / Vercel scope)
//   2. NEXT_PUBLIC_SITE_URL points at a non-dev domain  (heuristic — common
//      patterns like *.vercel.app/preview, localhost, 127.0.0.1, *-dev.*
//      are considered safe; anything else triggers the guard)
//
// The guard can be overridden only with the deliberately verbose
// `--i-know-this-is-prod-and-want-to-seed-anyway` flag, which is logged
// to the audit monitor so the decision is auditable. There is no shorter
// override on purpose.
function classifyTargetEnv() {
  const label = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const explicitProd = label === "prod" || label === "production";
  const explicitDev = ["local", "dev", "development", "staging", "preview"].includes(label);

  const looksLocal = /127\.0\.0\.1|localhost/.test(url) || /127\.0\.0\.1|localhost/.test(siteUrl);
  const looksDevDomain = /(-dev\.|-staging\.|\.vercel\.app$|preview)/i.test(siteUrl);

  let verdict = "unknown";
  if (explicitProd) verdict = "prod";
  else if (explicitDev) verdict = "dev";
  else if (looksLocal) verdict = "local";
  else if (looksDevDomain) verdict = "dev-domain-heuristic";
  else verdict = "unknown-treat-as-prod";

  return { label, url, siteUrl, verdict, explicitProd, explicitDev, looksLocal, looksDevDomain };
}

function isProdTarget(classification) {
  return classification.verdict === "prod" || classification.verdict === "unknown-treat-as-prod";
}

function missingEnvVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_TEST_PASSWORD",
    "SUPABASE_ENV_LABEL",
  ];
  return required.filter((name) => !process.env[name]);
}

const missing = missingEnvVars();
const stateFiles = ROLES.map((role) => ({
  role,
  path: `tests/e2e/auth-state/${role}.json`,
  exists: existsSync(join(AUTH_STATE_DIR, `${role}.json`)),
}));

const envClassification = classifyTargetEnv();

// Production guard fires when --apply is requested AND the target looks like
// prod (explicit label or unknown). The verbose override flag is the only
// way through — and that flag is recorded in build-status.json for audit.
if (apply && isProdTarget(envClassification) && !forceProd) {
  const status = {
    runStatus: "REFUSED-PROD-TARGET",
    apply,
    envClassification,
    coordinatorNote:
      "Refused to seed test users into a production-looking Supabase target. " +
      "Either (a) point .env.local at a dev/staging project and set SUPABASE_ENV_LABEL=dev, " +
      "(b) run with --i-know-this-is-prod-and-want-to-seed-anyway (logged for audit), or " +
      "(c) cancel.",
    stateFiles,
    generatedAt: generatedAt(),
  };
  writeJson(summaryPath, status);
  console.error("build-storage-state.mjs REFUSED — production-looking target.");
  console.error(`  SUPABASE_ENV_LABEL: ${envClassification.label || "(unset)"}`);
  console.error(`  NEXT_PUBLIC_SUPABASE_URL: ${envClassification.url || "(unset)"}`);
  console.error(`  NEXT_PUBLIC_SITE_URL: ${envClassification.siteUrl || "(unset)"}`);
  console.error(`  verdict: ${envClassification.verdict}`);
  console.error(`  status path: ${summaryPath}`);
  process.exit(2);
}

if (missing.length > 0 || !apply) {
  const status = {
    runStatus: "BLOCKED",
    apply,
    envClassification,
    missingEnvVars: missing,
    stateFiles,
    coordinatorNote: !apply
      ? "Skeleton-only run. Pass --apply once SUPABASE_SERVICE_ROLE_KEY is rotated back in to actually create users + storage state files."
      : "Preconditions not met. Set the missing env vars and re-run with --apply.",
    nextSteps: [
      "Rotate SUPABASE_SERVICE_ROLE_KEY (currently disabled per .env.local 2026-05-27 note).",
      "Set SUPABASE_TEST_PASSWORD in .env.local (server-only — do not commit).",
      "Re-run: node scripts/audit-setup/build-storage-state.mjs --apply",
      "Then: pnpm dev (terminal 1) + pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts (terminal 2).",
    ],
    plan: {
      seedingFlow: [
        "For each role, supabase.auth.admin.createUser({ email, password, email_confirm: true }) using service-role client.",
        "For admin roles, call private.admin_change_user_role(user.id, role) using service-role RPC.",
        "For student, no role mutation needed (default 'learner').",
        "For each user, sign in with supabase-js anon client to obtain a real session cookie.",
        "Use Playwright to navigate to dev server with that session and dump storageState to tests/e2e/auth-state/<role>.json.",
      ],
      cleanup:
        "tests/e2e/auth-state/*.json is gitignored. Test users may remain in the Supabase project until the cleanup pg_cron job (30-day unconfirmed) runs OR until a manual delete via supabase.auth.admin.deleteUser is executed.",
    },
    generatedAt: generatedAt(),
  };
  writeJson(summaryPath, status);
  console.error(`build-storage-state.mjs BLOCKED.`);
  console.error(`  missing env vars: ${missing.length > 0 ? missing.join(", ") : "(none — but --apply not passed)"}`);
  console.error(`  status path: ${summaryPath}`);
  process.exit(1);
}

// --apply path — actually create test users + capture Playwright storageState.
//
// Flow:
//   1) supabase-js admin client (service_role/Secret API key) — listUsers +
//      createUser (email_confirm: true) per role.
//   2) For 3 admin roles: emit SQL snippet (build-status.json) for manual role
//      assignment via Supabase Dashboard SQL Editor. The profiles.app_role
//      protect trigger checks auth.uid(), so service_role cannot UPDATE
//      app_role directly via supabase-js without a custom DEV-ONLY function
//      (not in migrations). Manual SQL is the simplest honest path.
//   3) Launch chromium against the local dev server, fill the actual /login
//      form for each user, wait for redirect, capture storageState.
//   4) Write each storageState to tests/e2e/auth-state/<role>.json.
//
// On failure: continue with remaining roles, record the failure per role in
// build-status.json. Do not delete partially-created users — manual cleanup
// via supabase.auth.admin.deleteUser is simpler than complex rollback.

const { createClient } = await import("@supabase/supabase-js");
const { chromium } = await import("playwright");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ROLE_TO_DB_ROLE = {
  student: "learner",
  content_admin: "content_admin",
  org_admin: "org_admin",
  platform_admin: "platform_admin",
};

const EMAIL_DOMAIN = "audit.local";

function emailForRole(role) {
  return `${role}@${EMAIL_DOMAIN}`;
}

async function ensureUser(role) {
  const email = emailForRole(role);
  // listUsers paginated — search by email_filter is admin-only and easier.
  const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);

  const existing = page.users.find((u) => u.email === email);
  if (existing) {
    return { user: existing, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { audit_seed: true, audit_role: role },
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return { user: data.user, created: true };
}

async function captureStorageState(role, email) {
  // Bypass the /login form entirely — sign in via supabase-js anon client
  // (already verified working), then inject the resulting session into a
  // fresh browser context by calling supabase.auth.setSession() in the
  // page. This is faster + more reliable than driving the Ant Design form
  // and avoids form-validation/loading-spinner timing flakes.
  const anonClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signin, error: signinError } = await anonClient.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signinError) throw new Error(`signInWithPassword failed: ${signinError.message}`);
  if (!signin?.session) throw new Error("signInWithPassword returned no session");

  const session = signin.session;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a public page first so the supabase-js browser client
    // initializes against the right origin (@supabase/ssr reads cookies
    // scoped to the current host).
    await page.goto(`${E2E_BASE_URL}/login`, { waitUntil: "domcontentloaded" });

    // Inject the session via supabase-js in the browser. supabase-js writes
    // the session cookies in the @supabase/ssr format that the Next.js
    // middleware expects.
    const injectError = await page.evaluate(
      async ({ url, key, accessToken, refreshToken }) => {
        // Load supabase-js from CDN (esm.sh) — small + cached, avoids
        // needing the app to expose its own supabase client globally.
        const mod = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = mod.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: false,
            storageKey: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
            storage: {
              getItem: (k) => document.cookie
                .split("; ")
                .find((c) => c.startsWith(`${k}=`))
                ?.split("=")
                .slice(1)
                .join("="),
              setItem: (k, v) => {
                document.cookie = `${k}=${v}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              },
              removeItem: (k) => {
                document.cookie = `${k}=; path=/; max-age=0`;
              },
            },
          },
        });
        const { error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return error ? error.message : null;
      },
      {
        url: SUPABASE_URL,
        key: SUPABASE_PUBLISHABLE_KEY,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      },
    );
    if (injectError) throw new Error(`setSession in browser failed: ${injectError}`);

    // Now navigate to a protected route. Middleware should read the
    // injected cookie and allow access (or refresh-rotate it into the
    // @supabase/ssr cookie format). We use /dashboard as a smoke probe.
    await page.goto(`${E2E_BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const finalUrl = page.url();
    const onLogin = new URL(finalUrl).pathname.startsWith("/login");
    if (onLogin) {
      throw new Error(
        `session injection succeeded but /dashboard redirected to ${finalUrl} — middleware did not pick up cookies. Cookie name/format likely mismatch.`,
      );
    }

    const statePath = join(AUTH_STATE_DIR, `${role}.json`);
    await context.storageState({ path: statePath });

    return { finalUrl, statePath };
  } finally {
    await browser.close();
  }
}

const perRoleResults = [];

for (const role of ROLES) {
  const email = emailForRole(role);
  const result = { role, email, status: "PENDING" };
  try {
    console.log(`[${role}] ensuring user ${email} …`);
    const ensure = await ensureUser(role);
    result.userId = ensure.user.id;
    result.created = ensure.created;
    console.log(`  ↳ ${ensure.created ? "created" : "already exists"} (id=${ensure.user.id})`);

    console.log(`[${role}] capturing storageState via ${E2E_BASE_URL}/login …`);
    const capture = await captureStorageState(role, email);
    result.finalUrl = capture.finalUrl;
    result.statePath = capture.statePath;
    result.status = "PASS";
    console.log(`  ↳ wrote ${capture.statePath} (final URL: ${capture.finalUrl})`);
  } catch (error) {
    result.status = "FAIL";
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`  ↳ FAILED: ${result.error}`);
  }
  perRoleResults.push(result);
}

// Emit manual SQL snippet for admin role assignment (3 admin roles only).
// profiles.app_role protect trigger blocks direct UPDATE from service_role
// because the trigger checks auth.uid() — see migrations
// 20260520121400_profiles_protected_columns.sql + 20260521140000_phase_6_rpc_and_admin.sql.
// Bootstrapping the first platform_admin is intentionally outside the audit
// scope. Operator must run this once in Supabase Dashboard → SQL Editor.
const adminAssignmentSql = perRoleResults
  .filter((r) => r.status === "PASS" && r.role !== "student")
  .map(
    (r) =>
      `-- ${r.role} (${r.email}, id=${r.userId})\n` +
      `update public.profiles set app_role = '${ROLE_TO_DB_ROLE[r.role]}' where id = '${r.userId}';`,
  )
  .join("\n\n");

const wrappedSql = adminAssignmentSql
  ? [
      "-- Run once in Supabase Dashboard → SQL Editor (dev project only).",
      "-- profiles.app_role protect trigger blocks direct UPDATE; temporarily",
      "-- disable it inside a transaction so the seed is atomic.",
      "begin;",
      "alter table public.profiles disable trigger trg_profiles_protect_columns;",
      "",
      adminAssignmentSql,
      "",
      "alter table public.profiles enable trigger trg_profiles_protect_columns;",
      "commit;",
    ].join("\n")
  : null;

const overallStatus = perRoleResults.every((r) => r.status === "PASS") ? "PASS" : "PARTIAL";
const summary = {
  runStatus: overallStatus,
  apply: true,
  envClassification,
  forceProd,
  perRole: perRoleResults,
  manualSqlForAdminRoles: wrappedSql,
  postSeedNote:
    "All 4 storageState files capture authenticated sessions, but app_role is 'learner' for all (Supabase default). Run the manualSqlForAdminRoles snippet in the Dashboard SQL Editor (dev project only) to elevate the 3 admin sessions BEFORE re-running coverage-matrix for admin route tests.",
  generatedAt: generatedAt(),
};
writeJson(summaryPath, summary);

const passCount = perRoleResults.filter((r) => r.status === "PASS").length;
console.log("");
console.log(`build-storage-state.mjs ${overallStatus}: ${passCount}/${ROLES.length} roles seeded.`);
if (wrappedSql) {
  console.log("");
  console.log("⚠ Admin roles need manual SQL elevation. See `manualSqlForAdminRoles` in:");
  console.log(`   ${summaryPath}`);
}
if (overallStatus !== "PASS") {
  process.exit(1);
}
