"use client";

import { useEffect } from "react";
import { Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import {
  AnalysisLoadingPage,
  type AnalysisPhase,
} from "@/components/feedback/AnalysisLoadingModal";
import { useFeedbackStatus } from "@/lib/writing/queries";
import type { QuestionNo } from "@/lib/writing/types";

const { Paragraph, Text, Title } = Typography;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type SubmittedAnalysisState = {
  submissionId: string;
  questionNo: QuestionNo;
  answerText: string;
  charCount: number;
  submittedAt: string;
  feedbackHref: string;
};

type Props = {
  state: SubmittedAnalysisState;
};

function formatSubmittedAtKst(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const date = new Date(time + KST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}:${second} KST`;
}

export function SubmittedAnalysisPanel({ state }: Props) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const { data, pollingExhausted } = useFeedbackStatus(state.submissionId);
  const status: AnalysisPhase = (data as AnalysisPhase | null) ?? "analyzing";
  const submittedAt = formatSubmittedAtKst(state.submittedAt);
  const showSubmittedAnswer = status !== "failed";
  const analysisInProgress = status === "pending" || status === "analyzing";
  const leaveConfirmMessage = t("cancelConfirm");

  // 분석이 끝나면 곧바로 피드백 화면으로 이동한다. 그 라우트를 분석 중 미리 prefetch해
  // 두면 완료 시 router.replace가 즉시 그려져, 정적인 "완료" 화면에 머무르는 체감 지연을
  // 없앨 수 있다(이동은 AnalysisLoadingPage의 complete effect가 수행).
  useEffect(() => {
    router.prefetch?.(state.feedbackHref as never);
  }, [router, state.feedbackHref]);

  // 분석이 진행 중일 때만 브라우저 새로고침/닫기(beforeunload)와 뒤로가기(popstate)를
  // 기기 빌트인 확인 창으로 막는다. 분석은 history에 남지 않는 일시 상태라, 경고 없이
  // 이탈하면 진행 중인 분석 화면이 사라진다. 완료/실패로 바뀌면 가드를 해제한다.
  useEffect(() => {
    if (!analysisInProgress) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 앱 내부 뒤로가기를 가로채기 위한 sentinel history 항목.
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      if (window.confirm(leaveConfirmMessage)) {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
        return;
      }
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [analysisInProgress, leaveConfirmMessage]);
  const pageClassName = [
    "submitted-analysis-page",
    status === "failed" ? "submitted-analysis-page--failed" : null,
  ]
    .filter(Boolean)
    .join(" ");

  function handleComplete() {
    router.replace(state.feedbackHref as never);
  }

  return (
    <div className={pageClassName} data-testid="analysis-loading-page">
      <section className="submitted-analysis-page__status">
        <AnalysisLoadingPage
          status={status}
          pollingExhausted={pollingExhausted}
          completeHref={state.feedbackHref}
          onComplete={handleComplete}
          onRetry={() => router.refresh()}
        />
      </section>

      {showSubmittedAnswer ? (
        <AppCard
          className="analysis-loading-background submitted-analysis-page__answer-card"
          data-testid="analysis-loading-background"
        >
          <div className="analysis-loading-background__head">
            <div>
              <Text className="analysis-loading-background__eyebrow">
                {t("backgroundEyebrow")}
              </Text>
              <Title level={1}>{t("backgroundTitle")}</Title>
            </div>
            <Tag color="blue">
              {t("questionLabel", { questionNo: state.questionNo })}
            </Tag>
          </div>

          <div className="analysis-loading-background__meta">
            <Text type="secondary">
              {t("charsLabel", { count: state.charCount })}
            </Text>
            {submittedAt ? (
              <Text type="secondary">
                {t("submittedAtLabel", { submittedAt })}
              </Text>
            ) : null}
          </div>

          <Paragraph className="analysis-loading-background__notice">
            {t("readOnlyNotice")}
          </Paragraph>

          <div className="analysis-loading-background__answer">
            {state.answerText || t("answerUnavailable")}
          </div>
        </AppCard>
      ) : null}
    </div>
  );
}
