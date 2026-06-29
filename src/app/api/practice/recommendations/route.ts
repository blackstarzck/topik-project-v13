import { NextResponse } from "next/server";
import { isEmailVerified } from "@/lib/auth/access-gate";
import { fetchProfileStatus, isActiveStatus } from "@/lib/auth/profile";
import { queryRecommendationBundleForUser } from "@/lib/practice/recommendations";
import { isValidQuestionNo } from "@/lib/practice/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: "email_unverified" }, { status: 403 });
  }
  if (!isActiveStatus(await fetchProfileStatus(supabase, user.id))) {
    return NextResponse.json({ error: "account_inactive" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const parsedType = rawType == null ? null : Number(rawType);
  const questionNo =
    parsedType != null && isValidQuestionNo(parsedType) ? parsedType : null;

  const bundle = await queryRecommendationBundleForUser(user.id, questionNo);
  return NextResponse.json(bundle);
}
