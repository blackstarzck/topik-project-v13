import { expect, test, type Page, type Request } from "@playwright/test";

const REPORT_ROUTE = "**/api/system-reports";
const OPEN_LAUNCHER_LABEL =
  /^(도움 요청 및 의견 보내기|Get help or send feedback|Nhận trợ giúp hoặc gửi góp ý)$/;
const CLOSE_LAUNCHER_LABEL =
  /^(도움 요청 닫기|Close help request|Đóng yêu cầu trợ giúp)$/;
const PUBLIC_READ_ONLY = process.env.PLAYWRIGHT_PUBLIC_READ_ONLY === "1";

async function openReport(page: Page) {
  const launcher = page.getByTestId("system-report-launcher");
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-label", CLOSE_LAUNCHER_LABEL);
  await expect(launcher).toHaveAttribute(
    "aria-controls",
    "system-report-panel",
  );
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("system-report-form")).toBeVisible();
}

async function fillReport(page: Page) {
  await page.getByTestId("system-report-email").fill("e2e@example.com");
  await page.getByTestId("system-report-title").fill("Playwright report");
  await page
    .getByTestId("system-report-message")
    .fill("This request is intercepted locally and never reaches Supabase.");
}

test("launcher is absent only on landing and opens a responsive panel", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("system-report-launcher")).toHaveCount(0);

  await page.goto("/terms");
  const launcher = page.getByTestId("system-report-launcher");
  await expect(launcher).toBeVisible();
  const launcherShadow = await launcher.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(launcherShadow).not.toBe("none");

  const anonymousContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(new URL("/login", baseURL).toString());
    await expect(anonymousPage).toHaveURL((url) => url.pathname === "/login");
    await expect(
      anonymousPage.getByTestId("system-report-launcher"),
    ).toBeVisible();
  } finally {
    await anonymousContext.close();
  }

  await page.goto("/terms");
  const viewport = page.viewportSize();
  const launcherBox = await launcher.boundingBox();
  expect(viewport).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(
    (viewport?.width ?? 0) - (launcherBox?.x ?? 0) - (launcherBox?.width ?? 0),
  ).toBeLessThanOrEqual(48);
  expect(
    (viewport?.height ?? 0) -
      (launcherBox?.y ?? 0) -
      (launcherBox?.height ?? 0),
  ).toBeLessThanOrEqual(120);

  await openReport(page);
  const popover = page.locator(".app-system-report-popover.ant-popover");
  const popoverContainer = popover.locator(".ant-popover-container");
  const popoverBox = await popover.boundingBox();
  const documentWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(popoverBox).not.toBeNull();
  await expect(popover).toBeVisible();
  await expect(
    page.locator(".app-system-report-modal, .ant-modal, .ant-modal-mask"),
  ).toHaveCount(0);
  await expect(
    page.locator('#system-report-panel[role="dialog"]'),
  ).toHaveAttribute("aria-modal", "false");
  await expect(page.getByTestId("system-report-cancel")).toHaveCount(0);
  expect(
    await popoverContainer.evaluate(
      (element) => getComputedStyle(element).scrollbarWidth,
    ),
  ).toBe("none");
  const popoverShadow = await popoverContainer.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(popoverShadow).not.toBe("none");
  expect(popoverShadow).toContain("rgba(15, 23, 42, 0.16)");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page.mouse.move(
    Math.min(
      documentWidth - 2,
      (popoverBox?.x ?? 0) + (popoverBox?.width ?? 0) + 8,
    ),
    240,
  );
  await page.mouse.wheel(0, 360);
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(popoverBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    documentWidth - 24,
  );
  expect(popoverBox?.x ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual(8);
  expect(
    documentWidth - (popoverBox?.x ?? 0) - (popoverBox?.width ?? 0),
  ).toBeGreaterThanOrEqual(12);
  expect(
    await page.evaluate(() => ({
      bodyOverflow:
        document.body.scrollWidth - document.documentElement.clientWidth,
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    })),
  ).toEqual({
    bodyOverflow: 0,
    documentOverflow: 0,
  });

  await launcher.click();
  await expect(popover).toBeHidden();
  await expect(launcher).toHaveAttribute("aria-label", OPEN_LAUNCHER_LABEL);
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("tooltip")).toHaveText(OPEN_LAUNCHER_LABEL);
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        bodyOverflow:
          document.body.scrollWidth - document.documentElement.clientWidth,
        documentOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      })),
    )
    .toEqual({
      bodyOverflow: 0,
      documentOverflow: 0,
    });
  await launcher.click();
  await expect(page.getByRole("tooltip")).toBeHidden();
  await page.getByTestId("system-report-title").fill("다시 열어도 유지할 제목");
  await launcher.click();
  await launcher.click();
  await expect(page.getByTestId("system-report-title")).toHaveValue(
    "다시 열어도 유지할 제목",
  );

  await page.goto("/");
  const landingLoginLink = page.locator('header a[href="/login"]');
  await expect(landingLoginLink).toHaveCount(1);
  await landingLoginLink.click();
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  await expect(page.locator(".signup-prompt-layout--login")).toBeVisible();

  await openReport(page);
  await page
    .getByTestId("system-report-title")
    .fill("실제 화면 전환 후에도 유지할 제목");

  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.locator(".landing-layout-motion-root")).toBeVisible();
  await expect(page.getByTestId("system-report-launcher")).toHaveCount(0);

  await page.goForward();
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  await expect(page.locator(".signup-prompt-layout--login")).toBeVisible();
  await expect(page.getByTestId("system-report-launcher")).toHaveAttribute(
    "aria-label",
    CLOSE_LAUNCHER_LABEL,
  );
  await expect(page.getByTestId("system-report-title")).toHaveValue(
    "실제 화면 전환 후에도 유지할 제목",
  );
});

test("intercepted failure keeps values and reuses the idempotency key", async ({
  page,
}) => {
  const requests: Request[] = [];
  let attempt = 0;
  await page.route(REPORT_ROUTE, async (route) => {
    requests.push(route.request());
    attempt += 1;
    await route.fulfill({
      status: attempt === 1 ? 503 : 201,
      contentType: "application/json",
      body:
        attempt === 1
          ? JSON.stringify({ error: "service_unavailable" })
          : JSON.stringify({
              referenceCode: "SR-0123456789ABCDEF",
              createdAt: "2026-07-23T08:15:00.000Z",
            }),
    });
  });

  await page.goto("/terms");
  await openReport(page);
  await fillReport(page);
  await page.getByTestId("system-report-submit").click();

  await expect(
    page.getByTestId("system-report-form").locator(".ant-alert-error"),
  ).toBeVisible();
  await expect(page.getByTestId("system-report-title")).toHaveValue(
    "Playwright report",
  );
  await expect(page.getByTestId("system-report-message")).toHaveValue(
    "This request is intercepted locally and never reaches Supabase.",
  );

  await page.getByTestId("system-report-submit").click();
  await expect(page.getByTestId("system-report-success")).toBeVisible();
  expect(requests).toHaveLength(2);
  const firstKey = await requests[0].headerValue("idempotency-key");
  const secondKey = await requests[1].headerValue("idempotency-key");
  expect(firstKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(secondKey).toBe(firstKey);
});

test("intercepted success receives only coarse diagnostics and resets on close", async ({
  page,
}) => {
  const submittedBodies: Record<string, unknown>[] = [];
  await page.route(REPORT_ROUTE, async (route) => {
    submittedBodies.push(
      route.request().postDataJSON() as Record<string, unknown>,
    );
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        referenceCode: "SR-FEDCBA9876543210",
        createdAt: "2026-07-23T08:15:00.000Z",
      }),
    });
  });

  await page.goto("/terms?private=e2e-secret#details");
  await openReport(page);
  await fillReport(page);
  await page.getByTestId("system-report-submit").click();

  await expect(page.getByTestId("system-report-success")).toBeVisible();
  await expect(page.getByTestId("system-report-reference")).toHaveText(
    "SR-FEDCBA9876543210",
  );
  expect(submittedBodies).toHaveLength(1);
  const submittedBody = submittedBodies[0];
  expect(Object.keys(submittedBody.context as object).sort()).toEqual(
    [
      "browser",
      "deviceType",
      "locale",
      "os",
      "pathname",
      "viewportHeight",
      "viewportWidth",
    ].sort(),
  );
  expect(submittedBody.context).toMatchObject({ pathname: "/terms" });
  expect(JSON.stringify(submittedBody)).not.toContain("e2e-secret");
  expect(JSON.stringify(submittedBody)).not.toContain("Mozilla");

  await expect(
    page.getByTestId("system-report-success").getByRole("button"),
  ).toHaveCount(0);
  await page.getByTestId("system-report-launcher").click();
  await openReport(page);
  await expect(page.getByTestId("system-report-title")).toHaveValue("");
  await expect(page.getByTestId("system-report-message")).toHaveValue("");
});

for (const { name, viewport } of [
  { name: "short desktop", viewport: { width: 1280, height: 640 } },
  { name: "short mobile", viewport: { width: 390, height: 568 } },
]) {
  test(`@authenticated launcher and complete panel stay above the real fixed action bar on ${name}`, async ({
    page,
  }) => {
    test.skip(
      PUBLIC_READ_ONLY,
      "Authenticated fixed-action-bar coverage requires the local Supabase stack.",
    );
    await page.setViewportSize(viewport);
    await page.goto("/practice/next");
    await expect(page).toHaveURL((url) => url.pathname === "/practice/next");

    const fixedBar = page.getByTestId("next-selection-bar");
    await expect(fixedBar).toBeVisible();
    const launcher = page.getByTestId("system-report-launcher");
    await expect(launcher).toBeVisible();
    await expect
      .poll(async () => {
        const fixedBarBox = await fixedBar.boundingBox();
        const launcherBox = await launcher.boundingBox();
        if (!fixedBarBox || !launcherBox) return Number.NEGATIVE_INFINITY;
        return fixedBarBox.y - (launcherBox.y + launcherBox.height);
      })
      .toBeGreaterThanOrEqual(8);

    const fixedBarBox = await fixedBar.boundingBox();
    const launcherBox = await launcher.boundingBox();
    expect(fixedBarBox).not.toBeNull();
    expect(launcherBox).not.toBeNull();
    expect(
      (fixedBarBox?.y ?? 0) -
        ((launcherBox?.y ?? Number.POSITIVE_INFINITY) +
          (launcherBox?.height ?? 0)),
    ).toBeGreaterThanOrEqual(8);

    await launcher.click();
    const popover = page.locator(".app-system-report-popover.ant-popover");
    await expect(popover).toBeVisible();
    await expect(
      page.locator(".app-system-report-modal, .ant-modal"),
    ).toHaveCount(0);
    await expect(launcher).toHaveAttribute("aria-label", CLOSE_LAUNCHER_LABEL);
    await expect
      .poll(async () => {
        const currentFixedBarBox = await fixedBar.boundingBox();
        const currentPopoverBox = await popover.boundingBox();
        const currentLauncherBox = await launcher.boundingBox();
        if (!currentFixedBarBox || !currentPopoverBox || !currentLauncherBox) {
          return false;
        }
        return (
          currentPopoverBox.y >= 8 &&
          currentFixedBarBox.y -
            (currentPopoverBox.y + currentPopoverBox.height) >=
            8 &&
          currentLauncherBox.y -
            (currentPopoverBox.y + currentPopoverBox.height) >=
            8 &&
          currentLauncherBox.y + currentLauncherBox.height <= viewport.height
        );
      })
      .toBe(true);

    const popoverBox = await popover.boundingBox();
    const closeLauncherBox = await launcher.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(popoverBox?.y ?? -1).toBeGreaterThanOrEqual(8);
    expect(
      (popoverBox?.y ?? Number.POSITIVE_INFINITY) + (popoverBox?.height ?? 0),
    ).toBeLessThan((fixedBarBox?.y ?? 0) - 8);
    expect(closeLauncherBox).not.toBeNull();
    expect(
      (closeLauncherBox?.y ?? Number.NEGATIVE_INFINITY) -
        ((popoverBox?.y ?? Number.POSITIVE_INFINITY) +
          (popoverBox?.height ?? 0)),
    ).toBeGreaterThanOrEqual(8);
    expect(closeLauncherBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (closeLauncherBox?.y ?? 0) + (closeLauncherBox?.height ?? 0),
    ).toBeLessThanOrEqual(viewport.height);
  });
}
