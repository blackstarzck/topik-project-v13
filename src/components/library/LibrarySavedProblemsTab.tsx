"use client";

import { Alert, Button, Empty, List, Space, Spin, Typography } from "antd";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryProblemView } from "@/lib/library/types";

import { LibraryItemRow } from "./LibraryItemRow";

const { Text } = Typography;

type Props = {
  initialItems: LibraryProblemView[];
};

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}

export function LibrarySavedProblemsTab({ initialItems }: Props) {
  const query = useLibraryItems("problems");
  const items: LibraryProblemView[] = (query.data ?? initialItems).filter(
    isProblem,
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        message="저장한 문제를 불러오지 못했어요"
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }
  if (items.length === 0) {
    return <Empty description="저장한 문제가 없습니다." />;
  }

  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <LibraryItemRow
          key={item.item_id}
          itemId={item.item_id}
          tab="problems"
          tags={item.tags}
          trailingActions={[
            <Link
              key="retry"
              href={`/practice/problems/${item.id}` as never}
            >
              <Button type="primary" size="small">
                다시 풀기
              </Button>
            </Link>,
          ]}
        >
          <Space direction="vertical" size={2} style={{ width: "100%" }}>
            <Text strong>{item.title}</Text>
          </Space>
        </LibraryItemRow>
      )}
    />
  );
}
