import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WritingPageContent } from "@/components/writing/WritingPageContent";
import type { ProblemAsset } from "@/components/writing/ReferenceMaterials";
import type { ProblemRubric } from "@/components/writing/ConditionsPanel";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveDraft, getWritingProblem } from "@/lib/writing/server";
import { isQuestionNo } from "@/lib/writing/types";

export const metadata: Metadata = { title: "쓰기 — TALKPIK" };

const PROBLEM_ASSETS_BUCKET = "problem-assets";

/**
 * D-01..D-04 §3 참고 이미지 — problem_assets 를 public 버킷 URL 로 변환.
 * 버킷 problem-assets 는 public read 정책(20260520121300_storage_policies.sql).
 */
async function loadProblemExtras(problemId: string): Promise<{
  assets: ProblemAsset[];
  rubric: ProblemRubric;
}> {
  const supabase = await createSupabaseServerClient();
  const [assetsRes, problemRes] = await Promise.all([
    supabase
      .from("problem_assets")
      .select("id, storage_path, asset_type, sort_order")
      .eq("problem_id", problemId)
      .order("sort_order", { ascending: true }),
    supabase.from("problems").select("rubric").eq("id", problemId).maybeSingle(),
  ]);

  const assets: ProblemAsset[] = (assetsRes.data ?? []).map((a) => {
    const { data: pub } = supabase.storage
      .from(PROBLEM_ASSETS_BUCKET)
      .getPublicUrl(a.storage_path);
    return {
      id: a.id,
      url: pub.publicUrl,
      assetType: a.asset_type,
      storagePath: a.storage_path,
    };
  });

  return {
    assets,
    rubric: (problemRes.data?.rubric ?? null) as ProblemRubric,
  };
}

export default async function WritingQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ problem?: string; fresh?: string }>;
}) {
  const { questionId } = await params;
  const qn = Number(questionId);
  if (!isQuestionNo(qn)) notFound();
  const user = await requireUser();
  const { problem: problemId, fresh } = await searchParams;
  const problem = await getWritingProblem(qn, problemId);
  // C-03 재풀이 모드 "새 답안으로 시작" (fresh=1): 저장된 draft를 불러오지 않고
  // 빈 에디터로 시작. fresh 미지정이면 기존 작성 내용을 이어서 로드한다.
  const startFresh = fresh === "1";
  const draft =
    problem && !startFresh ? await getActiveDraft(user.id, problem.id) : null;
  const extras = problem
    ? await loadProblemExtras(problem.id)
    : { assets: [], rubric: null };
  return (
    <WritingPageContent
      questionNo={qn}
      userId={user.id}
      problem={problem}
      draft={draft}
      assets={extras.assets}
      rubric={extras.rubric}
    />
  );
}
