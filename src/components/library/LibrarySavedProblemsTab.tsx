"use client";

import { Button, Empty, Spin, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryItemView, LibraryProblemView } from "@/lib/library/types";
import { UnavailableState } from "@/components/shared/UnavailableState";

import { LibraryItemRow } from "./LibraryItemRow";
import { LIBRARY_PAGE_SIZE, LibraryPagination } from "./LibraryPagination";
import { LibraryProblemsRetryAction } from "./LibraryProblemsRows";
import { matchesLibrarySearch } from "./library-tab-url";

const { Text } = Typography;

type Props = {
  userId: string;
  initialItems: LibraryProblemView[];
  searchTerm?: string;
  onResetSearch?: () => void;
};

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}

export function LibrarySavedProblemsTab({
  userId,
  initialItems,
  searchTerm = "",
  onResetSearch,
}: Props) {
  const t = useTranslations("library.saved");
  const errorT = useTranslations("shared.error");
  const tCount = useTranslations("library.submissions");
  const query = useLibraryItems(userId, "problems");
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

  if (
    query.isLoading &&
    (query.data ?? []).length === 0 &&
    initialItems.length === 0
  ) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <UnavailableState
        variant="resource"
        actions={[
          {
            key: "retry",
            label: errorT("retry"),
            onClick: () => void query.refetch(),
            primary: true,
          },
        ]}
      />
    );
  }
  if (items.length === 0) {
    const searching = searchTerm.trim().length > 0;
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <Text data-testid="library-result-count" type="secondary">
          {tCount("resultCount", { count: 0 })}
        </Text>
        <div className="flex flex-1 items-center justify-center">
          <Empty description={searching ? t("emptySearch") : t("emptyNoItems")}>
            {searching && onResetSearch ? (
              <Button onClick={onResetSearch}>{t("resetFilter")}</Button>
            ) : null}
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <Text data-testid="library-result-count" type="secondary">
        {tCount("resultCount", { count: items.length })}
      </Text>
      <div data-testid="library-item-list" className="flex w-full flex-col">
        {pageItems.map((item) => {
          const unavailable = item.availabilityStatus !== "available";

          return (
            <LibraryItemRow
              userId={userId}
              key={item.item_id}
              className={unavailable ? "opacity-40" : undefined}
              itemId={item.item_id}
              tab="problems"
              tags={item.tags}
              trailingActions={[
                <LibraryProblemsRetryAction
                  key="retry"
                  item={item}
                  returnTo="/library"
                />,
              ]}
            >
              <div className="flex w-full min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Text strong>
                    {item.title ?? t("unavailablePlaceholderTitle")}
                  </Text>
                  {unavailable ? (
                    <Tag data-testid="library-problem-unavailable-badge">
                      {item.availabilityStatus === "soft_unavailable"
                        ? t("providedEnded")
                        : t("unavailable")}
                    </Tag>
                  ) : null}
                </div>
                {unavailable ? (
                  <Text
                    data-testid="library-problem-unavailable-reason"
                    type="secondary"
                  >
                    {item.availabilityReason ?? t("unavailableDefaultReason")}
                  </Text>
                ) : null}
              </div>
            </LibraryItemRow>
          );
        })}
      </div>
      <LibraryPagination
        current={safePage}
        total={items.length}
        onChange={(p) => setPage(p)}
      />
    </div>
  );
}
