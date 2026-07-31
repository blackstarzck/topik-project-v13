"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

const { Paragraph } = Typography;

const DEFAULT_AUTO_REDIRECT_SECONDS = 5;

type Props = {
  open: boolean;
  /** 자동 이동까지 남은 시간(초). 기본 5초. */
  autoRedirectSeconds?: number;
  /** 푸터 [대시보드로 이동] 클릭. 부모가 push(/dashboard)를 담당한다. */
  onGoDashboard: () => void;
  /** 푸터 [내 서재로 이동] 클릭. 부모가 push(/library)를 담당한다. */
  onGoLibrary: () => void;
  /** 카운트다운 만료 시 자동 이동. 부모가 replace(/library)를 담당한다. */
  onAutoRedirect: () => void;
};

/**
 * D-M2 폴링 소진(pending/analyzing 유지) 시 띄우는 대기 안내 모달.
 *
 * 갑작스러운 리다이렉트 대신 "곧 완료" 안내와 함께 대시보드/내 서재 선택지를
 * 주고, 5초 카운트다운이 끝나면 내 서재로 자동 이동한다. 버튼 클릭과 자동
 * 이동은 navigatedRef로 단일화해 중복 네비게이션을 막는다. 표시용
 * interval(1초)과 이동용 timeout(만료 1회)을 분리해 setState updater 안에서
 * side-effect를 실행하지 않는다.
 */
export function AnalysisPendingModal({
  open,
  autoRedirectSeconds = DEFAULT_AUTO_REDIRECT_SECONDS,
  onGoDashboard,
  onGoLibrary,
  onAutoRedirect,
}: Props) {
  const t = useTranslations("feedback.analysis");
  const [secondsLeft, setSecondsLeft] = useState(autoRedirectSeconds);
  const navigatedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 부모가 인라인 콜백을 넘겨도 타이머가 리셋되지 않도록 최신 콜백만 ref로 보관.
  const autoRedirectRef = useRef(onAutoRedirect);
  useEffect(() => {
    autoRedirectRef.current = onAutoRedirect;
  }, [onAutoRedirect]);

  function clearTimers() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // 자동/수동 어느 쪽이 먼저 실행되든 첫 번째만 이동시키고 나머지 타이머는 정리.
  function navigateOnce(navigate: () => void) {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearTimers();
    navigate();
  }

  // 재오픈 시 리셋은 부모의 조건부 마운트(+destroyOnHidden)에 맡긴다. 이 모달은
  // pollingExhausted가 켜질 때 새로 마운트되므로 카운트다운은 useState 초기값으로 시작한다.
  useEffect(() => {
    if (!open) return;
    navigatedRef.current = false;

    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1_000);
    const timeout = setTimeout(() => {
      navigateOnce(() => autoRedirectRef.current());
    }, autoRedirectSeconds * 1_000);
    intervalRef.current = interval;
    timeoutRef.current = timeout;

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      intervalRef.current = null;
      timeoutRef.current = null;
    };
    // navigateOnce는 ref 기반이라 안정적이며 deps에 넣으면 매 렌더 타이머가 리셋된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRedirectSeconds]);

  // 만료 순간 interval이 먼저 실행돼 0이 스치는 것을 막고 5..1만 표기한다.
  const displaySeconds = Math.max(1, secondsLeft);

  return (
    <AppModal
      open={open}
      title={null}
      width={480}
      closable={false}
      footer={null}
      keyboard={false}
      mask={{ closable: false }}
      destroyOnHidden
    >
      <div className="grid gap-3 sm:gap-4" data-testid="analysis-pending-modal">
        <div className="grid justify-items-center gap-2 text-center">
          <h2 className="m-0 text-xl font-bold leading-tight text-text sm:text-2xl">
            {t("pendingModalTitle")}
          </h2>
          <p className="m-0 max-w-md text-xs text-text-secondary sm:text-sm">
            {t("pendingModalDescription")}
          </p>
        </div>

        {/* 자동 이동 예고는 모달 오픈 시 1회만 읽히도록 초기값 고정 + aria-live. */}
        <Paragraph
          aria-live="polite"
          className="m-0 text-center text-xs text-text-secondary"
          data-testid="analysis-pending-auto-note"
        >
          {t("pendingModalAutoNote", { seconds: autoRedirectSeconds })}
        </Paragraph>

        <div className="mt-4 grid grid-cols-[2fr_3fr] gap-3">
          <Button
            block
            size="large"
            data-testid="analysis-pending-dashboard"
            onClick={() => navigateOnce(onGoDashboard)}
          >
            {t("dashboardButton")}
          </Button>
          <Button
            block
            size="large"
            type="primary"
            data-testid="analysis-pending-library"
            onClick={() => navigateOnce(onGoLibrary)}
          >
            {t("pendingModalLibraryButton", { seconds: displaySeconds })}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
