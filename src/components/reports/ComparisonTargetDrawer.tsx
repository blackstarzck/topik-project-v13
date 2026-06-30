"use client";

import { App, Button, Empty, Radio, Select, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AppDrawer } from "@/components/shared/AppDrawer";
import type { ComparisonReportViewModel } from "@/lib/writing/comparison-report-view-model";
import { useCreateComparisonReportWithView } from "@/lib/writing/mutations";
import type { ComparisonTargetCandidate } from "@/lib/writing/server";

const { Text } = Typography;

type DateSortMode = "newest" | "oldest";
type ScoreSortMode = "none" | "score-desc" | "score-asc";

type Props = {
  open: boolean;
  onClose: () => void;
  currentSubmissionId: string;
  currentQuestionNo: number;
  selectedPreviousSubmissionId: string | null;
  candidates: ComparisonTargetCandidate[];
  onComparisonReportLoaded: (viewModel: ComparisonReportViewModel) => void;
};

function normalizedScore(score: number | null, scoreMax: number | null) {
  if (score === null) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return Math.round((score / max) * 1000) / 10;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return value;
  const kst = new Date(time + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())}`,
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`,
  ].join(" ");
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
  onComparisonReportLoaded,
}: Props) {
  const t = useTranslations("reports.comparison");
  const { notification } = App.useApp();
  const compare = useCreateComparisonReportWithView();
  const [draftSelectedId, setDraftSelectedId] = useState<string | null>(null);
  const [dateSortMode, setDateSortMode] = useState<DateSortMode>("newest");
  const [scoreSortMode, setScoreSortMode] = useState<ScoreSortMode>("none");
  const fallbackSelectedId = useMemo(
    () => defaultSelectedId(candidates, selectedPreviousSubmissionId),
    [candidates, selectedPreviousSubmissionId],
  );
  const selectedId = draftSelectedId ?? fallbackSelectedId;
  const visibleCandidates = useMemo(() => {
    const sortCandidates = (items: ComparisonTargetCandidate[]) =>
      [...items].sort((a, b) => {
        if (a.isDisabled !== b.isDisabled) {
          return a.isDisabled ? 1 : -1;
        }

        if (scoreSortMode !== "none") {
          const aScore = normalizedScore(a.score, a.scoreMax) ?? -1;
          const bScore = normalizedScore(b.score, b.scoreMax) ?? -1;
          const scoreDelta =
            scoreSortMode === "score-desc" ? bScore - aScore : aScore - bScore;
          if (scoreDelta !== 0) return scoreDelta;
        }

        const submittedDelta =
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        return dateSortMode === "newest" ? submittedDelta : -submittedDelta;
      });

    return sortCandidates(
      candidates.filter((candidate) => !candidate.isDisabled),
    );
  }, [candidates, dateSortMode, scoreSortMode]);

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
        onSuccess: ({ viewModel }) => {
          onComparisonReportLoaded(viewModel);
          notification.success({
            title: t("targetDrawerCompareSuccessTitle"),
          });
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
      size={376}
      title={t("targetDrawerTitle")}
      rootClassName="comparison-target-drawer"
      getContainer={false}
      rootStyle={{ position: "fixed", inset: 0 }}
      styles={{
        body: {
          flex: "1 1 0%",
          minHeight: 0,
          overflow: "hidden",
          padding: 0,
        },
        header: {
          padding: "24px 24px 14px",
          borderBottom: "0",
        },
        footer: {
          position: "sticky",
          bottom: 0,
          zIndex: 1,
          flexShrink: 0,
          borderTop: "1px solid var(--app-color-border)",
          background: "var(--app-color-bg-container)",
          padding: "18px 24px 20px",
        },
        mask: {
          background: "rgba(244, 244, 245, 0.18)",
        },
        section: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        },
        wrapper: {
          height: "100dvh",
        },
      }}
      footer={
        <div
          className="comparison-target-drawer-footer flex w-full flex-col gap-3"
          data-testid="comparison-target-drawer-footer"
        >
          <div className="grid grid-cols-2 gap-3">
            <Button
              block
              className="h-11"
              onClick={handleClose}
              disabled={compare.isPending}
            >
              {t("targetDrawerCancel")}
            </Button>
            <Button
              type="primary"
              block
              className="h-11"
              loading={compare.isPending}
              disabled={!canCompare || unchanged || compare.isPending}
              onClick={handleCompare}
              data-testid="comparison-target-confirm"
            >
              {unchanged
                ? t("targetDrawerAlreadySelectedButton")
                : t("targetDrawerCompare")}
            </Button>
          </div>
        </div>
      }
    >
      <div
        className="flex h-full min-h-0 flex-1 flex-col gap-5 overflow-hidden px-3 pt-2"
        data-testid="comparison-target-drawer-body"
      >
        <div className="flex flex-col gap-3">
          <Text type="secondary">
            {t("targetDrawerDescription", { questionNo: currentQuestionNo })}
          </Text>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select<DateSortMode>
            value={dateSortMode}
            onChange={setDateSortMode}
            data-testid="comparison-target-date-sort"
            options={[
              { value: "newest", label: t("targetDrawerSortNewest") },
              { value: "oldest", label: t("targetDrawerSortOldest") },
            ]}
          />
          <Select<ScoreSortMode>
            value={scoreSortMode}
            onChange={setScoreSortMode}
            data-testid="comparison-target-score-sort"
            options={[
              { value: "none", label: t("targetDrawerSortScore") },
              { value: "score-desc", label: t("targetDrawerSortScoreHigh") },
              { value: "score-asc", label: t("targetDrawerSortScoreLow") },
            ]}
          />
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6"
          data-testid="comparison-target-list-scroll"
        >
          {visibleCandidates.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("targetDrawerEmpty")}
              data-testid="comparison-target-empty"
            />
          ) : (
            <div className="flex flex-col">
              {visibleCandidates.map((candidate) => {
                const score = normalizedScore(
                  candidate.score,
                  candidate.scoreMax,
                );
                const selected = selectedId === candidate.submissionId;
                const candidateIndex = candidates.findIndex(
                  (item) => item.submissionId === candidate.submissionId,
                );
                const attemptNo =
                  candidateIndex >= 0
                    ? candidates.length - candidateIndex
                    : null;
                return (
                  <label
                    key={candidate.submissionId}
                    data-testid="comparison-target-option"
                    data-submission-id={candidate.submissionId}
                    data-feedback-status={candidate.feedbackStatus}
                    data-selected={selected ? "true" : "false"}
                    className={[
                      "flex cursor-pointer gap-3 border-b border-[var(--ant-color-border-secondary)] px-3 py-4 transition-colors last:border-b-0 hover:bg-[var(--app-color-bg-layout)]",
                      selected ? "bg-[var(--app-color-bg-layout)]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Radio
                      checked={selected}
                      onChange={() =>
                        setDraftSelectedId(candidate.submissionId)
                      }
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span
                        className="flex min-w-0 flex-col gap-1"
                        data-testid="comparison-target-option-meta"
                      >
                        <Text strong className="block truncate text-base">
                          {attemptNo
                            ? t("targetDrawerAttempt", { count: attemptNo })
                            : t("targetDrawerQuestion", {
                                questionNo: candidate.questionNo,
                              })}
                        </Text>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <Text type="secondary">
                            {formatSubmittedAt(candidate.submittedAt)}
                          </Text>
                        </span>
                      </span>
                      <Text
                        strong
                        className="shrink-0 self-center text-xl"
                        data-testid="comparison-target-option-score"
                      >
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
      </div>
    </AppDrawer>
  );
}
