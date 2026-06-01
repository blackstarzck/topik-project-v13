"use client";

import { Alert, Button, Empty, List, Space, Spin, Tag, Typography } from "antd";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibrarySubmissionView } from "@/lib/library/types";

import { ExportPdfButton } from "./ExportPdfButton";
import { LibraryItemRow } from "./LibraryItemRow";
import { matchesLibrarySearch } from "./library-tab-url";

const { Text } = Typography;

type Props = {
  initialItems: LibrarySubmissionView[];
  searchTerm?: string;
  onResetSearch?: () => void;
};

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function formatDate(iso: string): string {
  // Keep formatting locale-stable for snapshot/SSR consistency. We render
  // the ISO suffix-trimmed; locale-aware formatting belongs to Settings work.
  return iso.slice(0, 16).replace("T", " ");
}

export function LibrarySubmissionsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
}: Props) {
  const query = useLibraryItems("submissions");
  const allItems: LibrarySubmissionView[] = (query.data ?? initialItems).filter(
    isSubmission,
  );
  const items = allItems.filter((i) =>
    matchesLibrarySearch(searchTerm, [
      `문제 ${i.problem_id.slice(0, 8)}`,
      i.problem_id,
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
        message="저장한 답안을 불러오지 못했어요"
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
        description={
          searching ? "검색 결과가 없습니다." : "저장한 답안이 없습니다."
        }
      >
        {searching && onResetSearch ? (
          <Button onClick={onResetSearch}>필터 초기화</Button>
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
