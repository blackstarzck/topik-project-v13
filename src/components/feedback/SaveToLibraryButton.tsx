"use client";

import { Button, Tooltip, notification } from "antd";
import { useState } from "react";
import { useSaveLibraryItem } from "@/lib/library/mutations";

type Props = {
  submissionId: string;
  /** 저장 row의 owner. 서버에서 내려온 현재 사용자 id (RLS user_id = auth.uid()). */
  userId: string;
  /** 이미 저장돼 있으면 버튼을 저장됨 상태로 비활성화한다. */
  initiallySaved?: boolean;
  /**
   * 권한 없음(읽기 전용 공유 등)일 때 저장 자체를 잠근다. description region 4
   * 예외: 권한 잠금은 해당 CTA 옆에 상태 표시.
   */
  permissionLocked?: boolean;
};

/** Postgres/PostgREST RLS 거부 코드. */
const RLS_DENIED = new Set(["42501", "PGRST301", "PGRST116"]);

/**
 * E-01/E-02 다음 행동 CTA — 보관함 저장 (description region 4).
 * 예외: 저장 실패/권한 잠금은 해당 CTA 옆에 상태 표시.
 *
 * 중복 클릭 차단(busy/저장됨), 권한 거부와 일반 실패를 구분해 안내한다.
 */
export function SaveToLibraryButton({
  submissionId,
  userId,
  initiallySaved = false,
  permissionLocked = false,
}: Props) {
  const save = useSaveLibraryItem();
  const [saved, setSaved] = useState(initiallySaved);

  if (permissionLocked) {
    return (
      <Tooltip title="이 답안은 보기 전용이라 보관함에 저장할 수 없어요.">
        <Button disabled>보관함 저장 (잠금)</Button>
      </Tooltip>
    );
  }

  function onSave() {
    if (saved || save.isPending) return; // 중복 클릭 차단
    save.mutate(
      { item_type: "submission", submission_id: submissionId, user_id: userId },
      {
        onSuccess: () => {
          setSaved(true);
          notification.success({ message: "보관함에 저장했어요." });
        },
        onError: (e: unknown) => {
          const err = e as { code?: string; message?: string };
          if (err.code && RLS_DENIED.has(err.code)) {
            notification.error({
              message: "저장 권한이 없어요",
              description:
                "내 답안만 보관함에 저장할 수 있어요. 권한을 확인해 주세요.",
            });
            return;
          }
          notification.error({
            message: "보관함 저장에 실패했어요",
            description:
              err.message ?? "잠시 후 다시 시도하거나 내 보관함에서 저장해 주세요.",
          });
        },
      },
    );
  }

  return (
    <Button onClick={onSave} loading={save.isPending} disabled={saved}>
      {saved ? "보관함에 저장됨" : "보관함 저장"}
    </Button>
  );
}
