"use client";

import { useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  AFFILIATION_CODE_PARAM,
  captureAffiliationCodeFromSearch,
} from "@/lib/auth/affiliation-code";
import { sanitizeNext } from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";

export function AffiliationCodeCapture() {
  const pathname = usePathname();
  const router = useRouter();

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(AFFILIATION_CODE_PARAM)) return;

    const capturedCode = captureAffiliationCodeFromSearch(url.searchParams);
    const nextPath = sanitizeNext(url.searchParams.get("next"), "");
    url.searchParams.delete(AFFILIATION_CODE_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    if (capturedCode && pathname !== APP_ROUTES.authInstitutionInvite) {
      const inviteUrl = new URL(APP_ROUTES.authInstitutionInvite, url.origin);
      if (nextPath) {
        inviteUrl.searchParams.set("next", nextPath);
      }
      router.replace(`${inviteUrl.pathname}${inviteUrl.search}`);
    }
  }, [pathname, router]);

  return null;
}
