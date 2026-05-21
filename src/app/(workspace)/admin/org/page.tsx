import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "기관 관리 — TALKPIK" };

export default async function AdminOrgPage() {
  await requireRole(["org_admin", "platform_admin"]);
  return (
    <PlaceholderPage
      iaCode="X-08"
      title="기관 관리 대시보드"
      phaseHint="organization-admin 전용 대시보드는 Phase 6에서 채워집니다."
    />
  );
}
