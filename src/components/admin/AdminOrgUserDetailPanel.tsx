"use client";

import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import type { AdminOrgPerUserRow } from "./admin-rpc";
import { formatDateTime, shortId } from "./format";
import { AdminAuditLogDrawer } from "./AdminAuditLogDrawer";

const { Paragraph } = Typography;

/**
 * X-08 region 5 — 우측 상세 패널.
 *
 * description.md: "선택 사용자 또는 과제의 상세 정보, 최근 피드백, 조치 버튼 제공."
 * 제약: "선택 행 필요, 상세 액션 4개 이하, 민감 정보 마스킹."
 * 예외: "선택 없음/권한 부족은 안내 패널로 대체."
 *
 * Actions (<=4): 사용자 관리 열기 · 변경 이력 · 과제 부여(준비 중) · 리포트(준비 중).
 * Masking: only the short learner id is shown; no raw email/PII is exposed in
 * this org-scoped view (org admins should manage PII via the platform user
 * console, not here).
 */

type Props = {
  row: AdminOrgPerUserRow | null;
  open: boolean;
  onClose: () => void;
};

export function AdminOrgUserDetailPanel({ row, open, onClose }: Props) {
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <Drawer
      title="학습자 상세"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
    >
      {!row ? (
        <Empty description="학습자를 선택하면 상세 정보가 표시됩니다." />
      ) : (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="이름">
              {row.display_name ?? "이름 없음"}
            </Descriptions.Item>
            <Descriptions.Item label="학습자 ID">
              <span style={{ fontFamily: "monospace" }}>
                {shortId(row.learner_id)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="제출 수">
              <Tag>{row.submission_count}건</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="평균 점수">
              {row.avg_score == null ? (
                "—"
              ) : (
                <Tag color="blue">{row.avg_score}점</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="최근 활동">
              <span suppressHydrationWarning>
                {formatDateTime(row.last_activity)}
              </span>
            </Descriptions.Item>
          </Descriptions>

          <Space wrap>
            <Link href="/admin/users">
              <Button type="primary">사용자 관리 열기</Button>
            </Link>
            <Button onClick={() => setAuditOpen(true)}>변경 이력</Button>
            <Tooltip title="기관 과제 부여 기능은 준비 중입니다.">
              <Button disabled>
                과제 부여 <Tag color="default">준비 중</Tag>
              </Button>
            </Tooltip>
          </Space>

          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            개인 식별 정보(이메일 등)는 이 화면에서 마스킹됩니다. 상세 PII는
            플랫폼 사용자 관리에서 권한에 따라 확인하세요.
          </Paragraph>
        </Space>
      )}

      <AdminAuditLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        targetId={row?.learner_id ?? null}
        title="학습자 변경 이력"
      />
    </Drawer>
  );
}
