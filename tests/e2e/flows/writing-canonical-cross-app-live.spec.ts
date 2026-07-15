import { writeFile } from "node:fs/promises";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  canonicalLiveEnabled,
  cleanupCanonicalIdentity,
  cleanupCanonicalLiveFixture,
  createCanonicalLiveFixture,
  managementSql,
  resolveCanonicalLiveConfig,
  setFixtureAvailability,
  startWritingUpstreamFixture,
  type CanonicalLiveConfig,
  type CanonicalLiveFixture,
  type WritingUpstreamFixture,
} from "../_setup/canonical-cross-app-live-fixture";

const SUPPORTED_PROJECTS = new Set(["desktop-1280", "mobile-360"]);

type BrowserFailure = {
  kind: "console" | "pageerror" | "response";
  message: string;
  url: string;
};

let adminContext: BrowserContext | null = null;
let adminPage: Page | null = null;
let config: CanonicalLiveConfig | null = null;
let fixture: CanonicalLiveFixture | null = null;
let fixtureDraftId: string | null = null;
let upstreamFixture: WritingUpstreamFixture | null = null;
let browserFailures: BrowserFailure[] = [];

function currentFixture(): CanonicalLiveFixture {
  if (!fixture) throw new Error("Canonical live fixture was not initialized.");
  return fixture;
}

function currentConfig(): CanonicalLiveConfig {
  if (!config) throw new Error("Canonical live config was not initialized.");
  return config;
}

function skipUnsupportedProject(testInfo: TestInfo): void {
  test.skip(
    !SUPPORTED_PROJECTS.has(testInfo.project.name),
    "Cross-app live acceptance is limited to 360px and 1280px Chromium.",
  );
}

function watch(page: Page): void {
  page.on("pageerror", (error) => {
    browserFailures.push({
      kind: "pageerror",
      message: error.message,
      url: page.url(),
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserFailures.push({
        kind: "console",
        message: message.text(),
        url: page.url(),
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      browserFailures.push({
        kind: "response",
        message: String(response.status()),
        url: response.url(),
      });
    }
  });
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ caret: "initial", fullPage: true, path });
  await testInfo.attach(name, { contentType: "image/png", path });
}

async function loginAdmin(
  page: Page,
  live: CanonicalLiveConfig,
): Promise<void> {
  await page.goto(`${live.adminBaseUrl}/assessment/question-bank/imported`);
  const heading = page.getByRole("heading", { name: "TOPIK 관리자 로그인" });
  if (await heading.isVisible().catch(() => false)) {
    await page.locator('input[autocomplete="username"]').fill(live.adminEmail);
    await page
      .locator('input[autocomplete="current-password"]')
      .fill(live.adminPassword);
    await page.getByRole("button", { name: "로그인" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "가져온 문항(인박스)", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
}

async function expectHistoryAvailable(page: Page): Promise<void> {
  await page.goto(currentFixture().historyHref);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("main").first()).toBeVisible();
  await expect(
    page.getByText(/찾을 수 없|불러오지 못|오류가 발생/),
  ).toHaveCount(0);
}

async function submissionCount(): Promise<number> {
  const liveFixture = currentFixture();
  const result = await liveFixture.serviceClient
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("problem_id", liveFixture.problemId)
    .eq("user_id", liveFixture.studentUserId);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function submissionIntentCount(draftId: string): Promise<number> {
  const availability = await managementSql(
    currentConfig(),
    "select to_regclass('private.writing_submission_intents') is not null as installed",
  );
  if (availability[0]?.installed !== true) return 0;

  const rows = await managementSql(
    currentConfig(),
    `select count(*)::integer as count
       from private.writing_submission_intents
      where draft_id = '${draftId}'::uuid`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function learnerCanonicalProblemIds(): Promise<Set<string>> {
  const result = await currentFixture().studentClient.rpc(
    "get_available_writing_questions",
    { p_item_number: null, p_problem_id: null },
  );
  if (result.error) throw result.error;
  return new Set(
    ((result.data ?? []) as Array<{ problem_id: string }>).map((row) =>
      String(row.problem_id),
    ),
  );
}

async function expectWritingIdsCanonical(
  actual: Iterable<string>,
  canonical: ReadonlySet<string>,
  surface: string,
): Promise<void> {
  const unknown = Array.from(actual).filter((id) => !canonical.has(id));
  if (unknown.length === 0) return;

  const nonWriting = await currentFixture()
    .serviceClient.from("problems")
    .select("id,domain")
    .in("id", unknown);
  if (nonWriting.error) throw nonWriting.error;
  const domains = new Map(
    (nonWriting.data ?? []).map((row) => [String(row.id), String(row.domain)]),
  );
  const invalid = unknown.filter(
    (id) => !domains.has(id) || domains.get(id) === "writing",
  );
  expect(
    invalid,
    `${surface} returned writing ids outside the canonical catalog`,
  ).toEqual([]);
}

async function createPdfQuotaReset(problemId: string): Promise<string> {
  const serviceClient = currentFixture().serviceClient;
  const reset = await serviceClient
    .from("pdf_export_quota_resets")
    .insert({
      problem_id: problemId,
      reason: "canonical history live e2e",
      reset_scope: "user",
    })
    .select("id")
    .single();
  if (reset.error) throw reset.error;
  const resetId = String(reset.data.id);
  const target = await serviceClient
    .from("pdf_export_quota_reset_targets")
    .insert({ reset_id: resetId, user_id: currentFixture().studentUserId });
  if (target.error) {
    await serviceClient
      .from("pdf_export_quota_resets")
      .delete()
      .eq("id", resetId);
    throw target.error;
  }
  return resetId;
}

async function cleanupPdfQuotaReset(resetId: string): Promise<void> {
  const result = await currentFixture()
    .serviceClient.from("pdf_export_quota_resets")
    .delete()
    .eq("id", resetId);
  if (result.error) throw result.error;
}

async function cleanupPdfExport(
  exportId: string,
  storagePath: string,
): Promise<void> {
  const serviceClient = currentFixture().serviceClient;
  const storage = await serviceClient.storage
    .from("generated-exports")
    .remove([storagePath]);
  if (storage.error) throw storage.error;
  const events = await serviceClient
    .from("study_events")
    .delete()
    .eq("payload->>export_id", exportId);
  if (events.error) throw events.error;
  const usages = await serviceClient
    .from("pdf_export_quota_usages")
    .delete()
    .eq("export_file_id", exportId);
  if (usages.error) throw usages.error;
  const file = await serviceClient
    .from("export_files")
    .delete()
    .eq("id", exportId);
  if (file.error) throw file.error;
}

test.use({
  actionTimeout: 30_000,
  navigationTimeout: 60_000,
  trace: {
    mode: "on",
    screenshots: false,
    snapshots: true,
    sources: true,
  },
});

test.describe("canonical writing cross-app live acceptance", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.skip(
    !canonicalLiveEnabled(),
    "Set E2E_CANONICAL_CROSS_APP=1 with guarded dev credentials.",
  );

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000);
    if (!SUPPORTED_PROJECTS.has(testInfo.project.name)) return;

    config = resolveCanonicalLiveConfig();
    fixture = await createCanonicalLiveFixture(config);
    if (testInfo.project.name === "desktop-1280") {
      const upstreamBaseUrl = process.env.E2E_WRITING_UPSTREAM_BASE_URL?.trim();
      if (!upstreamBaseUrl) {
        throw new Error(
          "E2E_WRITING_UPSTREAM_BASE_URL is required for desktop ingest.",
        );
      }
      upstreamFixture = await startWritingUpstreamFixture(
        fixture,
        upstreamBaseUrl,
      );
    }

    adminContext = await browser.newContext({
      baseURL: config.adminBaseUrl,
      viewport:
        testInfo.project.name === "mobile-360"
          ? { height: 720, width: 360 }
          : { height: 800, width: 1280 },
    });
    adminPage = await adminContext.newPage();
    watch(adminPage);
    await loginAdmin(adminPage, config);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnsupportedProject(testInfo);
    browserFailures = [];
    watch(page);
  });

  test.afterEach(async () => {
    expect(
      browserFailures,
      "pageerror, console error, and HTTP 5xx must remain zero",
    ).toEqual([]);
  });

  test.afterAll(async () => {
    const errors: Error[] = [];
    if (upstreamFixture) {
      try {
        await upstreamFixture.close();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
      if (fixture) {
        try {
          await cleanupCanonicalIdentity({
            config: fixture.config,
            problemId: upstreamFixture.problemId,
            questionId: upstreamFixture.questionId,
            studentUserId: fixture.studentUserId,
          });
        } catch (error) {
          errors.push(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }
    if (fixture) {
      try {
        await cleanupCanonicalLiveFixture(fixture);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (adminContext) {
      try {
        await adminContext.close();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "Canonical cross-app cleanup failed.");
    }
  });

  test("Admin manual ingest uses the real server runner and creates canonical identity", async ({}, testInfo) => {
    skipUnsupportedProject(testInfo);
    test.skip(
      testInfo.project.name !== "desktop-1280",
      "The mutable local-upstream ingest flow has one desktop owner.",
    );
    if (!adminPage || !upstreamFixture) {
      throw new Error("Admin page or local writing upstream is missing.");
    }

    await adminPage.goto("/assessment/question-bank/imported");
    const button = adminPage.getByRole("button", { name: "외부에서 가져오기" });
    await expect(button).toBeEnabled();
    await expect(button).toHaveClass(/ant-btn-lg/);
    await button.click();
    await expect(
      adminPage.getByText("외부 문항을 가져왔습니다.", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      adminPage.getByText(upstreamFixture.questionId, { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    expect(upstreamFixture.requests).toContain("POST /api/eval/auth/login");

    const sourceMap = await currentFixture()
      .serviceClient.from("topik_writing_question_source_map")
      .select("canonical_import_id,learner_problem_id")
      .eq("question_id", upstreamFixture.questionId)
      .single();
    expect(sourceMap.error).toBeNull();
    expect(String(sourceMap.data?.learner_problem_id)).toBe(
      upstreamFixture.problemId,
    );
    upstreamFixture.canonicalImportId = Number(
      sourceMap.data?.canonical_import_id,
    );
    await capture(adminPage, testInfo, "admin-manual-ingest-live-success");
  });

  test("Admin publication is visible on the next learner request without a public.problems writing row", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    const liveFixture = currentFixture();
    if (!adminPage) throw new Error("Admin page was not initialized.");

    await adminPage.goto(
      `/assessment/question-bank?keyword=${encodeURIComponent(liveFixture.questionId)}`,
    );
    const row = adminPage
      .locator("tbody tr.ant-table-row")
      .filter({ hasText: liveFixture.questionId });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await capture(adminPage, testInfo, "admin-canonical-question-published");

    const control = await liveFixture.studentClient.rpc(
      "get_writing_submission_control",
    );
    expect(control.error).toBeNull();
    expect(
      Array.isArray(control.data) ? control.data[0] : control.data,
    ).toMatchObject({ submission_mode: "blocked" });

    const evidence = await managementSql(
      currentConfig(),
      `select
         (select count(*)::integer
            from private.problem_identities
           where problem_id = '${liveFixture.problemId}'::uuid
             and domain = 'writing'
             and identity_key = '${liveFixture.questionId}') as identity_count,
         (select count(*)::integer
            from public.problems
           where id = '${liveFixture.problemId}'::uuid
             and domain = 'writing') as public_writing_count`,
    );
    expect(evidence).toEqual([{ identity_count: 1, public_writing_count: 0 }]);

    await page.goto(
      `/writing/short-answer-writing-51?problem=${liveFixture.problemId}&fresh=1`,
    );
    await expect(
      page.getByText(liveFixture.marker, { exact: false }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("textarea").first()).toBeVisible();
    await capture(page, testInfo, "learner-canonical-direct-question");
  });

  test("Q51-Q54 current-content routes read the canonical learner-safe catalog", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    const routes = {
      51: "/writing/short-answer-writing-51",
      52: "/writing/answer-writing-52",
      53: "/writing/long-form-writing-53",
      54: "/writing/essay-writing-54",
    } as const;

    for (const itemNumber of [51, 52, 53, 54] as const) {
      const sample = currentFixture().canonicalSamples[itemNumber];
      await page.goto(
        `${routes[itemNumber]}?problem=${sample.problem_id}&fresh=1`,
      );
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("textarea").first()).toBeVisible({
        timeout: 20_000,
      });
      if (itemNumber === 53) {
        await expect(
          page.getByTestId("q53-material-chart").first(),
        ).toBeVisible({
          timeout: 20_000,
        });
      }
    }
    await capture(page, testInfo, "learner-q51-q54-canonical-details");
  });

  test("canonical draft pins its version while blocked submission creates no intent or submission", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    const liveFixture = currentFixture();
    const route = `/writing/short-answer-writing-51?problem=${liveFixture.problemId}`;
    await page.goto(`${route}&fresh=1`);
    await page.locator("textarea").first().fill(`초안 ${liveFixture.marker}`);
    await page.locator(".writing-exam-header__save-button").click();

    const draft = await expect
      .poll(async () => {
        const result = await liveFixture.serviceClient
          .from("writing_drafts")
          .select(
            "id,canonical_question_id,canonical_import_id,canonical_payload_hash,question_snapshot",
          )
          .eq("problem_id", liveFixture.problemId)
          .eq("user_id", liveFixture.studentUserId)
          .neq("autosave_status", "superseded")
          .maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      })
      .toMatchObject({
        canonical_import_id: liveFixture.canonicalImportId,
        canonical_payload_hash: liveFixture.canonicalQuestion.payload_hash,
        canonical_question_id: liveFixture.questionId,
      });
    void draft;

    const savedDraft = await liveFixture.serviceClient
      .from("writing_drafts")
      .select("id,answer_text,answer_json,question_snapshot")
      .eq("problem_id", liveFixture.problemId)
      .eq("user_id", liveFixture.studentUserId)
      .neq("autosave_status", "superseded")
      .single();
    expect(savedDraft.error).toBeNull();
    fixtureDraftId = String(savedDraft.data?.id);
    expect(savedDraft.data?.answer_text).toContain(liveFixture.marker);
    expect(savedDraft.data?.answer_json).toMatchObject({
      _v: "51.v1",
    });
    expect(savedDraft.data?.question_snapshot).toMatchObject({
      canonical_import_id: String(liveFixture.canonicalImportId),
      item_number: 51,
      payload_hash: liveFixture.canonicalQuestion.payload_hash,
      question_id: liveFixture.questionId,
    });

    await expect
      .poll(() => new URL(page.url()).searchParams.get("fresh"), {
        timeout: 20_000,
      })
      .toBeNull();

    await page.reload();
    await expect(page.locator("textarea").first()).toHaveValue(
      new RegExp(liveFixture.marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

    const beforeSubmissions = await submissionCount();
    const beforeIntents = await submissionIntentCount(
      String(savedDraft.data?.id),
    );
    const submit = page.getByRole("button", { name: "제출하기" });
    if (await submit.isEnabled()) {
      await submit.click();
      const confirm = page.getByTestId("submission-confirm-submit");
      await expect(confirm).toBeVisible();
      await confirm.click();
    }
    await expect.poll(submissionCount).toBe(beforeSubmissions);
    const afterIntents = await submissionIntentCount(
      String(savedDraft.data?.id),
    );
    expect(afterIntents).toBe(beforeIntents);
    await capture(page, testInfo, "learner-canonical-draft-blocked-submit");
    await expectHistoryAvailable(page);
  });

  test("recommendation, weakness, and next-problem surfaces never reintroduce writing mirror rows", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    const canonicalIds = await learnerCanonicalProblemIds();

    const response = await page.request.get("/api/practice/recommendations");
    expect(response.status()).toBe(200);
    const bundle = (await response.json()) as {
      items?: Array<{ problemId?: string }>;
    };
    await expectWritingIdsCanonical(
      (bundle.items ?? []).flatMap((item) =>
        item.problemId ? [item.problemId] : [],
      ),
      canonicalIds,
      "recommendations",
    );

    await page.goto("/practice/weakness");
    await expect(page.locator("main").first()).toBeVisible();
    const weaknessIds = await page
      .locator('[data-testid^="weakness-rec-"]')
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const testId = element.getAttribute("data-testid") ?? "";
          return testId.startsWith("weakness-rec-")
            ? [testId.slice("weakness-rec-".length)]
            : [];
        }),
      );
    await expectWritingIdsCanonical(
      weaknessIds,
      canonicalIds,
      "weakness recommendations",
    );

    await page.goto("/practice/next");
    await expect(page.locator("main").first()).toBeVisible();
    const nextIds = await page
      .locator(
        '[data-testid="next-primary-card"], [data-testid="next-alternative-card"], [data-testid="next-alternative-locked"]',
      )
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const id = element.getAttribute("data-problem-id");
          return id ? [id] : [];
        }),
      );
    await expectWritingIdsCanonical(nextIds, canonicalIds, "next problem");
    await capture(page, testInfo, "learner-canonical-recommendations");
  });

  test("a stale draft is superseded and its answer is copied to the current canonical version", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    if (!fixtureDraftId) throw new Error("Canonical fixture draft is missing.");
    const liveFixture = currentFixture();
    const before = await liveFixture.serviceClient
      .from("writing_drafts")
      .select("id,answer_text,answer_json")
      .eq("id", fixtureDraftId)
      .single();
    expect(before.error).toBeNull();

    const madeStale = await managementSql(
      currentConfig(),
      `set local session_replication_role = replica;
       update public.writing_drafts
          set canonical_import_id = null,
              canonical_payload_hash = null,
              canonical_question_id = null,
              question_snapshot = null,
              updated_at = now()
        where id = '${fixtureDraftId}'::uuid
          and user_id = '${liveFixture.studentUserId}'::uuid
          and autosave_status <> 'superseded'
       returning id`,
    );
    expect(madeStale).toEqual([{ id: fixtureDraftId }]);

    await page.goto(
      `/writing/short-answer-writing-51?problem=${liveFixture.problemId}`,
    );
    await expect(page.getByText("문항 내용이 변경되었습니다.")).toBeVisible({
      timeout: 20_000,
    });
    const replace = page.getByRole("button", {
      name: "현재 문항으로 답안 복사",
    });
    await expect(replace).toBeEnabled();
    await replace.click();

    await expect
      .poll(async () => {
        const result = await liveFixture.serviceClient
          .from("writing_drafts")
          .select(
            "id,autosave_status,answer_text,answer_json,canonical_question_id,canonical_import_id,canonical_payload_hash",
          )
          .eq("problem_id", liveFixture.problemId)
          .eq("user_id", liveFixture.studentUserId)
          .order("created_at", { ascending: true });
        if (result.error) throw result.error;
        return result.data;
      })
      .toHaveLength(2);

    const drafts = await liveFixture.serviceClient
      .from("writing_drafts")
      .select(
        "id,autosave_status,answer_text,answer_json,canonical_question_id,canonical_import_id,canonical_payload_hash",
      )
      .eq("problem_id", liveFixture.problemId)
      .eq("user_id", liveFixture.studentUserId);
    expect(drafts.error).toBeNull();
    const oldDraft = drafts.data?.find((row) => row.id === fixtureDraftId);
    const newDraft = drafts.data?.find((row) => row.id !== fixtureDraftId);
    expect(oldDraft?.autosave_status).toBe("superseded");
    expect(newDraft).toMatchObject({
      answer_json: before.data?.answer_json,
      answer_text: before.data?.answer_text,
      canonical_import_id: liveFixture.canonicalImportId,
      canonical_payload_hash: liveFixture.canonicalQuestion.payload_hash,
      canonical_question_id: liveFixture.questionId,
    });
    fixtureDraftId = String(newDraft?.id);
    await capture(page, testInfo, "learner-stale-draft-recovered");
  });

  test("retained history still produces a PDF without a public.problems writing row", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    test.skip(
      testInfo.project.name !== "desktop-1280",
      "One desktop owner creates and removes the PDF artifact.",
    );
    await expectHistoryAvailable(page);

    const submission = await currentFixture()
      .serviceClient.from("writing_submissions")
      .select("problem_id")
      .eq("id", currentConfig().existingHistorySubmissionId)
      .eq("user_id", currentFixture().studentUserId)
      .single();
    expect(submission.error).toBeNull();
    const quotaResetId = await createPdfQuotaReset(
      String(submission.data?.problem_id),
    );
    let artifact: { exportId: string; storagePath: string } | null = null;
    try {
      const response = await page.request.post(
        `${currentConfig().baseUrl}/api/export/pdf`,
        {
          data: {
            options: {
              filename: "canonical-history-live-e2e",
              includeAnswers: true,
              includeFeedback: false,
              layout: "continuous",
              orientation: "portrait",
            },
            sourceId: currentConfig().existingHistorySubmissionId,
            sourceType: "submission",
          },
        },
      );
      expect(response.status(), await response.text()).toBe(200);
      artifact = (await response.json()) as {
        exportId: string;
        storagePath: string;
      };
      const downloaded = await currentFixture()
        .serviceClient.storage.from("generated-exports")
        .download(artifact.storagePath);
      expect(downloaded.error).toBeNull();
      const bytes = new Uint8Array(
        await (downloaded.data as Blob).arrayBuffer(),
      );
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.byteLength).toBeGreaterThan(1_000);
      const path = testInfo.outputPath("retained-history.pdf");
      await writeFile(path, bytes);
      await testInfo.attach("retained-history-pdf", {
        contentType: "application/pdf",
        path,
      });
    } finally {
      if (artifact) {
        await cleanupPdfExport(artifact.exportId, artifact.storagePath);
      }
      await cleanupPdfQuotaReset(quotaResetId);
    }
  });

  test("Admin exclusion removes current content while retained history remains readable", async ({
    page,
  }, testInfo) => {
    skipUnsupportedProject(testInfo);
    await setFixtureAvailability(
      currentFixture(),
      "excluded",
      "e2e: canonical exclusion and retained history",
    );
    const canonical = await currentFixture().studentClient.rpc(
      "get_available_writing_questions",
      { p_item_number: 51, p_problem_id: currentFixture().problemId },
    );
    expect(canonical.error).toBeNull();
    expect(canonical.data ?? []).toEqual([]);

    await page.goto(
      `/writing/short-answer-writing-51?problem=${currentFixture().problemId}&fresh=1`,
    );
    await expect(
      page.getByText(currentFixture().marker, { exact: false }),
    ).toHaveCount(0);
    await capture(page, testInfo, "learner-canonical-question-excluded");
    await expectHistoryAvailable(page);
  });

  test("mirror, read-mode, reconciliation, and public writing catalog are absent", async ({}, testInfo) => {
    skipUnsupportedProject(testInfo);
    test.skip(
      testInfo.project.name !== "desktop-1280",
      "The catalog contract probe has one desktop owner.",
    );
    const evidence = await managementSql(
      currentConfig(),
      `select
         to_regprocedure('public.get_writing_runtime_state()') is null
           as runtime_reader_removed,
         to_regprocedure(
           'public.set_writing_runtime_state(text,text,text,text,text,text)'
         ) is null as runtime_writer_removed,
         to_regprocedure(
           'public.reconcile_active_writing_draft_versions(text,text)'
         ) is null as reconciliation_removed,
         not exists (
           select 1 from cron.job where jobname = 'sync-writing-problems'
         ) as mirror_cron_removed,
         not exists (
           select 1 from public.problems where domain = 'writing'
         ) as public_writing_catalog_removed`,
    );
    expect(evidence).toEqual([
      {
        mirror_cron_removed: true,
        public_writing_catalog_removed: true,
        reconciliation_removed: true,
        runtime_reader_removed: true,
        runtime_writer_removed: true,
      },
    ]);
  });
});
