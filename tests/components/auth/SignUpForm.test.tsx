// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const signUpMock = vi.fn();
const resendMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const pushMock = vi.fn();
const buildAuthRedirectUrlMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
  }),
}));

// D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재 시 동기
// throw — throw 경로를 단위에서 재현하기 위해 모듈을 mock으로 대체한다. 기본
// 구현은 실제 빌더와 같은 절대 URL을 돌려줘 기존 어서션을 그대로 유지한다.
vi.mock("@/lib/auth/redirect-url", () => ({
  buildAuthRedirectUrl: (path: string) => buildAuthRedirectUrlMock(path),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

import { SignUpForm } from "../../../src/components/auth/SignUpForm";
import {
  readStoredAffiliationCode,
  storeAffiliationCode,
} from "../../../src/lib/auth/affiliation-code";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

// SignUpForm now uses next-intl's useTranslations — render inside the shared
// intl + antd App wrapper (baseline ko catalog, matching the assertions).
const renderInApp = renderWithIntl;

async function fillAndBlur(label: string | RegExp, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

async function fillValidName(value = "홍길동") {
  await fillAndBlur("이름", value);
  await screen.findByLabelText("국가/지역");
}

async function selectCountryRegion(countryName = "베트남") {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "국가/지역" }));
  const matches = await screen.findAllByText(countryName);
  const option = matches.find((node) =>
    node.closest(".ant-select-item-option"),
  );
  if (!option) {
    throw new Error(`Country option not found: ${countryName}`);
  }
  fireEvent.click(option);
  await screen.findByLabelText("이메일");
}

async function selectGender(genderLabel = "여성") {
  fireEvent.click(screen.getByRole("radio", { name: genderLabel }));
  await screen.findByLabelText(/전화번호/);
}

async function fillOptionalPhoneNumber(phoneNumber = "1012345678") {
  await fillAndBlur(/전화번호/, phoneNumber);
  await screen.findByLabelText("국가/지역");
}

async function fillValidEmail(email = "valid@example.com") {
  await fillAndBlur("이메일", email);
  await screen.findByLabelText("비밀번호");
  await screen.findByLabelText("비밀번호 확인");
}

async function fillValidPassword(
  password = "password123",
  passwordConfirm = password,
) {
  await fillAndBlur("비밀번호", password);
  await fillAndBlur("비밀번호 확인", passwordConfirm);
}

async function fillValidCredentials(email = "valid@example.com") {
  await fillValidName();
  await selectCountryRegion();
  await fillValidEmail(email);
  await fillValidPassword();
  await selectGender();
  await fillOptionalPhoneNumber();
  await screen.findByRole("checkbox");
}

async function fillValidSignUpForm(email = "valid@example.com") {
  await fillValidCredentials(email);
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => {
    expect(submitButton().disabled).toBe(false);
  });
}

function submitButton() {
  return document.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

function clearLocaleCookie() {
  document.cookie =
    "NEXT_LOCALE=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie =
    "NEXT_LOCALE=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

beforeEach(() => {
  window.history.replaceState(null, "", "http://localhost:3000/sign-up");
  clearLocaleCookie();
  setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  );
  window.localStorage.clear();
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ error: null });
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  signInWithOAuthMock.mockReset();
  signInWithOAuthMock.mockResolvedValue({ data: { url: "" }, error: null });
  pushMock.mockReset();
  buildAuthRedirectUrlMock.mockReset();
  buildAuthRedirectUrlMock.mockImplementation(
    (path: string) => `https://talkpik.example.com${path}`,
  );

  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
});

afterEach(() => {
  clearLocaleCookie();
  cleanup();
  vi.unstubAllEnvs();
});

describe("SignUpForm", () => {
  it("starts with only the name field while keeping Google sign-up available", () => {
    renderInApp(<SignUpForm />);

    expect(screen.getByLabelText("이름")).toBeTruthy();
    expect(screen.queryByLabelText("국가/지역")).toBeNull();
    expect(screen.queryByLabelText("이메일")).toBeNull();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
    expect(screen.queryByLabelText("비밀번호 확인")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "회원가입" })).toBeNull();
    expect(screen.getByRole("button", { name: "Google로 계속" })).toBeTruthy();
  });

  it("reveals each next sign-up step after the current step is valid", async () => {
    renderInApp(<SignUpForm />);

    await fillAndBlur("이름", "홍길동");
    expect(await screen.findByLabelText("국가/지역")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "남성" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "여성" })).toBeNull();
    expect(screen.queryByText("선택 안 함")).toBeNull();
    expect(document.querySelector("#phoneNumber")).toBeNull();
    expect(screen.queryByLabelText("이메일")).toBeNull();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();

    await selectCountryRegion();
    expect(await screen.findByLabelText("이메일")).toBeTruthy();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
    expect(screen.queryByRole("radio", { name: "남성" })).toBeNull();
    expect(document.querySelector("#phoneNumber")).toBeNull();

    await fillAndBlur("이메일", "valid@example.com");
    expect(await screen.findByLabelText("비밀번호")).toBeTruthy();
    expect(await screen.findByLabelText("비밀번호 확인")).toBeTruthy();
    expect(screen.getByTestId("password-strength")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "남성" })).toBeNull();
    expect(document.querySelector("#phoneNumber")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();

    await fillAndBlur("비밀번호", "password123");
    await fillAndBlur("비밀번호 확인", "password123");
    expect(await screen.findByRole("radio", { name: "남성" })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: "여성" })).toBeTruthy();
    expect(await screen.findByLabelText(/전화번호/)).toBeTruthy();
    expect(
      screen.getByTestId("phone-country-code-select").textContent,
    ).toContain("+82");
    expect(
      screen.getByTestId("phone-country-code-select").textContent,
    ).not.toContain("+84");
    expect(await screen.findByRole("checkbox")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
  });

  it("does not reveal later steps while the current step is invalid", async () => {
    renderInApp(<SignUpForm />);

    await fillAndBlur("이름", "김");
    expect(screen.queryByLabelText("국가/지역")).toBeNull();

    await fillValidName();
    expect(screen.queryByLabelText("이메일")).toBeNull();
    expect(document.querySelector("#phoneNumber")).toBeNull();
    expect(screen.getByLabelText("국가/지역")).toBeTruthy();

    await selectCountryRegion();
    await fillAndBlur("이메일", "not-an-email");
    expect(screen.queryByLabelText("비밀번호")).toBeNull();

    await fillValidEmail();
    await fillAndBlur("비밀번호", "password123");
    await fillAndBlur("비밀번호 확인", "DIFFERENT");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "회원가입" })).toBeNull();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("keeps submit disabled until terms are accepted", async () => {
    renderInApp(<SignUpForm />);

    await fillValidCredentials();

    const button = submitButton();
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("allows email sign-up without optional gender and phone metadata", async () => {
    renderInApp(<SignUpForm />);

    await fillValidName();
    expect(screen.queryByRole("radio", { name: "남성" })).toBeNull();
    expect(screen.queryByLabelText(/전화번호/)).toBeNull();
    await selectCountryRegion();
    await fillValidEmail("skip-optional@example.com");
    await fillValidPassword();
    expect(screen.getByRole("radio", { name: "남성" })).toBeTruthy();
    expect(screen.getByLabelText(/전화번호/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpMock.mock.calls[0][0].options.data).toEqual({
      display_name: "홍길동",
      nationality_country_code: "VN",
      ui_locale: "ko",
      ui_locale_source: "auto",
    });
  });

  it("visually distinguishes terms and privacy links with secondary link color", async () => {
    renderInApp(<SignUpForm />);

    await fillValidCredentials();

    const termsLink = screen.getByRole("link", { name: "이용약관" });
    const privacyLink = screen.getByRole("link", {
      name: "개인정보처리방침",
    });

    expect(termsLink.getAttribute("href")).toBe("/terms");
    expect(privacyLink.getAttribute("href")).toBe("/privacy");
    expect(termsLink.className).toContain("auth-legal-link");
    expect(privacyLink.className).toContain("auth-legal-link");
    expect(termsLink.className).toContain("text-link-secondary");
    expect(privacyLink.className).toContain("text-link-secondary");
    expect(termsLink.className).not.toContain("font-semibold");
    expect(privacyLink.className).not.toContain("font-semibold");
  });

  it("calls supabase.auth.signUp with emailRedirectTo on valid submit", async () => {
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    const call = signUpMock.mock.calls[0][0];
    expect(call.email).toBe("valid@example.com");
    expect(call.password).toBe("password123");
    expect(call.options.data).toEqual({
      display_name: "홍길동",
      gender: "female",
      nationality_country_code: "VN",
      phone_country_code: "KR",
      phone_number: "1012345678",
      ui_locale: "ko",
      ui_locale_source: "auto",
    });
    // Auth completion gate: email confirmation must re-enter post-auth.
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("includes optional gender and phone metadata when provided", async () => {
    renderInApp(<SignUpForm />);

    await fillValidName();
    await selectCountryRegion();
    await fillValidEmail("optional-profile@example.com");
    await fillValidPassword();
    await selectGender("여성");
    await fillOptionalPhoneNumber("1012345678");
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpMock.mock.calls[0][0].options.data).toMatchObject({
      display_name: "홍길동",
      gender: "female",
      nationality_country_code: "VN",
      phone_country_code: "KR",
      phone_number: "1012345678",
    });
  });

  it("stores the rendered locale as an auto-detected sign-up locale", async () => {
    renderInApp(<SignUpForm />, { locale: "en" });

    await fillValidName();
    await selectCountryRegion("Vietnam");
    await fillValidEmail("english-locale@example.com");
    await fillValidPassword();
    await selectGender();
    await fillOptionalPhoneNumber();
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpMock.mock.calls[0][0].options.data).toEqual(
      expect.objectContaining({
        ui_locale: "en",
        ui_locale_source: "auto",
      }),
    );
  });

  it("marks sign-up locale metadata as manual when the locale cookie exists", async () => {
    document.cookie = "NEXT_LOCALE=en; path=/; max-age=3600";
    renderInApp(<SignUpForm />, { locale: "en" });

    await fillValidName();
    await selectCountryRegion("Vietnam");
    await fillValidEmail("manual-locale@example.com");
    await fillValidPassword();
    await selectGender();
    await fillOptionalPhoneNumber();
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(submitButton().disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpMock.mock.calls[0][0].options.data).toEqual(
      expect.objectContaining({
        ui_locale: "en",
        ui_locale_source: "manual",
      }),
    );
  });

  it("adds a stored affiliation code to email sign-up metadata and clears it on success", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A");
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(signUpMock.mock.calls[0][0].options.data).toEqual({
      affiliation_code: "EXPO2026-BOOTH-A",
      display_name: "홍길동",
      gender: "female",
      nationality_country_code: "VN",
      phone_country_code: "KR",
      phone_number: "1012345678",
      ui_locale: "ko",
      ui_locale_source: "auto",
    });
    await waitFor(() => {
      expect(readStoredAffiliationCode()).toBeNull();
    });
  });

  it("keeps a stored affiliation code when email sign-up fails", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A");
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: "unknown", message: "Sign-up failed", status: 500 },
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    expect(readStoredAffiliationCode()).toBe("EXPO2026-BOOTH-A");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not add an expired affiliation code to email sign-up metadata", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", Date.now() - THIRTY_MINUTES_MS);
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    const metadata = signUpMock.mock.calls[0][0].options.data as Record<
      string,
      unknown
    >;
    expect(metadata.affiliation_code).toBeUndefined();
  });

  it("redirects to /auth/verify-email after successful sign-up (Phase 8-D)", async () => {
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock.mock.calls[0][0]).toBe(
      "/auth/verify-email?email=valid%40example.com",
    );
  });

  it("redirects to /auth/verify-email for a no-user success-like signup response", async () => {
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm("obfuscated@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock.mock.calls[0][0]).toBe(
      "/auth/verify-email?email=obfuscated%40example.com",
    );
  });

  it("shows explicit duplicate guidance for duplicate signup error codes", async () => {
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 422,
      },
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm("registered@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-safe-guidance")).toBeTruthy();
    });
    // message 토스트 본문
    expect(
      screen.getByText(
        "이 이메일로 가입한 계정이 이미 있어요. 로그인하거나 비밀번호를 재설정해 주세요.",
      ),
    ).toBeTruthy();
    // 2026-07-03 제안: 이메일 필드 인라인 오류로도 중복을 명시한다.
    expect(await screen.findByText("이미 가입된 이메일이에요")).toBeTruthy();
    // raw provider 문구는 계속 노출하지 않는다.
    expect(screen.queryByText("User already registered")).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("treats an identities-empty success response as a duplicate email", async () => {
    signUpMock.mockResolvedValueOnce({
      data: {
        session: null,
        user: { id: "00000000-0000-4000-8000-000000000001", identities: [] },
      },
      error: null,
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm("registered@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-safe-guidance")).toBeTruthy();
    });
    expect(await screen.findByText("이미 가입된 이메일이에요")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /auth/verify-email when the new user has identities", async () => {
    signUpMock.mockResolvedValueOnce({
      data: {
        session: null,
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          identities: [{ id: "00000000-0000-4000-8000-000000000002" }],
        },
      },
      error: null,
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm("new-user@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock.mock.calls[0][0]).toBe(
      "/auth/verify-email?email=new-user%40example.com",
    );
  });

  it("keeps a stored affiliation code when duplicate email guidance is shown", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A");
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 422,
      },
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm("registered@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-safe-guidance")).toBeTruthy();
    });
    expect(readStoredAffiliationCode()).toBe("EXPO2026-BOOTH-A");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("starts a signup cooldown for rate-limited signup responses", async () => {
    const onCooldownChange = vi.fn();
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
        status: 429,
      },
    });
    renderInApp(<SignUpForm onCooldownChange={onCooldownChange} />);

    await fillValidSignUpForm("limited@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-countdown")).toBeTruthy();
    });
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain("회원가입");
    expect(onCooldownChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      fireEvent.click(submitButton());
    });
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("restores the signup cooldown from localStorage after a reload", async () => {
    const onCooldownChange = vi.fn();
    window.localStorage.setItem(
      "talkpik:sign-up:cooldown-until",
      String(Date.now() + 43_000),
    );

    renderInApp(<SignUpForm onCooldownChange={onCooldownChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-countdown")).toBeTruthy();
    });
    expect(submitButton()).toBeNull();
    expect(onCooldownChange).toHaveBeenLastCalledWith(true);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("clears loading and shows an error when the redirect URL builder throws (D-2)", async () => {
    buildAuthRedirectUrlMock.mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in non-development environments",
      );
    });
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/가입 실패/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출/리다이렉트가 없어야 한다.
    expect(signUpMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 submitting을 해제해야 한다.
    const button = screen.getByRole("button", { name: "회원가입" });
    expect(button.className).not.toContain("ant-btn-loading");
  });

  it("keeps opened fields editable and blocks submit when an earlier value becomes invalid", async () => {
    renderInApp(<SignUpForm />);

    await fillValidSignUpForm();
    await fillAndBlur("이메일", "broken-email");

    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
    expect(screen.getByLabelText("비밀번호 확인")).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
    await waitFor(() => {
      expect(submitButton().disabled).toBe(true);
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("starts Google OAuth without requiring the email sign-up form", async () => {
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuthMock.mock.calls[0][0]).toEqual({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
      },
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns Google OAuth signup to invite confirmation when a valid affiliation code is stored", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A");
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuthMock.mock.calls[0][0]).toEqual({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Finstitution-invite%3Fnext%3D%252Fauth%252Fpost-auth%253Fintent%253Dsign-up",
      },
    });
    expect(readStoredAffiliationCode()).toBe("EXPO2026-BOOTH-A");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows external-browser guidance instead of starting Google OAuth in KakaoTalk", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.7.0",
    );
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("oauth-browser-warning")).toBeTruthy();
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("does not render Kakao OAuth entry", () => {
    renderInApp(<SignUpForm />);

    expect(screen.queryByRole("button", { name: /Kakao|카카오/ })).toBeNull();
  });

  it("shows external-browser guidance instead of starting Google OAuth in Line", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.0.0",
    );
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("oauth-browser-warning")).toBeTruthy();
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows an AntD message when Google OAuth cannot start", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: "" },
      error: { code: "unknown", message: "OAuth failed" },
    });
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Google 인증을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
        ),
      ).toBeTruthy();
    });
  });
});
