"use client";

import { Alert, Button, Typography } from "antd";
import type { AlertProps } from "antd";
import { useTranslations } from "next-intl";

import { AppModal } from "@/components/shared/AppModal";
import type {
  InstitutionInvitationErrorKind,
  InstitutionInvitationPayload,
  InstitutionInvitationResolvedStatus,
} from "./notifications-data";

const { Text } = Typography;

export type InstitutionInvitationModalStatus =
  | InstitutionInvitationResolvedStatus
  | InstitutionInvitationErrorKind
  | null;

type InvitationSubmitAction = "accept";

type Props = {
  open: boolean;
  invitation: InstitutionInvitationPayload | null;
  affiliationCode?: string | null;
  status: InstitutionInvitationModalStatus;
  submitting: InvitationSubmitAction | null;
  onAccept: () => void;
  onSignIn?: () => void;
  onClose: () => void;
};

const resolvedStatuses = new Set<InstitutionInvitationModalStatus>([
  "accepted",
  "declined",
  "expired",
  "withdrawn",
  "alreadyResponded",
  "alreadyAffiliatedOther",
  "invalid",
]);

export function InstitutionInvitationModal({
  open,
  invitation,
  affiliationCode,
  status,
  submitting,
  onAccept,
  onSignIn,
  onClose,
}: Props) {
  const t = useTranslations("notifications.institutionInvitation");

  const code = invitation?.code ?? t("unknownCode");
  const currentAffiliation = affiliationCode?.trim() ?? "";
  const invitationId = invitation?.invitationId?.trim() ?? "";
  const invitedAffiliation = invitation?.code?.trim() ?? "";
  const replacesAffiliation = Boolean(
    currentAffiliation &&
      invitedAffiliation &&
      currentAffiliation !== invitedAffiliation,
  );
  const actionsDisabled =
    !invitationId ||
    submitting !== null ||
    resolvedStatuses.has(status) ||
    status === "unauthenticated";
  const needsSignIn = status === "unauthenticated" && onSignIn;

  return (
    <AppModal
      open={open}
      title={t("title")}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>{t("close")}</Button>
          {needsSignIn ? (
            <Button type="primary" onClick={onSignIn}>
              {t("signInAgain")}
            </Button>
          ) : (
            <Button
              type="primary"
              disabled={actionsDisabled}
              loading={submitting === "accept"}
              onClick={onAccept}
            >
              {t("accept")}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Text
            type="secondary"
            className="institution-invitation-modal__description"
          >
            {t("description")}
          </Text>
          <Text className="institution-invitation-modal__code">{code}</Text>
        </div>
        {!invitationId ? (
          <Alert type="error" showIcon title={t("invalid")} />
        ) : null}
        {replacesAffiliation ? (
          <Alert type="warning" showIcon title={t("overwriteWarning")} />
        ) : null}
        {status ? (
          <Alert
            type={statusToAlertType(status)}
            showIcon
            title={t(status)}
          />
        ) : null}
      </div>
    </AppModal>
  );
}

function statusToAlertType(
  status: Exclude<InstitutionInvitationModalStatus, null>,
): AlertProps["type"] {
  if (status === "accepted") return "success";
  if (status === "declined") return "info";
  if (status === "failed" || status === "unauthenticated") return "error";
  return "warning";
}
