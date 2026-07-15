"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type PendingNavigation =
  | { kind: "href"; href: string }
  | { kind: "history" };

export type UnsavedChangesGuardOptions = {
  when: boolean;
  fallbackHref?: string;
};

export type UnsavedChangesGuard = {
  pendingNavigation: PendingNavigation | null;
  requestNavigation: (href?: string) => void;
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

  const requestNavigation = useCallback(
    (href = fallbackHref) => {
      const targetHref = typeof href === "string" ? href : fallbackHref;
      if (!whenRef.current) {
        router.push(targetHref);
        return;
      }
      setPendingNavigation({ kind: "href", href: targetHref });
    },
    [fallbackHref, router],
  );

  const cancelPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const proceedPendingNavigation = useCallback(() => {
    setPendingNavigation((pending) => {
      if (!pending) return null;
      if (pending.kind === "href") {
        router.push(pending.href);
      } else if (typeof window !== "undefined") {
        allowNextPopRef.current = true;
        sentinelPushedRef.current = false;
        window.history.go(-2);
      }
      return null;
    });
  }, [router]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
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
      setPendingNavigation({ kind: "href", href: toInternalHref(url) });
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  useEffect(() => {
    function onPopState() {
      if (allowNextPopRef.current) {
        allowNextPopRef.current = false;
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
  }, [router]);

  return {
    pendingNavigation,
    requestNavigation,
    cancelPendingNavigation,
    proceedPendingNavigation,
  };
}
