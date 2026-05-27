// Phase 8 — Inspect Daou Office mail page deeply, scroll to spam folder,
// click a Supabase confirmation mail item to render its body iframe, then
// extract the verify URL.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const mailPage = ctx.pages().find(p => p.url().includes("keduall.daouoffice.com"));
if (!mailPage) { console.error("no mail page"); process.exit(1); }

// Bring it to front
await mailPage.bringToFront();

// Save initial state screenshot
await mailPage.screenshot({ path: `${ROOT}/00-mail-initial.png`, fullPage: false });
console.log("Saved 00-mail-initial.png");

// Inspect mail-web frame deeply
const mailFrame = mailPage.frames().find(f => f.url().includes("mail/web-index"));
if (!mailFrame) { console.error("no mail-web frame"); process.exit(1); }

// Look for elements containing "Confirm your email address" or "Supabase"
const subjectMatches = await mailFrame.$$eval('*', els => {
  const out = [];
  for (const el of els) {
    const t = (el.textContent || "").trim();
    if (t && t.length < 200 && (t.includes("Confirm your email") || t.includes("supabase") || t.includes("Supabase"))) {
      const r = el.getBoundingClientRect();
      // Skip nav-only elements with no visible size
      if (r.width > 0 && r.height > 0) {
        out.push({
          tag: el.tagName,
          text: t.substring(0, 100),
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
          className: (el.className || "").toString().substring(0, 80)
        });
      }
    }
  }
  // unique by text
  const seen = new Set();
  return out.filter(o => { if (seen.has(o.text)) return false; seen.add(o.text); return true; }).slice(0, 20);
}).catch(e => { console.log("eval err:", e.message); return []; });

console.log("\n=== Subject-like matches:");
for (const m of subjectMatches) console.log("  ", JSON.stringify(m).substring(0, 220));

// Try clicking the first match if any
if (subjectMatches.length > 0) {
  const first = subjectMatches[0];
  console.log(`\n=== Clicking first match at (${first.x + first.w/2}, ${first.y + first.h/2}): "${first.text}"`);
  try {
    // Use mouse to click at the center of the bounding rect (frame-relative)
    // Convert to page coordinates: frame may have offset; we use the frame's content document via locator
    await mailFrame.locator(`text="${first.text.split("\n")[0]}"`).first().click({ timeout: 5000 });
    await mailPage.waitForTimeout(2500);
    console.log("Clicked. Waiting for body to render...");
  } catch (e) {
    console.log("click failed:", e.message);
  }
}

// After click, take screenshot and re-scan all frames
await mailPage.screenshot({ path: `${ROOT}/01-mail-after-click.png`, fullPage: false });
console.log("Saved 01-mail-after-click.png");

console.log("\n=== Frames after click:");
for (const f of mailPage.frames()) {
  console.log(" frame:", f.url() || "(blank)");
}

// Search supabase URL across all frames (including inner iframes)
let found = null;
for (const f of mailPage.frames()) {
  try {
    const hits = await f.$$eval('a', as =>
      as.map(a => a.href).filter(h => h && (h.includes("supabase.co/auth/v1/verify") || h.includes("fglggyfvzjdsbyckinqa")))
    );
    if (hits.length > 0) { found = { frame: f.url(), href: hits[0] }; break; }
    const text = await f.locator("body").innerText({ timeout: 1500 }).catch(() => "");
    const m = text.match(/https?:\/\/[^\s<>"']*supabase[^\s<>"']*/);
    if (m) { found = { frame: f.url(), href: m[0] }; break; }
  } catch (e) {}
}
console.log("\n=== Supabase URL found:", JSON.stringify(found));

await browser.close();
