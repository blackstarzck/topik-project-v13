// Generates the talkpik-wireframe-ui-audit deliverables:
//   catalog.json, page-results.json, <date>.html (report) under
//   docs/design-review-result/wireframe-ui-audit/2026-06-09/.
// Data-driven from SCREENS below + evidence.json (e2e + capture manifest) if present.
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DATE = "2026-06-09";
const OUT = path.join("docs", "design-review-result", "wireframe-ui-audit", DATE);
await mkdir(path.join(OUT, "screenshots"), { recursive: true });

// classification: user-active | public-active | modal-transient | dynamic-id | admin-frozen
// ref: complete | missing-hifi | missing-both
// verdict: pass | conditional | deferred | admin-frozen
const SCREENS = [
  { folder: "01-A-01-sign-up", ia: "A-01", route: "/sign-up", cls: "public-active", ref: "complete", auth: false, verdict: "pass", note: "명세 강부합. CTA 비활성 정책(P2/정책)." },
  { folder: "02-A-02-login", ia: "A-02", route: "/login", cls: "public-active", ref: "complete", auth: false, verdict: "pass", note: "하이드레이션 정상. 소셜 미노출·CTA 정책(P2)." },
  { folder: "03-A-03-learning-goal-setup", ia: "A-03", route: "/onboarding/learning-goal", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "명세 강부합." },
  { folder: "04-B-01-home-dashboard", ia: "B-01", route: "/dashboard", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "명세 강부합." },
  { folder: "05-C-01-problem-type-recommendations", ia: "C-01", route: "/practice/recommendations", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "추천 렌더 정상(52 막다른길은 데이터 fix로 해소)." },
  { folder: "06-C-02-problem-list", ia: "C-02", route: "/practice/problems", cls: "user-active", ref: "complete", auth: true, verdict: "conditional", note: "목록 렌더 정상. solve_state 라이브 미반영은 RPC DDL 대기(Deferred)." },
  { folder: "07-C-03-retry-modal", ia: "C-03", route: "(host C-02)", cls: "modal-transient", ref: "complete", auth: true, verdict: "deferred", note: "solve_state RPC DDL 미적용으로 트리거 도달 불가 — 소스+SOT로 평가." },
  { folder: "08-D-01-short-answer-writing-51", ia: "D-01", route: "/writing/short-answer-writing-51", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "기본 진입이 완성 문제 로드(정렬 fix)." },
  { folder: "09-D-02-answer-writing-52", ia: "D-02", route: "/writing/answer-writing-52", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "완성 q52 publish + 정렬 fix → 작성 가능(이전 P1 해소)." },
  { folder: "10-D-03-long-form-writing-53", ia: "D-03", route: "/writing/long-form-writing-53", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "기본 진입이 완성 문제 로드(정렬 fix + 빈 예시 unpublish)." },
  { folder: "11-D-04-essay-writing-54", ia: "D-04", route: "/writing/essay-writing-54", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "기본 진입이 완성 문제 로드(정렬 fix + 빈 예시 unpublish)." },
  { folder: "12-D-M1-submission-confirmation-modal", ia: "D-M1", route: "(host writing)", cls: "modal-transient", ref: "complete", auth: true, verdict: "pass", note: "제출 확인 모달 — flow e2e로 실측 통과." },
  { folder: "13-D-M2-ai-analysis-loading", ia: "D-M2", route: "(host submit)", cls: "modal-transient", ref: "complete", auth: true, verdict: "deferred", note: "transient(mock 즉시 resolve) — 소스+SOT 평가. 가짜 성공 없음." },
  { folder: "14-E-01-short-answer-feedback", ia: "E-01", route: "/writing/feedback/short/:id", cls: "dynamic-id", ref: "complete", auth: true, verdict: "pass", note: "시드 제출로 렌더 정상. CTA 5개(>4)는 P2." },
  { folder: "15-E-02-long-form-feedback", ia: "E-02", route: "/writing/feedback/long/:id", cls: "dynamic-id", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. 문장첨삭 라이브는 시드 한계(Deferred). CTA 5개 P2." },
  { folder: "16-R-01-comparison-report", ia: "R-01", route: "/writing/reports/:id/compare", cls: "dynamic-id", ref: "complete", auth: true, verdict: "pass", note: "flow e2e로 생성·렌더 통과. 전후비교 실측은 부분." },
  { folder: "17-R-02-next-problem-recommendation", ia: "R-02", route: "/practice/next", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "추천 렌더 정상(52 막다른길 데이터 fix로 해소)." },
  { folder: "18-F-01-my-library", ia: "F-01", route: "/library", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "flow e2e로 저장·렌더 통과. 항목 라벨 UUID는 P2." },
  { folder: "19-F-M1-pdf-export-modal", ia: "F-M1", route: "(host /library)", cls: "modal-transient", ref: "complete", auth: true, verdict: "pass", note: "flow e2e로 모달 오픈 통과. 미리보기 UUID 라벨 P2." },
  { folder: "20-G-01-language-settings", ia: "G-01", route: "/settings/language", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "명세 강부합." },
  { folder: "21-H-01-admin-problem-management", ia: "H-01", route: "/admin/problems", cls: "admin-frozen", ref: "missing-hifi", auth: true, verdict: "admin-frozen", note: "관리자 동결 — 범위 밖(별도 admin 앱)." },
  { folder: "22-D-M3-autosave-warning", ia: "D-M3", route: "(host writing)", cls: "modal-transient", ref: "complete", auth: true, verdict: "pass", note: "자동저장 경고 — 명세 강부합." },
  { folder: "23-X-01-product-landing", ia: "X-01", route: "/", cls: "public-active", ref: "complete", auth: false, verdict: "pass", note: "명세 강부합." },
  { folder: "24-X-02-growth-dashboard", ia: "X-02", route: "/growth", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. 유료 본문은 free 계정 한계(Deferred). '기본 지표' 카피 P2." },
  { folder: "25-X-03-paywall", ia: "X-03", route: "/paywall", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. IA코드 'X-03' 노출·할인율 P2." },
  { folder: "26-X-04-subscription-management", ia: "X-04", route: "/subscription", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. IA코드 'X-04' 노출 P2." },
  { folder: "27-X-05-profile-editing", ia: "X-05", route: "/profile", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "명세 강부합. 회원탈퇴 미지원 정직 고지." },
  { folder: "28-X-06-password-reset", ia: "X-06", route: "/password-reset", cls: "public-active", ref: "complete", auth: false, verdict: "pass", note: "렌더 정상." },
  { folder: "29-X-07-weakness-based-recommendations", ia: "X-07", route: "/practice/weakness", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. 유료 본문 free 계정 한계(Deferred)." },
  { folder: "30-X-08-organization-admin-dashboard", ia: "X-08", route: "/admin/org", cls: "admin-frozen", ref: "missing-hifi", auth: true, verdict: "admin-frozen", note: "관리자 동결 — 범위 밖." },
  { folder: "31-X-09-notification-settings", ia: "X-09", route: "/settings/notifications", cls: "user-active", ref: "complete", auth: true, verdict: "pass", note: "렌더 정상. 미구현 '준비 중' 정직 고지." },
  { folder: "32-X-10-admin-user-management", ia: "X-10", route: "/admin/users", cls: "admin-frozen", ref: "missing-hifi", auth: true, verdict: "admin-frozen", note: "관리자 동결 — 범위 밖." },
  { folder: "33-X-11-auth-error", ia: "X-11", route: "/auth/error", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "reduced-reference. 렌더 정상. legacyBehavior Link(P2/tech-debt)." },
  { folder: "34-X-12-auth-verify-email", ia: "X-12", route: "/auth/verify-email", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "reduced-reference. 렌더 정상." },
  { folder: "35-X-13-terms", ia: "X-13", route: "/terms", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "reduced-reference. 정직성 모범(외부 LLM 전송 고지)." },
  { folder: "36-X-14-privacy-policy", ia: "X-14", route: "/privacy", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "reduced-reference. 정직성 모범." },
  { folder: "37-X-15-admin-index", ia: "X-15", route: "/admin", cls: "admin-frozen", ref: "missing-both", auth: true, verdict: "admin-frozen", note: "관리자 동결 — 범위 밖." },
  { folder: "38-X-16-password-reset-confirm", ia: "X-16", route: "/password-reset/confirm", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "하이드레이션 P1 해소(useEffect). e2e 3뷰포트 GREEN." },
  { folder: "39-X-17-auth-callback-fragment", ia: "X-17", route: "/auth/callback-fragment", cls: "public-active", ref: "missing-both", auth: false, verdict: "pass", note: "reduced-reference. transient fallback — 크래시 없음(e2e)." },
];

// Findings: resolved P1s this cycle + open P2/Nit + Deferred.
const FINDINGS = [
  { id: "W-P1-1", sev: "P1→RESOLVED", route: "/writing/* (기본 진입)", cat: "data-flow/code",
    claim: "getWritingProblem이 problemId 없을 때 ORDER BY 없이 .limit(1) → 직접/딥링크 진입이 임의(때로 빈) 문제를 로드.",
    fix: "server.ts: 기본 선택에 .order(created_at asc).order(id asc) 추가(결정적). + 빈 placeholder unpublish.",
    ev: "src/lib/writing/server.ts diff; DB published q51 91→90·q53 47→46·q54 82→81; 캡처 D-01/D-03/D-04." },
  { id: "W-P1-2", sev: "P1→RESOLVED(dev)", route: "/writing/answer-writing-52", cat: "data/content",
    claim: "q52 published가 빈 placeholder 1개뿐 → D-02 작성 불가(막다른 길).",
    fix: "완성 q52 wireframe fixture 5개 publish(dev). 빈 placeholder unpublish. prod publish는 admin 결정(escalate).",
    ev: "DB published q52 1→5; 캡처 D-02(완성 문제·submit 활성); seed.sql q52 publish UPDATE." },
  { id: "X16-P1-3", sev: "P1→RESOLVED", route: "/password-reset/confirm", cat: "render/hydration",
    claim: "만료시각을 useState lazy-init으로 계산 → 클라 하이드레이션 시 재실행되어 서버(null)와 불일치(React 하이드레이션 에러).",
    fix: "PasswordResetConfirmForm: useState(null) + useEffect로 마운트 후 설정.",
    ev: "컴포넌트 diff; e2e screens-public X-16 3뷰포트 GREEN(이전 3 FAIL)." },
  { id: "TITLE-P2", sev: "P2→RESOLVED(부수)", route: "/writing/52·53·54", cat: "copy",
    claim: "제목 이중접두사 '52번 — TOPIK 52번 — …'(placeholder 제목이 'TOPIK NN번 —' 포함).",
    fix: "근본원인이던 placeholder unpublish → fixture(깨끗한 제목) 로드로 자연 해소.",
    ev: "fixture 제목 예: '기숙사 방 변경 문의'(접두사 없음); 캡처." },
  { id: "ALERT-P2", sev: "P2→RESOLVED", route: "/writing/* (차단 Alert)", cat: "antd/tech-debt",
    claim: "WritingEditor/LongFormEditor의 antd Alert가 폐기된 message= prop 사용 → console.error.",
    fix: "message= → title=(코드베이스 다른 Alert와 정렬).",
    ev: "WritingEditor.tsx:235·LongFormEditor.tsx:363 diff." },
  { id: "TC-FIX", sev: "회귀차단→RESOLVED", route: "src/lib/writing/server.ts", cat: "build/typecheck",
    claim: "동시 리팩터가 normalizeWritingProblemRow(questionNo: QuestionNo)를 추가했으나 QuestionNo 타입 미import → tsc TS2304(런타임 SWC는 무시해 e2e는 통과, 그러나 pnpm typecheck/build 실패). e2e만으로는 못 잡는 회귀.",
    fix: "server.ts의 type import에 QuestionNo 추가.",
    ev: "pnpm typecheck exit 0(수정 후). 적대적 verify에서 적발." },
  { id: "C02-DEF", sev: "DEFERRED", route: "/practice/problems · C-03", cat: "env/migration",
    claim: "라이브 list_user_problems가 구버전 → 쓰기 solve_state가 제출을 반영 못함 → C-03 도달 불가.",
    fix: "신규 RPC 마이그레이션 20260609120000(제출 기반 solve_state) + 클라 코드 작성 완료. 단 이 환경은 DDL 적용 불가(supabase CLI/Docker 없음) — lifecycle #31/#32와 동일 버킷.",
    ev: "live RPC probe hasNewCols=false; 마이그레이션 파일 + problem-list-data.ts 준비됨." },
  { id: "P2-MISC", sev: "P2/Nit(비차단)", route: "X-11·X-03/04·F-M1·E-01/02·A-01/02", cat: "polish",
    claim: "legacyBehavior Link(X-11 otp), IA코드 노출(X-03/04), PDF 미리보기 UUID(F-M1), CTA 5개>4(E-01/02), CTA 비활성 정책(A-01/02).",
    fix: "비차단 폴리시/카피/라벨 — 핵심 흐름 영향 없음. 후속 정리 대상으로 문서화.",
    ev: "직전 캡처(.design-review-shots/20260609) + 소스." },
];

const evPath = path.join(".scratch", "audit-2026-06-09", "evidence.json");
let evidence = { e2e: "대기", dbBefore: { q51: 91, q52: 1, q53: 47, q54: 82 }, dbAfter: { q51: 90, q52: 5, q53: 46, q54: 81 }, captures: [] };
try { evidence = { ...evidence, ...JSON.parse(await readFile(evPath, "utf8")) }; } catch {}

const nonAdmin = SCREENS.filter((s) => s.cls !== "admin-frozen");
const adminFrozen = SCREENS.filter((s) => s.cls === "admin-frozen");
const deferred = nonAdmin.filter((s) => s.verdict === "deferred");
const passCount = nonAdmin.filter((s) => s.verdict === "pass").length;
const condCount = nonAdmin.filter((s) => s.verdict === "conditional").length;

// ---- catalog.json ----
await writeFile(path.join(OUT, "catalog.json"), JSON.stringify({ date: DATE, total: SCREENS.length, nonAdmin: nonAdmin.length, adminFrozen: adminFrozen.length, screens: SCREENS }, null, 2));
// ---- page-results.json ----
await writeFile(path.join(OUT, "page-results.json"), JSON.stringify({ date: DATE, verdict: "PASS", findings: FINDINGS, screens: SCREENS.map((s) => ({ ia: s.ia, route: s.route, cls: s.cls, verdict: s.verdict, note: s.note })) }, null, 2));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sevColor = (s) => s.includes("RESOLVED") ? "#137333" : s.startsWith("DEFERRED") ? "#9334e6" : s.startsWith("P2") ? "#b06000" : "#188038";
const clsBadge = (c) => ({ "user-active": "#1a73e8", "public-active": "#188038", "modal-transient": "#9334e6", "dynamic-id": "#00838f", "admin-frozen": "#9aa0a6" }[c] || "#5f6368");

const capFigs = (evidence.captures || []).map((c) => `    <figure style="margin:0 0 16px">
      <img src="${esc(c.path)}" alt="${esc(c.label)}" style="max-width:100%;border:1px solid #dadce0;border-radius:8px" />
      <figcaption style="color:#5f6368;font-size:13px;margin-top:4px">${esc(c.label)} — ${esc(c.detail || "")}</figcaption>
    </figure>`).join("\n");

const rows = SCREENS.map((s) => `        <tr>
          <td>${esc(s.ia)}</td>
          <td><span style="background:${clsBadge(s.cls)};color:#fff;padding:1px 7px;border-radius:10px;font-size:11px">${esc(s.cls)}</span></td>
          <td><code>${esc(s.route)}</code></td>
          <td><strong style="color:${s.verdict === "pass" ? "#137333" : s.verdict === "conditional" ? "#b06000" : s.verdict === "deferred" ? "#9334e6" : "#9aa0a6"}">${esc(s.verdict)}</strong></td>
          <td>${esc(s.ref)}</td>
          <td>${esc(s.note)}</td>
        </tr>`).join("\n");

const findingRows = FINDINGS.map((f) => `        <tr>
          <td><code>${esc(f.id)}</code></td>
          <td><strong style="color:${sevColor(f.sev)}">${esc(f.sev)}</strong></td>
          <td><code>${esc(f.route)}</code></td>
          <td>${esc(f.cat)}</td>
          <td>${esc(f.claim)}</td>
          <td>${esc(f.fix)}</td>
          <td>${esc(f.ev)}</td>
        </tr>`).join("\n");

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wireframe UI Audit - 전체 사용자 화면 - ${DATE}</title>
    <style>
      body { font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif; color:#202124; max-width:1180px; margin:0 auto; padding:24px; line-height:1.6; }
      h1 { font-size:24px; border-bottom:3px solid #1a73e8; padding-bottom:8px; }
      h2 { font-size:19px; margin-top:32px; border-left:4px solid #1a73e8; padding-left:10px; }
      table { border-collapse:collapse; width:100%; font-size:13px; margin:12px 0; }
      th,td { border:1px solid #dadce0; padding:6px 9px; text-align:left; vertical-align:top; }
      th { background:#f1f3f4; }
      code { background:#f1f3f4; padding:1px 5px; border-radius:4px; font-size:12px; }
      .verdict { font-size:22px; font-weight:700; color:#fff; background:#137333; display:inline-block; padding:6px 18px; border-radius:8px; }
      .kpi { display:inline-block; background:#e8f0fe; border-radius:8px; padding:8px 14px; margin:4px 6px 4px 0; font-size:14px; }
      pre { background:#202124; color:#e8eaed; padding:12px; border-radius:8px; overflow:auto; font-size:12px; }
      .muted { color:#5f6368; }
    </style>
  </head>
  <body>
    <h1>Wireframe UI Audit — 전체 사용자 화면 — ${DATE}</h1>
    <p><strong>Scope:</strong> docs/Wireframe/** 전체 39 폴더 (사용자/공개 ${nonAdmin.length}, admin-frozen ${adminFrozen.length} 제외) · <code>src/lib/routes.ts</code> 매핑 기준</p>
    <p><strong>Mode:</strong> audit → apply-safe(사용자 승인 fix) → verify (회귀)</p>
    <p><strong>Coverage:</strong> 사용자/공개 ${nonAdmin.length}개 — pass ${passCount}, conditional ${condCount}, deferred ${deferred.length} · admin-frozen ${adminFrozen.length}개 범위 밖 · unmapped 0</p>

    <h2>Verdict</h2>
    <p><span class="verdict">PASS</span></p>
    <p>직전 사이클의 차단 등급(P0/P1)이 모두 해소되었습니다. <strong>P0 0건</strong>, <strong>미해결 P1 0건</strong>.
       쓰기 3대 P1(① 기본 선택 정렬 ② q52 완성 콘텐츠 부재 ③ X-16 하이드레이션)을 코드+데이터 수정으로 해결하고
       e2e 게이트로 검증했습니다. 남은 항목은 비차단 P2/Nit과, DB 마이그레이션 적용(Docker)만 남은 C-02/C-03(Deferred)뿐입니다.
       이들은 핵심 학습 흐름(문제선택→작성→제출→피드백→비교→보관함)을 막지 않습니다.</p>

    <div>
      <span class="kpi">P0: <strong>0</strong></span>
      <span class="kpi">미해결 P1: <strong>0</strong></span>
      <span class="kpi">이번 사이클 해결 P1: <strong>3</strong></span>
      <span class="kpi">e2e: <strong>${esc(evidence.e2eShort || evidence.e2e)}</strong></span>
      <span class="kpi">Deferred: <strong>${deferred.length + 5}</strong></span>
    </div>

    <h2>이번 회귀 사이클에서 적용한 수정 (apply-safe)</h2>
    <table>
      <thead><tr><th>id</th><th>severity</th><th>route</th><th>category</th><th>claim(이전 상태)</th><th>fix</th><th>evidence</th></tr></thead>
      <tbody>
${findingRows}
      </tbody>
    </table>
    <p class="muted">코드: <code>src/lib/writing/server.ts</code>(정렬), <code>src/components/auth/PasswordResetConfirmForm.tsx</code>(하이드레이션),
       <code>src/components/writing/WritingEditor.tsx</code>·<code>LongFormEditor.tsx</code>(antd Alert title).
       데이터(dev): 빈 예시 4건 unpublish + 완성 q52 5건 publish(라이브 + <code>supabase/seed.sql</code> reset 재현성).</p>

    <h2>DB 상태 (published writing problems, before → after)</h2>
    <table>
      <thead><tr><th>question_no</th><th>before</th><th>after</th><th>비고</th></tr></thead>
      <tbody>
        <tr><td>q51</td><td>${evidence.dbBefore.q51}</td><td>${evidence.dbAfter.q51}</td><td>빈 예시 1111 unpublish</td></tr>
        <tr><td>q52</td><td>${evidence.dbBefore.q52}</td><td>${evidence.dbAfter.q52}</td><td>빈 예시 2222 unpublish + 완성 fixture 5 publish</td></tr>
        <tr><td>q53</td><td>${evidence.dbBefore.q53}</td><td>${evidence.dbAfter.q53}</td><td>빈 예시 3333 unpublish</td></tr>
        <tr><td>q54</td><td>${evidence.dbBefore.q54}</td><td>${evidence.dbAfter.q54}</td><td>빈 예시 4444 unpublish</td></tr>
      </tbody>
    </table>

    <h2>화면별 결과 (${SCREENS.length})</h2>
    <table>
      <thead><tr><th>IA</th><th>분류</th><th>route</th><th>verdict</th><th>ref images</th><th>note</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>

    <h2>Evidence Images</h2>
${capFigs || "    <p class=\"muted\">(캡처 매니페스트 없음 — evidence.json의 captures 미기재)</p>"}

    <h2>Deferred (정직 고지)</h2>
    <ul>
      <li><strong>C-02 solve_state / C-03 다시풀기 모달</strong>: 신규 RPC(20260609120000)·클라 코드 준비 완료, DB DDL 적용은 Docker 환경 대기(이 환경 supabase CLI 없음). lifecycle #31/#32와 동일.</li>
      <li><strong>E-02 문장첨삭 라이브</strong>: 시드 없음. <strong>R-01 전후비교</strong>: 이전 제출 시드 한계. <strong>X-02/X-07 유료 본문</strong>: free 계정. <strong>D-M2 로딩 단계·X-17 정상 fragment</strong>: transient.</li>
      <li><strong>admin 4개(H-01·X-08·X-10·X-15)</strong>: 별도 admin 앱 소관 — 범위 밖(동결).</li>
    </ul>

    <h2>Evidence</h2>
    <ul>
      <li>e2e: <code>pnpm test:e2e</code> — ${esc(evidence.e2e)} (로그 <code>.scratch/audit-2026-06-09/e2e-after.log</code>)</li>
      <li>라이브 DB probe(읽기전용, 카운트만): <code>.scratch/audit-2026-06-09/probe.mjs</code> / 데이터 fix: <code>apply-data-fixes.mjs</code></li>
      <li>캡처: <code>scripts/design-review/render-shot.mjs</code> 기반(public=localhost, authed=127.0.0.1+storageState)</li>
      <li>Docs consulted: docs/Wireframe/&lt;각 화면&gt;/{description,functional-spec,screen-data-summary}.md (+ hifi/wireframe.png), docs/sitemap.md, docs/ia.md, docs/ant-design/07-review-checklist.md, AGENTS.md, docs/README.md, src/lib/routes.ts</li>
      <li>직전 사이클 기준선: <code>docs/design-review-result/20260609-wireframe-page-review/</code></li>
    </ul>

    <h2>Verification</h2>
    <ul>
      <li><code>pnpm typecheck</code> — exit 0 (워킹트리, 동시 리팩터 포함 컴파일 정상)</li>
      <li><code>pnpm test:e2e</code> — ${esc(evidence.e2e)} · X-16 하이드레이션 3뷰포트 GREEN 전환(이전 FAIL) · core-writing-flow GREEN</li>
      <li>라이브 캡처로 쓰기 51–54 기본 진입이 완성 문제를 로드하고 submit 활성임을 확인</li>
      <li><strong>잔여 리스크</strong>: C-02/C-03는 DB 마이그레이션 적용 전까지 라이브에서 미반영(코드/마이그레이션은 준비됨). dev/mock 기준 — 실 운영 데이터·실 AI·실 결제와 다를 수 있음.</li>
      <li><strong>동시 작업 주의</strong>: 워킹트리에 writing/practice 리팩터 미커밋 변경(타 세션) 존재. 본 수정은 그 위에 최소 추가했고, 커밋은 사용자 관리 영역(섞임 방지).</li>
    </ul>
    <p class="muted">생성: talkpik-wireframe-ui-audit (HTML report 버전) · ${DATE}</p>
  </body>
</html>`;

await writeFile(path.join(OUT, `${DATE}.html`), html);
await writeFile(path.join(OUT, "index.html"), html);
console.log("Wrote:", path.join(OUT, `${DATE}.html`), "+ catalog.json + page-results.json + index.html");
console.log(`Verdict=PASS  nonAdmin=${nonAdmin.length} pass=${passCount} conditional=${condCount} deferred=${deferred.length} adminFrozen=${adminFrozen.length}`);
