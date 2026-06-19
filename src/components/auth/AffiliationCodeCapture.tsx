"use client";

import { useEffect } from "react";

import {
  AFFILIATION_CODE_PARAM,
  captureAffiliationCodeFromSearch,
} from "@/lib/auth/affiliation-code";

export function AffiliationCodeCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(AFFILIATION_CODE_PARAM)) return;

    captureAffiliationCodeFromSearch(url.searchParams);
    url.searchParams.delete(AFFILIATION_CODE_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return null;
}
