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

const ROUTES = {
  51: "/writing/short-answer-writing-51",
  52: "/writing/answer-writing-52",
  53: "/writing/long-form-writing-53",
  54: "/writing/essay-writing-54",
} as const;

type QuestionNo = keyof typeof ROUTES;

type DirectFixture = {
  marker: string;
  userId: string;
  problems: Array<{
    id: string;
    questionNo: QuestionNo;
    title: string;
    role: "touched" | "untouched";
  }>;
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
      "Missing Supabase service credentials for writing direct-entry e2e",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function getStudentUser() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user?.id) throw new Error(`E2E student user not found: ${EMAIL}`);
  return { id: user.id };
}

function commonRubric() {
  return {
    conditions: ["Use the required information."],
    criteria: ["Content", "Organization", "Accuracy"],
  };
}

function q51Materials(marker: string) {
  return {
    question_id: `e2e-direct-${marker}-51`,
    blank_target_giyeok: "meeting date",
    blank_target_nieun: "preparation item",
    blank_1_role: "date notice",
    blank_2_role: "required preparation",
    review: { validation: [`direct entry fixture ${marker}`] },
  };
}

function q52Materials(marker: string) {
  return {
    question_id: `e2e-direct-${marker}-52`,
    blank_target_giyeok: "reason connector",
    blank_target_nieun: "result sentence",
    connection_function: "cause and result",
    clue_before_text: "The class schedule changed.",
    clue_after_text: "Students should check the notice.",
    paragraph_role: "announcement completion",
    review: { validation: [`direct entry fixture ${marker}`] },
  };
}

function q53Materials(marker: string) {
  return {
    question_id: `e2e-direct-${marker}-53`,
    chart_a: {
      title: "Preferred study method",
      chart_type: "bar",
      unit: "%",
      series: [{ label: "Online", values: [42, 58] }],
    },
    chart_b: {
      title: "Reason for preference",
      chart_type: "bar",
      unit: "%",
      series: [{ label: "Convenience", values: [35, 65] }],
    },
    guide_cards: ["Compare the two charts.", "Summarize the main change."],
  };
}

function q54Materials(marker: string) {
  return {
    question_id: `e2e-direct-${marker}-54`,
    model_outline: ["definition", "background", "opinion"],
    guidance: [
      { title: "Define the topic", items: ["Explain the core idea."] },
      { title: "Compare views", items: ["Give a balanced reason."] },
      { title: "State your opinion", items: ["Close with a clear claim."] },
    ],
  };
}

function promptFor(questionNo: QuestionNo) {
  if (questionNo === 51) {
    return "The club will meet on [ㄱ]. Students must bring [ㄴ]. Complete the notice.";
  }
  if (questionNo === 52) {
    return "The class schedule changed, so [ㄱ]. Therefore, students [ㄴ]. Complete the paragraph.";
  }
  if (questionNo === 53) {
    return [
      "Study habits survey",
      "1) Summarize the chart results.",
      "2) Compare the two groups.",
      "3) Explain the possible reason.",
    ].join("\n");
  }
  return [
    "Digital learning",
    "Digital learning means using online tools to study.",
    "Recently many schools have combined online and classroom lessons.",
    "1) Define digital learning.",
    "2) Explain one benefit and one concern.",
    "3) State your opinion with reasons.",
  ].join("\n\n");
}

function materialsFor(questionNo: QuestionNo, marker: string) {
  if (questionNo === 51) return q51Materials(marker);
  if (questionNo === 52) return q52Materials(marker);
  if (questionNo === 53) return q53Materials(marker);
  return q54Materials(marker);
}

function incompleteMaterialsFor(questionNo: QuestionNo, marker: string) {
  if (questionNo === 54) {
    return {
      ...q54Materials(marker),
      seed_source: "wireframe_problem_fixtures",
    };
  }
  return {};
}

function incompletePromptFor(questionNo: QuestionNo) {
  if (questionNo === 53) return "Incomplete chart description without tasks.";
  return promptFor(questionNo);
}

async function createDirectFixture(): Promise<DirectFixture> {
  const sb = serviceClient();
  const user = await getStudentUser();
  const marker = `e2e-direct-${randomUUID().slice(0, 8)}`;
  const baseTime = Date.parse("2000-01-01T00:00:00.000Z");
  const problems: DirectFixture["problems"] = [];
  const rows = [];

  for (const questionNo of [51, 52, 53, 54] as const) {
    const touchedId = randomUUID();
    const untouchedId = randomUUID();
    const touchedTitle = `E2E direct touched Q${questionNo} ${marker}`;
    const untouchedTitle = `E2E direct untouched Q${questionNo} ${marker}`;
    const touchedAt = new Date(
      baseTime + (questionNo - 51) * 120_000,
    ).toISOString();
    const untouchedAt = new Date(
      baseTime + (questionNo - 51) * 120_000 + 1_000,
    ).toISOString();

    problems.push(
      { id: touchedId, questionNo, title: touchedTitle, role: "touched" },
      { id: untouchedId, questionNo, title: untouchedTitle, role: "untouched" },
    );

    rows.push(
      {
        id: touchedId,
        source: "curated",
        domain: "writing",
        question_no: questionNo,
        topik_level: 2,
        difficulty: 3,
        title: touchedTitle,
        prompt: incompletePromptFor(questionNo),
        materials:
          questionNo === 53 || questionNo === 54
            ? incompleteMaterialsFor(questionNo, marker)
            : materialsFor(questionNo, marker),
        answer_key: null,
        rubric: questionNo === 54 ? { criteria: [] } : commonRubric(),
        tags: [marker, `q${questionNo}`, "direct-entry-touched"],
        publish_status: "published",
        review_status: "approved",
        visibility: "public",
        lifecycle_status: "active",
        created_at: touchedAt,
        updated_at: touchedAt,
      },
      {
        id: untouchedId,
        source: "curated",
        domain: "writing",
        question_no: questionNo,
        topik_level: 2,
        difficulty: 3,
        title: untouchedTitle,
        prompt: promptFor(questionNo),
        materials: materialsFor(questionNo, marker),
        answer_key: null,
        rubric: commonRubric(),
        tags: [marker, `q${questionNo}`, "direct-entry-untouched"],
        publish_status: "published",
        review_status: "approved",
        visibility: "public",
        lifecycle_status: "active",
        created_at: untouchedAt,
        updated_at: untouchedAt,
      },
    );
  }

  const inserted = await sb.from("problems").insert(rows);
  if (inserted.error) throw inserted.error;

  const q51Touched = problems.find(
    (problem) => problem.questionNo === 51 && problem.role === "touched",
  );
  const q52Touched = problems.find(
    (problem) => problem.questionNo === 52 && problem.role === "touched",
  );
  if (!q51Touched || !q52Touched) throw new Error("Fixture setup failed.");

  const submission = await sb.from("writing_submissions").insert({
    user_id: user.id,
    problem_id: q51Touched.id,
    question_no: 51,
    answer_text: `submitted fixture ${marker}`,
    char_count: `submitted fixture ${marker}`.length,
    feedback_status: "failed",
  });
  if (submission.error) throw submission.error;

  const draft = await sb.from("writing_drafts").insert({
    user_id: user.id,
    problem_id: q52Touched.id,
    question_no: 52,
    answer_text: `superseded draft fixture ${marker}`,
    char_count: `superseded draft fixture ${marker}`.length,
    autosave_status: "superseded",
    last_saved_at: new Date().toISOString(),
  });
  if (draft.error) throw draft.error;

  return { marker, userId: user.id, problems };
}

async function cleanupFixture(fixture: DirectFixture | null) {
  if (!fixture) return;
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;
  const ids = fixture.problems.map((problem) => problem.id);
  const sb = serviceClient();
  await sb.from("study_events").delete().in("problem_id", ids);
  await sb.from("writing_submissions").delete().in("problem_id", ids);
  await sb.from("writing_drafts").delete().in("problem_id", ids);
  await sb.from("problems").delete().in("id", ids);
}

function fixtureProblem(
  fixture: DirectFixture,
  questionNo: QuestionNo,
  role: "touched" | "untouched",
) {
  const problem = fixture.problems.find(
    (candidate) =>
      candidate.questionNo === questionNo && candidate.role === role,
  );
  if (!problem)
    throw new Error(`Missing fixture problem ${questionNo} ${role}`);
  return problem;
}

async function expectDirectEntryShowsUntouched(
  page: Page,
  fixture: DirectFixture,
  questionNo: QuestionNo,
) {
  const untouched = fixtureProblem(fixture, questionNo, "untouched");
  const touched = fixtureProblem(fixture, questionNo, "touched");

  await page.goto(ROUTES[questionNo], { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(new RegExp(ROUTES[questionNo]));
  await expect(page.getByText(untouched.title)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(touched.title)).toHaveCount(0);
}

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "Writing direct-entry e2e requires Supabase service credentials",
);
test.skip(
  ENV_LABEL === "prod" || ENV_LABEL === "production",
  "Writing direct-entry e2e must not seed production data",
);

test("writing 51-54 direct entry shows untouched problems before touched or invalid candidates", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  let fixture: DirectFixture | null = null;
  try {
    fixture = await createDirectFixture();

    for (const questionNo of [51, 52, 53, 54] as const) {
      await expectDirectEntryShowsUntouched(page, fixture, questionNo);
    }

    const touched51 = fixtureProblem(fixture, 51, "touched");
    await page.goto(`${ROUTES[51]}?problem=${touched51.id}`, {
      waitUntil: "networkidle",
    });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(touched51.title)).toBeVisible({
      timeout: 15_000,
    });

    expect(errors).toEqual([]);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("sidebar writing 54 direct menu opens the untouched q54 entry", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  let fixture: DirectFixture | null = null;
  try {
    fixture = await createDirectFixture();
    const untouched54 = fixtureProblem(fixture, 54, "untouched");

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator('[data-menu-id="rc-menu-uuid-writing"]').click();
    await page
      .locator('[data-menu-id="rc-menu-uuid-/writing/essay-writing-54"]')
      .click();

    await expect(page).toHaveURL(/\/writing\/essay-writing-54/);
    await expect(page.getByText(untouched54.title)).toBeVisible({
      timeout: 15_000,
    });

    expect(errors).toEqual([]);
  } finally {
    await cleanupFixture(fixture);
  }
});
