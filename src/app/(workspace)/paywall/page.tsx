import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PaywallShell } from "@/components/settings/PaywallShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("paywall");
  return { title: t("metaTitle") };
}

export default function PaywallPage() {
  return <PaywallShell />;
}
