import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// X-05 /profile phone number save + delete. Uses a per-test temp user seeded
// with a complete required profile + required consents so it passes the workspace
// gate, and overrides the shared STUDENT_STATE storageState with an in-test login
// so it never dirties the shared account.
test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

type RequiredDoc = {
  id: string;
  doc_type: "terms" | "privacy";
  version: string;
  effective_at: string | null;
  created_at: string;
};

type TempProfileUser = {
  admin: SupabaseClient;
  email: string;
  password: string;
  userId: string;
};

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

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

async function waitForProfileNickname(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,nickname")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.nickname) return data.nickname as string;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("profile row was not created in time");
}

function latestByDocType(rows: RequiredDoc[]): RequiredDoc[] {
  const latest = new Map<RequiredDoc["doc_type"], RequiredDoc>();
  for (const row of rows) {
    const t = Date.parse(row.effective_at ?? row.created_at);
    const current = latest.get(row.doc_type);
    if (
      !current ||
      t > Date.parse(current.effective_at ?? current.created_at)
    ) {
      latest.set(row.doc_type, row);
    }
  }
  return [...latest.values()];
}

// Trusted (source_policy_id set or placeholder) published required docs, latest
// per doc_type — mirrors the application consent gate so seeded consents satisfy it.
async function getTrustedRequiredDocs(
  admin: SupabaseClient,
): Promise<RequiredDoc[]> {
  const { data, error } = await admin
    .from("legal_documents")
    .select("id, doc_type, version, effective_at, created_at")
    .eq("locale", "ko")
    .eq("requires_consent", true)
    .eq("status", "published")
    .or("source_policy_id.not.is.null,is_placeholder.is.true");
  if (error) throw error;
  return latestByDocType((data ?? []) as RequiredDoc[]);
}

async function skipIfPhoneColumnsMissing(admin: SupabaseClient) {
  const { error } = await admin
    .from("profiles")
    .select("phone_country_code,phone_number")
    .limit(1);
  test.skip(
    !!error,
    "profiles phone columns are not applied on this environment; apply migration 20260709153000/20260709165000 first.",
  );
}

async function createTempProfileUser(): Promise<TempProfileUser> {
  const admin = createAdminClient();
  await skipIfPhoneColumnsMissing(admin);

  const docs = await getTrustedRequiredDocs(admin);
  test.skip(
    docs.length < 2,
    "Published required legal documents (terms + privacy) are missing on this environment.",
  );

  const stamp = Date.now();
  const email = `profile-phone-e2e-${stamp}@example.com`;
  const password = `Profile-${stamp}!Aa1`;

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {},
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  const nickname = await waitForProfileNickname(admin, userId);

  // Complete required profile so the workspace gate does not bounce to /auth/consent.
  const updated = await admin
    .from("profiles")
    .update({
      display_name: "전화 편집 테스트",
      nationality_country_code: "KR",
      nickname,
      // Start with NO phone so the save path is exercised from empty.
      phone_country_code: null,
      phone_number: null,
    })
    .eq("id", userId);
  if (updated.error) throw updated.error;

  // Record required consents (trusted docs) so the gate treats consent as complete.
  const consentRows = docs.map((doc) => ({
    user_id: userId,
    document_id: doc.id,
    doc_type: doc.doc_type,
    version: doc.version,
    source: "signup" as const,
  }));
  const consent = await admin.from("user_consents").insert(consentRows);
  if (consent.error) throw consent.error;

  return { admin, email, password, userId };
}

async function signIn(page: Page, user: TempProfileUser) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="email"]').fill(user.email);
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(user.password);
  await page.locator('button[type="submit"]').click();
  // Complete + consented user never lands on the consent gate; it routes to
  // onboarding (no learning goal yet) or dashboard.
  await page.waitForURL((url) => !/\/login/.test(url.pathname), {
    timeout: 20_000,
  });
  await page.waitForLoadState("networkidle");
}

async function readPhone(user: TempProfileUser) {
  const { data, error } = await user.admin
    .from("profiles")
    .select("phone_country_code,phone_number")
    .eq("id", user.userId)
    .single();
  if (error) throw error;
  return data as {
    phone_country_code: string | null;
    phone_number: string | null;
  };
}

test("X-05 profile phone number saves, persists across reload, and clears", async ({
  page,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Supabase URL and service role key are required for this e2e flow.",
  );
  test.skip(
    process.env.SUPABASE_ENV_LABEL === "prod",
    "This e2e creates a temporary user; never run it against production.",
  );

  const errors = collectErrors(page);
  const user = await createTempProfileUser();
  const saveButton = page.getByRole("button", { name: "프로필 저장" });
  const phoneInput = page.locator("#phoneNumber");

  try {
    await signIn(page, user);

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole("heading", { name: "프로필" })).toBeVisible();

    // Initially empty and save disabled (no dirty change).
    await expect(phoneInput).toHaveValue("");
    await expect(saveButton).toBeDisabled();

    // Save a phone number.
    await phoneInput.fill("01099998888");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    // Successful save resets dirty state -> button disabled again.
    await expect(saveButton).toBeDisabled({ timeout: 15_000 });

    // DB persisted with KR country code (default) + local number.
    const saved = await readPhone(user);
    expect(saved.phone_country_code).toBe("KR");
    expect(saved.phone_number).toBe("01099998888");

    // Persisted across a fresh navigation (re-fetches server data).
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(phoneInput).toHaveValue("01099998888");

    // Delete the phone number (clear + save).
    await phoneInput.fill("");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(saveButton).toBeDisabled({ timeout: 15_000 });

    // DB cleared: both local number and country code become null.
    const cleared = await readPhone(user);
    expect(cleared.phone_number).toBeNull();
    expect(cleared.phone_country_code).toBeNull();

    // Cleared value persists across reload.
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(phoneInput).toHaveValue("");

    expect(errors).toEqual([]);
  } finally {
    await user.admin.auth.admin.deleteUser(user.userId);
  }
});
