"use client";

import { Alert, App, Button } from "antd";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { APP_ROUTES } from "@/lib/routes";
import { dismissPhoneNumberPrompt } from "@/lib/settings/mutations";

type Props = {
  userId: string;
  phoneNumber?: string | null;
  phoneNumberPromptDismissedAt?: string | null;
  /**
   * Current pathname, passed from `WorkspaceShell` (which already holds it) so
   * this component does not re-read it and risk an SSR/client render mismatch.
   */
  pathname: string;
};

/**
 * Non-blocking reminder shown in the workspace shell when the signed-in user
 * has no phone number and has not permanently dismissed the prompt. Phone
 * number stays optional — this only nudges toward `/profile`. Dismiss is a
 * plain async call (no react-query) so the shell needs no QueryClientProvider.
 */
export function PhoneNumberReminder({
  userId,
  phoneNumber,
  phoneNumberPromptDismissedAt,
  pathname,
}: Props) {
  const t = useTranslations("app.phoneReminder");
  const { message } = App.useApp();
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);

  const shouldShow =
    !phoneNumber &&
    !phoneNumberPromptDismissedAt &&
    pathname !== APP_ROUTES.profile;

  if (!shouldShow || hidden) return null;

  async function handleDismiss() {
    setPending(true);
    try {
      await dismissPhoneNumberPrompt(userId);
      setHidden(true);
    } catch {
      // Keep the banner visible and let the user retry; the timestamp was not
      // persisted, so hiding locally would desync from the next server render.
      message.error(t("dismissError"));
      setPending(false);
    }
  }

  return (
    <div
      className="app-workspace-body app-workspace-body--workspace"
      data-testid="phone-number-reminder"
    >
      <Alert
        type="info"
        showIcon
        className="phone-number-reminder mb-4"
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={APP_ROUTES.profile}>
              <Button type="primary" size="small">
                {t("cta")}
              </Button>
            </Link>
            <Button size="small" loading={pending} onClick={handleDismiss}>
              {t("dismiss")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
