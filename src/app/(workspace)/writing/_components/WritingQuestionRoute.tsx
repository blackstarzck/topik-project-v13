import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WritingPageContent } from "@/components/writing/WritingPageContent";
import type { ProblemAsset } from "@/components/writing/ReferenceMaterials";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveDraft, getWritingProblem } from "@/lib/writing/server";
import type { QuestionNo } from "@/lib/writing/types";

export type WritingQuestionSearchParams = Promise<{
  problem?: string;
  fresh?: string;
}>;

export async function generateWritingQuestionMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.page");
  return { title: t("metaTitle") };
}

const PROBLEM_ASSETS_BUCKET = "problem-assets";

async function loadProblemExtras(problemId: string): Promise<{
  assets: ProblemAsset[];
}> {
  const supabase = await createSupabaseServerClient();
  const assetsRes = await supabase
    .from("problem_assets")
    .select("id, storage_path, asset_type, sort_order")
    .eq("problem_id", problemId)
    .order("sort_order", { ascending: true });

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
  };
}

export async function renderWritingQuestionPage(
  questionNo: QuestionNo,
  searchParams: WritingQuestionSearchParams,
) {
  const user = await requireUser();
  const { problem: problemId, fresh } = await searchParams;
  const problem = await getWritingProblem(questionNo, problemId);
  const startFresh = fresh === "1";
  const draft =
    problem && !startFresh ? await getActiveDraft(user.id, problem.id) : null;
  const extras = problem
    ? await loadProblemExtras(problem.id)
    : { assets: [] };

  return (
    <WritingPageContent
      questionNo={questionNo}
      userId={user.id}
      problem={problem}
      draft={draft}
      assets={extras.assets}
    />
  );
}
