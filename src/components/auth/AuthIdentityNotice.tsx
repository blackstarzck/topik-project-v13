"use client";

import { App } from "antd";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { GOOGLE_LINKED_NOTICE } from "@/lib/auth/identity-linking";

export function AuthIdentityNotice() {
  const t = useTranslations("auth.identityNotice");
  const { notification } = App.useApp();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const searchParamString = searchParams.toString();

  useEffect(() => {
    if (notice !== GOOGLE_LINKED_NOTICE) return;
    notification.success({
      key: GOOGLE_LINKED_NOTICE,
      title: t("googleLinkedTitle"),
      description: t("googleLinkedDescription"),
    });

    const nextParams = new URLSearchParams(searchParamString);
    nextParams.delete("notice");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [notice, notification, pathname, router, searchParamString, t]);

  return null;
}
