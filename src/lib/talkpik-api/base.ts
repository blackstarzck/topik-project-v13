export function getTalkpikApiBaseUrl(): string | null {
  const raw =
    process.env.TALKPIK_API_BASE_URL?.trim() ||
    process.env.TALKPIK_WRITING_API_BASE_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("TALKPIK_API_BASE_URL must be a valid URL");
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && url.protocol !== "https:") {
    throw new Error("TALKPIK_API_BASE_URL must use https in production");
  }

  return url.toString().replace(/\/$/, "");
}
