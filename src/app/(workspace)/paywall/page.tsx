import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { PaywallShell } from "@/components/settings/PaywallShell";
import { resolvePaywallReturnTo } from "@/lib/paywall/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("paywall");
  return { title: t("metaTitle") };
}

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  const returnHref = resolvePaywallReturnTo(returnTo);

  return (
    <WorkspaceBody>
      <PaywallShell returnHref={returnHref} />
    </WorkspaceBody>
  );
}
