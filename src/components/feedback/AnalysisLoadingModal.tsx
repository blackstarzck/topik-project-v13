"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Space, Steps, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AnalysisCharacter } from "./AnalysisCharacter";

const { Paragraph, Text, Title } = Typography;

/**
 * D-M2 분석 진행 단계 (description region 3).
 * 제약: 단계 4개 이하, 현재 단계만 강조, 예상 시간 범위 표시.
 * 문법 → 구성 → 표현 → 점수 산출 (functional-spec 주요 기능 순서).
 * 단계 라벨은 카탈로그(feedback.analysis.steps)에서 t()로 해석한다.
 */
const STEP_KEYS = ["grammar", "structure", "expression", "score"] as const;

/** description region 4: 10초 이상 지연 시 안내 갱신. */
const SLOW_NOTICE_MS = 10_000;
/** 단계가 자동으로 넘어가는 간격 (점수 산출 단계에서 멈춤). */
const STEP_ADVANCE_MS = 1_600;

export type AnalysisPhase = "pending" | "analyzing" | "complete" | "failed";

type Props = {
  /** 표시할지 여부 — feedback_status가 pending/analyzing일 때 true. */
  open: boolean;
  /**
   * 실제 제출 상태. polling 결과를 그대로 넘기면 단계/완료/실패 분기를 정확히
   * 표시한다. 미지정 시 'analyzing'으로 간주(레거시 호출 호환).
   */
  status?: AnalysisPhase;
  /** 분석 완료 시 자동 이동할 피드백 경로. 지정 시 complete에서 router.replace. */
  completeHref?: string | null;
  /**
   * 분석 완료 시 호출. 같은 화면을 그대로 두고 RSC만 갱신할 때 쓴다
   * (예: router.refresh). completeHref와 동시에 주면 onComplete 우선.
   */
  onComplete?: () => void;
  /** 사용자가 모션 비활성을 선택했는지. true면 캐릭터 애니메이션을 정적 처리. */
  reduceMotion?: boolean;
  /** 뒤로가기(분석 중단) 동작. 미지정 시 router.back(). */
  onCancel?: () => void;
  /** 분석 실패 시 다시 시도 동작(있을 때만 재시도 버튼 노출). */
  onRetry?: () => void;
};

/**
 * D-M2 AI 분석 로딩.
 *
 * IA spec(docs/Wireframe/13-D-M2-ai-analysis-loading): 캐릭터 + 단계 인디케이터
 * + 상태/안내 메시지. status 기반으로:
 *   - pending/analyzing → 단계 진행 + 10초 지연 안내
 *   - complete          → 완료 안내 + completeHref 자동 이동
 *   - failed            → 분석 실패 + 고객지원 링크(stub) + 재시도
 *
 * 실제 LLM 워커는 외부 leg(externalStub). 본 컴포넌트는 status를 받아 표시만
 * 담당하며 가짜 성공을 만들지 않는다(failed면 정직하게 실패 표시).
 */
export function AnalysisLoadingModal({
  open,
  status = "analyzing",
  completeHref = null,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
}: Props) {
  if (!open) return null;
  return (
    <AnalysisLoadingModalContent
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
  // 초기값은 lazy initializer로 한 번 읽는다(effect 안에서 setState 동기 호출 금지).
  const [prefersReduced, setPrefersReduced] = useState(readPrefersReducedMotion);
  useEffect(() => {
    if (explicit !== undefined) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // 외부 시스템(미디어 쿼리) 변경 구독만 effect에서 담당한다.
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [explicit]);
  return explicit ?? prefersReduced;
}

function AnalysisLoadingModalContent({
  status,
  completeHref,
  onComplete,
  reduceMotion,
  onCancel,
  onRetry,
}: Required<Pick<Props, "status">> &
  Pick<
    Props,
    "completeHref" | "onComplete" | "reduceMotion" | "onCancel" | "onRetry"
  >) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const reduced = useReducedMotion(reduceMotion);
  const [autoStep, setAutoStep] = useState(0);
  const [slow, setSlow] = useState(false);
  // 시작 시각은 마운트 시 한 번만 고정한다. ref를 렌더에서 읽거나 Date.now()를
  // 렌더 본문에서 부르면 purity/refs 규칙에 걸리므로 lazy state로 캡처.
  const [startedAtMs] = useState(() => Date.now());

  const active = status === "pending" || status === "analyzing";

  // reduced-motion이면 마지막 단계를 정적으로 고정한다(렌더 중 파생, effect+setState 아님).
  const step = reduced ? STEP_KEYS.length - 1 : autoStep;

  // 단계 자동 진행 — '점수 산출'(마지막) 직전까지만 자동 전진하고 멈춘다.
  // reduced-motion이면 위에서 정적 고정하므로 타이머를 돌리지 않는다.
  useEffect(() => {
    if (!active || reduced) return;
    const interval = setInterval(() => {
      setAutoStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
    }, STEP_ADVANCE_MS);
    return () => clearInterval(interval);
  }, [active, reduced]);

  // 10초 이상 지연 안내 (description region 4 제약).
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // 분석 완료 → 피드백 화면 자동 이동 (description 분기).
  // onComplete가 있으면 같은 화면을 갱신(RSC refresh), 없으면 completeHref로 이동.
  useEffect(() => {
    if (status !== "complete") return;
    if (onComplete) onComplete();
    else if (completeHref) router.replace(completeHref as never);
  }, [status, completeHref, onComplete, router]);

  function handleCancel() {
    // description region 1 예외: 뒤로가기 시 분석 중단 경고.
    const ok = window.confirm(t("cancelConfirm"));
    if (!ok) return;
    if (onCancel) onCancel();
    else router.back();
  }

  const retryAt = useMemo(() => {
    // "재시도 가능 시점" 안내 — 시작 후 30초.
    const at = new Date(startedAtMs + 30_000);
    return at.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [startedAtMs]);

  // 분석 실패 상태 — 무한 로딩 STOP, 오류 + 고객지원 링크(stub) + 재시도.
  if (status === "failed") {
    return (
      <Card style={{ maxWidth: 480, margin: "0 auto" }}>
        <Alert
          type="error"
          showIcon
          message={t("failedTitle")}
          description={t("failedDescription")}
        />
        <Space wrap style={{ marginTop: 16 }}>
          {onRetry ? (
            <Button type="primary" onClick={onRetry}>
              {t("retryButton")}
            </Button>
          ) : null}
          {/* 고객지원 연동 예정 — 실제 채널 연결 전까지 안내만. */}
          <Button onClick={() => window.alert(t("supportAlert"))}>
            {t("supportButton")}
          </Button>
        </Space>
      </Card>
    );
  }

  // 완료 상태 — completeHref 미지정 시(레거시) 안내만 표시.
  if (status === "complete") {
    return (
      <Card style={{ maxWidth: 480, margin: "0 auto" }}>
        <Alert
          type="success"
          showIcon
          message={t("completeTitle")}
          description={t("completeDescription")}
        />
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: 480, margin: "0 auto" }}>
      <Title level={5} style={{ marginTop: 0, textAlign: "center" }}>
        {t("title")}
      </Title>
      <AnalysisCharacter step={step} reduceMotion={reduced} />
      <Steps
        size="small"
        current={step}
        direction="vertical"
        items={STEP_KEYS.map((k) => ({
          title: t(`steps.${k}Title`),
          description: t(`steps.${k}Description`),
        }))}
        style={{ marginTop: 16 }}
      />
      <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
        <Text type="secondary">{t("autoMoveNote")}</Text>
      </Paragraph>
      {slow ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={t("slowTitle")}
          description={t("slowDescription", { retryAt })}
        />
      ) : null}
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <Button type="text" onClick={handleCancel}>
          {t("cancelButton")}
        </Button>
      </div>
    </Card>
  );
}
