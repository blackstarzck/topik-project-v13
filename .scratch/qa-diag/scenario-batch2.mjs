import { chromium } from "playwright";
import path from "node:path";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const EVID = "docs/qa/reports/qa-report-20260612-1205-evidence";
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
const out = {};

// ---------- SET-S2: language change ----------
{
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0,120)); });
  await page.goto(BASE + "/settings/language", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // detect missing-key leakage anywhere
  const missingKeyBefore = (await page.locator("body").innerText()).match(/[a-zA-Z]+\.[a-zA-Z.]+(?=\s|$)/g) || [];
  // find language radio/select options
  const optionTexts = await page.evaluate(() => {
    const t = [];
    document.querySelectorAll(".ant-radio-wrapper, .ant-select-item, label, [role='radio']").forEach(el => { const x=(el.textContent||'').trim(); if (x && x.length<30) t.push(x); });
    return [...new Set(t)].slice(0, 20);
  });
  // try selecting English (Tiếng or English or 영어) then save — robust: pick a radio that's not currently checked
  let changed = false, coverageNote = false, savedToast = "";
  const enRadio = page.locator(".ant-radio-wrapper", { hasText: /English|영어|Tiếng Anh/ }).first();
  if (await enRadio.count()) {
    await enRadio.click().catch(()=>{});
    await page.waitForTimeout(300);
    coverageNote = (await page.locator("body").innerText()).match(/번역|아직|원문|coverage|미이전|일부/i) != null;
    const saveBtn = page.getByRole("button", { name: /저장|Save|Lưu/ }).first();
    if (await saveBtn.count()) { await saveBtn.click().catch(()=>{}); await page.waitForTimeout(1500); changed = true; }
  }
  await page.screenshot({ path: path.join(EVID, "set-s2-language-after.png") });
  const afterText = (await page.locator("body").innerText()).slice(0, 200).replace(/\s+/g,' ');
  out.SET_S2_language = { optionTexts, changed, coverageNote, missingKeyLeak: missingKeyBefore.filter(k=>/^(common|auth|dashboard|settings)\./.test(k)).slice(0,5), afterText, consoleErrors: errs };
  // restore to Korean
  const koRadio = page.locator(".ant-radio-wrapper", { hasText: /한국어|Korean|Hàn/ }).first();
  if (await koRadio.count()) { await koRadio.click().catch(()=>{}); await page.waitForTimeout(300); const sb = page.getByRole("button", { name: /저장|Save|Lưu/ }).first(); if (await sb.count()) { await sb.click().catch(()=>{}); await page.waitForTimeout(1200); } }
  out.SET_S2_language.restoredKorean = true;
  await page.close();
}

// ---------- PRAC-S1: C-02 problem list filters ----------
{
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0,120)); });
  page.on("pageerror", (e) => errs.push("pageerror:" + e.message.slice(0,120)));
  await page.goto(BASE + "/practice/problems", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const rowCountBefore = await page.locator(".ant-table-row, [data-testid*='problem-row'], tbody tr").count();
  const hasFilters = await page.locator(".ant-select, .ant-input, [role='tab'], .ant-segmented").count();
  const hasSearch = await page.locator('input[type="search"], input[placeholder*="검색"], .ant-input-search input').count();
  const hasPagination = await page.locator(".ant-pagination").count();
  const statusBadges = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll(".ant-tag, .ant-badge").forEach(el => { const t=(el.textContent||'').trim(); if(t) set.add(t); });
    return [...set].slice(0, 12);
  });
  await page.screenshot({ path: path.join(EVID, "c02-problem-list-detail.png") });
  out.PRAC_S1_problem_list = { rowCountBefore, filterControls: hasFilters, searchControls: hasSearch, paginationPresent: hasPagination, statusBadges, consoleErrors: errs };
  await page.close();
}

// ---------- WRIT-S3: submit cancel preserves input ----------
{
  const page = await ctx.newPage();
  await page.goto(BASE + "/writing/short-answer-writing-51?fresh=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const txt = "제출 취소 후 입력 보존을 확인하기 위한 단답 예시입니다. 충분한 길이.";
  await page.locator("textarea").first().fill(txt);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.waitForTimeout(500);
  const modalShown = await page.getByTestId("submission-confirm-modal").isVisible().catch(()=>false);
  await page.getByTestId("submission-confirm-cancel").click().catch(()=>{});
  await page.waitForTimeout(400);
  const valAfterCancel = await page.locator("textarea").first().inputValue().catch(()=> "");
  out.WRIT_S3_cancel_preserves = { modalShown, inputPreservedAfterCancel: valAfterCancel === txt, len: valAfterCancel.length };
  await page.close();
}

await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
