"use client";

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
  const { data } = useFeedbackStatus(state.submissionId);
  const status: AnalysisPhase = (data as AnalysisPhase | null) ?? "analyzing";
  const submittedAt = formatSubmittedAtKst(state.submittedAt);

  function handleComplete() {
    router.replace(state.feedbackHref as never);
  }

  return (
    <div
      className="submitted-analysis-page"
      data-testid="analysis-loading-page"
    >
      <section className="submitted-analysis-page__status">
        <AnalysisLoadingPage
          status={status}
          completeHref={state.feedbackHref}
          onComplete={handleComplete}
          onRetry={() => router.refresh()}
        />
      </section>

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
    </div>
  );
}
