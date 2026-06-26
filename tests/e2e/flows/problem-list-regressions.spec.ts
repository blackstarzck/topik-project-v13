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
    // CI can provide the same env vars directly.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();

type StudentUser = {
  id: string;
};

type SaveBackFixture = {
  marker: string;
  problemId: string;
  title: string;
  userId: string;
};

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

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for problem-list e2e",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function getStudentUser(): Promise<StudentUser> {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);
  return { id: user.id };
}

function q51Materials(marker: string) {
  return {
    question_id: `e2e-problem-list-${marker}`,
    blank_target_giyeok: "행사 진행 순서",
    blank_target_nieun: "참가자 준비물",
    review: {
      validation: [`E2E draft state fixture ${marker}`],
    },
  };
}

function q51Rubric() {
  return {
    conditions: ["공지 흐름을 자연스럽게 완성한다."],
    criteria: ["내용 연결", "격식", "문장 정확성"],
  };
}

async function createSaveBackFixture(
  createdProblemIds: string[],
): Promise<SaveBackFixture> {
  const sb = serviceClient();
  const user = await getStudentUser();
  const marker = `e2e-draft-${randomUUID().slice(0, 8)}`;
  const problemId = randomUUID();
  const title = `E2E draft back state ${marker}`;
  const createdAt = new Date(Date.now() + 60_000).toISOString();

  const inserted = await sb.from("problems").insert({
    id: problemId,
    source: "curated",
    domain: "writing",
    question_no: 51,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt:
      "말하기 대회 운영팀이 참가자들에게 행사 준비 순서를 안내하는 공지이다. 빈칸에 알맞은 내용을 쓰십시오.",
    materials: q51Materials(marker),
    answer_key: null,
    rubric: q51Rubric(),
    tags: [marker, "e2e-draft-state"],
    publish_status: "published",
    review_status: "approved",
    visibility: "public",
    lifecycle_status: "active",
    created_at: createdAt,
    updated_at: createdAt,
  });
  if (inserted.error) throw inserted.error;
  createdProblemIds.push(problemId);

  return { marker, problemId, title, userId: user.id };
}

async function createSortFixture(createdProblemIds: string[]) {
  const sb = serviceClient();
  const marker = `e2e-sort-${randomUUID().slice(0, 8)}`;
  const idPrefix = randomUUID().slice(0, 8);
  const createdAt = new Date(Date.now() + 120_000).toISOString();
  const fixtures = [
    {
      id: `${idPrefix}-0000-4000-8000-000000000003`,
      suffix: "C",
    },
    {
      id: `${idPrefix}-0000-4000-8000-000000000001`,
      suffix: "A",
    },
    {
      id: `${idPrefix}-0000-4000-8000-000000000002`,
      suffix: "B",
    },
  ];

  const rows = fixtures.map((fixture) => ({
    id: fixture.id,
    source: "curated" as const,
    domain: "writing" as const,
    question_no: 51,
    topik_level: 2,
    difficulty: 3,
    title: `E2E sort stable ${marker} ${fixture.suffix}`,
    prompt:
      "정렬 안정성 확인을 위한 공개 쓰기 문제이다. 같은 생성 시각을 가진 문제들의 순서가 고정되어야 한다.",
    materials: q51Materials(marker),
    answer_key: null,
    rubric: q51Rubric(),
    tags: [marker, "e2e-sort-stability"],
    publish_status: "published" as const,
    review_status: "approved" as const,
    visibility: "public" as const,
    lifecycle_status: "active" as const,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  const inserted = await sb.from("problems").insert(rows);
  if (inserted.error) throw inserted.error;
  createdProblemIds.push(...rows.map((row) => row.id));

  return {
    marker,
    expectedTitlesById: rows
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => row.title),
  };
}

async function cleanupProblemListFixtures(createdProblemIds: string[]) {
  if (createdProblemIds.length === 0) return;
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;

  const sb = serviceClient();
  await sb.from("study_events").delete().in("problem_id", createdProblemIds);
  await sb
    .from("writing_submissions")
    .delete()
    .in("problem_id", createdProblemIds);
  await sb.from("writing_drafts").delete().in("problem_id", createdProblemIds);
  await sb.from("problems").delete().in("id", createdProblemIds);
  createdProblemIds.length = 0;
}

async function waitForSavedDraft(fixture: SaveBackFixture) {
  const sb = serviceClient();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const { data, error } = await sb
      .from("writing_drafts")
      .select("id")
      .eq("user_id", fixture.userId)
      .eq("problem_id", fixture.problemId)
      .neq("autosave_status", "superseded")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for saved draft: ${fixture.problemId}`);
}

function problemRow(page: Page, title: string) {
  return page.locator("tr").filter({ hasText: title }).first();
}

async function openFixtureFromProblemList(
  page: Page,
  fixture: SaveBackFixture,
) {
  const url = `/practice/problems?q=${encodeURIComponent(fixture.marker)}&sort=newest&page=1`;
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
      await expect(page.getByText(fixture.title)).toBeVisible({
        timeout: 3_000,
      });
      break;
    } catch {
      // The fixture is inserted immediately before navigation; retry the list
      // page only after the RPC response had a chance to update the UI.
    }
    await page.waitForTimeout(1_000);
  }

  await expect(page.getByText(fixture.title)).toBeVisible();

  const row = problemRow(page, fixture.title);
  await expect(row.locator(".problem-table__action-link")).toHaveCount(1);
  await row.locator(".problem-table__title").click();
  await expect(page).toHaveURL(
    new RegExp(`/writing/short-answer-writing-51.*${fixture.problemId}`),
  );
}

async function saveDraftOnWritingPage(page: Page, marker: string) {
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 15_000 });
  await textarea.fill(`저장 후 뒤로가기 회귀 테스트 ${marker}`);
  const save = page.locator(".writing-exam-header__save-button");
  await expect(save).toBeEnabled();
  await save.click();
}

async function expectProblemIsRetryable(page: Page, title: string) {
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  const row = problemRow(page, title);
  await expect(row.locator(".problem-table__action-link")).toHaveCount(0);
  await expect(
    row.locator("button.problem-table__action-button--secondary"),
  ).toBeVisible();
  await expect(row.locator(".problem-table__new-badge")).toHaveCount(0);
  await row.locator(".problem-table__title").click();
  await expect(page.getByTestId("retry-modal-compact-summary")).toBeVisible();
}

async function visibleProblemTitles(page: Page) {
  const titles = page.locator(".problem-table__title");
  await expect(titles.first()).toBeVisible({ timeout: 15_000 });
  return titles.allTextContents();
}

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "Problem list regression e2e requires Supabase service credentials",
);
test.skip(
  ENV_LABEL === "prod" || ENV_LABEL === "production",
  "Problem list regression e2e must not seed production data",
);

test("C-02 keeps deterministic newest order across repeated list_user_problems refetches", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  try {
    const fixture = await createSortFixture(createdProblemIds);

    await page.goto(
      `/practice/problems?q=${fixture.marker}&sort=newest&page=1`,
      {
        waitUntil: "domcontentloaded",
      },
    );
    await expect(page).not.toHaveURL(/\/login/);

    await expect
      .poll(() => visibleProblemTitles(page), {
        timeout: 15_000,
        message:
          "same created_at rows should use problem id as a stable tie-breaker",
      })
      .toEqual(fixture.expectedTitlesById);

    for (let i = 0; i < 3; i += 1) {
      const refetch = page
        .waitForResponse(
          (response) =>
            response.url().includes("/rest/v1/rpc/list_user_problems") &&
            response.status() === 200,
          { timeout: 10_000 },
        )
        .catch(() => null);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await refetch;
      await expect
        .poll(() => visibleProblemTitles(page))
        .toEqual(fixture.expectedTitlesById);
    }

    expect(errors).toEqual([]);
  } finally {
    await cleanupProblemListFixtures(createdProblemIds);
  }
});

test("C-02 -> writing save -> header back returns with retry state", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  try {
    const fixture = await createSaveBackFixture(createdProblemIds);

    await openFixtureFromProblemList(page, fixture);
    await saveDraftOnWritingPage(page, fixture.marker);
    await waitForSavedDraft(fixture);

    const listReload = page
      .waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/list_user_problems") &&
          response.status() === 200,
        { timeout: 15_000 },
      )
      .catch(() => null);
    await page.locator(".writing-exam-header__back").click();
    await expect(page).toHaveURL(/\/practice\/problems/);
    await listReload;
    await expectProblemIsRetryable(page, fixture.title);

    expect(errors).toEqual([]);
  } finally {
    await cleanupProblemListFixtures(createdProblemIds);
  }
});

test("C-02 -> writing save -> browser back returns with retry state", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  try {
    const fixture = await createSaveBackFixture(createdProblemIds);

    await openFixtureFromProblemList(page, fixture);
    await saveDraftOnWritingPage(page, fixture.marker);
    await waitForSavedDraft(fixture);
    await expect(page.getByTestId("autosave-warning-modal")).toHaveCount(0);
    await page.waitForTimeout(500);

    const listReload = page
      .waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/list_user_problems") &&
          response.status() === 200,
        { timeout: 15_000 },
      )
      .catch(() => null);
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(/\/practice\/problems/);
    await listReload;
    await expectProblemIsRetryable(page, fixture.title);

    expect(errors).toEqual([]);
  } finally {
    await cleanupProblemListFixtures(createdProblemIds);
  }
});
