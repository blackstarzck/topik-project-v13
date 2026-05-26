"use client";

import { Card, Divider, Tag, Typography } from "antd";
import Link from "next/link";

const { Text, Paragraph } = Typography;

type Props = {
  joinedAt: string;
  appRole: string;
  planLabel: string;
};

const ROLE_LABELS: Record<string, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

/**
 * Phase 7-E Task 10 (P1-6) — 상태/도움 카드.
 * 계정 상태 + 가입일 + 도움말 + 향후 탈퇴 진입점 (실제 탈퇴는 Tier 2).
 */
export function StatusHelpCard({ joinedAt, appRole, planLabel }: Props) {
  const roleLabel = ROLE_LABELS[appRole] ?? appRole;
  return (
    <Card title="계정 상태">
      <Paragraph>
        <Text type="secondary">역할 </Text>
        <Tag>{roleLabel}</Tag>
        <Text type="secondary" style={{ marginLeft: 12 }}>플랜 </Text>
        <Tag color="gold">{planLabel}</Tag>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">가입일 </Text>
        <Text strong>{new Date(joinedAt).toLocaleDateString("ko-KR")}</Text>
      </Paragraph>
      <Divider />
      <Paragraph>
        <Link href="/settings/notifications">알림 설정</Link>
        <Text type="secondary"> · </Text>
        <Link href="/settings/language">언어 설정</Link>
      </Paragraph>
      <Paragraph style={{ marginBottom: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          회원 탈퇴는 다음 업데이트에서 지원됩니다.
        </Text>
      </Paragraph>
    </Card>
  );
}
