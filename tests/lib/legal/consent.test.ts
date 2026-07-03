import { describe, expect, it } from "vitest";

import {
  backfillOAuthDisplayName,
  generateRandomNickname,
  getMissingRequiredConsentDocuments,
  recordRequiredConsents,
  type RequiredConsentDocument,
} from "../../../src/lib/legal/consent";

type Row = Record<string, unknown>;

function applyFilters(
  rows: Row[],
  filters: Array<[string, unknown]>,
  inFilters: Array<[string, unknown[]]>,
) {
  return rows.filter((row) => {
    const eqMatch = filters.every(([key, value]) => row[key] === value);
    const inMatch = inFilters.every(([key, values]) =>
      values.includes(row[key]),
    );
    return eqMatch && inMatch;
  });
}

function makeClient(db: {
  legalDocuments?: Row[];
  userConsents?: Row[];
  profile?: Row | null;
  inserts?: Row[][];
  updates?: Row[];
}) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const inFilters: Array<[string, unknown[]]> = [];
      let patch: Row | null = null;

      const query = {
        select: () => query,
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        in(key: string, values: unknown[]) {
          inFilters.push([key, values]);
          return query;
        },
        update(nextPatch: Row) {
          patch = nextPatch;
          db.updates?.push(nextPatch);
          if (table === "profiles" && db.profile) {
            db.profile = { ...db.profile, ...nextPatch };
          }
          return query;
        },
        insert(rows: Row[]) {
          db.inserts?.push(rows);
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "profiles") {
            void patch;
            return Promise.resolve({ data: db.profile ?? null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(
          resolve: (value: { data: Row[]; error: null }) => unknown,
          reject: (reason?: unknown) => unknown,
        ) {
          let rows: Row[] = [];
          if (table === "legal_documents") rows = db.legalDocuments ?? [];
          if (table === "user_consents") rows = db.userConsents ?? [];
          return Promise.resolve({
            data: applyFilters(rows, filters, inFilters),
            error: null,
          }).then(resolve, reject);
        },
      };

      return query;
    },
  };
}

const termsDoc: RequiredConsentDocument = {
  id: "terms-1",
  doc_type: "terms",
  version: "v1",
  locale: "ko",
  title: "이용약관",
  summary: null,
  body: "terms",
  effective_at: "2026-06-10T00:00:00.000Z",
  created_at: "2026-06-10T00:00:00.000Z",
};

const privacyDoc: RequiredConsentDocument = {
  id: "privacy-1",
  doc_type: "privacy",
  version: "v1",
  locale: "ko",
  title: "개인정보처리방침",
  summary: null,
  body: "privacy",
  effective_at: "2026-06-10T00:00:00.000Z",
  created_at: "2026-06-10T00:00:00.000Z",
};

describe("legal consent helpers", () => {
  it("generates a non-identifying talkpik nickname", () => {
    expect(generateRandomNickname(() => 0)).toBe("talkpik-000000");
    expect(generateRandomNickname(() => 1 - Number.EPSILON)).toMatch(
      /^talkpik-[0-9a-z]{6}$/,
    );
  });

  it("returns only required documents the user has not accepted", async () => {
    const client = makeClient({
      legalDocuments: [
        { ...termsDoc, status: "published", requires_consent: true },
        { ...privacyDoc, status: "published", requires_consent: true },
      ],
      userConsents: [{ user_id: "user-1", document_id: "terms-1" }],
    });

    const missing = await getMissingRequiredConsentDocuments(
      "user-1",
      "ko",
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
    );

    expect(missing.map((doc) => doc.id)).toEqual(["privacy-1"]);
  });

  it("records consent rows for provided documents", async () => {
    const inserts: Row[][] = [];
    const client = makeClient({ inserts });

    await recordRequiredConsents(
      "user-1",
      [termsDoc, privacyDoc],
      "signup",
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject([
      {
        user_id: "user-1",
        document_id: "terms-1",
        doc_type: "terms",
        version: "v1",
        source: "signup",
      },
      {
        user_id: "user-1",
        document_id: "privacy-1",
        doc_type: "privacy",
        version: "v1",
        source: "signup",
      },
    ]);
  });

  it("backfills blank display_name from OAuth metadata and a random nickname", async () => {
    const updates: Row[] = [];
    const client = makeClient({
      profile: {
        id: "user-1",
        display_name: null,
        ui_locale: "ko",
        app_role: "learner",
        plan_label: "free",
        status: "active",
      },
      updates,
    });

    const result = await backfillOAuthDisplayName(
      {
        id: "user-1",
        user_metadata: {
          name: "Google User",
          picture: "https://example.com/avatar.png",
        },
      } as never,
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
    );

    expect(result.display_name).toBe("Google User");
    expect(result.nickname).toMatch(/^talkpik-[0-9a-z]{6}$/);
    expect(updates).toEqual([
      {
        display_name: "Google User",
        nickname: expect.stringMatching(/^talkpik-[0-9a-z]{6}$/),
      },
    ]);
  });

  it("backfills a blank nickname with a random non-identifying value", async () => {
    const updates: Row[] = [];
    const client = makeClient({
      profile: {
        id: "user-1",
        display_name: null,
        nickname: null,
        ui_locale: "ko",
        app_role: "learner",
        plan_label: "free",
        status: "active",
      },
      updates,
    });

    const result = await backfillOAuthDisplayName(
      { id: "user-1", user_metadata: {} } as never,
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
      () => 0,
    );

    expect(result.nickname).toBe("talkpik-000000");
    expect(updates).toEqual([{ nickname: "talkpik-000000" }]);
  });

  it("does not overwrite an existing display_name while filling a missing nickname", async () => {
    const updates: Row[] = [];
    const client = makeClient({
      profile: {
        id: "user-1",
        display_name: "Existing",
        ui_locale: "ko",
        app_role: "learner",
        plan_label: "free",
        status: "active",
      },
      updates,
    });

    const result = await backfillOAuthDisplayName(
      { id: "user-1", user_metadata: { name: "Google User" } } as never,
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
    );

    expect(result.display_name).toBe("Existing");
    expect(result.nickname).toMatch(/^talkpik-[0-9a-z]{6}$/);
    expect(updates).toEqual([
      { nickname: expect.stringMatching(/^talkpik-[0-9a-z]{6}$/) },
    ]);
  });
});
