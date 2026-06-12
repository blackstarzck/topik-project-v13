"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  redirectTo?: string;
};

/**
 * Keeps authenticated users out of the login/sign-up forms even when the page is
 * restored from the browser back-forward cache after an OAuth round-trip.
 */
export function AuthEntrySessionGuard({ redirectTo = "/dashboard" }: Props) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function redirectIfAuthenticated() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!cancelled && user) {
          router.replace(redirectTo);
        }
      } catch (error) {
        console.warn("[auth-entry-session-guard] session check failed", error);
      }
    }

    void redirectIfAuthenticated();

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void redirectIfAuthenticated();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [redirectTo, router]);

  return null;
}
