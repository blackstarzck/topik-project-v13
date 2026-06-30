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

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const createdLibraryItemIds: string[] = [];
const createdExportIds: string[] = [];
const createdReportIds: string[] = [];
const createdSubmissionIds: string[] = [];

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
    throw new Error("Missing Supabase service credentials for F-01 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createLibraryFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const problem = await sb
    .from("problems")
    .select("id, title, question_no")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id) throw new Error("No published writing problem found");

  const marker = `f01-audit-${randomUUID().slice(0, 8)}`;
  const submissionId = randomUUID();
  const reportId = randomUUID();
  const exportId = randomUUID();
  const libraryIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const answerText =
    "This saved library fixture verifies search, selection, and pagination.";

  const submission = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: problem.data.question_no ?? 53,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (submission.error) throw submission.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 76,
    score_max: 100,
    overall_summary: "F-01 fixture feedback summary for the saved answer row.",
    ai_model: "e2e-fixture",
    ai_model_version: "F-01",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "grammar",
      score: 62,
      score_max: 100,
      summary: "Grammar remains the weakest dimension.",
      weakness_level: 5,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "content",
      score: 78,
      score_max: 100,
      summary: "Content is acceptable.",
      weakness_level: 2,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const report = await sb.from("comparison_reports").insert({
    id: reportId,
    user_id: user.id,
    current_submission_id: submissionId,
    previous_submission_id: null,
    metrics: { score_delta: 0, no_previous: true },
    narrative: "F-01 fixture comparison narrative for the library report tab.",
    ai_model: "e2e-fixture",
  });
  if (report.error) throw report.error;

  const exportRow = await sb.from("export_files").insert({
    id: exportId,
    user_id: user.id,
    source_type: "library_selection",
    source_id: null,
    storage_path: `browser-print://${marker}`,
    options: { source: "browser_print" },
    status: "ready",
    ready_at: new Date().toISOString(),
  });
  if (exportRow.error) throw exportRow.error;

  const library = await sb.from("library_items").insert([
    {
      id: libraryIds[0],
      user_id: user.id,
      item_type: "submission",
      submission_id: submissionId,
      tags: [marker],
    },
    {
      id: libraryIds[1],
      user_id: user.id,
      item_type: "report",
      report_id: reportId,
      tags: [marker],
    },
    {
      id: libraryIds[2],
      user_id: user.id,
      item_type: "problem",
      problem_id: problem.data.id,
      tags: [marker],
    },
    {
      id: libraryIds[3],
      user_id: user.id,
      item_type: "export",
      export_id: exportId,
      tags: [marker],
    },
  ]);
  if (library.error) throw library.error;

  createdLibraryItemIds.push(...libraryIds);
  createdExportIds.push(exportId);
  createdReportIds.push(reportId);
  createdSubmissionIds.push(submissionId);

  return {
    marker,
    problemId: problem.data.id,
    problemTitle: problem.data.title,
  };
}

async function cleanupLibraryFixtures() {
  if (
    createdLibraryItemIds.length === 0 &&
    createdExportIds.length === 0 &&
    createdReportIds.length === 0 &&
    createdSubmissionIds.length === 0
  ) {
    return;
  }
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdLibraryItemIds) {
    await sb.from("library_items").delete().eq("id", id);
  }
  for (const id of createdExportIds) {
    await sb.from("export_files").delete().eq("id", id);
  }
  for (const id of createdReportIds) {
    await sb.from("comparison_reports").delete().eq("id", id);
  }
  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
  createdLibraryItemIds.length = 0;
  createdExportIds.length = 0;
  createdReportIds.length = 0;
  createdSubmissionIds.length = 0;
}

test.afterEach(cleanupLibraryFixtures);
test.afterAll(cleanupLibraryFixtures);

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "F-01 e2e requires Supabase service credentials for isolated library rows",
);

async function filterToFixture(page: Page, marker: string) {
  const input = page.getByTestId("library-search").locator("input");
  await input.fill(marker);
  await expect(page.getByTestId("library-result-count")).toContainText("1");
  await expect(page.getByTestId("library-item-row")).toHaveCount(1);
  expect(await page.getByTestId("library-item-row").count()).toBeLessThanOrEqual(10);
}

async function openTab(page: Page, tab: string) {
  await page.goto(`/library?tab=${tab}`, { waitUntil: "load" });
  await expect(page).toHaveURL(new RegExp(`/library\\?tab=${tab}`));
}

test("F-01 library rows match the wireframe constraints", async ({ page }) => {
  const errors = collectErrors(page);
  const fixture = await createLibraryFixture();

  await page.goto("/library", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("library-actions")).toBeVisible();
  await expect(page.getByTestId("library-export-pdf")).toBeDisabled();
  await expect(page.getByTestId("library-create-review-set")).toBeDisabled();
  await expect(page.getByTestId("library-tabs")).toHaveCount(0);
  await expect(page.getByTestId("library-type-filter")).toBeVisible();
  await expect(page.getByTestId("library-search").locator("input")).toHaveAttribute(
    "maxlength",
    "40",
  );
  expect(await page.getByTestId("library-stat-card").count()).toBeLessThanOrEqual(3);

  await filterToFixture(page, fixture.marker);
  const rowText = await page.getByTestId("library-item-row").innerText();
  expect(rowText).toContain(fixture.problemTitle.slice(0, 12));
  expect(rowText).not.toContain(fixture.problemId.slice(0, 8));

  await expect(page.getByTestId("library-select-item")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "PDF로 내보내기" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "태그 편집" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("library-selection-count")).toContainText("0");
  await expect(page.getByTestId("library-export-pdf")).toBeDisabled();
  const deleteButton = page.getByRole("button", { name: "삭제" });
  await expect(deleteButton).toHaveCount(1);
  await expect(deleteButton).toHaveText("");
  await expect(deleteButton).toHaveClass(/ant-btn-text/);
  await expect(deleteButton).toHaveClass(/ant-btn-dangerous/);
  await expect(deleteButton.locator("svg")).toHaveCount(1);

  await openTab(page, "reports");
  await filterToFixture(page, fixture.marker);
  await expect(
    page.getByRole("button", { name: "PDF로 내보내기" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "태그 편집" }),
  ).toHaveCount(0);

  await openTab(page, "problems");
  await filterToFixture(page, fixture.marker);

  await openTab(page, "exports");
  await filterToFixture(page, fixture.marker);

  expect(errors).toEqual([]);
});
