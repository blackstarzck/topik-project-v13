import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "사용자 관리 — TALKPIK" };

export default async function AdminUsersPage() {
  await requireRole(["platform_admin"]);
  return (
    <PlaceholderPage
      iaCode="X-10"
      title="사용자 관리"
      phaseHint="플랫폼 관리자용 사용자 CRUD는 Phase 6에서 채워집니다."
    />
  );
}
