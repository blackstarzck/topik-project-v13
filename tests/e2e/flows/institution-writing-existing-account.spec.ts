import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.use({ storageState: { cookies: [], origins: [] } });

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // CI or one-off runs may provide env vars directly.
  }
}

loadEnvLocal();

const USER_ID = process.env.E2E_EXISTING_INSTITUTION_USER_ID;
const LOGIN_EMAIL = process.env.E2E_STUDENT_EMAIL;
const LOGIN_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;
const EXPECTED_COUNT = Number(
  process.env.E2E_EXISTING_INSTITUTION_EXPECTED_WRITING_COUNT ?? "1",
);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const REPORT_DIR = path.join(
  process.cwd(),
  "docs",
  "qa",
  "reports",
  "2026-06-29-institution-assigned-only-writing-access",
);

type AssignedProblem = {
  id: string;
  title: string;
  questionNo: 51 | 52 | 53 | 54;
};

type ProblemRow = {
  id: string;
  title: string | null;
  question_no: number | null;
  materials: { question_id?: string | null } | null;
};

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicClient() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase public credentials");
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isWritingQuestionNo(value: number | null): value is 51 | 52 | 53 | 54 {
  return value === 51 || value === 52 || value === 53 || value === 54;
}

function writingPath(questionNo: AssignedProblem["questionNo"]) {
  switch (questionNo) {
    case 51:
      return "/writing/short-answer-writing-51";
    case 52:
      return "/writing/answer-writing-52";
    case 53:
      return "/writing/long-form-writing-53";
    case 54:
      return "/writing/essay-writing-54";
  }
}

function capturePath(name: string, projectName: string) {
  const suffix = projectName === "mobile-360" ? "mobile" : "desktop";
  mkdirSync(REPORT_DIR, { recursive: true });
  return path.join(REPORT_DIR, `${name}-${suffix}.png`);
}

async function screenshot(page: Page, name: string, projectName: string) {
  await page.screenshot({
    path: capturePath(name, projectName),
    fullPage: true,
  });
}

async function getExistingAccountFixture() {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    throw new Error("E2E_STUDENT_EMAIL and password env are required");
  }

  const login = await publicClient().auth.signInWithPassword({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });
  if (login.error) throw login.error;
  const userId = login.data.user?.id;
  if (!userId) throw new Error("Password login did not return a user");
  if (USER_ID && userId !== USER_ID) {
    throw new Error("Password login target does not match expected user id");
  }

  const admin = adminClient();
  const profile = await admin
    .from("profiles")
    .select("affiliation_code,status")
    .eq("id", userId)
    .maybeSingle();
  if (profile.error) throw profile.error;
  const affiliationCode =
    (profile.data?.affiliation_code as string | null) ?? "";
  if (!affiliationCode.trim()) {
    throw new Error("Existing user is not institution-affiliated");
  }

  const exposure = await admin
    .from("topik_writing_question_institution_exposure")
    .select("question_id,item_number")
    .eq("institution_code", affiliationCode);
  if (exposure.error) throw exposure.error;
  const assignedQuestionIds = new Set(
    (exposure.data ?? []).map((row) => row.question_id as string),
  );

  const problems = await admin
    .from("problems")
    .select("id,title,question_no,materials")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .eq("lifecycle_status", "active")
    .limit(1000);
  if (problems.error) throw problems.error;

  const assignedProblems = ((problems.data ?? []) as ProblemRow[])
    .filter((row) => assignedQuestionIds.has(row.materials?.question_id ?? ""))
    .filter((row) => isWritingQuestionNo(row.question_no))
    .map((row) => ({
      id: row.id,
      title: row.title ?? "",
      questionNo: row.question_no as 51 | 52 | 53 | 54,
    }));

  return {
    email: LOGIN_EMAIL,
    userId,
    assignedProblems,
  };
}

async function login(page: Page, email: string) {
  if (!LOGIN_PASSWORD) {
    throw new Error("E2E password env is required");
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await emailInput.fill(email);
    await passwordInput.fill(LOGIN_PASSWORD);
    if (
      (await emailInput.inputValue()) === email &&
      (await passwordInput.inputValue()) === LOGIN_PASSWORD
    ) {
      break;
    }
    await page.waitForTimeout(150);
  }

  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(LOGIN_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(
    /\/(dashboard|auth\/consent|onboarding\/learning-goal)/,
    { timeout: 20_000 },
  );

  for (let i = 0; i < 6; i += 1) {
    const pathname = new URL(page.url()).pathname;
    if (pathname === "/dashboard") {
      // The post-login client-side redirect (router.push("/dashboard")) can
      // land here WITHOUT the (workspace) completion gate running, so a fresh
      // user may still owe required consents. Verify with a full document
      // load; if the gate bounces to consent/onboarding, keep handling it.
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname === "/dashboard") return;
      continue;
    }
    if (pathname === "/auth/consent") {
      await page.locator('input[name="accept"]').check({ force: true });
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/(dashboard|onboarding\/learning-goal)/, {
        timeout: 15_000,
      });
      continue;
    }
    if (pathname === "/onboarding/learning-goal") {
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      return;
    }
    await page.waitForLoadState("networkidle");
  }

  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForAvailability(page: Page) {
  await page
    .waitForResponse(
      (response) =>
        response.url().includes("/api/practice/writing-availability") &&
        response.status() === 200,
      { timeout: 15_000 },
    )
    .catch(() => null);
}

async function openWritingSidebarGroup(page: Page, projectName: string) {
  const openWritingGroup = async (scope: Locator) => {
    const writingGroup = scope
      .locator('.ant-menu-submenu-title:has([data-sidebar-icon-name="Edit2"])')
      .first();
    await expect(writingGroup).toBeVisible();
    if ((await writingGroup.getAttribute("aria-expanded")) !== "true") {
      await writingGroup.click();
    }
  };

  if (projectName === "mobile-360") {
    await page.locator(".app-workspace-mobile-bar button").first().click();
    const drawer = page.locator(".app-workspace-drawer");
    await expect(drawer).toBeVisible();
    await openWritingGroup(drawer);
    return drawer;
  }

  const sidebar = page.locator(".app-sidebar-shell").first();
  await openWritingGroup(sidebar);
  return sidebar;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

test.skip(
  !LOGIN_EMAIL ||
    !LOGIN_PASSWORD ||
    !SUPABASE_URL ||
    !PUBLISHABLE_KEY ||
    !SERVICE_KEY,
  "Existing institution account e2e requires real Supabase credentials and E2E_STUDENT_EMAIL/password",
);

test("existing institution learner sees only assigned writing type", async ({
  page,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "Existing account evidence runs on desktop and mobile.",
  );
  test.setTimeout(90_000);

  const errors = collectErrors(page);
  // Environment precondition, not a product assertion: this scenario needs the
  // shared E2E student to be provisioned as an institution learner
  // (profiles.affiliation_code set + exposure rows). Deliberately NOT seeded
  // here — affiliating the shared student flips its content visibility
  // (2026-06-29 assigned-only policy) and would break the rest of the suite.
  // Skip in environments where the account is a general learner (mirrors the
  // exposure-table skip in institution-writing-exposure.spec.ts).
  let fixture: Awaited<ReturnType<typeof getExistingAccountFixture>>;
  try {
    fixture = await getExistingAccountFixture();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    test.skip(
      message.includes("not institution-affiliated"),
      "Shared E2E student is a general learner in this environment — provision an affiliated account (E2E_EXISTING_INSTITUTION_USER_ID) to run this scenario",
    );
    throw error;
  }
  expect(fixture.assignedProblems).toHaveLength(EXPECTED_COUNT);
  const assignedProblem = fixture.assignedProblems[0];

  await login(page, fixture.email);

  await page.goto("/practice/problems?domain=writing&sort=newest&page=1", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText(assignedProblem.title)).toBeVisible({
    timeout: 15_000,
  });
  await screenshot(page, "existing-account-problems", testInfo.project.name);

  await page.goto("/practice/recommendations", {
    waitUntil: "domcontentloaded",
  });
  await waitForAvailability(page);
  await expect(page.locator(".problem-type-tabs__badge")).toHaveCount(
    4 - EXPECTED_COUNT,
  );
  await expect(page.locator('a[href^="/writing/"]')).toHaveCount(
    EXPECTED_COUNT,
  );
  await screenshot(
    page,
    "existing-account-recommendations",
    testInfo.project.name,
  );

  const menuScope = await openWritingSidebarGroup(page, testInfo.project.name);
  await waitForAvailability(page);
  await expect(menuScope.locator(".app-sidebar-lock-tag")).toHaveCount(
    4 - EXPECTED_COUNT,
  );
  await screenshot(page, "existing-account-sidebar", testInfo.project.name);

  await page.goto(writingPath(assignedProblem.questionNo), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".writing-workspace")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".writing-empty-state")).toHaveCount(0);
  await screenshot(
    page,
    "existing-account-direct-writing",
    testInfo.project.name,
  );

  const lockedQuestionNo = ([51, 52, 53, 54] as const).find(
    (questionNo) => questionNo !== assignedProblem.questionNo,
  );
  expect(lockedQuestionNo).toBeDefined();
  await page.goto(writingPath(lockedQuestionNo!), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".writing-empty-state")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".writing-workspace")).toHaveCount(0);
  await screenshot(
    page,
    "existing-account-direct-locked",
    testInfo.project.name,
  );

  expect(errors).toEqual([]);
});
