"use client";

import {
  App,
  Button,
  Input,
  List,
  Popconfirm,
  Popover,
  Space,
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
 * Layout — antd `List.Item`:
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
      <Space size={[4, 4]} wrap>
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </Space>
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
        <Space orientation="vertical" style={{ width: 220 }} size="small">
          <Input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder={t("tagsInputPlaceholder")}
            aria-label={t("tagsInputAriaLabel")}
          />
          <Space>
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
          </Space>
        </Space>
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

  return <List.Item actions={actions}>{children}</List.Item>;
}
