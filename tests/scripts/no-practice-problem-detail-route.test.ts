import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path));
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

describe("navigation route inventory", () => {
  test("does not generate a non-existent /practice/problems/:id route", () => {
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((path) => readFileSync(path, "utf8").includes("/practice/problems/"))
      .map((path) => path.replace(`${process.cwd()}\\`, ""));

    expect(offenders).toEqual([]);
  });
});
