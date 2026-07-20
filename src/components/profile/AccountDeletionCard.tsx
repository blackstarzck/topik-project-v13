"use client";

import { App, Button, Input, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { AppModal } from "@/components/shared/AppModal";
import { APP_ROUTES } from "@/lib/routes";
import { clearClientRecoveryForAccountDeletion } from "@/lib/writing/client-recovery-cleanup";

const { Text, Title } = Typography;

/**
 * 서버가 계정 삭제를 확인한 뒤 브라우저의 복구 데이터까지 지워져야 끝난다.
 * 서버 처리 뒤 로컬 정리만 실패하면 서버 요청은 반복하지 않고 로컬 정리만
 * 이 화면에서 다시 시도한다.
 */
export function AccountDeletionCard({ userId }: { userId: string }) {
  const t = useTranslations("settings.account");
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverDeletionConfirmed, setServerDeletionConfirmed] = useState(false);
  const errorShownRef = useRef(false);

  const keyword = t("dangerZone.confirmKeyword");
  const canSubmit = confirmText.trim() === keyword;

  // 과거 full-page 요청 실패 redirect도 넓은 범주의 안내로 처리한다.
  useEffect(() => {
    if (searchParams.get("delete") !== "error" || errorShownRef.current) return;
    errorShownRef.current = true;
    message.error(t("dangerZone.errorMessage"));
    router.replace(APP_ROUTES.settingsAccount);
  }, [searchParams, message, router, t]);

  function closeModal() {
    if (submitting || serverDeletionConfirmed) return;
    setOpen(false);
    setConfirmText("");
  }

  async function submitDeletion(form: HTMLFormElement) {
    setSubmitting(true);
    try {
      if (!serverDeletionConfirmed) {
        const response = await fetch(APP_ROUTES.authAccountDelete, {
          body: new FormData(form),
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as unknown;
        if (
          !response.ok ||
          typeof payload !== "object" ||
          payload === null ||
          Array.isArray(payload) ||
          (payload as { ok?: unknown }).ok !== true
        ) {
          throw new Error("account_deletion_not_confirmed");
        }
        setServerDeletionConfirmed(true);
      }

      const cleanupSucceeded =
        await clearClientRecoveryForAccountDeletion(userId);
      if (!cleanupSucceeded) {
        throw new Error("account_deletion_cleanup_failed");
      }
      router.replace("/login?reason=withdrawn");
    } catch {
      setSubmitting(false);
      message.error(t("dangerZone.errorMessage"));
    }
  }

  return (
    <section
      role="region"
      aria-label={t("dangerZone.title")}
      className="account-delete-section"
    >
      <AppCard className="account-delete-card">
        <div className="flex flex-col gap-2">
          <Title level={5} className="!mb-0">
            {t("dangerZone.title")}
          </Title>
          <Text type="secondary">{t("dangerZone.description")}</Text>
          <div className="account-delete-actions">
            <Button
              danger
              type="primary"
              onClick={() => setOpen(true)}
              data-testid="account-delete-open"
            >
              {t("dangerZone.deleteButtonLabel")}
            </Button>
          </div>
        </div>
      </AppCard>

      <AppModal
        open={open}
        title={t("dangerZone.modal.title")}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        closable={!submitting && !serverDeletionConfirmed}
        keyboard={!submitting && !serverDeletionConfirmed}
        mask={{ closable: !submitting && !serverDeletionConfirmed }}
      >
        <form
          method="post"
          action={APP_ROUTES.authAccountDelete}
          onSubmit={(event) => {
            // Enter 제출도 확인 문구 검사를 우회하지 못하게 한다.
            if (!canSubmit && !serverDeletionConfirmed) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            if (submitting) return;
            void submitDeletion(event.currentTarget);
          }}
          className="flex flex-col gap-4"
        >
          <Text>
            {serverDeletionConfirmed
              ? t("dangerZone.modal.cleanupRetryBody")
              : t("dangerZone.modal.body")}
          </Text>
          <label className="flex flex-col gap-2">
            <Text type="secondary">
              {t("dangerZone.modal.confirmInstruction", { keyword })}
            </Text>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={t("dangerZone.modal.confirmPlaceholder", {
                keyword,
              })}
              autoComplete="off"
              disabled={submitting || serverDeletionConfirmed}
              data-testid="account-delete-confirm-input"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              htmlType="button"
              onClick={closeModal}
              disabled={submitting}
            >
              {t("dangerZone.modal.cancelCta")}
            </Button>
            <Button
              danger
              type="primary"
              htmlType="submit"
              disabled={!serverDeletionConfirmed && !canSubmit}
              loading={submitting}
              data-testid="account-delete-confirm-submit"
            >
              {serverDeletionConfirmed
                ? t("dangerZone.modal.retryCta")
                : t("dangerZone.modal.confirmCta")}
            </Button>
          </div>
        </form>
      </AppModal>
    </section>
  );
}
