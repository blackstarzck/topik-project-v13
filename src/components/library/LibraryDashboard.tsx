"use client";

import { useMemo, useRef, useState } from "react";

import { fetchWithGoogleAnalytics } from "@/lib/analytics/google-analytics";
import type {
  LibraryDashboardView,
  LibraryFeedbackWaitingSyncTarget,
  LibraryFeedbackWaitingSyncedStatus,
  LibraryFeedbackWaitingVisibleItem,
} from "@/lib/library/types";
import { LibraryFeedbackWaitingPanel } from "./LibraryFeedbackWaitingPanel";
import { LibraryKpiStrip } from "./LibraryKpiStrip";
import { LibraryReviewCandidateSwiper } from "./LibraryReviewCandidateSwiper";
import { LibraryTimelinePanel } from "./LibraryTimelinePanel";

type Props = {
  dashboard: LibraryDashboardView;
};

export function LibraryDashboard({ dashboard }: Props) {
  const feedbackWaitingSync = useLibraryFeedbackWaitingSync(dashboard);

  return (
    <div
      data-testid="library-dashboard"
      className="flex min-h-0 w-full flex-col gap-10 xl:gap-12"
    >
      <LibraryKpiStrip
        kpis={feedbackWaitingSync.kpis}
        feedbackWaitingRefresh={{
          canRefresh: feedbackWaitingSync.canRefresh,
          isRefreshing: feedbackWaitingSync.isRefreshing,
          onRefresh: feedbackWaitingSync.refreshWaitingItems,
        }}
      />
      <LibraryReviewCandidateSwiper candidates={dashboard.reviewCandidates} />
      <div className="grid gap-4 xl:grid-cols-2">
        <LibraryFeedbackWaitingPanel
          items={feedbackWaitingSync.visibleItems}
          canRefresh={feedbackWaitingSync.canRefresh}
          isRefreshing={feedbackWaitingSync.isRefreshing}
          syncErrorIds={feedbackWaitingSync.syncErrorIds}
          onRefresh={feedbackWaitingSync.refreshWaitingItems}
        />
        <LibraryTimelinePanel items={dashboard.timeline} />
      </div>
    </div>
  );
}

type SyncResult =
  | {
      ok: true;
      status: LibraryFeedbackWaitingSyncedStatus;
    }
  | {
      ok: false;
      status: LibraryFeedbackWaitingSyncedStatus | null;
    };

function useLibraryFeedbackWaitingSync(dashboard: LibraryDashboardView) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusByItemId, setStatusByItemId] = useState<
    ReadonlyMap<string, LibraryFeedbackWaitingSyncedStatus>
  >(() => new Map());
  const [syncErrorIds, setSyncErrorIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const refreshGenerationRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const visibleItems = useMemo<LibraryFeedbackWaitingVisibleItem[]>(
    () =>
      dashboard.feedbackWaiting.map((item) => ({
        ...item,
        status: statusByItemId.get(item.id) ?? item.status,
      })),
    [dashboard.feedbackWaiting, statusByItemId],
  );

  const syncTargets = useMemo(
    () =>
      dashboard.feedbackWaitingSyncTargets.map((target) => ({
        ...target,
        status: statusByItemId.get(target.itemId) ?? target.initialStatus,
      })),
    [dashboard.feedbackWaitingSyncTargets, statusByItemId],
  );

  const syncableTargets = useMemo(
    () =>
      syncTargets.filter((target) => isSyncableWaitingStatus(target.status)),
    [syncTargets],
  );

  const completedTargetCount = useMemo(
    () => syncTargets.filter((target) => target.status === "complete").length,
    [syncTargets],
  );

  const kpis = useMemo(
    () => ({
      ...dashboard.kpis,
      feedbackWaitingCount: Math.max(
        0,
        dashboard.kpis.feedbackWaitingCount - completedTargetCount,
      ),
    }),
    [completedTargetCount, dashboard.kpis],
  );

  const refreshWaitingItems = async () => {
    if (isRefreshingRef.current || syncableTargets.length === 0) return;

    const generation = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = generation;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setSyncErrorIds((current) => {
      const next = new Set(current);
      for (const target of syncableTargets) next.delete(target.itemId);
      return next;
    });

    const targetGroups = groupTargetsBySubmission(syncableTargets);

    try {
      const results = await Promise.all(
        Array.from(targetGroups, async ([submissionId, targets]) => ({
          targets,
          result: await syncFeedbackWaitingStatus(submissionId),
        })),
      );

      if (refreshGenerationRef.current !== generation) return;

      setStatusByItemId((current) => {
        const next = new Map(current);
        for (const { targets, result } of results) {
          if (!result.ok || !result.status) continue;
          for (const target of targets) {
            next.set(target.itemId, result.status);
          }
        }
        return next;
      });
      setSyncErrorIds(
        new Set(
          results.flatMap(({ targets, result }) =>
            result.ok ? [] : targets.map((target) => target.itemId),
          ),
        ),
      );
    } finally {
      if (refreshGenerationRef.current === generation) {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    }
  };

  return {
    canRefresh: syncableTargets.length > 0,
    isRefreshing,
    kpis,
    refreshWaitingItems,
    syncErrorIds,
    visibleItems,
  };
}

function groupTargetsBySubmission(
  targets: Array<
    LibraryFeedbackWaitingSyncTarget & {
      status: LibraryFeedbackWaitingSyncedStatus;
    }
  >,
) {
  const groups = new Map<string, LibraryFeedbackWaitingSyncTarget[]>();
  for (const target of targets) {
    const group = groups.get(target.submissionId) ?? [];
    group.push(target);
    groups.set(target.submissionId, group);
  }
  return groups;
}

function isSyncableWaitingStatus(status: LibraryFeedbackWaitingSyncedStatus) {
  return status === "pending" || status === "analyzing";
}

async function syncFeedbackWaitingStatus(
  submissionId: string,
): Promise<SyncResult> {
  try {
    const response = await fetchWithGoogleAnalytics(
      `/api/writing/evaluation-status?submissionId=${encodeURIComponent(
        submissionId,
      )}`,
      { cache: "no-store" },
      { apiName: "writing_evaluation_status" },
    );
    const body = (await response.json().catch(() => null)) as {
      feedback_status?: unknown;
    } | null;
    const status = coerceSyncedFeedbackStatus(body?.feedback_status);
    if (!response.ok || !status) return { ok: false, status };
    return { ok: true, status };
  } catch {
    return { ok: false, status: null };
  }
}

function coerceSyncedFeedbackStatus(
  status: unknown,
): LibraryFeedbackWaitingSyncedStatus | null {
  if (
    status === "pending" ||
    status === "analyzing" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }
  return null;
}
