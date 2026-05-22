"use client";

import { Alert, Empty, List, Space, Spin, Typography } from "antd";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryReportView } from "@/lib/library/types";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";

const { Text, Paragraph } = Typography;

type Props = {
  initialItems: LibraryReportView[];
};

function isReport(item: LibraryItemView): item is LibraryReportView {
  return item.kind === "report";
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function LibraryReportsTab({ initialItems }: Props) {
  const query = useLibraryItems("reports");
  const items: LibraryReportView[] = (query.data ?? initialItems).filter(
    isReport,
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        message="비교 리포트를 불러오지 못했어요"
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }
  if (items.length === 0) {
    return <Empty description="비교 리포트가 없습니다." />;
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
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Link href={`/writing/reports/${item.id}/compare` as never}>
              <Text strong>비교 리포트</Text>
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
