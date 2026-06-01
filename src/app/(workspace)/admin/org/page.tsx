import type { Metadata } from "next";
import { requireOrgAdmin } from "@/lib/auth/admin-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOrgKpiCards } from "@/components/admin/AdminOrgKpiCards";
import { AdminOrgLoadError } from "@/components/admin/AdminOrgLoadError";
import {
  fromRpcRow,
  type AdminOrgDashboardData,
} from "@/lib/admin/org-dashboard";

export const metadata: Metadata = { title: "기관 관리 — TALKPIK" };

export default async function AdminOrgPage() {
  await requireOrgAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_admin_org_dashboard");
  // Graceful failure (description region 2 예외): render a recoverable
  // retry state instead of throwing into the hard error boundary.
  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>기관 관리</h1>
        <p style={{ marginTop: 0, color: "rgba(0,0,0,0.65)" }}>
          기관 학습 현황과 운영 지표를 관리합니다.
        </p>
        <AdminOrgLoadError />
      </main>
    );
  }
  const dash: AdminOrgDashboardData = fromRpcRow(data);
  return (
    <main style={{ padding: 24 }}>
      <h1>기관 관리</h1>
      <p style={{ marginTop: 0, color: "rgba(0,0,0,0.65)" }}>
        기관 학습 현황과 운영 지표를 관리합니다.
      </p>
      <AdminOrgKpiCards data={dash} />
    </main>
  );
}
