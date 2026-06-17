type AuthIdentityLike = {
  provider?: string | null;
};

type AuthUserLike = {
  identities?: AuthIdentityLike[] | null;
};

export const GOOGLE_LINKED_NOTICE = "google-linked";

export function hasProviderIdentity(
  user: AuthUserLike,
  provider: string,
): boolean {
  return (
    user.identities?.some((identity) => identity.provider === provider) ?? false
  );
}

export function addGoogleLinkedNotice(path: string, user: AuthUserLike): string {
  if (!hasProviderIdentity(user, "google")) return path;

  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("notice", GOOGLE_LINKED_NOTICE);
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
