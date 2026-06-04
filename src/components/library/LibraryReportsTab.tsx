"use client";

import { Alert, Button, Empty, List, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryReportView } from "@/lib/library/types";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";
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
  const query = useLibraryItems("reports");
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
      <Empty
        description={searching ? t("emptySearch") : t("emptyNoItems")}
      >
        {searching && onResetSearch ? (
          <Button onClick={onResetSearch}>{t("resetFilter")}</Button>
        ) : null}
      </Empty>
    );
  }

  return (
    <List
      dataSource={items}
      renderItem={(item) => (
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
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <Link href={`/writing/reports/${item.id}/compare` as never}>
              <Text strong>{t("title")}</Text>
            </Link>
            <Text type="secondary">{formatDate(item.generated_at)}</Text>
            {item.narrative_excerpt ? (
              <Paragraph
                style={{ marginBottom: 0 }}
                ellipsis={{ rows: 2 }}
                type="secondary"
              >
                {item.narrative_excerpt}
              </Paragraph>
            ) : null}
          </Space>
        </LibraryItemRow>
      )}
    />
  );
}
