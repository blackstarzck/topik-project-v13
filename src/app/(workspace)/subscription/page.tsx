import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { SubscriptionComingSoon } from "@/components/settings/SubscriptionComingSoon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscription");
  return { title: t("metaTitle") };
}

// 빌링 deferred 동안 `/subscription` 직접 진입은 동작하는 SubscriptionShell 대신
// "준비중" 안내를 중앙에 표시한다(사이드바에서는 이미 숨김). 정식 빌링 재오픈 시
// SubscriptionComingSoon을 SubscriptionShell로 되돌린다.
export default function SubscriptionPage() {
  return (
    <WorkspaceBody size="workspace">
      <SubscriptionComingSoon />
    </WorkspaceBody>
  );
}
