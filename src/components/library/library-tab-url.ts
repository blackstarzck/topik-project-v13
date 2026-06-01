/**
 * URL state contract for `LibraryTabs`.
 *
 * The active tab is reflected in the `?tab=` search param. We keep this
 * helper as a pure function so vitest can verify the URL contract without a
 * DOM — the React component just calls `router.replace(buildLibraryTabUrl(...))`.
 *
 * Default tab ('submissions') intentionally elides the query param to keep
 * the canonical "/library" URL clean and avoid spurious replace() churn when
 * the user lands on the page.
 */
import { LIBRARY_TABS, type LibraryTab } from "@/lib/library/types";

const DEFAULT_TAB: LibraryTab = "submissions";

export function isLibraryTab(value: unknown): value is LibraryTab {
  return (
    typeof value === "string" && (LIBRARY_TABS as readonly string[]).includes(value)
  );
}

export function parseLibraryTab(raw: string | null | undefined): LibraryTab {
  if (raw && isLibraryTab(raw)) return raw;
  return DEFAULT_TAB;
}

/**
 * Build the `/library` URL for `nextTab`, preserving any other existing
 * search params. The default tab elides the param.
 */
export function buildLibraryTabUrl(
  nextTab: LibraryTab,
  currentParams: URLSearchParams,
): string {
  const sp = new URLSearchParams(currentParams.toString());
  if (nextTab === DEFAULT_TAB) {
    sp.delete("tab");
  } else {
    sp.set("tab", nextTab);
  }
  const qs = sp.toString();
  return qs.length > 0 ? `/library?${qs}` : "/library";
}

/**
 * Client-side search matcher for the library list (F-01 region 1, 검색/필터).
 *
 * Phase 6 search is in-memory over the already-fetched rows — there is no
 * server-side full-text search yet. An empty/whitespace term matches every
 * row (the search box clears back to the full list). Matching is
 * case-insensitive over the supplied haystack fields (title + tags).
 *
 * Kept as a pure helper so each tab can reuse it and vitest can verify the
 * contract without rendering antd.
 */
export function matchesLibrarySearch(
  term: string,
  haystacks: Array<string | null | undefined>,
): boolean {
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) return true;
  return haystacks.some(
    (h) => typeof h === "string" && h.toLowerCase().includes(needle),
  );
}
