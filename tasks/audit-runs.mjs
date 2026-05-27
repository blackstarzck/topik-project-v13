#!/usr/bin/env node
// One-shot audit of docs/ai-workflow/runs/ folder.
// P2-5 of audit report. Not committed — temporary script.

import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";

const ROOT = "docs/ai-workflow/runs";
const LEDGER_PATTERN = /^docs\/ai-workflow\/runs\/\d{4}\/\d{2}\/\d{2}\/\d{8}-\d{4}-.+\.md$/;
const REQUIRED_SECTIONS = [
  "## Docs Consulted",
  "## Verification State",
  "## Ledger/File-State Consistency",
];
const CROSS_MODEL_PATTERN = /Cross-model review:\s*(.+?)\s*$/im;

function norm(p) {
  return p.split(sep).join("/");
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(norm(p));
  }
  return out;
}

const all = await walk(ROOT);
const markdowns = all.filter((p) => p.endsWith(".md"));
const htmls = all.filter((p) => p.endsWith(".html"));
const other = all.filter((p) => !p.endsWith(".md") && !p.endsWith(".html"));

let findings = 0;
const report = [];
report.push(`# runs/ 폴더 전수 감사 (P2-5)`);
report.push(``);
report.push(`스캔 대상: ${all.length} files (md: ${markdowns.length}, html: ${htmls.length}, other: ${other.length})`);

// 1. Naming convention
const badName = [];
for (const p of markdowns) {
  if (p === "docs/ai-workflow/runs/README.md") continue;
  if (!LEDGER_PATTERN.test(p)) {
    badName.push(p);
    findings++;
  }
}
report.push(``);
report.push(`## 1. Naming convention (YYYY/MM/DD/YYYYMMDD-HHMM-slug.md)`);
if (badName.length === 0) report.push(`- 위반 0건 ✅`);
else for (const p of badName) report.push(`- ❌ ${p}`);

// 2. Required sections + key fields
const missingSection = [];
const missingCrossModel = [];
const missingUntouched = [];
for (const p of markdowns) {
  if (p === "docs/ai-workflow/runs/README.md") continue;
  if (badName.includes(p)) continue;
  const content = await readFile(p, "utf8");
  for (const s of REQUIRED_SECTIONS) {
    if (!content.includes(s)) {
      missingSection.push(`${p} :: missing ${s}`);
      findings++;
    }
  }
  const m = content.match(CROSS_MODEL_PATTERN);
  if (!m || m[1].trim().length === 0) {
    missingCrossModel.push(p);
    findings++;
  }
  const lines = content.split(/\r?\n/);
  let untouchedOk = false;
  let untouchedFound = false;
  for (let i = 0; i < lines.length; i++) {
    const mm = lines[i].match(/^\s*-?\s*Untouched relevant docs[^:]*:\s*(.*)$/i);
    if (!mm) continue;
    untouchedFound = true;
    if (mm[1].trim().length > 0) {
      untouchedOk = true;
      break;
    }
    for (let j = i + 1; j < lines.length; j++) {
      const nx = lines[j];
      if (nx.trim().length === 0) continue;
      if (/^##\s+/.test(nx)) break;
      if (/^\S/.test(nx)) break;
      const indented = nx.trim();
      if (/^-\s*$/.test(indented)) continue;
      untouchedOk = true;
      break;
    }
    break;
  }
  if (!untouchedFound || !untouchedOk) {
    missingUntouched.push(p);
    findings++;
  }
}

report.push(``);
report.push(`## 2. Required sections`);
if (missingSection.length === 0) report.push(`- 위반 0건 ✅`);
else for (const m of missingSection) report.push(`- ❌ ${m}`);

report.push(``);
report.push(`## 3. Cross-model review 필드`);
if (missingCrossModel.length === 0) report.push(`- 위반 0건 ✅`);
else for (const p of missingCrossModel) report.push(`- ❌ ${p}`);

report.push(``);
report.push(`## 4. Untouched relevant docs 필드 (P1-2 신규)`);
if (missingUntouched.length === 0) report.push(`- 위반 0건 ✅`);
else for (const p of missingUntouched) report.push(`- ❌ ${p}`);

report.push(``);
report.push(`## 5. 비-md 파일`);
if (htmls.length === 0 && other.length === 0) report.push(`- 비-md 파일 0건 ✅`);
else {
  if (htmls.length > 0) report.push(`- HTML companions: ${htmls.length}건 (참고용)`);
  for (const p of other) report.push(`- ⚠️ Unknown extension: ${p}`);
}

report.push(``);
report.push(`## 종합`);
report.push(`- 총 발견: **${findings}건**`);
report.push(`- 검사 대상 markdown: ${markdowns.length}건`);

console.log(report.join("\n"));
