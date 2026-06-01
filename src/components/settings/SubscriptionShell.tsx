"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

const { Title, Paragraph, Text } = Typography;

/**
 * X-04 subscription management — deferred-billing shell.
 *
 * deferred-scope.md §Billing keeps `/subscription` as a UI shell only: no
 * billing SDK, no payment provider, no real subscription/payment-history
 * data. We render the documented regions (현재 구독 요약 / 변경·취소 액션 /
 * 결제 이력 / 도움말) honestly: the summary shows a free-plan state from no
 * live billing source, change/cancel/payment-method actions are disabled
 * with a "준비 중" label, and the payment-history table renders its empty
 * state. No invoice or receipt download is fabricated.
 */
export function SubscriptionShell() {
  const router = useRouter();

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Space>
            <Tag>X-04</Tag>
            <Title level={3} style={{ margin: 0 }}>
              구독 관리
            </Title>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            현재 구독 상태와 결제 이력을 관리하는 화면입니다.
          </Paragraph>
        </div>

        <Alert
          type="info"
          showIcon
          message="결제 기능 준비 중"
          description="유료 구독·결제 기능은 아직 도입되지 않았습니다. 현재는 무료로 이용 중이며, 결제 이력과 변경/취소 기능은 준비 중입니다."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {/* Region 2: 현재 구독 요약 */}
              <Card size="small" title="현재 구독">
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space>
                    <Text type="secondary">플랜</Text>
                    <Tag>무료</Tag>
                  </Space>
                  <Text type="secondary">결제 주기 · 다음 결제일 없음</Text>
                </Space>
              </Card>

              {/* Region 3: 변경/취소 액션 — disabled (no live billing) */}
              <Card size="small" title="구독 변경">
                <Space wrap>
                  <Button disabled>플랜 변경 (준비 중)</Button>
                  <Button disabled>결제수단 변경 (준비 중)</Button>
                  <Button danger disabled>
                    구독 취소 (준비 중)
                  </Button>
                </Space>
              </Card>

              {/* Region 4: 결제 이력 — empty state, no fabricated invoices */}
              <Card size="small" title="결제 이력">
                <Empty description="결제 이력이 없습니다." />
              </Card>
            </Space>
          </Col>

          <Col xs={24} md={10}>
            {/* Region 5: 우측 도움말 */}
            <Card size="small" title="도움말">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  <Text type="secondary">
                    구독 변경·환불 정책은 결제 기능 도입 시 함께 안내됩니다.
                  </Text>
                </li>
                <li>
                  <Text type="secondary">
                    플랜별 차이와 혜택은 구독 가입 화면에서 미리 볼 수 있어요.
                  </Text>
                </li>
                <li>
                  <Text type="secondary">
                    추가 문의는 고객지원으로 연락해 주세요.
                  </Text>
                </li>
              </ul>
            </Card>
          </Col>
        </Row>

        <Space>
          <Link href="/paywall">
            <Button type="primary">구독 가입 보기</Button>
          </Link>
          <Button onClick={() => router.back()}>뒤로 가기</Button>
        </Space>
      </Space>
    </main>
  );
}
