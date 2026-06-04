#!/usr/bin/env node
// Stop-hook guard — "directly run the app to verify" is mechanically enforced.
//
// WHY: the agent repeatedly claimed UI fixes "done/verified" on the strength of
// grep + typecheck + jsdom unit tests, without ever running the real app and
// reading the browser console (the exact "jsdom GREEN = 완료" trap PLAN.md §A0
// warns about). Written rules (CLAUDE.md / PLAN.md / memory) are self-report and
// were ignorable. This hook applies the project's A0 principle to the agent
// itself: a turn that touched user-facing UI cannot END until a FRESH, PASSING
// M1 dev-smoke (scripts/dev-route-smoke.mjs — a real browser against the real
// route) backs it.
//
// Blocks (exit 2) on Stop when UI changed but the smoke artifact is missing,
// stale (older than the last UI edit, or built at a different HEAD than the last
// UI commit), or has any failing route. Allows otherwise. Honors
// `stop_hook_active` (loop guard) and a `.smoke-skip` sentinel (intentional
// defer). On any internal error it ALLOWS (a buggy guard must not brick a
// session).
import { execFileSync } from "node:child_process";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SMOKE = join(ROOT, "docs/ui-redesign/pilot-shots/smoke-result.json");
const BYPASS = join(ROOT, ".smoke-skip");

// User-facing render surface (mirrors ai-workflow-check UI_CHANGE_PATTERNS).
// Admin is frozen → excluded. Test-only files don't count as UI render changes.
const UI_RE =
  /^src\/(app|components|features|styles|theme|lib\/ui)\/.*\.(tsx?|jsx?|css|scss)$/;
const ADMIN_RE = /^src\/components\/admin\/|^src\/app\/\(workspace\)\/admin\//;
const TEST_RE = /\.(test|spec)\.|\/__tests__\//;
const isUI = (p) => UI_RE.test(p) && !ADMIN_RE.test(p) && !TEST_RE.test(p);

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return "";
  }
}
const allow = () => process.exit(0);
function block(reason) {
  process.stderr.write(
    `[ui-smoke-guard] BLOCKED — ${reason}\n` +
      `You changed user-facing UI but no fresh, passing real-app smoke backs it.\n` +
      `Run the REAL app and read the console BEFORE claiming done (PLAN.md §A0/M1):\n` +
      `  node scripts/dev-route-smoke.mjs --routes /dashboard,/ --viewports 1280\n` +
      `(reuses your running dev server; auth via tests/e2e/auth-state/student.json).\n` +
      `Then confirm every perRouteResult[].ok === true and no "[antd] …deprecated"\n` +
      `in consoleErrors. Intentionally deferring? create an empty .smoke-skip file.\n`,
  );
  process.exit(2);
}

try {
  // Loop guard: if we're already continuing because of this hook, don't re-block.
  let payload = {};
  try {
    payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    /* no stdin */
  }
  if (payload.stop_hook_active === true) allow();
  if (existsSync(BYPASS)) allow();

  // (a) uncommitted UI files
  const dirtyUI = git(["status", "--porcelain", "--untracked-files=all"])
    .split(/\r?\n/)
    .map((l) => l.slice(3).trim())
    .filter(Boolean)
    .map((f) => f.split(" -> ").at(-1))
    .filter(isUI);

  // (b) UI files in the last commit
  const headUI = git(["show", "--name-only", "--format=", "HEAD"])
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(isUI);

  if (dirtyUI.length === 0 && headUI.length === 0) allow();

  if (!existsSync(SMOKE)) block("no M1 dev-smoke artifact found");

  let smoke;
  try {
    smoke = JSON.parse(readFileSync(SMOKE, "utf8"));
  } catch {
    block("smoke artifact unreadable/corrupt");
  }
  const smokeMtime = statSync(SMOKE).mtimeMs;

  const routes = Array.isArray(smoke.perRouteResult) ? smoke.perRouteResult : [];
  if (smoke.booted !== true || routes.length === 0)
    block("smoke did not run any route");
  const failing = routes.filter((r) => !r || r.ok !== true);
  if (failing.length)
    block(`smoke has failing route(s): ${failing.map((r) => r && r.route).join(", ")}`);

  // (a) freshness vs uncommitted edits
  for (const f of dirtyUI) {
    const p = join(ROOT, f);
    if (existsSync(p) && statSync(p).mtimeMs > smokeMtime) {
      block(`${f} was edited AFTER the last smoke — re-run M1`);
    }
  }

  // (b) freshness vs HEAD commit
  if (headUI.length) {
    const head = git(["rev-parse", "--short", "HEAD"]).trim();
    if (head && smoke.headSha && smoke.headSha !== head) {
      block(
        `last commit touched UI (${headUI.join(", ")}) but smoke is at ${smoke.headSha}, HEAD is ${head} — re-run M1`,
      );
    }
  }

  allow();
} catch {
  // A guard must never brick the session; fail open on internal error.
  allow();
}
