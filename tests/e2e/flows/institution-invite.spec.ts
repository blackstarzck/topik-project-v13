import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page, type Request } from "@playwright/test";

const INVITE_CODE = "EXPO2026-BOOTH-A";
const AFFILIATION_STORAGE_KEY = "talkpik:affiliation-code";
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const EVIDENCE_DIR = path.join(
  "docs",
  "qa",
  "reports",
  "2026-07-03-institution-invite-expired",
);

async function screenshotEvidence(
  page: Page,
  projectName: string,
  name: string,
) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${name}-${projectName}.png`),
  });
}

function corsHeaders(request: Request) {
  return {
    "access-control-allow-headers":
      request.headers()["access-control-request-headers"] ??
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
  };
}

async function mockProfileAffiliation(
  page: Page,
  affiliationCode: string | null,
) {
  await page.route("**/rest/v1/profiles?*", async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ affiliation_code: affiliationCode }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });
}

async function mockAcceptInviteRpc(page: Page, status = "accepted") {
  const calls: Record<string, unknown>[] = [];

  await page.route(
    "**/rest/v1/rpc/accept_affiliation_invite",
    async (route, request) => {
      if (request.method() === "OPTIONS") {
        await route.fulfill({ headers: corsHeaders(request), status: 204 });
        return;
      }

      calls.push(
        JSON.parse(request.postData() ?? "{}") as Record<string, unknown>,
      );
      await route.fulfill({
        body: JSON.stringify({ status }),
        contentType: "application/json",
        headers: corsHeaders(request),
        status: 200,
      });
    },
  );

  return calls;
}

test.describe("institution invite anonymous entry", () => {
  test.use({
    extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
    locale: "ko-KR",
    storageState: { cookies: [], origins: [] },
  });

  test("routes aff entry to invite choices before sign-up", async ({
    page,
  }) => {
    await page.goto(`/?aff=${INVITE_CODE}`, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(/\/auth\/institution-invite$/);
    await expect(
      page.getByRole("link", {
        name: "새 계정으로 가입하고 기관에 연결",
      }),
    ).toHaveAttribute("href", "/sign-up");
    await expect(
      page.getByRole("link", { name: "기존 계정으로 로그인" }),
    ).toHaveAttribute("href", "/login?next=%2Fauth%2Finstitution-invite");
  });

  test("declines an anonymous invite by clearing the stored code", async ({
    page,
  }) => {
    await page.goto(`/auth/institution-invite?aff=${INVITE_CODE}`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("button", { name: "초대 없이 계속하기" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => window.localStorage.getItem(key),
          AFFILIATION_STORAGE_KEY,
        ),
      )
      .toBeNull();
  });

  test("routes a missing or expired invite to existing-account dashboard login", async ({
    page,
  }, testInfo) => {
    await page.goto("/auth/institution-invite", { waitUntil: "networkidle" });

    await expect(page.getByText("초대 코드가 없거나 만료됐어요")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "기존 계정으로 로그인" }),
    ).toHaveAttribute("href", "/login?next=%2Fdashboard");

    await screenshotEvidence(
      page,
      testInfo.project.name,
      "expired-invite-login",
    );
  });

  test("removes an expired stored invite before showing the no-code state", async ({
    page,
  }) => {
    const capturedAt = Date.now() - THIRTY_MINUTES_MS - 1;
    await page.addInitScript(
      ({ code, capturedAt, expiresAt, storageKey }) => {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ code, capturedAt, expiresAt }),
        );
      },
      {
        capturedAt,
        code: INVITE_CODE,
        expiresAt: capturedAt + THIRTY_MINUTES_MS,
        storageKey: AFFILIATION_STORAGE_KEY,
      },
    );

    await page.goto("/auth/institution-invite", { waitUntil: "networkidle" });

    await expect(page.locator(".institution-invite-code")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => window.localStorage.getItem(key),
          AFFILIATION_STORAGE_KEY,
        ),
      )
      .toBeNull();
  });
});

test.describe("institution invite authenticated entry", () => {
  test.use({
    extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
    locale: "ko-KR",
  });

  test("accepts an invite only after the authenticated CTA is clicked", async ({
    page,
  }) => {
    await mockProfileAffiliation(page, null);
    const rpcCalls = await mockAcceptInviteRpc(page, "accepted");

    await page.goto(`/auth/institution-invite?aff=${INVITE_CODE}`, {
      waitUntil: "networkidle",
    });

    await expect(
      page.getByRole("button", {
        name: "기관에 연결",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "기관에 연결" }),
    ).toBeDisabled();
    expect(rpcCalls).toEqual([]);

    await page.getByRole("checkbox", { name: "동의하시겠습니까?" }).check();
    await expect(
      page.getByRole("button", { name: "기관에 연결" }),
    ).toBeEnabled();

    await page
      .getByRole("button", {
        name: "기관에 연결",
      })
      .click();

    await expect(page.getByText("기관 연결이 완료됐어요")).toBeVisible();
    expect(rpcCalls).toEqual([{ p_code: INVITE_CODE, p_confirmed: true }]);
  });

  test("declines an invite without calling the accept RPC", async ({
    page,
  }) => {
    await mockProfileAffiliation(page, null);
    const rpcCalls = await mockAcceptInviteRpc(page, "accepted");

    await page.goto(`/auth/institution-invite?aff=${INVITE_CODE}`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("link", { name: "연결하지 않고 계속" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(rpcCalls).toEqual([]);
  });

  test("shows a no-switch state for accounts already affiliated elsewhere", async ({
    page,
  }) => {
    await mockProfileAffiliation(page, "OTHER-INSTITUTION");
    const rpcCalls = await mockAcceptInviteRpc(page, "accepted");

    await page.goto(`/auth/institution-invite?aff=${INVITE_CODE}`, {
      waitUntil: "networkidle",
    });

    await expect(
      page.getByText("이미 다른 기관에 연결되어 있어요"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "기관에 연결",
      }),
    ).toHaveCount(0);
    expect(rpcCalls).toEqual([]);
  });

  test("lets an authenticated learner return to the dashboard from a missing or expired invite", async ({
    page,
  }, testInfo) => {
    await page.goto("/auth/institution-invite", { waitUntil: "networkidle" });

    await expect(page.getByText("초대 코드가 없거나 만료됐어요")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "대시보드로 이동" }),
    ).toBeVisible();

    await screenshotEvidence(
      page,
      testInfo.project.name,
      "expired-invite-dashboard",
    );

    await page.getByRole("button", { name: "대시보드로 이동" }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding\/learning-goal)/);
  });
});
