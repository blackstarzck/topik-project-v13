"use client";

import { Tabs } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { LibraryItemView, LibraryTab } from "@/lib/library/types";

import { LibraryExportsTab } from "./LibraryExportsTab";
import { LibraryReportsTab } from "./LibraryReportsTab";
import { LibrarySavedProblemsTab } from "./LibrarySavedProblemsTab";
import { LibrarySubmissionsTab } from "./LibrarySubmissionsTab";
import { buildLibraryTabUrl, isLibraryTab } from "./library-tab-url";

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
      children: <LibrarySubmissionsTab initialItems={submissionsInitial} />,
    },
    {
      key: "reports" satisfies LibraryTab,
      label: TAB_LABELS.reports,
      children: <LibraryReportsTab initialItems={reportsInitial} />,
    },
    {
      key: "problems" satisfies LibraryTab,
      label: TAB_LABELS.problems,
      children: <LibrarySavedProblemsTab initialItems={problemsInitial} />,
    },
    {
      key: "exports" satisfies LibraryTab,
      label: TAB_LABELS.exports,
      children: <LibraryExportsTab initialItems={exportsInitial} />,
    },
  ];

  return (
    <Tabs activeKey={activeTab} onChange={handleChange} items={items} />
  );
}
