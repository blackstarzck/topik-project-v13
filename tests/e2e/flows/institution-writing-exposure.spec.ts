import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
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
    // CI can provide the same env vars directly.
  }
}

loadEnvLocal();

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const PASSWORD = "Password123!";
const DISABLED_WRITING_MENU_SELECTOR = [
  "DirectboxNotif",
  "ProgrammingArrows",
  "PresentationChart",
  "DocumentText",
]
  .map(
    (iconName) =>
      `.ant-menu-item-disabled:has([data-sidebar-icon-name="${iconName}"])`,
  )
  .join(", ");
const REPORT_DIR = path.join(
  process.cwd(),
  "docs",
  "qa",
  "reports",
  "2026-06-29-non-institution-writing-full-exposure",
);

type TestUser = {
  email: string;
  id: string;
};

type InstitutionFixture = {
  institutionCode: string;
  marker: string;
  problemId: string;
  questionId: string;
  title: string;
};

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for institution exposure e2e",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicClient() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase public credentials for institution exposure e2e",
    );
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function collectErrors(page: Page): string[] {
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

async function exposureTableAvailable() {
  const { error } = await serviceClient()
    .from("topik_writing_question_institution_exposure")
    .select("question_id")
    .limit(1);
  if (!error) return true;
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.includes("topik_writing_question_institution_exposure")
  ) {
    return false;
  }
  throw error;
}

async function createTestUser(
  marker: string,
  label: string,
  affiliationCode?: string,
): Promise<TestUser> {
  const sb = serviceClient();
  const email = `e2e-institution-${label}-${marker}@example.com`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: `E2E Institution ${label}`,
      nationality_country_code: "KR",
      ...(affiliationCode ? { affiliation_code: affiliationCode } : {}),
    },
  });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error(`Missing user id for ${email}`);
  return { email, id };
}

async function waitForProfileAffiliation(
  userId: string,
  expected: string | null,
) {
  const sb = serviceClient();
  await expect
    .poll(async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("affiliation_code")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data?.affiliation_code as string | null | undefined) ?? null;
    })
    .toBe(expected);
}

async function waitForPasswordSignInReady(email: string) {
  const sb = publicClient();
  let lastMessage = "";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await sb.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (!error) {
      await sb.auth.signOut();
      return;
    }
    lastMessage = error.message;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Temporary e2e user password sign-in did not become ready: ${lastMessage}`,
  );
}

async function createInstitutionProblemFixture(): Promise<InstitutionFixture> {
  const sb = serviceClient();
  const marker = `e2e-inst-${randomUUID().slice(0, 8)}`;
  const institutionCode = `E2E_INST_${randomUUID().slice(0, 8)}`;
  const problemId = randomUUID();
  const questionId = `${marker}-q51`;
  const title = `E2E institution-only writing ${marker}`;
  const now = new Date(Date.now() + 180_000).toISOString();

  const problem = await sb.from("problems").insert({
    id: problemId,
    source: "curated",
    domain: "writing",
    question_no: 51,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt:
      "Read the notice and complete the blank with an appropriate answer.",
    materials: {
      question_id: questionId,
      blank_target_giyeok: "schedule",
      blank_target_nieun: "registration",
    },
    answer_key: null,
    rubric: {
      conditions: ["Complete the notice naturally."],
      criteria: ["content", "format", "accuracy"],
    },
    tags: [marker, "e2e-institution-exposure"],
    publish_status: "published",
    review_status: "approved",
    visibility: "public",
    lifecycle_status: "active",
    created_at: now,
    updated_at: now,
  });
  if (problem.error) throw problem.error;

  const exposure = await sb
    .from("topik_writing_question_institution_exposure")
    .insert({
      question_id: questionId,
      item_number: 51,
      institution_code: institutionCode,
    });
  if (exposure.error) throw exposure.error;

  return { institutionCode, marker, problemId, questionId, title };
}

async function cleanupFixture(
  fixture: InstitutionFixture | null,
  users: TestUser[],
) {
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;
  const sb = serviceClient();

  if (fixture) {
    await sb
      .from("topik_writing_question_institution_exposure")
      .delete()
      .eq("question_id", fixture.questionId);
    await sb.from("problems").delete().eq("id", fixture.problemId);
  }

  for (const user of users) {
    await sb.auth.admin.deleteUser(user.id);
  }
}

async function login(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');

  let reachedPostLoginRoute = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await emailInput.fill(email);
    await passwordInput.fill(PASSWORD);
    if (
      (await emailInput.inputValue()) === email &&
      (await passwordInput.inputValue()) === PASSWORD
    ) {
      await page.locator('button[type="submit"]').click();
      reachedPostLoginRoute = await page
        .waitForURL(/\/(dashboard|auth\/consent|onboarding\/learning-goal)/, {
          timeout: 30_000,
        })
        .then(() => true)
        .catch(() => false);
      if (reachedPostLoginRoute) break;
    }
    await page.waitForTimeout(150);
  }

  expect(reachedPostLoginRoute).toBe(true);

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

async function openProblemList(page: Page, marker: string) {
  const response = page
    .waitForResponse(
      (candidate) =>
        candidate.url().includes("/rest/v1/rpc/list_user_problems") &&
        candidate.status() === 200,
      { timeout: 15_000 },
    )
    .catch(() => null);
  await page.goto(
    `/practice/problems?q=${encodeURIComponent(marker)}&sort=newest&page=1`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page).not.toHaveURL(/\/login/);
  await response;
}

async function expectProblemTitleVisible(
  page: Page,
  marker: string,
  title: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await openProblemList(page, marker);
    try {
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1_000);
    }
  }
}

async function expectDirectWritingAvailable(page: Page, problemId: string) {
  await page.goto(`/writing/short-answer-writing-51?problem=${problemId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".writing-workspace")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".writing-empty-state")).toHaveCount(0);
}

async function withFreshPage<T>(
  browser: Browser,
  viewport: { width: number; height: number },
  run: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
    viewport,
  });
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await context.close();
  }
}

function viewportForProject(projectName: string) {
  return projectName === "mobile-360"
    ? { width: 360, height: 720 }
    : { width: 1280, height: 800 };
}

function screenshotPath(baseName: string, projectName: string) {
  const suffix = projectName === "mobile-360" ? "mobile" : "desktop";
  mkdirSync(REPORT_DIR, { recursive: true });
  return path.join(REPORT_DIR, `${baseName}-${suffix}.png`);
}

async function captureEvidence(
  page: Page,
  baseName: string,
  projectName: string,
) {
  await page.screenshot({
    path: screenshotPath(baseName, projectName),
    fullPage: true,
  });
}

async function waitForWritingAvailability(page: Page) {
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

async function expectDisabledWritingMenuItems(
  menuScope: Locator,
  expectedCount: number,
) {
  await expect(menuScope.locator(DISABLED_WRITING_MENU_SELECTOR)).toHaveCount(
    expectedCount,
  );
  await expect(menuScope.locator(".app-sidebar-lock-label")).toHaveCount(0);
  await expect(menuScope.locator(".app-sidebar-lock-icon")).toHaveCount(0);
  await expect(menuScope.locator(".app-sidebar-lock-tag")).toHaveCount(0);
}

test.skip(
  !SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_KEY,
  "Institution exposure e2e requires Supabase service credentials",
);
test.skip(
  ENV_LABEL === "prod" || ENV_LABEL === "production",
  "Institution exposure e2e must not seed production data",
);

test("non-institution writing access stays fully visible while unassigned institution learners are locked", async ({
  browser,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "Institution visibility evidence runs on desktop and mobile.",
  );
  // Three fresh users each clear the consent + onboarding gates now, so give
  // the flow more headroom than the original 90s.
  test.setTimeout(150_000);

  const hasExposureTable = await exposureTableAvailable();
  test.skip(
    !hasExposureTable,
    "public.topik_writing_question_institution_exposure is not available in this environment",
  );

  let fixture: InstitutionFixture | null = null;
  const users: TestUser[] = [];

  try {
    fixture = await createInstitutionProblemFixture();
    const generalUser = await createTestUser(fixture.marker, "general");
    const institutionUser = await createTestUser(
      fixture.marker,
      "matched",
      fixture.institutionCode,
    );
    const unassignedInstitutionCode = `UNASSIGNED_${randomUUID().slice(0, 8)}`;
    const unassignedInstitutionUser = await createTestUser(
      fixture.marker,
      "unassigned",
      unassignedInstitutionCode,
    );
    users.push(generalUser, institutionUser, unassignedInstitutionUser);

    await waitForProfileAffiliation(generalUser.id, null);
    await waitForProfileAffiliation(
      institutionUser.id,
      fixture.institutionCode,
    );
    await waitForProfileAffiliation(
      unassignedInstitutionUser.id,
      unassignedInstitutionCode,
    );
    await waitForPasswordSignInReady(generalUser.email);
    await waitForPasswordSignInReady(institutionUser.email);
    await waitForPasswordSignInReady(unassignedInstitutionUser.email);

    const viewport = viewportForProject(testInfo.project.name);

    await withFreshPage(browser, viewport, async (page) => {
      const errors = collectErrors(page);
      await login(page, generalUser.email);
      if (testInfo.project.name === "mobile-360") {
        await expectDirectWritingAvailable(page, fixture!.problemId);
      } else {
        await expectProblemTitleVisible(page, fixture!.marker, fixture!.title);
      }
      expect(errors).toEqual([]);
    });

    await withFreshPage(browser, viewport, async (page) => {
      const errors = collectErrors(page);
      await login(page, institutionUser.email);
      if (testInfo.project.name === "mobile-360") {
        await expectDirectWritingAvailable(page, fixture!.problemId);
      } else {
        await expectProblemTitleVisible(page, fixture!.marker, fixture!.title);
      }
      expect(errors).toEqual([]);
    });

    await withFreshPage(browser, viewport, async (page) => {
      const errors = collectErrors(page);
      await login(page, unassignedInstitutionUser.email);

      await openProblemList(page, fixture!.marker);
      await expect(page.getByText(fixture!.title)).toHaveCount(0);
      await captureEvidence(page, "problems-empty", testInfo.project.name);

      await page.goto("/practice/recommendations", {
        waitUntil: "domcontentloaded",
      });
      await waitForWritingAvailability(page);
      await expect(page.locator(".problem-type-tabs__badge")).toHaveCount(4);
      await expect(page.locator('a[href^="/writing/"]')).toHaveCount(0);
      await captureEvidence(
        page,
        "recommendations-locked",
        testInfo.project.name,
      );

      const menuScope = await openWritingSidebarGroup(
        page,
        testInfo.project.name,
      );
      await waitForWritingAvailability(page);
      await expectDisabledWritingMenuItems(menuScope, 4);
      await captureEvidence(page, "sidebar-locked", testInfo.project.name);

      await page.goto("/writing/short-answer-writing-51", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator(".writing-empty-state")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator(".writing-workspace")).toHaveCount(0);
      await captureEvidence(
        page,
        "direct-writing-unavailable",
        testInfo.project.name,
      );

      expect(errors).toEqual([]);
    });
  } finally {
    await cleanupFixture(fixture, users);
  }
});
