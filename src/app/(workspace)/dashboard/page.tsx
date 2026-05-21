import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "대시보드 — TALKPIK" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: goal } = await supabase
    .from("learning_goals")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) redirect("/onboarding/learning-goal");

  return (
    <PlaceholderPage
      iaCode="B-01"
      title="대시보드"
      phaseHint="학습 위젯과 진척 요약은 Phase 4에서 채워집니다."
    />
  );
}
