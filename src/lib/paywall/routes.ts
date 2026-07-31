import { resolveSafeInternalReturnTo } from "@/lib/navigation/return-to";
import { APP_ROUTES } from "@/lib/routes";

export const PAYWALL_RETURN_FALLBACK = APP_ROUTES.dashboard;

export function resolvePaywallReturnTo(
  value: string | string[] | null | undefined,
): string {
  return resolveSafeInternalReturnTo(value, {
    fallback: PAYWALL_RETURN_FALLBACK,
    isAllowedPathname: (pathname) => pathname === APP_ROUTES.practiceNext,
  });
}

export function paywallHref({
  returnTo,
}: { returnTo?: string | null } = {}): string {
  if (!returnTo) return APP_ROUTES.paywall;

  const resolvedReturnTo = resolvePaywallReturnTo(returnTo);
  if (resolvedReturnTo === PAYWALL_RETURN_FALLBACK) {
    return APP_ROUTES.paywall;
  }

  const searchParams = new URLSearchParams({ returnTo: resolvedReturnTo });
  return `${APP_ROUTES.paywall}?${searchParams.toString()}`;
}
