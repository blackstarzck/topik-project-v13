// Direct-browser verification of the container-width unification.
// Logs in the student account (long timeouts, robust to slow dev compiles),
// visits each changed page at desktop + mobile, measures the WorkspaceBody
// container width vs. the inner form column width, checks horizontal overflow,
// and writes screenshots into .scratch/shots/.
//
// Runs against an EXISTING dev server (Next 16 blocks a second dev server per
// project dir). BASE defaults to 3001. Isolated browser context, read-only.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";
const OUT = ".scratch/shots";
mkdirSync(OUT, { recursive: true });

if (!PASSWORD) {
  console.error("SUPABASE_TEST_PASSWORD missing in .env.local");
  process.exit(2);
}

const PAGES = [
  { slug: "dashboard", route: "/dashboard" },
  { slug: "profile", route: "/profile" },
  { slug: "settings-account", route: "/settings/account" },
  { slug: "settings-language", route: "/settings/language" },
  { slug: "settings-learning", route: "/settings/learning" },
  { slug: "settings-notifications", route: "/settings/notifications" },
];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const f = (n) => (n === null || n === undefined ? "—" : Math.round(n));
const rows = [];

const browser = await chromium.launch();
const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const lp = await ctx0.newPage();
lp.setDefaultNavigationTimeout(120_000);
lp.setDefaultTimeout(60_000);

// --- login ---
console.log("logging in…");
await lp.goto(BASE + "/login", { waitUntil: "load" });
await lp.locator('input[autocomplete="email"]').fill(EMAIL);
await lp.locator('input[autocomplete="current-password"]').fill(PASSWORD);
await lp.locator('button[type="submit"]').click();
await lp.waitForURL(/\/(dashboard|auth\/consent)/, { timeout: 120_000 });
if (new URL(lp.url()).pathname === "/auth/consent") {
  await lp.locator('input[name="accept"]').check({ force: true });
  await lp.locator('form button[type="submit"]').click();
  await lp.waitForURL(/\/dashboard/, { timeout: 120_000 });
}
console.log("logged in, url=", lp.url());
const storage = await ctx0.storageState();
writeFileSync(".scratch/student-state.json", JSON.stringify(storage));
await ctx0.close();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    storageState: storage,
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(45_000);

  for (const p of PAGES) {
    const r = { page: p.slug, vp: vp.name };
    try {
      const resp = await page.goto(BASE + p.route, { waitUntil: "networkidle" });
      r.status = resp?.status();
      r.url = new URL(page.url()).pathname;
      await page.waitForSelector('[data-testid="workspace-page-body"]', { timeout: 45_000 });
      // settle layout
      await page.waitForTimeout(400);
      Object.assign(r, await page.evaluate(() => {
        const body = document.querySelector('[data-testid="workspace-page-body"]');
        const content = document.querySelector(".app-workspace-content");
        const root = document.documentElement;
        const b = body?.getBoundingClientRect();
        const c = content?.getBoundingClientRect();
        const h1 = body?.querySelector("h1")?.getBoundingClientRect() ?? null;
        // first meaningful form control / card for readability check
        const ctrl = body?.querySelector("input, textarea, .ant-select, .ant-card, .ant-input-affix-wrapper");
        const cr = ctrl?.getBoundingClientRect() ?? null;
        return {
          size: body?.getAttribute("data-workspace-body-size") ?? null,
          bodyLeft: b?.left ?? null, bodyWidth: b?.width ?? null,
          contentLeft: c?.left ?? null, contentWidth: c?.width ?? null,
          h1Left: h1?.left ?? null, ctrlWidth: cr?.width ?? null, ctrlLeft: cr?.left ?? null,
          overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
        };
      }));
      await page.screenshot({ path: `${OUT}/${p.slug}-${vp.name}.png`, fullPage: false });
    } catch (err) {
      r.error = String(err).split("\n")[0];
    }
    rows.push(r);
    console.log(`[${r.vp}] ${r.page.padEnd(22)} size=${String(r.size).padEnd(9)} body(w=${f(r.bodyWidth)},l=${f(r.bodyLeft)}) content(w=${f(r.contentWidth)},l=${f(r.contentLeft)}) h1L=${f(r.h1Left)} ctrl(w=${f(r.ctrlWidth)},l=${f(r.ctrlLeft)}) ovf=${f(r.overflow)} ${r.error ? "ERR=" + r.error : ""}`);
  }
  await ctx.close();
}
await browser.close();
console.log("\nJSON:\n" + JSON.stringify(rows, null, 2));
