"use client";

import { Alert, App, Badge, Button, Empty, List, Space, Spin, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { triggerPdfExport } from "@/lib/export/pdf-export";
import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryExportView, LibraryItemView } from "@/lib/library/types";

import { LibraryItemRow } from "./LibraryItemRow";
import { matchesLibrarySearch } from "./library-tab-url";

const { Text } = Typography;

type Props = {
  initialItems: LibraryExportView[];
  searchTerm?: string;
  onResetSearch?: () => void;
};

function isExport(item: LibraryItemView): item is LibraryExportView {
  return item.kind === "export";
}

/**
 * `options.source === 'browser_print'` is the Phase 6 marker for the
 * "open the print dialog again" code path — there's no actual stored file
 * to download. Other source types render a "다운로드" button which is a
 * placeholder until the storage queue lands (OOS-6).
 */
export function isBrowserPrintExport(item: LibraryExportView): boolean {
  const opts = item.options;
  if (
    opts !== null &&
    typeof opts === "object" &&
    !Array.isArray(opts) &&
    "source" in opts
  ) {
    return (opts as { source?: unknown }).source === "browser_print";
  }
  return false;
}

// i18n: 라벨 문구는 library.exports.* 카탈로그 키로 노출하고, 렌더 컴포넌트가
// t()로 해석한다(컴포넌트가 아닌 헬퍼는 useTranslations 불가). 동적 키이므로
// 호출부에서 `as Parameters<typeof t>[0]` 캐스트가 필요하다.
function exportSourceLabelKey(
  source: LibraryExportView["source_type"],
): string {
  switch (source) {
    case "submission":
      return "sourceSubmission";
    case "report":
      return "sourceReport";
    case "library_selection":
      return "sourceLibrarySelection";
    default:
      return "sourceDefault";
  }
}

function statusBadgeStatus(
  status: LibraryExportView["status"],
): "success" | "processing" | "error" {
  if (status === "ready") return "success";
  if (status === "failed") return "error";
  return "processing";
}

function statusLabelKey(status: LibraryExportView["status"]): string {
  if (status === "ready") return "statusReady";
  if (status === "failed") return "statusFailed";
  return "statusPending";
}

type RetryButtonProps = {
  item: LibraryExportView;
};

function RetryPrintButton({ item }: RetryButtonProps) {
  const t = useTranslations("library.exports");
  const { message } = App.useApp();
  const [pending, setPending] = useState(false);

  // browser_print rows are limited to the source types that have a non-null
  // source_id (submission / report). library_selection prints stand alone
  // and don't get re-triggered from the library row.
  const reprintable =
    (item.source_type === "submission" || item.source_type === "report") &&
    item.id != null;

  async function handleClick() {
    if (!reprintable) return;
    setPending(true);
    try {
      // Reuse the same source_type/source_id pair the original ledger row
      // carried. We don't try to dedupe export_files entries — each click
      // produces a new ledger row, which matches "다시 인쇄" intent.
      const sourceId = item.id;
      await triggerPdfExport({
        sourceType: item.source_type as "submission" | "report",
        sourceId,
      });
      message.success(t("printDialogOpened"));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("reprintFailed"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="small" onClick={handleClick} loading={pending} disabled={!reprintable}>
      {t("reprint")}
    </Button>
  );
}

function DownloadButton() {
  // Phase 6 has no real download URL — see OOS-6. Render the affordance as
  // a disabled button so the UX hints at the future state without misleading.
  const t = useTranslations("library.exports");
  return (
    <Button size="small" disabled>
      {t("download")}
    </Button>
  );
}

export function LibraryExportsTab({
  initialItems,
  searchTerm = "",
  onResetSearch,
}: Props) {
  const t = useTranslations("library.exports");
  const query = useLibraryItems("exports");
  const allItems: LibraryExportView[] = (query.data ?? initialItems).filter(
    isExport,
  );
  const items = allItems.filter((i) =>
    matchesLibrarySearch(searchTerm, [
      t(exportSourceLabelKey(i.source_type) as Parameters<typeof t>[0]),
      i.storage_path,
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
      renderItem={(item) => {
        const isPrint = isBrowserPrintExport(item);
        return (
          <LibraryItemRow
            key={item.item_id}
            itemId={item.item_id}
            tab="exports"
            tags={item.tags}
            trailingActions={[
              isPrint ? (
                <RetryPrintButton key="reprint" item={item} />
              ) : (
                <DownloadButton key="download" />
              ),
            ]}
          >
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Text strong>
                {t(exportSourceLabelKey(item.source_type) as Parameters<typeof t>[0])}
              </Text>
              <Space size="small" wrap>
                <Badge
                  status={statusBadgeStatus(item.status)}
                  text={t(statusLabelKey(item.status) as Parameters<typeof t>[0])}
                />
                {isPrint ? <Tag color="geekblue">{t("browserPrintTag")}</Tag> : null}
                <Text type="secondary">{item.storage_path}</Text>
              </Space>
            </Space>
          </LibraryItemRow>
        );
      }}
    />
  );
}
