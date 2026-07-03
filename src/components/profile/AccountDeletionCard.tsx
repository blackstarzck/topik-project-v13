"use client";

import { App, Button, Input, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { AppModal } from "@/components/shared/AppModal";
import { APP_ROUTES } from "@/lib/routes";

const { Text, Title } = Typography;

/**
 * G-01 계정 설정 · 회원 탈퇴(danger-zone).
 *
 * 흐름: 카드의 "회원 탈퇴" 버튼 → 확인 모달(type-to-confirm) → 모달 안의 form 이
 * `/auth/account-delete` 로 POST(full-page submit, ProfileLogoutForm 과 동일 철학).
 * route handler 가 request_account_deletion RPC + global signOut 후
 * `/login?reason=withdrawn` 으로 redirect 한다.
 *
 * 실패 시 route 가 `?delete=error` 로 되돌려 보내며, 여기서 한 번 toast 를 띄우고
 * 쿼리를 정리한다.
 */
export function AccountDeletionCard() {
  const t = useTranslations("settings.account");
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorShownRef = useRef(false);

  const keyword = t("dangerZone.confirmKeyword");
  const canSubmit = confirmText.trim() === keyword;

  // route handler 가 RPC 실패 시 ?delete=error 로 되돌린 경우 1회 안내.
  useEffect(() => {
    if (searchParams.get("delete") !== "error" || errorShownRef.current) return;
    errorShownRef.current = true;
    message.error(t("dangerZone.errorMessage"));
    router.replace(APP_ROUTES.settingsAccount);
  }, [searchParams, message, router, t]);

  function closeModal() {
    setOpen(false);
    setConfirmText("");
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
      >
        <form
          method="post"
          action={APP_ROUTES.authAccountDelete}
          onSubmit={(event) => {
            // type-to-confirm 우회 차단: 버튼 disabled 만으로는 Enter 키 제출을
            // 막지 못한다. 서버는 키워드를 재검증하지 않으므로 여기서 막아야 한다.
            if (!canSubmit) {
              event.preventDefault();
              return;
            }
            setSubmitting(true);
          }}
          className="flex flex-col gap-4"
        >
          <Text>{t("dangerZone.modal.body")}</Text>
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
              disabled={!canSubmit}
              loading={submitting}
              data-testid="account-delete-confirm-submit"
            >
              {t("dangerZone.modal.confirmCta")}
            </Button>
          </div>
        </form>
      </AppModal>
    </section>
  );
}
