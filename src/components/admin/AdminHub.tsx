"use client";

import Link from "next/link";
import { Button, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import type { AppRole } from "@/lib/auth/roles";

const { Title, Paragraph } = Typography;

/**
 * X-15 관리자 인덱스 허브.
 *
 * description.md regions:
 *  1) Admin shell title — "관리" 제목 + 진입 안내.
 *  2) Placeholder guidance — 어떤 영역으로 이동하라는 안내.
 *  3/4) 하위 관리 화면 연결 — /admin/problems, /admin/org, /admin/users 로 가는 상위 허브.
 *
 * 권한별 카드 노출:
 *  하위 페이지 guard(`src/lib/auth/admin-guard.ts`)와 동일한 role 매핑을 그대로
 *  복제해 "현재 admin role 이 들어갈 수 있는 카드만" 보여준다. 즉 클릭 후
 *  redirect(`/dashboard?error=forbidden`) 되는 카드는 애초에 렌더링하지 않는다.
 *  이는 UX 정렬일 뿐 보안 경계가 아니다 — 진짜 경계는 각 하위 페이지의 서버 guard.
 */

type AdminCard = {
  href: "/admin/problems" | "/admin/org" | "/admin/users";
  title: string;
  description: string;
  /** 하위 페이지 guard 가 통과시키는 role 집합과 동일. */
  allowedRoles: readonly AppRole[];
};

const ADMIN_CARDS: readonly AdminCard[] = [
  {
    href: "/admin/problems",
    title: "문제 관리",
    description: "문제를 검색하고 발행 상태를 승인·편집합니다.",
    // admin-guard CONTENT_ROLES
    allowedRoles: ["content_admin", "platform_admin"],
  },
  {
    href: "/admin/org",
    title: "기관 관리",
    description: "기관 학습 현황과 운영 지표를 관리합니다.",
    // admin-guard ORG_ROLES
    allowedRoles: ["org_admin", "platform_admin"],
  },
  {
    href: "/admin/users",
    title: "사용자 관리",
    description: "사용자를 검색하고 권한과 상태를 관리합니다.",
    // admin-guard PLATFORM_ROLES
    allowedRoles: ["platform_admin"],
  },
];

const ROLE_LABEL: Record<AppRole, string> = {
  learner: "학습자",
  content_admin: "콘텐츠 관리자",
  org_admin: "기관 관리자",
  platform_admin: "플랫폼 관리자",
};

type Props = {
  role: AppRole;
};

export function AdminHub({ role }: Props) {
  const visibleCards = ADMIN_CARDS.filter((card) =>
    card.allowedRoles.includes(role),
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* region 1 — Admin shell title */}
      <div>
        <Space align="center" wrap>
          <Title level={3} style={{ margin: 0 }}>
            관리
          </Title>
          <Tag color="blue">{ROLE_LABEL[role]}</Tag>
        </Space>
        {/* region 2 — placeholder guidance */}
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          접근 권한이 있는 관리 영역을 선택하세요. 좌측 사이드바에서도 같은
          영역으로 이동할 수 있습니다.
        </Paragraph>
      </div>

      {/* region 3/4 — 하위 관리 화면 연결 (권한 필터된 카드) */}
      {visibleCards.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="현재 역할로 접근 가능한 관리 영역이 없습니다. 권한이 필요하면 플랫폼 관리자에게 문의하세요."
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {visibleCards.map((card) => (
            <Col xs={24} md={8} key={card.href}>
              <Card size="small" style={{ height: "100%" }}>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  <Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>
                    {card.title}
                  </Title>
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    {card.description}
                  </Paragraph>
                  <Link href={card.href}>
                    <Button type="primary" block>
                      이동
                    </Button>
                  </Link>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
