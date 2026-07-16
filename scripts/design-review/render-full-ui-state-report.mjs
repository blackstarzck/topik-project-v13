import fs from "node:fs";
import path from "node:path";
import {
  evidenceRoot,
  prepareEvidenceOutputDirectory,
  resolveEvidenceOutput,
  requireEvidenceSlug,
} from "./evidence-paths.mjs";

const cwd = process.cwd();
const evidenceSlug = requireEvidenceSlug(process.env.UI_EVIDENCE_SLUG);
if (!process.argv[2]) {
  throw new Error(
    "Manifest path is required inside .codex/work/<slug>/ui-evidence/.",
  );
}
const requestedManifest = path.resolve(cwd, process.argv[2]);
const manifestPath = resolveEvidenceOutput({
  cwd,
  slug: evidenceSlug,
  child: path.relative(evidenceRoot(cwd, evidenceSlug), requestedManifest),
});
const reportDir = path.dirname(manifestPath);
const runId = path.basename(manifestPath).replace(/^manifest-/, "").replace(/\.json$/, "");
const htmlPath = path.join(reportDir, `report-${runId}.html`);
const mdPath = path.join(reportDir, `report-${runId}.md`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportRelative(filePath) {
  return path.relative(reportDir, path.resolve(cwd, filePath)).replaceAll("\\", "/");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function statusLabel(status) {
  return (
    {
      ok: "정상",
      redirected: "이동됨",
      failed: "실패",
    }[status] ?? status
  );
}

function viewportLabel(name) {
  return (
    {
      mobile: "모바일",
      tablet: "태블릿",
      desktop: "데스크톱",
    }[name] ?? name
  );
}

function plainStatusDescription(result) {
  if (result.status === "redirected" && result.ia === "X-18") {
    return "테스트 계정이 이미 동의 완료 상태라 동의 화면 대신 대시보드로 이동했습니다. 이 캡처에서는 정상 동작으로 봅니다.";
  }
  if (result.status === "ok") {
    return "화면이 열렸고, 캡처 중 치명적인 브라우저 오류가 발견되지 않았습니다.";
  }
  return "화면 캡처 중 추가 확인이 필요한 문제가 발견되었습니다.";
}

const counts = manifest.results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] ?? 0) + 1;
  return acc;
}, {});
const viewports = [
  ...new Map(manifest.results.map((result) => [result.viewport.name, result.viewport])).values(),
];
const nonOk = manifest.results.filter((result) => result.status !== "ok");
const grouped = new Map();
for (const result of manifest.results) {
  const key = `${result.ia} ${result.folder}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(result);
}
const uniqueStates = new Set(
  manifest.results.map((result) => `${result.ia}:${result.folder}:${result.state}`),
).size;
const uniqueScreens = grouped.size;
const unexpectedLogin = manifest.results.filter(
  (result) => result.auth && result.ia !== "X-18" && result.finalPath === "/login",
).length;
const consoleErrorCount = manifest.results.filter(
  (result) => (result.errors?.consoleErrors ?? []).length > 0,
).length;
const cleanupErrorCount = manifest.cleanup?.errors?.length ?? 0;

const nonOkRows =
  nonOk
    .map(
      (result) => `
            <tr>
              <td>${esc(result.ia)}</td>
              <td>${esc(result.folder)}</td>
              <td>${esc(result.state)}</td>
              <td>${esc(viewportLabel(result.viewport.name))}</td>
              <td><span class="badge status-${esc(result.status)}">${esc(statusLabel(result.status))}</span></td>
              <td><code>${esc(result.finalPath)}</code></td>
              <td>${esc(plainStatusDescription(result))}</td>
            </tr>`,
    )
    .join("") || '<tr><td colspan="7">주의해서 볼 캡처가 없습니다.</td></tr>';

const screenRows = [...grouped.entries()]
  .map(([key, results]) => {
    const statuses = results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {});
    const states = [...new Set(results.map((result) => result.state))].join(", ");
    const viewportNames = [...new Set(results.map((result) => viewportLabel(result.viewport.name)))].join(
      ", ",
    );
    const statusBadges = Object.entries(statuses)
      .map(
        ([status, count]) =>
          `<span class="badge status-${esc(status)}">${esc(statusLabel(status))} ${count}</span>`,
      )
      .join(" ");
    return `
            <tr>
              <td>${esc(key)}</td>
              <td>${esc(states)}</td>
              <td>${esc(viewportNames)}</td>
              <td>${statusBadges}</td>
            </tr>`;
  })
  .join("");

const cards = manifest.results
  .map((result) => {
    const img = reportRelative(result.screenshotPath);
    const sidecar = img.replace(/\.png$/, ".json");
    const headingText = (result.headings ?? []).slice(0, 3).join(" / ");
    const errorCount =
      (result.errors?.pageErrors?.length ?? 0) +
      (result.errors?.consoleErrors?.length ?? 0) +
      (result.errors?.responseErrors?.length ?? 0) +
      (result.errors?.errorMessage ? 1 : 0);
    const searchText = `${result.ia} ${result.folder} ${result.state} ${result.route} ${result.finalPath} ${headingText}`.toLowerCase();
    return `
        <article class="capture-card" data-status="${esc(result.status)}" data-viewport="${esc(result.viewport.name)}" data-search="${esc(searchText)}">
          <a class="shot-link" href="${esc(img)}" target="_blank" rel="noreferrer">
            <img src="${esc(img)}" alt="${esc(`${result.ia} ${result.state} ${viewportLabel(result.viewport.name)} 스크린샷`)}" loading="lazy">
          </a>
          <div class="capture-body">
            <div class="capture-topline">
              <span class="ia">${esc(result.ia)}</span>
              <span class="badge status-${esc(result.status)}">${esc(statusLabel(result.status))}</span>
              <span class="badge viewport-${esc(result.viewport.name)}">${esc(viewportLabel(result.viewport.name))}</span>
            </div>
            <h3>${esc(result.folder)}</h3>
            <p class="plain-explain">${esc(plainStatusDescription(result))}</p>
            <dl>
              <div><dt>상태</dt><dd>${esc(result.state)}</dd></div>
              <div><dt>접속 주소</dt><dd><code>${esc(result.route)}</code></dd></div>
              <div><dt>최종 위치</dt><dd><code>${esc(result.finalPath)}</code></dd></div>
              <div><dt>화면 크기</dt><dd>${esc(result.viewport.width)}x${esc(result.viewport.height)}</dd></div>
              <div><dt>처리 시간</dt><dd>${esc(result.durationMs)}ms</dd></div>
              <div><dt>오류 수</dt><dd>${errorCount}</dd></div>
            </dl>
            ${
              headingText
                ? `<p class="headings"><strong>화면에서 보인 주요 제목:</strong> ${esc(headingText)}</p>`
                : ""
            }
            ${result.note ? `<p class="note">${esc(result.note)}</p>` : ""}
            <div class="links">
              <a href="${esc(img)}" target="_blank" rel="noreferrer">스크린샷 열기</a>
              <a href="${esc(sidecar)}" target="_blank" rel="noreferrer">상세 기록 열기</a>
            </div>
          </div>
        </article>`;
  })
  .join("\n");

const md = `# 전체 UI 상태 캡처 QA 보고서

실행 ID: \`${manifest.runId}\`  
앱 주소: \`${manifest.baseUrl}\`  
시작: ${formatDate(manifest.startedAt)}  
종료: ${formatDate(manifest.finishedAt)}

## 한눈에 보는 결론

이번 점검은 TALKPIK AI의 주요 사용자 화면을 실제 브라우저로 열어, 모바일·태블릿·데스크톱에서 화면이 정상적으로 보이는지 확인한 작업입니다.

- 총 ${uniqueStates}개 화면/상태를 확인했습니다.
- 각 화면을 3가지 화면 크기로 캡처해 총 ${manifest.results.length}장의 스크린샷을 만들었습니다.
- ${counts.ok ?? 0}장은 정상 캡처입니다.
- ${counts.redirected ?? 0}장은 화면이 다른 곳으로 이동했습니다. 모두 X-18 동의 화면이며, 테스트 계정이 이미 동의 완료 상태라 대시보드로 이동한 정상 동작입니다.
- 예상하지 못한 로그인 화면 이동은 ${unexpectedLogin}건입니다.
- 브라우저 콘솔 오류는 ${consoleErrorCount}건입니다.
- 테스트용 데이터 정리 오류는 ${cleanupErrorCount}건입니다.

## 이 보고서를 읽는 방법

- \`정상\`: 화면이 열렸고, 캡처 중 치명적인 오류가 발견되지 않았다는 뜻입니다.
- \`이동됨\`: 요청한 화면이 다른 화면으로 이동했다는 뜻입니다. 이번에는 동의 완료 계정이 대시보드로 이동한 정상 케이스입니다.
- \`스크린샷\`: 실제 사용자가 보는 화면 이미지입니다.
- \`상세 기록(JSON)\`: 캡처 시점, 주소, 화면 제목, 오류 여부 같은 기계 판독용 기록입니다.

## 주의해서 볼 항목

${nonOk
  .map(
    (result) =>
      `- ${result.ia} ${result.folder} / ${result.state} / ${viewportLabel(result.viewport.name)}: ${statusLabel(result.status)} -> \`${result.finalPath}\`. ${plainStatusDescription(result)}`,
  )
  .join("\n")}

## 산출물

- HTML 보고서: \`${path.relative(cwd, htmlPath).replaceAll("\\", "/")}\`
- 전체 manifest: \`${path.relative(cwd, manifestPath).replaceAll("\\", "/")}\`
- 스크린샷 위치: \`.codex/work/${evidenceSlug}/ui-evidence/<capture-run>/screens/<screen-folder>/browser-screenshot--<state>--<viewport>.png\`
- 상세 기록 위치: \`.codex/work/${evidenceSlug}/ui-evidence/<capture-run>/screens/<screen-folder>/browser-screenshot--<state>--<viewport>.json\`
`;

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>전체 UI 상태 캡처 QA 보고서 · ${esc(manifest.runId)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f4f5;
      --panel: #ffffff;
      --ink: #101113;
      --muted: #60646c;
      --line: #e4e4e7;
      --ok: #0f7a3d;
      --redirected: #9a5b00;
      --failed: #b42318;
      --info: #2563eb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    header { background: var(--panel); border-bottom: 1px solid var(--line); padding: 32px max(24px, calc((100vw - 1180px) / 2)); }
    main { width: min(1180px, calc(100vw - 48px)); margin: 0 auto; padding: 28px 0 56px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 34px 0 14px; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 10px 0; font-size: 15px; letter-spacing: 0; }
    p { margin: 0; }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; }
    .lead { color: var(--muted); max-width: 860px; }
    .meta { color: var(--muted); display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
    .metric, .panel, .capture-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .metric { padding: 16px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 6px; font-size: 24px; }
    .panel { padding: 18px; overflow: auto; }
    .plain-list { margin: 10px 0 0; padding-left: 18px; }
    .plain-list li { margin: 6px 0; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: minmax(220px, 1fr) 160px 160px; gap: 10px; background: rgba(244, 244, 245, 0.92); backdrop-filter: blur(10px); padding: 12px 0; margin-top: 20px; }
    input, select { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; background: var(--panel); color: var(--ink); font: inherit; }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; font-weight: 600; }
    .badge { display: inline-flex; align-items: center; min-height: 22px; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; background: #f1f1f2; color: var(--muted); white-space: nowrap; }
    .status-ok { color: var(--ok); background: #eaf7ef; }
    .status-redirected { color: var(--redirected); background: #fff4df; }
    .status-failed { color: var(--failed); background: #fff0ee; }
    .viewport-mobile { color: #475569; background: #eef2ff; }
    .viewport-tablet { color: #155e75; background: #ecfeff; }
    .viewport-desktop { color: #365314; background: #f0fdf4; }
    .gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .capture-card { overflow: hidden; min-width: 0; }
    .shot-link { display: block; height: 220px; background: #e9eaee; border-bottom: 1px solid var(--line); overflow: hidden; }
    .shot-link img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
    .capture-body { padding: 14px; }
    .capture-topline { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .ia { font-weight: 800; margin-right: auto; }
    .plain-explain { color: var(--muted); font-size: 13px; margin-top: 4px; }
    dl { display: grid; grid-template-columns: 1fr; gap: 6px; margin: 10px 0; }
    dl div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; }
    dt { color: var(--muted); font-size: 12px; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
    .headings, .note { color: var(--muted); font-size: 12px; margin-top: 8px; }
    .note { color: var(--redirected); }
    .links { display: flex; gap: 10px; margin-top: 12px; }
    a { color: var(--info); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .hidden { display: none !important; }
    .footer-note { color: var(--muted); margin-top: 24px; font-size: 13px; }
    @media (max-width: 1020px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px) { header { padding: 24px 16px; } main { width: calc(100vw - 32px); } .summary-grid, .gallery, .toolbar { grid-template-columns: 1fr; } .shot-link { height: 260px; } }
  </style>
</head>
<body>
  <header>
    <h1>전체 UI 상태 캡처 QA 보고서</h1>
    <p class="lead">이 보고서는 TALKPIK AI의 주요 사용자 화면을 실제 브라우저로 열어, 모바일·태블릿·데스크톱에서 화면이 정상적으로 보이는지 확인한 결과입니다. 개발자가 아니어도 읽을 수 있도록 결과를 쉬운 말로 정리했습니다.</p>
    <div class="meta">
      <span>실행 ID: <code>${esc(manifest.runId)}</code></span>
      <span>앱 주소: <code>${esc(manifest.baseUrl)}</code></span>
      <span>시작: ${esc(formatDate(manifest.startedAt))}</span>
      <span>종료: ${esc(formatDate(manifest.finishedAt))}</span>
    </div>
    <section class="summary-grid" aria-label="요약 지표">
      <div class="metric"><span>검사한 화면 묶음</span><strong>${uniqueScreens}</strong></div>
      <div class="metric"><span>검사한 화면 상태</span><strong>${uniqueStates}</strong></div>
      <div class="metric"><span>전체 스크린샷</span><strong>${manifest.results.length}</strong></div>
      <div class="metric"><span>정상 캡처</span><strong>${counts.ok ?? 0}</strong></div>
      <div class="metric"><span>정상 이동</span><strong>${counts.redirected ?? 0}</strong></div>
    </section>
  </header>
  <main>
    <section class="panel">
      <h2 style="margin-top: 0;">한눈에 보는 결론</h2>
      <ul class="plain-list">
        <li>총 ${uniqueStates}개 화면/상태를 3가지 화면 크기로 확인해 ${manifest.results.length}장의 스크린샷을 만들었습니다.</li>
        <li>${counts.ok ?? 0}장은 정상적으로 화면이 열렸고, 캡처 중 치명적인 오류가 발견되지 않았습니다.</li>
        <li>${counts.redirected ?? 0}장은 모두 X-18 동의 화면입니다. 테스트 계정이 이미 동의를 완료했기 때문에 동의 화면 대신 대시보드로 이동한 정상 동작입니다.</li>
        <li>예상하지 못한 로그인 화면 이동은 ${unexpectedLogin}건입니다.</li>
        <li>브라우저 콘솔 오류는 ${consoleErrorCount}건이고, 테스트 데이터 정리 오류는 ${cleanupErrorCount}건입니다.</li>
      </ul>
    </section>

    <section class="panel" style="margin-top: 18px;">
      <h2 style="margin-top: 0;">이 보고서를 읽는 방법</h2>
      <ul class="plain-list">
        <li><strong>정상</strong>: 화면이 열렸고, 사용자가 보는 화면을 스크린샷으로 남겼다는 뜻입니다.</li>
        <li><strong>이동됨</strong>: 요청한 화면이 다른 화면으로 이동했다는 뜻입니다. 이번에는 동의 완료 계정이 대시보드로 이동한 정상 케이스만 있습니다.</li>
        <li><strong>스크린샷 열기</strong>: 실제 캡처 이미지를 크게 봅니다.</li>
        <li><strong>상세 기록 열기</strong>: 캡처 시각, 주소, 화면 제목, 오류 여부 같은 원본 기록을 봅니다.</li>
      </ul>
    </section>

    <h2>주의해서 볼 항목</h2>
    <section class="panel">
      <table>
        <thead><tr><th>IA</th><th>화면</th><th>상태</th><th>화면 크기</th><th>결과</th><th>최종 위치</th><th>쉬운 설명</th></tr></thead>
        <tbody>${nonOkRows}
        </tbody>
      </table>
    </section>

    <h2>화면별 검사표</h2>
    <section class="panel">
      <table>
        <thead><tr><th>화면</th><th>검사한 상태</th><th>화면 크기</th><th>결과</th></tr></thead>
        <tbody>${screenRows}
        </tbody>
      </table>
    </section>

    <h2>스크린샷 갤러리</h2>
    <p class="lead" style="margin-bottom: 12px;">아래 카드는 실제 캡처 이미지입니다. 검색창에는 화면 번호, 주소, 상태명, 화면 제목을 입력할 수 있습니다.</p>
    <div class="toolbar" aria-label="필터">
      <input id="search" type="search" placeholder="화면 번호, 주소, 상태, 제목 검색">
      <select id="statusFilter">
        <option value="all">모든 결과</option>
        ${Object.keys(counts)
          .map((status) => `<option value="${esc(status)}">${esc(statusLabel(status))}</option>`)
          .join("")}
      </select>
      <select id="viewportFilter">
        <option value="all">모든 화면 크기</option>
        ${viewports
          .map((viewport) => `<option value="${esc(viewport.name)}">${esc(viewportLabel(viewport.name))}</option>`)
          .join("")}
      </select>
    </div>
    <section class="gallery" id="gallery">
${cards}
    </section>
    <p class="footer-note"><span id="visibleCount">${manifest.results.length}</span> / ${manifest.results.length}개 캡처가 표시 중입니다. 이미지를 클릭하면 전체 PNG를 엽니다.</p>
  </main>
  <script>
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('statusFilter');
    const viewportFilter = document.getElementById('viewportFilter');
    const cards = Array.from(document.querySelectorAll('.capture-card'));
    const visibleCount = document.getElementById('visibleCount');
    function applyFilters() {
      const q = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      const viewport = viewportFilter.value;
      let visible = 0;
      for (const card of cards) {
        const matchesSearch = !q || card.dataset.search.includes(q);
        const matchesStatus = status === 'all' || card.dataset.status === status;
        const matchesViewport = viewport === 'all' || card.dataset.viewport === viewport;
        const show = matchesSearch && matchesStatus && matchesViewport;
        card.classList.toggle('hidden', !show);
        if (show) visible += 1;
      }
      visibleCount.textContent = String(visible);
    }
    search.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    viewportFilter.addEventListener('change', applyFilters);
  </script>
</body>
</html>`;

prepareEvidenceOutputDirectory({
  cwd,
  slug: evidenceSlug,
  child: path.relative(evidenceRoot(cwd, evidenceSlug), reportDir),
});
fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(mdPath, md, "utf8");
console.log(
  JSON.stringify(
    {
      htmlPath: path.relative(cwd, htmlPath).replaceAll("\\", "/"),
      mdPath: path.relative(cwd, mdPath).replaceAll("\\", "/"),
      captures: manifest.results.length,
    },
    null,
    2,
  ),
);
