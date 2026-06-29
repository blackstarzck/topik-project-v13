"use client";

import { App, Button, Empty, Radio, Select, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { CheckCircle2, Clock3 } from "@/components/shared/AppIcons";
import { useCreateComparisonReport } from "@/lib/writing/mutations";
import type { ComparisonTargetCandidate } from "@/lib/writing/server";

const { Text } = Typography;

type StatusFilter = "complete" | "with-analysis";
type SortMode = "newest" | "score";

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
}: Props) {
  const t = useTranslations("reports.comparison");
  const router = useRouter();
  const { notification } = App.useApp();
  const compare = useCreateComparisonReport();
  const [draftSelectedId, setDraftSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("complete");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const fallbackSelectedId = useMemo(
    () => defaultSelectedId(candidates, selectedPreviousSubmissionId),
    [candidates, selectedPreviousSubmissionId],
  );
  const selectedId = draftSelectedId ?? fallbackSelectedId;
  const visibleCandidates = useMemo(() => {
    const filtered =
      statusFilter === "complete"
        ? candidates.filter((candidate) => !candidate.isDisabled)
        : candidates;
    return [...filtered].sort((a, b) => {
      if (sortMode === "score") {
        const aScore = normalizedScore(a.score, a.scoreMax) ?? -1;
        const bScore = normalizedScore(b.score, b.scoreMax) ?? -1;
        return bScore - aScore;
      }
      return (
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    });
  }, [candidates, sortMode, statusFilter]);

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
          <div className="grid grid-cols-2 gap-3">
            <Button block onClick={handleClose} disabled={compare.isPending}>
              {t("targetDrawerCancel")}
            </Button>
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
          </div>
          {unchanged && selectedId ? (
            <Text type="secondary" className="text-center text-xs">
              {t("targetDrawerUnchanged")}
            </Text>
          ) : null}
        </div>
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
        data-testid="comparison-target-drawer-body"
      >
        <div className="flex flex-col gap-2">
          <Text type="secondary">
            {t("targetDrawerDescription", { questionNo: currentQuestionNo })}
          </Text>
          <Tag className="w-fit" data-testid="comparison-target-same-problem">
            {t("targetDrawerSameProblem")}
          </Tag>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            data-testid="comparison-target-status-filter"
            options={[
              {
                value: "complete",
                label: t("targetDrawerFilterComplete"),
              },
              {
                value: "with-analysis",
                label: t("targetDrawerFilterWithAnalysis"),
              },
            ]}
          />
          <Select<SortMode>
            value={sortMode}
            onChange={setSortMode}
            data-testid="comparison-target-sort"
            options={[
              { value: "newest", label: t("targetDrawerSortNewest") },
              { value: "score", label: t("targetDrawerSortScore") },
            ]}
          />
        </div>

        {visibleCandidates.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              candidates.length === 0
                ? t("targetDrawerEmpty")
                : t("targetDrawerNoFilteredCandidates")
            }
            data-testid="comparison-target-empty"
          />
        ) : (
          <div className="flex flex-col gap-2">
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
                candidateIndex >= 0 ? candidates.length - candidateIndex : null;
              return (
                <label
                  key={candidate.submissionId}
                  data-testid="comparison-target-option"
                  data-submission-id={candidate.submissionId}
                  data-feedback-status={candidate.feedbackStatus}
                  data-selected={selected ? "true" : "false"}
                  className={[
                    "flex gap-3 rounded-lg border border-border bg-background px-3 py-4 transition-colors",
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
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="mb-1 flex flex-wrap items-center gap-1">
                          {candidate.isRecommended ? (
                            <Tag>{t("targetDrawerRecommended")}</Tag>
                          ) : null}
                          {candidate.isSelected ? (
                            <Tag>{t("targetDrawerSelected")}</Tag>
                          ) : null}
                          {candidate.isDisabled ? (
                            <Tag icon={<Clock3 aria-hidden size={12} />}>
                              {t("targetDrawerUnavailable")}
                            </Tag>
                          ) : (
                            <Tag icon={<CheckCircle2 aria-hidden size={12} />}>
                              {t("targetDrawerComplete")}
                            </Tag>
                          )}
                        </span>
                        <Text strong className="block truncate text-base">
                          {attemptNo
                            ? t("targetDrawerAttempt", { count: attemptNo })
                            : t("targetDrawerQuestion", {
                                questionNo: candidate.questionNo,
                              })}
                        </Text>
                      </span>
                      <Text strong className="shrink-0 text-xl">
                        {score === null
                          ? t("targetDrawerNoScore")
                          : t("targetDrawerScore", { score })}
                      </Text>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <Text type="secondary">
                        {formatSubmittedAt(candidate.submittedAt)}
                      </Text>
                      <Text type="secondary">
                        {t("targetDrawerChars", {
                          count: candidate.charCount,
                        })}
                      </Text>
                    </span>
                    {candidate.isDisabled ? (
                      <Text type="secondary" className="text-xs">
                        {t("targetDrawerDisabledReason")}
                      </Text>
                    ) : null}
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
