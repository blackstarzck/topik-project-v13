"use client";

import { Alert, Button, Typography } from "antd";
import type { AlertProps } from "antd";
import { useTranslations } from "next-intl";

import { AppModal } from "@/components/shared/AppModal";
import type {
  InstitutionInvitationErrorKind,
  InstitutionInvitationPayload,
  InstitutionInvitationResponseStatus,
} from "./notifications-data";

const { Text } = Typography;

export type InstitutionInvitationModalStatus =
  | InstitutionInvitationResponseStatus
  | InstitutionInvitationErrorKind
  | null;

type InvitationSubmitAction = "accept" | "decline";

type Props = {
  open: boolean;
  invitation: InstitutionInvitationPayload | null;
  affiliationCode?: string | null;
  status: InstitutionInvitationModalStatus;
  submitting: InvitationSubmitAction | null;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
};

const resolvedStatuses = new Set<InstitutionInvitationModalStatus>([
  "accepted",
  "declined",
  "canceled",
  "alreadyResponded",
]);

export function InstitutionInvitationModal({
  open,
  invitation,
  affiliationCode,
  status,
  submitting,
  onAccept,
  onDecline,
  onClose,
}: Props) {
  const t = useTranslations("notifications.institutionInvitation");

  const code = invitation?.code ?? t("unknownCode");
  const codeLabel = invitation?.codeLabel ?? t("unknownLabel");
  const currentAffiliation = affiliationCode?.trim() ?? "";
  const invitedAffiliation = invitation?.code?.trim() ?? "";
  const replacesAffiliation = Boolean(
    currentAffiliation &&
      invitedAffiliation &&
      currentAffiliation !== invitedAffiliation,
  );
  const actionsDisabled =
    !invitedAffiliation || submitting !== null || resolvedStatuses.has(status);

  return (
    <AppModal
      open={open}
      title={t("title")}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>{t("close")}</Button>
          <Button
            danger
            disabled={actionsDisabled}
            loading={submitting === "decline"}
            onClick={onDecline}
          >
            {t("decline")}
          </Button>
          <Button
            type="primary"
            disabled={actionsDisabled}
            loading={submitting === "accept"}
            onClick={onAccept}
          >
            {t("accept")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Text type="secondary">{t("description")}</Text>
          <Text strong>{codeLabel}</Text>
          <Text code>{code}</Text>
        </div>
        {!invitedAffiliation ? (
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
