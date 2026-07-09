"use client";

import { App, Button, Modal } from "antd";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { APP_ROUTES } from "@/lib/routes";
import { dismissPhoneNumberPrompt } from "@/lib/settings/mutations";

/** Session-scoped suppression so the modal shows at most once per browser session. */
const SESSION_SUPPRESS_KEY = "talkpik.phoneReminderModalDismissed";

/**
 * Routes where the modal must NOT interrupt: the profile editor itself (where
 * the number is added) and the distraction-free / active-input flows.
 */
const EXCLUDED_EXACT = new Set<string>([
  APP_ROUTES.profile,
  APP_ROUTES.onboardingLearningGoal,
  APP_ROUTES.writing51,
  APP_ROUTES.writing52,
  APP_ROUTES.writing53,
  APP_ROUTES.writing54,
]);

function isExcludedRoute(pathname: string) {
  if (EXCLUDED_EXACT.has(pathname)) return true;
  // Defend against sub-paths of excluded roots (e.g. /profile/...).
  return (
    pathname === APP_ROUTES.profile ||
    pathname.startsWith(`${APP_ROUTES.profile}/`)
  );
}

function readSessionSuppressed() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}

type Props = {
  userId: string;
  phoneNumber?: string | null;
  phoneNumberPromptDismissedAt?: string | null;
  /** Current pathname, passed from `WorkspaceShell` (which already holds it). */
  pathname: string;
};

/**
 * Non-blocking reminder shown as a modal when a signed-in user has no phone
 * number and has not permanently dismissed the prompt. Rendered by
 * `WorkspaceShell`, so it triggers on entry to ANY workspace route (including
 * direct-URL landings), not just the dashboard. Shows at most once per browser
 * session; closing suppresses it for the session, "don't show again" suppresses
 * it permanently (DB). Phone number stays optional; this only nudges toward
 * `/profile`.
 */
export function PhoneNumberReminderModal({
  userId,
  phoneNumber,
  phoneNumberPromptDismissedAt,
  pathname,
}: Props) {
  const t = useTranslations("app.phoneReminder");
  const { message } = App.useApp();
  const router = useRouter();
  const [sessionSuppressed, setSessionSuppressed] = useState(
    readSessionSuppressed,
  );
  const [permanentlyDismissed, setPermanentlyDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  const eligible =
    !phoneNumber && !phoneNumberPromptDismissedAt && !isExcludedRoute(pathname);
  const modalOpen = eligible && !sessionSuppressed && !permanentlyDismissed;

  function suppressForSession() {
    try {
      window.sessionStorage.setItem(SESSION_SUPPRESS_KEY, "1");
    } catch {
      // sessionStorage unavailable (e.g. privacy mode). Fall back to the
      // in-memory close below; the modal simply may reappear on a full reload.
    }
    setSessionSuppressed(true);
  }

  function handleClose() {
    suppressForSession();
  }

  function handleGoToProfile() {
    suppressForSession();
    router.push(APP_ROUTES.profile);
  }

  async function handleDismissForever() {
    setPending(true);
    try {
      await dismissPhoneNumberPrompt(userId);
      suppressForSession();
      setPermanentlyDismissed(true);
      setPending(false);
    } catch {
      message.error(t("dismissError"));
      setPending(false);
    }
  }

  return (
    <Modal
      open={modalOpen}
      centered
      title={t("title")}
      classNames={{ body: "break-keep" }}
      onCancel={handleClose}
      footer={
        <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
          <Button onClick={handleDismissForever} loading={pending}>
            {t("dismiss")}
          </Button>
          <Button type="primary" onClick={handleGoToProfile}>
            {t("cta")}
          </Button>
        </div>
      }
    >
      {t("description")}
    </Modal>
  );
}
