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
      <AdminUserTable initialRows={initialRows} />
    </main>
  );
}
