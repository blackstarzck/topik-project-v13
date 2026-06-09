// Modal capture v2 (Phase 1, best-effort) — robust triggers + title-text waits +
// on-failure diagnostics. Each modal isolated; failures recorded as DEFERRED with
// a diagnostic screenshot so the review can still judge from source + SOT.
// Reuses storageState; authed origin. No row commits (cancel/close paths only).
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = ".design-review-shots/20260609";
const STORAGE = "tests/e2e/auth-state/student.json";
const AUTHED = "http://127.0.0.1:3000";
const VIEWPORTS = [1280, 360];
const health = [];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function snap(page, lbl, note) {
  for (const w of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(500);
    const png = path.join(OUT, `${lbl}-${w}.png`);
    await page.screenshot({ path: png, fullPage: true });
    const bodyLen = await page.evaluate(() => (document.body?.innerText || "").length).catch(() => 0);
    health.push({ label: lbl, viewport: w, finalUrl: page.url().replace(AUTHED, ""), bodyTextLen: bodyLen, png, note: note || null });
    console.log(`  snap ${lbl}-${w}  bodyLen=${bodyLen}`);
  }
}

// titleText: substring expected in .ant-modal-title once open.
async function modalCapture(name, lbl, titleText, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: STORAGE });
  const page = await ctx.newPage();
  try {
    await fn(page);
    await page.locator(".ant-modal-title", { hasText: titleText }).first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(500);
    await snap(page, lbl, "modal");
    console.log(`modal ${name} CAPTURED`);
  } catch (e) {
    const modalCount = await page.locator(".ant-modal-content").count().catch(() => -1);
    const diag = path.join(OUT, `_diag-${lbl}.png`);
    await page.screenshot({ path: diag, fullPage: true }).catch(() => {});
    console.error(`modal ${name} FAILED → deferred (modalCount=${modalCount}): ${e.message.split("\n")[0]}`);
    health.push({ label: lbl, viewport: null, finalUrl: page.url().replace(AUTHED, ""), bodyTextLen: 0, png: null, note: `DEFERRED(modalCount=${modalCount}): ${e.message.split("\n")[0].slice(0, 120)}`, diag });
  } finally {
    await ctx.close();
  }
}

// D-M1 submit-confirm
await modalCapture("D-M1 submit-confirm", "12-D-M1-submission-confirmation-modal", "답안을 제출하시겠어요?", async (page) => {
  await page.goto(`${AUTHED}/writing/short-answer-writing-51`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(700);
  const ta = page.locator("textarea").first();
  await ta.click();
  await ta.fill("이것은 제출 확인 모달 캡처를 위한 충분한 길이의 예시 답안 문장입니다. 감사합니다.");
  await page.waitForTimeout(400);
  const submit = page.getByRole("button", { name: "제출하기", exact: true });
  await submit.waitFor({ state: "visible", timeout: 5000 });
  // ensure enabled before clicking
  for (let i = 0; i < 20 && (await submit.isDisabled().catch(() => true)); i++) await page.waitForTimeout(150);
  await submit.click({ timeout: 8000 });
});

// D-M3 autosave-warning (disable_attempt)
await modalCapture("D-M3 autosave-warning", "22-D-M3-autosave-warning", "자동 저장을 끄시겠어요?", async (page) => {
  await page.goto(`${AUTHED}/writing/short-answer-writing-51`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(700);
  const ta = page.locator("textarea").first();
  await ta.fill("자동 저장 경고 모달 캡처용 예시 답안 텍스트입니다.");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "자동 저장 끄기", exact: true }).click({ timeout: 8000 });
});

// C-03 retry — solved filter, fallback to default list
await modalCapture("C-03 retry", "07-C-03-retry-modal", "이전 풀이가 있어요", async (page) => {
  await page.goto(`${AUTHED}/practice/problems?solve=solved`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1500);
  let btn = page.getByRole("button", { name: "다시 풀기", exact: true }).first();
  if ((await btn.count()) === 0) {
    await page.goto(`${AUTHED}/practice/problems`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    btn = page.getByRole("button", { name: "다시 풀기", exact: true }).first();
  }
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.click({ timeout: 8000 });
});

// F-M1 pdf-export — select first submission checkbox then export (first button)
await modalCapture("F-M1 pdf-export", "19-F-M1-pdf-export-modal", "PDF로 내보내기", async (page) => {
  await page.goto(`${AUTHED}/library`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1200);
  const cb = page.locator(".ant-checkbox-input").first();
  await cb.waitFor({ state: "visible", timeout: 8000 });
  await cb.check({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "PDF로 내보내기" }).first().click({ timeout: 8000 });
});

await browser.close();
await writeFile(path.join(OUT, "_health-modals.json"), JSON.stringify({ count: health.length, shots: health }, null, 2), "utf8");
console.log(`\nmodal health → ${path.join(OUT, "_health-modals.json")} (${health.length} entries)`);
console.log("DONE");
