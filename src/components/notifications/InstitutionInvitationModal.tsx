"use client";

import { Alert, Button, Typography } from "antd";
import type { AlertProps } from "antd";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { AppModal } from "@/components/shared/AppModal";
import { resolveInstitutionInvitationExpiry } from "./notifications-data";
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

type InvitationSubmitAction = "accept" | "decline";

type Props = {
  open: boolean;
  invitation: InstitutionInvitationPayload | null;
  affiliationCode?: string | null;
  status: InstitutionInvitationModalStatus;
  submitting: InvitationSubmitAction | null;
  onAccept: () => void;
  onDecline: () => void;
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
  onDecline,
  onSignIn,
  onClose,
}: Props) {
  const t = useTranslations("notifications.institutionInvitation");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  const code = invitation?.code ?? t("unknownCode");
  const codeLabel = invitation?.codeLabel ?? t("unknownLabel");
  const currentAffiliation = affiliationCode?.trim() ?? "";
  const invitationId = invitation?.invitationId?.trim() ?? "";
  const invitedAffiliation = invitation?.code?.trim() ?? "";
  const replacesAffiliation = Boolean(
    currentAffiliation &&
    invitedAffiliation &&
    currentAffiliation !== invitedAffiliation,
  );
  const invitationExpiry = invitation
    ? resolveInstitutionInvitationExpiry(invitation.expiresAt, now)
    : null;
  const invitationExpired =
    status === "expired" || (!status && invitationExpiry?.status === "expired");
  const expiryDate = invitation?.expiresAt
    ? new Date(invitation.expiresAt)
    : null;
  const expiryDateLabel =
    expiryDate && Number.isFinite(expiryDate.getTime())
      ? format.dateTime(expiryDate, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Seoul",
        })
      : null;
  const displayStatus = status ?? (invitationExpired ? "expired" : null);
  const actionsDisabled =
    !invitationId ||
    submitting !== null ||
    resolvedStatuses.has(status) ||
    status === "unauthenticated" ||
    invitationExpired;
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
            <>
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
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Text type="secondary">{t("description")}</Text>
          <Text strong>{codeLabel}</Text>
          <Text code>{code}</Text>
          {expiryDateLabel ? (
            <Text type="secondary">
              {t("expiryDate", { date: expiryDateLabel })}
            </Text>
          ) : null}
        </div>
        {!invitationId ? (
          <Alert type="error" showIcon title={t("invalid")} />
        ) : null}
        {replacesAffiliation ? (
          <Alert type="warning" showIcon title={t("overwriteWarning")} />
        ) : null}
        {displayStatus ? (
          <Alert
            type={statusToAlertType(displayStatus)}
            showIcon
            title={t(displayStatus)}
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
