#!/usr/bin/env node
import { buildManifest, resolveAuditDir, writeJson } from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = buildManifest(auditDir);

writeJson(`${auditDir}/ia-manifest.json`, manifest);

if (manifest.entries.length !== 34) {
  console.error(`Expected 34 IA entries, found ${manifest.entries.length}.`);
  process.exit(1);
}

console.log(`Wrote ${auditDir}/ia-manifest.json (${manifest.entries.length} IA entries).`);
