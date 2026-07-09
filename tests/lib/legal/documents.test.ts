import { describe, expect, it } from "vitest";

import {
  getPublishedLegalDocument,
  type PublishedLegalDocument,
} from "../../../src/lib/legal/documents";

const publishedTerms: PublishedLegalDocument = {
  id: "terms-1",
  doc_type: "terms",
  version: "v1",
  locale: "ko",
  title: "Terms",
  body: "<h1>Terms</h1>",
  summary: null,
  effective_at: "2026-06-22T00:00:00.000Z",
  is_placeholder: false,
};

function makeClient(result: {
  data: PublishedLegalDocument[] | null;
  error: { message: string } | null;
}) {
  return {
    from() {
      const query = {
        select: () => query,
        eq: () => query,
        or: () => query,
        order: () => query,
        limit: () => Promise.resolve(result),
      };
      return query;
    },
  };
}

describe("legal document reads", () => {
  it("falls back to a public read when a stale auth token breaks a public document query", async () => {
    const factories: string[] = [];

    const doc = await getPublishedLegalDocument(
      "terms",
      "ko",
      async () => {
        factories.push("cookie");
        return makeClient({
          data: null,
          error: { message: "No suitable key or wrong key type" },
        }) as never;
      },
      async () => {
        factories.push("public");
        return makeClient({ data: [publishedTerms], error: null }) as never;
      },
    );

    expect(doc?.id).toBe("terms-1");
    expect(factories).toEqual(["cookie", "public"]);
  });

  it("keeps non-auth query failures visible", async () => {
    await expect(
      getPublishedLegalDocument(
        "terms",
        "ko",
        async () =>
          makeClient({
            data: null,
            error: { message: "permission denied for table legal_documents" },
          }) as never,
      ),
    ).rejects.toThrow("permission denied for table legal_documents");
  });
});
