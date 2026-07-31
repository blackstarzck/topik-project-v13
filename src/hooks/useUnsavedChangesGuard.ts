"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type NavigationMode = "push" | "replace";

export type PendingNavigation =
  | { kind: "href"; href: string; mode: NavigationMode }
  | { kind: "history" };

export type NavigationOptions = {
  mode?: NavigationMode;
};

export type UnsavedChangesGuardOptions = {
  when: boolean;
  fallbackHref?: string;
};

export type UnsavedChangesGuard = {
  pendingNavigation: PendingNavigation | null;
  requestNavigation: (href?: string, options?: NavigationOptions) => void;
  cancelPendingNavigation: () => void;
  proceedPendingNavigation: () => void;
};

const HISTORY_SENTINEL_STATE = { __writingUnsavedChangesGuard: true };

function toInternalHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useUnsavedChangesGuard({
  when,
  fallbackHref = "/practice/problems",
}: UnsavedChangesGuardOptions): UnsavedChangesGuard {
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const whenRef = useRef(when);
  const currentHrefRef = useRef<string | null>(null);
  const settledHrefRef = useRef<string | null>(null);
  const scheduledHrefNavigationRef = useRef<{
    href: string;
    mode: NavigationMode;
  } | null>(null);
  const allowDocumentNavigationRef = useRef(false);
  const allowNextPopRef = useRef(false);
  const sentinelPushedRef = useRef(false);

  useLayoutEffect(() => {
    whenRef.current = when;
    if (typeof window === "undefined") return;

    if (when && !sentinelPushedRef.current) {
      currentHrefRef.current = window.location.href;
      window.history.pushState(
        HISTORY_SENTINEL_STATE,
        "",
        window.location.href,
      );
      sentinelPushedRef.current = true;
      return;
    }

    if (!when && sentinelPushedRef.current) {
      settledHrefRef.current = window.location.href;
      allowNextPopRef.current = true;
      sentinelPushedRef.current = false;
      window.history.back();
    }
  }, [when]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    currentHrefRef.current = window.location.href;
  }, []);

  const navigateToHref = useCallback(
    (href: string, mode: NavigationMode) => {
      if (mode === "replace") {
        if (typeof window !== "undefined") {
          const targetUrl = new URL(href, window.location.href);
          if (targetUrl.origin === window.location.origin && targetUrl.hash) {
            // Next's segment cache can append a cached hash to the requested
            // hash when revisiting a route, producing `#hash#hash`. A document
            // replace keeps the semantic replace contract without duplicating
            // the fragment.
            allowDocumentNavigationRef.current = true;
            window.location.replace(toInternalHref(targetUrl));
            return;
          }
        }
        router.replace(href);
        return;
      }
      router.push(href);
    },
    [router],
  );

  const requestNavigation = useCallback(
    (href = fallbackHref, options: NavigationOptions = {}) => {
      const targetHref = typeof href === "string" ? href : fallbackHref;
      const mode = options.mode ?? "push";
      if (!whenRef.current) {
        navigateToHref(targetHref, mode);
        return;
      }
      setPendingNavigation({ kind: "href", href: targetHref, mode });
    },
    [fallbackHref, navigateToHref],
  );

  const cancelPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const proceedPendingNavigation = useCallback(() => {
    if (!pendingNavigation) return;
    setPendingNavigation(null);

    if (pendingNavigation.kind === "href") {
      if (typeof window !== "undefined" && sentinelPushedRef.current) {
        scheduledHrefNavigationRef.current = pendingNavigation;
        allowNextPopRef.current = true;
        sentinelPushedRef.current = false;
        window.history.back();
      } else {
        navigateToHref(pendingNavigation.href, pendingNavigation.mode);
      }
    } else if (typeof window !== "undefined") {
      const historyDelta = sentinelPushedRef.current ? -2 : -1;
      allowNextPopRef.current = true;
      sentinelPushedRef.current = false;
      window.history.go(historyDelta);
    }
  }, [navigateToHref, pendingNavigation]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (allowDocumentNavigationRef.current) return;
      if (!whenRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!whenRef.current) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({
        kind: "href",
        href: toInternalHref(url),
        mode: "push",
      });
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  useEffect(() => {
    function onPopState() {
      if (allowNextPopRef.current) {
        allowNextPopRef.current = false;
        const scheduledNavigation = scheduledHrefNavigationRef.current;
        scheduledHrefNavigationRef.current = null;
        if (scheduledNavigation) {
          navigateToHref(scheduledNavigation.href, scheduledNavigation.mode);
          currentHrefRef.current = window.location.href;
          return;
        }
        const settledHref = settledHrefRef.current;
        settledHrefRef.current = null;
        if (settledHref && settledHref !== window.location.href) {
          const target = toInternalHref(new URL(settledHref));
          router.replace(target, { scroll: false });
          currentHrefRef.current = settledHref;
        } else {
          currentHrefRef.current = window.location.href;
        }
        return;
      }
      if (!whenRef.current) return;

      const currentHref = currentHrefRef.current;
      if (currentHref) {
        window.history.pushState(HISTORY_SENTINEL_STATE, "", currentHref);
        sentinelPushedRef.current = true;
      }
      setPendingNavigation({ kind: "history" });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigateToHref, router]);

  return {
    pendingNavigation,
    requestNavigation,
    cancelPendingNavigation,
    proceedPendingNavigation,
  };
}
