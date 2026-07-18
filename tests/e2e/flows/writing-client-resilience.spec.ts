import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalPrivilegedMutationTarget } from "../../../scripts/lib/supabase-target-safety.mjs";

const RECOVERY_DATABASE = "talkpik-client-recovery";
const RECOVERY_STORE = "writing-drafts";
const WRITING_PATH = "/writing/short-answer-writing-51";

type RecoveryRecord = {
  answerText?: unknown;
  key?: unknown;
  problemId?: unknown;
  savedAt?: unknown;
  schemaVersion?: unknown;
  submissionIntent?: { state?: unknown };
};

const canRunLocalMutationTest = (() => {
  try {
    assertLocalPrivilegedMutationTarget(process.env);
    return true;
  } catch {
    return false;
  }
})();

async function clearLocalStudentDrafts() {
  assertLocalPrivilegedMutationTarget(process.env);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const studentEmail = process.env.E2E_STUDENT_EMAIL;
  if (!supabaseUrl || !serviceRoleKey || !studentEmail) {
    throw new Error("Local writing resilience fixture is not configured.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1_000,
  });
  if (error) throw new Error("Local writing resilience user lookup failed.");
  const student = data.users.find((user) => user.email === studentEmail);
  if (!student) throw new Error("Local writing resilience user is missing.");
  const { error: cleanupError } = await supabase
    .from("writing_drafts")
    .delete()
    .eq("user_id", student.id);
  if (cleanupError) {
    throw new Error("Local writing resilience draft cleanup failed.");
  }
}

async function readRecoveryRecords(page: Page): Promise<RecoveryRecord[]> {
  return page.evaluate(
    async ({ databaseName, storeName }) =>
      new Promise<RecoveryRecord[]>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "key" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readonly");
          const getAll = transaction.objectStore(storeName).getAll();
          getAll.onerror = () => {
            database.close();
            reject(getAll.error);
          };
          getAll.onsuccess = () => {
            database.close();
            resolve(getAll.result as RecoveryRecord[]);
          };
        };
      }),
    { databaseName: RECOVERY_DATABASE, storeName: RECOVERY_STORE },
  );
}

async function clearRecoveryRecords(page: Page) {
  await page.evaluate(
    async ({ databaseName, storeName }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "key" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).clear();
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
    { databaseName: RECOVERY_DATABASE, storeName: RECOVERY_STORE },
  );
}

async function replaceRecoveryAnswerAndNotify(page: Page, answerText: string) {
  await page.evaluate(
    async ({ answerText, channelName, databaseName, storeName }) => {
      const record = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          const request = indexedDB.open(databaseName, 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const getAll = store.getAll();
            getAll.onerror = () => reject(getAll.error);
            getAll.onsuccess = () => {
              const existing = getAll.result[0] as
                | Record<string, unknown>
                | undefined;
              if (!existing) {
                reject(new Error("Recovery fixture record is missing."));
                return;
              }
              const replacement = { ...existing, answerText };
              store.put(replacement);
              transaction.oncomplete = () => {
                database.close();
                resolve(replacement);
              };
              transaction.onerror = () => reject(transaction.error);
            };
          };
        },
      );

      const channel = new BroadcastChannel(channelName);
      channel.postMessage({
        eventId: crypto.randomUUID(),
        key: record.key,
        savedAt: record.savedAt,
        schemaVersion: record.schemaVersion,
      });
      channel.close();
    },
    {
      answerText,
      channelName: "talkpik-writing-recovery",
      databaseName: RECOVERY_DATABASE,
      storeName: RECOVERY_STORE,
    },
  );
}

function isDraftWrite(page: Page, url: string, method: string) {
  const target = new URL(url);
  const pageOrigin = new URL(page.url()).origin;
  return (
    target.origin !== pageOrigin &&
    target.pathname === "/rest/v1/writing_drafts" &&
    (method === "POST" || method === "PATCH")
  );
}

test.describe("guarded local draft persistence", () => {
  test.skip(
    !canRunLocalMutationTest,
    "writing resilience browser storage tests require the guarded local stack",
  );
  test.beforeEach(clearLocalStudentDrafts);
  test.afterEach(clearLocalStudentDrafts);

  test("failed autosave keeps a real IndexedDB copy and retry clears it", async ({
    page,
  }) => {
    let blockDraftWrites = true;
    let blockedWriteCount = 0;
    await page.route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (
        blockDraftWrites &&
        isDraftWrite(page, request.url(), request.method())
      ) {
        blockedWriteCount += 1;
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    const answer = `indexeddb recovery ${Date.now()} with enough length`;
    await page.locator("textarea").first().fill(answer);

    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(() => readRecoveryRecords(page))
      .toEqual([
        expect.objectContaining({
          answerText: expect.stringContaining(answer),
          key: expect.any(String),
        }),
      ]);
    expect(blockedWriteCount).toBeGreaterThan(0);

    blockDraftWrites = false;
    await page.getByTestId("autosave-warning-retry").click();
    await expect(page.getByTestId("autosave-warning-modal")).toBeHidden();
    await expect.poll(() => readRecoveryRecords(page)).toEqual([]);
  });

  test("a second tab requires an explicit recovery choice and can restore the prior copy", async ({
    page,
  }) => {
    await page.context().route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (isDraftWrite(page, request.url(), request.method())) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    const secondPage = await page.context().newPage();
    await secondPage.goto(WRITING_PATH, { waitUntil: "networkidle" });

    const answer = `cross tab recovery ${Date.now()} with enough length`;
    await page.locator("textarea").first().fill(answer);

    const conflict = secondPage.getByTestId("writing-recovery-conflict-modal");
    await expect(conflict).toBeVisible({ timeout: 10_000 });
    await expect(
      secondPage.getByTestId("writing-recovery-prior-time"),
    ).toBeVisible();
    await expect(
      secondPage.getByTestId("writing-recovery-current-time"),
    ).toBeVisible();

    await secondPage.getByTestId("writing-recovery-choose-prior").click();
    await expect(conflict).toBeHidden();
    await expect(secondPage.locator("textarea").first()).toHaveValue(answer);

    await clearRecoveryRecords(secondPage);
    await secondPage.close();
  });

  test("reopening the page can explicitly discard the prior copy and keep the current server content", async ({
    page,
  }) => {
    await page.context().route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (isDraftWrite(page, request.url(), request.method())) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    const answer = `discardable recovery ${Date.now()} with enough length`;
    await page.locator("textarea").first().fill(answer);
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    await expect.poll(() => readRecoveryRecords(page)).toHaveLength(1);

    await page.close();
    const reopenedPage = await page.context().newPage();
    await reopenedPage.goto(WRITING_PATH, { waitUntil: "networkidle" });

    const conflict = reopenedPage.getByTestId(
      "writing-recovery-conflict-modal",
    );
    await expect(conflict).toBeVisible({ timeout: 10_000 });
    await reopenedPage.getByTestId("writing-recovery-choose-current").click();
    await expect(conflict).toBeHidden();
    await expect(reopenedPage.locator("textarea").first()).toHaveValue("");
    await expect.poll(() => readRecoveryRecords(reopenedPage)).toEqual([]);

    await reopenedPage.close();
  });

  test("choosing dirty current content saves it before reload", async ({
    page,
  }) => {
    let blockDraftWrites = true;
    await page.route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (
        blockDraftWrites &&
        isDraftWrite(page, request.url(), request.method())
      ) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    const currentAnswer = `dirty current ${Date.now()} with enough length`;
    await page.locator("textarea").first().fill(currentAnswer);
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    const [recoveryRecord] = await expect
      .poll(() => readRecoveryRecords(page))
      .toHaveLength(1)
      .then(() => readRecoveryRecords(page));
    expect(recoveryRecord?.problemId).toEqual(expect.any(String));
    await page.getByTestId("autosave-warning-keep").click();

    await replaceRecoveryAnswerAndNotify(page, "different prior copy");
    await expect(
      page.getByTestId("writing-recovery-conflict-modal"),
    ).toBeVisible({ timeout: 10_000 });

    blockDraftWrites = false;
    await page.getByTestId("writing-recovery-choose-current").click();
    await expect(
      page.getByTestId("writing-recovery-conflict-modal"),
    ).toBeHidden();
    await expect.poll(() => readRecoveryRecords(page)).toEqual([]);

    await page.goto(
      `${WRITING_PATH}?problem=${encodeURIComponent(String(recoveryRecord?.problemId))}`,
      { waitUntil: "networkidle" },
    );
    await expect(page.locator("textarea").first()).toHaveValue(currentAnswer);
  });

  test("save and leave waits for a successful save before navigation", async ({
    page,
  }) => {
    let blockDraftWrites = true;
    await page.route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (
        blockDraftWrites &&
        isDraftWrite(page, request.url(), request.method())
      ) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    await page
      .locator("textarea")
      .first()
      .fill(`save before leave ${Date.now()} with enough length`);
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("autosave-warning-keep").click();
    await expect(page.getByTestId("autosave-warning-modal")).toBeHidden();

    await page.locator(".writing-exam-header__back").click();
    await expect(page.getByTestId("autosave-warning-retry")).toContainText(
      "저장 후 이동",
    );
    blockDraftWrites = false;
    await page.getByTestId("autosave-warning-retry").click();
    await expect(page).toHaveURL(/\/practice\/problems/);
  });

  test("save and leave stays on the writing page when saving still fails", async ({
    page,
  }) => {
    await page.route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (isDraftWrite(page, request.url(), request.method())) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    await page
      .locator("textarea")
      .first()
      .fill(`failed leave ${Date.now()} with enough length`);
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("autosave-warning-keep").click();
    await expect(page.getByTestId("autosave-warning-modal")).toBeHidden();

    await page.locator(".writing-exam-header__back").click();
    await page.getByTestId("autosave-warning-retry").click();
    await expect(page).toHaveURL(new RegExp(`${WRITING_PATH}$`));
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible();
  });

  test("submit waits for the latest server save and never dispatches after that save fails", async ({
    page,
  }) => {
    let blockedDraftWriteCount = 0;
    let serverActionCount = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        serverActionCount += 1;
      }
    });
    await page.route("**/rest/v1/writing_drafts*", async (route) => {
      const request = route.request();
      if (isDraftWrite(page, request.url(), request.method())) {
        blockedDraftWriteCount += 1;
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      await route.continue();
    });

    await page.goto(WRITING_PATH, { waitUntil: "networkidle" });
    await clearRecoveryRecords(page);
    await page.locator("textarea").first().fill("a".repeat(80));
    await page.locator(".writing-exam-header__submit-button").click();
    await expect(page.getByTestId("submission-confirm-modal")).toBeVisible();

    const actionsBeforeSubmit = serverActionCount;
    await page.getByTestId("submission-confirm-submit").click();

    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    expect(blockedDraftWriteCount).toBeGreaterThan(0);
    expect(serverActionCount).toBe(actionsBeforeSubmit);
    await expect
      .poll(() => readRecoveryRecords(page))
      .toEqual([
        expect.objectContaining({
          answerText: expect.stringContaining("a".repeat(40)),
        }),
      ]);
  });
});

for (const writingCase of [
  { path: "/writing/long-form-writing-53", questionNo: 53 },
  { path: "/writing/essay-writing-54", questionNo: 54 },
] as const) {
  test(`Q${writingCase.questionNo} keeps the exit guard after choosing dirty current content`, async ({
    page,
  }) => {
    const unexpectedMutations: string[] = [];
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      if (isDraftWrite(page, request.url(), request.method())) {
        await route.fulfill({
          body: JSON.stringify({ message: "controlled autosave failure" }),
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 503,
        });
        return;
      }
      const requestUrl = new URL(request.url());
      if (
        ["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
        (request.method() === "POST" &&
          requestUrl.pathname.startsWith("/rest/v1/rpc/"))
      ) {
        await route.continue();
        return;
      }
      if (
        request.method() === "POST" &&
        requestUrl.pathname === "/rest/v1/study_events"
      ) {
        await route.fulfill({
          body: "[]",
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          status: 201,
        });
        return;
      }
      unexpectedMutations.push(
        `${request.method()} ${requestUrl.pathname}`,
      );
      await route.fulfill({
        body: JSON.stringify({ message: "unexpected mutation blocked" }),
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        status: 409,
      });
    });

    await page.goto(`${writingCase.path}?fresh=1`, {
      waitUntil: "networkidle",
    });
    test.skip(
      (await page.locator("textarea").count()) === 0,
      `Canonical Q${writingCase.questionNo} browser fixture is unavailable in this environment.`,
    );
    await clearRecoveryRecords(page);
    const answer = `q${writingCase.questionNo} dirty current ${Date.now()} with enough length`;
    await page.locator("textarea").first().fill(answer);
    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("autosave-warning-keep").click();

    await replaceRecoveryAnswerAndNotify(page, "different prior copy");
    await expect(
      page.getByTestId("writing-recovery-conflict-modal"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("현재 작성 중인 내용")).toBeVisible();
    await expect(page.getByTestId("writing-recovery-current-time")).toHaveText(
      "아직 저장되지 않음",
    );

    await page.getByTestId("writing-recovery-choose-current").click();
    await expect(
      page.getByTestId("writing-recovery-conflict-modal"),
    ).toBeHidden();
    await expect(page.locator("textarea").first()).toHaveValue(answer);
    await page
      .getByTestId("autosave-warning-modal")
      .waitFor({ state: "visible", timeout: 1_500 })
      .catch(() => undefined);
    if (await page.getByTestId("autosave-warning-modal").isVisible()) {
      await page.getByTestId("autosave-warning-keep").click();
    }
    await page.locator(".writing-exam-header__back").click();

    await expect(page.getByTestId("autosave-warning-modal")).toBeVisible();
    await expect(page.getByTestId("autosave-warning-retry")).toContainText(
      "저장 후 이동",
    );
    await expect(page).toHaveURL(new RegExp(`${writingCase.path}\\?fresh=1$`));
    expect(unexpectedMutations).toEqual([]);
    await clearRecoveryRecords(page);
  });
}
