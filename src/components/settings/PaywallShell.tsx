"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Result,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  cadenceLabel,
  fetchActivePlans,
  fetchMySubscription,
  formatPlanPrice,
  planFeatureList,
  type SubscriptionPlan,
} from "./billing-data";

const { Title, Paragraph, Text } = Typography;

const SUPPORT_EMAIL = "support@talkpik.example";

type LoadState =
  | { status: "loading" }
  | { status: "has_subscription" }
  | { status: "ready"; plans: SubscriptionPlan[] }
  | { status: "error"; message: string };

/**
 * X-03 페이월 — real subscription_plans + existing-subscriber branch.
 *
 * - Region 1 (제목/보조 설명): title + 80-char/2-line subhead, price-free.
 * - Region 2 (결제 주기 카드 3열): real plans from subscription_plans (price,
 *   benefits, 추천 badge). Price-fetch failure falls back to a guidance copy.
 * - Region 3 (선택 CTA): per-card CTA. The actual checkout call is an EXTERNAL
 *   STUB — there is no payment provider wired, so the CTA opens an honest
 *   "연동 예정" notice instead of faking a success.
 * - Region 4 (혜택/지원 패널) + Region 5 (보조 정보) with 지원 문의 CTA.
 * - Exception (기존 구독자는 구독 관리로 유도): if the user already has a
 *   subscription row, we redirect to /subscription.
 */
export function PaywallShell() {
  const router = useRouter();
  const { message } = App.useApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await fetchMySubscription();
        if (cancelled) return;
        if (sub && (sub.status === "active" || sub.status === "trialing")) {
          setState({ status: "has_subscription" });
          // Exception: existing subscriber → 구독 관리.
          router.replace("/subscription");
          return;
        }
        const plans = await fetchActivePlans();
        if (cancelled) return;
        setState({ status: "ready", plans });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "플랜 정보를 불러오지 못했어요.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Stable ordering: recommended card highlighted, but column order keeps the
  // cheapest-first sort already applied by fetchActivePlans.
  const plans = useMemo(
    () => (state.status === "ready" ? state.plans : []),
    [state],
  );

  function handleSelect(plan: SubscriptionPlan) {
    // EXTERNAL STUB — no payment provider integration exists. We mark the
    // CTA pending briefly then surface an honest "연동 예정" message. We never
    // claim a successful checkout or write a subscription row.
    setSelecting(plan.plan_key);
    window.setTimeout(() => {
      setSelecting(null);
      message.info(
        "결제 연동은 준비 중입니다. 결제 수단 연동이 완료되면 이 버튼에서 바로 구독을 시작할 수 있어요.",
      );
    }, 350);
  }

  return (
    <main style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Region 1: 결제 선택 제목 */}
        <div>
          <Space>
            <Tag>X-03</Tag>
            <Title level={3} style={{ margin: 0 }}>
              구독 시작하기
            </Title>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            결제 주기를 비교하고 하나의 구독을 선택하세요. 가격과 혜택은 아래
            카드에서 확인할 수 있어요.
          </Paragraph>
        </div>

        {state.status === "loading" || state.status === "has_subscription" ? (
          <Card>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        ) : state.status === "error" ? (
          <Result
            status="warning"
            title="플랜 정보를 불러오지 못했어요"
            subTitle={state.message}
            extra={
              <Space>
                <Button type="primary" onClick={() => router.refresh()}>
                  다시 시도
                </Button>
                <Link href="/subscription">
                  <Button>구독 관리로 이동</Button>
                </Link>
              </Space>
            }
          />
        ) : (
          <>
            {/* Region 2: 결제 주기 카드 3열 */}
            {plans.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="현재 안내 가능한 플랜이 없습니다."
                description="플랜이 준비되면 이 화면에서 가격과 혜택을 확인할 수 있어요."
              />
            ) : (
              <Row gutter={[16, 16]} align="stretch">
                {plans.map((plan) => {
                  const benefits = planFeatureList(plan.features).slice(0, 4);
                  return (
                    <Col key={plan.plan_key} xs={24} md={8}>
                      <Card
                        style={
                          plan.recommended
                            ? { borderColor: "var(--ant-color-primary)" }
                            : undefined
                        }
                        title={
                          <Space>
                            <Text strong>{plan.name}</Text>
                            {plan.recommended ? (
                              <Tag color="blue">추천</Tag>
                            ) : null}
                          </Space>
                        }
                      >
                        <Space
                          direction="vertical"
                          size={10}
                          style={{ width: "100%" }}
                        >
                          <div>
                            <Title level={4} style={{ margin: 0 }}>
                              {formatPlanPrice(plan)}
                            </Title>
                            <Text type="secondary">
                              {cadenceLabel(plan.cadence)} 결제
                            </Text>
                          </div>
                          {benefits.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {benefits.map((b) => (
                                <li key={b}>
                                  <Text>{b}</Text>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Text type="secondary">
                              구독 시 핵심 기능을 모두 이용할 수 있어요.
                            </Text>
                          )}
                          {/* Region 3: 결제 주기 선택 CTA (external stub) */}
                          <Button
                            type={plan.recommended ? "primary" : "default"}
                            block
                            loading={selecting === plan.plan_key}
                            onClick={() => handleSelect(plan)}
                          >
                            {cadenceLabel(plan.cadence)} 구독 선택
                          </Button>
                          <Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            결제 연동 준비 중 · 아직 실제 결제는 진행되지 않아요.
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}

            <Row gutter={[16, 16]}>
              {/* Region 4: 혜택/지원 패널 */}
              <Col xs={24} md={14}>
                <Card title="구독 혜택">
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    <Text>· AI 작문 첨삭 무제한</Text>
                    <Text>· 약점 기반 추천 문제</Text>
                    <Text>· 상세 성장 리포트</Text>
                    <Text>· 모의고사 PDF 내보내기</Text>
                    <div style={{ marginTop: 8 }}>
                      <Button
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                          "구독 혜택 문의",
                        )}`}
                      >
                        지원 문의
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>

              {/* Region 5: 결제 보조 정보 */}
              <Col xs={24} md={10}>
                <Card title="결제 안내">
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    <Text type="secondary">· 환불은 결제 후 7일 이내 신청 가능</Text>
                    <Text type="secondary">· 세금계산서 발행 지원</Text>
                    <Text type="secondary">· 안전한 결제 (연동 예정)</Text>
                    <Text type="secondary">· 기관 단체 구독은 별도 문의</Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Space>
              <Link href="/subscription">
                <Button>구독 관리 보기</Button>
              </Link>
              <Button type="link" onClick={() => router.back()}>
                뒤로 가기
              </Button>
            </Space>
          </>
        )}
      </Space>
    </main>
  );
}
