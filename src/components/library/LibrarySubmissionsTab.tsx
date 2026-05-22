"use client";

import { Alert, Empty, List, Space, Spin, Tag, Typography } from "antd";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibrarySubmissionView } from "@/lib/library/types";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";

const { Text } = Typography;

type Props = {
  initialItems: LibrarySubmissionView[];
};

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function formatDate(iso: string): string {
  // Keep formatting locale-stable for snapshot/SSR consistency. We render
  // the ISO suffix-trimmed; locale-aware formatting belongs to Settings work.
  return iso.slice(0, 16).replace("T", " ");
}

export function LibrarySubmissionsTab({ initialItems }: Props) {
  const query = useLibraryItems("submissions");
  const items: LibrarySubmissionView[] = (query.data ?? initialItems).filter(
    isSubmission,
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        message="저장한 답안을 불러오지 못했어요"
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }
  if (items.length === 0) {
    return <Empty description="저장한 답안이 없습니다." />;
  }

  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <LibraryItemRow
          key={item.item_id}
          itemId={item.item_id}
          tab="submissions"
          tags={item.tags}
          trailingActions={[
            <ExportPdfButton
              key="export"
              sourceType="submission"
              sourceId={item.id}
            />,
          ]}
        >
          <Space direction="vertical" size={2} style={{ width: "100%" }}>
            <Link href={`/practice/problems/${item.problem_id}` as never}>
              <Text strong>문제 {item.problem_id.slice(0, 8)}</Text>
            </Link>
            <Space size="small" wrap>
              <Tag color="blue">{item.char_count}자</Tag>
              <Text type="secondary">{formatDate(item.submitted_at)}</Text>
            </Space>
          </Space>
        </LibraryItemRow>
      )}
    />
  );
}
