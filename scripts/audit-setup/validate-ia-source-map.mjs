#!/usr/bin/env node
import {
  buildAppRouteIndex,
  componentAnchorForIa,
  firstRouteCandidate,
  loadManifest,
  REPO_ROOT,
  resolveAuditDir,
  routeMatches,
  statusSummary,
  writeJson,
} from "./ia-audit-lib.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const auditDir = resolveAuditDir();
const manifest = loadManifest(auditDir);
const appRoutes = buildAppRouteIndex();

function findPageSource(routeOrHostRoute) {
  const expected = firstRouteCandidate(routeOrHostRoute);
  return appRoutes.find((route) => route.kind === "page" && routeMatches(expected, route.route));
}

function findRouteHandlerSource(routeOrHostRoute) {
  const expected = firstRouteCandidate(routeOrHostRoute);
  return appRoutes.find((route) => route.kind === "route handler" && routeMatches(expected, route.route));
}

function sourceRowForIa(entry) {
  const sourceFiles = [];
  const blockingReasons = [];
  let status = "PASS";

  if (entry.routeType === "page") {
    const page = findPageSource(entry.routeOrHostRoute);
    if (page) {
      sourceFiles.push(page.sourceFile);
    } else {
      status = "FAIL";
      blockingReasons.push(`No src/app page found for ${entry.routeOrHostRoute}.`);
    }
  } else {
    const anchor = componentAnchorForIa(entry.iaCode);
    const host = findPageSource(entry.routeOrHostRoute);
    if (host) sourceFiles.push(host.sourceFile);
    if (anchor && existsSync(join(REPO_ROOT, anchor))) sourceFiles.push(anchor);

    if (!anchor || !existsSync(join(REPO_ROOT, anchor))) {
      status = "FAIL";
      blockingReasons.push(`No hosted surface component anchor found for ${entry.iaCode}.`);
    }
  }

  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    kind: "ia",
    iaCode: entry.iaCode,
    screenName: entry.screenName,
    phase: "source-map",
    routeOrHostRoute: entry.routeOrHostRoute,
    routeType: entry.routeType,
    audience: entry.audience,
    docsConsulted: ["docs/sitemap.md", "docs/IA/README.md"],
    extractedRequirements: [`${entry.iaCode} maps to ${entry.routeOrHostRoute} as ${entry.routeType}.`],
    evidence: sourceFiles.map((file) => ({ type: "source-file", path: file })),
    status,
    blockingReasons,
    sourceFiles,
    generatedBy: "validate-ia-source-map.mjs",
    generatedAt: new Date().toISOString(),
  };
}

function sourceRowForSupport(surface) {
  const sourceFiles = [];
  const blockingReasons = [];
  const source =
    surface.routeType === "route handler"
      ? findRouteHandlerSource(surface.routeOrHostRoute)
      : findPageSource(surface.routeOrHostRoute);

  if (source) sourceFiles.push(source.sourceFile);
  const status = source ? "PASS" : "FAIL";
  if (!source) blockingReasons.push(`No ${surface.routeType} source found for ${surface.routeOrHostRoute}.`);

  return {
    runId: manifest.runId,
    sourceCommit: manifest.sourceCommit,
    dirtyState: manifest.dirtyState,
    evidenceBundleId: manifest.evidenceBundleId,
    kind: "support-surface",
    phase: "source-map",
    routeOrHostRoute: surface.routeOrHostRoute,
    routeType: surface.routeType,
    audience: surface.audience,
    docsConsulted: ["docs/sitemap.md", "docs/ai-workflow/ia-page-implementation-verification.md"],
    extractedRequirements: [`${surface.routeOrHostRoute} must exist as ${surface.routeType}.`],
    evidence: sourceFiles.map((file) => ({ type: "source-file", path: file })),
    status,
    blockingReasons,
    sourceFiles,
    generatedBy: "validate-ia-source-map.mjs",
    generatedAt: new Date().toISOString(),
  };
}

const rows = manifest.entries.map(sourceRowForIa);
const supportRows = manifest.supportSurfaces.map(sourceRowForSupport);
const result = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
  generatedBy: "validate-ia-source-map.mjs",
  generatedAt: new Date().toISOString(),
  rows,
  supportRows,
  summary: {
    totalIa: rows.length,
    statusCounts: statusSummary(rows),
    supportStatusCounts: statusSummary(supportRows),
  },
};

writeJson(`${auditDir}/source-map-results.json`, result);

console.log(`Wrote ${auditDir}/source-map-results.json.`);
