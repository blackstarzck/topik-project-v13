import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/admin-guard";
import { listAdminUsers } from "@/lib/admin/server";
import { AdminUserTable } from "@/components/admin/AdminUserTable";

export const metadata: Metadata = { title: "사용자 관리 — TALKPIK" };

export default async function AdminUsersPage() {
  await requirePlatformAdmin();
  const initialRows = await listAdminUsers({});
  return (
    <main style={{ padding: 24 }}>
      <h1>사용자 관리</h1>
      <p style={{ marginTop: 0, color: "rgba(0,0,0,0.65)" }}>
        사용자를 검색하고 권한과 상태를 변경합니다.
      </p>
      <AdminUserTable initialRows={initialRows} />
    </main>
  );
}
