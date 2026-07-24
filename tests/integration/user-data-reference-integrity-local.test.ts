import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";
import type { Json } from "../../src/lib/supabase/types";

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

if (ENABLED) {
  assertLocalPrivilegedMutationTarget(process.env);
}

describe.skipIf(!ENABLED)("user data reference integrity (local stack)", () => {
  it("allows learner state updates but rejects reference retargeting and foreign review items", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const service = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const users: string[] = [];
    let caughtError: unknown;

    async function makeUser(label: string) {
      const client = createClient(url, publicKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await client.auth.signUp({
        email: `reference-${label}-${randomUUID()}@example.com`,
        password: `Local-${randomUUID()}-Aa1!`,
      });
      if (error || !data.user) throw error ?? new Error("signup failed");
      users.push(data.user.id);
      return { client, userId: data.user.id };
    }

    try {
      const a = await makeUser("a");
      const b = await makeUser("b");
      const aExportId = randomUUID();
      const bExportId = randomUUID();
      const aItemId = randomUUID();
      const bItemId = randomUUID();
      const recommendationRunId = randomUUID();
      const recommendationItemId = randomUUID();

      const { data: problem, error: problemError } = await service
        .from("problems")
        .select("id")
        .limit(1)
        .single();
      if (problemError || !problem) {
        throw problemError ?? new Error("local problem fixture missing");
      }

      const { error: fixtureError } = await service
        .from("export_files")
        .insert([
          {
            id: aExportId,
            user_id: a.userId,
            source_type: "library_selection",
            source_id: null,
            storage_path: `local/${aExportId}.pdf`,
            status: "queued",
          },
          {
            id: bExportId,
            user_id: b.userId,
            source_type: "library_selection",
            source_id: null,
            storage_path: `local/${bExportId}.pdf`,
            status: "queued",
          },
        ]);
      if (fixtureError) throw fixtureError;

      const { error: itemFixtureError } = await service
        .from("library_items")
        .insert([
          {
            id: aItemId,
            user_id: a.userId,
            item_type: "export",
            export_id: aExportId,
            tags: [],
          },
          {
            id: bItemId,
            user_id: b.userId,
            item_type: "export",
            export_id: bExportId,
            tags: [],
          },
        ]);
      if (itemFixtureError) throw itemFixtureError;

      const { error: recommendationFixtureError } = await service
        .from("recommendation_runs")
        .insert({
          id: recommendationRunId,
          user_id: a.userId,
          source_type: "dashboard",
        });
      if (recommendationFixtureError) throw recommendationFixtureError;
      const { error: recommendationItemFixtureError } = await service
        .from("recommendation_items")
        .insert({
          id: recommendationItemId,
          run_id: recommendationRunId,
          user_id: a.userId,
          problem_id: problem.id,
          rank: 1,
          reason: "local fixture",
          status: "active",
        });
      if (recommendationItemFixtureError) {
        throw recommendationItemFixtureError;
      }

      const allowedTags = await a.client
        .from("library_items")
        .update({ tags: ["review"] })
        .eq("id", aItemId)
        .select("id, tags")
        .single();
      expect(allowedTags.error).toBeNull();
      expect(allowedTags.data?.tags).toEqual(["review"]);

      const forbiddenRetarget = await a.client
        .from("library_items")
        .update({ export_id: bExportId })
        .eq("id", aItemId);
      expect(forbiddenRetarget.error).not.toBeNull();

      const allowedExportState = await a.client
        .from("export_files")
        .update({
          storage_path: `local/${aExportId}-ready.pdf`,
          status: "ready",
          ready_at: new Date().toISOString(),
        })
        .eq("id", aExportId);
      expect(allowedExportState.error).toBeNull();

      const forbiddenExportSource = await a.client
        .from("export_files")
        .update({ source_id: bExportId })
        .eq("id", aExportId);
      expect(forbiddenExportSource.error).not.toBeNull();

      const allowedRecommendationState = await a.client
        .from("recommendation_items")
        .update({ status: "consumed" })
        .eq("id", recommendationItemId);
      expect(allowedRecommendationState.error).toBeNull();

      const forbiddenRecommendationReason = await a.client
        .from("recommendation_items")
        .update({ reason: "retargeted" })
        .eq("id", recommendationItemId);
      expect(forbiddenRecommendationReason.error).not.toBeNull();

      async function expectReviewSetRejected(payload: Json) {
        const result = await a.client.from("study_events").insert({
          user_id: a.userId,
          event_type: "review_set_created",
          payload,
        });
        expect(result.error?.message).toMatch(
          /invalid_review_set_(payload|items)/,
        );
        expect(result.error?.message).not.toContain(aItemId);
        expect(result.error?.message).not.toContain(bItemId);
      }

      const validReviewSet = await a.client
        .from("study_events")
        .insert({
          user_id: a.userId,
          event_type: "review_set_created",
          payload: { item_ids: [aItemId], count: 1 },
        })
        .select("id")
        .single();
      expect(validReviewSet.error).toBeNull();

      await expectReviewSetRejected("not-an-object");
      await expectReviewSetRejected({ item_ids: [aItemId] });
      await expectReviewSetRejected({ item_ids: [], count: 0 });
      await expectReviewSetRejected({ item_ids: [123], count: 1 });
      await expectReviewSetRejected({ item_ids: ["not-a-uuid"], count: 1 });
      await expectReviewSetRejected({
        item_ids: [aItemId, aItemId],
        count: 2,
      });
      await expectReviewSetRejected({ item_ids: [aItemId], count: 2 });
      await expectReviewSetRejected({
        item_ids: [aItemId, bItemId],
        count: 2,
      });

      if (!validReviewSet.data) {
        throw new Error("valid review set id missing");
      }
      const foreignReviewSetUpdate = await service
        .from("study_events")
        .update({
          payload: { item_ids: [aItemId, bItemId], count: 2 },
        })
        .eq("id", validReviewSet.data.id);
      expect(foreignReviewSetUpdate.error?.message).toContain(
        "invalid_review_set_items",
      );
      expect(foreignReviewSetUpdate.error?.message).not.toContain(bItemId);

      const malformedReviewSetUpdate = await service
        .from("study_events")
        .update({ payload: { item_ids: [], count: 0 } })
        .eq("id", validReviewSet.data.id);
      expect(malformedReviewSetUpdate.error?.message).toContain(
        "invalid_review_set_payload",
      );
      expect(malformedReviewSetUpdate.error?.message).not.toContain(aItemId);

      const unrelatedEventId = randomUUID();
      const unrelatedInsert = await service.from("study_events").insert({
        id: unrelatedEventId,
        user_id: a.userId,
        event_type: "practice_started",
        payload: "payload-shape-is-not-a-review-set",
      });
      expect(unrelatedInsert.error).toBeNull();

      const unrelatedUpdate = await service
        .from("study_events")
        .update({ payload: { arbitrary: true } })
        .eq("id", unrelatedEventId);
      expect(unrelatedUpdate.error).toBeNull();
    } catch (testError) {
      caughtError = testError;
      throw testError;
    } finally {
      const cleanupErrors: unknown[] = [];
      for (const userId of users) {
        const { error } = await service.auth.admin.deleteUser(userId);
        if (error) cleanupErrors.push(error);
      }
      if (cleanupErrors.length > 0 && !caughtError) {
        throw new AggregateError(cleanupErrors, "local cleanup failed");
      }
    }
  }, 60_000);
});
