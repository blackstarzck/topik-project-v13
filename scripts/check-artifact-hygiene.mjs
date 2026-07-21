#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateArtifactHygiene } from "./lib/artifact-hygiene.mjs";

function optionValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

export function main(args = process.argv.slice(2)) {
  const mode = optionValue(args, "--mode", "report");
  const format = optionValue(args, "--format", "text");
  if (!new Set(["report", "check"]).has(mode) || !new Set(["text", "json"]).has(format)) {
    process.stderr.write("CLI_ARGUMENT_INVALID\t--mode/--format\n");
    return 2;
  }
  const result = evaluateArtifactHygiene();
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (mode === "check") {
    for (const violation of result.violations) {
      process.stderr.write(`${violation.code}\t${violation.path}\n`);
    }
  } else {
    process.stdout.write(`Artifact hygiene: ${result.ok ? "PASS" : "FAIL"}\n`);
    process.stdout.write(`Base: ${result.baseRef}${result.baseSha ? ` (${result.baseSha})` : ""}\n`);
    for (const violation of result.violations) {
      process.stdout.write(`- ${violation.code}: ${violation.path}\n`);
    }
  }
  return mode === "check" && !result.ok ? 1 : 0;
}

if (
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
) {
  process.exitCode = main();
}
