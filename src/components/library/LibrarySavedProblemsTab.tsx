"use client";

import { Alert, Button, Empty, List, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryProblemView } from "@/lib/library/types";
import { writingProblemHref } from "@/lib/writing/routes";

import { LibraryItemRow } from "./LibraryItemRow";
import { matchesLibrarySearch } from "./library-tab-url";

const { Text } = Typography;

type Props = {
  initialItems: LibraryProblemView[];
  searchTerm?: string;
  onResetSearch?: () => void;
};

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}

export function LibrarySavedProblemsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
}: Props) {
  const t = useTranslations("library.saved");
  const query = useLibraryItems("problems");
  const allItems: LibraryProblemView[] = (query.data ?? initialItems).filter(
    isProblem,
  );
  const items = allItems.filter((i) =>
    matchesLibrarySearch(searchTerm, [i.title, ...i.tags]),
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        message={t("loadError")}
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
          tab="problems"
          tags={item.tags}
          trailingActions={[
            <Link
              key="retry"
              href={
                writingProblemHref({
                  questionNo: item.question_no,
                  problemId: item.id,
                }) as never
              }
            >
              <Button type="primary" size="small">
                {t("retry")}
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
