import { expect, test, type Page, type Request } from "@playwright/test";

type WritingComposerCase = {
  label: "Q53" | "Q54";
  route: string;
  path: RegExp;
  heading: RegExp;
  writePanelTestId: string;
  manuscriptPanelTestId: string;
};

const CASES: WritingComposerCase[] = [
  {
    label: "Q53",
    route: "/writing/long-form-writing-53?fresh=1",
    path: /\/writing\/long-form-writing-53/,
    heading: /53번/,
    writePanelTestId: "q53-composer-write-panel",
    manuscriptPanelTestId: "q53-composer-manuscript-panel",
  },
  {
    label: "Q54",
    route: "/writing/essay-writing-54?fresh=1",
    path: /\/writing\/essay-writing-54/,
    heading: /54번/,
    writePanelTestId: "q54-composer-write-panel",
    manuscriptPanelTestId: "q54-composer-manuscript-panel",
  },
];

function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  const pendingRequests = new Set<Request>();

  const shouldTrackRequest = (request: Request) => {
    const url = new URL(request.url());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "www.google-analytics.com"
    );
  };

  const requestLabel = (request: Request) => {
    const url = new URL(request.url());
    return `${request.method()} ${url.origin}${url.pathname}`;
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("request", (request) => {
    if (shouldTrackRequest(request)) pendingRequests.add(request);
  });
  page.on("requestfinished", (request) => {
    pendingRequests.delete(request);
  });
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request);
    if (!shouldTrackRequest(request)) return;
    failures.push(
      `requestfailed: ${requestLabel(request)} ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push(
        `response: ${response.status()} ${requestLabel(response.request())}`,
      );
    }
  });

  return {
    failures,
    async waitForSettled() {
      await page.waitForLoadState("networkidle");
      await expect
        .poll(() => pendingRequests.size, {
          message: "application requests should settle before error review",
        })
        .toBe(0);
    },
  };
}

test.describe("writing composer mode", () => {
  test.describe.configure({ retries: 0 });

  for (const writingCase of CASES) {
    test(`${writingCase.label} switches write to manuscript and back before input`, async ({
      page,
    }) => {
      const runtime = collectRuntimeFailures(page);

      const response = await page.goto(writingCase.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(writingCase.path);
      await expect(
        page.getByRole("heading", { name: writingCase.heading }).first(),
      ).toBeVisible();

      const composer = page.locator(".writing-composer-card");
      const writeMode = composer.getByRole("radio", { name: "쓰기" });
      const manuscriptMode = composer.getByRole("radio", { name: "원고지" });
      const modeTestIdPrefix = writingCase.label.toLowerCase();
      const writeModeLabel = composer.getByTestId(
        `${modeTestIdPrefix}-composer-mode-write`,
      );
      const manuscriptModeLabel = composer.getByTestId(
        `${modeTestIdPrefix}-composer-mode-manuscript`,
      );
      const writePanel = page.getByTestId(writingCase.writePanelTestId);
      const manuscriptPanel = page.getByTestId(
        writingCase.manuscriptPanelTestId,
      );
      const answerTextbox = writePanel.getByRole("textbox");

      await expect(writeMode).toBeChecked();
      await expect(manuscriptMode).not.toBeChecked();
      await expect(writePanel).toBeVisible();
      await expect(manuscriptPanel).toHaveCount(0);
      await expect(answerTextbox).toHaveCount(1);
      await expect(answerTextbox).toHaveValue("");

      await manuscriptModeLabel.click();
      await expect(manuscriptMode).toBeChecked();
      await expect(writeMode).not.toBeChecked();
      await expect(manuscriptPanel).toBeVisible();
      await expect(writePanel).toHaveCount(0);
      await expect(
        manuscriptPanel.getByTestId("manuscript-preview-grid"),
      ).toBeVisible();
      const manuscriptCells = manuscriptPanel.getByTestId(
        "manuscript-preview-cell",
      );
      await expect(manuscriptCells.first()).toBeVisible();
      await expect(manuscriptCells.filter({ hasText: /\S/u })).toHaveCount(0);

      await writeModeLabel.click();
      await expect(writeMode).toBeChecked();
      await expect(manuscriptMode).not.toBeChecked();
      await expect(writePanel).toBeVisible();
      await expect(manuscriptPanel).toHaveCount(0);
      await expect(answerTextbox).toHaveValue("");

      await expect(
        page.locator(".writing-exam-header__submit-button"),
      ).toBeDisabled();
      await runtime.waitForSettled();
      expect(runtime.failures).toEqual([]);
    });
  }
});
