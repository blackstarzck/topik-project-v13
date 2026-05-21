import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "문제 관리 — TALKPIK" };

export default async function AdminProblemsPage() {
  await requireRole(["content_admin", "platform_admin"]);
  return (
    <PlaceholderPage
      iaCode="H-01"
      title="문제 관리"
      phaseHint="콘텐츠 관리자용 CRUD는 Phase 6에서 채워집니다."
    />
  );
}
