"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { APP_ROUTES } from "@/lib/routes";

type ClaimAffiliationRedirectProps = {
  nextPath: string;
};

export function ClaimAffiliationRedirect({
  nextPath,
}: ClaimAffiliationRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams({ next: nextPath });
    router.replace(`${APP_ROUTES.authInstitutionInvite}?${params.toString()}`);
  }, [nextPath, router]);

  return (
    <p className="sr-only" aria-live="polite">
      기관 소속 초대 확인 화면으로 이동하는 중입니다.
    </p>
  );
}
