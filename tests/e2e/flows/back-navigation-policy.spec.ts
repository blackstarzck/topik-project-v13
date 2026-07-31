import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_STUDENT_EMAIL;
const PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;

const WRITING_ROUTES = [
  [51, "/writing/short-answer-writing-51"],
  [52, "/writing/answer-writing-52"],
  [53, "/writing/long-form-writing-53"],
  [54, "/writing/essay-writing-54"],
] as const;

const blockedRestMutationAttempts = new WeakMap<Page, string[]>();

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
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

async function loginExistingStudent(page: Page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Existing E2E student credentials are required for read-only navigation tests.",
    );
  }

  await page.goto("/login", { waitUntil: "load" });
  if (new URL(page.url()).pathname === "/dashboard") return;
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(
    /\/(dashboard|auth\/consent|onboarding\/learning-goal)/,
    { timeout: 15_000 },
  );

  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/dashboard") {
    throw new Error(
      `The existing E2E student is not ready for read-only tests (${pathname}).`,
    );
  }
}

async function gotoDashboard(page: Page) {
  await page.goto("/dashboard", { waitUntil: "load" });
  await expectPath(page, "/dashboard");
  await expect(page.locator("main h1")).toBeVisible();
}

async function expectPath(page: Page, expected: string) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return `${url.pathname}${url.search}${url.hash}`;
    })
    .toBe(expected);
}

async function goBackAndExpectPath(page: Page, expected: string) {
  await page.goBack({ waitUntil: "load" });
  await expectPath(page, expected);
  await expect(page.locator("main h1")).toBeVisible();
}

async function clickWritingBack(page: Page) {
  const control = page.locator(".writing-exam-header__back");
  await expect(control).toBeVisible();
  await control.click();
}

function expectOnlyExpectedBlockedWritingMutations(attempts: string[]) {
  expect(
    attempts.every(
      (attempt) =>
        attempt.endsWith("/rest/v1/study_events") ||
        attempt.endsWith("/rest/v1/writing_drafts"),
    ),
  ).toBe(true);
  expect(
    attempts.some((attempt) =>
      /\/rest\/v1\/writing_submissions(?:$|\?)/.test(attempt),
    ),
  ).toBe(false);
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  const attempts: string[] = [];
  blockedRestMutationAttempts.set(page, attempts);

  await page.route(
    /https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//,
    async (route) => {
      await route.fulfill({ status: 204, body: "" });
    },
  );

  await page.route("**/rest/v1/**", async (route) => {
    const method = route.request().method();
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/rest/v1/rpc/list_user_problems")) {
      await route.continue();
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      attempts.push(`${method} ${pathname}`);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  const attempts = blockedRestMutationAttempts.get(page) ?? [];
  expect(
    attempts.some((attempt) =>
      /\/rest\/v1\/writing_submissions(?:$|\?)/.test(attempt),
    ),
  ).toBe(false);
});

test("00 authenticates the existing student without fixture mutation", async ({
  page,
}) => {
  await loginExistingStudent(page);
  await page.context().storageState({
    path: "tests/e2e/auth-state/student.json",
  });
  await expectPath(page, "/dashboard");
});

test("51-54 semantic back validates safe, missing, and unsafe return targets", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = collectRuntimeErrors(page);

  for (const [questionNo, writingPath] of WRITING_ROUTES) {
    const safeReturn = `/practice/problems?type=writing&question=${questionNo}#results`;
    const cases = [
      {
        name: "safe",
        query: `?returnTo=${encodeURIComponent(safeReturn)}`,
        expected: safeReturn,
      },
      { name: "missing", query: "", expected: "/practice/problems" },
      {
        name: "external",
        query: `?returnTo=${encodeURIComponent("https://evil.example")}`,
        expected: "/practice/problems",
      },
      {
        name: "encoded-path",
        query: `?returnTo=${encodeURIComponent("/practice%2Fproblems")}`,
        expected: "/practice/problems",
      },
    ] as const;

    for (const scenario of cases) {
      await gotoDashboard(page);
      await page.goto(`${writingPath}${scenario.query}`, {
        waitUntil: "load",
      });
      await expect(page).not.toHaveURL(/\/login/);

      await clickWritingBack(page);
      await expectPath(page, scenario.expected);
      await expect(page.locator("main")).toBeVisible();

      await goBackAndExpectPath(page, "/dashboard");
    }
  }

  expect(errors).toEqual([]);
});

test("filtered problem list entry restores its query and hash exactly once", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = collectRuntimeErrors(page);
  const source = "/practice/problems?type=51&sort=oldest&page=2#results";

  await gotoDashboard(page);
  await page.goto(source, { waitUntil: "load" });
  const startLink = page
    .locator('a[href^="/writing/short-answer-writing-51"]')
    .first();
  await expect(startLink).toBeVisible();
  await startLink.click();
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);

  await clickWritingBack(page);
  await expectPath(page, source);
  await goBackAndExpectPath(page, source);
  await goBackAndExpectPath(page, "/dashboard");

  expect(errors).toEqual([]);
});

test("dirty semantic back keeps editing, then exits without resurrecting the editor", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectRuntimeErrors(page);
  const mutationAttempts = blockedRestMutationAttempts.get(page) ?? [];

  const returnTo = "/practice/problems?type=writing&page=2#results";
  await gotoDashboard(page);
  await page.goto(
    `/writing/short-answer-writing-51?returnTo=${encodeURIComponent(returnTo)}`,
    { waitUntil: "load" },
  );
  await page.locator("textarea").first().fill("이탈 확인용 임시 답안입니다.");

  await clickWritingBack(page);
  const modal = page.getByTestId("autosave-warning-modal");
  await expect(modal).toBeVisible();
  await page.getByTestId("autosave-warning-keep").click();
  await expect(modal).toBeHidden();

  await clickWritingBack(page);
  await expect(modal).toBeVisible();
  await page.getByTestId("autosave-warning-proceed").click();
  await expectPath(page, returnTo);
  await expect(page.locator("main")).toBeVisible();

  await goBackAndExpectPath(page, "/dashboard");
  expectOnlyExpectedBlockedWritingMutations(mutationAttempts);
  expect(errors).toEqual([]);
});

test("dirty native back remains history-based and supports keep or exit", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectRuntimeErrors(page);
  const mutationAttempts = blockedRestMutationAttempts.get(page) ?? [];

  await page.goto("/practice/problems", { waitUntil: "load" });
  await page.goto("/writing/essay-writing-54", {
    waitUntil: "load",
  });
  await page
    .locator("textarea")
    .first()
    .fill("브라우저 뒤로가기 확인용 임시 장문 답안입니다.");

  await page.goBack();
  const modal = page.getByTestId("autosave-warning-modal");
  await expect(modal).toBeVisible();
  await page.getByTestId("autosave-warning-keep").click();
  await expect(page).toHaveURL(/\/writing\/essay-writing-54/);

  await page.goBack();
  await expect(modal).toBeVisible();
  await page.getByTestId("autosave-warning-proceed").click();
  await expectPath(page, "/practice/problems");

  expectOnlyExpectedBlockedWritingMutations(mutationAttempts);
  expect(errors).toEqual([]);
});

test("library problems and paywall use fixed replace destinations", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectRuntimeErrors(page);

  await gotoDashboard(page);
  await page.goto("/library/problems", { waitUntil: "load" });
  await page.getByTestId("library-problems-back-link").click();
  await expectPath(page, "/library");
  await goBackAndExpectPath(page, "/dashboard");

  await gotoDashboard(page);
  await page.goto(`/paywall?returnTo=${encodeURIComponent("/practice/next")}`, {
    waitUntil: "load",
  });
  await page.getByTestId("paywall-back-control").click();
  await expectPath(page, "/practice/next");
  await goBackAndExpectPath(page, "/dashboard");

  await page.goto("/paywall", { waitUntil: "load" });
  await page.getByTestId("paywall-back-control").click();
  await expectPath(page, "/dashboard");

  expect(errors).toEqual([]);
});

test("feedback back returns to the library when an existing submission is available", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = collectRuntimeErrors(page);

  await gotoDashboard(page);
  const feedbackLink = page.locator('a[href^="/writing/feedback/"]').first();
  test.skip(
    (await feedbackLink.count()) === 0,
    "The read-only E2E student has no existing feedback fixture.",
  );

  const feedbackHref = await feedbackLink.getAttribute("href");
  expect(feedbackHref).toBeTruthy();
  await gotoDashboard(page);
  await page.goto(feedbackHref!, { waitUntil: "load" });
  await page.getByTestId("feedback-header-back-link").click();
  await expectPath(page, "/library");
  await goBackAndExpectPath(page, "/dashboard");

  expect(errors).toEqual([]);
});

test("comparison back returns to its current feedback when an existing report is available", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors = collectRuntimeErrors(page);

  let reportHref: string | null = null;
  await gotoDashboard(page);
  const feedbackLink = page.locator('a[href^="/writing/feedback/"]').first();
  if ((await feedbackLink.count()) > 0) {
    const feedbackHref = await feedbackLink.getAttribute("href");
    if (feedbackHref) {
      await page.goto(feedbackHref, { waitUntil: "load" });
      const feedbackReportLink = page
        .locator('a[href^="/writing/reports/"]')
        .first();
      if ((await feedbackReportLink.count()) > 0) {
        reportHref = await feedbackReportLink.getAttribute("href");
      }
    }
  }
  if (!reportHref) {
    await page.goto("/library?tab=reports", {
      waitUntil: "load",
    });
    const libraryReportLink = page
      .locator('a[href^="/writing/reports/"]')
      .first();
    if ((await libraryReportLink.count()) > 0) {
      reportHref = await libraryReportLink.getAttribute("href");
    }
  }
  test.skip(
    !reportHref,
    "The read-only E2E student has no existing comparison fixture.",
  );

  await gotoDashboard(page);
  await page.goto(reportHref!, { waitUntil: "load" });
  await page.getByTestId("comparison-header-back-link").click();
  await expect(page).toHaveURL(/\/writing\/feedback\/(short|long)\//);
  const feedbackPath = new URL(page.url()).pathname;
  await goBackAndExpectPath(page, "/dashboard");
  expect(feedbackPath).toMatch(/^\/writing\/feedback\/(short|long)\//);

  expect(errors).toEqual([]);
});
