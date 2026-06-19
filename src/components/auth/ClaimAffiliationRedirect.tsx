"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { claimStoredAffiliationCode } from "@/lib/auth/affiliation-code";

type ClaimAffiliationRedirectProps = {
  nextPath: string;
};

export function ClaimAffiliationRedirect({
  nextPath,
}: ClaimAffiliationRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function claimAndContinue() {
      try {
        await claimStoredAffiliationCode();
      } finally {
        if (active) {
          router.replace(nextPath);
        }
      }
    }

    void claimAndContinue();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  return (
    <p className="sr-only" aria-live="polite">
      기관 회원 정보를 확인하는 중입니다.
    </p>
  );
}
