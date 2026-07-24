import { expect, test, type Page, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  classifySupabaseRestRequest,
  hasTrackedRequestsSettled,
  isTrackedRuntimeUrl,
  isUnexpectedTrackedResponse,
  selectCanonicalProblemId,
  shouldCollectRuntimeConsoleError,
  type WritingComposerQuestionNo,
  type WritingComposerRuntimeOrigins,
} from "../support/writing-composer-runtime";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL?.trim();
const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD?.trim() ||
  process.env.SUPABASE_TEST_PASSWORD?.trim();

type WritingComposerCase = {
  label: "Q53" | "Q54";
  questionNo: WritingComposerQuestionNo;
  route: string;
  path: RegExp;
  heading: RegExp;
  writePanelTestId: string;
  manuscriptPanelTestId: string;
};

const CASES: WritingComposerCase[] = [
  {
    label: "Q53",
    questionNo: 53,
    route: "/writing/long-form-writing-53",
    path: /\/writing\/long-form-writing-53/,
    heading: /53번/,
    writePanelTestId: "q53-composer-write-panel",
    manuscriptPanelTestId: "q53-composer-manuscript-panel",
  },
  {
    label: "Q54",
    questionNo: 54,
    route: "/writing/essay-writing-54",
    path: /\/writing\/essay-writing-54/,
    heading: /54번/,
    writePanelTestId: "q54-composer-write-panel",
    manuscriptPanelTestId: "q54-composer-manuscript-panel",
  },
];

function collectRuntimeFailures(
  page: Page,
  origins: WritingComposerRuntimeOrigins,
) {
  const failures: string[] = [];
  const pendingRequests = new Set<Request>();
  let lastActivityAt = Date.now();

  const requestLabel = (request: Request) => {
    const url = new URL(request.url());
    return `${request.method()} ${url.origin}${url.pathname}`;
  };

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      shouldCollectRuntimeConsoleError(message.location().url, origins)
    ) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("request", (request) => {
    if (isTrackedRuntimeUrl(request.url(), origins)) {
      lastActivityAt = Date.now();
      pendingRequests.add(request);
    }
  });
  page.on("requestfinished", (request) => {
    if (isTrackedRuntimeUrl(request.url(), origins)) {
      lastActivityAt = Date.now();
      pendingRequests.delete(request);
    }
  });
  page.on("requestfailed", (request) => {
    if (!isTrackedRuntimeUrl(request.url(), origins)) return;
    lastActivityAt = Date.now();
    pendingRequests.delete(request);
    failures.push(
      `requestfailed: ${requestLabel(request)} ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (
      isUnexpectedTrackedResponse(response.url(), response.status(), origins)
    ) {
      failures.push(
        `response: ${response.status()} ${requestLabel(response.request())}`,
      );
    }
  });

  return {
    failures,
    async waitForSettled() {
      await expect
        .poll(
          () =>
            hasTrackedRequestsSettled(
              pendingRequests.size,
              lastActivityAt,
              Date.now(),
            ),
          {
            message:
              "application requests should settle and remain quiet before error review",
          },
        )
        .toBe(true);
    },
  };
}

async function installSupabaseRestMutationGuard(
  page: Page,
  origins: WritingComposerRuntimeOrigins,
  failures: string[],
) {
  await page.route(`${origins.supabaseOrigin}/rest/v1/**`, async (route) => {
    const request = route.request();
    const classification = classifySupabaseRestRequest(
      request.url(),
      request.method(),
      origins.supabaseOrigin,
    );

    if (classification === "continue") {
      await route.continue();
      return;
    }

    if (classification === "block-unexpected-mutation") {
      failures.push(
        `unexpected mutation blocked: ${request.method()} ${new URL(request.url()).pathname}`,
      );
    }

    await route.fulfill({
      body: "[]",
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": origins.appOrigin,
      },
      status: classification === "fulfill-expected-analytics" ? 201 : 200,
    });
  });
}

test.describe("writing composer mode", () => {
  test.describe.configure({ retries: 0 });

  let canonicalProblemIds: Record<WritingComposerQuestionNo, string>;
  let supabaseOrigin: string;

  test.beforeAll(async () => {
    if (
      !SUPABASE_URL ||
      !PUBLISHABLE_KEY ||
      !STUDENT_EMAIL ||
      !STUDENT_PASSWORD
    ) {
      throw new Error(
        "writing composer mode e2e requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, E2E_STUDENT_EMAIL, and E2E_STUDENT_PASSWORD or SUPABASE_TEST_PASSWORD.",
      );
    }

    try {
      supabaseOrigin = new URL(SUPABASE_URL).origin;
    } catch {
      throw new Error(
        "writing composer mode e2e requires a valid NEXT_PUBLIC_SUPABASE_URL.",
      );
    }

    const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const signIn = await client.auth.signInWithPassword({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });
    if (signIn.error) {
      throw new Error(
        `writing composer mode e2e student sign-in failed: ${signIn.error.message}`,
      );
    }
    if (!signIn.data.user || !signIn.data.session) {
      throw new Error(
        "writing composer mode e2e student sign-in returned no authenticated session.",
      );
    }

    const problemIds = {} as Record<WritingComposerQuestionNo, string>;

    for (const questionNo of [51, 52, 53, 54] as const) {
      const { data, error } = await client.rpc(
        "get_available_writing_questions",
        {
          p_item_number: questionNo,
          p_problem_id: null,
        },
      );
      if (error) {
        throw new Error(
          `Canonical Q${questionNo} writing sample query failed: ${error.message}`,
        );
      }
      problemIds[questionNo] = selectCanonicalProblemId(data, questionNo);
    }

    canonicalProblemIds = problemIds;
  });

  for (const writingCase of CASES) {
    test(`${writingCase.label} switches write to manuscript and back before input`, async ({
      page,
      baseURL,
    }) => {
      const configuredAppUrl = baseURL ?? process.env.E2E_BASE_URL;
      if (!configuredAppUrl) {
        throw new Error(
          "writing composer mode e2e requires Playwright baseURL or E2E_BASE_URL.",
        );
      }
      const origins = {
        appOrigin: new URL(configuredAppUrl).origin,
        supabaseOrigin,
      };
      const runtime = collectRuntimeFailures(page, origins);
      await installSupabaseRestMutationGuard(page, origins, runtime.failures);
      const problemId = canonicalProblemIds[writingCase.questionNo];
      const route = `${writingCase.route}?problem=${encodeURIComponent(problemId)}&fresh=1`;

      const response = await page.goto(route, {
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

  test("Q51 keeps only the character count above the answer field", async ({
    page,
    baseURL,
  }) => {
    const configuredAppUrl = baseURL ?? process.env.E2E_BASE_URL;
    if (!configuredAppUrl) {
      throw new Error(
        "writing composer mode e2e requires Playwright baseURL or E2E_BASE_URL.",
      );
    }
    const origins = {
      appOrigin: new URL(configuredAppUrl).origin,
      supabaseOrigin,
    };
    const runtime = collectRuntimeFailures(page, origins);
    await installSupabaseRestMutationGuard(page, origins, runtime.failures);

    const response = await page.goto(
      `/writing/short-answer-writing-51?problem=${encodeURIComponent(canonicalProblemIds[51])}&fresh=1`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBeLessThan(400);

    const workspace = page.locator(".writing-workspace--q51");
    await expect(workspace).toBeVisible();
    const tabs = workspace.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    const answerHead = workspace.locator(".writing-answer-card__head");
    await expect(answerHead).toContainText(/0\s*\/\s*\d+/u);
    await expect(answerHead.locator(".ant-typography-strong")).toHaveCount(0);
    await expect(workspace.locator(".writing-answer-card__hint")).toHaveCount(
      0,
    );

    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(answerHead).toContainText(/0\s*\/\s*\d+/u);
    await expect(answerHead.locator(".ant-typography-strong")).toHaveCount(0);

    await runtime.waitForSettled();
    expect(runtime.failures).toEqual([]);
  });

  test("Q52 uses blank-specific guidance without generic connector examples", async ({
    page,
    baseURL,
  }) => {
    const configuredAppUrl = baseURL ?? process.env.E2E_BASE_URL;
    if (!configuredAppUrl) {
      throw new Error(
        "writing composer mode e2e requires Playwright baseURL or E2E_BASE_URL.",
      );
    }
    const origins = {
      appOrigin: new URL(configuredAppUrl).origin,
      supabaseOrigin,
    };
    const runtime = collectRuntimeFailures(page, origins);
    await installSupabaseRestMutationGuard(page, origins, runtime.failures);

    const response = await page.goto(
      `/writing/answer-writing-52?problem=${encodeURIComponent(canonicalProblemIds[52])}&fresh=1`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBeLessThan(400);

    const workspace = page.locator(".writing-workspace--q52");
    await expect(workspace).toBeVisible();
    await runtime.waitForSettled();
    for (const genericExpression of [
      "이에 따라",
      "반면에",
      "또한",
      "예를 들어",
      "결과적으로",
    ]) {
      await expect(
        workspace.getByText(genericExpression, { exact: true }),
      ).toHaveCount(0);
    }

    const tabs = workspace.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    const answerHead = workspace.locator(".writing-answer-card__head");
    await expect(answerHead).toContainText(/0\s*\/\s*160/u);
    await expect(answerHead.locator(".ant-typography-strong")).toHaveCount(0);
    await expect(workspace.locator(".writing-answer-card__hint")).toHaveCount(
      0,
    );
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(answerHead).toContainText(/0\s*\/\s*160/u);
    await expect(answerHead.locator(".ant-typography-strong")).toHaveCount(0);

    await runtime.waitForSettled();
    expect(runtime.failures).toEqual([]);
  });

  test("Q54 keeps the canonical prompt and its three tasks in one problem card", async ({
    page,
    baseURL,
  }) => {
    const configuredAppUrl = baseURL ?? process.env.E2E_BASE_URL;
    if (!configuredAppUrl) {
      throw new Error(
        "writing composer mode e2e requires Playwright baseURL or E2E_BASE_URL.",
      );
    }
    const origins = {
      appOrigin: new URL(configuredAppUrl).origin,
      supabaseOrigin,
    };
    const runtime = collectRuntimeFailures(page, origins);
    await installSupabaseRestMutationGuard(page, origins, runtime.failures);

    const response = await page.goto(
      `/writing/essay-writing-54?problem=${encodeURIComponent(canonicalProblemIds[54])}&fresh=1`,
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBeLessThan(400);

    const prompt = page.locator(".writing-question-prompt").first();
    await expect(prompt).toBeVisible();
    await expect(prompt).not.toContainText("1)");
    await expect(prompt).not.toContainText("2)");
    await expect(prompt).not.toContainText("3)");
    const promptCard = prompt.locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ant-card ')][1]",
    );
    const questions = promptCard.locator("ol.writing-question-task-list > li");
    await expect(questions).toHaveCount(3);
    await expect(questions.nth(0)).not.toBeEmpty();
    await expect(questions.nth(1)).not.toBeEmpty();
    await expect(questions.nth(2)).not.toBeEmpty();
    await expect(promptCard.locator("ol.writing-question-task-list")).toHaveCSS(
      "list-style-type",
      "decimal",
    );
    await expect(promptCard.getByText("주제", { exact: true })).toHaveCount(0);
    await expect(promptCard.getByText("배경", { exact: true })).toHaveCount(0);
    await expect(
      promptCard.getByText("필수 포함 조건", { exact: true }),
    ).toHaveCount(0);

    await runtime.waitForSettled();
    expect(runtime.failures).toEqual([]);
  });
});
