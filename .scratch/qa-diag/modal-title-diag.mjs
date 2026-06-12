import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: "tests/e2e/auth-state/student.json",
  viewport: { width: 1280, height: 800 },
});
const page = await ctx.newPage();
const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message));

await page.goto(`${BASE}/writing/short-answer-writing-51`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const ta = page.locator("textarea").first();
await ta.fill("핵심 사용자 플로우 검증을 위한 충분한 길이의 예시 답안입니다. 감사합니다.");
await page.waitForTimeout(300);
const submitBtn = page.getByRole("button", { name: "제출하기", exact: true });
console.log("제출하기 enabled:", await submitBtn.isEnabled());
await submitBtn.click();
await page.waitForTimeout(800);

const modalVisible = await page.locator(".ant-modal").count();
const antModalTitle = await page.locator(".ant-modal-title").count();
const heading2 = await page.getByRole("heading", { level: 2, name: "답안을 제출하시겠어요?" }).count();
// dump classes of the element holding the title text
const titleInfo = await page.evaluate(() => {
  const walker = document.evaluate(
    "//*[contains(normalize-space(.),'답안을 제출하시겠어요?')][not(.//*[contains(normalize-space(.),'답안을 제출하시겠어요?')])]",
    document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
  );
  const el = walker.singleNodeValue;
  if (!el) return "title text node not found";
  return { tag: el.tagName, class: el.className, parentClass: el.parentElement?.className };
});
const headerClasses = await page.evaluate(() => {
  const h = document.querySelector(".ant-modal-header");
  return h ? { headerClass: h.className, innerHTML: h.innerHTML.slice(0, 300) } : "no .ant-modal-header";
});

console.log("=== modal title diagnostic ===");
console.log(".ant-modal count:", modalVisible);
console.log(".ant-modal-title count:", antModalTitle);
console.log("heading[level=2] '답안을...' count:", heading2);
console.log("title element info:", JSON.stringify(titleInfo, null, 2));
console.log(".ant-modal-header info:", JSON.stringify(headerClasses, null, 2));
console.log("console errors:", JSON.stringify(consoleErrs, null, 2));

await browser.close();
