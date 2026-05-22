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
          message.success("태그를 저장했어요.");
        },
        onError: (err) => {
          message.error(
            err instanceof Error ? err.message : "태그 저장에 실패했어요.",
          );
        },
      },
    );
  }

  function handleDelete() {
    deleteItem.mutate(
      { itemId, tab },
      {
        onSuccess: () => message.success("라이브러리에서 삭제했어요."),
        onError: (err) =>
          message.error(
            err instanceof Error ? err.message : "삭제에 실패했어요.",
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
      title="태그 편집"
      content={
        <Space direction="vertical" style={{ width: 220 }} size="small">
          <Input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder="쉼표로 구분 (예: 작문, 53번)"
            aria-label="태그 입력"
          />
          <Space>
            <Button
              size="small"
              type="primary"
              loading={updateTags.isPending}
              onClick={commitTags}
            >
              저장
            </Button>
            <Button size="small" onClick={() => setPopoverOpen(false)}>
              취소
            </Button>
          </Space>
        </Space>
      }
    >
      <Button size="small">태그 편집</Button>
    </Popover>
  );

  const deleteConfirm = (
    <Popconfirm
      title="삭제하시겠어요?"
      description="라이브러리 항목을 삭제합니다. 원본 자료는 유지돼요."
      okText="삭제"
      cancelText="취소"
      okButtonProps={{ danger: true, loading: deleteItem.isPending }}
      onConfirm={handleDelete}
    >
      <Button size="small" danger>
        삭제
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
