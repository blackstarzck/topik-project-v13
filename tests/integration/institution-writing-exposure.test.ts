import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // CI can provide env vars directly; local runs may intentionally skip.
  }
}

loadEnvLocal();

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";
const HAS_SUPABASE_ENV = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (ENABLED && HAS_SUPABASE_ENV) {
  assertLocalPrivilegedMutationTarget(process.env);
}

type RpcResult = PromiseLike<{ data: unknown; error: unknown }>;
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => RpcResult;
};

describe.skipIf(!ENABLED || !HAS_SUPABASE_ENV)(
  "institution writing exposure",
  () => {
    it("keeps the full writing pool for non-institution users and filters institution users by affiliation code", async () => {
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
        const unassigned = await makeUser("unassigned", "PROFESSOR-NO-MAP");

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

        await expectVisibleIds(general.client, problemIds, [
          rows[0].id,
          rows[1].id,
          rows[2].id,
        ]);
        await expectVisibleIds(kwon.client, problemIds, [rows[1].id]);
        await expectVisibleIds(lu.client, problemIds, [rows[2].id]);
        await expectVisibleIds(unassigned.client, problemIds, []);

        await expectListIds(general.client, marker, [
          rows[0].id,
          rows[1].id,
          rows[2].id,
        ]);
        await expectListIds(kwon.client, marker, [rows[1].id]);
        await expectListIds(lu.client, marker, [rows[2].id]);
        await expectListIds(unassigned.client, marker, []);

        await expectExternalSubmissionBlocked(svc, unassigned.id, rows[0].id);
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
  },
);

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

async function expectExternalSubmissionBlocked(
  svc: RpcClient,
  userId: string,
  problemId: string,
) {
  const { error } = await svc.rpc("create_external_writing_submission", {
    submission: {
      external_submission_id: randomUUID(),
      user_id: userId,
      problem_id: problemId,
      question_no: 51,
      answer_text: "기관 배정이 없는 사용자의 제출은 차단되어야 합니다.",
      answer_json: null,
      char_count: 26,
      feedback_status: "analyzing",
    },
  });

  expect(error).toBeTruthy();
  expect(
    String((error as { message?: string } | null)?.message ?? ""),
  ).toContain("problem_not_submittable");
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
