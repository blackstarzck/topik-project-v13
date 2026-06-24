import { expect, test, type Page, type Route } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function fulfillRecover(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
    },
    body: "{}",
  });
}

async function gotoPasswordReset(page: Page, email?: string) {
  const path = email
    ? `/password-reset?email=${encodeURIComponent(email)}`
    : "/password-reset";

  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForPasswordResetHydration(page);
  if (email) {
    await expect(page.getByLabel("이메일")).toHaveValue(email);
  }
}

async function waitForPasswordResetHydration(page: Page) {
  await expect(page.getByTestId("password-reset-request-form")).toBeVisible();
  await page.waitForFunction(() => {
    const form = document.querySelector(
      '[data-testid="password-reset-request-form"]',
    );
    if (!form) return false;
    return [form, ...Array.from(form.querySelectorAll("button, input"))].some(
      (element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps$")),
    );
  });
}

test("X-06 password reset request renders prefilled email and confirms success", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.route(/\/auth\/v1\/recover(?:\?|$)/, fulfillRecover);

  await gotoPasswordReset(page, "member.audit@example.com");
  await expect(page).toHaveURL(/\/password-reset/);

  await expect(
    page.getByRole("heading", { name: "비밀번호 재설정" }),
  ).toBeVisible();
  const card = page.getByTestId("password-reset-request-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("password-reset-security-visual")).toHaveCount(
    0,
  );
  await expect(
    card.getByRole("heading", { name: "비밀번호 재설정" }),
  ).toBeVisible();
  await expect(card.getByTestId("password-reset-request-form")).toBeVisible();
  const guidance = card.getByTestId("password-reset-guidance");
  await expect(guidance).toContainText(
    "가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
  );
  await expect(guidance).toContainText("링크는 약 1시간 후 만료돼요");
  const guidanceLines = guidance.locator(".password-reset-guide__line");
  await expect(guidanceLines).toHaveCount(2);
  await expect(
    card
      .locator(".ant-form-item-extra")
      .getByTestId("password-reset-guidance"),
  ).toBeVisible();
  await expect(guidanceLines.first()).toHaveText(
    "가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
  );
  await expect(guidanceLines.nth(1)).toHaveText(
    "보안을 위해 링크는 약 1시간 후 만료돼요. 만료되면 이 화면에서 다시 보낼 수 있어요.",
  );
  const firstGuidanceLineBox = await guidanceLines.first().boundingBox();
  const secondGuidanceLineBox = await guidanceLines.nth(1).boundingBox();
  const emailInputBox = await page.getByLabel("이메일").boundingBox();
  expect(firstGuidanceLineBox).not.toBeNull();
  expect(secondGuidanceLineBox).not.toBeNull();
  expect(emailInputBox).not.toBeNull();
  expect(firstGuidanceLineBox!.y).toBeGreaterThanOrEqual(
    emailInputBox!.y + emailInputBox!.height,
  );
  expect(secondGuidanceLineBox!.y).toBeGreaterThan(firstGuidanceLineBox!.y);
  expect(
    secondGuidanceLineBox!.y -
      (firstGuidanceLineBox!.y + firstGuidanceLineBox!.height),
  ).toBeLessThanOrEqual(4);
  await expect(guidance).toHaveCSS("color", "rgb(113, 113, 122)");
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByLabel("이메일")).toHaveValue(
    "member.audit@example.com",
  );
  await expect(
    page.getByText(/링크는 약 1시간 후 만료돼요/),
  ).toBeVisible();
  const submitButton = card.getByRole("button", {
    name: "재설정 링크 보내기",
  });
  const loginLink = card.getByRole("link", { name: "로그인으로 돌아가기" });
  await expect(card.locator(".password-reset-card__header")).toHaveCSS(
    "margin-bottom",
    "64px",
  );
  await expect(card.locator(".password-reset-email-item")).toHaveCSS(
    "margin-bottom",
    "64px",
  );
  await expect(card.locator("label", { hasText: "이메일" })).toHaveCSS(
    "font-weight",
    "600",
  );
  await expect(
    loginLink,
  ).toHaveAttribute("href", "/login");
  await expect(loginLink).toHaveCSS("font-size", "16px");
  const submitBox = await submitButton.boundingBox();
  const loginBox = await loginLink.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(loginBox).not.toBeNull();
  expect(
    submitBox!.y - (secondGuidanceLineBox!.y + secondGuidanceLineBox!.height),
  ).toBeGreaterThanOrEqual(28);
  expect(loginBox!.y).toBeGreaterThan(submitBox!.y);

  await submitButton.click();

  await expect(page.getByTestId("password-reset-sent-state")).toBeVisible();
  await expect(page.getByText("이메일을 확인하세요")).toBeVisible();
  await expect(page.getByText("member.audit@example.com")).toBeVisible();
  await expect(page.getByTestId("password-reset-countdown")).toBeVisible();

  expect(errors).toEqual([]);
});

test("X-06 password reset refreshes without hydration errors", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await gotoPasswordReset(page, "refresh.audit@example.com");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPasswordResetHydration(page);
  await expect(page.getByLabel("이메일")).toHaveValue(
    "refresh.audit@example.com",
  );

  expect(errors).toEqual([]);
});

test("X-06 password reset keeps CTA pending while recover request is in flight", async ({
  page,
}) => {
  let releaseRecover: (() => void) | undefined;
  const recoverStarted = new Promise<void>((resolve) => {
    void page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route) => {
      resolve();
      await new Promise<void>((release) => {
        releaseRecover = release;
      });
      await fulfillRecover(route);
    });
  });

  await gotoPasswordReset(page, "pending.audit@example.com");
  const submitButton = page.getByRole("button", {
    name: "재설정 링크 보내기",
  });
  await submitButton.click();
  await recoverStarted;

  await expect(submitButton).toHaveClass(/ant-btn-loading/);
  await expect(submitButton).toBeDisabled();

  releaseRecover?.();
  await expect(page.getByTestId("password-reset-sent-state")).toBeVisible();
  await expect(page.getByText("pending.audit@example.com")).toBeVisible();
});

test("X-06 password reset shows fail state for provider rate limit", async ({
  page,
}) => {
  await page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        message: "Too many emails",
        msg: "Too many emails",
      }),
    });
  });

  await gotoPasswordReset(page, "limited.audit@example.com");
  const submitButton = page.getByRole("button", {
    name: "재설정 링크 보내기",
  });
  await submitButton.click();

  await expect(
    page.getByText("메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요."),
  ).toBeVisible();
  await expect(page.getByTestId("password-reset-countdown")).toBeVisible();
  await expect(submitButton).toBeDisabled();
  await expect(page.getByTestId("password-reset-sent-state")).toHaveCount(0);
});

test("X-06 password reset shows fail state for provider send failure", async ({
  page,
}) => {
  await page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({
        code: "unknown",
        message: "Recover failed",
        msg: "Recover failed",
      }),
    });
  });

  await gotoPasswordReset(page, "failed.audit@example.com");
  const submitButton = page.getByRole("button", {
    name: "재설정 링크 보내기",
  });
  await submitButton.click();

  await expect(page.getByText(/전송 실패/)).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await expect(page.getByTestId("password-reset-sent-state")).toHaveCount(0);
});

test("X-06 password reset shows error state for invalid email without calling provider", async ({
  page,
}) => {
  let recoverCalls = 0;
  await page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route) => {
    recoverCalls += 1;
    await fulfillRecover(route);
  });

  await gotoPasswordReset(page, "invalid.audit@example.com");
  await page.getByLabel("이메일").fill("not-an-email");
  await page.getByRole("button", { name: "재설정 링크 보내기" }).click();

  await expect(page.getByText("올바른 이메일 형식이 아닙니다")).toBeVisible();
  expect(recoverCalls).toBe(0);
  await expect(page.getByTestId("password-reset-sent-state")).toHaveCount(0);
});
