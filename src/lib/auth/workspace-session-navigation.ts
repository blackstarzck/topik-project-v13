type DocumentLocation = Pick<Location, "href" | "replace">;

export function replaceWorkspaceDocument(
  location: DocumentLocation = window.location,
) {
  location.replace(location.href);
}
