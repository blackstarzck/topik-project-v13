"use client";

/**
 * Shard-local billing data access (X-03 / X-04).
 *
 * WHY THIS FILE EXISTS (and not `src/lib/billing/*`):
 * The conformance migrations `20260602120100_billing.sql` added
 * `subscription_plans`, `subscriptions`, and `payment_history`, but the
 * hand-aligned `src/lib/supabase/types.ts` snapshot has NOT yet been
 * regenerated to include them (that file is owned by the coordinator's
 * shared-infra workstream — see proposedCatalogChanges). To wire REAL data
 * now without editing shared files, this module declares the row shapes
 * locally and narrows the base browser client at the call site via a tightly
 * scoped cast. Once `types.ts` is regenerated the casts can be dropped.
 *
 * RLS contract (see migration):
 *   - subscription_plans : authenticated may SELECT active plans.
 *   - subscriptions      : owner-only SELECT (writes via billing service).
 *   - payment_history    : owner-only SELECT.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PlanCadence = "monthly" | "quarterly" | "yearly";

export type SubscriptionPlan = {
  plan_key: string;
  name: string;
  cadence: PlanCadence;
  price_cents: number;
  currency: string;
  features: unknown;
  recommended: boolean;
  active: boolean;
};

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "paused";

export type Subscription = {
  id: string;
  user_id: string;
  plan_key: string | null;
  billing_cadence: PlanCadence;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  provider: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentStatus = "paid" | "failed" | "refunded" | "pending";

export type PaymentRecord = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
};

// Narrow, file-scoped untyped accessor. The base client is fully typed for
// the known schema; we only loosen it for these three not-yet-in-snapshot
// tables. `unknown`-returning so each caller asserts the row shape it expects.
type UntypedTable = {
  select: (cols?: string) => UntypedQuery;
};
type UntypedQuery = {
  eq: (col: string, val: unknown) => UntypedQuery;
  in: (col: string, vals: unknown[]) => UntypedQuery;
  order: (col: string, opts?: { ascending?: boolean }) => UntypedQuery;
  range: (from: number, to: number) => UntypedQuery;
  limit: (n: number) => UntypedQuery;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  then: PromiseLike<{
    data: unknown;
    error: { message: string } | null;
    count: number | null;
  }>["then"];
};

function rawTable(name: string): UntypedTable {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(name) as UntypedTable;
}

/** Active plans for the paywall, cheapest-cadence first. */
export async function fetchActivePlans(): Promise<SubscriptionPlan[]> {
  const res = await rawTable("subscription_plans")
    .select(
      "plan_key, name, cadence, price_cents, currency, features, recommended, active",
    )
    .eq("active", true)
    .order("price_cents", { ascending: true });
  if (res.error) throw new Error(res.error.message);
  return (res.data as SubscriptionPlan[] | null) ?? [];
}

/** Caller's current subscription (or null when none / RLS-filtered). */
export async function fetchMySubscription(): Promise<Subscription | null> {
  const res = await rawTable("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as Subscription | null) ?? null;
}

export type PaymentPage = {
  rows: PaymentRecord[];
  total: number;
};

/** Owner payment history, newest first, 10/page (X-04 region 4). */
export async function fetchPaymentHistory(
  page: number,
  pageSize = 10,
): Promise<PaymentPage> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseBrowserClient();
  // count needs a separate option object only available on the typed builder;
  // use the loosened accessor with an explicit count select.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (supabase as any)
    .from("payment_history")
    .select("*", { count: "exact" })
    .order("paid_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  const res = (await builder) as {
    data: PaymentRecord[] | null;
    error: { message: string } | null;
    count: number | null;
  };
  if (res.error) throw new Error(res.error.message);
  return { rows: res.data ?? [], total: res.count ?? 0 };
}

/**
 * Render a price_cents value (KRW * 100 per seed) as a localized currency
 * string. KRW has no minor unit, so we divide by 100 then format whole won.
 */
export function formatPlanPrice(plan: SubscriptionPlan): string {
  const amount = plan.price_cents / 100;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: plan.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${plan.currency}`;
  }
}

export function formatAmountCents(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${currency}`;
  }
}

/** Drop the internal seed marker tag from a features jsonb array. */
const CADENCE_MONTHS: Record<PlanCadence, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const CADENCE_KO_LABELS: Record<PlanCadence, string> = {
  monthly: "월간",
  quarterly: "분기",
  yearly: "연간",
};

const DISCOUNT_FEATURE_RE = /^(월간|분기|연간)\s+\d+%\s*할인$/;

function discountFeatureLabel(
  plan: SubscriptionPlan,
  plans: SubscriptionPlan[],
): string | null {
  const months = CADENCE_MONTHS[plan.cadence];
  if (!months || months === 1) return null;

  const monthly = plans.find((candidate) => candidate.cadence === "monthly");
  if (!monthly || monthly.price_cents <= 0) return null;

  const baseline = monthly.price_cents * months;
  if (baseline <= plan.price_cents) return null;

  const discountPercent = Math.round(
    ((baseline - plan.price_cents) / baseline) * 100,
  );
  if (discountPercent <= 0) return null;

  return `${CADENCE_KO_LABELS[plan.cadence]} ${discountPercent}% 할인`;
}

export function planFeatureList(
  features: unknown,
  plan?: SubscriptionPlan,
  plans: SubscriptionPlan[] = [],
): string[] {
  if (!Array.isArray(features)) return [];
  const list = features
    .filter((f): f is string => typeof f === "string")
    .filter((f) => !f.startsWith("__seed"));
  const discountLabel =
    plan && plans.length > 0 ? discountFeatureLabel(plan, plans) : null;
  if (!discountLabel) return list;
  return list.map((feature) =>
    DISCOUNT_FEATURE_RE.test(feature) ? discountLabel : feature,
  );
}

// i18n: 이 모듈은 컴포넌트가 아니라 useTranslations를 쓸 수 없다(wave-2/3
// key-expose 선례). 결제 주기 라벨(월간/분기/연간)은 카탈로그 키 이름만
// 노출하고, 실제 문구는 렌더 컴포넌트가 t(`cadence.${key}`)로 해석한다.
const CADENCE_LABEL_KEYS: Record<PlanCadence, PlanCadence> = {
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

/**
 * Catalog sub-key for a billing cadence (e.g. "monthly"). The rendering shell
 * resolves it via its own `cadence.*` namespace. Falls back to the raw cadence
 * string for any unknown value so the caller still has a stable key.
 */
export function cadenceLabelKey(cadence: PlanCadence): string {
  return CADENCE_LABEL_KEYS[cadence] ?? cadence;
}
