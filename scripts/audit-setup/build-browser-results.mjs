#!/usr/bin/env node
// Build <auditDir>/browser-results.json from Playwright JSON reporter output.
// Plan §8 Step 2.4.
//
// Inputs:
//   tests/e2e/coverage/failure-log.json  (Playwright json reporter output)
//   <auditDir>/ia-manifest.json          (for runId, sourceCommit, evidenceBundleId)
//
// Output:
//   <auditDir>/browser-results.json
//
// One row per (IA, viewport, audience) combination, capturing:
//   - HTTP status, final URL, title, h1
//   - heading match (vs expected pattern)
//   - primary CTA presence (vs expected pattern)
//   - screenshot filename + UX states covered
//   - storageState-missing flag (for protected routes when fixture absent)
//   - per-IA evidence flags (form / AI output / policy / billing / notification / auth / admin / deferred)
//   - row status (PASS / PARTIAL / BLOCKED) + blockingReasons.

import { readFileSync } from "node:fs";
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
const playwrightJson = JSON.parse(
  readFileSync(join(REPO_ROOT, "tests/e2e/coverage/failure-log.json"), "utf8"),
);

function decodeAuditMeta(test) {
  const last = test.results?.[test.results.length - 1];
  const attachment = last?.attachments?.find((att) => att.name === "audit-meta");
  if (!attachment?.body) return null;
  try {
    const decoded = Buffer.from(attachment.body, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function collectAnnotations(test) {
  const last = test.results?.[test.results.length - 1];
  return last?.annotations ?? [];
}

// Errors that are Next.js dev-mode artifacts (HMR websocket failures because
// Playwright doesn't keep the HMR connection open) and not real product errors.
// They flood the count and create noise blockers. Filtered here so the "errors
// captured" reason only fires for actual page/app errors.
function isDevModeNoise(errorText) {
  const text = String(errorText);
  if (/WebSocket connection to '.*\/_next\/webpack-hmr/.test(text)) return true;
  if (/Error during WebSocket handshake/.test(text)) return true;
  return false;
}

function realErrorCount(errors) {
  if (!Array.isArray(errors)) return 0;
  return errors.filter((e) => !isDevModeNoise(e)).length;
}

function rowStatus(meta, annotations) {
  if (!meta) return { status: "BLOCKED", reasons: ["Missing audit-meta attachment"] };
  const reasons = [];
  if (meta.storageStateMissing) {
    reasons.push(`storageState missing: ${meta.storageStatePath}`);
  }
  if (meta.navigationFailureReason) {
    reasons.push(`navigation error: ${meta.navigationFailureReason}`);
  }
  if (!meta.storageStateMissing && !meta.navigationFailureReason) {
    if (typeof meta.status === "number" && meta.status >= 500) {
      reasons.push(`HTTP ${meta.status}`);
    }
    const realErrors = realErrorCount(meta.errors);
    if (realErrors > 0) {
      reasons.push(`${realErrors} console/page errors captured (excluding ${(meta.errors?.length ?? 0) - realErrors} HMR/dev-mode noise)`);
    }
    if (meta.expectedHeadingPattern && meta.headingMatch === false) {
      reasons.push(`Heading "${meta.visibleH1}" did not match expected pattern ${meta.expectedHeadingPattern}`);
    }
    if (meta.expectedPrimaryCta && meta.primaryCtaPresent === false) {
      reasons.push(`Primary CTA matching ${meta.expectedPrimaryCta} not visible`);
    }
  }
  for (const annotation of annotations) {
    if (annotation.type === "storageState-missing" || annotation.type === "navigation-error") {
      // already captured via meta — avoid duplicate listing
    }
  }
  if (reasons.length === 0) return { status: "PASS", reasons: [] };
  if (meta.storageStateMissing) return { status: "BLOCKED", reasons };
  return { status: "PARTIAL", reasons };
}

const rows = [];
const audit = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "build-browser-results.mjs",
  generatedAt: generatedAt(),
  playwright: {
    durationMs: playwrightJson.stats?.duration,
    expected: playwrightJson.stats?.expected,
    unexpected: playwrightJson.stats?.unexpected,
    skipped: playwrightJson.stats?.skipped,
    flaky: playwrightJson.stats?.flaky,
  },
  roleStateStatus: {
    student: "missing",
    content_admin: "missing",
    org_admin: "missing",
    platform_admin: "missing",
  },
  rows,
  summary: {},
};

for (const suite of playwrightJson.suites ?? []) {
  for (const file of suite.suites ?? [{ specs: suite.specs }]) {
    const specs = file.specs ?? suite.specs ?? [];
    for (const spec of specs) {
      for (const test of spec.tests ?? []) {
        const meta = decodeAuditMeta(test);
        const annotations = collectAnnotations(test);
        const { status, reasons } = rowStatus(meta, annotations);
        rows.push({
          runId: manifest.runId,
          sourceCommit: manifest.sourceCommit,
          dirtyState: manifest.dirtyState,
          evidenceBundleId: manifest.evidenceBundleId,
          phase: "browser",
          iaCode: meta?.iaCode ?? "unknown",
          screenName: meta?.screenName ?? spec.title,
          routeOrHostRoute: meta?.routeOrHostRoute ?? "unknown",
          routeType: meta?.routeType ?? "unknown",
          audience: meta?.audience ?? "unknown",
          packs: meta?.packs ?? [],
          viewport: meta?.viewport,
          viewportTag: meta?.bp,
          projectName: test.projectName,
          visitedUrl: meta?.visitedUrl,
          finalUrl: meta?.finalUrl,
          httpStatus: meta?.status,
          title: meta?.title,
          visibleH1: meta?.visibleH1,
          expectedHeadingPattern: meta?.expectedHeadingPattern,
          headingMatch: meta?.headingMatch,
          expectedPrimaryCta: meta?.expectedPrimaryCta,
          primaryCtaPresent: meta?.primaryCtaPresent,
          screenshotPath: meta?.screenshotPath,
          storageStatePath: meta?.storageStatePath,
          storageStateMissing: meta?.storageStateMissing ?? false,
          navigationFailureReason: meta?.navigationFailureReason,
          uxStatesRequired: meta?.uxStatesRequired ?? [],
          uxStatesCaptured: meta?.uxStatesCaptured ?? [],
          uxStatesUnavailableReason: meta?.uxStatesUnavailableReason ?? {},
          formEvidenceRequired: meta?.formEvidenceRequired ?? false,
          aiOutputEvidenceRequired: meta?.aiOutputEvidenceRequired ?? false,
          policyEvidenceRequired: meta?.policyEvidenceRequired ?? false,
          billingEvidenceRequired: meta?.billingEvidenceRequired ?? false,
          notificationEvidenceRequired: meta?.notificationEvidenceRequired ?? false,
          authEvidenceRequired: meta?.authEvidenceRequired ?? false,
          adminEvidenceRequired: meta?.adminEvidenceRequired ?? false,
          deferred: meta?.deferred ?? false,
          errors: meta?.errors ?? [],
          notes: meta?.notes,
          status,
          blockingReasons: reasons,
          generatedBy: "build-browser-results.mjs",
          generatedAt: generatedAt(),
        });
      }
    }
  }
}

audit.summary = {
  totalRows: rows.length,
  statusCounts: statusSummary(rows),
  publicRowsPass: rows.filter((r) => r.audience === "public" && r.status === "PASS").length,
  protectedRowsBlocked: rows.filter((r) => r.audience !== "public" && r.status === "BLOCKED").length,
};

const overallStatus = rows.some((r) => r.status === "FAIL")
  ? "FAIL"
  : rows.some((r) => r.status === "BLOCKED")
    ? "BLOCKED"
    : rows.some((r) => r.status === "PARTIAL")
      ? "PARTIAL"
      : "PASS";

audit.status = overallStatus;

writeJson(`${auditDir}/browser-results.json`, audit);
console.log(
  `Wrote ${auditDir}/browser-results.json (${rows.length} rows, status=${overallStatus}, summary=${JSON.stringify(audit.summary.statusCounts)}).`,
);
