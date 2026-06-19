import { expect, test, type Page } from "@playwright/test";

const SUPPORTED_PROJECTS = new Set(["mobile-360", "desktop-1280"]);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function expectFocusInModalLayer(page: Page) {
  const focusInsideModalLayer = await page.evaluate(() => {
    const modalRoot = document.querySelector(".ant-modal-root");
    return !!modalRoot?.contains(document.activeElement);
  });
  expect(focusInsideModalLayer).toBe(true);
}

async function ensureRetryableProblem(page: Page) {
  await page.goto("/practice/problems", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page.locator(".problem-table__action-button--secondary").first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function openRetryModal(page: Page) {
  await ensureRetryableProblem(page);
  await page
    .locator(".problem-table__action-button--secondary")
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("이전 풀이가 있어요")).toBeVisible();
  return dialog;
}

test.describe("C-03 retry modal", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !SUPPORTED_PROJECTS.has(testInfo.project.name),
      "C-03 modal is verified on mobile and desktop only.",
    );
  });

  test("matches description layout constraints and disabled hint mode", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const dialog = await openRetryModal(page);
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
    const viewport = page.viewportSize()!;
    const centerDeltaX = Math.abs(
      dialogBox!.x + dialogBox!.width / 2 - viewport.width / 2,
    );
    const centerDeltaY = Math.abs(
      dialogBox!.y + dialogBox!.height / 2 - viewport.height / 2,
    );
    expect(centerDeltaX).toBeLessThanOrEqual(2);
    expect(centerDeltaY).toBeLessThanOrEqual(2);

    await expect(page.locator(".ant-modal-mask")).toBeVisible();
    await expect(page.locator(".ant-modal-centered")).toBeVisible();
    await expect(page.locator(".app-modal--center-origin")).toHaveCount(1);
    const modalTransformOrigin = await page
      .locator(".ant-modal")
      .evaluate((element) => {
        const [originX, originY] = getComputedStyle(element)
          .transformOrigin.split(" ")
          .map((value) => Number.parseFloat(value));
        return {
          originX,
          originY,
          width: element instanceof HTMLElement ? element.offsetWidth : 0,
          height: element instanceof HTMLElement ? element.offsetHeight : 0,
        };
      });
    expect(
      Math.abs(modalTransformOrigin.originX - modalTransformOrigin.width / 2),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(modalTransformOrigin.originY - modalTransformOrigin.height / 2),
    ).toBeLessThanOrEqual(1);
    const bodyOverflowY = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).overflowY);
    expect(bodyOverflowY).toBe("hidden");

    const summary = page.getByTestId("retry-modal-compact-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveClass(/ant-descriptions/);
    await expect(summary).toHaveClass(/ant-descriptions-bordered/);
    await expect(summary.locator(".ant-descriptions-item-label")).toHaveCount(
      3,
    );
    await expect(summary.locator(".ant-descriptions-item-content")).toHaveCount(
      3,
    );
    await expect(summary.getByText("문제")).toBeVisible();
    await expect(summary.getByText("유형")).toBeVisible();
    await expect(summary.getByText("이전 상태")).toBeVisible();
    await expect(summary.getByText(/54번|53번|52번|51번/)).toBeVisible();
    await expect(
      summary.getByText(/작성 중|제출 완료|기록 없음/),
    ).toBeVisible();

    const radios = dialog.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(
      dialog.getByRole("radio", { name: /새 답안으로 시작/ }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: /이전 답안 이어서/ }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("radio", { name: /힌트 포함/ }),
    ).toBeDisabled();

    const footer = page.getByTestId("retry-modal-actions");
    await expect(footer).toHaveClass(/app-modal-footer-actions/);
    await expect
      .poll(async () =>
        footer.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).marginTop),
        ),
      )
      .toBeGreaterThanOrEqual(24);
    await expect(footer.getByRole("button")).toHaveCount(2);
    await expect(footer.getByRole("button", { name: "취소" })).toBeVisible();
    await expect(footer.getByRole("button", { name: "시작" })).toBeEnabled();

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      await expectFocusInModalLayer(page);
    }
    await page.keyboard.press("Shift+Tab");
    await expectFocusInModalLayer(page);
    expect(errors).toEqual([]);
  });

  test("cancel closes to problem list and start opens the selected writing route", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await ensureRetryableProblem(page);
    const retryButton = page
      .locator(".problem-table__action-button--secondary")
      .first();
    await retryButton.click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page
      .getByTestId("retry-modal-actions")
      .getByRole("button", {
        name: "취소",
      })
      .click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/practice\/problems/);

    await retryButton.click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: /새 답안으로 시작/ }).click();
    await page
      .getByTestId("retry-modal-actions")
      .getByRole("button", {
        name: "시작",
      })
      .click();
    await expect(page).toHaveURL(/\/writing\/.*[?&]problem=/);
    await expect(page).toHaveURL(/[?&]fresh=1/);
    await expect(page).not.toHaveURL(/[?&]hint=1/);
    expect(errors).toEqual([]);
  });

  test("supports Escape and mask dismissal before a risky start state", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    let dialog = await openRetryModal(page);
    await dialog.focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    dialog = await openRetryModal(page);
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });
});
