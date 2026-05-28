#!/usr/bin/env node
// Build <auditDir>/hosted-surface-results.json from Playwright JSON output.
// Plan §9 Step 3.3.
//
// Reads the audit-meta attachments emitted by
// tests/e2e/coverage/hosted-surfaces.spec.ts and packages them as a phase
// result with one row per hosted surface (C-03, D-M1, D-M2, D-M3, F-M1).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  generatedAt,
  loadManifest,
  REPO_ROOT,
  resolveAuditDir,
  statusSummary,
  writeJson,
} from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);

const playwrightOutPath = join(REPO_ROOT, "tests/e2e/coverage/failure-log.json");
if (!existsSync(playwrightOutPath)) {
  console.error("Playwright output missing at", playwrightOutPath);
  process.exit(1);
}
const playwrightJson = JSON.parse(readFileSync(playwrightOutPath, "utf8"));

function decodeAuditMeta(test) {
  const last = test.results?.[test.results.length - 1];
  const attachment = last?.attachments?.find((att) => att.name === "audit-meta");
  if (!attachment?.body) return null;
  try {
    return JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

const rows = [];

for (const suite of playwrightJson.suites ?? []) {
  const isHosted = (suite.file ?? "").includes("hosted-surfaces");
  const innerSuites = suite.suites?.length ? suite.suites : [{ specs: suite.specs }];
  for (const inner of innerSuites) {
    const fileName = inner.file ?? suite.file ?? "";
    if (!fileName.includes("hosted-surfaces") && !isHosted) continue;
    for (const spec of inner.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const meta = decodeAuditMeta(test);
        if (!meta || meta.phase !== "hosted-surface") continue;
        rows.push({
          runId: manifest.runId,
          sourceCommit: manifest.sourceCommit,
          dirtyState: manifest.dirtyState,
          evidenceBundleId: manifest.evidenceBundleId,
          phase: "hosted-surface",
          iaCode: meta.iaCode,
          screenName: spec.title,
          hostRoute: meta.hostRoute,
          finalUrl: meta.finalUrl ?? null,
          triggerSelector: meta.plan?.triggerSelector,
          triggerCopyExpected: meta.plan?.expectedTriggerCopy?.toString(),
          triggerFired: meta.triggerFired ?? false,
          surfaceOpened: meta.surfaceOpened ?? false,
          hostBeforeScreenshot: meta.hostBeforeScreenshot,
          surfaceOpenScreenshot: meta.surfaceOpenScreenshot,
          surfaceClosedScreenshot: meta.surfaceClosedScreenshot,
          focusEntryResult: meta.focusEntryResult,
          focusReturnResult: meta.focusReturnResult,
          keyboardCloseResult: meta.keyboardCloseResult,
          duplicateActionPreventionResult: meta.duplicateActionPreventionResult,
          failureRetryResult: meta.failureRetryResult,
          mobileViewportUsed: meta.mobileViewportUsed,
          errors: meta.errors ?? [],
          status: meta.status,
          blockingReasons: meta.blockingReasons ?? [],
          generatedBy: "build-hosted-surface-results.mjs",
          generatedAt: generatedAt(),
        });
      }
    }
  }
}

const overallStatus = rows.length === 0
  ? "BLOCKED"
  : rows.some((r) => r.status === "FAIL")
    ? "FAIL"
    : rows.some((r) => r.status === "BLOCKED")
      ? "BLOCKED"
      : rows.some((r) => r.status === "PARTIAL")
        ? "PARTIAL"
        : "PASS";

const audit = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "build-hosted-surface-results.mjs",
  generatedAt: generatedAt(),
  rows,
  summary: {
    totalRows: rows.length,
    statusCounts: statusSummary(rows),
  },
  status: overallStatus,
};

writeJson(`${auditDir}/hosted-surface-results.json`, audit);
console.log(
  `Wrote ${auditDir}/hosted-surface-results.json (${rows.length} rows, status=${overallStatus}, summary=${JSON.stringify(audit.summary.statusCounts)}).`,
);
