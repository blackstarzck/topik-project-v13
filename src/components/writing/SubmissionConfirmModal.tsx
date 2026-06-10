"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Typography } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  ShieldCheck,
  Type,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

const { Paragraph, Text, Title } = Typography;

type Props = {
  open: boolean;
  charCount: number;
  minChars: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  questionNo?: number;
  lastSavedAt?: string | null;
  submitError?: string | null;
};

export function SubmissionConfirmModal({
  open,
  charCount,
  minChars,
  loading = false,
  onConfirm,
  onCancel,
  questionNo,
  lastSavedAt,
  submitError,
}: Props) {
  const t = useTranslations("writing.submit");
  const tCommon = useTranslations("common");
  const enough = charCount >= minChars;
  const [agreed, setAgreed] = useState(false);

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR")
    : t("noSaveRecord");
  const summaryItems = [
    ...(questionNo
      ? [
          {
            icon: <FileText aria-hidden size={18} />,
            label: t("questionTypeLabel"),
            value: t("questionNoValue", { questionNo }),
          },
        ]
      : []),
    {
      icon: <Type aria-hidden size={18} />,
      label: t("answerLengthLabel"),
      value: (
        <>
          <Text strong type={enough ? "success" : "danger"}>
            {t("charCountValue", { charCount })}
          </Text>{" "}
          <Text type="secondary">{t("minCharsHint", { minChars })}</Text>
        </>
      ),
    },
    {
      icon: <Clock3 aria-hidden size={18} />,
      label: t("lastSavedLabel"),
      value: savedLabel,
    },
  ];
  const checklistItems = [
    t("checklistQuestion"),
    t("checklistLength"),
    t("checklistSaved"),
    t("checklistNoEdit"),
  ];

  return (
    <AppModal
      rootClassName="d-m1-submit-modal"
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      centered
      closable={!loading}
      mask={{ closable: !loading }}
      keyboard={!loading}
      destroyOnHidden
    >
      <div className="submit-confirm" data-testid="submission-confirm-modal">
        <div className="submit-confirm__hero">
          <div className="submit-confirm__icon">
            <ClipboardCheck aria-hidden size={30} />
          </div>
          <Title level={2} className="submit-confirm__title">
            {t("title")}
          </Title>
          <Paragraph className="submit-confirm__subtitle">
            {t("subtitle")}
          </Paragraph>
        </div>

        <section
          className="submit-confirm__summary"
          aria-label={t("summaryAria")}
        >
          {summaryItems.map((item) => (
            <div className="submit-confirm__summary-row" key={item.label}>
              <span className="submit-confirm__summary-icon">{item.icon}</span>
              <Text type="secondary">{item.label}</Text>
              <Text strong className="submit-confirm__summary-value">
                {item.value}
              </Text>
            </div>
          ))}
        </section>

        <section className="submit-confirm__warning">
          <AlertTriangle aria-hidden size={24} />
          <div>
            <Text strong>{t("warningTitle")}</Text>
            <Paragraph className="submit-confirm__warning-copy">
              {t("submitNotice")}
            </Paragraph>
          </div>
        </section>

        {!enough ? (
          <Alert
            type="warning"
            showIcon
            title={t("notEnoughChars", { minChars })}
          />
        ) : null}

        {submitError ? (
          <Alert
            type="error"
            showIcon
            title={t("submitFailedTitle")}
            description={t("submitFailedDescription", { submitError })}
          />
        ) : null}

        <section className="submit-confirm__checklist">
          <Text strong>{t("checklistTitle")}</Text>
          <div className="submit-confirm__checklist-grid">
            {checklistItems.map((item) => (
              <span key={item}>
                <CheckCircle2 aria-hidden size={16} />
                {item}
              </span>
            ))}
          </div>
        </section>

        <label className="submit-confirm__agreement">
          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>{t("agreeNoEdit")}</span>
        </label>

        <div className="submit-confirm__actions">
          <Button
            size="large"
            onClick={onCancel}
            disabled={loading}
            data-testid="submission-confirm-cancel"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            size="large"
            type="primary"
            onClick={onConfirm}
            disabled={!enough || !agreed || loading}
            loading={loading}
            data-testid="submission-confirm-submit"
          >
            {submitError ? t("okRetry") : t("ok")}
          </Button>
        </div>

        <div className="submit-confirm__footer-note">
          <ShieldCheck aria-hidden size={16} />
          <Text type="secondary">{t("footerNote")}</Text>
        </div>
      </div>
    </AppModal>
  );
}
