"use client";

import { App, Button, Card, Input, Space, Tabs, Tag, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

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

const TAB_LABELS: Record<LibraryTab, string> = {
  submissions: "저장 답안",
  reports: "비교 리포트",
  problems: "저장 문제",
  exports: "내보내기",
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
      message.success(
        `복습 세트를 만들었어요. (${selection.length}개 항목)`,
      );
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "복습 세트 생성에 실패했어요.",
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
      label: TAB_LABELS.submissions,
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
      label: TAB_LABELS.reports,
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
      label: TAB_LABELS.problems,
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
      label: TAB_LABELS.exports,
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
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Input.Search
        allowClear
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="제목·태그로 검색 (2자 이상)"
        aria-label="서재 검색"
        style={{ maxWidth: 360 }}
      />

      {/* F-01 region 2 (내보내기/생성 액션): selection-driven actions. The
          submissions tab lifts its current selection; these actions apply to
          저장 답안 선택. 액션 3개 이하: PDF 내보내기 / 복습 세트 생성 / 선택 해제.
          선택 없음은 버튼 비활성으로 안내한다. */}
      <Card size="small">
        <Space wrap>
          <Tag color={selection.length > 0 ? "blue" : "default"}>
            선택 {selection.length}개
          </Tag>
          <Button
            type="primary"
            disabled={selection.length === 0}
            onClick={() => setExportOpen(true)}
          >
            PDF로 내보내기
          </Button>
          <Button
            disabled={selection.length === 0}
            loading={reviewPending}
            onClick={handleCreateReviewSet}
          >
            복습 세트로 생성
          </Button>
          {selection.length === 0 ? (
            <Text type="secondary">
              저장 답안 탭에서 항목을 선택하면 내보내기·복습 세트를 만들 수 있어요.
            </Text>
          ) : null}
        </Space>
      </Card>

      <Tabs activeKey={activeTab} onChange={handleChange} items={items} />

      <PdfExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        selection={selection}
      />
    </Space>
  );
}
