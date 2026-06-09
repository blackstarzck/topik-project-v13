// Batch static-route capture for the 2026-06-09 wireframe page-review (Phase 1, Tier 1).
// Reuses the running dev server (Next 16 single-dev lock). Public routes on
// localhost:3000, authed (workspace) routes on 127.0.0.1:3000 (storageState cookie
// domain). One browser, serial contexts per shot — gentle on the dev server
// (memory: long parallel runs degrade it). READ-ONLY w.r.t. the app & DB.
//
// Per-shot health (status / finalUrl / redirect-to-login / errorOverlay / console
// errors / innerText length) is recorded so a reviewer judges the RENDERED page,
// not just the HTTP code. Writes PNGs + _health.json into .design-review-shots/20260609.
//
// Usage:  node .scratch/review-2026-06-09/capture-matrix.mjs [onlyIA,onlyIA2]
import { chromium } from "playwright";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const OUT = ".design-review-shots/20260609";
const STORAGE = "tests/e2e/auth-state/student.json";
const VIEWPORTS = [360, 768, 1280];
const WAIT = 900;
const PUBLIC = "http://localhost:3000";
const AUTHED = "http://127.0.0.1:3000";

// Known seeded/existing dynamic ids (read-only DB inspection, 2026-06-09).
const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051"; // q51, fb complete → E-01
const SUB_LONG = "a0d17000-0000-4000-8000-000000000053"; // q53, fb complete → E-02

// origin: "public" → localhost (no auth); "authed" → 127.0.0.1 + storageState.
const MATRIX = [
  // --- public ---
  { ia: "X-01", label: "23-X-01-product-landing", route: "/", origin: "public" },
  { ia: "X-13", label: "35-X-13-terms", route: "/terms", origin: "public" },
  { ia: "X-14", label: "36-X-14-privacy", route: "/privacy", origin: "public" },
  { ia: "A-01", label: "01-A-01-sign-up", route: "/sign-up", origin: "public" },
  { ia: "A-02", label: "02-A-02-login", route: "/login", origin: "public" },
  { ia: "A-02", label: "02-A-02-login-session-expired", route: "/login?reason=session_expired", origin: "public", note: "reason variant" },
  { ia: "X-06", label: "28-X-06-password-reset", route: "/password-reset", origin: "public" },
  { ia: "X-16", label: "38-X-16-password-reset-confirm", route: "/password-reset/confirm", origin: "public", note: "no token (default state)" },
  { ia: "X-11", label: "33-X-11-auth-error-otp", route: "/auth/error?reason=otp_expired", origin: "public" },
  { ia: "X-11", label: "33-X-11-auth-error-ratelimit", route: "/auth/error?reason=over_request_rate_limit", origin: "public", note: "rate-limit variant" },
  { ia: "X-12", label: "34-X-12-auth-verify-email", route: "/auth/verify-email", origin: "public" },
  { ia: "X-17", label: "39-X-17-auth-callback-fragment", route: "/auth/callback-fragment", origin: "public", note: "transient fallback, best-effort" },
  // --- authed ---
  { ia: "A-03", label: "03-A-03-learning-goal-setup", route: "/onboarding/learning-goal", origin: "authed" },
  { ia: "B-01", label: "04-B-01-home-dashboard", route: "/dashboard", origin: "authed" },
  { ia: "C-01", label: "05-C-01-problem-type-recommendations", route: "/practice/recommendations", origin: "authed" },
  { ia: "C-02", label: "06-C-02-problem-list", route: "/practice/problems", origin: "authed" },
  { ia: "D-01", label: "08-D-01-short-answer-writing-51", route: "/writing/short-answer-writing-51", origin: "authed" },
  { ia: "D-02", label: "09-D-02-answer-writing-52", route: "/writing/answer-writing-52", origin: "authed" },
  { ia: "D-03", label: "10-D-03-long-form-writing-53", route: "/writing/long-form-writing-53", origin: "authed" },
  { ia: "D-04", label: "11-D-04-essay-writing-54", route: "/writing/essay-writing-54", origin: "authed" },
  { ia: "E-01", label: "14-E-01-short-answer-feedback", route: `/writing/feedback/short/${SUB_SHORT}`, origin: "authed", note: "existing submission ...051" },
  { ia: "E-02", label: "15-E-02-long-form-feedback", route: `/writing/feedback/long/${SUB_LONG}`, origin: "authed", note: "existing submission ...053" },
  { ia: "R-02", label: "17-R-02-next-problem-recommendation", route: "/practice/next", origin: "authed" },
  { ia: "F-01", label: "18-F-01-my-library-empty", route: "/library", origin: "authed", note: "pre-seed (likely empty state)" },
  { ia: "G-01", label: "20-G-01-language-settings", route: "/settings/language", origin: "authed" },
  { ia: "X-02", label: "24-X-02-growth-dashboard", route: "/growth", origin: "authed" },
  { ia: "X-03", label: "25-X-03-paywall", route: "/paywall", origin: "authed" },
  { ia: "X-04", label: "26-X-04-subscription-management", route: "/subscription", origin: "authed" },
  { ia: "X-05", label: "27-X-05-profile-editing", route: "/profile", origin: "authed" },
  { ia: "X-07", label: "29-X-07-weakness-based-recommendations", route: "/practice/weakness", origin: "authed" },
  { ia: "X-09", label: "31-X-09-notification-settings", route: "/settings/notifications", origin: "authed" },
];

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function main() {
  const onlyArg = (process.argv[2] || "").trim();
  const only = onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim())) : null;
  const matrix = only ? MATRIX.filter((m) => only.has(m.ia) || only.has(m.label)) : MATRIX;

  await mkdir(OUT, { recursive: true });
  const hasStorage = await fileExists(STORAGE);
  if (!hasStorage) console.warn(`!! storageState missing at ${STORAGE} — authed routes will 307 to /login`);

  const browser = await chromium.launch({ headless: true });
  const health = [];
  let i = 0;
  try {
    for (const m of matrix) {
      i += 1;
      const origin = m.origin === "authed" ? AUTHED : PUBLIC;
      for (const width of VIEWPORTS) {
        const ctxOpts = { viewport: { width, height: 900 }, reducedMotion: "reduce" };
        if (m.origin === "authed" && hasStorage) ctxOpts.storageState = STORAGE;
        const context = await browser.newContext(ctxOpts);
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 280)); });
        page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e.message).slice(0, 280)));

        let status = 0;
        let finalUrl = "";
        try {
          const resp = await page.goto(origin + m.route, { waitUntil: "networkidle", timeout: 20000 });
          status = resp ? resp.status() : 0;
        } catch (e) {
          consoleErrors.push("goto: " + String(e.message).slice(0, 200));
        }
        await page.waitForTimeout(WAIT);
        finalUrl = page.url();

        const errorOverlay = await page.evaluate(() => {
          if (document.querySelector("[data-nextjs-dialog], #nextjs__container_errors")) return true;
          const t = (document.body && document.body.innerText) || "";
          return /Unhandled Runtime Error|Build Error|Failed to compile|Application error: a (client|server)-side exception/i.test(t);
        }).catch(() => false);
        const bodyTextLen = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.length : 0)).catch(() => 0);
        const redirectedToLogin = /\/login(\?|$)/.test(finalUrl);

        const png = path.join(OUT, `${m.label}-${width}.png`);
        await page.screenshot({ path: png, fullPage: true }).catch((e) => consoleErrors.push("screenshot: " + e.message));

        const rec = {
          ia: m.ia, label: m.label, route: m.route, origin: m.origin, viewport: width,
          status, finalUrl: finalUrl.replace(origin, ""), redirectedToLogin, errorOverlay,
          consoleErrorCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 6),
          bodyTextLen, png, note: m.note || null,
        };
        health.push(rec);
        await context.close();
        const flag = redirectedToLogin ? " [LOGIN-REDIRECT]" : errorOverlay ? " [ERROR-OVERLAY]" : consoleErrors.length ? " [CONSOLE-ERR]" : "";
        console.log(`[${i}/${matrix.length}] ${m.label}-${width}  status=${status} bodyLen=${bodyTextLen} consoleErr=${consoleErrors.length}${flag}`);
      }
    }
  } finally {
    await browser.close();
  }

  const healthPath = path.join(OUT, "_health.json");
  await writeFile(healthPath, JSON.stringify({ capturedAt: process.env.RS_STAMP || null, count: health.length, shots: health }, null, 2), "utf8");
  console.log(`\nhealth → ${healthPath} (${health.length} shots)`);

  // Quick verdict summary per label (worst-case across viewports).
  const byLabel = {};
  for (const h of health) {
    const cur = byLabel[h.label] || { ia: h.ia, route: h.route, origin: h.origin, redirect: false, overlay: false, consoleErr: 0, minBody: Infinity, statuses: [] };
    cur.redirect = cur.redirect || h.redirectedToLogin;
    cur.overlay = cur.overlay || h.errorOverlay;
    cur.consoleErr += h.consoleErrorCount;
    cur.minBody = Math.min(cur.minBody, h.bodyTextLen);
    cur.statuses.push(h.status);
    byLabel[h.label] = cur;
  }
  console.log("\n=== per-screen verdict (heuristic) ===");
  for (const [label, v] of Object.entries(byLabel)) {
    const verdict = v.redirect ? "LOGIN-REDIRECT" : v.overlay ? "ERROR-OVERLAY" : v.consoleErr > 0 ? "CONSOLE-ERR" : v.minBody < 30 ? "THIN/UNVERIFIED" : "OK";
    console.log(`${verdict.padEnd(16)} ${v.ia.padEnd(5)} ${label}  body>=${v.minBody === Infinity ? "?" : v.minBody}`);
  }
}

main().catch((e) => { console.error("capture-matrix failed:", e); process.exit(1); });
