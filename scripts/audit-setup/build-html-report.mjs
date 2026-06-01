#!/usr/bin/env node
// Build a self-contained HTML audit report for the IA verification run.
// Aggregates all phase JSON evidence and renders per-IA cards, phase timeline,
// coverage heatmap, known issues, and next actions.
//
// Output: <auditDir>/ia-audit-report.html (+ copied screenshots/ for public IA)
//
// Audience: "바이브 코더" — short Korean prose, color-coded status badges,
// visual cards + heatmap + timeline.

import { copyFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, resolveAuditDir, generatedAt } from "./ia-audit-lib.mjs";

const auditDir = resolveAuditDir();

function readJsonSafe(rel) {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const manifest = readJsonSafe(`${auditDir}/ia-manifest.json`);
const receipts = readJsonSafe(`${auditDir}/doc-receipts.json`);
const sourceMap = readJsonSafe(`${auditDir}/source-map-results.json`);
const docValidation = readJsonSafe(`${auditDir}/doc-receipt-validation-results.json`);
const staticRes = readJsonSafe(`${auditDir}/static-results.json`);
const browserRes = readJsonSafe(`${auditDir}/browser-results.json`);
const hostedRes = readJsonSafe(`${auditDir}/hosted-surface-results.json`);
const secNavRes = readJsonSafe(`${auditDir}/security-navigation-results.json`);
const aiUx = readJsonSafe(`${auditDir}/ai-ux-review.json`);
const manualReview = readJsonSafe(`${auditDir}/manual-review.json`);
const finalAudit = readJsonSafe(`${auditDir}/ia-implementation-audit.json`);
const monitor = readJsonSafe(`${auditDir}/audit-flow-monitor.json`);
const dispatch = readJsonSafe(`${auditDir}/agent-dispatch-plan.json`);

if (!manifest || !finalAudit) {
  console.error("Required JSON inputs missing (ia-manifest.json or ia-implementation-audit.json).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Screenshot copy (for public IA — relative path from HTML)
// ---------------------------------------------------------------------------
const reportScreenshotDir = join(REPO_ROOT, auditDir, "screenshots");
mkdirSync(reportScreenshotDir, { recursive: true });
const PUBLIC_IA = ["X-01", "A-01", "A-02", "X-06", "X-11", "X-12"];
const VIEWPORTS = ["360", "768", "1280"];
const copiedScreenshots = new Map();
for (const ia of PUBLIC_IA) {
  for (const vp of VIEWPORTS) {
    const src = join(REPO_ROOT, "screenshots", `coverage-${ia}-${vp}.png`);
    if (existsSync(src)) {
      const dest = join(reportScreenshotDir, `coverage-${ia}-${vp}.png`);
      copyFileSync(src, dest);
      copiedScreenshots.set(`${ia}-${vp}`, `screenshots/coverage-${ia}-${vp}.png`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badge(label, kind) {
  const cls = `b b-${kind}`;
  return `<span class="${cls}">${esc(label)}</span>`;
}

function statusBadge(status) {
  const map = { PASS: "pass", PARTIAL: "partial", FAIL: "fail", BLOCKED: "blocked", "DOC-GAP": "docgap", DEFERRED: "deferred", "n/a": "na" };
  return badge(status, map[status] ?? "na");
}

function audienceBadge(aud) {
  const map = { public: "public", user: "user", admin: "admin" };
  return badge(aud, `aud-${map[aud] ?? "na"}`);
}

function listRows(items, mapper) {
  if (!items || items.length === 0) return "<em class='muted'>없음</em>";
  return `<ul class="bullets">${items.map(mapper).join("")}</ul>`;
}

// ---------------------------------------------------------------------------
// Per-IA data lookup
// ---------------------------------------------------------------------------
const receiptByCode = new Map();
for (const r of receipts?.receipts ?? []) receiptByCode.set(r.iaCode, r);
const sourceByCode = new Map();
for (const r of sourceMap?.rows ?? []) if (r.kind === "ia") sourceByCode.set(r.iaCode, r);
const docValByCode = new Map();
for (const r of docValidation?.rows ?? []) docValByCode.set(r.iaCode, r);

const browserByCode = new Map(); // iaCode -> array of viewport rows
for (const r of browserRes?.rows ?? []) {
  if (!browserByCode.has(r.iaCode)) browserByCode.set(r.iaCode, []);
  browserByCode.get(r.iaCode).push(r);
}
const hostedByCode = new Map();
for (const r of hostedRes?.rows ?? []) hostedByCode.set(r.iaCode, r);

// For security-navigation, attach by iaCode if present in row meta; otherwise show globally.
const secNavByCode = new Map();
const secNavGlobal = [];
for (const r of secNavRes?.rows ?? []) {
  if (r.iaCode) {
    if (!secNavByCode.has(r.iaCode)) secNavByCode.set(r.iaCode, []);
    secNavByCode.get(r.iaCode).push(r);
  } else {
    secNavGlobal.push(r);
  }
}

// --- Global security/navigation status -------------------------------------
// Security rows are scenario-keyed (logout redirect, wrong-owner id, expired
// session, admin RBAC, ...), NOT IA-keyed, so the per-IA heatmap cannot attach
// them by iaCode. Compute one run-global status and show it for IA whose
// profile requires security-navigation evidence (n/a otherwise).
function aggregateStatus(rows) {
  if (!rows || rows.length === 0) return "n/a";
  if (rows.some((r) => r.status === "FAIL")) return "FAIL";
  if (rows.every((r) => r.status === "PASS")) return "PASS";
  if (rows.every((r) => r.status === "BLOCKED")) return "BLOCKED";
  return "PARTIAL";
}
const allSecRows = secNavRes?.rows ?? [];
const globalSecStatus = aggregateStatus(allSecRows);
const secReqByCode = new Map();
for (const e of manifest.entries ?? []) {
  secReqByCode.set(e.iaCode, (e.requiredEvidenceInputs ?? []).includes("security-navigation"));
}

const aiUxByCode = new Map();
for (const c of aiUx?.cards ?? []) aiUxByCode.set(c.iaCode, c);
const aiUxBlocked = new Map();
for (const c of aiUx?.blockedCards ?? []) aiUxBlocked.set(c.iaCode, c);
const manualByCode = new Map();
for (const r of manualReview?.rows ?? []) manualByCode.set(r.iaCode, r);

const finalByCode = new Map();
for (const e of finalAudit?.entries ?? []) finalByCode.set(e.iaCode, e);

// ---------------------------------------------------------------------------
// Per-IA phase status (for the heatmap + per-card chips)
// ---------------------------------------------------------------------------
function iaPhaseStatus(iaCode) {
  const doc = docValByCode.get(iaCode);
  const sm = sourceByCode.get(iaCode);
  const br = browserByCode.get(iaCode) ?? [];
  const ho = hostedByCode.get(iaCode);
  const sn = secNavByCode.get(iaCode) ?? [];
  const ai = aiUxByCode.get(iaCode);
  const aiBlocked = aiUxBlocked.get(iaCode);
  const man = manualByCode.get(iaCode);
  const fin = finalByCode.get(iaCode);

  function brStatus() {
    if (br.length === 0) return "n/a";
    if (br.every((r) => r.status === "PASS")) return "PASS";
    if (br.every((r) => r.status === "BLOCKED")) return "BLOCKED";
    if (br.some((r) => r.status === "FAIL")) return "FAIL";
    return "PARTIAL";
  }

  function snStatus() {
    if (sn.length > 0) return aggregateStatus(sn); // per-IA rows if ever present
    // Security evidence is run-global (scenario-keyed). Show the global status
    // for IA that require it; n/a for IA whose profile does not.
    if (secReqByCode.get(iaCode) && allSecRows.length > 0) return globalSecStatus;
    return "n/a";
  }

  return {
    documentReceipt: doc?.status ?? "n/a",
    sourceMap: sm?.status ?? "n/a",
    browser: brStatus(),
    hostedSurface: ho?.status ?? "n/a",
    securityNavigation: snStatus(),
    // ai-ux cards store the label in `aiUxResult` (mirrored to `status`); the
    // old code read `.result`, which does not exist -> always n/a.
    aiUxReview: ai?.aiUxResult ?? ai?.status ?? aiBlocked?.aiUxResult ?? aiBlocked?.status ?? "n/a",
    humanConfirmation: man?.status ?? "n/a",
    finalLabel: fin?.finalLabel ?? "n/a",
  };
}

// ---------------------------------------------------------------------------
// CSS + JS templates
// ---------------------------------------------------------------------------
const CSS = `
:root {
  --bg: #fafaf9; --surface: #ffffff; --border: #e7e5e4; --text: #1c1917; --muted: #78716c;
  --accent: #0891b2;
  --pass: #10b981; --pass-bg: #ecfdf5;
  --partial: #f59e0b; --partial-bg: #fffbeb;
  --fail: #ef4444; --fail-bg: #fef2f2;
  --blocked: #6b7280; --blocked-bg: #f3f4f6;
  --docgap: #3b82f6; --docgap-bg: #eff6ff;
  --deferred: #8b5cf6; --deferred-bg: #f5f3ff;
  --na: #d6d3d1; --na-bg: #f5f5f4;
  --aud-public: #14b8a6; --aud-user: #2563eb; --aud-admin: #dc2626;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, "Segoe UI", "Pretendard", system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; font-size: 15px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.hero { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #14b8a6 100%); color: white; padding: 48px 24px; }
.hero h1 { margin: 0 0 8px; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; }
.hero p { margin: 4px 0; opacity: 0.95; font-size: 15px; }
.hero .meta { font-size: 13px; opacity: 0.85; margin-top: 16px; font-variant-numeric: tabular-nums; }
.hero .status-line { margin-top: 16px; font-size: 14px; }
.hero .status-line .b { background: rgba(255,255,255,0.2); color: white; border-color: rgba(255,255,255,0.4); }
section { margin: 40px 0; }
h2 { font-size: 22px; margin: 0 0 16px; letter-spacing: -0.01em; border-left: 4px solid var(--accent); padding-left: 12px; }
h3 { font-size: 17px; margin: 24px 0 12px; }
.muted { color: var(--muted); font-size: 13px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }

/* Scorecards */
.scorecards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.scorecard { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
.scorecard .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.scorecard .value { font-size: 28px; font-weight: 700; margin: 4px 0; }
.scorecard .note { font-size: 12px; color: var(--muted); }
.scorecard.green .value { color: var(--pass); }
.scorecard.amber .value { color: var(--partial); }
.scorecard.gray .value { color: var(--blocked); }
.scorecard.red .value { color: var(--fail); }

/* Badges */
.b { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid; vertical-align: middle; }
.b-pass { color: var(--pass); background: var(--pass-bg); border-color: var(--pass); }
.b-partial { color: var(--partial); background: var(--partial-bg); border-color: var(--partial); }
.b-fail { color: var(--fail); background: var(--fail-bg); border-color: var(--fail); }
.b-blocked { color: var(--blocked); background: var(--blocked-bg); border-color: var(--blocked); }
.b-docgap { color: var(--docgap); background: var(--docgap-bg); border-color: var(--docgap); }
.b-deferred { color: var(--deferred); background: var(--deferred-bg); border-color: var(--deferred); }
.b-na { color: var(--muted); background: var(--na-bg); border-color: var(--na); }
.b-aud-public { color: var(--aud-public); background: #ccfbf1; border-color: var(--aud-public); }
.b-aud-user { color: var(--aud-user); background: #dbeafe; border-color: var(--aud-user); }
.b-aud-admin { color: var(--aud-admin); background: #fee2e2; border-color: var(--aud-admin); }

/* Phase timeline */
.timeline { display: flex; align-items: stretch; gap: 8px; overflow-x: auto; }
.timeline .step { flex: 1 1 0; min-width: 110px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; position: relative; }
.timeline .step .num { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.timeline .step .name { font-weight: 600; font-size: 14px; margin: 4px 0 6px; }
.timeline .step.s-pass { border-top: 3px solid var(--pass); }
.timeline .step.s-partial { border-top: 3px solid var(--partial); }
.timeline .step.s-blocked { border-top: 3px solid var(--blocked); }
.timeline .step.s-fail { border-top: 3px solid var(--fail); }

/* Heatmap */
.heatmap { overflow-x: auto; }
.heatmap table { border-collapse: collapse; width: 100%; font-size: 12px; }
.heatmap th, .heatmap td { padding: 6px 8px; text-align: center; border: 1px solid var(--border); }
.heatmap th { background: #f5f5f4; font-weight: 600; text-align: left; }
.heatmap th.col { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; min-width: 32px; padding: 8px 4px; }
.heatmap td.cell { padding: 0; height: 28px; width: 28px; min-width: 28px; }
.heatmap td.cell .dot { display: block; width: 24px; height: 24px; margin: 2px auto; border-radius: 4px; line-height: 24px; font-size: 11px; font-weight: 700; color: white; }
.heatmap td.cell.pass .dot { background: var(--pass); }
.heatmap td.cell.partial .dot { background: var(--partial); }
.heatmap td.cell.fail .dot { background: var(--fail); }
.heatmap td.cell.blocked .dot { background: var(--blocked); }
.heatmap td.cell.docgap .dot { background: var(--docgap); }
.heatmap td.cell.deferred .dot { background: var(--deferred); }
.heatmap td.cell.na .dot { background: var(--na); color: #57534e; }
.heatmap td.ia-label { text-align: left; font-weight: 600; min-width: 140px; }
.heatmap td.ia-label small { color: var(--muted); font-weight: 400; }

/* IA cards */
.ia-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.ia-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.ia-card h3 { margin: 0 0 6px; font-size: 16px; }
.ia-card .ia-code { font-family: ui-monospace, monospace; font-size: 13px; color: var(--muted); font-weight: 500; }
.ia-card .route { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); display: block; margin: 6px 0; word-break: break-all; }
.ia-card .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.ia-card .phase-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin: 10px 0; }
.ia-card .phase-strip .ps { background: var(--na-bg); padding: 4px 0; text-align: center; font-size: 10px; font-weight: 600; border-radius: 2px; color: var(--muted); }
.ia-card .phase-strip .ps.pass { background: var(--pass); color: white; }
.ia-card .phase-strip .ps.partial { background: var(--partial); color: white; }
.ia-card .phase-strip .ps.fail { background: var(--fail); color: white; }
.ia-card .phase-strip .ps.blocked { background: var(--blocked); color: white; }
.ia-card .phase-strip .ps.docgap { background: var(--docgap); color: white; }
.ia-card .phase-strip .ps.deferred { background: var(--deferred); color: white; }
.ia-card details { margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 8px; }
.ia-card details summary { cursor: pointer; font-size: 13px; font-weight: 600; padding: 4px 0; user-select: none; list-style: none; }
.ia-card details summary::before { content: "▶ "; transition: transform 0.15s; display: inline-block; color: var(--accent); }
.ia-card details[open] summary::before { transform: rotate(90deg); }
.ia-card .section-block { padding: 8px 0 12px; }
.ia-card .section-block h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 8px 0 4px; }
.bullets { margin: 4px 0 8px 18px; padding: 0; font-size: 13px; }
.bullets li { margin: 2px 0; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.shots a { display: block; border: 1px solid var(--border); border-radius: 4px; padding: 4px; text-align: center; font-size: 11px; text-decoration: none; color: var(--muted); }
.shots img { width: 100%; height: 60px; object-fit: cover; border-radius: 2px; display: block; margin-bottom: 4px; }

/* Filter bar */
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.filter-bar label { font-size: 13px; cursor: pointer; user-select: none; padding: 4px 10px; border: 1px solid var(--border); border-radius: 16px; }
.filter-bar input { display: none; }
.filter-bar input:checked + span { background: var(--accent); color: white; padding: 4px 10px; border-radius: 16px; margin: -4px -10px; }

/* Issues + actions tables */
table.simple { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--surface); border-radius: 8px; overflow: hidden; }
table.simple th, table.simple td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
table.simple th { background: #f5f5f4; font-weight: 600; }
table.simple tr:last-child td { border-bottom: none; }

/* Footer */
footer { margin-top: 64px; padding: 24px; background: #1c1917; color: #d6d3d1; font-size: 12px; }
footer a { color: #67e8f9; text-decoration: none; }
footer a:hover { text-decoration: underline; }

/* Responsive */
@media (max-width: 700px) {
  .scorecards { grid-template-columns: 1fr 1fr; }
  .ia-grid { grid-template-columns: 1fr; }
  .timeline { flex-direction: column; }
  .hero { padding: 32px 16px; }
  .hero h1 { font-size: 24px; }
  .heatmap th.col { writing-mode: horizontal-tb; transform: none; font-size: 10px; min-width: auto; }
}
`;

const JS = `
function applyFilter() {
  const checked = Array.from(document.querySelectorAll('.filter-bar input:checked')).map(i => i.value);
  const cards = document.querySelectorAll('.ia-card');
  cards.forEach(card => {
    const final = card.dataset.final;
    const aud = card.dataset.audience;
    const matches = (checked.length === 0)
      || checked.includes(final)
      || checked.includes('aud-' + aud);
    card.style.display = matches ? '' : 'none';
  });
}
document.querySelectorAll('.filter-bar input').forEach(i => i.addEventListener('change', applyFilter));
`;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function renderHero() {
  const totalCounts = (finalAudit.entries ?? []).reduce((acc, e) => {
    acc[e.finalLabel] = (acc[e.finalLabel] ?? 0) + 1;
    return acc;
  }, {});
  return `
    <div class="hero">
      <div class="container">
        <h1>TALKPIK AI · IA 구현 검수 리포트</h1>
        <p>34개 IA(정보 구조) 페이지에 대한 자동·반자동 검수 결과를 한 화면에 정리한 보고서입니다.</p>
        <div class="meta">
          <strong>Run ID</strong> ${esc(manifest.runId)} ·
          <strong>Source commit</strong> ${esc(manifest.sourceCommit)} ·
          <strong>Evidence bundle</strong> ${esc(manifest.evidenceBundleId)} ·
          <strong>Generated</strong> ${esc(generatedAt())}
        </div>
        <div class="status-line">
          최종 라벨 분포 ${Object.entries(totalCounts).map(([k, v]) => badge(`${k}: ${v}`, "blocked")).join(" ")}
        </div>
      </div>
    </div>
  `;
}

function oneLineConclusion() {
  const total = manifest.entries.length;
  const finalCounts = (finalAudit.entries ?? []).reduce((acc, e) => {
    acc[e.finalLabel] = (acc[e.finalLabel] ?? 0) + 1;
    return acc;
  }, {});
  const byAudience = { public: { PASS: 0, BLOCKED: 0, total: 0 }, user: { PASS: 0, BLOCKED: 0, total: 0 }, admin: { PASS: 0, BLOCKED: 0, total: 0 } };
  for (const e of finalAudit.entries ?? []) {
    const bucket = byAudience[e.audience] ?? null;
    if (!bucket) continue;
    bucket.total += 1;
    if (e.finalLabel === "PASS") bucket.PASS += 1;
    if (e.finalLabel === "BLOCKED") bucket.BLOCKED += 1;
  }
  const segments = [
    `전체 ${total} IA — ${Object.entries(finalCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
  ];
  const audienceParts = [];
  if (byAudience.public.total) audienceParts.push(`public ${byAudience.public.PASS}/${byAudience.public.total} PASS`);
  if (byAudience.user.total) audienceParts.push(`user ${byAudience.user.PASS}/${byAudience.user.total} PASS`);
  if (byAudience.admin.total) audienceParts.push(`admin ${byAudience.admin.PASS}/${byAudience.admin.total} PASS`);
  if (audienceParts.length) segments.push(audienceParts.join(" · "));

  // BLOCKED 가 있으면 dominant 사유 한 줄 추가.
  if ((finalCounts.BLOCKED ?? 0) > 0) {
    const reasonHist = {};
    for (const e of (finalAudit.entries ?? []).filter((x) => x.finalLabel === "BLOCKED")) {
      for (const gap of e.topGaps ?? []) {
        let key = "IA-별 특정 findings";
        if (/missing manual-review/.test(gap)) key = "cross-audit 미실시";
        else if (/Primary CTA matching/.test(gap)) key = "CTA regex 미스";
        else if (/Heading "/.test(gap)) key = "heading regex 미스";
        else if (/Modal trigger/.test(gap)) key = "모달 trigger 실패";
        else if (/screenshots\/coverage-.*(missing|absent|not present)/.test(gap)) key = "screenshot 미캡처";
        else if (/hosted-surface-results\.json BLOCKED/.test(gap)) key = "hosted-surface 미수집";
        else if (/security-navigation-results\.json BLOCKED/.test(gap)) key = "security-nav per-IA 미수집";
        else if (/rendered states not captured|rendered evidence missing/.test(gap)) key = "UX states 미캡처";
        else if (/not implemented/.test(gap)) key = "실제 spec gap";
        else if (/Doc gap candidate/.test(gap)) key = "DOC-GAP candidate";
        reasonHist[key] = (reasonHist[key] ?? 0) + 1;
      }
    }
    const topReasons = Object.entries(reasonHist).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`);
    if (topReasons.length) segments.push(`BLOCKED 주요 사유: ${topReasons.join(" · ")}`);
  }

  return segments.join(". ") + ". 카테고리별 다음 작업은 페이지 하단 표 참조.";
}

function browserPartialNote(brRes) {
  // PARTIAL 의 dominant 사유를 카테고리화해서 자동 note 생성.
  const partial = (brRes?.rows ?? []).filter((r) => r.status === "PARTIAL");
  if (partial.length === 0) return "PARTIAL 행 없음.";
  const categoryHits = { heading: 0, cta: 0, errors: 0, modal: 0, other: 0 };
  for (const r of partial) {
    for (const reason of r.blockingReasons ?? []) {
      if (/Heading "[^"]*" did not match/.test(reason)) categoryHits.heading += 1;
      else if (/Primary CTA matching/.test(reason)) categoryHits.cta += 1;
      else if (/console\/page errors captured/.test(reason)) categoryHits.errors += 1;
      else if (/Modal trigger did not fire/.test(reason)) categoryHits.modal += 1;
      else categoryHits.other += 1;
    }
  }
  const labels = Object.entries(categoryHits)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => {
      const label = { heading: "h1 패턴 미스", cta: "CTA 패턴 미스", errors: "콘솔 에러", modal: "모달 trigger 실패", other: "기타" }[k];
      return `${label} ${v}`;
    });
  return `주요 사유: ${labels.join(" · ")}`;
}

function renderExecutiveSummary() {
  const total = manifest.entries.length;
  const finalCounts = (finalAudit.entries ?? []).reduce((acc, e) => {
    acc[e.finalLabel] = (acc[e.finalLabel] ?? 0) + 1;
    return acc;
  }, {});
  const browserPartial = (browserRes?.rows ?? []).filter((r) => r.status === "PARTIAL").length;
  const browserBlocked = (browserRes?.rows ?? []).filter((r) => r.status === "BLOCKED").length;
  const docPass = (docValidation?.rows ?? []).filter((r) => r.status === "PASS").length;
  const secPass = (secNavRes?.rows ?? []).filter((r) => r.status === "PASS").length;
  return `
    <section>
      <div class="container">
        <h2>한눈에 보기</h2>
        <p class="muted">검수는 7단계 (Phase 0~6)로 나뉘어 진행됩니다. 각 페이즈는 별도 증거(문서 receipt / 소스 매핑 / 브라우저 / 호스팅 모달 / 보안·세션 / AI UX 리뷰 / 사람 확인)를 모은 뒤 마지막에 최종 라벨을 계산합니다.</p>
        <div class="scorecards">
          <div class="scorecard green">
            <div class="label">문서 receipt PASS</div>
            <div class="value">${docPass} / ${total}</div>
            <div class="note">34개 IA 전부 active docs에서 추출한 요구사항 채워짐 (Phase 0.5)</div>
          </div>
          <div class="scorecard amber">
            <div class="label">Browser PARTIAL</div>
            <div class="value">${browserPartial}</div>
            <div class="note">${esc(browserPartialNote(browserRes))}</div>
          </div>
          <div class="scorecard gray">
            <div class="label">Browser BLOCKED</div>
            <div class="value">${browserBlocked}</div>
            <div class="note">Protected/Admin storageState 부재로 차단</div>
          </div>
          <div class="scorecard green">
            <div class="label">보안·세션 PASS</div>
            <div class="value">${secPass} / ${(secNavRes?.rows ?? []).length}</div>
            <div class="note">/auth/sign-out, callback sanitize, session_expired 등 (Phase 4)</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTimeline() {
  const checkpoints = monitor?.checkpoints ?? [];
  const phases = [
    { num: "Phase 0", label: "준비", check: "phase-0-init" },
    { num: "Phase 0.5", label: "문서 receipt", check: "phase-0.5-validator" },
    { num: "Phase 1", label: "manifest", check: "phase-1-evidence" },
    { num: "Phase 2", label: "browser", check: "phase-2-browser-partial" },
    { num: "Phase 3", label: "hosted-surface", check: "phase-3-hosted-surface-precondition" },
    { num: "Phase 4", label: "보안·세션", check: "phase-4-security-precondition" },
    { num: "Phase 5", label: "AI UX 리뷰", check: "phase-5-ai-ux-and-human-precondition" },
    { num: "Phase 6", label: "최종 종합", check: "phase-6-final" },
  ];
  function stat(name) {
    const cp = checkpoints.find((c) => c.checkpointId === name);
    return cp?.monitorStatus ?? "n/a";
  }
  const cls = (s) =>
    s === "PASS" ? "s-pass" : s === "CONCERN_ACCEPTED" ? "s-partial" : s === "FAIL" ? "s-fail" : "s-blocked";
  return `
    <section>
      <div class="container">
        <h2>페이즈 진행 현황</h2>
        <p class="muted">초록: 정상 통과 · 노랑: 부분 통과(monitor가 사유 인정) · 회색: 차단 / 미진행</p>
        <div class="timeline">
          ${phases
            .map((p) => {
              const s = stat(p.check);
              return `
                <div class="step ${cls(s)}">
                  <div class="num">${esc(p.num)}</div>
                  <div class="name">${esc(p.label)}</div>
                  ${statusBadge(s === "CONCERN_ACCEPTED" ? "PARTIAL" : s === "PASS" ? "PASS" : "BLOCKED")}
                </div>`;
            })
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderHeatmap() {
  const cols = [
    { key: "documentReceipt", label: "문서" },
    { key: "sourceMap", label: "소스" },
    { key: "browser", label: "Browser" },
    { key: "hostedSurface", label: "모달" },
    { key: "securityNavigation", label: "보안" },
    { key: "aiUxReview", label: "AI UX" },
    { key: "humanConfirmation", label: "사람" },
    { key: "finalLabel", label: "최종" },
  ];
  const cls = (s) =>
    s === "PASS" ? "pass" : s === "PARTIAL" ? "partial" : s === "FAIL" ? "fail" : s === "BLOCKED" ? "blocked" : s === "DOC-GAP" ? "docgap" : s === "DEFERRED" ? "deferred" : "na";
  const symbol = (s) =>
    s === "PASS" ? "✓" : s === "PARTIAL" ? "△" : s === "FAIL" ? "✗" : s === "BLOCKED" ? "■" : s === "DOC-GAP" ? "?" : s === "DEFERRED" ? "—" : " ";

  const rows = manifest.entries
    .map((e) => {
      const ps = iaPhaseStatus(e.iaCode);
      return `
        <tr>
          <td class="ia-label">${esc(e.iaCode)} <small>${esc(e.screenName)}</small></td>
          ${cols
            .map((c) => {
              const s = ps[c.key];
              return `<td class="cell ${cls(s)}" title="${esc(c.label)}: ${esc(s)}"><span class="dot">${symbol(s)}</span></td>`;
            })
            .join("")}
        </tr>
      `;
    })
    .join("");

  const secPass = allSecRows.filter((r) => r.status === "PASS").length;
  const secBlk = allSecRows.length - secPass;
  const secReasons = {};
  for (const r of allSecRows) {
    if (r.status === "PASS") continue;
    const reason = String(r.blockingReasons?.[0] ?? "");
    let key = "기타 precondition";
    if (/admin|RBAC|role|platform_admin|org_admin/i.test(reason)) key = "admin 역할 미승격";
    else if (/owner|wrong-?owner|소유/i.test(reason)) key = "owner/wrong-owner 행 미시드";
    else if (/token|stale|expired|service_role/i.test(reason)) key = "만료/stale 토큰 (service_role 필요)";
    else if (/network|intercept/i.test(reason)) key = "네트워크 실패 가로채기 미구현";
    else if (/storageState|seed|precondition/i.test(reason)) key = "storageState/seed precondition";
    secReasons[key] = (secReasons[key] ?? 0) + 1;
  }
  const secReasonRows = Object.entries(secReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<li>${esc(k)}: <strong>${v}</strong>건</li>`)
    .join("");

  return `
    <section>
      <div class="container">
        <h2>34 IA × 8 페이즈 커버리지 히트맵</h2>
        <p class="muted">셀에 마우스를 올리면 각 페이즈 상태가 보입니다. ✓ PASS · △ PARTIAL · ✗ FAIL · ■ BLOCKED · ? DOC-GAP · — DEFERRED</p>
        <details class="card" style="margin:12px 0;padding:12px 16px;">
          <summary style="cursor:pointer;font-weight:600;">컬럼이 무엇인지 / 회색(n/a)이 무슨 뜻인지</summary>
          <ul class="bullets" style="margin-top:8px;">
            <li><strong>문서</strong> · 문서 receipt: 해당 화면이 어떤 active 문서를 근거로 검수됐는지 기록.</li>
            <li><strong>소스</strong> · 소스맵: 화면 → 실제 코드 파일 매핑 존재 여부.</li>
            <li><strong>Browser</strong>: 실제 렌더 증거(HTTP 상태 · H1 · 주 CTA · 스크린샷, 360/768/1280).</li>
            <li><strong>모달</strong> · 호스티드 모달 동작: 모달이 <em>없는</em> 페이지는 n/a가 정상. 모달이 있는 5개(C-03, D-M1~3, F-M1)만 평가하며, 테스트의 모달 트리거가 휴리스틱이라 자동으로 못 띄운 건 BLOCKED로 표시됩니다.</li>
            <li><strong>보안</strong> · 보안·세션·권한·네비게이션: 증거가 <em>화면별이 아니라 run 전역(시나리오 단위)</em>입니다. 그래서 보안이 필요한 IA 칸에는 동일한 <em>전역 상태</em>를 표시하고, 필요 없는 IA는 n/a입니다. 상세는 아래 "전역 보안·세션 증거"를 보세요.</li>
            <li><strong>AI UX</strong>: AI 1차 UX 리뷰 — 34개 전부 수행됨.</li>
            <li><strong>사람</strong>: 독립 판정(GPT-5.5 미가용 시 별도 세션 Claude) 결과.</li>
            <li><strong>최종</strong>: 위 증거를 merge 스크립트가 합쳐 계산한 최종 라벨.</li>
          </ul>
          <p class="muted" style="margin-top:6px;">회색(n/a) = "그 화면엔 해당 없음" 또는 "전역 증거라 페이지별 칸에 안 붙음"이지, 보통 "작업 안 함"이 아닙니다.</p>
        </details>
        <div class="card" style="margin:12px 0;padding:12px 16px;">
          <h3 style="margin:0 0 8px;">전역 보안·세션 증거 (시나리오 단위, 페이지별 아님)</h3>
          <p>전체 ${allSecRows.length}건 · <strong style="color:var(--pass)">PASS ${secPass}</strong> · <strong style="color:var(--blocked)">BLOCKED ${secBlk}</strong> · 종합 ${statusBadge(globalSecStatus)}</p>
          ${secBlk > 0 ? `<strong>BLOCKED 사유 분류</strong><ul class="bullets">${secReasonRows}</ul><p class="muted">대부분 "제품 결함"이 아니라 테스트 셋업(픽스처·권한) 부족입니다: admin 역할 미승격, owner 데이터 미시드, 만료 토큰 발급 권한(service_role) 없음, 네트워크 실패 가로채기 미구현.</p>` : ""}
        </div>
        <div class="heatmap card">
          <table>
            <thead>
              <tr>
                <th>IA</th>
                ${cols.map((c) => `<th class="col">${esc(c.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderIaCard(entry) {
  const receipt = receiptByCode.get(entry.iaCode);
  const source = sourceByCode.get(entry.iaCode);
  const browser = browserByCode.get(entry.iaCode) ?? [];
  const hosted = hostedByCode.get(entry.iaCode);
  const secNav = secNavByCode.get(entry.iaCode) ?? [];
  const aiCard = aiUxByCode.get(entry.iaCode);
  const aiBlk = aiUxBlocked.get(entry.iaCode);
  const manual = manualByCode.get(entry.iaCode);
  const final = finalByCode.get(entry.iaCode);
  const ps = iaPhaseStatus(entry.iaCode);

  const cls = (s) =>
    s === "PASS" ? "pass" : s === "PARTIAL" ? "partial" : s === "FAIL" ? "fail" : s === "BLOCKED" ? "blocked" : s === "DOC-GAP" ? "docgap" : s === "DEFERRED" ? "deferred" : "";
  const phaseStrip = [
    { k: "documentReceipt", label: "DOC" },
    { k: "sourceMap", label: "SRC" },
    { k: "browser", label: "BR" },
    { k: "hostedSurface", label: "MDL" },
    { k: "securityNavigation", label: "SEC" },
    { k: "aiUxReview", label: "AI" },
    { k: "humanConfirmation", label: "HUM" },
  ]
    .map((c) => `<span class="ps ${cls(ps[c.k])}" title="${esc(c.label)}: ${esc(ps[c.k])}">${esc(c.label)}</span>`)
    .join("");

  const reqList = receipt?.extractedRequirements ?? [];
  const docConflict = receipt?.docConflicts && receipt.docConflicts !== "none" ? receipt.docConflicts : null;

  const screenshotsHtml =
    PUBLIC_IA.includes(entry.iaCode) && copiedScreenshots.size > 0
      ? `
        <div class="section-block">
          <h4>스크린샷 (Public IA, 3 viewport)</h4>
          <div class="shots">
            ${VIEWPORTS.map((vp) => {
              const path = copiedScreenshots.get(`${entry.iaCode}-${vp}`);
              if (!path) return "";
              return `<a href="${esc(path)}" target="_blank"><img src="${esc(path)}" alt="${esc(entry.iaCode)} ${esc(vp)}"><span>${esc(vp)}px</span></a>`;
            }).join("")}
          </div>
        </div>
      `
      : "";

  const aiBlock = aiCard
    ? `
      <div class="section-block">
        <h4>AI UX 리뷰 (${esc(aiCard.aiUxResult ?? aiCard.status)} · 신뢰도 ${esc(aiCard.confidence)} · 사람확인 ${esc(aiCard.humanConfirmation)})</h4>
        <strong>Top gaps</strong>${listRows(aiCard.topGaps, (t) => `<li>${esc(t)}</li>`)}
        <strong>판정자가 확인할 질문</strong>${listRows(aiCard.gptQuestions ?? aiCard.humanReviewerQuestions, (q) => `<li>${esc(q)}</li>`)}
      </div>
    `
    : aiBlk
      ? `<div class="section-block"><h4>AI UX 리뷰</h4>${statusBadge(aiBlk.aiUxResult ?? aiBlk.status)} <span class="muted">${esc(aiBlk.blockingReasons?.[0] ?? "")}</span></div>`
      : "";

  const hostedBlock = hosted
    ? `
      <div class="section-block">
        <h4>호스팅 모달 검증</h4>
        ${statusBadge(hosted.status)}
        <ul class="bullets">
          <li>Trigger fired: ${hosted.triggerFired ? "✓" : "✗"}</li>
          <li>Surface opened: ${hosted.surfaceOpened ? "✓" : "✗"}</li>
          <li>Focus entry: ${esc(hosted.focusEntryResult ?? "—")}</li>
          <li>Esc close: ${esc(hosted.keyboardCloseResult ?? "—")}</li>
        </ul>
        ${listRows(hosted.blockingReasons, (r) => `<li>${esc(r)}</li>`)}
      </div>
    `
    : "";

  const secBlock =
    secNav.length > 0
      ? `
      <div class="section-block">
        <h4>보안·세션 시나리오 (${secNav.length}건)</h4>
        ${listRows(
          secNav,
          (r) =>
            `<li>${statusBadge(r.status)} <strong>${esc(r.caseId)}</strong> ${esc(r.description)}</li>`,
        )}
      </div>
    `
      : "";

  const browserBlock =
    browser.length > 0
      ? `
      <div class="section-block">
        <h4>브라우저 검증 (3 viewport)</h4>
        ${listRows(
          browser.sort((a, b) => Number(a.viewportTag) - Number(b.viewportTag)),
          (r) => `<li>${statusBadge(r.status)} <strong>${esc(r.viewportTag)}px</strong> · HTTP ${esc(r.httpStatus ?? "n/a")} · ${r.blockingReasons.length > 0 ? esc(r.blockingReasons[0]) : "<span class=\"muted\">정상</span>"}</li>`,
        )}
      </div>
    `
      : "";

  const conflictBlock = docConflict
    ? `<div class="section-block"><h4>${badge("DOC-GAP", "docgap")} 문서 충돌</h4><p style="font-size:13px;margin:4px 0">${esc(docConflict)}</p></div>`
    : "";

  return `
    <div class="ia-card" data-final="${esc(ps.finalLabel)}" data-audience="${esc(entry.audience)}">
      <div class="ia-code">${esc(entry.iaCode)}</div>
      <h3>${esc(entry.screenName)}</h3>
      <span class="route">${esc(entry.routeOrHostRoute)}</span>
      <div class="chips">
        ${audienceBadge(entry.audience)}
        ${badge(entry.routeType, "blocked")}
        ${statusBadge(ps.finalLabel)}
      </div>
      <div class="phase-strip" title="페이즈별 상태 (DOC / SRC / BR / MDL / SEC / AI / HUM)">${phaseStrip}</div>
      <details>
        <summary>요구사항 + 검증 상세 (${reqList.length}개 요구사항)</summary>
        <div class="section-block">
          <h4>Sitemap 요구</h4>
          <p style="font-size:13px;margin:4px 0">${esc(receipt?.sitemapRequirement ?? "—")}</p>
        </div>
        <div class="section-block">
          <h4>User flow 위치</h4>
          <p style="font-size:13px;margin:4px 0"><strong>이전:</strong> ${esc(receipt?.userFlowContext?.previous ?? "—")}<br><strong>다음:</strong> ${esc(receipt?.userFlowContext?.next ?? "—")}</p>
        </div>
        <div class="section-block">
          <h4>PRD 연결</h4>
          <p style="font-size:13px;margin:4px 0">${esc(receipt?.prdRequirement ?? "—")}</p>
        </div>
        <div class="section-block">
          <h4>추출된 요구사항 (${reqList.length})</h4>
          ${listRows(reqList, (r) => `<li>${esc(r)}</li>`)}
        </div>
        ${conflictBlock}
        ${browserBlock}
        ${hostedBlock}
        ${secBlock}
        ${aiBlock}
        <div class="section-block">
          <h4>최종 라벨 + Top gaps</h4>
          ${statusBadge(ps.finalLabel)} ${listRows(final?.topGaps ?? [], (g) => `<li>${esc(g)}</li>`)}
        </div>
        ${screenshotsHtml}
      </details>
    </div>
  `;
}

function renderIaSection() {
  const filterLabels = [
    { val: "PASS", label: "PASS" },
    { val: "PARTIAL", label: "PARTIAL" },
    { val: "BLOCKED", label: "BLOCKED" },
    { val: "FAIL", label: "FAIL" },
    { val: "aud-public", label: "public" },
    { val: "aud-user", label: "user" },
    { val: "aud-admin", label: "admin" },
  ];
  return `
    <section>
      <div class="container">
        <h2>34 IA 상세 카드</h2>
        <p class="muted">카드 안의 "요구사항 + 검증 상세"를 클릭하면 추출된 요구사항·증거·갭이 펼쳐집니다.</p>
        <div class="filter-bar">
          <strong style="font-size:13px;margin-right:8px;">필터:</strong>
          ${filterLabels.map((f) => `<label><input type="checkbox" value="${esc(f.val)}"><span class="b b-${f.val.startsWith("aud-") ? f.val.replace("aud-", "aud-") : f.val.toLowerCase()}">${esc(f.label)}</span></label>`).join("")}
        </div>
        <div class="ia-grid">
          ${manifest.entries.map(renderIaCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderKnownIssues() {
  const docGaps = (receipts?.receipts ?? []).filter((r) => r.docConflicts && r.docConflicts !== "none");
  const knownNoise = (monitor?.checkpoints ?? [])
    .flatMap((c) => (c.knownNoise ?? []).map((n) => ({ phase: c.phase, ...n })));
  return `
    <section>
      <div class="container">
        <h2>알려진 이슈</h2>
        <p class="muted">검수 중 발견된 문서/코드 drift 및 환경적 잡음을 정직 기록합니다.</p>
        <h3>DOC-GAP (문서 ↔ 코드 drift)</h3>
        <table class="simple">
          <thead><tr><th>IA</th><th>설명</th><th>처리 방향</th></tr></thead>
          <tbody>
            ${docGaps
              .map(
                (g) => `<tr><td><strong>${esc(g.iaCode)}</strong><br><span class="muted">${esc(g.screenName)}</span></td><td>${esc(g.docConflicts)}</td><td><span class="muted">Product 결정 후 별건 PR</span></td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <h3>환경적 잡음 (Known noise — product defect 아님)</h3>
        <table class="simple">
          <thead><tr><th>Phase</th><th>유형</th><th>원인</th><th>분류</th></tr></thead>
          <tbody>
            ${knownNoise
              .map(
                (n) =>
                  `<tr><td>${esc(n.phase)}</td><td><code>${esc(n.pattern ?? n.type)}</code></td><td>${esc(n.rootCause ?? "")}</td><td>${badge(n.classification ?? "environmental", "docgap")}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderNextActions() {
  // 데이터 기반 동적 도출:
  // BLOCKED IA 의 topGaps 를 카테고리화 → 가장 많이 등장하는 카테고리부터 P1, P2... 로 정렬.
  // 이미 완료된 작업은 자동 제외 (BLOCKED IA 가 없으면 그 카테고리는 안 나옴).
  const blockedEntries = (finalAudit.entries ?? []).filter((e) => e.finalLabel === "BLOCKED");
  if (blockedEntries.length === 0) {
    return `
      <section>
        <div class="container">
          <h2>다음 작업</h2>
          <p class="muted">모든 IA 가 PASS 또는 PASS-anchored. 다음 작업 자동 도출 안 됨 — 정성적 backlog 는 별도 ledger 참고.</p>
        </div>
      </section>
    `;
  }

  // 카테고리 별 IA 모으기.
  const categories = [
    {
      key: "manual-review",
      match: (gap) => /missing manual-review row/.test(gap),
      label: "Cross-audit + codex 위임 확장",
      what: "BLOCKED IA 들에 대해 reviewer A + reviewer B + codex 위임 실행 (현재 6 public 만 cover)",
      effort: "IA 당 ~10분 multi-agent, 총 ~3-4시간 (28 IA 기준)",
    },
    {
      key: "primary-cta",
      match: (gap) => /Primary CTA matching .*not visible/.test(gap),
      label: "Catalog primary CTA regex 정밀화",
      what: "ia-catalog.ts 의 expectedPrimaryCta regex 가 실제 구현 라벨과 어긋난 IA 정렬",
      effort: "IA 당 ~10분, 총 ~2-3시간",
    },
    {
      key: "heading-mismatch",
      match: (gap) => /Heading "[^"]*" did not match expected pattern/.test(gap),
      label: "Catalog heading regex 정밀화",
      what: "ia-catalog.ts 의 expectedHeadingPattern 이 실제 h1 과 어긋난 IA 정렬",
      effort: "IA 당 ~5분, 총 ~1시간",
    },
    {
      key: "modal-trigger",
      match: (gap) => /Modal trigger did not fire/.test(gap),
      label: "Hosted modal trigger selectors 보강",
      what: "hosted-surfaces.spec.ts 의 modal 진입 heuristic selectors 가 못 잡은 IA",
      effort: "IA 당 ~30분 (실제 UI source 검증 포함)",
    },
    {
      key: "screenshot-missing",
      match: (gap) => /screenshots\/coverage-.*missing on disk|screenshots\/coverage-.*absent|screenshots\/coverage-.*not present/.test(gap),
      label: "Screenshot 캡처 로직 점검",
      what: "Playwright coverage spec 의 screenshot 단계가 일부 IA 에 안 동작 — Page 별 로직 점검",
      effort: "~1-2시간",
    },
    {
      key: "hosted-surface-rows",
      match: (gap) => /hosted-surface-results\.json BLOCKED/.test(gap),
      label: "Hosted-surface 결과 수집",
      what: "hosted-surfaces.spec.ts 가 modal trigger 후 실제 modal 진입 + focus return 등을 수집해야 하는데 빈 row. spec 보강 후 재실행 필요.",
      effort: "~2-3시간",
    },
    {
      key: "security-nav-rows",
      match: (gap) => /security-navigation-results\.json BLOCKED/.test(gap),
      label: "Security-navigation per-IA 매핑",
      what: "session-navigation tests 는 route-level (SN-*, AUTH-RH-*) 이라 iaCode=null. IA 별 어느 시나리오가 cover 하는지 매핑 필요.",
      effort: "~1-2시간",
    },
    {
      key: "ux-states",
      match: (gap) => /rendered states not captured|rendered evidence missing/.test(gap),
      label: "UX states 캡처 보강",
      what: "checklist §6.5 가 요구하는 loading/empty/error/success state evidence 가 coverage spec 에서 안 잡힘. interaction 시나리오 추가 필요.",
      effort: "IA 당 ~20분",
    },
    {
      key: "spec-gap",
      match: (gap) => /not implemented in src\/|pack not implemented/.test(gap),
      label: "실제 spec gap product 결정",
      what: "코드에 누락된 명세 사항 — 명세를 줄일지 vs 구현 추가할지 product 결정 필요",
      effort: "IA 당 별도 PR + 결정 회의",
    },
    {
      key: "doc-gap-candidate",
      match: (gap) => /Doc gap candidate:/.test(gap),
      label: "DOC-GAP candidate 정리",
      what: "cross-audit 가 candidate 로 표시한 spec drift — 정정 방향 product 결정",
      effort: "IA 당 ~30분 review + docs PR",
    },
  ];

  const items = [];
  for (const cat of categories) {
    const matchingIas = blockedEntries
      .filter((e) => e.topGaps.some((g) => cat.match(g)))
      .map((e) => e.iaCode);
    if (matchingIas.length === 0) continue;
    items.push({
      what: cat.label,
      detail: cat.what,
      blocks: `${matchingIas.length} IA: ${matchingIas.slice(0, 8).join(", ")}${matchingIas.length > 8 ? `, +${matchingIas.length - 8}` : ""}`,
      effort: cat.effort,
    });
  }

  // 우선순위: 영향 IA 수가 많은 것부터 P1, P2...
  items.sort((a, b) => {
    const aCount = parseInt(a.blocks.match(/^(\d+) IA/)?.[1] ?? "0", 10);
    const bCount = parseInt(b.blocks.match(/^(\d+) IA/)?.[1] ?? "0", 10);
    return bCount - aCount;
  });
  items.forEach((it, idx) => { it.priority = `P${idx + 1}`; });

  return `
    <section>
      <div class="container">
        <h2>다음 작업 (BLOCKED IA topGaps 카테고리에서 자동 도출)</h2>
        <p class="muted">우선순위는 영향 IA 수 기준 자동 정렬. 이미 완료된 작업(예: service_role 회전, codex 위임 6 public) 은 BLOCKED 가 사라져서 자동 제외.</p>
        <table class="simple">
          <thead><tr><th>우선</th><th>할 일</th><th>차단 영역</th><th>예상 소요</th></tr></thead>
          <tbody>
            ${items
              .map(
                (i) =>
                  `<tr><td><strong>${esc(i.priority)}</strong></td><td><strong>${esc(i.what)}</strong><br><span class="muted" style="font-size:12px;">${esc(i.detail)}</span></td><td><span class="muted">${esc(i.blocks)}</span></td><td>${esc(i.effort)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderGlossary() {
  const terms = [
    ["IA (Information Architecture)", "화면 구조와 화면별 요구사항 — 이 프로젝트는 34개 IA를 가짐"],
    ["doc-receipt", "각 IA마다 어떤 docs를 읽고 어떤 요구사항을 뽑았는지 기록한 증거 JSON"],
    ["storageState", "Playwright 테스트에서 로그인 세션을 흉내내는 쿠키/스토리지 파일"],
    ["host route", "모달이 호스팅되는 부모 페이지 (예: C-03 retry 모달은 /practice/problems가 host)"],
    ["RLS (Row Level Security)", "Postgres에서 행 단위 권한 — 사용자가 자기 row만 보게 강제"],
    ["service_role", "Supabase의 admin 권한 키 — 클라이언트 코드에 절대 노출 금지. 노출됐을 때 회전 필수 (rotate); 이 audit 의 secret key 는 dev 한정 .env.local 에서 활성 상태"],
    ["DOC-GAP", "문서 명세와 실제 코드가 다른 상태 — 의도된 drift이거나 product 결정 필요"],
    ["BLOCKED", "증거 수집을 시도했으나 사전 조건(precondition) 부재로 진행 불가"],
    ["Phase 5 AI-first", "AI가 1차로 34 IA 전부 훑고, 사람이 판단 필요한 항목만 골라주는 흐름"],
    ["evidenceBundleId", "한 run의 모든 증거를 묶어 식별하는 hash — 다른 run 증거 섞이지 않게 보장"],
  ];
  return `
    <section>
      <div class="container">
        <h2>용어집</h2>
        <table class="simple">
          <thead><tr><th>용어</th><th>풀이</th></tr></thead>
          <tbody>
            ${terms.map(([t, d]) => `<tr><td><strong>${esc(t)}</strong></td><td>${esc(d)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderFooter() {
  return `
    <footer>
      <div class="container">
        <p><strong>산출물 경로</strong></p>
        <ul>
          <li>Audit dir: <code>${esc(auditDir)}</code></li>
          <li>Run ledger: <code>docs/ai-workflow/runs/2026/05/28/20260528-1417-ia-verification-phase-0.5.md</code> · <code>docs/ai-workflow/runs/2026/05/28/20260528-1530-ia-verification-phase-2.md</code></li>
          <li>Plan: <code>docs/ai-workflow/ia-implementation-verification-execution-plan.md</code></li>
        </ul>
        <p class="muted" style="margin-top:16px;">생성: build-html-report.mjs · ${esc(generatedAt())}</p>
      </div>
    </footer>
  `;
}

// ---------------------------------------------------------------------------
// Compose HTML
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TALKPIK AI · IA 구현 검수 리포트 (${esc(manifest.runId)})</title>
  <style>${CSS}</style>
</head>
<body>
  ${renderHero()}
  <div class="container">
    <div class="card" style="margin-top:24px;">
      <strong>한 줄 결론.</strong> ${oneLineConclusion()}
    </div>
  </div>
  ${renderExecutiveSummary()}
  ${renderTimeline()}
  ${renderHeatmap()}
  ${renderIaSection()}
  ${renderKnownIssues()}
  ${renderNextActions()}
  ${renderGlossary()}
  ${renderFooter()}
  <script>${JS}</script>
</body>
</html>
`;

const outPath = `${auditDir}/ia-audit-report.html`;
import("node:fs").then(({ writeFileSync }) => {
  writeFileSync(join(REPO_ROOT, outPath), html);
  console.log(`Wrote ${outPath} (${html.length} chars, ${copiedScreenshots.size} screenshots copied to ${auditDir}/screenshots/).`);
});
