"use client";

import { Suspense, useState } from "react";
import NextLink from "next/link";
import { Flex, Typography } from "antd";
import { Sparkles } from "lucide-react";

import { AuthLanguageSelect } from "@/components/auth/AuthLanguageSelect";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

const { Link: AntLink, Paragraph, Text, Title } = Typography;

type AuthPromptMode = "login" | "sign-up";

type AuthPromptExperienceProps = {
  mode: AuthPromptMode;
  pageHeading: string;
  formSubtitle: string;
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  heroHighlights: Array<{
    title: string;
    body: string;
  }>;
  mascotAlt: string;
  switchPrompt: string;
  switchHref: "/login" | "/sign-up";
  switchLabel: string;
  termsLabel: string;
  privacyLabel: string;
};

export function AuthPromptExperience({
  mode,
  pageHeading,
  formSubtitle,
  heroEyebrow,
  heroTitle,
  heroBody,
  heroHighlights,
  mascotAlt,
  switchPrompt,
  switchHref,
  switchLabel,
  termsLabel,
  privacyLabel,
}: AuthPromptExperienceProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const titleId = `${mode}-title`;

  return (
    <div className="grid min-h-dvh bg-surface text-text lg:grid-cols-[minmax(380px,0.92fr)_minmax(440px,1.08fr)]">
      <aside
        className="hidden min-h-dvh flex-col justify-between gap-10 p-12 lg:flex"
        aria-label={heroEyebrow}
      >
        <AuthBrandLink />

        <section className="w-full max-w-[560px] self-center rounded-[calc(var(--app-radius)*2+8px)] border border-border bg-background p-8">
          <Text className="!text-xs !font-semibold !uppercase !tracking-normal !text-text-secondary">
            {heroEyebrow}
          </Text>
          <Title
            level={2}
            className="!mb-0 !mt-4 !whitespace-pre-line !text-[34px] !font-semibold !leading-[1.15] !tracking-normal !text-text"
          >
            {heroTitle}
          </Title>
          <Paragraph className="!mb-8 !mt-4 !text-[15px] !leading-7 !text-text-secondary">
            {heroBody}
          </Paragraph>

          <AuthStudyCompanion
            ariaLabel={mascotAlt}
            isTyping={isTyping}
            hasPassword={password.length > 0}
            passwordVisible={passwordVisible}
          />

          <div className="mt-8 grid gap-3">
            {heroHighlights.map((item) => (
              <div
                key={item.title}
                className="grid grid-cols-[10px_1fr] gap-3 rounded-[calc(var(--app-radius)*2)] bg-surface px-4 py-3"
              >
                <span
                  className="mt-[7px] h-2.5 w-2.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <Text className="block !text-sm !font-semibold !text-text">
                    {item.title}
                  </Text>
                  <Text className="block !text-xs !text-text-secondary">
                    {item.body}
                  </Text>
                </span>
              </div>
            ))}
          </div>
        </section>

        <nav className="flex flex-wrap gap-8 text-sm text-text-secondary">
          <NextLink className="hover:text-text" href="/privacy">
            {privacyLabel}
          </NextLink>
          <NextLink className="hover:text-text" href="/terms">
            {termsLabel}
          </NextLink>
          <NextLink className="hover:text-text" href={switchHref}>
            {switchLabel}
          </NextLink>
        </nav>
      </aside>

      <main
        className="flex min-h-dvh flex-col px-5 py-7 sm:px-8 lg:bg-background lg:px-12 lg:py-10"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between gap-4">
          <AuthBrandLink compact />
          <div className="ml-auto">
            <AuthLanguageSelect />
          </div>
        </div>

        <Flex
          vertical
          className="mx-auto flex-1 justify-center py-10 sm:w-full sm:max-w-[420px] lg:py-14"
        >
          <Flex vertical align="center" className="mb-8 text-center">
            <Title
              id={titleId}
              level={1}
              className="!m-0 !text-[30px] !font-semibold !leading-tight !tracking-normal !text-text sm:!text-[32px]"
            >
              {pageHeading}
            </Title>
            <Paragraph className="!mb-0 !mt-3 !text-sm !leading-6 !text-text-secondary">
              {formSubtitle}
            </Paragraph>
          </Flex>

          <div className="w-full rounded-[calc(var(--app-radius)*2)] border border-border bg-background p-5 sm:p-6 lg:border-0 lg:p-0">
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
              />
            )}
          </div>

          <Flex
            justify="center"
            align="center"
            gap={5}
            className="signup-prompt-account-link mt-8"
          >
            <Text type="secondary" className="!text-sm">
              {switchPrompt}
            </Text>
            <AntLink
              href={switchHref}
              className="signup-prompt-account-link__link !font-semibold !text-text"
            >
              {switchLabel}
            </AntLink>
          </Flex>
        </Flex>
      </main>
    </div>
  );
}

function AuthBrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <NextLink
      href="/"
      className={[
        "inline-flex w-fit items-center gap-3 font-semibold tracking-normal text-text",
        compact ? "text-lg lg:hidden" : "text-lg",
      ].join(" ")}
      aria-label="TALKPIK AI"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--app-radius)] bg-primary text-background"
        aria-hidden="true"
      >
        <Sparkles size={16} strokeWidth={2.2} />
      </span>
      <span>
        Talkpik <strong>AI</strong>
      </span>
    </NextLink>
  );
}

function AuthStudyCompanion({
  ariaLabel,
  isTyping,
  passwordVisible,
  hasPassword,
}: {
  ariaLabel: string;
  isTyping: boolean;
  passwordVisible: boolean;
  hasPassword: boolean;
}) {
  const shouldPeek = passwordVisible && hasPassword;
  const shift = isTyping ? "translate-x-2" : shouldPeek ? "-translate-x-1" : "";

  return (
    <div
      className="relative mx-auto aspect-[4/3] w-full max-w-[360px] overflow-hidden rounded-[calc(var(--app-radius)*2+8px)] bg-surface"
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-x-10 bottom-9 h-3 rounded-full bg-border"
        aria-hidden="true"
      />
      <div
        className={`absolute bottom-11 left-[18%] h-[62%] w-[27%] rounded-t-[calc(var(--app-radius)*2)] bg-primary transition-transform duration-200 ${shift}`}
        aria-hidden="true"
      >
        <MascotEyes light />
      </div>
      <div
        className={`absolute bottom-11 left-[43%] h-[48%] w-[20%] rounded-t-[calc(var(--app-radius)*2)] bg-text transition-transform duration-200 ${
          isTyping ? "translate-x-1" : ""
        }`}
        aria-hidden="true"
      >
        <MascotEyes light compact />
      </div>
      <div
        className="absolute bottom-11 left-[9%] h-[34%] w-[34%] rounded-t-[999px] bg-background"
        aria-hidden="true"
      >
        <MascotEyes />
      </div>
      <div
        className="absolute bottom-11 left-[61%] h-[38%] w-[24%] rounded-t-[999px] bg-background"
        aria-hidden="true"
      >
        <MascotEyes compact />
        <span className="absolute left-[27%] top-[44%] h-0.5 w-[46%] rounded-full bg-primary" />
      </div>
    </div>
  );
}

function MascotEyes({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  const dotClass = compact ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span
      className={[
        "absolute top-[22%] flex",
        compact ? "left-[27%] gap-3" : "left-[26%] gap-4",
      ].join(" ")}
      aria-hidden="true"
    >
      <i
        className={`${dotClass} block rounded-full ${
          light ? "bg-background" : "bg-primary"
        }`}
      />
      <i
        className={`${dotClass} block rounded-full ${
          light ? "bg-background" : "bg-primary"
        }`}
      />
    </span>
  );
}
