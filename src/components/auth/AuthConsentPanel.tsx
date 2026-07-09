"use client";

import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  Form,
  Input,
  Typography,
} from "antd";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  CountryRegionSelect,
  normalizeCountryCode,
} from "@/components/shared/CountryRegionSelect";
import { AppCard } from "@/components/shared/AppCard";
import { GenderRadioGroup } from "@/components/shared/GenderRadioGroup";
import { PhoneNumberInput } from "@/components/shared/PhoneNumberInput";
import { DEFAULT_PHONE_COUNTRY_CODE } from "@/lib/geo/country-calling-codes";
import {
  DISPLAY_NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PROFILE_NAME_MIN_LENGTH,
  type ProfileGender,
  type RequiredProfileField,
  type RequiredProfileShape,
} from "@/lib/auth/profile-completion";
import { renderLegalDocumentBodyHtml } from "@/lib/legal/html";
import { NICKNAME_CHECK_DEBOUNCE_MS } from "@/lib/request-control/policies";
import { checkNicknameAvailability } from "@/lib/settings/mutations";

const { Paragraph, Text, Title } = Typography;

export type AuthConsentPanelDocument = {
  id: string;
  title: string;
  version: string;
  summary: string | null;
  body: string;
};

export type AuthConsentPanelError =
  | "required"
  | "invalid-profile"
  | "nickname-taken"
  | "save-failed";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  documents: AuthConsentPanelDocument[];
  next: string;
  profile: RequiredProfileShape;
  missingProfileFields: RequiredProfileField[];
  suggestedNickname?: string | null;
  error?: AuthConsentPanelError | null;
  showRequiredError: boolean;
};

type NicknameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "failed";
type FormValidateStatus = "success" | "warning" | "error" | "validating";

function ConsentSubmitButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="primary"
      htmlType="submit"
      block
      loading={pending}
      disabled={disabled || pending}
    >
      {label}
    </Button>
  );
}

export function AuthConsentPanel({
  action,
  documents,
  next,
  profile,
  missingProfileFields,
  suggestedNickname,
  error,
  showRequiredError,
}: Props) {
  const t = useTranslations("auth.consent");
  const tProfile = useTranslations("profile.form");
  const locale = useLocale();
  const missingFieldSet = useMemo(
    () => new Set<RequiredProfileField>(missingProfileFields),
    [missingProfileFields],
  );
  const needsProfile = missingProfileFields.length > 0;
  const needsDisplayName = missingFieldSet.has("display_name");
  const needsNickname = needsProfile;
  const needsCountry = missingFieldSet.has("nationality_country_code");
  const needsConsent = documents.length > 0;
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [nickname, setNickname] = useState(
    profile.nickname ?? suggestedNickname ?? "",
  );
  const [nationalityCountryCode, setNationalityCountryCode] = useState<
    string | null
  >(() => {
    const normalized = normalizeCountryCode(
      profile.nationality_country_code ?? "",
    );
    return normalized.length > 0 ? normalized : null;
  });
  const [gender, setGender] = useState<ProfileGender | null>(
    profile.gender ?? null,
  );
  const [phoneCountryCode, setPhoneCountryCode] = useState(
    profile.phone_country_code ?? DEFAULT_PHONE_COUNTRY_CODE,
  );
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number ?? "");
  const [nicknameAvailability, setNicknameAvailability] =
    useState<NicknameAvailability>("idle");
  const nicknameCheckSeqRef = useRef(0);

  const normalizedNickname = nickname.trim();
  const nicknameTooShort =
    needsNickname &&
    normalizedNickname.length > 0 &&
    normalizedNickname.length < PROFILE_NAME_MIN_LENGTH;
  const nicknameValidateStatus: FormValidateStatus | undefined =
    nicknameTooShort || nicknameAvailability === "taken"
      ? "error"
      : nicknameAvailability === "checking"
        ? "validating"
        : nicknameAvailability === "available"
          ? "success"
          : nicknameAvailability === "failed"
            ? "warning"
            : undefined;
  const nicknameHelp = nicknameTooShort
    ? tProfile("nicknameTooShort")
    : nicknameAvailability === "taken"
      ? tProfile("nicknameTaken")
      : nicknameAvailability === "checking"
        ? tProfile("nicknameChecking")
        : nicknameAvailability === "available"
          ? tProfile("nicknameAvailable")
          : nicknameAvailability === "failed"
            ? tProfile("nicknameCheckFailed")
            : tProfile("nicknameHelp");
  const errorTitle =
    error === "nickname-taken"
      ? tProfile("nicknameTaken")
      : error === "save-failed"
        ? t("saveFailedError")
        : error === "invalid-profile"
          ? t("invalidProfileError")
          : error === "required" || showRequiredError
            ? t("requiredError")
            : null;

  function renderOptionalProfileFields(phoneItemClassName = "!mb-4") {
    return (
      <>
        <Form.Item
          className="!mb-4"
          label={tProfile("genderLabel")}
          extra={tProfile("genderHelp")}
        >
          <GenderRadioGroup
            ariaLabel={tProfile("genderLabel")}
            femaleLabel={tProfile("genderFemale")}
            maleLabel={tProfile("genderMale")}
            value={gender}
            onChange={setGender}
          />
        </Form.Item>

        <Form.Item
          className={phoneItemClassName}
          label={tProfile("phoneNumberLabel")}
        >
          <PhoneNumberInput
            ariaLabel={tProfile("phoneNumberLabel")}
            callingCodeAriaLabel={tProfile("phoneCountryCodeLabel")}
            countryCode={phoneCountryCode}
            locale={locale}
            value={phoneNumber}
            placeholder={tProfile("phoneNumberPlaceholder")}
            onChange={setPhoneNumber}
            onCountryCodeChange={setPhoneCountryCode}
          />
        </Form.Item>
      </>
    );
  }

  useEffect(() => {
    if (!needsNickname) return;

    const nextSeq = nicknameCheckSeqRef.current + 1;
    nicknameCheckSeqRef.current = nextSeq;

    if (
      normalizedNickname.length < PROFILE_NAME_MIN_LENGTH ||
      normalizedNickname === (profile.nickname ?? "")
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (nicknameCheckSeqRef.current !== nextSeq) return;
      setNicknameAvailability("checking");
      void checkNicknameAvailability(normalizedNickname)
        .then((available) => {
          if (nicknameCheckSeqRef.current !== nextSeq) return;
          setNicknameAvailability(available ? "available" : "taken");
        })
        .catch(() => {
          if (nicknameCheckSeqRef.current !== nextSeq) return;
          setNicknameAvailability("failed");
        });
    }, NICKNAME_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [needsNickname, normalizedNickname, profile.nickname]);

  return (
    <AppCard
      className="auth-consent-card w-full"
      data-testid="auth-consent-card"
    >
      <Flex vertical gap={24} className="w-full">
        <div>
          <Title level={2} className="!mb-3 !text-2xl !leading-tight">
            {t("heading")}
          </Title>
          <Paragraph type="secondary">{t("description")}</Paragraph>
        </div>

        {errorTitle && <Alert type="warning" showIcon title={errorTitle} />}

        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="gender" value={gender ?? ""} />
          <input
            type="hidden"
            name="phone_country_code"
            value={phoneCountryCode}
          />
          <input type="hidden" name="phone_number" value={phoneNumber} />
          <input
            type="hidden"
            name="nationality_country_code"
            value={nationalityCountryCode ?? ""}
          />
          <Flex vertical gap={24} className="w-full">
            {needsProfile ? (
              <section className="flex flex-col gap-4">
                <div>
                  <Text strong>{t("profileSectionTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
                    {t("profileSectionDescription")}
                  </Paragraph>
                </div>
                <Form layout="vertical" component={false}>
                  {needsDisplayName ? (
                    <Form.Item
                      className="!mb-4"
                      label={tProfile("nameLabel")}
                      required
                      extra={tProfile("nameHelp")}
                    >
                      <Input
                        name="display_name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder={tProfile("namePlaceholder")}
                        maxLength={DISPLAY_NAME_MAX_LENGTH}
                        aria-label={tProfile("nameLabel")}
                      />
                    </Form.Item>
                  ) : null}

                  {renderOptionalProfileFields()}

                  {needsNickname ? (
                    <Form.Item
                      className="!mb-4"
                      label={tProfile("nicknameLabel")}
                      required
                      validateStatus={nicknameValidateStatus}
                      help={nicknameValidateStatus ? nicknameHelp : undefined}
                      extra={nicknameValidateStatus ? undefined : nicknameHelp}
                    >
                      <Input
                        name="nickname"
                        value={nickname}
                        onChange={(event) => {
                          setNickname(event.target.value);
                          setNicknameAvailability("idle");
                        }}
                        placeholder={tProfile("nicknamePlaceholder")}
                        maxLength={NICKNAME_MAX_LENGTH}
                        aria-label={tProfile("nicknameLabel")}
                      />
                    </Form.Item>
                  ) : null}

                  {needsCountry ? (
                    <Form.Item
                      className="!mb-0"
                      label={tProfile("countryRegionLabel")}
                      required
                      extra={tProfile("countryRegionHelp")}
                    >
                      <CountryRegionSelect
                        locale={locale}
                        ariaLabel={tProfile("countryRegionLabel")}
                        placeholder={tProfile("countryRegionPlaceholder")}
                        value={nationalityCountryCode}
                        dataTestId="auth-consent-country-select"
                        allowClear={false}
                        onChange={setNationalityCountryCode}
                      />
                    </Form.Item>
                  ) : null}
                </Form>
              </section>
            ) : null}

            {!needsProfile ? (
              <section className="flex flex-col gap-4">
                <div>
                  <Text strong>{tProfile("optionalSectionTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
                    {tProfile("optionalSectionDescription")}
                  </Paragraph>
                </div>
                <Form layout="vertical" component={false}>
                  {renderOptionalProfileFields("!mb-0")}
                </Form>
              </section>
            ) : null}

            {needsConsent ? <Divider className="!m-0" /> : null}

            {needsConsent ? (
              <section className="flex flex-col gap-4">
                <div>
                  <Text strong>{t("documentsSectionTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
                    {t("documentsSectionDescription")}
                  </Paragraph>
                </div>
                <Flex vertical gap={16} className="w-full">
                  {documents.map((doc) => (
                    <AppCard
                      key={doc.id}
                      size="small"
                      className="auth-consent-document-card"
                      data-testid="auth-consent-document-card"
                    >
                      <Flex vertical gap={8} className="w-full">
                        <Text strong>{doc.title}</Text>
                        <Text type="secondary">
                          {t("versionLabel", { version: doc.version })}
                        </Text>
                        {doc.summary ? (
                          <Paragraph>{doc.summary}</Paragraph>
                        ) : null}
                        <div
                          className="legal-document-body max-h-40 overflow-auto"
                          dangerouslySetInnerHTML={{
                            __html: renderLegalDocumentBodyHtml(doc.body),
                          }}
                        />
                      </Flex>
                    </AppCard>
                  ))}
                </Flex>
                <Checkbox name="accept">{t("agreement")}</Checkbox>
              </section>
            ) : null}

            <ConsentSubmitButton
              label={t("submit")}
              disabled={
                nicknameAvailability === "checking" ||
                nicknameAvailability === "taken"
              }
            />
          </Flex>
        </form>
      </Flex>
    </AppCard>
  );
}
