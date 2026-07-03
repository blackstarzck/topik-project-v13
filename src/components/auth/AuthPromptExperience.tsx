"use client";

import { Suspense, useState } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { Flex, Typography } from "antd";

import { AnimatedAuthCharacters } from "@/components/auth/AnimatedAuthCharacters";
import { AuthEntrySessionGuard } from "@/components/auth/AuthEntrySessionGuard";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { getAuthEntryRedirectPath } from "@/lib/auth/completion-routes";
import { sanitizeNext } from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";

const { Link: AntLink, Paragraph, Text, Title } = Typography;

type AuthPromptMode = "login" | "sign-up";

type AuthPromptExperienceProps = {
  mode: AuthPromptMode;
  pageHeading: string;
  formSubtitle: string;
  heroEyebrow: string;
  mascotAlt: string;
  switchPrompt: string;
  switchHref: "/login" | "/sign-up";
  switchLabel: string;
};

export function AuthPromptExperience({
  mode,
  pageHeading,
  formSubtitle,
  heroEyebrow,
  mascotAlt,
  switchPrompt,
  switchHref,
  switchLabel,
}: AuthPromptExperienceProps) {
  const [isTyping, setIsTyping] = useState(false);
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSignUpCoolingDown, setIsSignUpCoolingDown] = useState(false);
  const titleId = `${mode}-title`;
  const isSwitchDisabled = mode === "sign-up" && isSignUpCoolingDown;
  const nextTarget = sanitizeNext(searchParams.get("next"), "");
  const guardRedirectTo =
    nextTarget === APP_ROUTES.authInstitutionInvite ||
    nextTarget.startsWith(`${APP_ROUTES.authInstitutionInvite}?`)
      ? nextTarget
      : getAuthEntryRedirectPath(`/${mode}`);

  return (
    <div className={`signup-prompt-layout signup-prompt-layout--${mode}`}>
      <AuthEntrySessionGuard redirectTo={guardRedirectTo} />
      <aside className="signup-prompt-hero" aria-label={heroEyebrow}>
        <NextLink href="/" className="signup-brand" aria-label="TALKPIK AI">
          <BrandLogo height={46} loading="eager" />
        </NextLink>

        <div className="signup-prompt-character-wrap">
          <AnimatedAuthCharacters
            ariaLabel={mascotAlt}
            isTyping={isTyping}
            hasPassword={password.length > 0}
            passwordVisible={passwordVisible}
          />
        </div>
      </aside>

      <main className="signup-prompt-form-panel" aria-labelledby={titleId}>
        <div className="signup-prompt-topbar">
          <NextLink
            href="/"
            className="signup-prompt-mobile-brand"
            aria-label="TALKPIK AI"
          >
            <BrandLogo height={36} loading="eager" />
          </NextLink>
        </div>

        <Flex vertical className="signup-prompt-form-inner">
          <Flex vertical align="center" className="signup-prompt-form-heading">
            <Title id={titleId} level={1} className="signup-prompt-form-title">
              {pageHeading}
            </Title>
            <Paragraph type="secondary" className="signup-prompt-form-subtitle">
              {formSubtitle}
            </Paragraph>
          </Flex>

          <div className="signup-form-surface">
            {mode === "login" ? (
              <Suspense fallback={null}>
                <LoginForm
                  onTypingChange={setIsTyping}
                  onPasswordChange={setPassword}
                  onPasswordVisibilityChange={setPasswordVisible}
                />
              </Suspense>
            ) : (
              <SignUpForm
                onTypingChange={setIsTyping}
                onPasswordChange={setPassword}
                onPasswordVisibilityChange={setPasswordVisible}
                onCooldownChange={setIsSignUpCoolingDown}
              />
            )}
          </div>

          <Flex
            justify="center"
            align="center"
            gap={5}
            className="signup-prompt-account-link"
          >
            <Text type="secondary">{switchPrompt}</Text>
            {isSwitchDisabled ? (
              <Text
                aria-disabled="true"
                className="signup-prompt-account-link__link signup-prompt-account-link__link--disabled"
                data-testid="auth-switch-link-disabled"
              >
                {switchLabel}
              </Text>
            ) : (
              <AntLink
                href={switchHref}
                className="signup-prompt-account-link__link"
                data-testid="auth-switch-link"
              >
                {switchLabel}
              </AntLink>
            )}
          </Flex>
        </Flex>
      </main>
    </div>
  );
}
