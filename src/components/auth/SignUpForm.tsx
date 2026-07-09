"use client";

// Phase 7-B (original) + Phase 8-D (verify-email redirect)
// - After successful sign-up, router.push('/auth/verify-email?email=...')
//   instead of in-place "이메일 확인하세요" state. Verify page handles
//   resend with 60s cooldown and survives reloads/deep-links.

import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Select,
  Typography,
} from "antd";
import { ArrowRight } from "@/components/shared/AppIcons";

import { GoogleMark } from "@/components/auth/GoogleMark";
import {
  CountryRegionSelect,
  isSupportedCountryCode,
  normalizeCountryCode,
} from "@/components/shared/CountryRegionSelect";
import {
  buildAffiliationMetadata,
  clearStoredAffiliationCode,
  readStoredAffiliationCode,
} from "@/lib/auth/affiliation-code";
import { POST_AUTH_SIGN_UP_PATH } from "@/lib/auth/completion-routes";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import {
  buildInstitutionInvitePath,
  isGoogleOAuthUnsupportedBrowserError,
  startGoogleOAuth,
  type GoogleOAuthEmbeddedBrowser,
} from "@/lib/auth/oauth";
import {
  DEFAULT_COOLDOWN_SECONDS,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";
import {
  normalizeOptionalProfileInput,
  PHONE_NUMBER_E164_PATTERN,
  type ProfileGender,
} from "@/lib/auth/profile-completion";
import { asLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/locales";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

// 2026-07-03 sign-up-explicit-duplicate-email 제안: 중복 이메일은 숨기지 않고
// 이메일 필드 인라인 오류 + 로그인/비밀번호 재설정 CTA Alert로 명시한다.
// Supabase가 가입 중복을 알리는 error.code 들.
const DUPLICATE_EMAIL_CODES = new Set([
  "user_already_exists",
  "email_exists",
  "email_address_already_in_use",
]);

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

const SIGN_UP_COOLDOWN_STORAGE_KEY = "talkpik:sign-up:cooldown-until";

// 중복 안내 message는 고정 key로 띄워 재제출 시 중복 표시를 막고,
// 이메일 수정 시 같은 key로 닫는다. 문장을 읽을 시간을 주기 위해
// 기본(3초)보다 긴 5초 뒤 자동으로 사라진다(hover 시 일시정지).
const DUPLICATE_EMAIL_MESSAGE_KEY = "sign-up-duplicate-email";
const DUPLICATE_EMAIL_MESSAGE_DURATION_SECONDS = 5;

const { Text } = Typography;

const STEP_NAME = 0;
const STEP_COUNTRY_REGION = 1;
const STEP_EMAIL = 2;
const STEP_PASSWORD = 3;
const STEP_TERMS = 4;

function normalizeFieldValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDisplayNameReady(value: unknown) {
  const displayName = normalizeFieldValue(value);
  return displayName.length >= 2 && displayName.length <= 30;
}

function isCountryCodeReady(value: unknown) {
  return isSupportedCountryCode(value);
}

function isEmailReady(value: unknown) {
  const email = normalizeFieldValue(value);
  return (
    email.length > 0 &&
    email.length <= 80 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isPasswordPairReady(password: unknown, passwordConfirm: unknown) {
  const nextPassword = typeof password === "string" ? password : "";
  const nextPasswordConfirm =
    typeof passwordConfirm === "string" ? passwordConfirm : "";
  return (
    nextPassword.length >= 8 &&
    nextPassword.length <= 64 &&
    nextPassword === nextPasswordConfirm
  );
}

function hasSupportedLocaleCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .some((cookie) => {
      const [name, rawValue] = cookie.split("=");
      if (name !== LOCALE_COOKIE) return false;
      try {
        return asLocale(decodeURIComponent(rawValue ?? "")) !== null;
      } catch {
        return asLocale(rawValue) !== null;
      }
    });
}

type CountdownTranslate = ReturnType<typeof useTranslations<"auth.countdown">>;

function formatCountdown(totalSeconds: number, tc: CountdownTranslate): string {
  if (totalSeconds <= 0) return tc("zero");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return tc("seconds", { seconds });
  if (seconds === 0) return tc("minutes", { minutes });
  return tc("minutesSeconds", { minutes, seconds });
}

type SignUpFields = {
  email: string;
  gender?: ProfileGender;
  password: string;
  passwordConfirm: string;
  displayName: string;
  nationalityCountryCode: string;
  phoneNumber?: string;
  terms: boolean;
};

type SignUpFormProps = {
  onTypingChange?: (isTyping: boolean) => void;
  onPasswordChange?: (password: string) => void;
  onPasswordVisibilityChange?: (visible: boolean) => void;
  onCooldownChange?: (isCoolingDown: boolean) => void;
};

export function SignUpForm({
  onTypingChange,
  onPasswordChange,
  onPasswordVisibilityChange,
  onCooldownChange,
}: SignUpFormProps = {}) {
  const t = useTranslations("auth.signUp");
  const locale = asLocale(useLocale()) ?? DEFAULT_LOCALE;
  const toauth = useTranslations("auth.oauth");
  const tc = useTranslations("auth.countdown");
  const tcooldown = useTranslations("auth.cooldown");
  // Cross-namespace: server sign-up failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [blockedOAuthBrowser, setBlockedOAuthBrowser] =
    useState<GoogleOAuthEmbeddedBrowser | null>(null);
  const [visibleStep, setVisibleStep] = useState(STEP_NAME);
  const signUpCooldown = useEmailCooldown(
    SIGN_UP_COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN_SECONDS,
  );
  // password-strength meter는 실시간으로 입력값을 추적해야 하므로 watch.
  const [passwordValue, setPasswordValue] = useState("");
  const [form] = Form.useForm<SignUpFields>();
  const displayNameValue = Form.useWatch("displayName", form);
  const nationalityCountryCodeValue = Form.useWatch(
    "nationalityCountryCode",
    form,
  );
  const emailValue = Form.useWatch("email", form);
  const passwordConfirmValue = Form.useWatch("passwordConfirm", form);
  const termsValue = Form.useWatch("terms", form);
  const isCoolingDown = signUpCooldown.remaining > 0;
  const hasValidName = isDisplayNameReady(displayNameValue);
  const hasValidCountryRegion = isCountryCodeReady(nationalityCountryCodeValue);
  const hasValidEmail = isEmailReady(emailValue);
  const hasValidPassword = isPasswordPairReady(
    passwordValue,
    passwordConfirmValue,
  );
  const isSubmitReady =
    hasValidName &&
    hasValidCountryRegion &&
    hasValidEmail &&
    hasValidPassword &&
    termsValue === true;
  const autoVisibleStep = useMemo(() => {
    if (
      hasValidName &&
      hasValidCountryRegion &&
      hasValidEmail &&
      hasValidPassword
    ) {
      return STEP_TERMS;
    }
    if (hasValidName && hasValidCountryRegion && hasValidEmail) {
      return STEP_PASSWORD;
    }
    if (hasValidName && hasValidCountryRegion) {
      return STEP_EMAIL;
    }
    if (hasValidName) {
      return STEP_COUNTRY_REGION;
    }
    return STEP_NAME;
  }, [hasValidCountryRegion, hasValidEmail, hasValidName, hasValidPassword]);
  const currentVisibleStep = Math.max(visibleStep, autoVisibleStep);
  const showCountryRegionStep = currentVisibleStep >= STEP_COUNTRY_REGION;
  const showEmailStep = currentVisibleStep >= STEP_EMAIL;
  const showPasswordStep = currentVisibleStep >= STEP_PASSWORD;
  const showTermsStep = currentVisibleStep >= STEP_TERMS;
  const showSubmitButton = showTermsStep;

  useEffect(() => {
    onCooldownChange?.(isCoolingDown);
  }, [isCoolingDown, onCooldownChange]);

  const countdownLabel = useMemo(() => {
    if (!isCoolingDown) return null;
    return tcooldown("label", {
      label: formatCountdown(signUpCooldown.remaining, tc),
    });
  }, [isCoolingDown, signUpCooldown.remaining, tc, tcooldown]);

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPassword = event.target.value;
    setPasswordValue(nextPassword);
    onPasswordChange?.(nextPassword);
  }

  function focusNextField(fieldId: string) {
    window.setTimeout(() => {
      document.getElementById(fieldId)?.focus();
    }, 0);
  }

  function revealStep(nextStep: number, focusFieldId?: string) {
    setVisibleStep((currentStep) => Math.max(currentStep, nextStep));
    if (focusFieldId) {
      focusNextField(focusFieldId);
    }
  }

  function handleStepCompletion(step: number, currentFieldValue?: string) {
    const values = form.getFieldsValue();
    const displayName =
      step === STEP_NAME && typeof currentFieldValue === "string"
        ? currentFieldValue
        : values.displayName;

    if (step === STEP_NAME && isDisplayNameReady(displayName)) {
      revealStep(STEP_COUNTRY_REGION, "nationalityCountryCode");
      return;
    }
    if (
      step === STEP_COUNTRY_REGION &&
      isCountryCodeReady(values.nationalityCountryCode)
    ) {
      revealStep(STEP_EMAIL, "email");
      return;
    }
    if (step === STEP_EMAIL && isEmailReady(values.email)) {
      revealStep(STEP_PASSWORD, "password");
      return;
    }
    if (
      step === STEP_PASSWORD &&
      isPasswordPairReady(values.password, values.passwordConfirm)
    ) {
      revealStep(STEP_TERMS, "terms");
    }
  }

  function handleStepKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    step: number,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleStepCompletion(step, event.currentTarget.value);
  }

  function showDuplicateEmailGuidance() {
    // 인라인 오류는 message가 사라진 뒤에도 남는 지속 단서다.
    form.setFields([{ name: "email", errors: [t("emailDuplicate")] }]);
    void message.open({
      key: DUPLICATE_EMAIL_MESSAGE_KEY,
      type: "warning",
      content: (
        <span data-testid="sign-up-safe-guidance">
          {t("accountCheckDescription")}
        </span>
      ),
      duration: DUPLICATE_EMAIL_MESSAGE_DURATION_SECONDS,
    });
  }

  async function handleSignUp(values: SignUpFields) {
    if (submitting || googleSubmitting || isCoolingDown) return;

    message.destroy(DUPLICATE_EMAIL_MESSAGE_KEY);
    setBlockedOAuthBrowser(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const affiliationMetadata = buildAffiliationMetadata();
      const optionalProfileMetadata = normalizeOptionalProfileInput({
        gender: values.gender,
        phone_number: values.phoneNumber,
      });
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.displayName,
            ...(optionalProfileMetadata.gender
              ? { gender: optionalProfileMetadata.gender }
              : {}),
            nationality_country_code: normalizeCountryCode(
              values.nationalityCountryCode,
            ),
            ...(optionalProfileMetadata.phone_number
              ? { phone_number: optionalProfileMetadata.phone_number }
              : {}),
            ui_locale: locale,
            ui_locale_source: hasSupportedLocaleCookie() ? "manual" : "auto",
            ...affiliationMetadata,
          },
          emailRedirectTo: buildAuthRedirectUrl(
            `/auth/callback?next=${encodeURIComponent(POST_AUTH_SIGN_UP_PATH)}`,
          ),
        },
      });

      if (error) {
        if (
          error.status === 429 ||
          (error.code && RATE_LIMIT_CODES.has(error.code))
        ) {
          signUpCooldown.start();
          message.error(t("rateLimitedMessage"));
          return;
        }
        if (error.code && DUPLICATE_EMAIL_CODES.has(error.code)) {
          showDuplicateEmailGuidance();
          return;
        }
        const reason = mapSupabaseErrorCode(error.code);
        message.error(
          t("signUpFailed", {
            message: te(`${reason}.message` as Parameters<typeof te>[0]),
          }),
        );
        return;
      }
      // 이메일 확인이 켜진 Supabase 프로젝트는 이미 확인된 계정의 재가입 요청에
      // 에러 대신 identities가 빈 성공형 응답을 돌려준다. 이 응답도 중복으로
      // 안내한다. user가 없는 성공형 응답은 판정할 수 없으므로 기존 verify-email
      // 이동을 유지한다.
      if (data?.user && data.user.identities?.length === 0) {
        showDuplicateEmailGuidance();
        return;
      }
      clearStoredAffiliationCode();
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(values.email)}`,
      );
    } catch {
      // D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재
      // 시 동기 throw — catch 없이는 unhandled rejection으로 버튼이 영구 로딩.
      message.error(t("signUpFailed", { message: te("unknown.message") }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    if (googleSubmitting || submitting) return;
    setGoogleSubmitting(true);
    setBlockedOAuthBrowser(null);
    try {
      const nextPath = readStoredAffiliationCode()
        ? buildInstitutionInvitePath(POST_AUTH_SIGN_UP_PATH)
        : POST_AUTH_SIGN_UP_PATH;
      const { error } = await startGoogleOAuth("sign-up", nextPath);
      if (error) {
        message.error(t("socialAuthFailed"));
        setGoogleSubmitting(false);
      }
    } catch (error) {
      if (isGoogleOAuthUnsupportedBrowserError(error)) {
        setBlockedOAuthBrowser(error.browser);
      } else {
        message.error(t("socialAuthFailed"));
      }
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="auth-form-stack">
      {blockedOAuthBrowser && (
        <Alert
          type="warning"
          showIcon
          title={toauth("embeddedBrowserTitle", {
            browser: toauth(
              `browser.${blockedOAuthBrowser}` as Parameters<typeof toauth>[0],
            ),
          })}
          description={toauth("embeddedBrowserDescription")}
          className="!mb-0"
          data-testid="oauth-browser-warning"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSignUp}
        requiredMark={false}
      >
        {/* description §3 입력 순서: 이름, 국가/지역, 이메일, 비밀번호 */}
        <Form.Item
          label={t("nameLabel")}
          name="displayName"
          rules={[
            { required: true, message: t("nameRequired") },
            { min: 2, message: t("nameMin") },
            { max: 30, message: t("nameMax") },
          ]}
        >
          <Input
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            onFocus={() => onTypingChange?.(true)}
            onBlur={(event) => {
              onTypingChange?.(false);
              handleStepCompletion(STEP_NAME, event.currentTarget.value);
            }}
            onKeyDown={(event) => handleStepKeyDown(event, STEP_NAME)}
          />
        </Form.Item>

        {showCountryRegionStep && (
          <div className="auth-progressive-step">
            <Form.Item
              label={t("countryRegionLabel")}
              name="nationalityCountryCode"
              rules={[{ required: true, message: t("countryRegionRequired") }]}
            >
              <CountryRegionSelect
                locale={locale}
                id="nationalityCountryCode"
                ariaLabel={t("countryRegionLabel")}
                dataTestId="country-region-select"
                placeholder={t("countryRegionPlaceholder")}
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => onTypingChange?.(false)}
                onChange={(value) => {
                  if (isCountryCodeReady(value)) {
                    revealStep(STEP_EMAIL, "email");
                  }
                }}
              />
            </Form.Item>
          </div>
        )}

        {showEmailStep && (
          <div className="auth-progressive-step">
            <Form.Item
              label={t("emailLabel")}
              name="email"
              rules={[
                { required: true, message: t("emailRequired") },
                { type: "email", message: t("emailInvalid") },
                { max: 80, message: t("emailMax") },
              ]}
            >
              <Input
                autoComplete="email"
                placeholder="you@example.com"
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => {
                  onTypingChange?.(false);
                  handleStepCompletion(STEP_EMAIL);
                }}
                onKeyDown={(event) => handleStepKeyDown(event, STEP_EMAIL)}
                // 사용자가 이메일을 고치면 직전 "중복 이메일" 서버 오류는 지운다.
                onChange={() => {
                  if (form.getFieldError("email").length > 0) {
                    form.setFields([{ name: "email", errors: [] }]);
                  }
                  message.destroy(DUPLICATE_EMAIL_MESSAGE_KEY);
                }}
              />
            </Form.Item>
          </div>
        )}

        {showPasswordStep && (
          <div className="auth-progressive-step">
            <Form.Item
              label={t("passwordLabel")}
              name="password"
              rules={[
                { required: true, message: t("passwordRequired") },
                { min: 8, message: t("passwordMin") },
                { max: 64, message: t("passwordMax") },
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => {
                  onTypingChange?.(false);
                  handleStepCompletion(STEP_PASSWORD);
                }}
                onKeyDown={(event) => handleStepKeyDown(event, STEP_PASSWORD)}
                onChange={handlePasswordChange}
                visibilityToggle={{
                  onVisibleChange: (visible) =>
                    onPasswordVisibilityChange?.(visible),
                }}
              />
            </Form.Item>

            {/* A-01 피드백: 비밀번호 강도 실시간 표시 */}
            <PasswordStrengthMeter password={passwordValue} showWhenEmpty />

            <Form.Item
              label={t("passwordConfirmLabel")}
              name="passwordConfirm"
              dependencies={["password"]}
              rules={[
                { required: true, message: t("passwordConfirmRequired") },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t("passwordMismatch")));
                  },
                }),
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => {
                  onTypingChange?.(false);
                  handleStepCompletion(STEP_PASSWORD);
                }}
                onKeyDown={(event) => handleStepKeyDown(event, STEP_PASSWORD)}
              />
            </Form.Item>
          </div>
        )}

        {showTermsStep && (
          <div className="auth-progressive-step">
            <Form.Item label={t("genderLabel")} name="gender">
              <Select<ProfileGender>
                allowClear
                aria-label={t("genderLabel")}
                placeholder={t("genderPlaceholder")}
                options={[
                  {
                    value: "female",
                    label: t("genderFemale"),
                  },
                  {
                    value: "male",
                    label: t("genderMale"),
                  },
                  {
                    value: "prefer_not_to_say",
                    label: t("genderPreferNotToSay"),
                  },
                ]}
              />
            </Form.Item>

            <Form.Item
              label={t("phoneNumberLabel")}
              name="phoneNumber"
              extra={t("phoneNumberHelp")}
              rules={[
                {
                  validator(_, value) {
                    const phoneNumber = normalizeFieldValue(value);
                    if (
                      phoneNumber.length === 0 ||
                      PHONE_NUMBER_E164_PATTERN.test(phoneNumber)
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t("phoneNumberInvalid")));
                  },
                },
              ]}
            >
              <Input
                autoComplete="tel"
                inputMode="tel"
                placeholder={t("phoneNumberPlaceholder")}
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => onTypingChange?.(false)}
              />
            </Form.Item>

            <Form.Item
              name="terms"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, value) =>
                    value
                      ? Promise.resolve()
                      : Promise.reject(new Error(t("termsRequired"))),
                },
              ]}
            >
              <Checkbox>
                {t.rich("termsAgreement", {
                  terms: (chunks) => (
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="auth-legal-link text-link-secondary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {chunks}
                    </Link>
                  ),
                  privacy: (chunks) => (
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="auth-legal-link text-link-secondary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </Checkbox>
            </Form.Item>
          </div>
        )}

        {countdownLabel && (
          <Text
            type="secondary"
            className="!mb-4 block text-center"
            data-testid="sign-up-countdown"
          >
            {countdownLabel}
          </Text>
        )}

        {showSubmitButton && (
          <div className="auth-progressive-step">
            <Form.Item className="auth-form-submit">
              <Button
                type="primary"
                htmlType="submit"
                block
                disabled={!isSubmitReady || isCoolingDown || submitting}
                loading={submitting}
                icon={<ArrowRight size={16} aria-hidden="true" />}
                iconPlacement="end"
              >
                {t("submit")}
              </Button>
            </Form.Item>
          </div>
        )}
      </Form>

      <Divider plain className="auth-form-divider">
        {t("socialDivider")}
      </Divider>

      <div className="flex flex-col gap-2">
        <Button
          block
          onClick={() => void handleGoogleSignUp()}
          loading={googleSubmitting}
          disabled={submitting || googleSubmitting}
          icon={<GoogleMark />}
          className="signup-social-button"
        >
          {t("socialGoogle")}
        </Button>
      </div>
    </div>
  );
}
