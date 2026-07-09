import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

type TempAuthGateData = {
  admin: SupabaseClient;
  documents: RequiredConsentDocument[];
  email: string;
  generatedNickname: string;
  password: string;
  userId: string;
};

type RequiredConsentDocument = {
  id: string;
  doc_type: "terms" | "privacy";
  locale: string;
  title: string;
  version: string;
  effective_at: string | null;
  created_at: string;
};

const REQUIRED_DOC_TYPES: RequiredConsentDocument["doc_type"][] = [
  "privacy",
  "terms",
];

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

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function rowTime(row: RequiredConsentDocument): number {
  return Date.parse(row.effective_at ?? row.created_at);
}

function latestByDocType(
  rows: RequiredConsentDocument[],
): RequiredConsentDocument[] {
  const latest = new Map<
    RequiredConsentDocument["doc_type"],
    RequiredConsentDocument
  >();

  for (const row of rows) {
    const current = latest.get(row.doc_type);
    if (!current || rowTime(row) > rowTime(current)) {
      latest.set(row.doc_type, row);
    }
  }

  return REQUIRED_DOC_TYPES.flatMap((docType) => {
    const doc = latest.get(docType);
    return doc ? [doc] : [];
  });
}

function isStaleE2EDocument(row: RequiredConsentDocument): boolean {
  return (
    row.version.startsWith("e2e-auth-gate-") ||
    row.title === "E2E Terms" ||
    row.title === "E2E Privacy"
  );
}

async function getCurrentRequiredDocuments(
  admin: SupabaseClient,
): Promise<RequiredConsentDocument[]> {
  const { data, error } = await admin
    .from("legal_documents")
    .select("id, doc_type, locale, title, version, effective_at, created_at")
    .eq("locale", "ko")
    .eq("requires_consent", true)
    .eq("status", "published")
    .or("source_policy_id.not.is.null,is_placeholder.is.true");

  if (error) throw error;

  const currentDocuments = latestByDocType(
    (data ?? []) as RequiredConsentDocument[],
  );
  const staleDocuments = currentDocuments.filter(isStaleE2EDocument);
  if (staleDocuments.length > 0) {
    throw new Error(
      `Stale E2E legal documents are published as current required docs: ${staleDocuments
        .map((doc) => `${doc.doc_type}:${doc.version}`)
        .join(", ")}`,
    );
  }

  return currentDocuments;
}

function skipIfRequiredDocumentsMissing(documents: RequiredConsentDocument[]) {
  const presentDocTypes = new Set(documents.map((doc) => doc.doc_type));
  const missingDocTypes = REQUIRED_DOC_TYPES.filter(
    (docType) => !presentDocTypes.has(docType),
  );
  test.skip(
    missingDocTypes.length > 0,
    `Published required legal documents are missing for: ${missingDocTypes.join(
      ", ",
    )}`,
  );
}

async function skipIfOptionalProfileColumnsMissing(admin: SupabaseClient) {
  const { error } = await admin.from("profiles").select("gender").limit(1);
  test.skip(
    !!error,
    "profiles.gender is not applied on this environment; apply migration 20260709153000 before running auth completion optional-profile e2e.",
  );
}

async function createTempAuthGateData({
  completeProfile = false,
}: {
  completeProfile?: boolean;
} = {}): Promise<TempAuthGateData> {
  const admin = createAdminClient();
  const documents = await getCurrentRequiredDocuments(admin);
  skipIfRequiredDocumentsMissing(documents);
  await skipIfOptionalProfileColumnsMissing(admin);

  const stamp = Date.now();
  const email = `auth-gate-e2e-${stamp}@example.com`;
  const password = `Gate-${stamp}!Aa1`;

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
      display_name: completeProfile ? "Consent Guard User" : null,
      gender: completeProfile ? "female" : null,
      nationality_country_code: completeProfile ? "KR" : null,
      nickname: profile.nickname,
      phone_number: completeProfile ? "01012345678" : null,
    })
    .eq("id", userId);
  if (updated.error) throw updated.error;

  return {
    admin,
    documents,
    email,
    generatedNickname: profile.nickname,
    password,
    userId,
  };
}

async function cleanupTempAuthGateData(data: TempAuthGateData) {
  await data.admin.auth.admin.deleteUser(data.userId);
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
  await page
    .locator(".ant-select-item-option")
    .filter({ hasText: label })
    .click();
}

async function selectGender(page: Page, label: string) {
  await page.getByRole("radio", { name: label }).click();
}

async function attachEvidenceScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function expectRequiredConsentDocuments(
  page: Page,
  documents: RequiredConsentDocument[],
) {
  await expect(page.getByTestId("auth-consent-document-card")).toHaveCount(
    documents.length,
  );
  for (const doc of documents) {
    await expect(page.getByText(doc.title, { exact: true })).toBeVisible();
  }
}

async function expectNoCurrentRequiredConsents(data: TempAuthGateData) {
  const { data: consents, error } = await data.admin
    .from("user_consents")
    .select("document_id")
    .eq("user_id", data.userId)
    .in(
      "document_id",
      data.documents.map((doc) => doc.id),
    );
  if (error) throw error;

  expect(consents).toHaveLength(0);
}

async function expectAuthGateSaved(data: TempAuthGateData) {
  const { data: profile, error: profileError } = await data.admin
    .from("profiles")
    .select(
      "display_name,gender,nationality_country_code,nickname,phone_number",
    )
    .eq("id", data.userId)
    .single();
  if (profileError) throw profileError;

  expect(profile?.display_name).toBe("민준");
  expect(profile?.gender).toBe("female");
  expect(profile?.nationality_country_code).toBe("KR");
  expect(profile?.nickname).toBe(data.generatedNickname);
  expect(profile?.phone_number).toBe("01012345678");

  const { data: consents, error: consentError } = await data.admin
    .from("user_consents")
    .select("document_id,source")
    .eq("user_id", data.userId)
    .in(
      "document_id",
      data.documents.map((doc) => doc.id),
    );
  if (consentError) throw consentError;

  expect(consents).toHaveLength(data.documents.length);
  expect(consents?.every((row) => row.source === "signup")).toBe(true);
}

test("auth completion gate renders profile fields and current required consent documents in one card", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "Auth completion e2e creates temporary users; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData();

  try {
    await signInToAuthConsent(page, tempData);

    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expectRequiredConsentDocuments(page, tempData.documents);
    await expect(page.locator("form")).toHaveCount(1);
    await expect(page.locator('input[name="display_name"]')).toBeVisible();
    await expect(page.locator('input[name="nickname"]')).toHaveValue(
      /talkpik-/,
    );
    await expect(page.getByTestId("auth-consent-country-select")).toBeVisible();
    await expect(page.getByRole("radio", { name: "남성" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "여성" })).toBeVisible();
    await expect(page.getByLabel(/전화번호/)).toBeVisible();
    await expect(page.locator('input[name="accept"]')).toHaveCount(1);
    await expectNoCurrentRequiredConsents(tempData);
    await attachEvidenceScreenshot(
      page,
      testInfo,
      `consent-required-${testInfo.project.name}`,
    );

    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/auth\/consent\?.*error=required/, {
      timeout: 10_000,
    });
    await expect(
      page.getByText(
        /계속하려면 필수 정보를 입력하고 필요한 동의에 체크해야 합니다/,
      ),
    ).toBeVisible();

    await attachEvidenceScreenshot(
      page,
      testInfo,
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
    "Auth completion e2e creates temporary users; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData();

  try {
    await signInToAuthConsent(page, tempData);
    await expectNoCurrentRequiredConsents(tempData);

    await page.locator('input[name="display_name"]').fill("민준");
    await expect(page.locator('input[name="nickname"]')).toHaveValue(
      tempData.generatedNickname,
    );
    await selectCountryRegion(page, "대한민국");
    await selectGender(page, "여성");
    await page.getByLabel(/전화번호/).fill("01012345678");
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
    await attachEvidenceScreenshot(
      page,
      testInfo,
      `consent-completed-${testInfo.project.name}`,
    );

    await expectAuthGateSaved(tempData);
    expect(errors).toEqual([]);
  } finally {
    await cleanupTempAuthGateData(tempData);
  }
});

test("auth consent hard reload keeps users with missing required consent on the consent gate", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "Auth completion e2e creates temporary users; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData({ completeProfile: true });

  try {
    await signInToAuthConsent(page, tempData);
    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expectRequiredConsentDocuments(page, tempData.documents);
    await expectNoCurrentRequiredConsents(tempData);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/auth\/consent/);
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expectRequiredConsentDocuments(page, tempData.documents);
    await attachEvidenceScreenshot(
      page,
      testInfo,
      `consent-reload-guard-${testInfo.project.name}`,
    );

    expect(errors).toEqual([]);
  } finally {
    await cleanupTempAuthGateData(tempData);
  }
});

test("dashboard direct reload is blocked until required consent is accepted", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "Auth completion e2e creates temporary users; never run it against production.",
  );

  const errors = collectErrors(page);
  const tempData = await createTempAuthGateData({ completeProfile: true });

  try {
    await signInToAuthConsent(page, tempData);
    await expectNoCurrentRequiredConsents(tempData);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/consent/, { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/auth\/consent/);
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expectRequiredConsentDocuments(page, tempData.documents);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/auth\/consent/);
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("auth-consent-card")).toBeVisible();
    await expectRequiredConsentDocuments(page, tempData.documents);
    await attachEvidenceScreenshot(
      page,
      testInfo,
      `dashboard-direct-reload-guard-${testInfo.project.name}`,
    );

    expect(errors).toEqual([]);
  } finally {
    await cleanupTempAuthGateData(tempData);
  }
});
