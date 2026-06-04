// M1 — dev-mode route smoke. (PLAN.md §강제성 게이트 표 M1; A0-(1).)
//
// Boots `next dev`, visits the C1-derived (or explicit) routes in a real browser
// at the configured viewports, and records console errors, runtime/page errors
// (the Next error overlay), final URL (redirect detection) and a screenshot per
// route. Writes an artifact JSON that M3 consumes to enforce coverage and
// auto-generate the verification report. This is where the #5 `loading.tsx` RSC
// crash is re-verified against the *real* /dashboard route in dev.
//
// The verdict logic is the pure, unit-tested `classifyRouteResult`; everything
// else (dev boot, Playwright, teardown) is impure and proven by an actual run.
//
// Usage:
//   node scripts/dev-route-smoke.mjs --base <sha> [--port 3100]
//        [--routes /,/login,/dashboard] [--viewports 360,768,1280]
//        [--auth tests/e2e/auth-state/student.json] [--out <file>]

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// ---- pure ------------------------------------------------------------------

// Render-crash signatures escalated to FATAL. The antd-compound × server-
// component bug (#5) shows as "Element type is invalid" in dev and as a Minified
// React error (#130/#418/#423) on some paths (memory:
// project-antd-compound-server-component-react130). (cross-audit P2.)
const FATAL_SIGNATURES = [
  /element type is invalid/i,
  /minified react error #(130|418|423|425)/i,
  /expected a string .*got:?\s*undefined/i,
];

function isFatalMessage(message) {
  return FATAL_SIGNATURES.some((p) => p.test(message));
}

// Dev-infrastructure console noise that is NOT an app defect. The smoke gate
// must ignore these or every dev run fails on plumbing. Scoped narrowly so real
// app errors are never hidden.
const DEV_NOISE = [
  /_next\/(webpack|turbopack)-hmr/i, // HMR websocket (dev only)
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

// If a line carries a real error keyword it is NOT noise, even when it also
// matches a DEV_NOISE pattern (e.g. a "[Fast Refresh] ... TypeError" line).
// (cross-audit P2: the Fast Refresh filter was too broad.)
const ERROR_KEYWORDS =
  /(TypeError|ReferenceError|SyntaxError|is not a function|is not defined|cannot read|undefined is not|Minified React error)/i;

function isDevNoise(message) {
  if (ERROR_KEYWORDS.test(message)) return false;
  return DEV_NOISE.some((p) => p.test(message));
}

/**
 * @param {{ requestedPath: string, finalPath?: string, status?: number,
 *           consoleErrors?: string[], pageErrors?: string[], overlayText?: string }} obs
 * @returns {{ ok: boolean, fatal: boolean, redirected: boolean, reasons: string[] }}
 */
export function classifyRouteResult({
  requestedPath,
  finalPath,
  status,
  consoleErrors = [],
  pageErrors = [],
  overlayText = "",
}) {
  const reasons = [];
  let fatal = false;
  const redirected = Boolean(finalPath && finalPath !== requestedPath);
  if (redirected && String(finalPath).startsWith("/login")) {
    reasons.push(`redirected to ${finalPath} (no session?)`);
  } else if (redirected) {
    reasons.push(`redirected ${requestedPath} → ${finalPath}`);
  }
  if (typeof status === "number" && status >= 400) reasons.push(`http ${status}`);
  // A Next dev error overlay (or error.tsx boundary fallback) is a render
  // failure even when it flushes as HTTP 200 with no console/page error.
  if (overlayText) {
    reasons.push(`overlay: ${overlayText}`);
    fatal = true;
  }
  for (const pe of pageErrors) {
    reasons.push(`runtime: ${pe}`);
    if (isFatalMessage(pe)) fatal = true;
  }
  for (const ce of consoleErrors) {
    if (isDevNoise(ce)) continue; // dev plumbing, not an app defect
    reasons.push(`console: ${ce}`);
    if (isFatalMessage(ce)) fatal = true;
  }
  return { ok: reasons.length === 0, fatal, redirected, reasons };
}

// ---- impure ----------------------------------------------------------------

function parseArg(argv, flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

function pathFromUrl(urlStr, baseURL) {
  try {
    const u = new URL(urlStr, baseURL);
    return u.pathname + (u.search || "");
  } catch {
    return urlStr;
  }
}

async function waitForServer(baseURL, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseURL, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function startDevServer(root, port) {
  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  return child;
}

function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

async function visitRoute({ chromium, baseURL, route, viewport, storageStatePath, shotDir }) {
  const contextOpts = { viewport: { width: viewport, height: 900 } };
  if (storageStatePath && existsSync(storageStatePath)) {
    contextOpts.storageState = storageStatePath;
  }
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err)));

  let status = null;
  let finalPath = route;
  let overlayText = "";
  try {
    const res = await page.goto(baseURL + route, {
      waitUntil: "load",
      timeout: 45_000,
    });
    status = res ? res.status() : null;
    await page.waitForTimeout(1200); // settle client render / hydration errors
    finalPath = pathFromUrl(page.url(), baseURL);
    // A Next dev error overlay (or error.tsx fallback) renders the page as HTTP
    // 200 with the error in the DOM, not in console/pageerror — probe for it.
    try {
      const portalCount = await page.locator("nextjs-portal").count();
      const bodyText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      const m = bodyText.match(
        /(Unhandled Runtime Error|Build Error|Application error:[^\n]*|Element type is invalid[^\n]*)/i,
      );
      if (portalCount > 0 || m) {
        overlayText = (
          m ? m[0] : "Next.js error overlay (nextjs-portal) present"
        ).slice(0, 300);
      }
    } catch {
      /* overlay probe is best-effort */
    }
  } catch (e) {
    pageErrors.push(`navigation: ${String(e?.message ?? e)}`);
  }

  const safe = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  const shot = join(shotDir, `${safe}-${viewport}.png`);
  try {
    await page.screenshot({ path: shot, fullPage: true });
  } catch {
    // screenshot best-effort
  }

  await context.close();
  await browser.close();

  const verdict = classifyRouteResult({
    requestedPath: route,
    finalPath,
    status,
    consoleErrors,
    pageErrors,
    overlayText,
  });
  return {
    route,
    viewport,
    status,
    finalPath,
    overlayText,
    consoleErrors,
    pageErrors,
    screenshot: shot,
    ...verdict,
  };
}

async function deriveRoutes(baseRef, root) {
  const mod = await import("./derive-smoke-routes.mjs");
  const changedFiles = mod.getChangedFiles(baseRef, root);
  const pageRoutes = mod.listPageRoutes(root);
  const reverseRefs = mod.buildReverseRefs(root);
  return {
    changedFiles,
    ...mod.deriveRequiredRoutes({ changedFiles, pageRoutes, reverseRefs }),
  };
}

function gitSha(root, ref) {
  try {
    return execFileSync("git", ["rev-parse", "--short", ref], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const port = Number(parseArg(argv, "--port", "3000"));
  const baseURL = `http://127.0.0.1:${port}`;
  const baseRef = parseArg(argv, "--base", null);
  const explicitRoutes = parseArg(argv, "--routes", null);
  const viewports = (parseArg(argv, "--viewports", "1280") ?? "1280")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  const defaultAuth = join(root, "tests", "e2e", "auth-state", "student.json");
  const storageStatePath = parseArg(
    argv,
    "--auth",
    existsSync(defaultAuth) ? defaultAuth : null,
  );
  const shotDir = parseArg(argv, "--shots", join(root, "docs", "ui-redesign", "pilot-shots"));
  const outFile = parseArg(
    argv,
    "--out",
    join(root, "docs", "ui-redesign", "pilot-shots", "smoke-result.json"),
  );

  if (viewports.length === 0) {
    console.error("[M1 dev-smoke] FAIL: no valid viewports given.");
    process.exit(2);
  }

  // Resolve routes.
  let requiredRoutes;
  let excludedRoutes = [];
  let changedFiles = [];
  let overApproximated = false;
  if (explicitRoutes) {
    requiredRoutes = explicitRoutes.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (baseRef) {
    const d = await deriveRoutes(baseRef, root);
    requiredRoutes = d.requiredRoutes;
    excludedRoutes = d.excludedRoutes;
    changedFiles = d.changedFiles;
    overApproximated = d.overApproximated;
  } else {
    requiredRoutes = ["/", "/login", "/dashboard"]; // PLAN Phase 2 pilot fallback
  }

  // Cross-audit P2: 0 routes must NOT silently exit 0. If the diff derived
  // nothing and no --routes was given, nothing is verified — fail inconclusive.
  if (!requiredRoutes.length) {
    console.error(
      "[M1 dev-smoke] FAIL (inconclusive): 0 routes to smoke — diff derived no routes and no --routes given.",
    );
    process.exit(2);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    console.error(`[M1 dev-smoke] FAIL: playwright not available: ${e?.message ?? e}`);
    process.exit(3);
  }

  mkdirSync(shotDir, { recursive: true });
  mkdirSync(dirname(outFile), { recursive: true });

  // Next 16 Turbopack enforces a single dev instance. If a dev server is
  // already listening (the developer's running session), reuse it instead of
  // booting (and do NOT tear it down — we didn't start it).
  let perRouteResult = [];
  let booted = false;
  let dev = null;
  const alreadyUp = await waitForServer(baseURL, 2500);
  if (alreadyUp) {
    console.log(`[M1 dev-smoke] reusing existing dev server at ${baseURL}`);
    booted = true;
  } else {
    console.log(`[M1 dev-smoke] booting next dev on ${baseURL} ...`);
    dev = startDevServer(root, port);
    booted = await waitForServer(baseURL, 120_000);
  }
  try {
    if (!booted) throw new Error("dev server did not become ready within 120s");
    console.log(`[M1 dev-smoke] dev ready. routes: ${requiredRoutes.join(", ")}`);
    for (const route of requiredRoutes) {
      for (const viewport of viewports) {
        const r = await visitRoute({
          chromium,
          baseURL,
          route,
          viewport,
          storageStatePath,
          shotDir,
        });
        const mark = r.fatal ? "FATAL" : r.ok ? "ok" : "fail";
        console.log(
          `[M1 dev-smoke] ${mark} ${route} @${viewport} status=${r.status} final=${r.finalPath}` +
            (r.reasons.length ? ` :: ${r.reasons.join(" | ")}` : ""),
        );
        perRouteResult.push(r);
      }
    }
  } catch (e) {
    console.error(`[M1 dev-smoke] error: ${e?.message ?? e}`);
  } finally {
    if (dev) killTree(dev); // only tear down a server we started
  }

  // testedRoutes = routes whose every viewport visit produced no FATAL and was
  // not a redirect (i.e. actually rendered). ok at all viewports => tested.
  const byRoute = new Map();
  for (const r of perRouteResult) {
    const cur = byRoute.get(r.route) ?? { ok: true, fatal: false, redirected: false };
    cur.ok = cur.ok && r.ok;
    cur.fatal = cur.fatal || r.fatal;
    cur.redirected = cur.redirected || r.redirected;
    byRoute.set(r.route, cur);
  }
  const testedRoutes = [...byRoute.entries()]
    .filter(([, v]) => v.ok)
    .map(([k]) => k)
    .sort();

  const artifact = {
    baseSha: baseRef ? gitSha(root, baseRef) : null,
    headSha: gitSha(root, "HEAD"),
    booted,
    reused: alreadyUp,
    changedFiles,
    requiredRoutes,
    excludedRoutes,
    overApproximated,
    testedRoutes,
    viewports,
    storageStatePath: storageStatePath ?? null,
    perRouteResult,
  };
  writeFileSync(outFile, JSON.stringify(artifact, null, 2) + "\n");
  console.log(`[M1 dev-smoke] artifact → ${outFile}`);

  const fatal = perRouteResult.some((r) => r.fatal);
  const missing = requiredRoutes.filter((r) => !testedRoutes.includes(r));
  if (!booted) process.exit(2);
  if (fatal) process.exit(1);
  // Coverage gap is reported here but ENFORCED by M3 (so the artifact is the
  // single source of truth). The smoke itself exits 0 if it booted and hit no
  // fatal runtime error; M3 decides completion on testedRoutes ⊊ requiredRoutes.
  if (missing.length) {
    console.warn(`[M1 dev-smoke] note: ${missing.length} required route(s) not verified (see M3): ${missing.join(", ")}`);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[M1 dev-smoke] FATAL: ${e?.message ?? e}`);
    process.exit(2);
  });
}
