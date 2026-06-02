"use client";

import { Alert, Card, Divider, Tag, Typography } from "antd";
import Link from "next/link";

const { Text, Paragraph } = Typography;

type Props = {
  joinedAt: string;
  appRole: string;
  planLabel: string;
  /** X-05 region 4 — profile visibility badge. Defaults to private. */
  visibility?: "public" | "private";
  /** X-05 region 4 예외 — surface a warning when policy not agreed. */
  policyAgreed?: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

/**
 * Phase 7-E Task 10 (P1-6) — 상태/도움 카드.
 * X-05 region 4: 공개 범위 배지 + 데이터 활용/정책 동의 안내 + 학습 목표 반영.
 */
export function StatusHelpCard({
  joinedAt,
  appRole,
  planLabel,
  visibility = "private",
  policyAgreed = true,
}: Props) {
  const roleLabel = ROLE_LABELS[appRole] ?? appRole;
  return (
    <Card title="계정 상태">
      {/* X-05 region 4 예외: 정책 미동의 경고 */}
      {!policyAgreed ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="개인정보 처리방침에 동의가 필요해요"
          description="동의 전까지 일부 데이터 활용 기능이 제한됩니다."
        />
      ) : null}
      <Paragraph>
        <Text type="secondary">공개 범위 </Text>
        <Tag color={visibility === "public" ? "green" : "default"}>
          {visibility === "public" ? "공개" : "비공개"}
        </Tag>
      </Paragraph>
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
      <Paragraph style={{ marginBottom: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          학습 목표는 프로필에 반영되어 추천·리포트에 사용됩니다.
        </Text>
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
