import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DEPRECATED_BRAND = ["TOPIK", "AI"].join(" ");
const SCAN_ROOTS = ["src", "scripts", "supabase"];
const SKIPPED_DIRECTORIES = new Set([".temp"]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
]);

function collectTextFiles(root: string): string[] {
  const absoluteRoot = path.join(process.cwd(), root);
  const entries = readdirSync(absoluteRoot);
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      continue;
    }

    const absolutePath = path.join(absoluteRoot, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectTextFiles(path.join(root, entry)));
      continue;
    }

    if (stats.isFile() && TEXT_EXTENSIONS.has(path.extname(entry))) {
      files.push(path.join(root, entry));
    }
  }

  return files;
}

describe("brand copy", () => {
  it("keeps runnable project files free of the legacy English brand phrase", () => {
    const matches = SCAN_ROOTS.flatMap(collectTextFiles).flatMap((filePath) => {
      const content = readFileSync(path.join(process.cwd(), filePath), "utf8");
      return content.includes(DEPRECATED_BRAND) ? [filePath] : [];
    });

    expect(matches).toEqual([]);
  });
});
