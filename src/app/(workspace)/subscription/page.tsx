import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { SubscriptionShell } from "@/components/settings/SubscriptionShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscription");
  return { title: t("metaTitle") };
}

export default function SubscriptionPage() {
  return (
    <WorkspaceBody>
      <SubscriptionShell />
    </WorkspaceBody>
  );
}
