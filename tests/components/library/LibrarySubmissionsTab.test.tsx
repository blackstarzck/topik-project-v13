// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import koMessages from "../../../messages/ko.json";
import type { LibrarySubmissionView } from "../../../src/lib/library/types";

// Keep enrichment offline + deterministic (no network during the render test).
vi.mock("../../../src/components/library/library-enrich-data", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, fetchSubmissionEnrichment: vi.fn().mockResolvedValue(new Map()) };
});

import { LibrarySubmissionsTab } from "../../../src/components/library/LibrarySubmissionsTab";
import type { ExportSelectionItem } from "../../../src/components/library/PdfExportModal";

const items = [
  {
    kind: "submission",
    id: "s1",
    item_id: "i1",
    problem_id: "p1234567",
    question_no: 51,
    tags: [],
    char_count: 100,
    submitted_at: "2026-06-01T00:00:00.000Z",
  },
] as unknown as LibrarySubmissionView[];

// Mirror LibraryTabs: a stateful parent that setStates on every selection lift.
// THIS is what turns an unstable child (allItems/filtered new every render) into
// a render loop — the spy-only version cannot, since it never setStates back.
function Harness() {
  const [, setSelection] = useState<ExportSelectionItem[]>([]);
  const onSelectionChange = useCallback(
    (next: ExportSelectionItem[]) => setSelection(next),
    [],
  );
  return (
    <LibrarySubmissionsTab initialItems={items} onSelectionChange={onSelectionChange} />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibrarySubmissionsTab — no render loop (regression)", () => {
  it("does not loop when a stateful parent lifts the selection", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // REGRESSION GUARD: allItems was recomputed (`.filter()`) every render, so the
    // `filtered` useMemo + the selection-lift useEffect re-ran every render →
    // setState(parent) → re-render → … → React throws "Maximum update depth
    // exceeded". Memoizing allItems breaks the cycle. Verified RED on the inline
    // version, GREEN with the useMemo fix.
    expect(() =>
      render(
        <QueryClientProvider client={qc}>
          <NextIntlClientProvider locale="ko" messages={koMessages}>
            <AntdApp>
              <Harness />
            </AntdApp>
          </NextIntlClientProvider>
        </QueryClientProvider>,
      ),
    ).not.toThrow();
  });
});
