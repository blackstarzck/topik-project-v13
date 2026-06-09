// Throwaway helper for the 2026-06-09 wireframe page-review capture.
// Loads .env.local into process.env WITHOUT printing any value. Safe for dev only.
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadEnvLocal(root = process.cwd()) {
  const p = path.join(root, ".env.local");
  let raw = "";
  try {
    raw = await readFile(p, "utf8");
  } catch {
    throw new Error(`.env.local not found at ${p}`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Hard safety guard: never run capture/seed against a production project.
export function assertNotProd() {
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") {
    throw new Error(`SUPABASE_ENV_LABEL=${label} — refusing to run against production.`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return { label, url };
}

export function serviceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}
