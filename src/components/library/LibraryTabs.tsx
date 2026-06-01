"use client";

import { Alert, Input, Space, Tabs, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { LibraryItemView, LibraryTab } from "@/lib/library/types";

import { LibraryExportsTab } from "./LibraryExportsTab";
import { LibraryReportsTab } from "./LibraryReportsTab";
import { LibrarySavedProblemsTab } from "./LibrarySavedProblemsTab";
import { LibrarySubmissionsTab } from "./LibrarySubmissionsTab";
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

  // F-01 region 1 (검색/필터): in-memory search over the already-fetched rows.
  // Phase 6 has no server-side library search, so this filters client-side by
  // title/tags. Each tab applies `matchesLibrarySearch` against this term.
  const [searchTerm, setSearchTerm] = useState("");

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
      {/* F-01 region 2 (내보내기/생성 액션): top-level guidance for the
          per-row PDF 내보내기 action. Phase 6 export is browser-print (F-M1
          superseded to a print MVP), so this region honestly points at the
          per-row "PDF로 내보내기" buttons rather than promising a bulk modal. */}
      <Alert
        type="info"
        showIcon
        message="PDF로 내보내기"
        description={
          <Text type="secondary">
            저장한 답안·리포트는 각 항목의 &ldquo;PDF로 내보내기&rdquo; 버튼으로
            브라우저 인쇄를 통해 PDF로 저장할 수 있어요. 여러 항목 묶음 내보내기는
            준비 중입니다.
          </Text>
        }
      />
      <Tabs activeKey={activeTab} onChange={handleChange} items={items} />
    </Space>
  );
}
