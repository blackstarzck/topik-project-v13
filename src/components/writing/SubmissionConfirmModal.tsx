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

const { Text } = Typography;

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
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      classNames={{ body: "p-0" }}
      centered
      closable={!loading}
      mask={{ closable: !loading }}
      keyboard={!loading}
      destroyOnHidden
    >
      <div
        className="grid max-h-dvh gap-3 overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-8"
        data-testid="submission-confirm-modal"
      >
        <div className="grid justify-items-center gap-2 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-surface text-text sm:size-16 sm:rounded-3xl">
            <ClipboardCheck aria-hidden size={26} />
          </div>
          <h2 className="m-0 text-xl font-bold leading-tight text-text sm:text-2xl">
            {t("title")}
          </h2>
          <p className="m-0 max-w-md text-xs text-text-secondary sm:text-sm">
            {t("subtitle")}
          </p>
        </div>

        <section
          className="overflow-hidden rounded-3xl border border-border bg-background"
          aria-label={t("summaryAria")}
        >
          {summaryItems.map((item) => (
            <div
              className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 first:border-t-0 sm:gap-3 sm:px-4 sm:py-3"
              key={item.label}
            >
              <span className="inline-flex size-7 flex-none items-center justify-center rounded-full border border-border bg-surface text-text sm:size-8">
                {item.icon}
              </span>
              <span className="text-xs text-text-secondary sm:text-sm">
                {item.label}
              </span>
              <span className="ml-auto min-w-0 text-right text-xs font-semibold text-text sm:text-sm">
                {item.value}
              </span>
            </div>
          ))}
        </section>

        <section className="flex gap-3 rounded-3xl border border-border bg-surface p-3 sm:p-4">
          <AlertTriangle
            aria-hidden
            size={20}
            className="mt-1 flex-none text-text"
          />
          <div className="min-w-0">
            <Text strong>{t("warningTitle")}</Text>
            <p className="m-0 mt-1 text-xs leading-relaxed text-text-secondary sm:text-sm">
              {t("submitNotice")}
            </p>
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

        <section className="grid gap-3 rounded-3xl border border-border bg-background p-3 sm:p-4">
          <Text strong>{t("checklistTitle")}</Text>
          <div className="grid grid-cols-2 gap-2">
            {checklistItems.map((item) => (
              <span
                className="inline-flex min-w-0 items-center gap-2 text-xs text-text-secondary sm:text-sm"
                key={item}
              >
                <CheckCircle2
                  aria-hidden
                  size={14}
                  className="flex-none text-text"
                />
                {item}
              </span>
            ))}
          </div>
        </section>

        <label className="flex items-start gap-3 rounded-3xl border border-border bg-surface p-2 text-xs text-text sm:p-3 sm:text-sm">
          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="pt-0.5">{t("agreeNoEdit")}</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Button
            block
            size="large"
            onClick={onCancel}
            disabled={loading}
            data-testid="submission-confirm-cancel"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            block
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

        <div className="hidden items-center justify-center gap-2 text-center text-sm text-text-secondary sm:flex">
          <ShieldCheck aria-hidden size={16} className="flex-none" />
          <span>{t("footerNote")}</span>
        </div>
      </div>
    </AppModal>
  );
}
