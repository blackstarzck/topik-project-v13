import { describe, expect, it } from "vitest";

/**
 * 중복 제출 방지(draft 단위) 통합 테스트 — Supabase CLI 로컬 스택 대상.
 *
 * 마이그레이션 20260619150000_writing_submission_draft_dedup.sql 의
 *   - partial unique index `writing_submissions_draft_active_unique`
 *   - `create_external_writing_submission` 멱등화(select-before-insert + 23505 catch-and-reselect)
 * 가 다음을 보장하는지 검증한다.
 *   A. 같은 draft 재제출 → 같은 submission id 멱등 반환, 활성 row 1건.
 *   B. 새 draft(재응시) → 별개 submission 생성 허용.
 *   C. failed 후 같은 draft 재시도 → analyzing 새 row 허용(영구 failed 고착 없음).
 *   D. 같은 draft로 활성 row 2건 직접 INSERT → partial unique index가 23505로 거부.
 *
 * `SUPABASE_LOCAL_STACK !== "1"` 이면 skip. 로컬 실행:
 *
 *     supabase start
 *     supabase db reset
 *     SUPABASE_LOCAL_STACK=1 \
 *       NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
 *       SUPABASE_SERVICE_ROLE_KEY=... \
 *       pnpm vitest run tests/integration/writing-submission-dedup.test.ts
 */

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

describe.skipIf(!ENABLED)("writing submission dedup (draft-level)", () => {
  it("dedups same-draft resubmits, allows new-draft re-attempts and failed retries", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anon = createClient(url, anonKey);
    const svc = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) 사용자 생성(트리거가 profiles row 생성).
    const email = `dedup+${Date.now()}@example.com`;
    const { data: signUp, error: signUpErr } = await anon.auth.signUp({
      email,
      password: "p@ssw0rd-strong-1234",
    });
    if (signUpErr) throw signUpErr;
    const userId = signUp.user?.id;
    if (!userId) throw new Error("signup did not return a user id");

    // 2) 제출 가능한 writing 문제(published/public/active, q51) 시드.
    const problemId = crypto.randomUUID();
    const { error: probErr } = await svc.from("problems").insert({
      id: problemId,
      source: "curated",
      domain: "writing",
      question_no: 51,
      topik_level: 2,
      difficulty: 2,
      title: "dedup test 51",
      prompt: "다음 빈칸에 알맞은 말을 쓰십시오.",
      materials: null,
      tags: ["dedup_test"],
      publish_status: "published",
      review_status: "approved",
      visibility: "public",
      lifecycle_status: "active",
    });
    if (probErr) throw probErr;

    async function insertDraft(): Promise<string> {
      const id = crypto.randomUUID();
      const { error } = await svc.from("writing_drafts").insert({
        id,
        user_id: userId,
        problem_id: problemId,
        question_no: 51,
        answer_text: "답안 내용입니다.",
        char_count: 8,
        autosave_status: "clean",
      });
      if (error) throw error;
      return id;
    }

    async function submit(
      draftId: string,
      status: "analyzing" | "failed",
    ): Promise<string> {
      const { data, error } = await svc.rpc(
        "create_external_writing_submission",
        {
          submission: {
            external_submission_id: crypto.randomUUID(),
            user_id: userId,
            problem_id: problemId,
            draft_id: draftId,
            question_no: 51,
            answer_text: "답안 내용입니다.",
            char_count: 8,
            feedback_status: status,
          },
        } as never,
      );
      if (error) throw error;
      return data as unknown as string;
    }

    async function nonFailedCount(draftId: string): Promise<number> {
      const { data, error } = await svc
        .from("writing_submissions")
        .select("id")
        .eq("draft_id", draftId)
        .neq("feedback_status", "failed");
      if (error) throw error;
      return (data ?? []).length;
    }

    // A) 같은 draft 재제출 → 멱등 반환 + 활성 row 1건.
    const draftA = await insertDraft();
    const r1 = await submit(draftA, "analyzing");
    const r2 = await submit(draftA, "analyzing");
    expect(r2).toBe(r1);
    expect(await nonFailedCount(draftA)).toBe(1);

    // B) 새 draft(재응시) → 별개 submission 허용. (draftA는 제출로 superseded됨)
    const draftB = await insertDraft();
    const r3 = await submit(draftB, "analyzing");
    expect(r3).not.toBe(r1);
    expect(await nonFailedCount(draftB)).toBe(1);

    // C) failed 후 같은 draft 재시도 → analyzing 새 row 허용.
    const draftC = await insertDraft();
    const r4 = await submit(draftC, "failed");
    const r5 = await submit(draftC, "analyzing");
    expect(r5).not.toBe(r4);
    expect(await nonFailedCount(draftC)).toBe(1);

    // D) 같은 draft 활성 row 2건 직접 INSERT → partial unique index 23505 거부.
    const draftD = await insertDraft();
    const baseRow = {
      user_id: userId,
      problem_id: problemId,
      draft_id: draftD,
      question_no: 51,
      answer_text: "x",
      char_count: 1,
      feedback_status: "analyzing",
    };
    const { error: ins1 } = await svc
      .from("writing_submissions")
      .insert({ id: crypto.randomUUID(), ...baseRow });
    if (ins1) throw ins1;
    const { error: ins2 } = await svc
      .from("writing_submissions")
      .insert({ id: crypto.randomUUID(), ...baseRow });
    expect(ins2).not.toBeNull();
    expect((ins2 as { code?: string } | null)?.code).toBe("23505");
  });
});
