"use client";

import { App, Button, Empty, Radio, Tag, Typography } from "antd";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { useCreateComparisonReport } from "@/lib/writing/mutations";
import type { ComparisonTargetCandidate } from "@/lib/writing/server";

const { Text } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  currentSubmissionId: string;
  currentQuestionNo: number;
  selectedPreviousSubmissionId: string | null;
  candidates: ComparisonTargetCandidate[];
};

function normalizedScore(score: number | null, scoreMax: number | null) {
  if (score === null) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return Math.round((score / max) * 1000) / 10;
}

function defaultSelectedId(
  candidates: ComparisonTargetCandidate[],
  selectedPreviousSubmissionId: string | null,
) {
  if (
    selectedPreviousSubmissionId &&
    candidates.some(
      (candidate) => candidate.submissionId === selectedPreviousSubmissionId,
    )
  ) {
    return selectedPreviousSubmissionId;
  }
  return (
    candidates.find(
      (candidate) => candidate.isRecommended && !candidate.isDisabled,
    )?.submissionId ??
    candidates.find((candidate) => !candidate.isDisabled)?.submissionId ??
    null
  );
}

export function ComparisonTargetDrawer({
  open,
  onClose,
  currentSubmissionId,
  currentQuestionNo,
  selectedPreviousSubmissionId,
  candidates,
}: Props) {
  const t = useTranslations("reports.comparison");
  const format = useFormatter();
  const router = useRouter();
  const { notification } = App.useApp();
  const compare = useCreateComparisonReport();
  const [draftSelectedId, setDraftSelectedId] = useState<string | null>(null);
  const fallbackSelectedId = useMemo(
    () => defaultSelectedId(candidates, selectedPreviousSubmissionId),
    [candidates, selectedPreviousSubmissionId],
  );
  const selectedId = draftSelectedId ?? fallbackSelectedId;

  const selectedCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.submissionId === selectedId) ??
      null,
    [candidates, selectedId],
  );
  const unchanged = selectedId === selectedPreviousSubmissionId;
  const canCompare =
    Boolean(selectedId) &&
    Boolean(selectedCandidate) &&
    !selectedCandidate?.isDisabled;

  function handleCompare() {
    if (!selectedId || !selectedCandidate || selectedCandidate.isDisabled) {
      return;
    }
    compare.mutate(
      { current_id: currentSubmissionId, previous_id: selectedId },
      {
        onSuccess: ({ reportId }) => {
          router.push(`/writing/reports/${reportId}/compare`);
        },
        onError: (error) => {
          notification.error({
            title: t("targetDrawerCompareFailedTitle"),
            description: error.message,
          });
        },
      },
    );
  }

  function handleClose() {
    setDraftSelectedId(null);
    onClose();
  }

  return (
    <AppDrawer
      open={open}
      onClose={handleClose}
      placement="right"
      size={420}
      title={t("targetDrawerTitle")}
      rootClassName="comparison-target-drawer"
      getContainer={false}
      rootStyle={{ position: "absolute" }}
      styles={{
        body: { padding: 0 },
        footer: {
          borderTop: "1px solid var(--app-color-border)",
          padding: 16,
        },
      }}
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button
            type="primary"
            block
            loading={compare.isPending}
            disabled={!canCompare || unchanged || compare.isPending}
            onClick={handleCompare}
            data-testid="comparison-target-confirm"
          >
            {t("targetDrawerCompare")}
          </Button>
          <Button block onClick={handleClose} disabled={compare.isPending}>
            {t("targetDrawerCancel")}
          </Button>
          {unchanged && selectedId ? (
            <Text type="secondary" className="text-center text-xs">
              {t("targetDrawerUnchanged")}
            </Text>
          ) : null}
        </div>
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        data-testid="comparison-target-drawer-body"
      >
        <div className="flex flex-col gap-2">
          <Text type="secondary">
            {t("targetDrawerDescription", { questionNo: currentQuestionNo })}
          </Text>
          <Tag className="w-fit">{t("targetDrawerSameProblem")}</Tag>
        </div>

        {candidates.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("targetDrawerEmpty")}
            data-testid="comparison-target-empty"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((candidate) => {
              const score = normalizedScore(
                candidate.score,
                candidate.scoreMax,
              );
              const selected = selectedId === candidate.submissionId;
              return (
                <label
                  key={candidate.submissionId}
                  data-testid="comparison-target-option"
                  data-submission-id={candidate.submissionId}
                  data-selected={selected ? "true" : "false"}
                  className={[
                    "flex gap-3 rounded-lg border border-border bg-background px-3 py-3",
                    candidate.isDisabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-[var(--app-color-bg-layout)]",
                    selected
                      ? "border-[var(--app-color-primary)] bg-[var(--app-color-bg-layout)]"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Radio
                    checked={selected}
                    disabled={candidate.isDisabled}
                    onChange={() => setDraftSelectedId(candidate.submissionId)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-1">
                      <Text strong>
                        {t("targetDrawerQuestion", {
                          questionNo: candidate.questionNo,
                        })}
                      </Text>
                      {candidate.isRecommended ? (
                        <Tag>{t("targetDrawerRecommended")}</Tag>
                      ) : null}
                      {candidate.isSelected ? (
                        <Tag>{t("targetDrawerSelected")}</Tag>
                      ) : null}
                      {candidate.isDisabled ? (
                        <Tag>{t("targetDrawerUnavailable")}</Tag>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <Text type="secondary">
                        {format.dateTime(new Date(candidate.submittedAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Text>
                      <Text type="secondary">
                        {t("targetDrawerChars", {
                          count: candidate.charCount,
                        })}
                      </Text>
                    </span>
                    <Text>
                      {score === null
                        ? t("targetDrawerNoScore")
                        : t("targetDrawerScore", { score })}
                    </Text>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </AppDrawer>
  );
}
