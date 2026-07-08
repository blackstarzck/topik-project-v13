import { describe, expect, it } from "vitest";

import { isBrowserPrintExport } from "../../../src/components/library/LibraryExportsTab";
import type { LibraryExportView } from "../../../src/lib/library/types";

/**
 * `LibraryExportsTab` branches on `options.source === 'browser_print'`:
 *   - browser_print rows render a "다시 인쇄" button (re-triggers
 *     `window.print()` via `triggerPdfExport`);
 *   - everything else renders a "다운로드" placeholder (real download URL
 *     lands when the storage queue ships — OOS-6).
 *
 * The branching predicate is the load-bearing piece; the React rendering
 * around it is a thin wrapper. We test the predicate exhaustively against
 * the `LibraryExportView.options` shape (Json | null).
 */
function makeExport(
  options: LibraryExportView["options"],
  overrides: Partial<LibraryExportView> = {},
): LibraryExportView {
  const { source_id = "sub-1", ...rest } = overrides;
  return {
    kind: "export",
    id: "exp-1",
    source_type: "submission",
    source_id,
    storage_path: "browser-print://abc",
    status: "ready",
    options,
    item_id: "item-1",
    tags: [],
    ...rest,
  };
}

describe("LibraryExportsTab — browser_print branching", () => {
  it("rows with options.source='browser_print' are flagged for the '다시 인쇄' button", () => {
    const row = makeExport({ source: "browser_print" });
    expect(isBrowserPrintExport(row)).toBe(true);
  });

  it("rows with options.source set to anything else fall through to '다운로드'", () => {
    expect(isBrowserPrintExport(makeExport({ source: "queue" }))).toBe(false);
    expect(isBrowserPrintExport(makeExport({ source: "" }))).toBe(false);
    expect(isBrowserPrintExport(makeExport({ source: null }))).toBe(false);
  });

  it("rows with no options / null options fall through to '다운로드'", () => {
    expect(isBrowserPrintExport(makeExport(null))).toBe(false);
    expect(isBrowserPrintExport(makeExport({}))).toBe(false);
  });

  it("rows whose options is an array (defensive) are not treated as browser_print", () => {
    // `options` is `Json | null` and Json includes arrays. The helper must
    // not crash if the column ever ends up holding an array literal.
    expect(
      isBrowserPrintExport(
        makeExport([] as unknown as LibraryExportView["options"]),
      ),
    ).toBe(false);
  });

  it("only the marker key 'source' is consulted (other keys ignored)", () => {
    expect(isBrowserPrintExport(makeExport({ kind: "browser_print" }))).toBe(
      false,
    );
    expect(
      isBrowserPrintExport(
        makeExport({ source: "browser_print", extra: 1, nested: { x: 1 } }),
      ),
    ).toBe(true);
  });
});
