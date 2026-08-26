"use client";

import {
  Alert,
  Button,
  FloatButton,
  Form,
  Input,
  Popover,
  Segmented,
  Typography,
} from "antd";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LifeBuoy, X } from "@/components/shared/AppIcons";
import { collectSystemReportDiagnostics } from "@/lib/system-report-diagnostics";
import {
  SYSTEM_REPORT_MAX_EMAIL_LENGTH,
  SYSTEM_REPORT_MAX_MESSAGE_LENGTH,
  SYSTEM_REPORT_MAX_TITLE_LENGTH,
  type SystemReportCategory,
  type SystemReportResponse,
} from "@/lib/system-reports";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import styles from "./SystemReportLauncher.module.css";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

type ReportFormValues = {
  category: SystemReportCategory;
  email: string;
  title: string;
  message: string;
};

type SubmissionState = "idle" | "submitting" | "failure" | "success";

function mergeClassNames(...classNames: string[]) {
  return classNames.join(" ");
}

function isSystemReportResponse(value: unknown): value is SystemReportResponse {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.referenceCode === "string" &&
    response.referenceCode.length > 0 &&
    typeof response.createdAt === "string" &&
    Number.isFinite(new Date(response.createdAt).getTime())
  );
}

export function SystemReportLauncher() {
  const t = useTranslations("systemReport");
  const locale = useLocale();
  const format = useFormatter();
  const pathname = usePathname();
  const [form] = Form.useForm<ReportFormValues>();
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const restoreLauncherFocusRef = useRef(false);
  const successTitleRef = useRef<HTMLElement>(null);
  const emailManuallyEditedRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const [receipt, setReceipt] = useState<SystemReportResponse | null>(null);

  const submitting = submissionState === "submitting";
  const succeeded = submissionState === "success" && receipt != null;

  useEffect(() => {
    if (!open || succeeded) return;

    let ignore = false;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const currentEmail = form.getFieldValue("email");
        if (
          !ignore &&
          user?.email &&
          !emailManuallyEditedRef.current &&
          !currentEmail
        ) {
          form.setFieldValue("email", user.email);
        }
      } catch {
        // Account lookup is best-effort. The editable field remains available.
      }
    })();

    return () => {
      ignore = true;
    };
  }, [form, open, succeeded]);

  useEffect(() => {
    if (open && succeeded) {
      successTitleRef.current?.focus();
    }
  }, [open, succeeded]);

  useEffect(() => {
    if (!restoreLauncherFocusRef.current) return;

    restoreLauncherFocusRef.current = false;
    launcherRef.current?.focus();
  }, [open]);

  function resetReport() {
    form.resetFields();
    emailManuallyEditedRef.current = false;
    idempotencyKeyRef.current = null;
    setSubmissionState("idle");
    setReceipt(null);
  }

  function togglePanel() {
    if (submitting) return;
    if (open && succeeded) {
      resetReport();
    }
    restoreLauncherFocusRef.current = true;
    setOpen((current) => !current);
  }

  async function submitReport(values: ReportFormValues) {
    if (submitting) return;

    const idempotencyKey =
      idempotencyKeyRef.current ?? globalThis.crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    setSubmissionState("submitting");

    try {
      const response = await fetch(APP_ROUTES.apiSystemReports, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          category: values.category,
          email: values.email.trim(),
          title: values.title.trim(),
          message: values.message.trim(),
          context: collectSystemReportDiagnostics({
            pathname,
            locale,
          }),
        }),
      });
      const payload = (await response.json()) as unknown;
      if (
        (response.status !== 200 && response.status !== 201) ||
        !isSystemReportResponse(payload)
      ) {
        throw new Error("system_report_failed");
      }

      setReceipt(payload);
      setSubmissionState("success");
    } catch {
      setSubmissionState("failure");
    }
  }

  if (pathname === "/") return null;

  const reportContent = succeeded ? (
    <section
      className={mergeClassNames("app-system-report-success", styles.success)}
      aria-labelledby="system-report-success-title"
      data-testid="system-report-success"
    >
      <div
        className={mergeClassNames(
          "app-system-report-success__copy",
          styles.successCopy,
        )}
      >
        <Typography.Title
          ref={successTitleRef}
          id="system-report-success-title"
          level={4}
          className="!mb-0"
          tabIndex={-1}
        >
          {t("success.title")}
        </Typography.Title>
        <Paragraph type="secondary" className="!mb-0">
          {t("success.body")}
        </Paragraph>
      </div>
      <dl
        className={mergeClassNames("app-system-report-receipt", styles.receipt)}
      >
        <div>
          <dt>{t("success.reference")}</dt>
          <dd data-testid="system-report-reference">{receipt.referenceCode}</dd>
        </div>
        <div>
          <dt>{t("success.time")}</dt>
          <dd>
            {format.dateTime(new Date(receipt.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
        </div>
      </dl>
    </section>
  ) : (
    <div
      className={mergeClassNames("app-system-report-panel", styles.panel)}
      data-testid="system-report-form"
    >
      <Paragraph type="secondary" className="!mb-0">
        {t("helper")}
      </Paragraph>

      {submissionState === "failure" ? (
        <Alert
          type="error"
          showIcon
          title={t("errorTitle")}
          description={t("errorDescription")}
        />
      ) : null}

      <Form<ReportFormValues>
        name="system-report"
        form={form}
        layout="vertical"
        initialValues={{ category: "bug" }}
        requiredMark
        disabled={submitting}
        onValuesChange={(changedValues) => {
          if (submissionState === "failure") {
            idempotencyKeyRef.current = null;
            setSubmissionState("idle");
          }
          if (Object.prototype.hasOwnProperty.call(changedValues, "email")) {
            emailManuallyEditedRef.current = true;
          }
        }}
        onFinish={(values) => void submitReport(values)}
      >
        <Form.Item
          name="category"
          label={t("category.label")}
          rules={[{ required: true }]}
        >
          <Segmented
            block
            aria-label={t("category.label")}
            options={[
              { label: t("category.bug"), value: "bug" },
              { label: t("category.question"), value: "question" },
              { label: t("category.suggestion"), value: "suggestion" },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="email"
          label={t("email.label")}
          rules={[
            {
              required: true,
              message: t("validation.emailRequired"),
            },
            {
              type: "email",
              message: t("validation.emailInvalid"),
            },
            {
              max: SYSTEM_REPORT_MAX_EMAIL_LENGTH,
              message: t("validation.emailTooLong", {
                max: SYSTEM_REPORT_MAX_EMAIL_LENGTH,
              }),
            },
          ]}
        >
          <Input
            data-testid="system-report-email"
            type="email"
            autoComplete="email"
            maxLength={SYSTEM_REPORT_MAX_EMAIL_LENGTH}
            placeholder={t("email.placeholder")}
            onChange={() => {
              emailManuallyEditedRef.current = true;
            }}
          />
        </Form.Item>

        <Form.Item
          name="title"
          label={t("reportTitle.label")}
          rules={[
            {
              validator: async (_, value: unknown) => {
                if (typeof value !== "string" || !value.trim()) {
                  throw new Error(t("validation.titleRequired"));
                }
              },
            },
            {
              max: SYSTEM_REPORT_MAX_TITLE_LENGTH,
              message: t("validation.titleTooLong", {
                max: SYSTEM_REPORT_MAX_TITLE_LENGTH,
              }),
            },
          ]}
        >
          <Input
            data-testid="system-report-title"
            maxLength={SYSTEM_REPORT_MAX_TITLE_LENGTH}
            showCount
            placeholder={t("reportTitle.placeholder")}
          />
        </Form.Item>

        <Form.Item
          name="message"
          label={t("message.label")}
          rules={[
            {
              validator: async (_, value: unknown) => {
                if (typeof value !== "string" || !value.trim()) {
                  throw new Error(t("validation.messageRequired"));
                }
              },
            },
            {
              max: SYSTEM_REPORT_MAX_MESSAGE_LENGTH,
              message: t("validation.messageTooLong", {
                max: SYSTEM_REPORT_MAX_MESSAGE_LENGTH,
              }),
            },
          ]}
        >
          <TextArea
            data-testid="system-report-message"
            rows={5}
            maxLength={SYSTEM_REPORT_MAX_MESSAGE_LENGTH}
            showCount
            placeholder={t("message.placeholder")}
          />
        </Form.Item>

        <Text
          type="secondary"
          className={mergeClassNames(
            "app-system-report-disclosure",
            styles.disclosure,
          )}
        >
          {t("diagnosticsDisclosure")}
        </Text>

        <div className="app-modal-footer-actions">
          <Button
            data-testid="system-report-submit"
            type="primary"
            block
            htmlType="submit"
            loading={submitting}
            disabled={submitting}
            aria-label={
              submitting
                ? t("sending")
                : submissionState === "failure"
                  ? t("retry")
                  : t("send")
            }
          >
            {submitting
              ? t("sending")
              : submissionState === "failure"
                ? t("retry")
                : t("send")}
          </Button>
        </div>
      </Form>
    </div>
  );

  return (
    <Popover
      open={open}
      trigger={[]}
      placement="topRight"
      destroyOnHidden={false}
      classNames={{
        root: "app-system-report-popover app-notification-popover",
        container: "app-system-report-popover__container",
      }}
      title={
        <Text id="system-report-popover-title" strong>
          {t("title")}
        </Text>
      }
      content={
        <div
          id="system-report-panel"
          className="app-system-report-popover__body"
          role="dialog"
          aria-modal="false"
          aria-labelledby="system-report-popover-title"
        >
          {reportContent}
        </div>
      }
    >
      <FloatButton
        ref={(element) => {
          launcherRef.current = element;
        }}
        className={mergeClassNames(
          "app-system-report-launcher",
          styles.launcher,
        )}
        type="primary"
        tooltip={open ? undefined : t("launcherTooltip")}
        icon={open ? <X aria-hidden="true" /> : <LifeBuoy aria-hidden="true" />}
        aria-label={open ? t("close") : t("launcherAria")}
        aria-controls="system-report-panel"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={submitting}
        onClick={togglePanel}
        data-testid="system-report-launcher"
      />
    </Popover>
  );
}
