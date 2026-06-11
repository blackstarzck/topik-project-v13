"use client";

import {
  App,
  Button,
  Input,
  Popconfirm,
  Popover,
  Tag,
} from "antd";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import {
  useDeleteLibraryItem,
  useUpdateItemTags,
} from "@/lib/library/mutations";
import type { LibraryTab } from "@/lib/library/types";

type Props = {
  children: ReactNode;
  itemId: string;
  tab: LibraryTab;
  tags: string[];
  /**
   * Optional right-hand action (e.g. "다시 풀기" link, "다시 인쇄" button)
   * rendered before the standard tag/delete controls. Each tab supplies its
   * own affordance — the row stays oblivious to the underlying entity.
   */
  trailingActions?: ReactNode[];
};

/**
 * Shared row chrome for every `Library{Submissions,Reports,SavedProblems,Exports}Tab`.
 *
 * Layout:
 *   [ left content children ]   [ tag chips, edit tags popover, delete popconfirm ]
 *
 * Tag editing uses a comma-separated text field inside a Popover; saving
 * fires `useUpdateItemTags`. Delete uses a Popconfirm to guard against
 * accidental loss. Both mutations invalidate the active tab's query key.
 */
export function LibraryItemRow({
  children,
  itemId,
  tab,
  tags,
  trailingActions = [],
}: Props) {
  const t = useTranslations("library.item");
  const { message } = App.useApp();
  const updateTags = useUpdateItemTags();
  const deleteItem = useDeleteLibraryItem();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draftTags, setDraftTags] = useState(tags.join(", "));

  function commitTags() {
    const next = draftTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    updateTags.mutate(
      { itemId, tags: next, tab },
      {
        onSuccess: () => {
          setPopoverOpen(false);
          message.success(t("tagsSaved"));
        },
        onError: (err) => {
          message.error(
            err instanceof Error ? err.message : t("tagsSaveFailed"),
          );
        },
      },
    );
  }

  function handleDelete() {
    deleteItem.mutate(
      { itemId, tab },
      {
        onSuccess: () => message.success(t("deleted")),
        onError: (err) =>
          message.error(
            err instanceof Error ? err.message : t("deleteFailed"),
          ),
      },
    );
  }

  const tagChips =
    tags.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
    ) : null;

  const editTagsPopover = (
    <Popover
      open={popoverOpen}
      onOpenChange={(next) => {
        setPopoverOpen(next);
        if (next) setDraftTags(tags.join(", "));
      }}
      trigger="click"
      title={t("editTags")}
      content={
        <div className="flex w-56 flex-col gap-2">
          <Input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder={t("tagsInputPlaceholder")}
            aria-label={t("tagsInputAriaLabel")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="small"
              type="primary"
              loading={updateTags.isPending}
              onClick={commitTags}
            >
              {t("save")}
            </Button>
            <Button size="small" onClick={() => setPopoverOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      }
    >
      <Button size="small">{t("editTags")}</Button>
    </Popover>
  );

  const deleteConfirm = (
    <Popconfirm
      title={t("deleteConfirmTitle")}
      description={t("deleteConfirmDescription")}
      okText={t("delete")}
      cancelText={t("cancel")}
      okButtonProps={{ danger: true, loading: deleteItem.isPending }}
      onConfirm={handleDelete}
    >
      <Button size="small" danger>
        {t("delete")}
      </Button>
    </Popconfirm>
  );

  const actions = [
    ...trailingActions,
    <span key="tags">{tagChips}</span>,
    <span key="edit-tags">{editTagsPopover}</span>,
    <span key="delete">{deleteConfirm}</span>,
  ];

  return (
    <div
      data-testid="library-item-row"
      data-library-tab={tab}
      className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
    >
      <div className="min-w-0 flex-1 basis-72">{children}</div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
      </div>
    </div>
  );
}
