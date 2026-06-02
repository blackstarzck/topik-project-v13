import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/admin-guard";
import { AdminUsersConsole } from "@/components/admin/AdminUsersConsole";

export const metadata: Metadata = { title: "사용자 관리 — TALKPIK" };

export default async function AdminUsersPage() {
  await requirePlatformAdmin();
  return (
    <main style={{ padding: 24 }}>
      <h1>사용자 관리</h1>
      <p style={{ marginTop: 0, color: "rgba(0,0,0,0.65)" }}>
        사용자를 검색하고 권한과 상태를 관리합니다. 모든 변경은 이력에
        기록됩니다.
      </p>
      <AdminUsersConsole />
    </main>
  );
}
