"use client";

import { App, Button, Input, Space, Tabs, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import type { LibraryItemView, LibraryTab } from "@/lib/library/types";

import { LibraryExportsTab } from "./LibraryExportsTab";
import { LibraryReportsTab } from "./LibraryReportsTab";
import { LibrarySavedProblemsTab } from "./LibrarySavedProblemsTab";
import { LibrarySubmissionsTab } from "./LibrarySubmissionsTab";
import { PdfExportModal, type ExportSelectionItem } from "./PdfExportModal";
import { createReviewSet } from "./review-set-data";
import { buildLibraryTabUrl, isLibraryTab } from "./library-tab-url";

const { Text } = Typography;

type Props = {
  activeTab: LibraryTab;
  initialItems: LibraryItemView[];
};

function pickSubmissions(items: LibraryItemView[]) {
  return items.filter(
    (i): i is Extract<LibraryItemView, { kind: "submission" }> =>
      i.kind === "submission",
  );
}
function pickReports(items: LibraryItemView[]) {
  return items.filter(
    (i): i is Extract<LibraryItemView, { kind: "report" }> => i.kind === "report",
  );
}
function pickProblems(items: LibraryItemView[]) {
  return items.filter(
    (i): i is Extract<LibraryItemView, { kind: "problem" }> => i.kind === "problem",
  );
}
function pickExports(items: LibraryItemView[]) {
  return items.filter(
    (i): i is Extract<LibraryItemView, { kind: "export" }> => i.kind === "export",
  );
}

export function LibraryTabs({ activeTab, initialItems }: Props) {
  const t = useTranslations("library.tabs");
  const router = useRouter();
  const params = useSearchParams();
  const { message } = App.useApp();

  // F-01 region 1 (검색/필터): in-memory search over the already-fetched rows.
  // Phase 6 has no server-side library search, so this filters client-side by
  // title/tags. Each tab applies `matchesLibrarySearch` against this term.
  const [searchTerm, setSearchTerm] = useState("");

  // F-01 region 2 (내보내기/생성 액션): selection lifted from the submissions
  // tab drives the PDF export modal (F-M1) and the 복습 세트 생성 action.
  const [selection, setSelection] = useState<ExportSelectionItem[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);

  const handleSelectionChange = useCallback((items: ExportSelectionItem[]) => {
    setSelection(items);
  }, []);

  async function handleCreateReviewSet() {
    setReviewPending(true);
    try {
      await createReviewSet(selection.map((s) => s.itemId));
      message.success(t("reviewSetCreated", { count: selection.length }));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("reviewSetFailed"),
      );
    } finally {
      setReviewPending(false);
    }
  }

  // Server-rendered initial items hydrate only the active tab. The other
  // three tabs start empty and rely on `useLibraryItems(tab)` to fetch on
  // first mount. This keeps the SSR payload bounded.
  const submissionsInitial = useMemo(
    () => (activeTab === "submissions" ? pickSubmissions(initialItems) : []),
    [activeTab, initialItems],
  );
  const reportsInitial = useMemo(
    () => (activeTab === "reports" ? pickReports(initialItems) : []),
    [activeTab, initialItems],
  );
  const problemsInitial = useMemo(
    () => (activeTab === "problems" ? pickProblems(initialItems) : []),
    [activeTab, initialItems],
  );
  const exportsInitial = useMemo(
    () => (activeTab === "exports" ? pickExports(initialItems) : []),
    [activeTab, initialItems],
  );

  function handleChange(key: string) {
    if (!isLibraryTab(key) || key === activeTab) return;
    const url = buildLibraryTabUrl(key, params);
    router.replace(url as never);
  }

  const items = [
    {
      key: "submissions" satisfies LibraryTab,
      label: t("submissions"),
      children: (
        <LibrarySubmissionsTab
          initialItems={submissionsInitial}
          searchTerm={searchTerm}
          onResetSearch={() => setSearchTerm("")}
          onSelectionChange={handleSelectionChange}
        />
      ),
    },
    {
      key: "reports" satisfies LibraryTab,
      label: t("reports"),
      children: (
        <LibraryReportsTab
          initialItems={reportsInitial}
          searchTerm={searchTerm}
          onResetSearch={() => setSearchTerm("")}
        />
      ),
    },
    {
      key: "problems" satisfies LibraryTab,
      label: t("problems"),
      children: (
        <LibrarySavedProblemsTab
          initialItems={problemsInitial}
          searchTerm={searchTerm}
          onResetSearch={() => setSearchTerm("")}
        />
      ),
    },
    {
      key: "exports" satisfies LibraryTab,
      label: t("exports"),
      children: (
        <LibraryExportsTab
          initialItems={exportsInitial}
          searchTerm={searchTerm}
          onResetSearch={() => setSearchTerm("")}
        />
      ),
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Input.Search
        data-testid="library-search"
        allowClear
        maxLength={40}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchAriaLabel")}
        style={{ maxWidth: 360 }}
      />

      {/* F-01 region 2 (내보내기/생성 액션): selection-driven actions. The
          submissions tab lifts its current selection; these actions apply to
          저장 답안 선택. 액션 3개 이하: PDF 내보내기 / 복습 세트 생성 / 선택 해제.
          선택 없음은 버튼 비활성으로 안내한다. */}
      <AppCard data-testid="library-actions" size="small">
        <Space wrap>
          <Tag
            data-testid="library-selection-count"
            color={selection.length > 0 ? "blue" : "default"}
          >
            {t("selectionCount", { count: selection.length })}
          </Tag>
          <Button
            data-testid="library-export-pdf"
            type="primary"
            disabled={selection.length === 0}
            onClick={() => setExportOpen(true)}
          >
            {t("exportPdf")}
          </Button>
          <Button
            data-testid="library-create-review-set"
            disabled={selection.length === 0}
            loading={reviewPending}
            onClick={handleCreateReviewSet}
          >
            {t("createReviewSet")}
          </Button>
          {selection.length === 0 ? (
            <Text type="secondary">{t("selectionHint")}</Text>
          ) : null}
        </Space>
      </AppCard>

      <Tabs
        data-testid="library-tabs"
        activeKey={activeTab}
        destroyOnHidden
        onChange={handleChange}
        items={items}
      />

      <PdfExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        selection={selection}
      />
    </Space>
  );
}
