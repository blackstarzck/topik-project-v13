"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Progress, Steps, Typography, theme } from "antd";
import { ArrowLeft, Clock3, LifeBuoy, RefreshCcw, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AppModal } from "@/components/shared/AppModal";
import { AnalysisCharacter } from "./AnalysisCharacter";

const { Paragraph, Text, Title } = Typography;

const STEP_KEYS = ["grammar", "structure", "expression", "score"] as const;
const SLOW_NOTICE_MS = 10_000;
const STEP_ADVANCE_MS = 1_600;

export type AnalysisPhase = "pending" | "analyzing" | "complete" | "failed";

type Props = {
  open: boolean;
  status?: AnalysisPhase;
  completeHref?: string | null;
  onComplete?: () => void;
  reduceMotion?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
};

export function AnalysisLoadingModal({
  open,
  status = "analyzing",
  completeHref = null,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open || !mounted) return null;
  return (
    <AnalysisLoadingModalContent
      open={open}
      status={status}
      completeHref={completeHref}
      onComplete={onComplete}
      reduceMotion={reduceMotion}
      onCancel={onCancel}
      onRetry={onRetry}
    />
  );
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion(explicit?: boolean): boolean {
  const [prefersReduced, setPrefersReduced] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (explicit !== undefined) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) =>
      setPrefersReduced(event.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [explicit]);

  return explicit ?? prefersReduced;
}

function AnalysisLoadingModalContent({
  open,
  status,
  completeHref,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
}: Required<Pick<Props, "open" | "status">> &
  Pick<
    Props,
    "completeHref" | "onComplete" | "reduceMotion" | "onCancel" | "onRetry"
  >) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const reduced = useReducedMotion(reduceMotion);
  const [autoStep, setAutoStep] = useState(0);
  const [slow, setSlow] = useState(false);
  const [startedAtMs] = useState(() => Date.now());

  const active = status === "pending" || status === "analyzing";
  const step = active ? (reduced ? 0 : autoStep) : STEP_KEYS.length - 1;
  const currentStepKey = STEP_KEYS[step];
  const progressPercent = active
    ? Math.min(95, Math.round(((step + 1) / STEP_KEYS.length) * 100))
    : 100;

  useEffect(() => {
    if (!active || reduced) return;
    const interval = setInterval(() => {
      setAutoStep((value) => Math.min(value + 1, STEP_KEYS.length - 1));
    }, STEP_ADVANCE_MS);
    return () => clearInterval(interval);
  }, [active, reduced]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (status !== "complete") return;
    if (onComplete) onComplete();
    else if (completeHref) router.replace(completeHref as never);
  }, [status, completeHref, onComplete, router]);

  const retryAt = useMemo(() => {
    const at = new Date(startedAtMs + 30_000);
    return at.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [startedAtMs]);

  function leaveFlow() {
    if (onCancel) onCancel();
    else router.back();
  }

  function handleCancel() {
    modal.confirm({
      title: t("cancelConfirmTitle"),
      content: t("cancelConfirm"),
      okText: t("cancelLeaveButton"),
      cancelText: t("cancelStayButton"),
      okButtonProps: { danger: true },
      onOk: leaveFlow,
    });
  }

  const modalBody =
    status === "failed" ? (
      <div
        className="analysis-loading analysis-loading--failed"
        data-testid="analysis-loading-modal"
      >
        <div className="analysis-loading__hero">
          <div className="analysis-loading__state-icon">
            <ShieldAlert aria-hidden size={30} />
          </div>
          <Title level={2} className="analysis-loading__title">
            {t("failedTitle")}
          </Title>
          <Paragraph className="analysis-loading__subtitle">
            {t("failedDescription")}
          </Paragraph>
        </div>
        <div className="analysis-loading__actions">
          {onRetry ? (
            <Button
              type="primary"
              icon={<RefreshCcw aria-hidden size={16} />}
              onClick={onRetry}
              data-testid="analysis-loading-retry"
            >
              {t("retryButton")}
            </Button>
          ) : null}
          <Button
            icon={<LifeBuoy aria-hidden size={16} />}
            onClick={() => message.info(t("supportAlert"))}
          >
            {t("supportButton")}
          </Button>
        </div>
      </div>
    ) : status === "complete" ? (
      <div
        className="analysis-loading analysis-loading--complete"
        data-testid="analysis-loading-modal"
      >
        <Alert
          type="success"
          showIcon
          title={t("completeTitle")}
          description={t("completeDescription")}
        />
      </div>
    ) : (
      <div className="analysis-loading" data-testid="analysis-loading-modal">
        <div className="analysis-loading__hero">
          <AnalysisCharacter step={step} reduceMotion={reduced} />
          <Title level={2} className="analysis-loading__title">
            {t("title")}
          </Title>
          <Paragraph className="analysis-loading__subtitle">
            {t("subtitle")}
          </Paragraph>
        </div>

        <div className="analysis-loading__meta">
          <Clock3 aria-hidden size={16} />
          <Text>{t("expectedTime")}</Text>
        </div>

        <Progress
          percent={progressPercent}
          showInfo={false}
          strokeColor={token.colorText}
          aria-label={t("progressLabel")}
          className="analysis-loading__progress"
        />

        <Steps
          className="analysis-loading__steps"
          current={step}
          size="small"
          responsive
          items={STEP_KEYS.map((key) => ({
            title: t(`steps.${key}Title`),
          }))}
        />

        <section className="analysis-loading__status" aria-live="polite">
          <Text strong>{t("statusTitle")}</Text>
          <Paragraph>
            {slow
              ? t("statusSlow")
              : status === "pending"
                ? t("statusPending")
                : t(`steps.${currentStepKey}Description`)}
          </Paragraph>
        </section>

        {slow ? (
          <Alert
            type="warning"
            showIcon
            title={t("slowTitle")}
            description={t("slowDescription", { retryAt })}
          />
        ) : null}

        <div className="analysis-loading__actions">
          <Button
            type="text"
            icon={<ArrowLeft aria-hidden size={16} />}
            onClick={handleCancel}
            data-testid="analysis-loading-cancel"
          >
            {t("cancelButton")}
          </Button>
        </div>
      </div>
    );

  return (
    <AppModal
      rootClassName="d-m2-analysis-modal"
      title={null}
      open={open}
      footer={null}
      width={620}
      centered
      closable={!active}
      onCancel={active ? undefined : leaveFlow}
      mask={{ closable: false }}
      keyboard={!active}
      destroyOnHidden
    >
      {modalBody}
    </AppModal>
  );
}
