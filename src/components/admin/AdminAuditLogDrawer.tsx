"use client";

import { Alert, Button, Drawer, Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchAuditLogs,
  type AdminAuditLogRow,
} from "./admin-rpc";
import {
  auditActionLabel,
  formatDateTime,
  shortId,
  summarizePayload,
} from "./format";

/**
 * Audit-log surfacing for H-01 / X-08 / X-10.
 *
 * `get_admin_audit_logs(p_target_id, row_limit)` is admin-only (content / org /
 * platform). When `targetId` is set the drawer shows just that target's history
 * (used by the user/problem detail panels). When null it shows recent global
 * admin activity.
 *
 * Masking: payloads are summarized to top-level key names only (no values).
 */

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, scope the log to one target row id. */
  targetId?: string | null;
  title?: string;
};

function useAuditLogs(open: boolean, targetId?: string | null) {
  return useQuery<AdminAuditLogRow[], Error>({
    queryKey: ["admin-audit-logs", targetId ?? "all"],
    queryFn: () =>
      fetchAuditLogs(createSupabaseBrowserClient(), {
        targetId: targetId ?? null,
        rowLimit: 50,
      }),
    enabled: open,
  });
}

export function AdminAuditLogDrawer({
  open,
  onClose,
  targetId = null,
  title = "관리자 변경 이력",
}: Props) {
  const query = useAuditLogs(open, targetId);
  const rows = query.data ?? [];

  const columns: ColumnsType<AdminAuditLogRow> = [
    {
      title: "시각",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (value: string) => (
        <span suppressHydrationWarning style={{ fontSize: 12 }}>
          {formatDateTime(value)}
        </span>
      ),
    },
    {
      title: "동작",
      dataIndex: "action",
      key: "action",
      width: 110,
      render: (value: string) => <Tag>{auditActionLabel(value)}</Tag>,
    },
    {
      title: "대상",
      dataIndex: "target_table",
      key: "target_table",
      width: 130,
      render: (value: string, record) => (
        <span style={{ fontSize: 12 }}>
          {value}
          <br />
          <span style={{ fontFamily: "monospace", color: "rgba(0,0,0,0.45)" }}>
            {shortId(record.target_id)}
          </span>
        </span>
      ),
    },
    {
      title: "관리자",
      dataIndex: "admin_user_id",
      key: "admin_user_id",
      width: 110,
      render: (value: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {shortId(value)}
        </span>
      ),
    },
    {
      title: "변경 요약",
      key: "summary",
      render: (_v, record) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {summarizePayload(record.diff) !== "—"
            ? summarizePayload(record.diff)
            : summarizePayload(record.payload)}
        </span>
      ),
    },
  ];

  return (
    <Drawer
      title={title}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      extra={
        <Button size="small" onClick={() => query.refetch()}>
          새로고침
        </Button>
      }
    >
      {query.isLoading ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Spin />
        </div>
      ) : query.error ? (
        <Alert
          type="error"
          showIcon
          message="변경 이력을 불러오지 못했어요"
          description={query.error.message}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Empty description="기록된 관리자 변경 이력이 없어요." />
      ) : (
        <Table<AdminAuditLogRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 720 }}
        />
      )}
    </Drawer>
  );
}
