"use client";

import {
  Alert,
  App,
  Button,
  Col,
  Descriptions,
  Result,
  Row,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { CreditCard, FileText, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { AppModal } from "@/components/shared/AppModal";
import { PageHeader } from "@/components/shared/PageHeader";

import {
  cadenceLabelKey,
  fetchActivePlans,
  fetchMySubscription,
  fetchPaymentHistory,
  formatAmountCents,
  formatPlanPrice,
  type PaymentRecord,
  type Subscription,
  type SubscriptionPlan,
} from "./billing-data";

const { Paragraph, Text } = Typography;

const SUPPORT_EMAIL = "support@talkpik.example";
const PAGE_SIZE = 10;

// i18n: 상태/결제 enum 값은 카탈로그 키 이름만 보관하고(공유 엔티티
// 의미를 바꾸지 않음), 한글 라벨은 렌더 시 t(`status.${key}`)로 해석한다.
const STATUS_BADGE_META: Record<
  Subscription["status"],
  { labelKey: string }
> = {
  active: { labelKey: "active" },
  trialing: { labelKey: "trialing" },
  past_due: { labelKey: "pastDue" },
  canceled: { labelKey: "canceled" },
  paused: { labelKey: "paused" },
};

const PAYMENT_STATUS_BADGE_META: Record<
  PaymentRecord["status"],
  { labelKey: string }
> = {
  paid: { labelKey: "paid" },
  failed: { labelKey: "failed" },
  refunded: { labelKey: "refunded" },
  pending: { labelKey: "pending" },
};

type SubState =
  | { status: "loading" }
  | {
      status: "ready";
      subscription: Subscription | null;
      planName: string | null;
      plan: SubscriptionPlan | null;
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

function scheduledCancellationDate(subscription: Subscription): string | null {
  return subscription.cancel_at ?? subscription.current_period_end;
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
      let plan: SubscriptionPlan | null = null;
      if (subscription?.plan_key) {
        const plans = await fetchActivePlans();
        plan =
          plans.find(
            (p: SubscriptionPlan) => p.plan_key === subscription.plan_key,
          ) ?? null;
        planName = plan?.name ?? subscription.plan_key;
      }
      setSub({ status: "ready", subscription, planName, plan });
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
          <Tag>
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
    <div data-testid="subscription-shell" className="w-full">
      <div className="flex w-full flex-col gap-6">
        {/* IA 코드는 사용자 화면에 노출하지 않는다. */}
        <div>
          <PageHeader title={t("heading")} subtitle={t("subheading")} />
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={15}>
            <div className="flex w-full flex-col gap-4">
              {/* Region 2: 현재 구독 요약 */}
              <AppCard
                data-testid="subscription-current-card"
                title={t("current.title")}
              >
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
                  <div
                    data-testid="subscription-no-sub"
                    className="flex w-full flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Text type="secondary">{t("current.statusLabel")}</Text>
                      <Tag>{t("current.noSubBadge")}</Tag>
                    </div>
                    <Text type="secondary">{t("current.noSubBody")}</Text>
                    <Link href="/paywall">
                      <Button
                        data-testid="subscription-start-cta"
                        type="primary"
                      >
                        {t("current.startCta")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex w-full flex-col gap-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-text text-lg font-bold text-background">
                          PRO
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Text strong className="text-lg">
                              {sub.planName ?? t("current.unknownPlan")}
                            </Text>
                            <Tag>
                              {t(
                                `status.${STATUS_BADGE_META[sub.subscription.status].labelKey}` as Parameters<typeof t>[0],
                              )}
                            </Tag>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag>
                              {t(
                                `cadence.${cadenceLabelKey(sub.subscription.billing_cadence)}` as Parameters<typeof t>[0],
                              )}
                            </Tag>
                            <Text type="secondary">
                              {t("current.autoRenewalNote")}
                            </Text>
                          </div>
                        </div>
                      </div>

                      <Descriptions
                        className="min-w-0"
                        column={1}
                        size="small"
                        items={[
                          {
                            key: "next",
                            label: t("current.nextBillingLabel"),
                            children:
                              sub.subscription.cancel_at != null
                                ? t("current.cancelScheduled", {
                                    date: formatDate(
                                      scheduledCancellationDate(
                                        sub.subscription,
                                      ),
                                    ),
                                  })
                                : formatDate(
                                    sub.subscription.current_period_end,
                                  ),
                          },
                          {
                            key: "amount",
                            label: t("current.nextChargeLabel"),
                            children: sub.plan ? formatPlanPrice(sub.plan) : "—",
                          },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </AppCard>

              {sub.status === "ready" && sub.subscription !== null ? (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <AppCard
                      data-testid="subscription-payment-card"
                      title={t("payment.title")}
                      extra={
                        <CreditCard
                          aria-hidden="true"
                          className="h-4 w-4 text-text-secondary"
                        />
                      }
                    >
                      <div className="flex w-full flex-col gap-3">
                        <div>
                          <Text strong>{t("payment.placeholderTitle")}</Text>
                          <Paragraph
                            type="secondary"
                            className="!mb-0 !mt-1"
                          >
                            {t("payment.placeholderBody")}
                          </Paragraph>
                        </div>
                        <Button
                          data-testid="subscription-payment-card-change"
                          onClick={() => setPolicyModal("payment_method")}
                        >
                          {t("change.changePaymentMethod")}
                        </Button>
                      </div>
                    </AppCard>
                  </Col>
                  <Col xs={24} lg={12}>
                    <AppCard
                      data-testid="subscription-usage-card"
                      title={t("usage.title")}
                      extra={
                        <PenLine
                          aria-hidden="true"
                          className="h-4 w-4 text-text-secondary"
                        />
                      }
                    >
                      <div className="flex w-full flex-col gap-3">
                        <Alert
                          type="info"
                          showIcon
                          title={t("usage.aiTitle")}
                          description={t("usage.aiBody")}
                        />
                        <div className="flex items-start gap-2">
                          <FileText
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
                          />
                          <Text type="secondary">{t("usage.pdfBody")}</Text>
                        </div>
                      </div>
                    </AppCard>
                  </Col>
                </Row>
              ) : null}

              {/* Region 3: 변경/취소 액션 (external stubs + policy modal) */}
              {sub.status === "ready" && sub.subscription !== null ? (
                <AppCard
                  data-testid="subscription-change-card"
                  title={t("change.title")}
                >
                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="subscription-change-plan"
                      onClick={() => setPolicyModal("change")}
                    >
                      {t("change.changePlan")}
                    </Button>
                    <Button
                      data-testid="subscription-change-payment"
                      onClick={() => setPolicyModal("payment_method")}
                    >
                      {t("change.changePaymentMethod")}
                    </Button>
                    <Button
                      data-testid="subscription-cancel"
                      danger
                      onClick={() => setPolicyModal("cancel")}
                    >
                      {t("change.cancel")}
                    </Button>
                  </div>
                  <Paragraph
                    type="secondary"
                    className="!mb-0 !mt-3 !text-xs"
                  >
                    {t("change.note")}
                  </Paragraph>
                </AppCard>
              ) : null}

              {/* Region 4: 결제 이력 */}
              <AppCard
                data-testid="subscription-history-card"
                title={t("history.title")}
              >
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
              </AppCard>
            </div>
          </Col>

          {/* Region 5: 우측 도움말 */}
          <Col xs={24} md={9}>
            <AppCard
              data-testid="subscription-help-card"
              title={t("help.title")}
            >
              <div className="flex w-full flex-col gap-3">
                <div>
                  <Text strong>{t("help.changePolicyTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
                    {t("help.changePolicyBody")}
                  </Paragraph>
                </div>
                <div>
                  <Text strong>{t("help.refundTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
                    {t("help.refundBody")}
                  </Paragraph>
                </div>
                <div>
                  <Text strong>{t("help.planDiffTitle")}</Text>
                  <Paragraph type="secondary" className="!mb-0">
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
              </div>
            </AppCard>
          </Col>
        </Row>

        <div className="flex flex-wrap gap-2">
          <Link href="/paywall">
            <Button>{t("startScreenCta")}</Button>
          </Link>
          <Button type="link" onClick={() => router.back()}>
            {t("backCta")}
          </Button>
        </div>
      </div>

      <AppModal
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
        <Paragraph className="!mb-0">
          {policyModal
            ? t(policyCopy[policyModal].bodyKey as Parameters<typeof t>[0])
            : ""}
        </Paragraph>
      </AppModal>
    </div>
  );
}
