"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Spin, Steps, Typography } from "antd";
import {
  Clock3,
  LayoutDashboard,
  RefreshCcw,
} from "@/components/shared/AppIcons";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/shared/AppCard";
import { APP_ROUTES } from "@/lib/routes";

const { Paragraph, Text, Title } = Typography;

const STEP_KEYS = ["grammar", "structure", "expression", "score"] as const;
const SLOW_NOTICE_MS = 10_000;
const STEP_ADVANCE_MS = 1_600;
const PAGE_STATE_ASSET: Record<AnalysisPhase, string> = {
  pending: "/assets/state/refresh.svg",
  analyzing: "/assets/state/refresh.svg",
  complete: "/assets/state/success.svg",
  failed: "/assets/state/fail.svg",
};

export type AnalysisPhase = "pending" | "analyzing" | "complete" | "failed";

type Props = {
  status?: AnalysisPhase;
  completeHref?: string | null;
  pollingExhausted?: boolean;
  onComplete?: () => void;
  reduceMotion?: boolean;
  onRetry?: () => void;
};

function renderMultilineText(value: string) {
  return value.split("\n").map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion(explicit?: boolean): boolean {
  const [prefersReduced, setPrefersReduced] = useState(
    readPrefersReducedMotion,
  );

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

export function AnalysisLoadingPage({
  status = "analyzing",
  completeHref = null,
  pollingExhausted = false,
  onComplete,
  reduceMotion,
  onRetry,
}: Props) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const reduced = useReducedMotion(reduceMotion);
  const [slow, setSlow] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAtMs] = useState(() => Date.now());

  const active = status === "pending" || status === "analyzing";
  const exhausted = active && pollingExhausted;
  const autoStep = Math.min(
    Math.floor(elapsedMs / STEP_ADVANCE_MS),
    STEP_KEYS.length - 1,
  );
  const step = active ? (reduced ? 0 : autoStep) : STEP_KEYS.length - 1;
  const onLastStep = active && !reduced && autoStep >= STEP_KEYS.length - 1;
  const displayedRingPercent = reduced
    ? 66
    : onLastStep
      ? 28
      : Math.round(((elapsedMs % STEP_ADVANCE_MS) / STEP_ADVANCE_MS) * 100);

  useEffect(() => {
    if (!active || reduced) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 80);
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

  function goToDashboard() {
    router.push(APP_ROUTES.dashboard);
  }

  function goToLibraryStatus() {
    router.push(APP_ROUTES.library);
  }

  const isFailed = status === "failed";
  const isHandoff = status === "complete";
  const pageActions = isFailed ? (
    <>
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
        icon={<LayoutDashboard aria-hidden size={16} />}
        onClick={goToDashboard}
      >
        {t("dashboardButton")}
      </Button>
    </>
  ) : null;

  return (
    <div className="analysis-loading-page__panel">
      <div
        className={`analysis-loading analysis-loading--page analysis-loading--${status}`}
        data-testid="analysis-loading-panel"
      >
        <AppCard
          className="analysis-state-card"
          data-testid="analysis-state-card"
        >
          <div
            className={`analysis-state-card__inner${
              isHandoff ? " analysis-state-card__inner--blurred" : ""
            }`}
          >
            <div className="analysis-state-card__copy">
              <Title level={2} className="analysis-loading__title">
                {isFailed
                  ? t("failedTitle")
                  : exhausted
                    ? t("delayedTitle")
                    : t("title")}
              </Title>
              <Paragraph className="analysis-loading__subtitle">
                {isFailed ? (
                  <span data-testid="analysis-failed-description">
                    {renderMultilineText(t("failedDescription"))}
                  </span>
                ) : exhausted ? (
                  t("delayedDescription")
                ) : (
                  t("subtitle")
                )}
              </Paragraph>
            </div>

            <Image
              aria-hidden="true"
              className="analysis-state-card__asset"
              data-testid="analysis-state-asset"
              src={
                isFailed ? PAGE_STATE_ASSET.failed : PAGE_STATE_ASSET[status]
              }
              alt=""
              width={240}
              height={320}
            />

            {pageActions ? (
              <div
                className="analysis-loading__actions analysis-state-card__actions"
                data-testid="analysis-state-actions"
              >
                {pageActions}
              </div>
            ) : null}

            {active || isHandoff ? (
              <div className="analysis-state-card__details">
                <div className="analysis-loading__meta">
                  <Clock3 aria-hidden size={14} />
                  <Text>
                    {exhausted ? t("delayedStatus") : t("expectedTime")}
                  </Text>
                </div>

                <Steps
                  className={`analysis-loading__steps${
                    onLastStep ? " analysis-loading__steps--calculating" : ""
                  }`}
                  current={step}
                  percent={displayedRingPercent}
                  titlePlacement="vertical"
                  variant="outlined"
                  responsive
                  aria-label={t("progressLabel")}
                  items={STEP_KEYS.map((key) => ({
                    title: t(`steps.${key}Title`),
                  }))}
                />

                {(exhausted || slow) && active ? (
                  <Alert
                    data-testid={
                      exhausted
                        ? "analysis-polling-exhausted"
                        : "analysis-slow-handoff"
                    }
                    type="warning"
                    showIcon
                    title={exhausted ? t("delayedTitle") : t("slowTitle")}
                    description={
                      exhausted
                        ? t("delayedDescription")
                        : t("slowDescription", { retryAt })
                    }
                    action={
                      <Button
                        size="small"
                        onClick={goToLibraryStatus}
                        data-testid="analysis-library-status-link"
                      >
                        {t("viewLibraryStatus")}
                      </Button>
                    }
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {isHandoff ? (
            <div
              className="analysis-state-card__overlay"
              data-testid="analysis-handoff-overlay"
            >
              <Spin size="large" />
              <Text className="analysis-state-card__overlay-text">
                {t("completeDescription")}
              </Text>
            </div>
          ) : null}
        </AppCard>
      </div>
    </div>
  );
}
