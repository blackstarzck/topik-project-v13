"use client";

import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminUserDirectoryRow } from "./admin-rpc";
import { setUserStatusAction } from "@/app/(workspace)/admin/actions";
import { AdminAuditLogDrawer } from "./AdminAuditLogDrawer";
import {
  ROLE_LABEL,
  USER_STATUS_LABEL,
  clampStatus,
  formatDate,
  formatDateTime,
  maskEmail,
  shortId,
} from "./format";

const { Paragraph } = Typography;

/**
 * X-10 region 5 — 상세 패널.
 *
 * description.md: "선택 사용자의 학습 기록, 결제 상태, 기관 소속, 권한을 확인."
 * 제약: "선택 사용자 필요, 민감 정보 마스킹, 액션 로그 표시."
 * 예외: "권한 부족/사용자 삭제됨은 패널 잠금 안내 표시."
 *
 * Actions: 역할 변경(상위 콘솔이 모달로 처리) · 활성/차단 토글 (확인 모달,
 * admin_set_user_status) · 변경 이력 (get_admin_audit_logs(target)).
 * Email is masked. A deleted user shows a locked panel.
 */

type Props = {
  row: AdminUserDirectoryRow | null;
  open: boolean;
  onClose: () => void;
  onChangeRole: (row: AdminUserDirectoryRow) => void;
  onChanged: () => void;
};

export function AdminUserDetailPanel({
  row,
  open,
  onClose,
  onChangeRole,
  onChanged,
}: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDeleted = row?.status === "deleted";
  const isBlocked = row?.status === "blocked";

  function confirmStatusChange() {
    if (!row) return;
    const next = isBlocked ? "active" : "blocked";
    const verb = next === "blocked" ? "차단" : "차단 해제";
    Modal.confirm({
      title: `${verb} 확인`,
      content: (
        <Space direction="vertical">
          <span>
            이 사용자를 {verb}할까요? 삭제가 아닌 상태 변경이며 되돌릴 수 있어요.
          </span>
          <Typography.Text strong>
            {row.display_name ?? maskEmail(row.email)}
          </Typography.Text>
        </Space>
      ),
      okText: verb,
      okButtonProps: { danger: next === "blocked" },
      cancelText: "취소",
      onOk: async () => {
        setBusy(true);
        setError(null);
        try {
          await setUserStatusAction(row.user_id, next);
          message.success(`${verb} 완료`);
          await qc.invalidateQueries({ queryKey: ["admin-users"] });
          await qc.invalidateQueries({ queryKey: ["admin-user-stats"] });
          onChanged();
        } catch (err) {
          const msg =
            err instanceof Error
              ? clampStatus(`${verb} 실패: ${err.message}`)
              : `${verb}에 실패했어요.`;
          setError(msg);
          throw err;
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <Drawer
      title="사용자 상세"
      placement="right"
      width={520}
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!row ? (
        <Empty description="사용자를 선택하면 상세 정보가 표시됩니다." />
      ) : (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {error ? (
            <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
          ) : null}

          {isDeleted ? (
            <Alert
              type="warning"
              showIcon
              message="삭제된 사용자"
              description="삭제된 사용자에는 조치를 적용할 수 없어요. 패널이 잠깁니다."
            />
          ) : null}

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="이름">
              {row.display_name ?? "이름 없음"}
            </Descriptions.Item>
            <Descriptions.Item label="이메일(마스킹)">
              {maskEmail(row.email)}
            </Descriptions.Item>
            <Descriptions.Item label="사용자 ID">
              <span style={{ fontFamily: "monospace" }}>
                {shortId(row.user_id)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="권한">
              <Tag>{ROLE_LABEL[row.app_role] ?? row.app_role}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="상태">
              <Tag
                color={
                  row.status === "active"
                    ? "green"
                    : row.status === "blocked"
                      ? "red"
                      : "default"
                }
              >
                {USER_STATUS_LABEL[row.status] ?? row.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="결제 등급">
              <Tag>{row.plan_label ?? "free"}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="학습 기록(제출)">
              {row.submission_count}건
            </Descriptions.Item>
            <Descriptions.Item label="최근 활동">
              <span suppressHydrationWarning>
                {formatDateTime(row.last_activity)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="최근 로그인">
              <span suppressHydrationWarning>
                {formatDate(row.last_sign_in_at)}
              </span>
            </Descriptions.Item>
          </Descriptions>

          <Space wrap>
            <Button
              disabled={isDeleted}
              onClick={() => onChangeRole(row)}
            >
              역할 변경
            </Button>
            <Tooltip
              title={isDeleted ? "삭제된 사용자에는 적용할 수 없어요." : ""}
            >
              <Button
                danger={!isBlocked}
                disabled={isDeleted}
                loading={busy}
                onClick={confirmStatusChange}
              >
                {isBlocked ? "차단 해제" : "비활성화(차단)"}
              </Button>
            </Tooltip>
            <Button onClick={() => setAuditOpen(true)}>변경 이력</Button>
          </Space>

          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            기관 소속 관리(org members)는 기관 관리 화면에서 처리합니다. 사용자
            삭제 대신 비활성화(차단)만 제공하며, 모든 조치는 변경 이력에
            기록됩니다.
          </Paragraph>
        </Space>
      )}

      <AdminAuditLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        targetId={row?.user_id ?? null}
        title="사용자 변경 이력"
      />
    </Drawer>
  );
}
