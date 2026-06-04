// Real-app dev-server smoke for antd deprecation fixes.
// Reuses cookie storageState (student) for authed routes. Detects console errors,
// pageerrors, Next dev error-overlay in DOM (HTTP 200 even on error), and auth redirects.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const SHOTS = "errors/antd-smoke-shots";
await mkdir(SHOTS, { recursive: true });

const PUBLIC = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "reset", path: "/reset-password" },
];
// authed routes that contain changed components
const AUTHED = [
  { name: "dashboard", path: "/dashboard" },
  { name: "library", path: "/library" }, // PdfExportModal lives here (Space.Compact)
  { name: "profile", path: "/profile" }, // ExamInfoCard Empty styles.image
  { name: "growth", path: "/growth" }, // GrowthDashboard Statistic styles.content
  { name: "rec", path: "/practice/recommendations" }, // Spin tip->description
  { name: "weakness", path: "/practice/weakness" }, // 11 Space edits
  { name: "notif", path: "/settings/notifications" },
  { name: "lang", path: "/settings/language" },
  { name: "subscription", path: "/subscription" },
  { name: "paywall", path: "/paywall" },
];

const NOISE = [
  /Download the React DevTools/i,
  /getComputedStyle/i,
  /\[Fast Refresh\]/i,
];

function isNoise(t) {
  return NOISE.some((re) => re.test(t));
}

async function probe(context, target) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
  let finalUrl = "";
  let overlay = false;
  try {
    const resp = await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle", timeout: 30000 });
    finalUrl = page.url();
    // Next.js dev error overlay detection
    overlay = await page.evaluate(() => {
      const sel = document.querySelector(
        "nextjs-portal, [data-nextjs-dialog], #nextjs__container_errors, [data-nextjs-dialog-overlay], [data-nextjs-error-overlay]"
      );
      const txt = document.body?.innerText || "";
      const hasErrText = /Unhandled Runtime Error|Build Error|Failed to compile|Element type is invalid/i.test(txt);
      return Boolean(sel) || hasErrText;
    });
    await page.screenshot({ path: `${SHOTS}/${target.name}.png`, fullPage: false });
    return { name: target.name, path: target.path, status: resp?.status() ?? 0, finalUrl, overlay, errors };
  } catch (e) {
    return { name: target.name, path: target.path, status: -1, finalUrl, overlay, errors: [...errors, "GOTO_FAIL: " + e.message.slice(0, 160)] };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch();
const results = [];

// public (no auth)
const pub = await browser.newContext();
for (const t of PUBLIC) results.push({ auth: false, ...(await probe(pub, t)) });
await pub.close();

// authed (cookie storage state)
let authedCtx;
try {
  authedCtx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json" });
} catch (e) {
  console.log("AUTH STATE LOAD FAILED:", e.message);
}
if (authedCtx) {
  for (const t of AUTHED) results.push({ auth: true, ...(await probe(authedCtx, t)) });
  await authedCtx.close();
}
await browser.close();

console.log("\n=== SMOKE RESULTS ===");
let clean = 0, dirty = 0, redirected = 0;
for (const r of results) {
  const redir = r.auth && /\/login/.test(r.finalUrl);
  if (redir) redirected++;
  const bad = r.overlay || r.errors.length > 0 || r.status >= 400 || r.status < 0;
  if (bad && !redir) dirty++;
  else if (!redir) clean++;
  const flag = redir ? "↪AUTH-REDIRECT" : bad ? "✗" : "✓";
  console.log(`${flag} [${r.status}] ${r.path}${redir ? " -> " + r.finalUrl.replace(BASE, "") : ""}${r.overlay ? " OVERLAY!" : ""}`);
  for (const e of r.errors) console.log("      • " + e);
}
console.log(`\nclean=${clean} dirty=${dirty} auth-redirected=${redirected} total=${results.length}`);
