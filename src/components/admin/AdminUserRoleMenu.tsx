"use client";

import { Alert, Modal, Select, Space, Typography } from "antd";
import { useState } from "react";
import { useChangeUserRole } from "@/lib/admin/mutations";
import {
  ROLE_OPTIONS,
  type AdminUserRow,
} from "@/lib/admin/types";
import type { AppRole } from "@/lib/auth/roles";

const { Text } = Typography;

const ROLE_LABEL: Record<AppRole, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

type Props = {
  row: AdminUserRow;
  open: boolean;
  onClose: () => void;
};

function AdminUserRoleMenuInner({ row, open, onClose }: Props) {
  const [nextRole, setNextRole] = useState<AppRole>(row.app_role);
  const mutation = useChangeUserRole();

  function handleConfirm() {
    if (nextRole === row.app_role) {
      // No-op: same role selected. Just close.
      onClose();
      return;
    }
    mutation.mutate(
      { targetId: row.id, newRole: nextRole },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  const isPending = mutation.isPending;
  const isSame = nextRole === row.app_role;

  return (
    <Modal
      title="역할 변경"
      open={open}
      onOk={handleConfirm}
      onCancel={() => {
        if (!isPending) onClose();
      }}
      okText="변경"
      cancelText="취소"
      okButtonProps={{
        disabled: isPending,
        loading: isPending,
      }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Text>
          대상 사용자:{" "}
          <Text strong>
            {row.display_name ?? row.nickname ?? row.id.slice(0, 8)}
          </Text>
        </Text>
        <Text type="secondary">현재 역할: {ROLE_LABEL[row.app_role]}</Text>
        <Select<AppRole>
          aria-label="새 역할 선택"
          value={nextRole}
          style={{ width: "100%" }}
          disabled={isPending}
          onChange={(value) => setNextRole(value)}
          options={ROLE_OPTIONS.map((r) => ({
            value: r,
            label: ROLE_LABEL[r],
          }))}
        />
        {isSame ? (
          <Text type="secondary">
            현재 역할과 동일합니다. 변경 시 아무 작업도 수행하지 않습니다.
          </Text>
        ) : null}
        {mutation.error ? (
          <Alert
            type="error"
            message="역할 변경에 실패했어요"
            description={
              mutation.error instanceof Error
                ? mutation.error.message
                : String(mutation.error)
            }
            showIcon
          />
        ) : null}
      </Space>
    </Modal>
  );
}

/**
 * Public wrapper. Re-mounts the inner component (and therefore resets all
 * local state, including the role Select and any mutation error) whenever a
 * different row is targeted or the modal is reopened. This is the React 19
 * "derived state via key" pattern and avoids setState-in-effect.
 */
export function AdminUserRoleMenu(props: Props) {
  const key = `${props.row.id}:${props.open ? "open" : "closed"}`;
  return <AdminUserRoleMenuInner key={key} {...props} />;
}
