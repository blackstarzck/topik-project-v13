// Coordinator assembler: turn independent adjudication results into
// merge-compatible manual-review.json (legacy filename = GPT-5.5 adjudication slot).
import { readFileSync, writeFileSync } from "node:fs";

const dir = "reports/ia-verification/runs/20260601-120308";
const WF_RUN = "wf_964a4835-363";
const OUT = process.argv[2];
const now = new Date().toISOString();

const manifest = JSON.parse(readFileSync(`${dir}/ia-manifest.json`, "utf8"));
const meta = {
  runId: manifest.runId,
  sourceCommit: manifest.sourceCommit,
  dirtyState: manifest.dirtyState,
  evidenceBundleId: manifest.evidenceBundleId,
};

const wrap = JSON.parse(readFileSync(OUT, "utf8"));
const groups = wrap.result;

const rows = [];
for (const g of groups) {
  for (const r of g.rows || []) {
    rows.push({
      ...meta,
      iaCode: r.iaCode,
      aiUxReviewRowId: `${r.iaCode}-ai-ux`,
      reviewerType: "independent-adjudicator",
      adjudicatorModel: "claude-opus-4.8 (independent session)",
      adjudicatorRole: "independent-adjudicator",
      source: "delegated-independent-adjudication",
      adjudicationReference: `${WF_RUN}/${g.group}`,
      adjudicatedAt: now,
      degradedMode:
        "GPT-5.5 unavailable in this harness; cross-family Codex adjudication blocked by known Windows Korean-mojibake issue (ledger memory codex-review-mojibake-windows). Independent same-family Claude adjudicator used as documented fallback, separate session from first-pass shard reviewers.",
      questionsReviewed: r.questionsReviewed || [],
      challengedClaims: r.challengedClaims || [],
      koreanCopyVerdict: r.koreanCopyVerdict || "",
      policyOrWordingConcerns: r.policyOrWordingConcerns || [],
      acceptedRisks: r.acceptedRisks || [],
      finalUxUiResult: r.finalUxUiResult,
      adjudicationStatus: r.adjudicationStatus,
      confirmationStatus: r.confirmationStatus,
      status: r.status,
      blockingReasons: r.blockingReasons || [],
    });
  }
}

const tally = (arr, key) =>
  arr.reduce((t, x) => ((t[x[key]] = (t[x[key]] || 0) + 1), t), {});

const manual = {
  ...meta,
  generatedBy: "coordinator assembler from independent adjudication (workflow " + WF_RUN + ")",
  generatedAt: now,
  reviewerNote:
    "manual-review.json is the legacy filename for the judgment-sensitive adjudication slot. Rows here are independent adjudications (Claude Opus 4.8, separate session from shard reviewers) of the 18 human-confirmation IA items. Each row records confirmationStatus, finalUxUiResult, challenged claims, Korean copy verdict, and policy concerns.",
  crossAuditMethodology:
    "Two-layer: (1) 6 IA shard reviewers produced first-pass cards from evidence+screenshots; (2) 6 independent adjudicators (fresh agents) challenged the cards' judgment-sensitive questions and rendered final UX/UI + Korean-copy + policy judgment.",
  adjudicatorModel: "claude-opus-4.8",
  degradedMode:
    "GPT-5.5 not available in harness; cross-family Codex blocked by Windows Korean-mojibake; independent Claude adjudication used (documented fallback).",
  rows,
  summary: {
    totalRows: rows.length,
    confirmationStatusCounts: tally(rows, "confirmationStatus"),
    finalUxUiResultCounts: tally(rows, "finalUxUiResult"),
  },
  status: "complete",
};
writeFileSync(`${dir}/manual-review.json`, JSON.stringify(manual, null, 2));
console.log(`manual-review.json: ${rows.length} adjudication rows`);
console.log("confirmationStatus:", JSON.stringify(manual.summary.confirmationStatusCounts));
console.log("finalUxUiResult:", JSON.stringify(manual.summary.finalUxUiResultCounts));
const expected = ["A-01","A-02","A-03","C-03","D-M1","F-M1","G-01","H-01","X-03","X-04","X-05","X-06","X-07","X-08","X-09","X-10","X-11","X-12"];
const got = new Set(rows.map((r) => r.iaCode));
console.log("MISSING adjudication rows:", expected.filter((x) => !got.has(x)).join(",") || "none");
