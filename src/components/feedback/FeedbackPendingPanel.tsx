"use client";

import { Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { useFeedbackStatus } from "@/lib/writing/queries";
import type { WritingSubmissionRow } from "@/lib/writing/types";
import { AnalysisLoadingModal, type AnalysisPhase } from "./AnalysisLoadingModal";

const { Paragraph, Text, Title } = Typography;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type Props = {
  submissionId: string;
  reloadHref?: string | null;
  initialStatus?: AnalysisPhase;
  submission?: Pick<
    WritingSubmissionRow,
    "answer_text" | "char_count" | "question_no" | "submitted_at"
  >;
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

export function FeedbackPendingPanel({
  submissionId,
  reloadHref,
  initialStatus = "pending",
  submission,
}: Props) {
  const t = useTranslations("feedback.analysis");
  const router = useRouter();
  const { data } = useFeedbackStatus(submissionId);
  const status: AnalysisPhase = (data as AnalysisPhase | null) ?? initialStatus;
  const submittedAt = submission?.submitted_at
    ? formatSubmittedAtKst(submission.submitted_at)
    : null;

  return (
    <div className="analysis-loading-shell">
      <AppCard
        className="analysis-loading-background"
        data-testid="analysis-loading-background"
      >
        <div className="analysis-loading-background__head">
          <div>
            <Text className="analysis-loading-background__eyebrow">
              {t("backgroundEyebrow")}
            </Text>
            <Title level={1}>{t("backgroundTitle")}</Title>
          </div>
          {submission?.question_no ? (
            <Tag color="blue">
              {t("questionLabel", { questionNo: submission.question_no })}
            </Tag>
          ) : null}
        </div>

        <div className="analysis-loading-background__meta">
          <Text type="secondary">
            {t("charsLabel", { count: submission?.char_count ?? 0 })}
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
          {submission?.answer_text ?? t("answerUnavailable")}
        </div>
      </AppCard>

      <AnalysisLoadingModal
        open
        status={status}
        onComplete={() => router.refresh()}
        completeHref={reloadHref ?? null}
        onRetry={() => router.refresh()}
      />
    </div>
  );
}
