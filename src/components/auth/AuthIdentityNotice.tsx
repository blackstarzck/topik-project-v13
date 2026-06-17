"use client";

import { Alert } from "antd";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { GOOGLE_LINKED_NOTICE } from "@/lib/auth/identity-linking";

export function AuthIdentityNotice() {
  const t = useTranslations("auth.identityNotice");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");

  useEffect(() => {
    if (notice !== GOOGLE_LINKED_NOTICE) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("notice");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [notice, pathname, router, searchParams]);

  if (notice !== GOOGLE_LINKED_NOTICE) return null;

  return (
    <Alert
      type="success"
      showIcon
      closable
      title={t("googleLinkedTitle")}
      description={t("googleLinkedDescription")}
      data-testid="auth-identity-notice"
    />
  );
}
