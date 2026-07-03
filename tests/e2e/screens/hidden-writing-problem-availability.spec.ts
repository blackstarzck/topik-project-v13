import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
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
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const createdLibraryItemIds: string[] = [];
const createdProblemIds: string[] = [];

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
      "Missing Supabase service credentials for hidden problem e2e setup",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createHiddenProblemFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const marker = `e2e-hidden-${randomUUID().slice(0, 8)}`;
  const softProblemId = randomUUID();
  const hardProblemId = randomUUID();
  const softLibraryId = randomUUID();
  const hardLibraryId = randomUUID();
  const reason = "Operating policy E2E reason";

  const problems = await sb.from("problems").insert([
    {
      id: softProblemId,
      source: "curated",
      domain: "writing",
      question_no: 53,
      topik_level: 2,
      difficulty: 3,
      title: `E2E soft unavailable ${marker}`,
      prompt: "Fixture prompt for a soft unavailable writing problem.",
      tags: [marker, "soft-unavailable"],
      publish_status: "published",
      review_status: "approved",
      visibility: "public",
      lifecycle_status: "inactive",
      lifecycle_reason: reason,
    },
    {
      id: hardProblemId,
      source: "curated",
      domain: "writing",
      question_no: 54,
      topik_level: 2,
      difficulty: 4,
      title: `E2E hard hidden ${marker}`,
      prompt: "Fixture prompt for a hard hidden writing problem.",
      tags: [marker, "hard-hidden"],
      publish_status: "archived",
      review_status: "approved",
      visibility: "private",
      lifecycle_status: "inactive",
      lifecycle_reason: "Hard hidden fixture reason must not leak.",
    },
  ]);
  if (problems.error) throw problems.error;

  const library = await sb.from("library_items").insert([
    {
      id: softLibraryId,
      user_id: user.id,
      item_type: "problem",
      problem_id: softProblemId,
      tags: [marker, "soft-unavailable"],
      saved_at: new Date(Date.now() + 1000).toISOString(),
    },
    {
      id: hardLibraryId,
      user_id: user.id,
      item_type: "problem",
      problem_id: hardProblemId,
      tags: [marker, "hard-hidden"],
      saved_at: new Date().toISOString(),
    },
  ]);
  if (library.error) throw library.error;

  createdProblemIds.push(softProblemId, hardProblemId);
  createdLibraryItemIds.push(softLibraryId, hardLibraryId);

  return {
    hardTitle: `E2E hard hidden ${marker}`,
    marker,
    reason,
    softTitle: `E2E soft unavailable ${marker}`,
  };
}

async function cleanupHiddenProblemFixtures() {
  if (createdLibraryItemIds.length === 0 && createdProblemIds.length === 0) {
    return;
  }
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;
  const sb = serviceClient();
  for (const id of createdLibraryItemIds) {
    await sb.from("library_items").delete().eq("id", id);
  }
  for (const id of createdProblemIds) {
    await sb.from("problems").delete().eq("id", id);
  }
  createdLibraryItemIds.length = 0;
  createdProblemIds.length = 0;
}

test.afterEach(cleanupHiddenProblemFixtures);
test.afterAll(cleanupHiddenProblemFixtures);

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "Hidden problem e2e requires Supabase service credentials for isolated rows",
);
test.skip(
  ENV_LABEL === "prod" || ENV_LABEL === "production",
  "Hidden problem e2e must not seed production data",
);

test("hidden saved writing problems fade the entire row without leaking hard-hidden metadata", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const fixture = await createHiddenProblemFixture();

  // The saved-item drilldown moved from /library?tab=problems to the dedicated
  // /library/problems route (commit a0c4c5f4 "Keep library dashboard focused
  // while preserving saved-item drilldown"); /library now renders the dashboard
  // without a search box (see library.spec.ts assertions).
  await page.goto("/library/problems", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);

  const searchInput = page
    .getByTestId("library-problems-search")
    .locator("input");
  // Wait for the library search box to hydrate before typing — the row-fixture
  // list can otherwise still be mounting when fill() fires.
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(fixture.marker);
  await expect(page.getByTestId("library-problems-result-count")).toContainText(
    "2",
  );
  await expect(page.getByTestId("library-item-row")).toHaveCount(2);

  const listText = await page.getByTestId("library-item-list").innerText();
  expect(listText).toContain(fixture.marker);
  expect(listText).toContain(fixture.reason);
  expect(listText).not.toContain(fixture.hardTitle);

  const rowClasses = await page
    .getByTestId("library-item-row")
    .evaluateAll((rows) => rows.map((row) => row.className));
  expect(rowClasses).toHaveLength(2);
  for (const className of rowClasses) {
    expect(className).toContain("opacity-40");
    expect(className).toContain("border-[var(--ant-color-border-secondary)]");
    expect(className).not.toContain("border-border");
  }

  const borderColors = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="library-item-row"]');
    if (!row) return null;
    return {
      row: getComputedStyle(row).borderBottomColor,
    };
  });
  expect(borderColors).not.toBeNull();
  expect(borderColors?.row).toMatch(/^(rgb|color)\(/);
  expect(borderColors?.row).not.toBe("rgba(0, 0, 0, 0)");
  expect(borderColors?.row).not.toBe("transparent");

  await expect(
    page.getByTestId("library-problem-unavailable-badge"),
  ).toHaveCount(2);
  expect(
    await page
      .getByTestId("library-item-row")
      .locator("button[disabled]")
      .count(),
  ).toBeGreaterThanOrEqual(2);

  mkdirSync(path.join(process.cwd(), "output", "playwright"), {
    recursive: true,
  });
  await page.screenshot({
    path: path.join(
      process.cwd(),
      "output",
      "playwright",
      `hidden-writing-problem-library-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  });

  expect(errors).toEqual([]);
});
