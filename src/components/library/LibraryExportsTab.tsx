"use client";

import { Alert, App, Badge, Button, Empty, List, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";

import { triggerPdfExport } from "@/lib/export/pdf-export";
import { useLibraryItems } from "@/lib/library/queries";
import type { LibraryExportView, LibraryItemView } from "@/lib/library/types";

import { LibraryItemRow } from "./LibraryItemRow";

const { Text } = Typography;

type Props = {
  initialItems: LibraryExportView[];
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

function exportSourceLabel(
  source: LibraryExportView["source_type"],
): string {
  switch (source) {
    case "submission":
      return "답안 내보내기";
    case "report":
      return "비교 리포트 내보내기";
    case "library_selection":
      return "라이브러리 묶음 내보내기";
    default:
      return "내보내기";
  }
}

function statusBadgeStatus(
  status: LibraryExportView["status"],
): "success" | "processing" | "error" {
  if (status === "ready") return "success";
  if (status === "failed") return "error";
  return "processing";
}

function statusLabel(status: LibraryExportView["status"]): string {
  if (status === "ready") return "준비됨";
  if (status === "failed") return "실패";
  return "대기 중";
}

type RetryButtonProps = {
  item: LibraryExportView;
};

function RetryPrintButton({ item }: RetryButtonProps) {
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
      message.success("PDF 출력 대화상자가 열렸습니다.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "다시 인쇄에 실패했어요.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="small" onClick={handleClick} loading={pending} disabled={!reprintable}>
      다시 인쇄
    </Button>
  );
}

function DownloadButton() {
  // Phase 6 has no real download URL — see OOS-6. Render the affordance as
  // a disabled button so the UX hints at the future state without misleading.
  return (
    <Button size="small" disabled>
      다운로드
    </Button>
  );
}

export function LibraryExportsTab({ initialItems }: Props) {
  const query = useLibraryItems("exports");
  const items: LibraryExportView[] = (query.data ?? initialItems).filter(
    isExport,
  );

  if (query.isLoading && (query.data ?? []).length === 0 && initialItems.length === 0) {
    return <Spin />;
  }
  if (query.error) {
    return (
      <Alert
        type="error"
        message="내보내기 기록을 불러오지 못했어요"
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
      />
    );
  }
  if (items.length === 0) {
    return <Empty description="내보내기 기록이 없습니다." />;
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
              <Text strong>{exportSourceLabel(item.source_type)}</Text>
              <Space size="small" wrap>
                <Badge
                  status={statusBadgeStatus(item.status)}
                  text={statusLabel(item.status)}
                />
                {isPrint ? <Tag color="geekblue">브라우저 인쇄</Tag> : null}
                <Text type="secondary">{item.storage_path}</Text>
              </Space>
            </Space>
          </LibraryItemRow>
        );
      }}
    />
  );
}
