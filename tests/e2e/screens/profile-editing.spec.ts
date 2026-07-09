import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !msg.text().includes("net::ERR_NETWORK_ACCESS_DENIED")
    ) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

test("X-05 profile editing renders field constraints without dirtying data", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/profile/);

  await expect(page.getByRole("heading", { name: "프로필" })).toBeVisible();

  const settingsRegion = page.getByRole("region", { name: "프로필 설정" });
  await expect(settingsRegion).toBeVisible();
  await expect(settingsRegion).not.toHaveClass(/app-card/);
  await expect(settingsRegion.locator(".ant-card-body")).toHaveCount(0);
  await expect(settingsRegion.locator(".profile-avatar-section")).toBeVisible();
  const avatarRegion = settingsRegion.getByRole("region", {
    name: "프로필 이미지 영역",
  });
  await expect(avatarRegion).not.toHaveClass(/border/);
  await expect(avatarRegion).not.toHaveClass(/px-/);

  await expect(page.getByLabel("이름")).toHaveAttribute("maxlength", "30");
  await expect(page.getByLabel("닉네임")).toHaveAttribute("maxlength", "20");
  await expect(page.locator("#phoneNumber")).toBeVisible();
  await expect(page.getByTestId("phone-country-code-select")).toBeVisible();
  await expect(page.getByTestId("phone-country-code-select")).toContainText(
    "+82",
  );
  const nicknameBox = await page.getByLabel("닉네임").boundingBox();
  const phoneNumberBox = await page.locator("#phoneNumber").boundingBox();
  const countryRegionBox = await page
    .getByRole("combobox", { name: "국가/지역" })
    .boundingBox();
  if (!nicknameBox || !phoneNumberBox || !countryRegionBox) {
    throw new Error("Could not measure profile phone field placement");
  }
  expect(phoneNumberBox.y).toBeGreaterThan(nicknameBox.y);
  expect(countryRegionBox.y).toBeGreaterThan(phoneNumberBox.y);
  await expect(page.getByLabel("자기소개")).toHaveAttribute("maxlength", "160");
  await expect(
    page.getByText("실명 또는 자주 사용하는 이름을 입력해 주세요."),
  ).toHaveCSS("font-size", "14px");
  await expect(page.getByText("2자 이상 20자 이하로 입력해 주세요.")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(
    page.getByText(
      "회원가입 때 선택한 국가/지역입니다. 필요하면 수정할 수 있어요.",
    ),
  ).toHaveCSS("font-size", "14px");
  await expect(
    page.getByText("다른 사용자에게 보여지는 간단한 소개입니다. (최대 160자)"),
  ).toHaveCSS("font-size", "14px");
  await expect(
    page.getByRole("button", { name: "프로필 저장" }),
  ).toBeDisabled();

  await expect(page.getByText("프로필 이미지")).toBeVisible();
  await expect(page.getByText(/JPG 또는 PNG, 5MB 이하/)).toBeVisible();
  await expect(page.getByText(/JPG 또는 PNG, 5MB 이하/)).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.getByText(/권장 사이즈: 512px × 512px/)).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.getByLabel("이미지 업로드")).toBeEnabled();
  await expect(page.getByLabel("이메일")).toHaveCount(0);
  await expect(page.getByText("로그인 방법")).toHaveCount(0);
  await expect(page.getByText("목표 시험")).toHaveCount(0);
  await expect(page.getByText("계정 상태")).toHaveCount(0);
  await expect(page.getByTestId("profile-logout")).toHaveCount(0);

  await expect(page.getByRole("combobox", { name: "국가/지역" })).toBeVisible();

  expect(errors).toEqual([]);
});
