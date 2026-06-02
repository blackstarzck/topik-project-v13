"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Modal,
  Result,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  cadenceLabel,
  fetchActivePlans,
  fetchMySubscription,
  fetchPaymentHistory,
  formatAmountCents,
  type PaymentRecord,
  type Subscription,
  type SubscriptionPlan,
} from "./billing-data";

const { Title, Paragraph, Text } = Typography;

const SUPPORT_EMAIL = "support@talkpik.example";
const PAGE_SIZE = 10;

const STATUS_META: Record<
  Subscription["status"],
  { label: string; color: string }
> = {
  active: { label: "이용 중", color: "green" },
  trialing: { label: "체험 중", color: "blue" },
  past_due: { label: "결제 실패", color: "red" },
  canceled: { label: "해지됨", color: "default" },
  paused: { label: "일시정지", color: "orange" },
};

const PAYMENT_STATUS_META: Record<
  PaymentRecord["status"],
  { label: string; color: string }
> = {
  paid: { label: "결제 완료", color: "green" },
  failed: { label: "결제 실패", color: "red" },
  refunded: { label: "환불", color: "default" },
  pending: { label: "처리 중", color: "blue" },
};

type SubState =
  | { status: "loading" }
  | {
      status: "ready";
      subscription: Subscription | null;
      planName: string | null;
    }
  | { status: "error"; message: string };

type HistoryState =
  | { status: "loading" }
  | { status: "ready"; rows: PaymentRecord[]; total: number }
  | { status: "error"; message: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

/**
 * X-04 구독 관리 — real subscriptions + payment_history.
 *
 * - Region 2 (현재 구독 요약): reads `subscriptions` (plan/cadence/next-billing)
 *   joined to the plan name; no-sub and 결제 실패 states render their own badge.
 * - Region 3 (변경/취소/결제수단): EXTERNAL STUBS. Each opens a policy modal
 *   first (취소/변경은 정책 모달 필수); cancel uses danger styling. No provider
 *   call is made — the modal states 연동 예정 honestly.
 * - Region 4 (결제 이력): `payment_history`, 10/page, fixed amount/status cols,
 *   receipt link, load-fail retry.
 * - Region 5 (우측 도움말): policy + 고객지원 CTA.
 */
export function SubscriptionShell() {
  const router = useRouter();
  const { message } = App.useApp();
  const [sub, setSub] = useState<SubState>({ status: "loading" });
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [page, setPage] = useState(0);
  const [policyModal, setPolicyModal] = useState<
    null | "change" | "cancel" | "payment_method"
  >(null);

  // 로딩 상태 set은 effect 동기 본문이 아니라 await 경계 이후 또는 이벤트
  // 핸들러에서만 한다(PaywallShell과 동일한 패턴). 최초 로딩은 초기 state가
  // 이미 "loading"이라 별도 set이 필요 없다.
  const loadSubscription = useCallback(async () => {
    try {
      const subscription = await fetchMySubscription();
      let planName: string | null = null;
      if (subscription?.plan_key) {
        const plans = await fetchActivePlans();
        planName =
          plans.find(
            (p: SubscriptionPlan) => p.plan_key === subscription.plan_key,
          )?.name ?? subscription.plan_key;
      }
      setSub({ status: "ready", subscription, planName });
    } catch (err) {
      setSub({
        status: "error",
        message:
          err instanceof Error ? err.message : "구독 정보를 불러오지 못했어요.",
      });
    }
  }, []);

  const loadHistory = useCallback(async (pageIndex: number) => {
    try {
      const { rows, total } = await fetchPaymentHistory(pageIndex, PAGE_SIZE);
      setHistory({ status: "ready", rows, total });
    } catch (err) {
      setHistory({
        status: "error",
        message:
          err instanceof Error ? err.message : "결제 이력을 불러오지 못했어요.",
      });
    }
  }, []);

  // 재시도 버튼/이벤트에서 즉시 로딩 표시 후 다시 불러온다.
  const reloadSubscription = useCallback(() => {
    setSub({ status: "loading" });
    void loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadSubscription();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSubscription]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadHistory(page);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHistory, page]);

  const columns: ColumnsType<PaymentRecord> = [
    {
      title: "결제일",
      dataIndex: "paid_at",
      key: "paid_at",
      render: (value: string | null, row) => formatDate(value ?? row.created_at),
    },
    {
      title: "금액",
      dataIndex: "amount_cents",
      key: "amount_cents",
      align: "right",
      render: (cents: number, row) => formatAmountCents(cents, row.currency),
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      render: (status: PaymentRecord["status"]) => {
        const meta = PAYMENT_STATUS_META[status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "영수증",
      dataIndex: "receipt_url",
      key: "receipt_url",
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer">
            영수증
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  function confirmPolicy() {
    setPolicyModal(null);
    // EXTERNAL STUB: no billing provider. Honest 연동 예정 feedback.
    message.info("결제 연동이 완료되면 이 작업을 바로 처리할 수 있어요. (연동 예정)");
  }

  const policyCopy: Record<
    NonNullable<typeof policyModal>,
    { title: string; body: string; danger?: boolean; okText: string }
  > = {
    change: {
      title: "플랜 변경 정책",
      body: "플랜 변경 시 남은 결제 기간은 일할 계산되어 다음 청구에 반영됩니다. 변경은 결제 연동 완료 후 적용됩니다.",
      okText: "확인했어요",
    },
    payment_method: {
      title: "결제수단 변경",
      body: "등록된 결제수단을 변경할 수 있습니다. 변경 즉시 다음 결제부터 새 수단이 사용됩니다. 결제 연동 완료 후 제공됩니다.",
      okText: "확인했어요",
    },
    cancel: {
      title: "구독 취소 정책",
      body: "지금 취소해도 현재 결제 기간이 끝날 때까지는 모든 혜택을 유지합니다. 환불은 결제 후 7일 이내에만 가능합니다. 이 작업은 되돌릴 수 없어요.",
      danger: true,
      okText: "취소 진행",
    },
  };

  return (
    <main style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Space>
            <Tag>X-04</Tag>
            <Title level={3} style={{ margin: 0 }}>
              구독 관리
            </Title>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            현재 구독 상태와 결제 이력을 확인하고 관리하세요.
          </Paragraph>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={15}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {/* Region 2: 현재 구독 요약 */}
              <Card title="현재 구독">
                {sub.status === "loading" ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : sub.status === "error" ? (
                  <Alert
                    type="error"
                    showIcon
                    message="구독 정보를 불러오지 못했어요"
                    description={sub.message}
                    action={
                      <Button size="small" onClick={reloadSubscription}>
                        다시 시도
                      </Button>
                    }
                  />
                ) : sub.subscription === null ? (
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Space>
                      <Text type="secondary">상태</Text>
                      <Tag>구독 없음</Tag>
                    </Space>
                    <Text type="secondary">
                      현재 이용 중인 유료 구독이 없습니다.
                    </Text>
                    <Link href="/paywall">
                      <Button type="primary">구독 시작하기</Button>
                    </Link>
                  </Space>
                ) : (
                  <Descriptions
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "status",
                        label: "상태",
                        children: (
                          <Tag color={STATUS_META[sub.subscription.status].color}>
                            {STATUS_META[sub.subscription.status].label}
                          </Tag>
                        ),
                      },
                      {
                        key: "plan",
                        label: "플랜",
                        children: sub.planName ?? "—",
                      },
                      {
                        key: "cadence",
                        label: "결제 주기",
                        children: cadenceLabel(sub.subscription.billing_cadence),
                      },
                      {
                        key: "next",
                        label: "다음 결제일",
                        children:
                          sub.subscription.cancel_at != null
                            ? `${formatDate(sub.subscription.current_period_end)} 이후 해지 예정`
                            : formatDate(sub.subscription.current_period_end),
                      },
                    ]}
                  />
                )}
              </Card>

              {/* Region 3: 변경/취소 액션 (external stubs + policy modal) */}
              {sub.status === "ready" && sub.subscription !== null ? (
                <Card title="구독 변경">
                  <Space wrap>
                    <Button onClick={() => setPolicyModal("change")}>
                      플랜 변경
                    </Button>
                    <Button onClick={() => setPolicyModal("payment_method")}>
                      결제수단 변경
                    </Button>
                    <Button danger onClick={() => setPolicyModal("cancel")}>
                      구독 취소
                    </Button>
                  </Space>
                  <Paragraph
                    type="secondary"
                    style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}
                  >
                    변경·취소는 정책 확인 후 진행되며, 결제 연동 완료 시 즉시
                    반영됩니다.
                  </Paragraph>
                </Card>
              ) : null}

              {/* Region 4: 결제 이력 */}
              <Card title="결제 이력">
                {history.status === "error" ? (
                  <Result
                    status="warning"
                    title="결제 이력을 불러오지 못했어요"
                    subTitle={history.message}
                    extra={
                      <Button
                        type="primary"
                        onClick={() => {
                          setHistory({ status: "loading" });
                          void loadHistory(page);
                        }}
                      >
                        다시 시도
                      </Button>
                    }
                  />
                ) : (
                  <Table<PaymentRecord>
                    rowKey="id"
                    size="small"
                    columns={columns}
                    loading={history.status === "loading"}
                    dataSource={
                      history.status === "ready" ? history.rows : []
                    }
                    locale={{ emptyText: "결제 이력이 없습니다." }}
                    pagination={{
                      current: page + 1,
                      pageSize: PAGE_SIZE,
                      total: history.status === "ready" ? history.total : 0,
                      showSizeChanger: false,
                      onChange: (next) => {
                        setHistory({ status: "loading" });
                        setPage(next - 1);
                      },
                    }}
                  />
                )}
              </Card>
            </Space>
          </Col>

          {/* Region 5: 우측 도움말 */}
          <Col xs={24} md={9}>
            <Card title="도움말">
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <div>
                  <Text strong>구독 변경 정책</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    변경 시 남은 기간은 일할 계산되어 반영됩니다.
                  </Paragraph>
                </div>
                <div>
                  <Text strong>환불 기준</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    결제 후 7일 이내, 미사용 시 환불 가능합니다.
                  </Paragraph>
                </div>
                <div>
                  <Text strong>플랜 차이</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    플랜별 혜택은 구독 시작 화면에서 비교할 수 있어요.
                  </Paragraph>
                </div>
                <Button
                  block
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    "구독 관련 문의",
                  )}`}
                >
                  고객지원 문의
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        <Space>
          <Link href="/paywall">
            <Button>구독 시작 화면</Button>
          </Link>
          <Button type="link" onClick={() => router.back()}>
            뒤로 가기
          </Button>
        </Space>
      </Space>

      <Modal
        open={policyModal !== null}
        title={policyModal ? policyCopy[policyModal].title : ""}
        okText={policyModal ? policyCopy[policyModal].okText : "확인"}
        cancelText="닫기"
        okButtonProps={
          policyModal && policyCopy[policyModal].danger
            ? { danger: true }
            : undefined
        }
        onOk={confirmPolicy}
        onCancel={() => setPolicyModal(null)}
      >
        <Paragraph style={{ marginBottom: 0 }}>
          {policyModal ? policyCopy[policyModal].body : ""}
        </Paragraph>
      </Modal>
    </main>
  );
}
