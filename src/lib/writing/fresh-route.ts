export function writingHrefAfterDraftPersisted(href: string): string | null {
  const url = new URL(href, "http://localhost");
  if (url.searchParams.get("fresh") !== "1") return null;

  url.searchParams.delete("fresh");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

export function markWritingDraftRoutePersisted(): void {
  if (typeof window === "undefined") return;
  const nextHref = writingHrefAfterDraftPersisted(window.location.href);
  if (!nextHref) return;
  window.history.replaceState(window.history.state, "", nextHref);
}
