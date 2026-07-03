"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Result, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  CheckCircle2,
  LogIn,
  UserRoundPlus,
  X,
} from "@/components/shared/AppIcons";
import {
  acceptStoredAffiliationInvite,
  clearStoredAffiliationCode,
  readStoredAffiliationCode,
  type AcceptAffiliationInviteResult,
} from "@/lib/auth/affiliation-code";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Text } = Typography;

type InvitePanelState =
  | { kind: "loading" }
  | { kind: "no-code" }
  | { kind: "anonymous"; code: string }
  | { kind: "authenticated"; code: string; email: string | null }
  | { kind: "success" }
  | { kind: "already-same"; email: string | null }
  | { kind: "already-other"; email: string | null }
  | { kind: "invalid" }
  | { kind: "failed" };

type ProfileInviteSnapshot = {
  affiliation_code: string | null;
  status?: "active" | "blocked" | "deleted" | null;
};

type InstitutionInvitePanelProps = {
  nextPath: string;
};

function loginInviteHref() {
  return `${APP_ROUTES.login}?next=${encodeURIComponent(
    APP_ROUTES.authInstitutionInvite,
  )}`;
}

function normalizeProfileAffiliation(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isSuccessLike(result: AcceptAffiliationInviteResult) {
  return result === "accepted" || result === "already_affiliated_same";
}

export function InstitutionInvitePanel({ nextPath }: InstitutionInvitePanelProps) {
  const t = useTranslations("auth.institutionInvite");
  const router = useRouter();
  const [state, setState] = useState<InvitePanelState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [institutionInviteConfirmed, setInstitutionInviteConfirmed] =
    useState(false);
  const loginHref = useMemo(() => loginInviteHref(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadInviteState() {
      const storedCode = readStoredAffiliationCode();
      if (!storedCode) {
        setState({ kind: "no-code" });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setState({ kind: "anonymous", code: storedCode });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("affiliation_code,status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const profile = data as ProfileInviteSnapshot | null;
      if (error || !profile) {
        setState({ kind: "failed" });
        return;
      }

      if (profile.status && profile.status !== "active") {
        setState({ kind: "failed" });
        return;
      }

      const currentAffiliationCode = normalizeProfileAffiliation(
        profile.affiliation_code,
      );
      if (!currentAffiliationCode) {
        setState({
          kind: "authenticated",
          code: storedCode,
          email: user.email ?? null,
        });
        return;
      }

      if (currentAffiliationCode === storedCode) {
        setState({ kind: "already-same", email: user.email ?? null });
        return;
      }

      setState({ kind: "already-other", email: user.email ?? null });
    }

    void loadInviteState().catch(() => {
      if (!cancelled) {
        setState({ kind: "failed" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function continueToNext() {
    router.replace(nextPath);
  }

  function continueWithoutInvite() {
    clearStoredAffiliationCode();
    router.replace(
      state.kind === "anonymous" || state.kind === "no-code"
        ? APP_ROUTES.landing
        : nextPath,
    );
  }

  function preventDefaultAndContinueWithoutInvite(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    event.preventDefault();
    continueWithoutInvite();
  }

  async function signOutForAnotherAccount() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace(loginHref);
  }

  async function acceptInvite() {
    if (!institutionInviteConfirmed || submitting) return;

    setSubmitting(true);
    const result = await acceptStoredAffiliationInvite();
    setSubmitting(false);

    if (isSuccessLike(result)) {
      setState({ kind: "success" });
      return;
    }
    if (result === "already_affiliated_other") {
      setState({
        kind: "already-other",
        email: state.kind === "authenticated" ? state.email : null,
      });
      return;
    }
    if (result === "invalid" || result === "empty") {
      setState({ kind: result === "invalid" ? "invalid" : "no-code" });
      return;
    }
    setState({ kind: "failed" });
  }

  const email =
    state.kind === "authenticated" ||
    state.kind === "already-same" ||
    state.kind === "already-other"
      ? state.email
      : null;
  const pageClassName = "institution-invite-page institution-invite-page--white";
  const policyNotice = (
    <section
      className="institution-invite-policy institution-invite-policy--plain"
      aria-labelledby="institution-invite-policy-title"
    >
      <Text
        strong
        id="institution-invite-policy-title"
        className="institution-invite-policy-title"
      >
        {t("policyTitle")}
      </Text>
      <ul className="institution-invite-policy-list">
        <li>{t("policyPreserve")}</li>
        <li>{t("policyInstitutionScope")}</li>
        <li>{t("policyReadOnly")}</li>
      </ul>
    </section>
  );

  return (
    <main className={pageClassName} aria-labelledby="invite-title">
      <section className="institution-invite-panel">
        {state.kind === "loading" ? (
          <Result
            className="institution-invite-result"
            status="info"
            title={t("loadingTitle")}
            subTitle={t("loadingDescription")}
          />
        ) : null}

        {state.kind === "no-code" ? (
          <Result
            className="institution-invite-result"
            status="warning"
            title={<span id="invite-title">{t("noCodeTitle")}</span>}
            subTitle={t("noCodeDescription")}
            extra={
              <Button onClick={continueWithoutInvite}>
                {t("anonymousContinue")}
              </Button>
            }
          />
        ) : null}

        {state.kind === "anonymous" ? (
          <div className="institution-invite-stack">
            <Result
              className="institution-invite-result"
              status="info"
              title={<span id="invite-title">{t("anonymousTitle")}</span>}
              subTitle={t("anonymousDescription")}
            />
            <div className="institution-invite-code">{state.code}</div>
            {policyNotice}
            <div className="institution-invite-actions institution-invite-actions-grid">
              <Button
                type="primary"
                href={APP_ROUTES.signUp}
                className="institution-invite-action-primary"
                icon={<UserRoundPlus size={16} aria-hidden="true" />}
              >
                {t("anonymousSignUp")}
              </Button>
              <Button
                href={loginHref}
                className="institution-invite-action-secondary"
                icon={<LogIn size={16} aria-hidden="true" />}
              >
                {t("anonymousLogin")}
              </Button>
              <Button
                type="text"
                className="institution-invite-action-tertiary"
                onClick={continueWithoutInvite}
                icon={<X size={16} aria-hidden="true" />}
              >
                {t("anonymousContinue")}
              </Button>
            </div>
          </div>
        ) : null}

        {state.kind === "authenticated" ? (
          <div className="institution-invite-stack">
            <Result
              className="institution-invite-result"
              status="info"
              title={<span id="invite-title">{t("authenticatedTitle")}</span>}
              subTitle={t("authenticatedDescription")}
            />
            <div className="institution-invite-account">
              <Text type="secondary">{t("currentAccount")}</Text>
              {email ? <Text strong>{email}</Text> : null}
            </div>
            <div className="institution-invite-code">{state.code}</div>
            <div className="institution-invite-policy-confirmation">
              {policyNotice}
              <Checkbox
                checked={institutionInviteConfirmed}
                className="institution-invite-consent"
                onChange={(event) =>
                  setInstitutionInviteConfirmed(event.target.checked)
                }
              >
                {t("authenticatedConsent")}
              </Checkbox>
            </div>
            <div className="institution-invite-actions institution-invite-actions-grid">
              <Button
                type="primary"
                className="institution-invite-action-primary"
                disabled={!institutionInviteConfirmed || submitting}
                loading={submitting}
                onClick={() => void acceptInvite()}
                icon={<CheckCircle2 size={16} aria-hidden="true" />}
              >
                {t("authenticatedAccept")}
              </Button>
              <Button
                className="institution-invite-action-secondary"
                onClick={() => void signOutForAnotherAccount()}
                icon={<LogIn size={16} aria-hidden="true" />}
              >
                {t("authenticatedOtherAccount")}
              </Button>
              <a
                className="institution-invite-action-anchor"
                href={nextPath}
                onClick={preventDefaultAndContinueWithoutInvite}
              >
                {t("authenticatedContinue")}
              </a>
            </div>
          </div>
        ) : null}

        {state.kind === "success" ? (
          <Result
            className="institution-invite-result"
            status="success"
            title={<span id="invite-title">{t("successTitle")}</span>}
            subTitle={t("successDescription")}
            extra={
              <Button
                type="primary"
                onClick={continueToNext}
                icon={<ArrowRight size={16} aria-hidden="true" />}
                iconPlacement="end"
              >
                {t("continue")}
              </Button>
            }
          />
        ) : null}

        {state.kind === "already-same" ? (
          <Result
            className="institution-invite-result"
            status="success"
            title={<span id="invite-title">{t("alreadySameTitle")}</span>}
            subTitle={t("alreadySameDescription")}
            extra={
              <Button type="primary" onClick={continueToNext}>
                {t("continue")}
              </Button>
            }
          />
        ) : null}

        {state.kind === "already-other" ? (
          <div className="institution-invite-stack">
            <Result
              className="institution-invite-result"
              status="warning"
              title={<span id="invite-title">{t("alreadyOtherTitle")}</span>}
              subTitle={t("alreadyOtherDescription")}
            />
            {email ? (
              <Paragraph type="secondary" className="institution-invite-note">
                {t("currentAccountValue", { email })}
              </Paragraph>
            ) : null}
            <div className="institution-invite-actions">
              <Button
                type="primary"
                className="institution-invite-flat-action"
                data-testid="institution-invite-already-other-primary"
                onClick={() => void signOutForAnotherAccount()}
                icon={<LogIn size={16} aria-hidden="true" />}
              >
                {t("authenticatedOtherAccount")}
              </Button>
              <a
                className="institution-invite-action-anchor"
                href={nextPath}
                onClick={preventDefaultAndContinueWithoutInvite}
              >
                {t("authenticatedContinue")}
              </a>
            </div>
          </div>
        ) : null}

        {state.kind === "invalid" || state.kind === "failed" ? (
          <Result
            className="institution-invite-result"
            status={state.kind === "invalid" ? "warning" : "error"}
            title={
              <span id="invite-title">
                {state.kind === "invalid" ? t("invalidTitle") : t("failedTitle")}
              </span>
            }
            subTitle={
              state.kind === "invalid"
                ? t("invalidDescription")
                : t("failedDescription")
            }
            extra={
              <a
                className="institution-invite-action-anchor"
                href={nextPath}
                onClick={preventDefaultAndContinueWithoutInvite}
              >
                {t("authenticatedContinue")}
              </a>
            }
          />
        ) : null}
      </section>
    </main>
  );
}
