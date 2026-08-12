import { z } from "zod";
import {
  assertRuntimeSupabaseTarget,
  resolvePublicSupabaseKey,
} from "../../../scripts/lib/supabase-target-safety.mjs";

const DEVELOPMENT_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function hasOnlyRootPathAndNoDecorations(value: string): boolean {
  const authorityStart = value.indexOf("://");
  if (authorityStart < 0) return false;

  const authorityAndPath = value.slice(authorityStart + 3);
  if (
    authorityAndPath.includes("?") ||
    authorityAndPath.includes("#") ||
    authorityAndPath.includes("\\")
  ) {
    return false;
  }

  const pathStart = authorityAndPath.indexOf("/");
  const authority =
    pathStart < 0 ? authorityAndPath : authorityAndPath.slice(0, pathStart);
  const path = pathStart < 0 ? "" : authorityAndPath.slice(pathStart);

  return !authority.includes("@") && (path === "" || path === "/");
}

function isAllowedUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !hasOnlyRootPathAndNoDecorations(value)
  ) {
    return false;
  }

  if (parsed.protocol === "https:") return true;

  const hostname = parsed.hostname
    .replace(/^\[|\]$/gu, "")
    .toLocaleLowerCase("en-US");

  return (
    process.env.NODE_ENV === "development" &&
    parsed.protocol === "http:" &&
    DEVELOPMENT_HTTP_HOSTS.has(hostname)
  );
}

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" })
    .refine(isAllowedUrl, {
      message:
        "NEXT_PUBLIC_SUPABASE_URL must use https (or an exact localhost / 127.0.0.1 / ::1 http URL in development)",
    }),
});

export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function getPublicEnv(): PublicSupabaseEnv {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `${path}: ${issue.message}`;
    });
    throw new Error(
      `Invalid Supabase public environment variables:\n${messages.join("\n")}`,
    );
  }
  let publishableKey: string;
  try {
    publishableKey = resolvePublicSupabaseKey({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  } catch {
    throw new Error(
      "Invalid Supabase public environment variables:\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY: Public Supabase key is not approved.",
    );
  }
  if (typeof window === "undefined") {
    assertRuntimeSupabaseTarget({
      NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_LOCAL_STACK: process.env.SUPABASE_LOCAL_STACK,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey,
  };
}
