"use client";

import { Alert, App, Modal, Select, Space, Typography } from "antd";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { changeUserRoleAction } from "@/lib/admin/server-actions";
import { ROLE_OPTIONS } from "@/lib/admin/types";
import type { AppRole } from "@/lib/auth/roles";
import type { AdminUserDirectoryRow } from "./admin-rpc";
import { ROLE_LABEL, maskEmail } from "./format";

const { Text } = Typography;

/**
 * X-10 role change for the directory-row shape (get_admin_users output).
 *
 * Reuses the existing `changeUserRoleAction` server action (admin_change_user_role
 * RPC, audited). Protected-column changes are blocked server-side; this UI only
 * offers the role select. On success the console refetches the directory + stats.
 */

type Props = {
  row: AdminUserDirectoryRow | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function Inner({ row, open, onClose, onChanged }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [nextRole, setNextRole] = useState<AppRole>(
    (row?.app_role as AppRole) ?? "learner",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!row) return null;

  const isSame = nextRole === row.app_role;

  async function handleOk() {
    if (!row) return;
    if (isSame) {
      onClose();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await changeUserRoleAction({ targetId: row.user_id, newRole: nextRole });
      message.success("역할을 변경했어요.");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      onChanged();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "역할 변경에 실패했어요.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title="역할 변경"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        if (!pending) onClose();
      }}
      okText="변경"
      cancelText="취소"
      okButtonProps={{ disabled: pending || isSame, loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Text>
          대상:{" "}
          <Text strong>{row.display_name ?? maskEmail(row.email)}</Text>
        </Text>
        <Text type="secondary">
          현재 역할: {ROLE_LABEL[row.app_role] ?? row.app_role}
        </Text>
        <Select<AppRole>
          aria-label="새 역할 선택"
          value={nextRole}
          style={{ width: "100%" }}
          disabled={pending}
          onChange={setNextRole}
          options={ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        {isSame ? (
          <Text type="secondary">현재 역할과 동일합니다.</Text>
        ) : null}
        {error ? <Alert type="error" showIcon message={error} /> : null}
      </Space>
    </Modal>
  );
}

export function AdminUserRoleModal(props: Props) {
  const key = `${props.row?.user_id ?? "none"}:${props.open ? "open" : "closed"}`;
  return <Inner key={key} {...props} />;
}
