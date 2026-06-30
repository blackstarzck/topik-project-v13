"use client";

import { App, Col, Row } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LibraryItemView, LibraryTab } from "@/lib/library/types";

import { LibraryActionsPanel } from "./LibraryActionsPanel";
import type { LibraryStats } from "./LibraryStatsPanel";
import { LibraryStatsPanel } from "./LibraryStatsPanel";
import { LibraryTabs } from "./LibraryTabs";
import { PdfExportModal, type ExportSelectionItem } from "./PdfExportModal";
import { createReviewSet } from "./review-set-data";

type Props = {
  activeTab: LibraryTab;
  initialItems: LibraryItemView[];
  stats: LibraryStats;
};

export function LibraryWorkspace({ activeTab, initialItems, stats }: Props) {
  const t = useTranslations("library.tabs");
  const router = useRouter();
  const { message } = App.useApp();
  const [selection, setSelection] = useState<ExportSelectionItem[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);

  async function handleCreateReviewSet() {
    if (selection.length === 0) return;

    setReviewPending(true);
    try {
      const reviewSetId = await createReviewSet(selection.map((s) => s.itemId));
      message.success(t("reviewSetCreated", { count: selection.length }));
      router.push(`/practice/problems?reviewSet=${reviewSetId}` as never);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("reviewSetFailed"),
      );
    } finally {
      setReviewPending(false);
    }
  }

  return (
    <>
      <Row
        data-testid="library-workspace-grid"
        gutter={[16, 16]}
        className="min-h-0 flex-1 items-stretch"
      >
        <Col
          xs={24}
          lg={16}
          data-testid="library-list-column"
          className="flex min-h-0"
        >
          <LibraryTabs
            activeTab={activeTab}
            initialItems={initialItems}
            onSelectionChange={setSelection}
          />
        </Col>
        <Col
          xs={24}
          lg={8}
          data-testid="library-stats-column"
          className="library-stats-column flex min-h-0 lg:h-[calc(max(100vh,100dvh)-var(--workspace-content-padding-block)*2)] lg:max-h-[calc(max(100vh,100dvh)-var(--workspace-content-padding-block)*2)] lg:self-start"
        >
          <LibraryStatsPanel
            stats={stats}
            actionPanel={
              <LibraryActionsPanel
                selection={selection}
                reviewPending={reviewPending}
                onExportClick={() => setExportOpen(true)}
                onCreateReviewSet={handleCreateReviewSet}
              />
            }
          />
        </Col>
      </Row>

      <PdfExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        selection={selection}
      />
    </>
  );
}
