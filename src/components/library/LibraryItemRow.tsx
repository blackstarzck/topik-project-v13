"use client";

import { App, Button, Popconfirm, Tag } from "antd";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Trash2 } from "@/components/shared/AppIcons";
import { useDeleteLibraryItem } from "@/lib/library/mutations";
import type { LibraryTab } from "@/lib/library/types";
import {
  createClientOperationalEvent,
  emitClientOperationalEvent,
} from "@/lib/operations/client-operational-event";

import styles from "./LibraryItemRow.module.css";

type LibraryRowTab = LibraryTab | "drafts";

type Props = {
  userId: string;
  children: ReactNode;
  className?: string;
  itemId: string;
  tab: LibraryRowTab;
  tags: string[];
  /**
   * Optional right-hand action (e.g. "다시 풀기" link, "다시 인쇄" button)
   * rendered before the standard tag/delete controls. Each tab supplies its
   * own affordance — the row stays oblivious to the underlying entity.
   */
  trailingActions?: ReactNode[];
  showDeleteAction?: boolean;
};

function recordLibraryDeleteFailure() {
  const created = createClientOperationalEvent({
    code: "operation_failed",
    feature: "library_resource",
    operation: "delete",
    result: "failure",
  });
  if (created.ok) void emitClientOperationalEvent(created.event);
}

/**
 * Shared row chrome for every `Library{Submissions,Reports,SavedProblems,Exports}Tab`.
 *
 * Layout:
 *   [ left content children ]   [ tab-specific actions, tag chips, delete popconfirm ]
 *
 * Tags are read-only chips in the list. Delete uses a Popconfirm to guard
 * against accidental loss and invalidate the active tab's query key.
 */
export function LibraryItemRow({
  userId,
  children,
  className,
  itemId,
  showDeleteAction = true,
  tab,
  tags,
  trailingActions = [],
}: Props) {
  const t = useTranslations("library.item");
  const { message } = App.useApp();
  const deleteItem = useDeleteLibraryItem(userId);

  function handleDelete() {
    if (tab === "drafts") return;
    deleteItem.mutate(
      { itemId, tab },
      {
        onSuccess: () => message.success(t("deleted")),
        onError: () => {
          recordLibraryDeleteFailure();
          message.error(t("deleteFailed"));
        },
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

  const deleteConfirm = (
    <Popconfirm
      title={t("deleteConfirmTitle")}
      description={t("deleteConfirmDescription")}
      okText={t("delete")}
      cancelText={t("cancel")}
      okButtonProps={{ danger: true, loading: deleteItem.isPending }}
      onConfirm={handleDelete}
    >
      <Button
        aria-label={t("delete")}
        className="library-item-delete-button"
        danger
        icon={<Trash2 aria-hidden="true" size={16} />}
        loading={deleteItem.isPending}
        size="small"
        title={t("delete")}
        type="text"
      />
    </Popconfirm>
  );

  const actions = [
    ...trailingActions,
    <span key="tags">{tagChips}</span>,
    showDeleteAction ? <span key="delete">{deleteConfirm}</span> : null,
  ];

  return (
    <div
      data-testid="library-item-row"
      data-library-tab={tab}
      className={[
        "flex flex-wrap items-center justify-between gap-4 py-4",
        styles.row,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-1 basis-72">{children}</div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
