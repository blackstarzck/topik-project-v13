const INTERNAL_RETURN_ORIGIN = "https://talkpik.invalid";

export function resolveSafeInternalReturnTo(
  value: string | string[] | null | undefined,
  {
    fallback,
    isAllowedPathname,
  }: {
    fallback: string;
    isAllowedPathname: (pathname: string) => boolean;
  },
): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /%5c/i.test(value)
  ) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(value, INTERNAL_RETURN_ORIGIN);
  } catch {
    return fallback;
  }

  if (
    url.origin !== INTERNAL_RETURN_ORIGIN ||
    url.searchParams.has("returnTo")
  ) {
    return fallback;
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(url.pathname);
  } catch {
    return fallback;
  }

  if (
    decodedPathname.startsWith("//") ||
    decodedPathname.includes("\\") ||
    decodedPathname !== url.pathname ||
    !isAllowedPathname(decodedPathname)
  ) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
