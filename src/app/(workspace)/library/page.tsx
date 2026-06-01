import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listLibraryItems } from "@/lib/library/server";
import { parseLibraryTab } from "@/components/library/library-tab-url";
import { LibraryTabs } from "@/components/library/LibraryTabs";

export const metadata: Metadata = { title: "내 서재 — TALKPIK" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function LibraryPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;
  const activeTab = parseLibraryTab(sp.tab);
  const initialItems = await listLibraryItems(user.id, activeTab);
  return (
    <main style={{ padding: 24 }}>
      <h1>내 서재</h1>
      <LibraryTabs activeTab={activeTab} initialItems={initialItems} />
    </main>
  );
}
