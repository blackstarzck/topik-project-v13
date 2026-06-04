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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  cadenceLabelKey,
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

// i18n: 상태/결제 enum 값은 카탈로그 키 이름 + 배지 색만 보관하고(공유 엔티티
// 의미를 바꾸지 않음), 한글 라벨은 렌더 시 t(`status.${key}`)로 해석한다.
const STATUS_BADGE_META: Record<
  Subscription["status"],
  { labelKey: string; color: string }
> = {
  active: { labelKey: "active", color: "green" },
  trialing: { labelKey: "trialing", color: "blue" },
  past_due: { labelKey: "pastDue", color: "red" },
  canceled: { labelKey: "canceled", color: "default" },
  paused: { labelKey: "paused", color: "orange" },
};

const PAYMENT_STATUS_BADGE_META: Record<
  PaymentRecord["status"],
  { labelKey: string; color: string }
> = {
  paid: { labelKey: "paid", color: "green" },
  failed: { labelKey: "failed", color: "red" },
  refunded: { labelKey: "refunded", color: "default" },
  pending: { labelKey: "pending", color: "blue" },
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
  const t = useTranslations("subscription");
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
        message: err instanceof Error ? err.message : t("subscriptionLoadError"),
      });
    }
  }, [t]);

  const loadHistory = useCallback(async (pageIndex: number) => {
    try {
      const { rows, total } = await fetchPaymentHistory(pageIndex, PAGE_SIZE);
      setHistory({ status: "ready", rows, total });
    } catch (err) {
      setHistory({
        status: "error",
        message: err instanceof Error ? err.message : t("historyLoadError"),
      });
    }
  }, [t]);

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
      title: t("history.colDate"),
      dataIndex: "paid_at",
      key: "paid_at",
      render: (value: string | null, row) => formatDate(value ?? row.created_at),
    },
    {
      title: t("history.colAmount"),
      dataIndex: "amount_cents",
      key: "amount_cents",
      align: "right",
      render: (cents: number, row) => formatAmountCents(cents, row.currency),
    },
    {
      title: t("history.colStatus"),
      dataIndex: "status",
      key: "status",
      render: (status: PaymentRecord["status"]) => {
        const meta = PAYMENT_STATUS_BADGE_META[status];
        return (
          <Tag color={meta.color}>
            {t(`paymentStatus.${meta.labelKey}` as Parameters<typeof t>[0])}
          </Tag>
        );
      },
    },
    {
      title: t("history.colReceipt"),
      dataIndex: "receipt_url",
      key: "receipt_url",
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer">
            {t("history.receiptLink")}
          </a>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  function confirmPolicy() {
    setPolicyModal(null);
    // EXTERNAL STUB: no billing provider. Honest 연동 예정 feedback.
    message.info(t("policy.stubInfo"));
  }

  // 정책 모달 카피. 제목/본문/확인 라벨은 카탈로그 키로 해석하고, danger 여부만
  // 여기서 결정한다(취소는 danger 스타일).
  const policyCopy: Record<
    NonNullable<typeof policyModal>,
    { titleKey: string; bodyKey: string; okKey: string; danger?: boolean }
  > = {
    change: {
      titleKey: "policy.change.title",
      bodyKey: "policy.change.body",
      okKey: "policy.change.ok",
    },
    payment_method: {
      titleKey: "policy.paymentMethod.title",
      bodyKey: "policy.paymentMethod.body",
      okKey: "policy.paymentMethod.ok",
    },
    cancel: {
      titleKey: "policy.cancel.title",
      bodyKey: "policy.cancel.body",
      okKey: "policy.cancel.ok",
      danger: true,
    },
  };

  return (
    <main style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Space>
            <Tag>X-04</Tag>
            <Title level={3} style={{ margin: 0 }}>
              {t("heading")}
            </Title>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {t("subheading")}
          </Paragraph>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={15}>
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {/* Region 2: 현재 구독 요약 */}
              <Card title={t("current.title")}>
                {sub.status === "loading" ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : sub.status === "error" ? (
                  <Alert
                    type="error"
                    showIcon
                    title={t("current.errorTitle")}
                    description={sub.message}
                    action={
                      <Button size="small" onClick={reloadSubscription}>
                        {t("retry")}
                      </Button>
                    }
                  />
                ) : sub.subscription === null ? (
                  <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                    <Space>
                      <Text type="secondary">{t("current.statusLabel")}</Text>
                      <Tag>{t("current.noSubBadge")}</Tag>
                    </Space>
                    <Text type="secondary">{t("current.noSubBody")}</Text>
                    <Link href="/paywall">
                      <Button type="primary">{t("current.startCta")}</Button>
                    </Link>
                  </Space>
                ) : (
                  <Descriptions
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "status",
                        label: t("current.statusLabel"),
                        children: (
                          <Tag
                            color={STATUS_BADGE_META[sub.subscription.status].color}
                          >
                            {t(
                              `status.${STATUS_BADGE_META[sub.subscription.status].labelKey}` as Parameters<typeof t>[0],
                            )}
                          </Tag>
                        ),
                      },
                      {
                        key: "plan",
                        label: t("current.planLabel"),
                        children: sub.planName ?? "—",
                      },
                      {
                        key: "cadence",
                        label: t("current.cadenceLabel"),
                        children: t(
                          `cadence.${cadenceLabelKey(sub.subscription.billing_cadence)}` as Parameters<typeof t>[0],
                        ),
                      },
                      {
                        key: "next",
                        label: t("current.nextBillingLabel"),
                        children:
                          sub.subscription.cancel_at != null
                            ? t("current.cancelScheduled", {
                                date: formatDate(
                                  sub.subscription.current_period_end,
                                ),
                              })
                            : formatDate(sub.subscription.current_period_end),
                      },
                    ]}
                  />
                )}
              </Card>

              {/* Region 3: 변경/취소 액션 (external stubs + policy modal) */}
              {sub.status === "ready" && sub.subscription !== null ? (
                <Card title={t("change.title")}>
                  <Space wrap>
                    <Button onClick={() => setPolicyModal("change")}>
                      {t("change.changePlan")}
                    </Button>
                    <Button onClick={() => setPolicyModal("payment_method")}>
                      {t("change.changePaymentMethod")}
                    </Button>
                    <Button danger onClick={() => setPolicyModal("cancel")}>
                      {t("change.cancel")}
                    </Button>
                  </Space>
                  <Paragraph
                    type="secondary"
                    style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}
                  >
                    {t("change.note")}
                  </Paragraph>
                </Card>
              ) : null}

              {/* Region 4: 결제 이력 */}
              <Card title={t("history.title")}>
                {history.status === "error" ? (
                  <Result
                    status="warning"
                    title={t("history.errorTitle")}
                    subTitle={history.message}
                    extra={
                      <Button
                        type="primary"
                        onClick={() => {
                          setHistory({ status: "loading" });
                          void loadHistory(page);
                        }}
                      >
                        {t("retry")}
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
                    locale={{ emptyText: t("history.empty") }}
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
            <Card title={t("help.title")}>
              <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                <div>
                  <Text strong>{t("help.changePolicyTitle")}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {t("help.changePolicyBody")}
                  </Paragraph>
                </div>
                <div>
                  <Text strong>{t("help.refundTitle")}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {t("help.refundBody")}
                  </Paragraph>
                </div>
                <div>
                  <Text strong>{t("help.planDiffTitle")}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {t("help.planDiffBody")}
                  </Paragraph>
                </div>
                <Button
                  block
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    t("help.contactSubject"),
                  )}`}
                >
                  {t("help.contactCta")}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        <Space>
          <Link href="/paywall">
            <Button>{t("startScreenCta")}</Button>
          </Link>
          <Button type="link" onClick={() => router.back()}>
            {t("backCta")}
          </Button>
        </Space>
      </Space>

      <Modal
        open={policyModal !== null}
        title={
          policyModal
            ? t(policyCopy[policyModal].titleKey as Parameters<typeof t>[0])
            : ""
        }
        okText={
          policyModal
            ? t(policyCopy[policyModal].okKey as Parameters<typeof t>[0])
            : t("modalDefaultOk")
        }
        cancelText={t("modalClose")}
        okButtonProps={
          policyModal && policyCopy[policyModal].danger
            ? { danger: true }
            : undefined
        }
        onOk={confirmPolicy}
        onCancel={() => setPolicyModal(null)}
      >
        <Paragraph style={{ marginBottom: 0 }}>
          {policyModal
            ? t(policyCopy[policyModal].bodyKey as Parameters<typeof t>[0])
            : ""}
        </Paragraph>
      </Modal>
    </main>
  );
}
