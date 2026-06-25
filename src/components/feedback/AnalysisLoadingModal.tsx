"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Progress,
  Spin,
  Steps,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeft,
  Clock3,
  LayoutDashboard,
  RefreshCcw,
  ShieldAlert,
} from "@/components/shared/AppIcons";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/shared/AppCard";
import { AppModal } from "@/components/shared/AppModal";
import { APP_ROUTES } from "@/lib/routes";
import { AnalysisCharacter } from "./AnalysisCharacter";

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
  open: boolean;
  status?: AnalysisPhase;
  completeHref?: string | null;
  onComplete?: () => void;
  reduceMotion?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
};

type SurfacePresentation = "modal" | "page";

function renderMultilineText(value: string) {
  return value.split("\n").map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

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
      presentation="modal"
    />
  );
}

export function AnalysisLoadingPage({
  status = "analyzing",
  completeHref = null,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
}: Omit<Props, "open">) {
  return (
    <AnalysisLoadingModalContent
      open
      status={status}
      completeHref={completeHref}
      onComplete={onComplete}
      reduceMotion={reduceMotion}
      onCancel={onCancel}
      onRetry={onRetry}
      presentation="page"
    />
  );
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

function AnalysisLoadingModalContent({
  open,
  status,
  completeHref,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
  presentation,
}: Required<Pick<Props, "open" | "status">> &
  Pick<
    Props,
    "completeHref" | "onComplete" | "reduceMotion" | "onCancel" | "onRetry"
  > & { presentation: SurfacePresentation }) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const { modal } = App.useApp();
  const { token } = theme.useToken();
  const reduced = useReducedMotion(reduceMotion);
  const [slow, setSlow] = useState(false);
  // 단계 인덱스와 링 진행률을 하나의 경과 시간 소스에서 파생한다. 이전에는 단계 advance와
  // 링 채움이 서로 다른 타이머라, 링이 92%까지만 차고 뒤로 튀거나 링이 차기 전에 단계가
  // 넘어가는 문제가 있었다. 단일 소스라 링은 0 -> 100으로 단조 증가하고 단계 경계와 맞물린다.
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAtMs] = useState(() => Date.now());

  const active = status === "pending" || status === "analyzing";
  const autoStep = Math.min(
    Math.floor(elapsedMs / STEP_ADVANCE_MS),
    STEP_KEYS.length - 1,
  );
  const step = active ? (reduced ? 0 : autoStep) : STEP_KEYS.length - 1;
  const currentStepKey = STEP_KEYS[step];
  const progressPercent = active
    ? Math.min(95, Math.round(((step + 1) / STEP_KEYS.length) * 100))
    : 100;
  // 마지막 단계는 더 넘어갈 곳이 없으므로, 단조 채움 대신 앞으로만 도는 스피너(고정 호 +
  // 회전)로 표시해 "끝까지 차지 않았는데 멈춘" 느낌을 없앤다.
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

  function goToDashboard() {
    router.push(APP_ROUTES.dashboard);
  }

  const contentTestId =
    presentation === "page"
      ? "analysis-loading-panel"
      : "analysis-loading-modal";
  const pageActions =
    status === "failed" ? (
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

  if (presentation === "page") {
    const isFailed = status === "failed";
    // 분석 완료(결과 화면으로 이동)는 정적 화면에 머무르면 멈춘 것처럼 보인다(NN/g 응답시간
    // 한계). 기존 캐릭터 + step UI를 그대로 두고 blur(4px) 처리한 뒤, 카드 전체를 덮는
    // 반투명 배경 + 로딩 스피너를 그 위에 얹어 "이동 중"을 움직임으로 보여준다. 실제 이동은
    // 위 complete useEffect의 onComplete가 수행하고, 대상 라우트는 분석 중 prefetch된다.
    const isHandoff = status === "complete";
    return (
      <div className="analysis-loading-page__panel">
        <div
          className={`analysis-loading analysis-loading--page analysis-loading--${status}`}
          data-testid={contentTestId}
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
                  {isFailed ? t("failedTitle") : t("title")}
                </Title>
                <Paragraph className="analysis-loading__subtitle">
                  {isFailed ? (
                    <span data-testid="analysis-failed-description">
                      {renderMultilineText(t("failedDescription"))}
                    </span>
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
                    <Text>{t("expectedTime")}</Text>
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

                  {slow && active ? (
                    <Alert
                      type="warning"
                      showIcon
                      title={t("slowTitle")}
                      description={t("slowDescription", { retryAt })}
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

  const modalBody =
    status === "failed" ? (
      <div
        className="analysis-loading analysis-loading--failed"
        data-testid={contentTestId}
      >
        <div className="analysis-loading__hero">
          <div className="analysis-loading__state-icon">
            <ShieldAlert aria-hidden size={30} />
          </div>
          <Title level={2} className="analysis-loading__title">
            {t("failedTitle")}
          </Title>
          <Paragraph className="analysis-loading__subtitle">
            {renderMultilineText(t("failedDescription"))}
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
            icon={<LayoutDashboard aria-hidden size={16} />}
            onClick={goToDashboard}
          >
            {t("dashboardButton")}
          </Button>
        </div>
      </div>
    ) : status === "complete" ? (
      <div
        className="analysis-loading analysis-loading--complete"
        data-testid={contentTestId}
      >
        <Alert
          type="success"
          showIcon
          title={t("completeTitle")}
          description={t("completeDescription")}
        />
      </div>
    ) : (
      <div className="analysis-loading" data-testid={contentTestId}>
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
