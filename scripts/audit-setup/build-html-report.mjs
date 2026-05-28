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
    if (sn.length === 0) return "n/a";
    if (sn.every((r) => r.status === "PASS")) return "PASS";
    if (sn.every((r) => r.status === "BLOCKED")) return "BLOCKED";
    if (sn.some((r) => r.status === "FAIL")) return "FAIL";
    return "PARTIAL";
  }

  return {
    documentReceipt: doc?.status ?? "n/a",
    sourceMap: sm?.status ?? "n/a",
    browser: brStatus(),
    hostedSurface: ho?.status ?? "n/a",
    securityNavigation: snStatus(),
    aiUxReview: ai?.result ?? aiBlocked?.result ?? "n/a",
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
            <div class="note">Public 18 (heading PASS / CTA heuristic 부분 미스 / HMR 잡음)</div>
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

  return `
    <section>
      <div class="container">
        <h2>34 IA × 8 페이즈 커버리지 히트맵</h2>
        <p class="muted">셀에 마우스를 올리면 각 페이즈 상태가 보입니다. ✓ PASS · △ PARTIAL · ✗ FAIL · ■ BLOCKED · ? DOC-GAP · — DEFERRED</p>
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
        <h4>AI UX 리뷰 (${esc(aiCard.result)} · 신뢰도 ${esc(aiCard.confidence)} · 사람확인 ${esc(aiCard.humanConfirmation)})</h4>
        <strong>Top gaps</strong>${listRows(aiCard.topGaps, (t) => `<li>${esc(t)}</li>`)}
        <strong>사람 리뷰어가 확인할 질문</strong>${listRows(aiCard.humanReviewerQuestions, (q) => `<li>${esc(q)}</li>`)}
      </div>
    `
    : aiBlk
      ? `<div class="section-block"><h4>AI UX 리뷰</h4>${statusBadge(aiBlk.result)} <span class="muted">${esc(aiBlk.blockingReasons?.[0] ?? "")}</span></div>`
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
  const items = [
    {
      priority: "P0",
      what: "SUPABASE_SERVICE_ROLE_KEY 회전 + build-storage-state.mjs --apply 본체 구현",
      blocks: "Phase 2 protected 84 row · Phase 3 hosted-surface 5 row · Phase 4 authenticated 8 row · Phase 5 AI UX 28 IA",
      effort: "Ops + ~1일",
    },
    {
      priority: "P1",
      what: "Phase 3 hosted-surfaces 실제 trigger 증거 수집 + selectors 정확도 확인",
      blocks: "5 모달 IA (C-03/D-M1/D-M2/D-M3/F-M1) PASS 가능성",
      effort: "P0 후 ~3시간",
    },
    {
      priority: "P2",
      what: "Phase 4 authenticated 8 시나리오 실행 (admin role gating · owner-id RLS · refresh after submit · expired session · network failure)",
      blocks: "owner-id IA (E-01/E-02/R-01) + admin IA (H-01/X-08/X-10) PASS",
      effort: "P0 후 ~4시간",
    },
    {
      priority: "P3",
      what: "Phase 5 multi-agent dispatch (6 shard 병렬) + 28 BLOCKED IA AI UX 리뷰",
      blocks: "사람 확인 진입 조건",
      effort: "Phase 2-4 후 ~6시간 (child agents 병렬)",
    },
    {
      priority: "P4",
      what: "사람 reviewer 확인 (modal/form/AI/auth/billing/notifications/admin/policy IA)",
      blocks: "Final PASS 게이트 (AI 세션 대체 불가)",
      effort: "AI 리뷰 후 ~사람 리뷰 시간",
    },
    {
      priority: "P5",
      what: "Codex cross-model review of receipts + plan + report",
      blocks: "보고서 신뢰도 향상 (degraded → full)",
      effort: "~1시간",
    },
  ];
  return `
    <section>
      <div class="container">
        <h2>다음 작업 (우선순위 + 의존성)</h2>
        <table class="simple">
          <thead><tr><th>우선</th><th>할 일</th><th>차단 영역</th><th>소요</th></tr></thead>
          <tbody>
            ${items
              .map(
                (i) =>
                  `<tr><td><strong>${esc(i.priority)}</strong></td><td>${esc(i.what)}</td><td><span class="muted">${esc(i.blocks)}</span></td><td>${esc(i.effort)}</td></tr>`,
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
    ["service_role", "Supabase의 admin 권한 키 — 클라이언트 코드에 절대 노출 금지, 회전 필수"],
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
      <strong>한 줄 결론.</strong> 34개 IA에 대해 Phase 0 ~ Phase 5 일부까지 진행. 문서 receipt 34/34 PASS, 브라우저 public 18/18 PARTIAL, 보안 14/22 PASS, AI UX public 6/6 reviewed. 최종 라벨은 34 BLOCKED인데 이건 Phase 2 protected + Phase 5 사람 확인이 외부 차단(service_role 회전 + 사람 reviewer)에 묶여서 그래.
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
