import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/learning/DashboardContent";
import { requireUser } from "@/lib/auth/session";
import { getDashboardKpi } from "@/lib/learning/kpi";
import { getLearningGoal } from "@/lib/learning/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "대시보드 — TALKPIK" };

export default async function DashboardPage() {
  const user = await requireUser();
  const goal = await getLearningGoal(user.id);
  if (!goal) redirect("/onboarding/learning-goal");
  const supabase = await createSupabaseServerClient();
  const kpi = await getDashboardKpi(user.id, supabase);
  return <DashboardContent goal={goal} kpi={kpi} />;
}
