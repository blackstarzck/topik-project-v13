// Phase 7-B (Plan rev3 Task 1, R-10 mitigation).
//
// Single builder for all Supabase Auth redirects (signUp emailRedirectTo,
// signInWithOtp emailRedirectTo, resetPasswordForEmail redirectTo).
// Always returns an absolute http(s) URL; never a bare relative path.

const DEV_FALLBACK = "http://127.0.0.1:3000";
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function normalizeLocalBrowserOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (!/^https?:$/i.test(url.protocol)) return null;
    if (!LOCAL_BROWSER_HOSTS.has(url.hostname)) return null;
    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return null;
  }
}

function resolveDevelopmentBrowserOrigin(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (typeof window === "undefined") return null;
  return normalizeLocalBrowserOrigin(window.location.origin);
}

function resolveSiteUrl(): string {
  const browserOrigin = resolveDevelopmentBrowserOrigin();
  if (browserOrigin) {
    return browserOrigin;
  }

  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env && env.length > 0) {
    // Validate scheme — reject javascript:, data:, etc.
    if (!/^https?:\/\//i.test(env)) {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL must start with http:// or https://, got: ${env}`,
      );
    }
    return stripTrailingSlash(env);
  }

  if (process.env.NODE_ENV === "development") {
    return DEV_FALLBACK;
  }

  throw new Error(
    "NEXT_PUBLIC_SITE_URL is required in non-development environments",
  );
}

export function buildAuthRedirectUrl(path: string): string {
  const site = resolveSiteUrl();
  return `${site}${ensureLeadingSlash(path)}`;
}

export function buildAuthCallbackUrl(nextPath: string): string {
  const next = ensureLeadingSlash(nextPath);
  if (next.startsWith("//") || next.includes(":")) {
    throw new Error(
      `Auth callback next path must be relative, got: ${nextPath}`,
    );
  }
  const params = new URLSearchParams({ next });
  return buildAuthRedirectUrl(`/auth/callback?${params.toString()}`);
}
