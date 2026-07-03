import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
    // CI without .env.local will skip through the explicit env guard below.
  }
}

loadEnvLocal();

const SUPPORTED_PROJECTS = new Set(["mobile-360", "desktop-1280"]);
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();

// Fixture identity shared across the tests, seeded in beforeAll. Problem A has a
// draft (solve_state='attempted' -> retryable/secondary button); problem B has
// none (startable/primary button).
const createdProblemIds: string[] = [];
let retryMarker = "";
let retryableTitle = "";
let startableTitle = "";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for C-03 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function findStudentUser(sb: ReturnType<typeof serviceClient>) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  throw new Error(
    "E2E student user not found for E2E_STUDENT_EMAIL — run the setup project first and check .env.local",
  );
}

function q51Materials(marker: string) {
  return {
    question_id: `e2e-retry-modal-${marker}`,
    blank_target_giyeok: "행사 진행 순서",
    blank_target_nieun: "참가자 준비물",
    review: { validation: [`E2E retry modal fixture ${marker}`] },
  };
}

function q51Rubric() {
  return {
    conditions: ["공지 흐름을 자연스럽게 완성한다."],
    criteria: ["내용 연결", "격식", "문장 정확성"],
  };
}

// Navigate to the problem list scoped to the fixture marker and wait for the
// list_user_problems RPC to settle, retrying because the fixture is inserted
// immediately before the first navigation (mirrors problem-list-regressions).
async function goToMarkerList(page: Page, confirmTitle: string) {
  const url = `/practice/problems?q=${encodeURIComponent(retryMarker)}&sort=newest&page=1`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const listResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/list_user_problems") &&
          response.status() === 200,
        { timeout: 10_000 },
      )
      .catch(() => null);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await listResponse;
    try {
      await expect(page.getByText(confirmTitle)).toBeVisible({
        timeout: 3_000,
      });
      return;
    } catch {
      // RPC had not refreshed the UI yet; retry the scoped list page.
    }
    await page.waitForTimeout(1_000);
  }
  await expect(page.getByText(confirmTitle)).toBeVisible();
}

async function expectFocusInModalLayer(page: Page) {
  const focusInsideModalLayer = await page.evaluate(() => {
    const modalRoot = document.querySelector(".ant-modal-root");
    return !!modalRoot?.contains(document.activeElement);
  });
  expect(focusInsideModalLayer).toBe(true);
}

async function ensureRetryableProblem(page: Page) {
  await goToMarkerList(page, retryableTitle);
  const row = page.locator("tr").filter({ hasText: retryableTitle }).first();
  await expect(
    row.locator(".problem-table__action-button--secondary"),
  ).toBeVisible({ timeout: 15_000 });
  return row;
}

async function ensureStartableProblemRow(page: Page) {
  await goToMarkerList(page, startableTitle);
  const row = page
    .locator("tr.problem-table__row--selectable", {
      has: page.locator(".problem-table__action-button--primary"),
    })
    .filter({ hasText: startableTitle })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
}

async function openRetryModal(page: Page) {
  const row = await ensureRetryableProblem(page);
  await row.locator(".problem-table__action-button--secondary").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("이전 풀이가 있어요")).toBeVisible();
  return dialog;
}

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "C-03 retry-modal e2e requires Supabase service credentials to seed a retryable problem",
);
test.skip(
  ENV_LABEL === "prod" || ENV_LABEL === "production",
  "C-03 retry-modal e2e must not seed production data",
);

test.describe("C-03 retry modal", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !SUPPORTED_PROJECTS.has(testInfo.project.name),
      "C-03 modal is verified on mobile and desktop only.",
    );
  });

  test.beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;

    const sb = serviceClient();
    const user = await findStudentUser(sb);
    retryMarker = `e2e-retry-${randomUUID().slice(0, 8)}`;
    retryableTitle = `E2E retry modal ${retryMarker} A`;
    startableTitle = `E2E retry modal ${retryMarker} B`;
    const createdAt = new Date(Date.now() + 60_000).toISOString();
    const problemA = randomUUID();
    const problemB = randomUUID();
    const prompt =
      "말하기 대회 운영팀이 참가자들에게 행사 준비 순서를 안내하는 공지이다. 빈칸에 알맞은 내용을 쓰십시오.";

    const problemRowBase = {
      source: "curated" as const,
      domain: "writing" as const,
      question_no: 51,
      topik_level: 2,
      difficulty: 3,
      prompt,
      materials: q51Materials(retryMarker),
      answer_key: null,
      rubric: q51Rubric(),
      tags: [retryMarker, "e2e-retry-modal"],
      publish_status: "published" as const,
      review_status: "approved" as const,
      visibility: "public" as const,
      lifecycle_status: "active" as const,
      created_at: createdAt,
      updated_at: createdAt,
    };

    const insertedProblems = await sb.from("problems").insert([
      { id: problemA, title: retryableTitle, ...problemRowBase },
      { id: problemB, title: startableTitle, ...problemRowBase },
    ]);
    if (insertedProblems.error) throw insertedProblems.error;
    createdProblemIds.push(problemA, problemB);

    // Non-superseded draft with no submission -> solve_state='attempted', which
    // renders the secondary "다시 풀기" button and defaults the modal to resume.
    const answerText = `이전 풀이 임시 저장 ${retryMarker}`;
    const draft = await sb.from("writing_drafts").insert({
      user_id: user.id,
      problem_id: problemA,
      question_no: 51,
      answer_text: answerText,
      char_count: answerText.length,
      autosave_status: "dirty",
      last_saved_at: createdAt,
    });
    if (draft.error) throw draft.error;
  });

  test.afterAll(async () => {
    if (createdProblemIds.length === 0) return;
    if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;
    const sb = serviceClient();
    await sb
      .from("writing_drafts")
      .delete()
      .in("problem_id", createdProblemIds);
    await sb
      .from("writing_submissions")
      .delete()
      .in("problem_id", createdProblemIds);
    await sb.from("study_events").delete().in("problem_id", createdProblemIds);
    await sb.from("problems").delete().in("id", createdProblemIds);
    createdProblemIds.length = 0;
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

  test("selecting a startable problem row opens the writing route", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const row = await ensureStartableProblemRow(page);

    await row.locator(".problem-table__title").click();

    await expect(page).toHaveURL(/\/writing\/.*[?&]problem=/, {
      timeout: 15_000,
    });
    expect(errors).toEqual([]);
  });

  test("cancel closes to problem list and start opens the selected writing route", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const row = await ensureRetryableProblem(page);
    const retryButton = row.locator(".problem-table__action-button--secondary");
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
