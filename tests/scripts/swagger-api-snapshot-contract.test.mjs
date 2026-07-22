import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const docsRoot = path.join(process.cwd(), "docs", "swagger-api");
const removedRoutePatterns = [
  /(?:https?:\/\/|\/\/)?api\.dotoretopik\.com\/?(?=$|[\s"'<>`)])/i,
  /(?:https?:\/\/|\/\/)?api\.dotoretopik\.com\/docs(?:\b|[/?#])/i,
  /(?:https?:\/\/|\/\/)?api\.dotoretopik\.com\/openapi\.json(?:\b|[?#])/i,
];

function collectReferenceFiles(directory) {
  return readdirSync(directory)
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry);
      if (statSync(absolutePath).isDirectory()) {
        return collectReferenceFiles(absolutePath);
      }
      return /\.(?:html|md)$/i.test(entry) ? [absolutePath] : [];
    })
    .sort();
}

function relativePath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replaceAll("\\", "/");
}

describe("swagger API historical snapshot contract", () => {
  const files = collectReferenceFiles(docsRoot);

  it("does not publish the removed TALKPIK API routes", () => {
    const offenders = files
      .filter((file) => {
        const content = readFileSync(file, "utf8");
        return removedRoutePatterns.some((pattern) => pattern.test(content));
      })
      .map(relativePath);

    expect(offenders).toEqual([]);
  });

  it("labels the reference as a dated non-live snapshot", () => {
    const readme = readFileSync(path.join(docsRoot, "README.md"), "utf8");

    expect(readme).toContain("Historical snapshot");
    expect(readme).toContain("2026-07-07");
    expect(readme).toContain("no current API base URL is documented");
    expect(readme).toContain("Do not use this snapshot as a live integration contract");
  });

  it("does not describe captured contracts as live or current APIs", () => {
    const liveContractPattern =
      /\b(?:live contract|live OpenAPI|live schema|current live)\b|(?<!no )\bcurrent API\b/i;
    const offenders = files
      .filter((file) => liveContractPattern.test(readFileSync(file, "utf8")))
      .map(relativePath);

    expect(offenders).toEqual([]);
  });
});
