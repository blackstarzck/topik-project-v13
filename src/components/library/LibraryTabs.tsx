"use client";

import { Input, Select } from "antd";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import type { LibraryItemView, LibraryTab } from "@/lib/library/types";

import { LibraryExportsTab } from "./LibraryExportsTab";
import { LibraryReportsTab } from "./LibraryReportsTab";
import { LibrarySavedProblemsTab } from "./LibrarySavedProblemsTab";
import { LibrarySubmissionsTab } from "./LibrarySubmissionsTab";
import type { ExportSelectionItem } from "./PdfExportModal";
import { buildLibraryTabUrl, isLibraryTab } from "./library-tab-url";

type Props = {
  activeTab: LibraryTab;
  initialItems: LibraryItemView[];
  onSelectionChange?: (items: ExportSelectionItem[]) => void;
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

export function LibraryTabs({
  activeTab,
  initialItems,
  onSelectionChange,
}: Props) {
  const t = useTranslations("library.tabs");
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

  const typeOptions = [
    {
      value: "submissions" satisfies LibraryTab,
      label: t("submissions"),
    },
    {
      value: "reports" satisfies LibraryTab,
      label: t("reports"),
    },
    {
      value: "problems" satisfies LibraryTab,
      label: t("problems"),
    },
    {
      value: "exports" satisfies LibraryTab,
      label: t("exports"),
    },
  ];

  const activeContent = {
    submissions: (
      <LibrarySubmissionsTab
        initialItems={submissionsInitial}
        searchTerm={searchTerm}
        onResetSearch={() => setSearchTerm("")}
        onSelectionChange={onSelectionChange}
      />
    ),
    reports: (
      <LibraryReportsTab
        initialItems={reportsInitial}
        searchTerm={searchTerm}
        onResetSearch={() => setSearchTerm("")}
      />
    ),
    problems: (
      <LibrarySavedProblemsTab
        initialItems={problemsInitial}
        searchTerm={searchTerm}
        onResetSearch={() => setSearchTerm("")}
      />
    ),
    exports: (
      <LibraryExportsTab
        initialItems={exportsInitial}
        searchTerm={searchTerm}
        onResetSearch={() => setSearchTerm("")}
      />
    ),
  } satisfies Record<LibraryTab, ReactNode>;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select<LibraryTab>
          data-testid="library-type-filter"
          value={activeTab}
          onChange={handleChange}
          options={typeOptions}
          aria-label={t("typeFilterAriaLabel")}
          className="min-w-36"
        />
        <Input.Search
          data-testid="library-search"
          allowClear
          maxLength={40}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAriaLabel")}
          className="w-full max-w-sm sm:w-auto"
        />
      </div>

      <div data-testid="library-content" className="flex min-h-0 flex-1">
        {activeContent[activeTab]}
      </div>
    </div>
  );
}
