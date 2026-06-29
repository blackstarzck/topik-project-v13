import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
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
    // CI without .env.local still runs the non-fixture layout checks.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const MAX_WIDTH_BY_SIZE = {
  form: 640,
  task: 960,
  workspace: 1152,
  wide: 1280,
  full: Number.POSITIVE_INFINITY,
} as const;
const createdRunIds: string[] = [];
const createdSubmissionIds: string[] = [];
const createdProblemIds: string[] = [];

type WorkspaceBodySize = keyof typeof MAX_WIDTH_BY_SIZE;

type Rect = {
  left: number;
  right: number;
  width: number;
  height: number;
};

type BodyMetrics = Rect & {
  alignedBlockLeft: number | null;
  headingLeft: number | null;
  size: WorkspaceBodySize;
};

// Settings/profile pages were unified to the dashboard `workspace` (1152px)
// container width (2026-06-21). Their forms keep a readable max-width via an
// inner left-aligned wrapper, but the WorkspaceBody container itself now
// matches every other workspace page.
const LAYOUT_ROUTES = [
  { route: "/practice/weakness", size: null },
  { route: "/library", size: "workspace" },
  { route: "/profile", size: "workspace" },
  { route: "/settings/account", size: "workspace" },
  { route: "/settings/learning", size: "workspace" },
  { route: "/settings/language", size: "workspace" },
] as const;

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
      "Missing Supabase service credentials for layout e2e setup",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createNextProblemFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const marker = `e2e-layout-next-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date(Date.now() + 90_000).toISOString();
  const problemRows = [51, 52, 53, 54].map((questionNo, index) => ({
    id: randomUUID(),
    source: "curated" as const,
    domain: "writing" as const,
    question_no: questionNo,
    topik_level: 2,
    difficulty: 2 + index,
    title: `E2E layout next ${marker} ${questionNo}`,
    prompt: "다음 안내문을 읽고 알맞은 내용을 쓰십시오.",
    materials: { question_id: `${marker}-${questionNo}` },
    answer_key: null,
    rubric: {},
    tags: [marker, "e2e-layout-next"],
    publish_status: "published" as const,
    review_status: "approved" as const,
    visibility: "public" as const,
    lifecycle_status: "active" as const,
    created_at: createdAt,
    updated_at: createdAt,
  }));
  const problems = await sb
    .from("problems")
    .insert(problemRows)
    .select("id, question_no");
  if (problems.error) throw problems.error;
  createdProblemIds.push(...problemRows.map((problem) => problem.id));

  const submissionId = randomUUID();
  const runId = randomUUID();
  const answerText =
    "This completed submission gives the layout test recommendation context.";

  const submission = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problems.data[0].id,
    question_no: problems.data[0].question_no ?? 53,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (submission.error) throw submission.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 72,
    score_max: 100,
    overall_summary: "Fixture feedback for workspace layout CTA alignment.",
    ai_model: "e2e-fixture",
    ai_model_version: "workspace-layout",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "grammar",
      score: 58,
      score_max: 100,
      summary: "Grammar is the weakest area.",
      weakness_level: 5,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "structure",
      score: 66,
      score_max: 100,
      summary: "Structure needs more practice.",
      weakness_level: 4,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const run = await sb.from("recommendation_runs").insert({
    id: runId,
    user_id: user.id,
    source_type: "next_problem",
    reason_summary: "workspace layout isolated next-problem run",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (run.error) throw run.error;

  const items = await sb.from("recommendation_items").insert(
    problems.data.map((problem, index) => ({
      run_id: runId,
      user_id: user.id,
      problem_id: problem.id,
      rank: -200 + index,
      reason:
        index === 0
          ? "This problem follows the weakest grammar and structure layout fixture signals."
          : "This alternative keeps the learner near the same writing practice context.",
      estimated_minutes: 12 + index * 3,
      weakness_tags: ["grammar", "structure"],
      status: "active",
    })),
  );
  if (items.error) throw items.error;

  createdSubmissionIds.push(submissionId);
  createdRunIds.push(runId);
}

test.afterAll(async () => {
  if (
    createdSubmissionIds.length === 0 &&
    createdRunIds.length === 0 &&
    createdProblemIds.length === 0
  ) {
    return;
  }
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdRunIds) {
    await sb.from("recommendation_runs").delete().eq("id", id);
  }
  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
  if (createdProblemIds.length > 0) {
    await sb.from("problems").delete().in("id", createdProblemIds);
  }
});

async function rectOf(locator: Locator): Promise<Rect> {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return (
      Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth
    );
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function getBodyMetrics(page: Page): Promise<BodyMetrics> {
  return page.getByTestId("workspace-page-body").evaluate((body) => {
    const bodyRect = body.getBoundingClientRect();
    const rawSize = body.getAttribute("data-workspace-body-size");
    const size = (
      rawSize === "form" ||
      rawSize === "task" ||
      rawSize === "workspace" ||
      rawSize === "wide" ||
      rawSize === "full"
        ? rawSize
        : "workspace"
    ) as WorkspaceBodySize;
    const headingRect =
      body.querySelector("h1")?.getBoundingClientRect() ?? null;
    const candidates = Array.from(body.querySelectorAll<HTMLElement>("*"));
    const alignedBlock = candidates.find((element) => {
      if (element.closest("header")) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      if (rect.width < 24 || rect.height < 24) return false;
      return Math.abs(rect.left - bodyRect.left) <= 1;
    });

    return {
      left: bodyRect.left,
      right: bodyRect.right,
      width: bodyRect.width,
      height: bodyRect.height,
      alignedBlockLeft: alignedBlock?.getBoundingClientRect().left ?? null,
      headingLeft: headingRect?.left ?? null,
      size,
    };
  });
}

async function getShellMetrics(page: Page) {
  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      ".app-workspace-content",
    );
    const sider = document.querySelector<HTMLElement>(".app-workspace-sider");
    const mobileBar = document.querySelector<HTMLElement>(
      ".app-workspace-mobile-bar",
    );

    if (!content) throw new Error("Missing workspace content");

    const contentRect = content.getBoundingClientRect();
    const siderRect = sider?.getBoundingClientRect() ?? null;
    const siderStyle = sider ? window.getComputedStyle(sider) : null;
    const mobileBarRect = mobileBar?.getBoundingClientRect() ?? null;

    return {
      contentHeight: contentRect.height,
      mobileBarHeight: mobileBarRect?.height ?? 0,
      siderDisplay: siderStyle?.display ?? null,
      siderHeight: siderRect?.height ?? null,
      siderPosition: siderStyle?.position ?? null,
      siderTop: siderRect?.top ?? null,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
}

test("workspace body variants share the same layout contract", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const metricsByRoute: Array<{ route: string; metrics: BodyMetrics }> = [];

  for (const item of LAYOUT_ROUTES) {
    await page.goto(item.route, { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/login/);

    const body = page.getByTestId("workspace-page-body");
    await expect(body).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const metrics = await getBodyMetrics(page);
    if (item.size) expect(metrics.size).toBe(item.size);
    else expect(["task", "workspace"]).toContain(metrics.size);

    expect(metrics.width).toBeLessThanOrEqual(
      MAX_WIDTH_BY_SIZE[metrics.size] + 1,
    );
    expect(metrics.headingLeft).not.toBeNull();
    expect(
      Math.abs((metrics.headingLeft ?? 0) - metrics.left),
    ).toBeLessThanOrEqual(1);
    expect(metrics.alignedBlockLeft).not.toBeNull();

    metricsByRoute.push({ route: item.route, metrics });
  }

  const grouped = metricsByRoute.reduce(
    (acc, item) => {
      (acc[item.metrics.size] ??= []).push(item);
      return acc;
    },
    {} as Record<
      WorkspaceBodySize,
      Array<{ route: string; metrics: BodyMetrics }>
    >,
  );

  for (const items of Object.values(grouped)) {
    if (items.length < 2) continue;
    const [first, ...rest] = items;
    for (const item of rest) {
      expect(
        Math.abs(item.metrics.left - first.metrics.left),
        `${item.route} left should match ${first.route}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(item.metrics.width - first.metrics.width),
        `${item.route} width should match ${first.route}`,
      ).toBeLessThanOrEqual(1);
    }
  }

  expect(errors, errors.join("\n")).toEqual([]);
});

test("workspace shell keeps sidebar pinned and short content full-height", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("workspace-page-body")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const metrics = await getShellMetrics(page);
  const isDesktop = metrics.viewportWidth >= 768;
  const expectedContentHeight = isDesktop
    ? metrics.viewportHeight
    : metrics.viewportHeight - metrics.mobileBarHeight;

  expect(metrics.contentHeight).toBeGreaterThanOrEqual(
    expectedContentHeight - 1,
  );

  if (isDesktop) {
    expect(metrics.siderDisplay).not.toBe("none");
    expect(metrics.siderPosition).toBe("sticky");
    expect(Math.abs(metrics.siderTop ?? Number.NaN)).toBeLessThanOrEqual(1);
    expect(metrics.siderHeight ?? 0).toBeGreaterThanOrEqual(
      metrics.viewportHeight - 1,
    );
  }

  await page.getByTestId("workspace-page-body").evaluate((body) => {
    const spacer = document.createElement("div");
    spacer.setAttribute("data-layout-scroll-spacer", "true");
    spacer.style.height = "1400px";
    body.append(spacer);
  });
  await page.evaluate(() => window.scrollTo(0, 640));
  await page.waitForFunction(() => window.scrollY > 300);

  if (isDesktop) {
    const scrolledTop = await page
      .locator(".app-workspace-sider")
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(Math.abs(scrolledTop)).toBeLessThanOrEqual(1);
  }

  expect(errors, errors.join("\n")).toEqual([]);
});

test("next problem fixed CTA aligns with the workspace body", async ({
  page,
}) => {
  test.skip(
    !SUPABASE_URL || !SERVICE_KEY,
    "CTA alignment requires Supabase service credentials for isolated recommendation rows",
  );
  const errors = collectErrors(page);
  await createNextProblemFixture();

  await page.goto("/practice/next", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("next-selection-bar")).toBeVisible();

  const bodyRect = await rectOf(page.getByTestId("workspace-page-body"));
  const barRect = await rectOf(page.getByTestId("next-selection-bar"));
  const innerRect = await rectOf(
    page.locator(".app-workspace-fixed-action-bar__inner"),
  );

  await expectNoHorizontalOverflow(page);
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);
  expect(Math.abs(innerRect.left - bodyRect.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(innerRect.width - bodyRect.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(barRect.left)).toBeLessThanOrEqual(1);

  expect(errors, errors.join("\n")).toEqual([]);
});
