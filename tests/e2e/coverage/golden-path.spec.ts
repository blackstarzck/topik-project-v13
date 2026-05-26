// Phase 7-E Task 13 (Plan rev3) — Golden Path e2e.
//
// 사용자 가입 → 학습 목표 → 대시보드 → 글쓰기 → 피드백 흐름 전체 자동화.
// 본 spec은 Phase 7-A/B/C/D의 통합 검증 책임을 흡수 (각 sub-phase에서 manual QA
// degraded로 처리한 부분).
//
// **현 단계 (Phase 7-E 출시 시점):** spec 골격 + skip 마커. 실제 가입→Mailpit
// 이메일 확인 단계는 외부 dev 환경 의존 (Supabase 로컬 부팅 + Mailpit URL
// 확인 + dev 서버 실행). 본 spec은 **실행 시 자동 skip**되며, CI 또는 사용자가
// `RUN_GOLDEN_PATH=1` env 설정 후 실 환경에서 명시 실행.
//
// Coverage-matrix.spec.ts(81/81)는 본 spec과 별개로 회귀 유지.

import { expect, test } from "@playwright/test";

const RUN_GOLDEN = process.env.RUN_GOLDEN_PATH === "1";

test.skip(!RUN_GOLDEN, "RUN_GOLDEN_PATH=1 env 필요 (Mailpit + Supabase 로컬 의존)");

const TIMESTAMP = Date.now();
const TEST_EMAIL = `audit-golden-${TIMESTAMP}@dev.local`;
const TEST_PASSWORD = "GoldenPath!2026";
const MAILPIT_BASE = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test.describe("Golden Path — 가입→글쓰기→피드백→다음 문제", () => {
  test("X-01 → A-01 sign-up → email confirm → A-03 → B-01 → D-03 → submit → E-02 → R-02", async ({
    page,
    context,
  }) => {
    // 1. X-01 landing
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 2. A-01 sign-up
    await page.getByRole("link", { name: /가입/ }).first().click();
    await page.waitForURL("**/sign-up");
    await page.getByLabel("이메일").fill(TEST_EMAIL);
    await page.getByLabel("비밀번호", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("비밀번호 확인").fill(TEST_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "회원가입" }).click();
    await expect(page.getByText("이메일을 확인하세요")).toBeVisible({
      timeout: 10000,
    });

    // 3. Mailpit에서 이메일 확인 링크 추출
    const mailpitPage = await context.newPage();
    await mailpitPage.goto(`${MAILPIT_BASE}/#`);
    // Mailpit API: latest message containing TEST_EMAIL
    const res = await mailpitPage.request.get(`${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(TEST_EMAIL)}`);
    const json = (await res.json()) as { messages: { ID: string }[] };
    expect(json.messages.length).toBeGreaterThan(0);
    const msgId = json.messages[0].ID;
    const detail = await mailpitPage.request.get(`${MAILPIT_BASE}/api/v1/message/${msgId}`);
    const detailJson = (await detail.json()) as { Text?: string; HTML?: string };
    const body = detailJson.HTML ?? detailJson.Text ?? "";
    const linkMatch = body.match(/href="([^"]+)"/);
    expect(linkMatch).not.toBeNull();
    await mailpitPage.close();

    // 4. 확인 링크 클릭 → A-03 onboarding redirect
    await page.goto(linkMatch![1]);
    await page.waitForURL("**/onboarding/learning-goal", { timeout: 15000 });

    // 5. A-03 학습 목표 설정 (form submit)
    // 실 컴포넌트는 LearningGoalForm — 본 spec 작성 시점에 정확한 selector
    // 미확정. 가장 일반적인 submit 버튼.
    await page.getByRole("button", { name: /저장|시작|완료/ }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // 6. B-01 대시보드
    await expect(page.getByText(/대시보드|학습/)).toBeVisible();

    // 7. /writing/53 으로 이동 (D-03 LongFormEditor)
    await page.goto("/writing/53?problem=33333333-3333-3333-3333-333333333333");
    await expect(page.getByText(/도입|전개|마무리/)).toBeVisible();

    // 8. 53번 sections 작성 (각 100자 이상 → 120 hardMin 충족)
    const sample = "이 글은 도표 분석 연습입니다. ".repeat(8);
    await page.getByRole("tab", { name: "도입" }).click();
    await page.locator('textarea[aria-label="도입 — 주제 소개"]').fill(sample);
    await page.getByRole("tab", { name: "전개" }).click();
    await page.locator('textarea[aria-label="전개 — 자료 분석"]').fill(sample);
    await page.getByRole("tab", { name: "마무리" }).click();
    await page.locator('textarea[aria-label="마무리 — 정리"]').fill(sample);

    // 9. 제출
    await page.getByRole("button", { name: "제출하기" }).click();
    // SubmissionConfirmModal 확인
    await page.getByRole("button", { name: /제출|확인/ }).last().click();

    // 10. E-02 피드백 페이지 도달
    await page.waitForURL("**/writing/feedback/long/**", { timeout: 30000 });
    await expect(page.getByText(/피드백|점수/)).toBeVisible();

    // 11. R-02 다음 문제 페이지로 (대시보드의 다음 추천 또는 직접 진입)
    await page.goto("/practice/next");
    await expect(page.getByText(/다음 문제|최근 제출/)).toBeVisible();
  });
});
