#!/usr/bin/env node
// Build <auditDir>/security-navigation-results.json from Phase 4 Playwright
// JSON output (auth-route-handlers.spec + session-navigation.spec).
// Plan §10 Step 4.3.

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

function walkSuites(suiteList) {
  for (const suite of suiteList ?? []) {
    if (suite.specs?.length) {
      for (const spec of suite.specs) {
        for (const test of spec.tests ?? []) {
          const meta = decodeAuditMeta(test);
          if (!meta) continue;
          if (meta.phase !== "auth-route-handler" && meta.phase !== "session-navigation") continue;
          const status = meta.passed
            ? "PASS"
            : (meta.blockingReasons ?? []).some((r) =>
                  /storageState|service_role|seeded|precondition/i.test(String(r)),
                )
              ? "BLOCKED"
              : "FAIL";
          rows.push({
            runId: manifest.runId,
            sourceCommit: manifest.sourceCommit,
            dirtyState: manifest.dirtyState,
            evidenceBundleId: manifest.evidenceBundleId,
            phase: "security-navigation",
            subPhase: meta.phase,
            caseId: meta.caseId,
            description: meta.description,
            iaCode: meta.iaCode ?? null,
            actor: meta.actor,
            routeOrHostRoute: meta.routeOrHostRoute,
            expectedOutcome: meta.expectedOutcome,
            actualOutcome: meta.actualOutcome ?? null,
            observedStatus: meta.observedStatus,
            observedFinalUrl: meta.observedFinalUrl ?? meta.observedBody ?? null,
            recoveryCopyExpected: meta.recoveryCopyExpected?.toString?.() ?? meta.recoveryCopyExpected,
            recoveryCopyObserved: meta.recoveryCopyObserved,
            safeReturnRoute: meta.safeReturnRoute,
            rawErrorExposureCheck: meta.rawErrorExposureCheck,
            authOverviewRequirementIds: meta.authOverviewRequirementIds ?? [],
            backendAuthRequirementIds: meta.backendAuthRequirementIds ?? [],
            status,
            blockingReasons: meta.blockingReasons ?? [],
            generatedBy: "build-security-navigation-results.mjs",
            generatedAt: generatedAt(),
          });
        }
      }
    }
    if (suite.suites?.length) walkSuites(suite.suites);
  }
}

walkSuites(playwrightJson.suites);

const counts = statusSummary(rows);
const overallStatus = rows.length === 0
  ? "BLOCKED"
  : counts.FAIL
    ? "FAIL"
    : counts.BLOCKED
      ? "BLOCKED"
      : counts.PARTIAL
        ? "PARTIAL"
        : "PASS";

const audit = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "build-security-navigation-results.mjs",
  generatedAt: generatedAt(),
  rows,
  summary: { totalRows: rows.length, statusCounts: counts },
  status: overallStatus,
};

writeJson(`${auditDir}/security-navigation-results.json`, audit);
console.log(
  `Wrote ${auditDir}/security-navigation-results.json (${rows.length} rows, status=${overallStatus}, summary=${JSON.stringify(counts)}).`,
);
