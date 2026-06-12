import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

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

const BASE = "http://127.0.0.1:3000";
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.locator('input[autocomplete="email"]').fill(EMAIL);
await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const testids = await page.evaluate(() =>
  Array.from(new Set(Array.from(document.querySelectorAll("[data-testid]")).map((n) => n.getAttribute("data-testid")))).sort(),
);
console.log("testids:", testids.join(", "));
console.log("selection count text:", await page.getByTestId("library-selection-count").innerText().catch(() => "n/a"));
await page.screenshot({ path: ".scratch/qa-diag/manual-shots/library-state.png", fullPage: true });
await ctx.close();
await browser.close();
