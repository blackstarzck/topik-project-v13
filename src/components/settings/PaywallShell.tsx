"use client";

import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

const { Title, Paragraph, Text } = Typography;

type PlanPreview = {
  key: string;
  name: string;
  cadence: string;
  recommended?: boolean;
};

// Region 2 (결제 주기 카드 3열): preview-only cards. No prices are shown —
// billing is deferred (deferred-scope.md §Billing), and inventing prices
// would overclaim. Cards exist so the layout/intent is legible without
// promising a live checkout.
const PLAN_PREVIEWS: PlanPreview[] = [
  { key: "monthly", name: "월간", cadence: "매월 결제" },
  { key: "quarterly", name: "분기", cadence: "3개월마다 결제", recommended: true },
  { key: "yearly", name: "연간", cadence: "매년 결제" },
];

/**
 * X-03 paywall — deferred-billing shell.
 *
 * deferred-scope.md §Billing keeps `/paywall` as a UI shell only: no billing
 * SDK, no payment provider, no checkout. This screen therefore shows the
 * documented regions (결제 주기 카드 / 혜택 / 보조 정보) as a non-functional
 * preview, with an honest "준비 중" banner and disabled cadence CTAs. The
 * single working primary action routes existing/curious users to the
 * subscription management shell, per the spec exception
 * (기존 구독자는 구독 관리로 유도).
 */
export function PaywallShell() {
  const router = useRouter();

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Region 1: 결제 선택 제목 */}
        <div>
          <Space>
            <Tag>X-03</Tag>
            <Title level={3} style={{ margin: 0 }}>
              구독 가입
            </Title>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            결제 주기를 비교하고 단일 구독을 시작하는 화면입니다.
          </Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          message="결제 기능 준비 중"
          description="유료 구독 결제는 아직 도입되지 않았습니다. 아래 정보는 준비 중인 플랜 미리보기이며, 실제 결제는 진행되지 않습니다."
        />

        {/* Region 2: 결제 주기 카드 3열 */}
        <Row gutter={[16, 16]}>
          {PLAN_PREVIEWS.map((plan) => (
            <Col key={plan.key} xs={24} md={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <Text strong>{plan.name}</Text>
                    {plan.recommended ? <Tag color="blue">추천</Tag> : null}
                  </Space>
                }
              >
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Text type="secondary">{plan.cadence}</Text>
                  <Text type="secondary">가격 정보 준비 중</Text>
                  {/* Region 3: 결제 주기 선택 CTA — disabled (no live checkout) */}
                  <Button type="primary" block disabled>
                    선택 (준비 중)
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Region 4: 혜택/지원 패널 */}
        <Card size="small" title="구독 혜택 (준비 중)">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <Text type="secondary">AI 첨삭 횟수 확대</Text>
            </li>
            <li>
              <Text type="secondary">상세 성장 리포트</Text>
            </li>
            <li>
              <Text type="secondary">PDF 내보내기</Text>
            </li>
          </ul>
        </Card>

        {/* Region 5: 결제 보조 정보 */}
        <Card size="small" title="결제 안내 (준비 중)">
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            환불 정책·세금계산서·보안 결제·기관 문의 안내는 결제 기능 도입
            시점에 함께 제공됩니다.
          </Paragraph>
        </Card>

        <Space>
          <Link href="/subscription">
            <Button type="primary">구독 관리 보기</Button>
          </Link>
          <Button onClick={() => router.back()}>뒤로 가기</Button>
        </Space>
      </Space>
    </main>
  );
}
