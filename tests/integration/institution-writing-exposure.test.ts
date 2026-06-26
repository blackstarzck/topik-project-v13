import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";
type RpcResult = PromiseLike<{ data: unknown; error: unknown }>;
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => RpcResult;
};

describe.skipIf(!ENABLED)("institution writing exposure", () => {
  it("filters writing problems by the authenticated user's affiliation code", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const svc = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const exposureProbe = await svc
      .from("topik_writing_question_institution_exposure")
      .select("question_id")
      .limit(1);
    if (exposureProbe.error) {
      console.warn(
        "SKIP institution writing exposure integration: local stack does not include public.topik_writing_question_institution_exposure",
      );
      return;
    }

    const marker = `institution-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const problemIds: string[] = [];
    const questionIds = {
      public: `${marker}-public-q51`,
      kwon: `${marker}-kwon-q51`,
      lu: `${marker}-lu-q51`,
    };
    const userIds: string[] = [];

    async function makeUser(label: string, affiliationCode?: string) {
      const client = createClient(url, anonKey);
      const { data, error } = await client.auth.signUp({
        email: `${marker}-${label}@example.com`,
        password: "p@ssw0rd-strong-1234",
        options: {
          data: affiliationCode
            ? { affiliation_code: affiliationCode }
            : undefined,
        },
      });
      if (error) throw error;
      const id = data.user?.id;
      if (!id) throw new Error(`signup missing user id for ${label}`);
      userIds.push(id);
      return { client, id };
    }

    try {
      const general = await makeUser("general");
      const kwon = await makeUser("kwon", "PROFESSOR-KWON");
      const lu = await makeUser("lu", "PROFESSOR-LU");

      const rows = [
        makeProblemRow(marker, questionIds.public, 51, "Public"),
        makeProblemRow(marker, questionIds.kwon, 51, "Kwon"),
        makeProblemRow(marker, questionIds.lu, 51, "Lu"),
      ];
      const inserted = await svc.from("problems").insert(rows);
      if (inserted.error) throw inserted.error;
      problemIds.push(...rows.map((row) => row.id));

      const exposureInserted = await svc
        .from("topik_writing_question_institution_exposure")
        .insert([
          {
            question_id: questionIds.kwon,
            item_number: 51,
            institution_code: "PROFESSOR-KWON",
          },
          {
            question_id: questionIds.lu,
            item_number: 51,
            institution_code: "PROFESSOR-LU",
          },
        ]);
      if (exposureInserted.error) throw exposureInserted.error;

      await expectVisibleIds(general.client, problemIds, [rows[0].id]);
      await expectVisibleIds(kwon.client, problemIds, [rows[0].id, rows[1].id]);
      await expectVisibleIds(lu.client, problemIds, [rows[0].id, rows[2].id]);

      await expectListIds(general.client, marker, [rows[0].id]);
      await expectListIds(kwon.client, marker, [rows[0].id, rows[1].id]);
      await expectListIds(lu.client, marker, [rows[0].id, rows[2].id]);
    } finally {
      if (problemIds.length > 0) {
        await svc
          .from("topik_writing_question_institution_exposure")
          .delete()
          .in("question_id", Object.values(questionIds));
        await svc.from("problems").delete().in("id", problemIds);
      }
      for (const userId of userIds) {
        await svc.auth.admin.deleteUser(userId);
      }
    }
  });
});

function makeProblemRow(
  marker: string,
  questionId: string,
  questionNo: number,
  label: string,
) {
  return {
    id: randomUUID(),
    source: "curated",
    domain: "writing",
    question_no: questionNo,
    topik_level: 2,
    difficulty: 3,
    title: `Institution exposure ${marker} ${label}`,
    prompt: "다음 안내문을 읽고 알맞은 내용을 쓰십시오.",
    materials: { question_id: questionId },
    answer_key: null,
    rubric: {},
    tags: [marker, "institution-exposure"],
    publish_status: "published",
    review_status: "approved",
    visibility: "public",
    lifecycle_status: "active",
  };
}

async function expectVisibleIds(
  client: RpcClient,
  problemIds: string[],
  expected: string[],
) {
  const { data, error } = await client.rpc(
    "filter_visible_writing_problem_ids",
    {
      p_problem_ids: problemIds,
    },
  );
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ problem_id: string }>).map(
    (row) => row.problem_id,
  );
  expect(new Set(ids)).toEqual(new Set(expected));
}

async function expectListIds(
  client: RpcClient,
  marker: string,
  expected: string[],
) {
  const { data, error } = await client.rpc("list_user_problems", {
    filter: { domain: "writing", search: marker },
    sort: "newest",
    page: 1,
    page_size: 10,
  });
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ problem_id: string }>).map(
    (row) => row.problem_id,
  );
  expect(new Set(ids)).toEqual(new Set(expected));
}
