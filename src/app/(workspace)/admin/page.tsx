import type { Metadata } from "next";
import { AdminHub } from "@/components/admin/AdminHub";
import { ADMIN_ROLES, requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "관리 — TALKPIK" };

export default async function AdminIndexPage() {
  // Re-apply the same admin allowlist the layout guard uses (defense-in-depth).
  // requireRole returns the profile and redirects non-admins to /dashboard.
  const profile = await requireRole(ADMIN_ROLES);
  return (
    <main style={{ padding: 24 }}>
      <AdminHub role={profile.app_role} />
    </main>
  );
}
