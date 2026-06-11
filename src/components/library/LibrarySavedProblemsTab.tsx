"use client";

import { Alert, Button, Empty, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryProblemView } from "@/lib/library/types";
import { writingProblemHref } from "@/lib/writing/routes";

import { LibraryItemRow } from "./LibraryItemRow";
import {
  LIBRARY_PAGE_SIZE,
  LibraryPagination,
} from "./LibraryPagination";
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
  const tCount = useTranslations("library.submissions");
  const query = useLibraryItems("problems");
  const [page, setPage] = useState(1);
  const allItems: LibraryProblemView[] = (query.data ?? initialItems).filter(
    isProblem,
  );
  const items = allItems.filter((i) =>
    matchesLibrarySearch(searchTerm, [i.title, ...i.tags]),
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
            <Space
              className="library-item-detail"
              orientation="vertical"
              size={2}
            >
              <Text strong>{item.title}</Text>
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
