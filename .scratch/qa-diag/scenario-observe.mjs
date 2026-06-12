import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const EVID = "docs/qa/reports/qa-report-20260612-1205-evidence";
const browser = await chromium.launch();
const out = {};

function mkpage(ctx) {
  const errs = [];
  return ctx.newPage().then((page) => {
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    return { page, errs };
  });
}

// ---------- G5 / ACC-S3: authed user hits /login and /sign-up ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const { page, errs } = await mkpage(ctx);
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const loginUrl = page.url().replace(BASE, "");
  const loginFormVisible = await page.locator('input[autocomplete="current-password"]').isVisible().catch(() => false);
  await page.goto(BASE + "/sign-up", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const signupUrl = page.url().replace(BASE, "");
  const signupFormVisible = await page.locator("#displayName").isVisible().catch(() => false);
  out.G5_authed_auth_pages = { loginUrl, loginFormVisible, signupUrl, signupFormVisible, consoleErrors: errs };
  await page.close(); await ctx.close();
}

// ---------- G6 / AUTH-S6: find a logout entry point in the app ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const { page } = await mkpage(ctx);
  const found = {};
  for (const route of ["/dashboard", "/profile", "/settings/language"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const hits = await page.evaluate(() => {
      const rx = /(로그아웃|로그 아웃|sign\s*out|log\s*out|sign-out)/i;
      const res = [];
      document.querySelectorAll("a,button,[role='menuitem'],[role='button']").forEach((el) => {
        const txt = (el.textContent || "").trim();
        const href = el.getAttribute("href") || "";
        if (rx.test(txt) || /sign-out|logout/i.test(href)) res.push({ tag: el.tagName, txt: txt.slice(0, 40), href });
      });
      // also look for any form posting to /auth/sign-out
      document.querySelectorAll("form").forEach((f) => {
        const action = f.getAttribute("action") || "";
        if (/sign-out|logout/i.test(action)) res.push({ tag: "FORM", action });
      });
      return res;
    });
    found[route] = hits;
  }
  // Try opening an avatar/user menu on dashboard if present
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const avatarCandidates = await page.locator(".ant-avatar, [data-testid*='user'], [data-testid*='avatar'], header button").count();
  out.G6_logout_entry = { found, avatarCandidatesOnDashboard: avatarCandidates };
  await page.close(); await ctx.close();
}

// ---------- G1 / WRIT-S2: in-app nav away from a dirty writing page ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const { page } = await mkpage(ctx);
  await page.goto(BASE + "/writing/long-form-writing-53?fresh=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const ta = page.locator("textarea").first();
  await ta.fill("이탈 경고 테스트를 위한 작성 중 임시 본문입니다. 저장 전에 사이드바로 이동합니다.");
  await page.waitForTimeout(300);
  // click sidebar Dashboard link
  let dialogAppeared = false;
  const beforeUrl = page.url();
  await page.getByRole("menuitem", { name: /대시보드/ }).first().click().catch(async () => {
    await page.locator('a[href="/dashboard"]').first().click().catch(() => {});
  });
  await page.waitForTimeout(900);
  dialogAppeared = (await page.locator(".ant-modal:visible, [role='dialog']:visible").count()) > 0;
  const afterUrl = page.url().replace(BASE, "");
  out.G1_inapp_nav_dirty = { beforeUrl: beforeUrl.replace(BASE, ""), afterUrl, warningDialogAppeared: dialogAppeared, navigatedAway: /\/dashboard/.test(afterUrl) };
  await page.close(); await ctx.close();
}

// ---------- ACC-S4: free user × /growth → lock UI (not redirect) ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const { page } = await mkpage(ctx);
  await page.goto(BASE + "/growth", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const url = page.url().replace(BASE, "");
  const bodyText = (await page.locator("main").innerText().catch(() => "")).slice(0, 600);
  const hasUpgradeCta = await page.locator('a[href*="paywall"], a[href*="subscription"], button:has-text("업그레이드"), :text("페이월")').count();
  await page.screenshot({ path: path.join(EVID, "acc-s4-growth-lock-1280.png") });
  out.ACC_S4_growth_free = { url, redirected: /\/login|\/paywall/.test(url), upgradeCtaCount: hasUpgradeCta, bodyTextSnippet: bodyText };
  await page.close(); await ctx.close();
}

// ---------- FUNC-D03 autosave badge: type → badge transitions ----------
{
  const ctx = await browser.newContext({ storageState: "tests/e2e/auth-state/student.json", viewport: { width: 1280, height: 800 } });
  const { page } = await mkpage(ctx);
  await page.goto(BASE + "/writing/short-answer-writing-51?fresh=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const ta = page.locator("textarea").first();
  // capture badge text before
  const badgeBefore = await page.locator("main").innerText().then(t => (t.match(/저장됨|저장 중|저장 안 됨|변경됨|저장 실패/g) || []).join(",")).catch(() => "");
  await ta.fill("자동저장 배지 전이 관찰용 단답 예시입니다. 충분한 길이로 작성합니다.");
  await page.waitForTimeout(3500); // wait past 2s debounce + save
  const badgeAfter = await page.locator("main").innerText().then(t => (t.match(/저장됨|저장 중|저장 안 됨|변경됨|저장 실패|방금 저장/g) || []).join(",")).catch(() => "");
  const submitEnabled = await page.getByRole("button", { name: "제출하기", exact: true }).isEnabled().catch(() => false);
  out.FUNC_D01_autosave = { badgeBefore, badgeAfter, submitEnabledAfterValidLength: submitEnabled };
  await page.close(); await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
