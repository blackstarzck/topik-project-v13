import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { queryRecommendationBundleForUser } from "@/lib/practice/recommendations";
import { isValidQuestionNo } from "@/lib/practice/types";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const parsedType = rawType == null ? null : Number(rawType);
  const questionNo =
    parsedType != null && isValidQuestionNo(parsedType) ? parsedType : null;

  const bundle = await queryRecommendationBundleForUser(user.id, questionNo);
  return NextResponse.json(bundle);
}
