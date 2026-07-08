import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const MOCK_PORT = 43117;
const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const NON_PROD_ENV_LABELS = new Set([
  "dev",
  "development",
  "local",
  "preview",
  "qa",
  "staging",
  "test",
  "testing",
]);
const DELETE_CONFIRM_KEYWORD = "\uc0ad\uc81c";

type MockRequest = {
  authorization: string | null;
  body: string;
  method: string | undefined;
  url: string | undefined;
};

let mockServer: Server | null = null;
let mockRequests: MockRequest[] = [];
let mockStatus = 200;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
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

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function startMockServer() {
  if (mockServer) return;

  mockServer = createServer(async (request, response) => {
    const body = await readRequestBody(request);
    if (request.method === "DELETE" && request.url === "/api/auth/profile") {
      mockRequests.push({
        authorization: request.headers.authorization ?? null,
        body,
        method: request.method,
        url: request.url,
      });
      response.writeHead(mockStatus, { "content-type": "application/json" });
      response.end(
        mockStatus >= 200 && mockStatus < 300
          ? JSON.stringify({
              success: true,
              message: "Account deleted successfully",
            })
          : JSON.stringify({ detail: "mock external deletion failed" }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ detail: "not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    mockServer!.once("error", reject);
    mockServer!.listen(MOCK_PORT, "127.0.0.1", () => {
      mockServer!.off("error", reject);
      resolve();
    });
  });
}

async function stopMockServer() {
  if (!mockServer) return;
  const server = mockServer;
  mockServer = null;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function serviceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for account delete e2e.",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicClient(): SupabaseClient {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase public credentials for account delete e2e.",
    );
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createTempUser(label: string) {
  const marker = randomUUID().slice(0, 8);
  const email = `e2e-account-delete-${label}-${marker}@example.com`;
  const password = `Delete-${marker}!Aa1`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "E2E Account Delete",
      nationality_country_code: "KR",
      ui_locale: "ko",
      ui_locale_source: "manual",
    },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Supabase did not return a temp user id.");
  return { email, password, userId };
}

async function waitForPasswordSignInReady(email: string, password: string) {
  let lastMessage = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await publicClient().auth.signInWithPassword({
      email,
      password,
    });
    if (!error) {
      await publicClient().auth.signOut();
      return;
    }
    lastMessage = error.message;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Temp user password sign-in was not ready: ${lastMessage}`);
}

async function waitForProfileStatus(userId: string, expected: string) {
  await expect
    .poll(async () => {
      const { data, error } = await serviceClient()
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    })
    .toBe(expected);
}

async function readProfileDeletionState(userId: string) {
  const { data, error } = await serviceClient()
    .from("profiles")
    .select("status,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    deletedAt: (data?.deleted_at as string | null | undefined) ?? null,
    status: (data?.status as string | null | undefined) ?? null,
  };
}

async function cleanupTempUser(userId: string | null) {
  if (!userId || !SUPABASE_URL || !SERVICE_KEY) return;
  if (!NON_PROD_ENV_LABELS.has(ENV_LABEL)) return;
  await serviceClient().auth.admin.deleteUser(userId);
}

async function loginTempUser(page: Page, email: string, password: string) {
  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    for (let fillAttempt = 0; fillAttempt < 3; fillAttempt += 1) {
      await emailInput.fill(email);
      await passwordInput.fill(password);
      if (
        (await emailInput.inputValue()) === email &&
        (await passwordInput.inputValue()) === password
      ) {
        break;
      }
      await page.waitForTimeout(150);
    }

    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(password);
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(
        /\/(dashboard|auth\/consent|onboarding\/learning-goal)/,
        {
          timeout: 30_000,
        },
      );
      break;
    } catch (error) {
      if (attempt === 2 || new URL(page.url()).pathname !== "/login") {
        throw error;
      }
    }
  }

  for (let i = 0; i < 8; i += 1) {
    const pathname = new URL(page.url()).pathname;
    if (pathname === "/dashboard") {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      if (new URL(page.url()).pathname === "/dashboard") return;
      continue;
    }
    if (pathname === "/auth/consent") {
      const accept = page.locator('input[name="accept"]');
      if ((await accept.count()) > 0) {
        await accept.check({ force: true });
      }
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/(dashboard|onboarding\/learning-goal)/, {
        timeout: 20_000,
      });
      continue;
    }
    if (pathname === "/onboarding/learning-goal") {
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL("**/dashboard", { timeout: 20_000 });
      return;
    }
    await page.waitForLoadState("networkidle");
  }

  await expect(page).toHaveURL(/\/dashboard/);
}

function viewportForProject(projectName: string) {
  return projectName === "mobile-360"
    ? { width: 360, height: 720 }
    : { width: 1280, height: 800 };
}

async function withFreshPage<T>(
  browser: Browser,
  projectName: string,
  run: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
    locale: "ko-KR",
    storageState: { cookies: [], origins: [] },
    viewport: viewportForProject(projectName),
  });
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await context.close();
  }
}

async function clearPostAuthGate(page: Page) {
  const pathname = new URL(page.url()).pathname;
  if (pathname === "/auth/consent") {
    const accept = page.locator('input[name="accept"]');
    if ((await accept.count()) > 0) {
      await accept.check({ force: true });
    }
    await page.locator('form button[type="submit"]').click();
    await page
      .waitForURL(/\/(dashboard|onboarding\/learning-goal|settings\/account)/, {
        timeout: 20_000,
      })
      .catch(() => undefined);
    return;
  }

  if (pathname === "/onboarding/learning-goal") {
    await page.locator('form button[type="submit"]').click();
    await page
      .waitForURL(/\/(dashboard|settings\/account)/, { timeout: 20_000 })
      .catch(() => undefined);
  }
}

async function openAccountSettings(page: Page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    if (new URL(page.url()).pathname === "/settings/account") return;
    await clearPostAuthGate(page);
  }

  await expect(page).toHaveURL(/\/settings\/account/);
}

async function submitAccountDeletion(page: Page) {
  await openAccountSettings(page);
  await expect(page).toHaveURL(/\/settings\/account/);
  await page.getByTestId("account-delete-open").click();
  const submit = page.getByTestId("account-delete-confirm-submit");
  await expect(submit).toBeDisabled();
  await page
    .getByTestId("account-delete-confirm-input")
    .fill(DELETE_CONFIRM_KEYWORD);
  await expect(submit).toBeEnabled();
  await submit.click();
}

test.beforeAll(async () => {
  await startMockServer();
});

test.afterAll(async () => {
  await stopMockServer();
});

test.beforeEach(() => {
  mockRequests = [];
  mockStatus = 200;
});

test.skip(
  !SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_KEY,
  "Account deletion e2e requires Supabase credentials.",
);
test.skip(
  !NON_PROD_ENV_LABELS.has(ENV_LABEL),
  "Account deletion e2e must not create or delete production data.",
);

test("account deletion calls the external profile API before local deletion", async ({
  browser,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "Account deletion submit e2e runs on desktop and mobile.",
  );
  expect(process.env.TALKPIK_API_BASE_URL).toBe(MOCK_BASE_URL);
  test.setTimeout(120_000);

  let userId: string | null = null;
  const tempUser = await createTempUser("success");
  userId = tempUser.userId;

  try {
    await waitForProfileStatus(userId, "active");
    await waitForPasswordSignInReady(tempUser.email, tempUser.password);

    await withFreshPage(browser, testInfo.project.name, async (page) => {
      const errors = collectErrors(page);
      await loginTempUser(page, tempUser.email, tempUser.password);
      await submitAccountDeletion(page);
      await page.waitForURL(/\/login\?reason=withdrawn/, {
        timeout: 30_000,
      });
      expect(errors).toEqual([]);
    });

    await expect
      .poll(async () => readProfileDeletionState(userId!))
      .toMatchObject({ status: "deleted" });
    const profile = await readProfileDeletionState(userId);
    expect(profile.deletedAt).toEqual(expect.any(String));
    expect(mockRequests).toHaveLength(1);
    expect(mockRequests[0]).toMatchObject({
      body: "",
      method: "DELETE",
      url: "/api/auth/profile",
    });
    expect(mockRequests[0].authorization).toMatch(/^Bearer\s+.+/);
  } finally {
    await cleanupTempUser(userId);
  }
});

test("account deletion keeps the local profile active when the external API fails", async ({
  browser,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "Account deletion submit e2e runs on desktop and mobile.",
  );
  expect(process.env.TALKPIK_API_BASE_URL).toBe(MOCK_BASE_URL);
  test.setTimeout(120_000);

  mockStatus = 500;
  let userId: string | null = null;
  const tempUser = await createTempUser("failure");
  userId = tempUser.userId;

  try {
    await waitForProfileStatus(userId, "active");
    await waitForPasswordSignInReady(tempUser.email, tempUser.password);

    await withFreshPage(browser, testInfo.project.name, async (page) => {
      await loginTempUser(page, tempUser.email, tempUser.password);
      await submitAccountDeletion(page);
      await page.waitForURL(/\/settings\/account/, { timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/login\?reason=withdrawn/);
    });

    await expect
      .poll(async () => readProfileDeletionState(userId!))
      .toMatchObject({ deletedAt: null, status: "active" });
    expect(mockRequests).toHaveLength(1);
    expect(mockRequests[0]).toMatchObject({
      body: "",
      method: "DELETE",
      url: "/api/auth/profile",
    });
    expect(mockRequests[0].authorization).toMatch(/^Bearer\s+.+/);
  } finally {
    await cleanupTempUser(userId);
  }
});
