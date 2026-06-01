// Fix React #130: antd compound sub-components (Typography.Title/Paragraph) are
// undefined when destructured in a Server Component (antd is a "use client"
// package -> RSC client-reference proxy has no attached sub-components).
// Move these presentational components into the client boundary.
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "src/components/shared/PlaceholderPage.tsx",
  "src/components/writing/QuestionPrompt.tsx",
  "src/components/admin/AdminOrgKpiCards.tsx",
  "src/components/feedback/DimensionCardGrid.tsx",
  "src/components/feedback/FeedbackSummary.tsx",
  "src/components/feedback/SentenceFeedbackList.tsx",
  "src/components/learning/RecommendationCard.tsx",
  "src/components/learning/UpcomingExamCard.tsx",
  "src/components/reports/ComparisonReportView.tsx",
  "src/components/reports/MetricsTable.tsx",
  "src/components/reports/SubmissionDiffPanel.tsx",
];

let changed = 0;
for (const f of FILES) {
  const src = readFileSync(f, "utf8");
  const firstNonEmpty = src.split("\n").find((l) => l.trim().length > 0) ?? "";
  if (/^["']use client["'];?/.test(firstNonEmpty.trim())) {
    console.log("skip (already client): " + f);
    continue;
  }
  writeFileSync(f, '"use client";\n\n' + src);
  changed++;
  console.log("added use client: " + f);
}
console.log(`\n${changed} files changed.`);
