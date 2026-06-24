"use client";

import { Button, Typography } from "antd";
import { useTranslations } from "next-intl";

import type { ExportSelectionItem } from "./PdfExportModal";

const { Text } = Typography;

type Props = {
  selection: ExportSelectionItem[];
  reviewPending: boolean;
  onExportClick: () => void;
  onCreateReviewSet: () => void;
};

export function LibraryActionsPanel({
  selection,
  reviewPending,
  onExportClick,
  onCreateReviewSet,
}: Props) {
  const t = useTranslations("library.tabs");
  const hasSelection = selection.length > 0;

  return (
    <div data-testid="library-actions" className="w-full">
      <div
        data-testid="library-actions-stack"
        className="flex w-full flex-col gap-2"
      >
        <Text data-testid="library-selection-count">
          {t("selectionCount", { count: selection.length })}
        </Text>
        <Button
          block
          data-testid="library-export-pdf"
          type="primary"
          disabled={!hasSelection}
          onClick={onExportClick}
        >
          {t("exportPdf")}
        </Button>
        <Button
          block
          data-testid="library-create-review-set"
          disabled={!hasSelection}
          loading={reviewPending}
          onClick={onCreateReviewSet}
        >
          {t("createReviewSet")}
        </Button>
        {!hasSelection ? (
          <Text
            data-testid="library-selection-hint"
            type="secondary"
            className="!text-sm"
          >
            {t("selectionHint")}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
