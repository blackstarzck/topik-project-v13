import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getNextProblemBundle } from "@/lib/practice/next";
import { NextProblemView } from "@/components/practice/NextProblemView";

export const metadata: Metadata = { title: "다음 문제 — TALKPIK" };

export default async function PracticeNextPage() {
  const user = await requireUser();
  const bundle = await getNextProblemBundle(user.id);
  return (
    <main style={{ padding: 24 }}>
      <h1>다음 문제</h1>
      <NextProblemView bundle={bundle} />
    </main>
  );
}
