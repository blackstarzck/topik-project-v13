import type { Metadata } from "next";
import { requireOrgAdmin } from "@/lib/auth/admin-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOrgKpiCards } from "@/components/admin/AdminOrgKpiCards";
import {
  fromRpcRow,
  type AdminOrgDashboardData,
} from "@/lib/admin/org-dashboard";

export const metadata: Metadata = { title: "기관 관리 — TALKPIK" };

export default async function AdminOrgPage() {
  await requireOrgAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_admin_org_dashboard");
  if (error) throw new Error(`Admin org dashboard: ${error.message}`);
  const dash: AdminOrgDashboardData = fromRpcRow(data);
  return (
    <main style={{ padding: 24 }}>
      <h1>기관 관리</h1>
      <AdminOrgKpiCards data={dash} />
    </main>
  );
}
