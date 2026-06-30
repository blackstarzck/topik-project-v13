"use client";

import type { LibraryDashboardView } from "@/lib/library/types";
import { LibraryFeedbackWaitingPanel } from "./LibraryFeedbackWaitingPanel";
import { LibraryKpiStrip } from "./LibraryKpiStrip";
import { LibraryReviewCandidateSwiper } from "./LibraryReviewCandidateSwiper";
import { LibraryTimelinePanel } from "./LibraryTimelinePanel";
import { LibraryWeakItemsPanel } from "./LibraryWeakItemsPanel";

type Props = {
  dashboard: LibraryDashboardView;
};

export function LibraryDashboard({ dashboard }: Props) {
  return (
    <div
      data-testid="library-dashboard"
      className="flex min-h-0 w-full flex-col gap-4"
    >
      <LibraryKpiStrip kpis={dashboard.kpis} />
      <LibraryReviewCandidateSwiper candidates={dashboard.reviewCandidates} />
      <div className="grid gap-4 xl:grid-cols-3">
        <LibraryFeedbackWaitingPanel items={dashboard.feedbackWaiting} />
        <LibraryWeakItemsPanel items={dashboard.weakItems} />
        <LibraryTimelinePanel items={dashboard.timeline} />
      </div>
    </div>
  );
}
