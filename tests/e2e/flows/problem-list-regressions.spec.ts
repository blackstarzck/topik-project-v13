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
const PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const REMOTE_FIXTURE_SYNC_TIMEOUT_MS = 60_000;

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
  page.on("pageerror", (error) => {
    if (isRecoverableDevChunkError(error.message)) return;
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      msg.type() === "error" &&
      !text.startsWith("Failed to load resource:")
    ) {
      errors.push(`console: ${text}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

function isRecoverableDevChunkError(message: string) {
  return message.includes("Failed to load chunk /_next/static/chunks/");
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createSaveBackFixture(
  createdProblemIds: string[],
): Promise<SaveBackFixture> {
  const sb = serviceClient();
  const user = await getStudentUser();
  const marker = `e2e-draft-${randomUUID().slice(0, 8)}`;
  const problemId = randomUUID();
  const title = `E2E draft back state ${marker}`;
  const createdAt = new Date(Date.now() - 60_000).toISOString();

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

type VisibleProblemRpcRow = {
  problem_id: string;
  title: string;
  tags?: string[] | null;
};

function hasE2EOrSeedTag(row: VisibleProblemRpcRow) {
  return (row.tags ?? []).some(
    (tag) => tag.startsWith("seed:") || tag.startsWith("e2e-"),
  );
}

async function cleanupUserProblemState(userId: string, problemIds: string[]) {
  if (problemIds.length === 0) return;
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;

  const sb = serviceClient();
  await sb
    .from("study_events")
    .delete()
    .eq("user_id", userId)
    .in("problem_id", problemIds);
  await sb
    .from("library_items")
    .delete()
    .eq("user_id", userId)
    .in("problem_id", problemIds);
  await sb
    .from("writing_submissions")
    .delete()
    .eq("user_id", userId)
    .in("problem_id", problemIds);
  await sb
    .from("writing_drafts")
    .delete()
    .eq("user_id", userId)
    .in("problem_id", problemIds);
}

async function createStableSaveBackFixture(): Promise<SaveBackFixture> {
  const user = await getStudentUser();
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !PASSWORD) {
    throw new Error(
      "Problem-list e2e requires Supabase URL, publishable key, and e2e password",
    );
  }

  const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (auth.error) throw auth.error;

  const { data, error } = await sb.rpc("list_user_problems", {
    filter: { question_no: 51 },
    sort: "newest",
    page: 1,
    page_size: 20,
  });
  if (error) throw error;

  const rows = ((data as VisibleProblemRpcRow[] | null) ?? []).filter(
    (row) => row.problem_id && row.title && !hasE2EOrSeedTag(row),
  );
  const selected = rows[0];
  if (!selected) {
    throw new Error("No stable visible 51 writing problem found for e2e");
  }

  await cleanupUserProblemState(user.id, [selected.problem_id]);

  return {
    marker: selected.title.slice(0, 40),
    problemId: selected.problem_id,
    title: selected.title,
    userId: user.id,
  };
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
  await sb.from("library_items").delete().in("problem_id", createdProblemIds);
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

async function getSavedProblemItemId(fixture: SaveBackFixture) {
  const sb = serviceClient();
  const { data, error } = await sb
    .from("library_items")
    .select("id")
    .eq("user_id", fixture.userId)
    .eq("item_type", "problem")
    .eq("problem_id", fixture.problemId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function waitForSavedProblem(fixture: SaveBackFixture) {
  await expect
    .poll(() => getSavedProblemItemId(fixture), {
      timeout: 15_000,
      message: `saved problem library item should exist: ${fixture.problemId}`,
    })
    .not.toBeNull();
}

async function expectProblemNotSaved(fixture: SaveBackFixture) {
  await expect
    .poll(() => getSavedProblemItemId(fixture), {
      timeout: 2_000,
      message: `temporary draft save must not create a saved problem item: ${fixture.problemId}`,
    })
    .toBeNull();
}

async function waitForUnsavedProblem(fixture: SaveBackFixture) {
  await expect
    .poll(() => getSavedProblemItemId(fixture), {
      timeout: 15_000,
      message: `saved problem library item should be removed: ${fixture.problemId}`,
    })
    .toBeNull();
}

function problemRow(page: Page, title: string) {
  return page.locator("tr").filter({ hasText: title }).first();
}

async function completePostLoginGates(page: Page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const pathname = new URL(page.url()).pathname;
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/practice") ||
      pathname.startsWith("/library") ||
      pathname.startsWith("/writing")
    ) {
      return;
    }
    if (pathname === "/auth/consent") {
      await page.locator('input[name="accept"]').check({ force: true });
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL((url) => new URL(url).pathname !== "/login", {
        timeout: 15_000,
      });
      continue;
    }
    if (pathname === "/onboarding/learning-goal") {
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL((url) => new URL(url).pathname !== "/login", {
        timeout: 15_000,
      });
      return;
    }
    await page.waitForLoadState("networkidle");
  }
  await expect(page).not.toHaveURL(/\/login/);
}

async function signInStudent(page: Page) {
  if (!PASSWORD) {
    throw new Error(
      "E2E_STUDENT_PASSWORD or SUPABASE_TEST_PASSWORD must be set for problem-list e2e auth refresh",
    );
  }

  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    if (
      (await emailInput.inputValue()) === EMAIL &&
      (await passwordInput.inputValue()) === PASSWORD
    ) {
      break;
    }
    await page.waitForTimeout(150);
  }
  await expect(emailInput).toHaveValue(EMAIL);
  await expect(passwordInput).toHaveValue(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => new URL(url).pathname !== "/login", {
    timeout: 30_000,
  });
  await completePostLoginGates(page);
}

async function ensureAuthedRoute(page: Page, url: string) {
  if (new URL(page.url()).pathname !== "/login") {
    await expect(page).not.toHaveURL(/\/login/);
    return false;
  }

  await signInStudent(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  return true;
}

async function openFixtureProblemList(
  page: Page,
  fixture: SaveBackFixture,
) {
  const url = `/practice/problems?q=${encodeURIComponent(fixture.marker)}&sort=newest&page=1`;
  const deadline = Date.now() + REMOTE_FIXTURE_SYNC_TIMEOUT_MS;
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
    if (await ensureAuthedRoute(page, url)) {
      await page.waitForTimeout(500);
      continue;
    }
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
  await expect(row).toBeVisible();
  return row;
}

async function openFixtureFromProblemList(
  page: Page,
  fixture: SaveBackFixture,
) {
  const row = await openFixtureProblemList(page, fixture);
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
  await expect(save).toContainText(/임시 저장|Save draft|Lưu nháp/);
  await save.click();
}

async function expectProblemIsRetryable(page: Page, title: string) {
  const deadline = Date.now() + REMOTE_FIXTURE_SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await expect(page.getByText(title)).toBeVisible({ timeout: 3_000 });
      break;
    } catch {
      // These e2e fixtures are inserted immediately before navigation against a
      // remote Supabase project. If browser history restoration hits a replica
      // that has not caught up yet, reload the current list URL and poll again.
      const currentListUrl = page.url();
      await page.reload({ waitUntil: "domcontentloaded" });
      await ensureAuthedRoute(page, currentListUrl);
    }
  }

  await expect(page.getByText(title)).toBeVisible({ timeout: 5_000 });
  const row = problemRow(page, title);
  await expect(row.locator(".problem-table__action-link")).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: /다시 풀기|Solve again|Làm lại|Thử lại/ }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", {
      name: /문제 저장|Save question|Lưu câu hỏi/,
    }),
  ).toBeVisible();
  await expect(row.locator(".problem-table__overflow-button")).toHaveCount(0);
  await expect(row.locator(".problem-table__new-badge")).toHaveCount(0);
  await row.locator(".problem-table__title").click();
  await expect(page.getByTestId("retry-modal-compact-summary")).toBeVisible();
}

async function visibleProblemTitles(page: Page) {
  const titles = page.locator(".problem-table__title");
  await expect(titles.first()).toBeVisible({ timeout: 15_000 });
  return titles.allTextContents();
}

async function searchLibraryProblems(page: Page, query: string) {
  const url = "/library/problems";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ensureAuthedRoute(page, url);
    const loaded = await page
      .getByTestId("library-problems-list")
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (loaded) break;
    await page.waitForTimeout(500);
  }

  await expect(page.getByTestId("library-problems-list")).toBeVisible();
  const search = page.getByTestId("library-problems-search").locator("input");
  await expect(search).toBeVisible({ timeout: 15_000 });
  await search.fill(query);
}

async function selectSavedProblemFilter(page: Page) {
  const desktopFilter = page.getByTestId("library-problems-filter-kind-problem");
  if (await desktopFilter.isVisible()) {
    await desktopFilter.click();
    return;
  }

  await page.getByTestId("library-problems-filter-open").click();
  const drawer = page
    .locator(".ant-drawer")
    .filter({ has: page.getByTestId("library-problems-filter-panel") })
    .last();
  const drawerOpened = await drawer
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!drawerOpened) return;

  await drawer.getByTestId("library-problems-filter-kind-problem").click();
  await page.getByTestId("library-problems-filter-drawer-apply").last().click();
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
  test.setTimeout(120_000);
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
    await ensureAuthedRoute(
      page,
      `/practice/problems?q=${fixture.marker}&sort=newest&page=1`,
    );

    await expect
      .poll(() => visibleProblemTitles(page), {
        timeout: REMOTE_FIXTURE_SYNC_TIMEOUT_MS,
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

test("C-02 problem save appears in the F-01 saved problem filter", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  let fixture: SaveBackFixture | null = null;
  try {
    fixture = await createStableSaveBackFixture();

    const row = await openFixtureProblemList(page, fixture);
    const listUrl = new URL(page.url());
    const saveProblemButton = row.getByRole("button", {
      name: /문제 저장|Save question|Lưu câu hỏi/,
    });
    await expect(row.locator(".problem-table__overflow-button")).toHaveCount(0);
    await expect(saveProblemButton).toBeEnabled();
    await expect(saveProblemButton).toHaveText("");
    await expect(
      saveProblemButton.locator("svg.lucide-bookmark"),
    ).toHaveAttribute("fill", "none");
    await saveProblemButton.click();
    await expect(page.locator(".ant-message-notice")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".ant-notification-notice")).toHaveCount(0);
    await expect(page).toHaveURL(/\/practice\/problems/);
    expect(new URL(page.url()).searchParams.get("q")?.trim()).toBe(
      listUrl.searchParams.get("q")?.trim(),
    );
    await waitForSavedProblem(fixture);
    const savedProblemButton = row.getByRole("button", {
      name: /저장됨|Saved|Đã lưu/,
    });
    await expect(savedProblemButton).toBeVisible({ timeout: 15_000 });
    await expect(savedProblemButton).toBeEnabled();
    await expect(savedProblemButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      savedProblemButton.locator("svg.lucide-bookmark"),
    ).toHaveAttribute("fill", "currentColor");

    await searchLibraryProblems(page, fixture.marker);
    await selectSavedProblemFilter(page);
    const savedRow = page
      .getByTestId("library-problems-mixed-row")
      .filter({ hasText: fixture.title });
    await expect(savedRow).toBeVisible({ timeout: 15_000 });
    await expect(savedRow).toHaveAttribute("data-library-kind", "problem");
    await savedRow
      .getByRole("button", { name: /다시 풀기|Solve again|Làm lại|Thử lại/ })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/writing/short-answer-writing-51.*${fixture.problemId}`),
    );
    const writingBookmarkButton = page.locator(
      ".writing-exam-header__bookmark-button",
    );
    await expect(writingBookmarkButton).toBeVisible({ timeout: 15_000 });
    await expect(writingBookmarkButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      writingBookmarkButton.locator("svg.lucide-bookmark"),
    ).toHaveAttribute("fill", "currentColor");
    await writingBookmarkButton.click();
    await expect(page.locator(".ant-message-notice")).toBeVisible({
      timeout: 15_000,
    });
    await waitForUnsavedProblem(fixture);
    await expect(writingBookmarkButton).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(
      writingBookmarkButton.locator("svg.lucide-bookmark"),
    ).toHaveAttribute("fill", "none");

    await searchLibraryProblems(page, fixture.marker);
    await expect(
      page
        .getByTestId("library-problems-mixed-row")
        .filter({ hasText: fixture.title }),
    ).toHaveCount(0);
    await expect(page.getByTestId("library-problems-empty")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    if (fixture) {
      await cleanupUserProblemState(fixture.userId, [fixture.problemId]);
    }
    await cleanupProblemListFixtures(createdProblemIds);
  }
});

test("D-01 temporary save does not create a saved problem library item", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  let fixture: SaveBackFixture | null = null;
  try {
    fixture = await createStableSaveBackFixture();

    await openFixtureFromProblemList(page, fixture);
    await saveDraftOnWritingPage(page, fixture.marker);
    await waitForSavedDraft(fixture);
    await expectProblemNotSaved(fixture);

    await searchLibraryProblems(page, fixture.marker);
    await expect(
      page
        .getByTestId("library-problems-mixed-row")
        .filter({ hasText: fixture.title }),
    ).toHaveCount(0);
    await expect(page.getByTestId("library-problems-empty")).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    if (fixture) {
      await cleanupUserProblemState(fixture.userId, [fixture.problemId]);
    }
    await cleanupProblemListFixtures(createdProblemIds);
  }
});

test("C-02 -> writing save -> header back returns with retry state", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  let fixture: SaveBackFixture | null = null;
  try {
    fixture = await createStableSaveBackFixture();

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
    if (fixture) {
      await cleanupUserProblemState(fixture.userId, [fixture.problemId]);
    }
    await cleanupProblemListFixtures(createdProblemIds);
  }
});

test("C-02 -> writing save -> browser back returns with retry state", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const createdProblemIds: string[] = [];
  const errors = collectErrors(page);
  let fixture: SaveBackFixture | null = null;
  try {
    fixture = await createStableSaveBackFixture();

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
    if (fixture) {
      await cleanupUserProblemState(fixture.userId, [fixture.problemId]);
    }
    await cleanupProblemListFixtures(createdProblemIds);
  }
});
