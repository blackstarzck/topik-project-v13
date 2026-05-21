import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { ADMIN_ROLES, requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "관리 — TALKPIK" };

export default async function AdminIndexPage() {
  await requireRole(ADMIN_ROLES);
  return (
    <PlaceholderPage
      iaCode="admin"
      title="관리"
      phaseHint="좌측 사이드바에서 영역(문제 / 기관 / 사용자)을 선택하세요. 본격 관리 UI는 Phase 6에서 채워집니다."
    />
  );
}
