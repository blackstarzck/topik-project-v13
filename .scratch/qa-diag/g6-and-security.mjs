import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq === -1) continue;
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const TEST_PW = process.env.SUPABASE_TEST_PASSWORD ?? "";
const browser = await chromium.launch();
const out = {};

// ---------- G6 follow-up: click avatar/user menu, look for logout ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const results = [];
  const selectors = [".ant-avatar", "header button", "[aria-haspopup='menu']", ".ant-dropdown-trigger"];
  for (const sel of selectors) {
    const n = await page.locator(sel).count();
    if (n > 0) {
      await page.locator(sel).first().click().catch(() => {});
      await page.waitForTimeout(500);
      const menuText = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll(".ant-dropdown a, .ant-dropdown li, [role='menu'] [role='menuitem'], .ant-dropdown-menu-item, .ant-menu-submenu-popup .ant-menu-item").forEach((el) => {
          const tx = (el.textContent || "").trim();
          if (tx && tx.length < 30) items.push(tx);
        });
        return [...new Set(items)];
      });
      const logoutPresent = JSON.stringify(menuText).match(/로그아웃|sign\s*out|log\s*out/i) != null;
      results.push({ selector: sel, count: n, menuTextSample: menuText.slice(0, 15), logoutPresent });
    }
  }
  // Also: does GET /auth/sign-out 405 and POST redirect? check GET status
  const getResp = await page.request.get(BASE + "/auth/sign-out", { maxRedirects: 0 }).catch((e) => ({ status: () => "err:" + e.message }));
  out.G6_followup = { menuProbes: results, getSignOutStatus: typeof getResp.status === "function" ? getResp.status() : getResp };
  await page.close(); await ctx.close();
}

// ---------- Security: service-role key / access token must NOT appear in client HTML+JS ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const scanUrls = new Set();
  page.on("response", (r) => { const u = r.url(); if (u.endsWith(".js") && u.startsWith(BASE)) scanUrls.add(u); });
  const pagesToScan = ["/login", "/dashboard"];
  let combinedHtml = "";
  for (const p of pagesToScan) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    combinedHtml += await page.content();
  }
  // fetch all collected JS chunks
  let jsBlob = "";
  for (const u of scanUrls) {
    const res = await page.request.get(u).catch(() => null);
    if (res) jsBlob += await res.text().catch(() => "");
  }
  const haystack = combinedHtml + jsBlob;
  const contains = (needle) => needle && needle.length > 8 ? haystack.includes(needle) : null;
  out.security_secret_scan = {
    jsChunksScanned: scanUrls.size,
    htmlBytes: combinedHtml.length,
    jsBytes: jsBlob.length,
    serviceRoleKeyLeaked: contains(SERVICE_KEY),
    accessTokenLeaked: contains(ACCESS_TOKEN),
    testPasswordLeaked: contains(TEST_PW),
    publishableKeyPresent_expected: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? haystack.includes(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) : null,
  };
  await page.close(); await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
