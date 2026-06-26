import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

const EVIDENCE_DIR = path.join(
  "docs",
  "qa",
  "reports",
  "auth-post-auth-gate",
);

type TempAuthGateData = {
  admin: SupabaseClient;
  docIds: string[];
  email: string;
  generatedNickname: string;
  password: string;
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

async function waitForProfile(admin: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,nickname")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string; nickname: string | null };
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("profile row was not created in time");
}

async function createTempAuthGateData(): Promise<TempAuthGateData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const stamp = Date.now();
  const version = `e2e-auth-gate-${stamp}`;
  const email = `auth-gate-e2e-${stamp}@example.com`;
  const password = `Gate-${stamp}!Aa1`;
  const docIds: string[] = [];

  const insertedDocs = await admin
    .from("legal_documents")
    .insert([
      {
        body: "<h2>E2E Terms Body</h2><p>Terms body from admin-published legal document.</p>",
        doc_type: "terms",
        effective_at: new Date().toISOString(),
        is_placeholder: false,
        locale: "ko",
        requires_consent: true,
        status: "published",
        summary: "Terms summary from admin settings.",
        title: "E2E Terms",
        version,
      },
      {
        body: "<h2>E2E Privacy Body</h2><p>Privacy body from admin-published legal document.</p>",
        doc_type: "privacy",
        effective_at: new Date().toISOString(),
        is_placeholder: false,
        locale: "ko",
        requires_consent: true,
        status: "published",
        summary: "Privacy summary from admin settings.",
        title: "E2E Privacy",
        version,
      },
    ])
    .select("id");

  if (insertedDocs.error) throw insertedDocs.error;
  docIds.push(...(insertedDocs.data ?? []).map((row) => row.id as string));

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {},
  });
  if (created.error) throw created.error;

  const userId = created.data.user.id;
  const profile = await waitForProfile(admin, userId);
  if (!profile.nickname?.startsWith("talkpik-")) {
    throw new Error(
      "auth completion migrations are not aligned: generated profile nickname is missing.",
    );
  }
  const updated = await admin
    .from("profiles")
    .update({
      display_name: null,
      nationality_country_code: null,
      nickname: profile.nickname,
    })
    .eq("id", userId);
  if (updated.error) throw updated.error;

  return {
    admin,
    docIds,
    email,
    generatedNickname: profile.nickname,
    password,
    userId,
  };
}

async function cleanupTempAuthGateData(data: TempAuthGateData) {
  await data.admin.auth.admin.deleteUser(data.userId);
  if (data.docIds.length > 0) {
    const deletedDocs = await data.admin
      .from("legal_documents")
      .delete()
      .in("id", data.docIds);
    if (deletedDocs.error) throw deletedDocs.error;
  }
}

async function signInToAuthConsent(page: Page, tempData: TempAuthGateData) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="email"]').fill(tempData.email);
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(tempData.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/auth\/consent/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

async function selectCountryRegion(page: Page, label: string) {
  await page.getByTestId("auth-consent-country-select").click();
  await page.locator(".ant-select-item-option").filter({ hasText: label }).click();
}

async function saveEvidenceScreenshot(page: Page, name: string) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${name}.png`),
  });
}

async function expectAuthGateSaved(data: TempAuthGateData) {
  const { data: profile, error: profileError } = await data.admin
    .from("profiles")
    .select("display_name,nationality_country_code,nickname")
    .eq("id", data.userId)
    .single();
  if (profileError) throw profileError;

  expect(profile?.display_name).toBe("민준");
  expect(profile?.nationality_country_code).toBe("KR");
  expect(profile?.nickname).toBe(data.generatedNickname);

  const { data: consents, error: consentError } = await data.admin
    .from("user_consents")
    .select("document_id,source")
    .eq("user_id", data.userId)
    .in("document_id", data.docIds);
  if (consentError) throw consentError;

  expect(consents).toHaveLength(data.docIds.length);
  expect(consents?.every((row) => row.source === "signup")).toBe(true);
}

test("auth completion gate renders profile fields and admin-published consent documents in one card", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "Auth completion e2e creates temporary users and legal documents; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData();

  try {
    await signInToAuthConsent(page, tempData);

    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expect(page.getByTestId("auth-consent-document-card")).toHaveCount(2);
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.locator('input[name="display_name"]')).toBeVisible();
    await expect(page.locator('input[name="nickname"]')).toHaveValue(
      /talkpik-/,
    );
    await expect(page.getByTestId("auth-consent-country-select")).toBeVisible();
    await expect(page.getByText("E2E Terms", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Privacy", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E Terms Body")).toBeVisible();
    await expect(page.getByText("E2E Privacy Body")).toBeVisible();
    await expect(page.locator('input[name="accept"]')).toHaveCount(1);
    await saveEvidenceScreenshot(
      page,
      `consent-required-${testInfo.project.name}`,
    );

    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/auth\/consent\?.*error=required/, {
      timeout: 10_000,
    });
    await expect(
      page.getByText(/계속하려면 필수 정보를 입력하고 필요한 동의에 체크해야 합니다/),
    ).toBeVisible();

    await saveEvidenceScreenshot(
      page,
      `consent-required-error-${testInfo.project.name}`,
    );

    expect(errors).toEqual([]);
  } finally {
    await cleanupTempAuthGateData(tempData);
  }
});

test("auth completion gate saves missing profile fields and required consents before continuing", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "Auth completion e2e creates temporary users and legal documents; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData();

  try {
    await signInToAuthConsent(page, tempData);

    await page.locator('input[name="display_name"]').fill("민준");
    await expect(page.locator('input[name="nickname"]')).toHaveValue(
      tempData.generatedNickname,
    );
    await selectCountryRegion(page, "대한민국");
    await page.locator('input[name="accept"]').check();
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(
      (url) => url.pathname === "/onboarding/learning-goal",
      { timeout: 20_000 },
    );
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", {
        name: /학습 목표 설정|Set your learning goal/,
      }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth\/consent\?.*error=save-failed/);
    await saveEvidenceScreenshot(
      page,
      `consent-completed-${testInfo.project.name}`,
    );

    await expectAuthGateSaved(tempData);
    expect(errors).toEqual([]);
  } finally {
    await cleanupTempAuthGateData(tempData);
  }
});
