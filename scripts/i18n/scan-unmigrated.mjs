#!/usr/bin/env node
/**
 * i18n discovery scanner (coordinator-only, not committed).
 * For each src/**.{ts,tsx} file, count Korean (Hangul) occurrences that are NOT
 * on comment lines. Migrated files keep Korean only in comments → count 0.
 * Unmigrated files still carry live Korean strings → count > 0.
 * Also reports whether the file imports next-intl.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const HANGUL = /[가-힣]/;
const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

function stripComments(src) {
  // remove block comments
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // remove line comments (best-effort: from // to EOL, ignoring // inside strings is
  // imperfect but fine for a count heuristic)
  s = s
    .split("\n")
    .map((line) => {
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*")) return "";
      // strip trailing line comment
      const idx = line.indexOf("//");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  return s;
}

const rows = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const code = stripComments(src);
  // count non-comment lines containing Hangul
  const liveLines = code.split("\n").filter((l) => HANGUL.test(l)).length;
  if (liveLines === 0) continue;
  const intl = /useTranslations|getTranslations|next-intl/.test(src);
  rows.push({ f: f.replace(/\\/g, "/"), liveLines, intl });
}

rows.sort((a, b) => b.liveLines - a.liveLines);
console.log("UNMIGRATED (Korean on non-comment lines):");
console.log("liveLines  intl?  file");
for (const r of rows) {
  console.log(
    String(r.liveLines).padStart(8),
    "  ",
    r.intl ? "Y" : "-",
    "  ",
    r.f,
  );
}
console.log(`\nTotal files with live Korean: ${rows.length}`);
