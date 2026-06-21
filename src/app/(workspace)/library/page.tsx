import type { Metadata } from "next";
import { Col, Row } from "antd";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { listLibraryItems } from "@/lib/library/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseLibraryTab } from "@/components/library/library-tab-url";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import {
  LibraryStatsPanel,
  type LibraryStats,
} from "@/components/library/LibraryStatsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("library.page");
  return { title: t("metaTitle") };
}

type Props = { searchParams: Promise<{ tab?: string }> };

/**
 * F-01 region 4 (우측 통계): compute saved-count / avg-score / weakest dim /
 * review-count / last-updated server-side from real owner-scoped data, then
 * pass to the client stats panel. All queries are RLS-bound to auth.uid().
 */
async function computeLibraryStats(userId: string): Promise<LibraryStats> {
  const supabase = await createSupabaseServerClient();

  // saved count + last-updated across all library_items.
  const { data: items } = await supabase
    .from("library_items")
    .select("saved_at, submission_id")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  const savedCount = items?.length ?? 0;
  const lastUpdated = items?.[0]?.saved_at ?? null;

  const savedSubmissionIds = (items ?? [])
    .map((r) => r.submission_id)
    .filter((id): id is string => Boolean(id));

  // average writing_feedback score over saved submissions.
  let avgScore: number | null = null;
  let reviewCount = 0;
  if (savedSubmissionIds.length > 0) {
    const { data: feedback } = await supabase
      .from("writing_feedback")
      .select("submission_id, score_total")
      .in("submission_id", savedSubmissionIds);
    const scores = (feedback ?? [])
      .map((f) => f.score_total)
      .filter((s): s is number => typeof s === "number");
    if (scores.length > 0) {
      avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // review count = saved submissions that are retries (parent set).
    const { data: subs } = await supabase
      .from("writing_submissions")
      .select("id, parent_submission_id")
      .in("id", savedSubmissionIds);
    reviewCount = (subs ?? []).filter(
      (s) => s.parent_submission_id != null,
    ).length;
  }

  // weakest dimension across all owner feedback scores.
  let weakestDimension: string | null = null;
  const { data: dims } = await supabase
    .from("feedback_dimension_scores")
    .select("dimension, score, score_max")
    .eq("user_id", userId);
  if (dims && dims.length > 0) {
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const d of dims) {
      if (d.score == null) continue;
      const max = d.score_max != null && d.score_max > 0 ? d.score_max : 100;
      const slot = buckets.get(d.dimension) ?? { sum: 0, count: 0 };
      slot.sum += d.score / max;
      slot.count += 1;
      buckets.set(d.dimension, slot);
    }
    let worst: { dim: string; avg: number } | null = null;
    for (const [dim, slot] of buckets) {
      const avg = slot.sum / slot.count;
      if (!worst || avg < worst.avg) worst = { dim, avg };
    }
    weakestDimension = worst?.dim ?? null;
  }

  return { savedCount, avgScore, weakestDimension, reviewCount, lastUpdated };
}

export default async function LibraryPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;
  const activeTab = parseLibraryTab(sp.tab);
  const t = await getTranslations("library.page");
  const [initialItems, stats] = await Promise.all([
    listLibraryItems(user.id, activeTab),
    computeLibraryStats(user.id),
  ]);

  return (
    <WorkspaceBody className="app-cards-bordered">
      <PageHeader title={t("heading")} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <LibraryTabs activeTab={activeTab} initialItems={initialItems} />
        </Col>
        <Col xs={24} lg={8}>
          <LibraryStatsPanel stats={stats} />
        </Col>
      </Row>
    </WorkspaceBody>
  );
}
