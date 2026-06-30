"use client";

import { Button, Tag, Typography } from "antd";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type { LibraryReviewCandidate } from "@/lib/library/types";

import { formatDashboardDate } from "./library-dashboard-format";

const { Text, Title } = Typography;

type Props = {
  candidate: LibraryReviewCandidate;
};

export function LibraryReviewCandidateCard({ candidate }: Props) {
  const t = useTranslations("library.dashboard");
  const tDim = useTranslations("library.stats.dimensions");
  const primaryReason = t(
    `reason.${candidate.primaryReason}` as Parameters<typeof t>[0],
  );
  const lowestDimension = candidate.lowestDimension
    ? tDim(
        candidate.lowestDimension
          .dimension as Parameters<typeof tDim>[0],
      )
    : null;

  return (
    <AppCard
      size="small"
      data-testid="library-review-candidate-card"
      className="h-full"
    >
      <article className="flex h-full min-h-[166px] flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Tag className="m-0">
            {candidate.questionNo
              ? t("questionNo", { questionNo: candidate.questionNo })
              : t("questionUnknown")}
          </Tag>
          <Tag color="success" className="m-0 inline-flex items-center gap-1">
            <CheckCircle2 aria-hidden size={14} />
            {t("status.feedbackComplete")}
          </Tag>
        </div>

        <div className="min-w-0">
          <Title level={5} className="m-0 truncate">
            {candidate.title}
          </Title>
          <Text type="secondary" className="block text-sm">
            {formatDashboardDate(candidate.submittedAt)} ·{" "}
            {t("charCount", { count: candidate.charCount })}
          </Text>
        </div>

        <div className="flex min-h-[32px] flex-col gap-1">
          <Text
            className={[
              "text-sm",
              candidate.primaryReason === "length_off_target"
                ? "font-medium text-primary"
                : "text-primary",
            ].join(" ")}
          >
            {primaryReason}
          </Text>
          {lowestDimension ? (
            <Text type="secondary" className="text-xs">
              {t("reason.lowDimensionDetail", {
                dimension: lowestDimension,
                score: candidate.lowestDimension?.normalizedScore ?? 0,
              })}
            </Text>
          ) : null}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button type="primary" href={candidate.feedbackHref}>
            {t("actions.viewFeedback")}
          </Button>
          <Button href={candidate.retryHref} icon={<ArrowRight size={14} />}>
            {t("actions.retry")}
          </Button>
        </div>
      </article>
    </AppCard>
  );
}
