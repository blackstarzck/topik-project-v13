#!/usr/bin/env node
/**
 * i18n staging merge — coordinator-side tool for the incremental i18n migration.
 *
 * Cluster agents write a staging catalog per cluster to `messages/_staging/<x>.json`
 * shaped as nested namespaces whose LEAVES are `{ "ko": "...", "en": "...", "vi": "..." }`.
 * Agents do NOT touch the real `messages/{ko,en,vi}.json` (single-file-per-locale →
 * parallel write-conflict). This script splits each staging tree by locale and deep-merges
 * it into the three real catalogs, so parallel cluster work integrates cleanly.
 *
 * Usage:
 *   node scripts/i18n/merge-staging.mjs           # merge all staging files
 *   node scripts/i18n/merge-staging.mjs --clean   # ...and delete the staging dir after
 *
 * Fails closed on a malformed leaf (a node carrying some but not all of ko/en/vi),
 * which catches the common agent mistake of a missing locale.
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const STAGING_DIR = join(ROOT, "messages", "_staging");
const LOCALES = ["ko", "en", "vi"];

function classify(node, path) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return "value";
  const keys = Object.keys(node);
  const localeKeys = keys.filter((k) => LOCALES.includes(k));
  if (localeKeys.length === 0) return "branch";
  if (
    localeKeys.length === LOCALES.length &&
    keys.length === LOCALES.length &&
    LOCALES.every((l) => typeof node[l] === "string")
  ) {
    return "leaf";
  }
  throw new Error(
    `Malformed leaf at "${path}": expected exactly {ko,en,vi} string values, got keys [${keys.join(", ")}]`,
  );
}

function extractLocale(node, locale, path) {
  const kind = classify(node, path);
  if (kind === "value") return node;
  if (kind === "leaf") return node[locale];
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = extractLocale(v, locale, path ? `${path}.${k}` : k);
  }
  return out;
}

function deepMerge(target, src, path, collisions) {
  for (const [k, v] of Object.entries(src)) {
    const here = path ? `${path}.${k}` : k;
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k])
    ) {
      deepMerge(target[k], v, here, collisions);
    } else {
      if (k in target && JSON.stringify(target[k]) !== JSON.stringify(v)) {
        collisions.push(here);
      }
      target[k] = v;
    }
  }
  return target;
}

const files = existsSync(STAGING_DIR)
  ? readdirSync(STAGING_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
  : [];

if (files.length === 0) {
  console.log("No staging files in messages/_staging/. Nothing to merge.");
  process.exit(0);
}

const staged = files.map((f) => ({
  name: f,
  data: JSON.parse(readFileSync(join(STAGING_DIR, f), "utf8")),
}));

const allCollisions = [];
for (const locale of LOCALES) {
  const catalogPath = join(ROOT, "messages", `${locale}.json`);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  for (const { name, data } of staged) {
    const partial = extractLocale(data, locale, "");
    deepMerge(catalog, partial, "", allCollisions);
  }
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}

console.log(`Merged ${files.length} staging file(s): ${files.join(", ")}`);
if (allCollisions.length > 0) {
  const uniq = [...new Set(allCollisions)];
  console.log(
    `NOTE: ${uniq.length} existing key(s) overwritten (review): ${uniq.slice(0, 30).join(", ")}`,
  );
}

if (process.argv.includes("--clean")) {
  rmSync(STAGING_DIR, { recursive: true, force: true });
  console.log("Removed messages/_staging/.");
}
