import { expect, test, type Page } from "@playwright/test";

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

test("account settings keeps login methods, account status, and logout", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/account", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/account/);

  await expect(page.getByRole("heading", { name: "계정 설정" })).toBeVisible();
  // 재설계: 섹션 타이틀("로그인 방법"/"계정 상태")은 제거되고 카드·행만 남는다.
  await expect(
    page.getByText("이메일 로그인", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Google 로그인", { exact: true }),
  ).toBeVisible();
  // 제거된 요소: 알림/언어 빠른 링크, 탈퇴/학습목표 안내 문구.
  await expect(page.getByText("알림 설정")).toHaveCount(0);
  await expect(page.getByText("언어 설정")).toHaveCount(0);
  await expect(page.getByText("회원 탈퇴는 다음 업데이트에서 지원됩니다.")).toHaveCount(0);
  await expect(
    page.getByText("학습 목표는 프로필에 반영되어 추천·리포트에 사용됩니다."),
  ).toHaveCount(0);
  await expect(page.getByTestId("profile-logout")).toBeVisible();

  expect(errors).toEqual([]);
});

// 회원 탈퇴 danger-zone. ⚠ 이 테스트는 절대 실제 제출하지 않는다 — 공유 E2E
// 학습자 계정을 소프트 삭제하면 storageState 를 재사용하는 다른 스펙이 인증
// 게이트(/auth/account-inactive)로 막혀 연쇄 실패한다. 모달 열기 →
// type-to-confirm 게이팅 확인 → 취소까지만 검증한다.
test("account settings exposes a guarded 회원 탈퇴 danger zone (no submit)", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/account", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/settings\/account/);

  const openButton = page.getByTestId("account-delete-open");
  await expect(openButton).toBeVisible();
  await openButton.click();

  const submit = page.getByTestId("account-delete-confirm-submit");
  await expect(submit).toBeVisible();
  // 키워드 입력 전에는 비활성.
  await expect(submit).toBeDisabled();

  const confirmInput = page.getByTestId("account-delete-confirm-input");
  await confirmInput.fill("틀린값");
  await expect(submit).toBeDisabled();

  // 정확한 키워드(ko: "삭제") 입력 시 활성화.
  await confirmInput.fill("삭제");
  await expect(submit).toBeEnabled();

  // 절대 submit 하지 않는다. 취소로 닫고 끝낸다.
  await page.getByRole("button", { name: "취소" }).click();
  await expect(submit).toBeHidden();

  // 여전히 설정 화면이며 세션이 유지된다(탈퇴되지 않음).
  await expect(page).toHaveURL(/\/settings\/account/);

  expect(errors).toEqual([]);
});
