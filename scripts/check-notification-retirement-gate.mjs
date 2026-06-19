#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TRANSITION_ROUTE_FILE = "src/app/api/notifications/dispatch-email/route.ts";
const TRANSFER_PROPOSAL_FILE =
  "docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md";

const REQUIRED_CHECKED_TERMS = [
  "topik-ai production runtime env is configured",
  "topik-ai `npm run check:vercel-worker-readiness -- --strict-env` passes",
  "topik-ai `npm run check:notification-production-evidence -- --require` passes",
  "topik-ai `npm run harness:admin-boundary:production` passes",
  "actual `notification_delivery_attempts` state moves from `pending` to `sent` or failure bookkeeping state",
  "v13 X-09 owner-read history verifies only the logged-in user's scope",
  "after verification, decide whether to remove the v13 transition route",
];

function fileExists(rootDir, relativeFile) {
  try {
    return statSync(path.join(rootDir, relativeFile)).isFile();
  } catch {
    return false;
  }
}

function readText(rootDir, relativeFile) {
  return readFileSync(path.join(rootDir, relativeFile), "utf8");
}

function hasCheckedTerm(text, term) {
  return text
    .split(/\r?\n/)
    .some((line) => line.includes("[x]") && line.includes(term));
}

function missingProposalTerms(rootDir) {
  if (!fileExists(rootDir, TRANSFER_PROPOSAL_FILE)) {
    return [];
  }

  const proposal = readText(rootDir, TRANSFER_PROPOSAL_FILE);
  return REQUIRED_CHECKED_TERMS.filter((term) => !proposal.includes(term));
}

export function evaluateNotificationRetirementGate({ rootDir = ROOT } = {}) {
  const routeExists = fileExists(rootDir, TRANSITION_ROUTE_FILE);
  if (routeExists) {
    const missingTerms = missingProposalTerms(rootDir);
    return {
      routeExists,
      failures: missingTerms.map(
        (term) => `${TRANSFER_PROPOSAL_FILE} is missing production checklist term: ${term}`,
      ),
      missingCheckedTerms: missingTerms,
    };
  }

  if (!fileExists(rootDir, TRANSFER_PROPOSAL_FILE)) {
    return {
      routeExists,
      failures: [
        `${TRANSITION_ROUTE_FILE} is missing, but ${TRANSFER_PROPOSAL_FILE} is also missing. Keep the transition route until production handoff evidence is recorded.`,
      ],
      missingCheckedTerms: REQUIRED_CHECKED_TERMS,
    };
  }

  const proposal = readText(rootDir, TRANSFER_PROPOSAL_FILE);
  const missingCheckedTerms = REQUIRED_CHECKED_TERMS.filter(
    (term) => !hasCheckedTerm(proposal, term),
  );
  const failures = missingCheckedTerms.map(
    (term) =>
      `${TRANSITION_ROUTE_FILE} was retired before the v13 transfer proposal recorded checked production evidence for: ${term}`,
  );

  return {
    routeExists,
    failures,
    missingCheckedTerms,
  };
}

export function formatNotificationRetirementGateReport(result) {
  if (result.routeExists) {
    return [
      "[notification-retirement-gate] PASS: v13 transition email worker route is still retained.",
      "Production handoff evidence is still required before retiring it.",
    ].join("\n");
  }

  if (result.failures.length > 0) {
    return [
      "[notification-retirement-gate] FAIL: v13 transition route was removed without complete production handoff evidence.",
      ...result.failures.map((failure) => `- ${failure}`),
    ].join("\n");
  }

  return "[notification-retirement-gate] PASS: v13 transition route is retired and production handoff evidence is checked in the transfer proposal.";
}

function main() {
  const result = evaluateNotificationRetirementGate();
  const report = formatNotificationRetirementGateReport(result);
  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
