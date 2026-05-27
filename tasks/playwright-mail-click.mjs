// Phase 8 — Playwright CDP attach + search across all frames for Supabase link

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CDP = "http://localhost:9222";
const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const browser = await chromium.connectOverCDP(CDP);
const contexts = browser.contexts();

const allPages = [];
for (const ctx of contexts) for (const p of ctx.pages()) allPages.push(p);
console.log("pages:");
for (const p of allPages) console.log("  -", p.url(), "|", await p.title());

const mailPage = allPages.find(p => p.url().includes("keduall.daouoffice.com"))
  ?? allPages.find(p => p.url().includes("mail"));
if (!mailPage) { console.error("no mail page"); process.exit(1); }

console.log("\n=== Mail page:", mailPage.url());
console.log("=== Frames in mail page:", mailPage.frames().length);
for (const f of mailPage.frames()) {
  console.log("  frame:", f.url() || "(blank)");
}

// Search supabase verify link across all frames
let verifyUrl = null;
let foundIn = null;
for (const frame of mailPage.frames()) {
  try {
    const hrefs = await frame.$$eval('a', as =>
      as.map(a => a.href).filter(h => h && (h.includes("fglggyfvzjdsbyckinqa") || h.includes("supabase.co/auth/v1/verify")))
    );
    if (hrefs.length > 0) {
      verifyUrl = hrefs[0];
      foundIn = frame.url() || "(blank-frame)";
      break;
    }
  } catch (e) {
    // cross-origin frame
  }
}

if (!verifyUrl) {
  // Try innerText search to find URL even if it's not a link
  console.log("\nNo anchor found, dumping frame texts for diagnostics:");
  for (const frame of mailPage.frames()) {
    try {
      const text = await frame.locator("body").innerText({ timeout: 2000 });
      const hits = (text.match(/https?:\/\/[^\s<>"']*supabase[^\s<>"']*/g) || []);
      if (hits.length > 0) {
        console.log(" frame", frame.url(), "→ urls in text:", hits.slice(0, 3));
        verifyUrl = hits[0];
        foundIn = frame.url() || "(text-extract)";
        break;
      }
      console.log(" frame", frame.url() || "(blank)", "→ text head:", text.substring(0, 150).replace(/\s+/g, " "));
    } catch (e) {
      console.log(" frame", frame.url(), "→ inaccessible");
    }
  }
}

if (!verifyUrl) {
  await mailPage.screenshot({ path: `${ROOT}/00-mail-page-state.png`, fullPage: false });
  console.error("\nFAIL: Supabase verify URL을 어느 프레임에서도 못 찾음. 스크린샷 저장: 00-mail-page-state.png");
  await browser.close();
  process.exit(1);
}

console.log("\n=== Found verify URL in:", foundIn);
console.log(verifyUrl.substring(0, 250));

// Take screenshot of mail page
await mailPage.screenshot({ path: `${ROOT}/01-mail-before-click.png`, fullPage: false });

// Open in new tab to observe redirect chain
const ctx = mailPage.context();
const newTab = await ctx.newPage();

const navigations = [];
newTab.on("framenavigated", f => { if (f === newTab.mainFrame()) navigations.push(f.url()); });

console.log("\n=== Navigating to verify URL...");
await newTab.goto(verifyUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(e => {
  console.log("nav warn:", e.message);
});

const finalUrl = newTab.url();
const finalTitle = await newTab.title();
const bodyText = await newTab.locator("body").innerText().catch(() => "");

console.log("\n=== FINAL URL :", finalUrl);
console.log("=== FINAL TITLE:", finalTitle);
console.log("\n=== Navigation chain:");
for (const u of navigations) console.log("  →", u);

console.log("\n=== Visible text (first 600 chars):");
console.log(bodyText.substring(0, 600));

await newTab.screenshot({ path: `${ROOT}/02-after-click.png`, fullPage: false });

writeFileSync(
  `${ROOT}/click-result.json`,
  JSON.stringify({ verifyUrl, foundIn, finalUrl, finalTitle, navigations, bodyTextHead: bodyText.substring(0, 1500) }, null, 2),
  "utf-8"
);

await browser.close();
console.log("\nDONE. Artifacts in tasks/phase8-screenshots/");
