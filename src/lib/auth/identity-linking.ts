type AuthIdentityLike = {
  provider?: string | null;
};

type AuthUserLike = {
  identities?: AuthIdentityLike[] | null;
};

export const GOOGLE_LINKED_NOTICE = "google-linked";
export const GOOGLE_LINK_INTENT = "link-google";

export function hasProviderIdentity(
  user: AuthUserLike,
  provider: string,
): boolean {
  return (
    user.identities?.some((identity) => identity.provider === provider) ?? false
  );
}

export function shouldAddGoogleLinkedNotice(
  user: AuthUserLike,
  intent: string,
): boolean {
  return intent === GOOGLE_LINK_INTENT && hasProviderIdentity(user, "google");
}

export function addGoogleLinkedNotice(path: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("notice", GOOGLE_LINKED_NOTICE);
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
