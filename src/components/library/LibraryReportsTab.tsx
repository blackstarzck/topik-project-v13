"use client";

import { Alert, Button, Empty, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryReportView } from "@/lib/library/types";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";
import {
  LIBRARY_PAGE_SIZE,
  LibraryPagination,
} from "./LibraryPagination";
import { matchesLibrarySearch } from "./library-tab-url";

const { Text, Paragraph } = Typography;

type Props = {
  initialItems: LibraryReportView[];
  searchTerm?: string;
  onResetSearch?: () => void;
};

function isReport(item: LibraryItemView): item is LibraryReportView {
  return item.kind === "report";
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function LibraryReportsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
}: Props) {
  const t = useTranslations("library.reports");
  const tCount = useTranslations("library.submissions");
  const query = useLibraryItems("reports");
  const [page, setPage] = useState(1);
  const allItems: LibraryReportView[] = (query.data ?? initialItems).filter(
    isReport,
  );
  const items = allItems.filter((i) =>
    matchesLibrarySearch(searchTerm, [
      t("searchLabel"),
      i.narrative_excerpt,
      ...i.tags,
    ]),
  );
  const totalPages = Math.max(1, Math.ceil(items.length / LIBRARY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice(
    (safePage - 1) * LIBRARY_PAGE_SIZE,
    safePage * LIBRARY_PAGE_SIZE,
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        title={t("loadError")}
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }
  if (items.length === 0) {
    const searching = searchTerm.trim().length > 0;
    return (
      <Space className="library-tab-stack" orientation="vertical" size="middle">
        <Text data-testid="library-result-count" type="secondary">
          {tCount("resultCount", { count: 0 })}
        </Text>
        <Empty
          description={searching ? t("emptySearch") : t("emptyNoItems")}
        >
          {searching && onResetSearch ? (
            <Button onClick={onResetSearch}>{t("resetFilter")}</Button>
          ) : null}
        </Empty>
      </Space>
    );
  }

  return (
    <Space className="library-tab-stack" orientation="vertical" size="middle">
      <Text data-testid="library-result-count" type="secondary">
        {tCount("resultCount", { count: items.length })}
      </Text>
      <Space
        className="library-item-list"
        data-testid="library-item-list"
        orientation="vertical"
        size={0}
      >
        {pageItems.map((item) => (
          <LibraryItemRow
            key={item.item_id}
            itemId={item.item_id}
            tab="reports"
            tags={item.tags}
            trailingActions={[
              <ExportPdfButton
                key="export"
                sourceType="report"
                sourceId={item.id}
              />,
            ]}
          >
            <Space
              className="library-item-detail"
              orientation="vertical"
              size={4}
            >
              <Link href={`/writing/reports/${item.id}/compare` as never}>
                <Text strong>{t("title")}</Text>
              </Link>
              <Text type="secondary">{formatDate(item.generated_at)}</Text>
              {item.narrative_excerpt ? (
                <Paragraph
                  className="library-row-copy"
                  ellipsis={{ rows: 2 }}
                  type="secondary"
                >
                  {item.narrative_excerpt}
                </Paragraph>
              ) : null}
            </Space>
          </LibraryItemRow>
        ))}
      </Space>
      <LibraryPagination
        current={safePage}
        total={items.length}
        onChange={(p) => setPage(p)}
      />
    </Space>
  );
}
