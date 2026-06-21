"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

/**
 * X-04 구독 관리 — 준비중 안내.
 *
 * 빌링은 deferred scope라 구독 관리 화면을 사이드바에서 숨겼고, 검색창/딥링크로
 * `/subscription`에 직접 진입하면 동작하는 shell 대신 "준비중" 안내를 페이지
 * 컨테이너 중앙에 보여준다. 중앙 정렬 컨테이너 + antd `<Result>` 패턴은
 * `AppNotFound`와 동일하게 재활용한다. 실제 SubscriptionShell 구현은 빌링
 * 재오픈 대비 `SubscriptionShell.tsx`에 보존한다.
 */
export function SubscriptionComingSoon() {
  const t = useTranslations("subscription.comingSoon");
  return (
    <div
      data-testid="subscription-coming-soon"
      className="flex min-h-full flex-1 items-center justify-center p-6"
    >
      <Result
        status="info"
        title={t("title")}
        subTitle={t("subTitle")}
        extra={
          <Link href="/dashboard">
            <Button type="primary">{t("backToDashboard")}</Button>
          </Link>
        }
      />
    </div>
  );
}
