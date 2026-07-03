"use client";

import {
  Alert,
  App,
  Button,
  Col,
  Result,
  Row,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { PageHeader } from "@/components/shared/PageHeader";

import {
  cadenceLabelKey,
  fetchActivePlans,
  fetchMySubscription,
  formatPlanPrice,
  planFeatureList,
  type SubscriptionPlan,
} from "./billing-data";

const { Title, Text } = Typography;

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
  const t = useTranslations("paywall");
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
          message: err instanceof Error ? err.message : t("loadError"),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

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
      message.info(t("checkoutStubInfo"));
    }, 350);
  }

  return (
    <div data-testid="paywall-shell" className="w-full">
      <div className="flex w-full flex-col gap-6">
        {/* Region 1: 결제 선택 제목. IA 코드는 사용자 화면에 노출하지 않는다. */}
        <div>
          <PageHeader title={t("heading")} subtitle={t("subheading")} />
        </div>

        {state.status === "loading" || state.status === "has_subscription" ? (
          <AppCard>
            <Skeleton active paragraph={{ rows: 4 }} />
          </AppCard>
        ) : state.status === "error" ? (
          <Result
            status="warning"
            title={t("errorTitle")}
            subTitle={state.message}
            extra={
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="primary" onClick={() => router.refresh()}>
                  {t("retry")}
                </Button>
                <Link href="/subscription">
                  <Button>{t("goToManage")}</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <>
            {/* Region 2: 결제 주기 카드 3열 */}
            {plans.length === 0 ? (
              <Alert
                data-testid="paywall-empty-state"
                type="info"
                showIcon
                title={t("noPlans.title")}
                description={t("noPlans.body")}
              />
            ) : (
              <Row
                data-testid="paywall-plan-grid"
                gutter={[16, 16]}
                align="stretch"
              >
                {plans.map((plan) => {
                  const benefits = planFeatureList(
                    plan.features,
                    plan,
                    plans,
                  ).slice(0, 4);
                  return (
                    <Col key={plan.plan_key} xs={24} md={8}>
                      <AppCard
                        data-testid={`paywall-plan-${plan.cadence}`}
                        className={
                          plan.recommended ? "h-full border-primary" : "h-full"
                        }
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            <Text strong>{plan.name}</Text>
                            {plan.recommended ? (
                              <Tag>{t("recommendedBadge")}</Tag>
                            ) : null}
                          </span>
                        }
                      >
                        <div className="flex w-full flex-col gap-3">
                          <div>
                            <Title level={4} className="!m-0">
                              {formatPlanPrice(plan)}
                            </Title>
                            <Text type="secondary">
                              {t("cadenceBilling", {
                                cadence: t(
                                  `cadence.${cadenceLabelKey(plan.cadence)}` as Parameters<
                                    typeof t
                                  >[0],
                                ),
                              })}
                            </Text>
                          </div>
                          {benefits.length > 0 ? (
                            <ul className="m-0 pl-5">
                              {benefits.map((b) => (
                                <li key={b}>
                                  <Text>{b}</Text>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Text type="secondary">
                              {t("benefitsFallback")}
                            </Text>
                          )}
                          {/* Region 3: 결제 주기 선택 CTA (external stub) */}
                          <Button
                            data-testid={`paywall-select-${plan.cadence}`}
                            type={plan.recommended ? "primary" : "default"}
                            block
                            loading={selecting === plan.plan_key}
                            onClick={() => handleSelect(plan)}
                          >
                            {t("selectCta", {
                              cadence: t(
                                `cadence.${cadenceLabelKey(plan.cadence)}` as Parameters<
                                  typeof t
                                >[0],
                              ),
                            })}
                          </Button>
                          <Text
                            data-testid="paywall-stub-note"
                            type="secondary"
                            className="!text-xs"
                          >
                            {t("stubNote")}
                          </Text>
                        </div>
                      </AppCard>
                    </Col>
                  );
                })}
              </Row>
            )}

            <Row gutter={[16, 16]}>
              {/* Region 4: 혜택/지원 패널 */}
              <Col xs={24} md={14}>
                <AppCard
                  data-testid="paywall-benefits-panel"
                  title={t("benefits.title")}
                >
                  <div className="flex w-full flex-col gap-1">
                    <Text>{t("benefits.item1")}</Text>
                    <Text>{t("benefits.item2")}</Text>
                    <Text>{t("benefits.item3")}</Text>
                    <Text>{t("benefits.item4")}</Text>
                    <div className="mt-2">
                      <Button
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                          t("benefits.contactSubject"),
                        )}`}
                      >
                        {t("benefits.contactCta")}
                      </Button>
                    </div>
                  </div>
                </AppCard>
              </Col>

              {/* Region 5: 결제 보조 정보 */}
              <Col xs={24} md={10}>
                <AppCard
                  data-testid="paywall-payment-info"
                  title={t("paymentInfo.title")}
                >
                  <div className="flex w-full flex-col gap-1">
                    <Text type="secondary">{t("paymentInfo.item1")}</Text>
                    <Text type="secondary">{t("paymentInfo.item2")}</Text>
                    <Text type="secondary">{t("paymentInfo.item3")}</Text>
                    <Text type="secondary">{t("paymentInfo.item4")}</Text>
                  </div>
                </AppCard>
              </Col>
            </Row>

            <div className="flex flex-wrap gap-2">
              <Link href="/subscription">
                <Button>{t("viewManageCta")}</Button>
              </Link>
              <Button type="link" onClick={() => router.back()}>
                {t("backCta")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
