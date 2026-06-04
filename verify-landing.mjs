import { chromium } from "playwright";

const URL = process.env.VERIFY_URL || "http://localhost:3000/";
const consoleMsgs = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
// fresh context => no browser cache, mimics a hard reload
const context = await browser.newContext({ locale: "ko-KR", bypassCSP: true });
const page = await context.newPage();

page.on("console", (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => pageErrors.push(err.message));

const resp = await page.goto(URL, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3000);

// Next.js dev error overlay lives in a <nextjs-portal> shadow root
const overlayText = await page.evaluate(() => {
  const portal = document.querySelector("nextjs-portal");
  if (portal && portal.shadowRoot) return portal.shadowRoot.textContent || "";
  return "";
});

// pull the served client JS that defines PreviewMock and look for a spread signature
const scriptSrcs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("script[src]")).map((s) => s.src),
);
let previewChunkReport = "no chunk with PreviewMock found";
for (const src of scriptSrcs) {
  try {
    const body = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return await r.text();
    }, src);
    if (body.includes("PreviewMock")) {
      const hasSpread = /PreviewMock[^;]{0,40}\.\.\.|\.\.\.\s*preview/.test(body);
      const mentionsSummary = /summaryKey|summary:/.test(body);
      previewChunkReport = `chunk=${src.split("/").pop()} hasSpreadSig=${hasSpread} mentionsSummaryProp=${mentionsSummary}`;
      break;
    }
  } catch (e) {
    /* ignore cross-origin/opaque */
  }
}

const title = await page.title();
const previewCards = await page.locator("#preview .ant-card").count().catch(() => -1);

console.log("URL", URL);
console.log("STATUS", resp && resp.status());
console.log("TITLE", JSON.stringify(title));
console.log("PREVIEW_CARD_COUNT", previewCards);
console.log("OVERLAY_PRESENT", overlayText.length > 0);
console.log("OVERLAY_HAS_KEY_SPREAD:", /key.{0,4}prop|spread into jsx/i.test(overlayText));
if (overlayText.length > 0) console.log("OVERLAY_TEXT_HEAD:", overlayText.slice(0, 300));

console.log(`--- PAGE ERRORS (${pageErrors.length}) ---`);
pageErrors.forEach((e, i) => console.log(`PE${i}:`, e));
console.log(`--- CONSOLE (${consoleMsgs.length}) ---`);
consoleMsgs.forEach((m) => console.log(`[${m.type}]`, m.text));

const blob = consoleMsgs.map((m) => `${m.type} ${m.text}`).concat(pageErrors).join("\n").toLowerCase();
console.log("--- SCAN ---");
console.log("HAS_KEY_SPREAD_WARN:", /key.{0,4}prop|spread into jsx/.test(blob));
console.log("ERROR_COUNT:", consoleMsgs.filter((m) => m.type === "error").length + pageErrors.length);
console.log("SERVED_CHUNK:", previewChunkReport);

await browser.close();
