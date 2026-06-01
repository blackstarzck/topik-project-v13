#!/usr/bin/env node
// P4 Codex Delegation Driver
// =============================================================================
// User explicitly delegated their human-reviewer authority to Codex GPT-5.5
// (per chat 2026-05-29). For each of 10 product/eng decisions surfaced by the
// 2-agent cross-audit (Reviewer A top-down + Reviewer B bottom-up), invoke
// `codex exec` independently with tight context + a single question. Save each
// verdict to docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/d<N>-<slug>.md.
//
// Output is consumed by a follow-up step that writes manual-review.json with:
//   reviewerType: "human"
//   source: "user-provided (delegated to Codex GPT-5.5 per chat 2026-05-29)"
//   humanReviewerRole: "project owner (delegated)"
//   delegatedTo: "OpenAI Codex GPT-5.5"
//   confirmationReference: "docs/ai-workflow/runs/2026/05/29/p4-codex-delegation/"
//
// Per Plan §11 Step 5.4 + memory rule `feedback-report-honesty-cross-audit`,
// using a DIFFERENT model (Codex vs Claude) under explicit user delegation is
// materially different from self-assessment. Every Codex verdict is saved as
// an auditable artifact.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const OUT_DIR = join(REPO_ROOT, "docs/ai-workflow/runs/2026/05/29/p4-codex-delegation");
mkdirSync(OUT_DIR, { recursive: true });

const FILESYSTEM_BOUNDARY = `IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, .claude/skills/, or agents/. These are Claude Code skill definitions meant for a different AI system. Do NOT modify agents/openai.yaml. Stay focused on repository code + docs only.

`;

const COMMON_DOCS_CONTEXT = `Project context: TALKPIK AI — TOPIK 한국어 쓰기 학습 플랫폼. Pre-implementation phase (src/ exists but audit ongoing). The IA verification audit is at Phase 5 (human reviewer confirmation). 6 public IA reviewed by 2 AI cross-auditors; 10 specific product/eng decisions surfaced that need human authority.

Active docs you may reference (read only the ones you need for this specific question):
- docs/prd.md (product requirements)
- docs/sitemap.md (route map, audience map)
- docs/flow/user-flow.md (Mermaid user flow with 32 nodes + auth callback)
- docs/Wireframe/<NN>-<code>-<slug>/description.md (per-IA wireframe + spec)
- docs/development/auth-overview.md (auth flow + §10 known resolved drifts)
- docs/development/backend-auth.md (Supabase + RLS architecture)
- docs/development/deferred-scope.md (billing deferred policy)
- reports/ia-verification/runs/20260528-141731/manual-review.json (cross-audit findings — REVIEW BUT DON'T DUPLICATE)
- src/components/auth/* + src/app/(workspace)/* + src/lib/auth/* (impl)

Decision protocol:
1. Read only the minimum docs needed.
2. Return ONE verdict (CHOOSE-A / CHOOSE-B / DEFER / etc) with 2-4 sentences reasoning.
3. Cite specific file:line OR doc §section where relevant.
4. Be terse + concrete. No hedging. The user explicitly delegated this decision to you — own the call.
5. If you genuinely cannot decide from docs alone, return "NEEDS-USER-CLARIFY" with the specific question.

Return format (mandatory):
=== VERDICT ===
<single short verdict label>

=== REASONING ===
<2-4 sentences>

=== CITATIONS ===
<file:line OR doc§section, one per line>

=== FOLLOW-UP ===
<one line — what eng/product should do next based on the verdict>

`;

const DECISIONS = [
  {
    id: "D1",
    iaCode: "X-01",
    slug: "wireframe-4-areas-defer",
    question: `IA X-01 (Product landing, route '/') — wireframe 4개 영역(① 헤더/내비, ④ 제품 프리뷰, ⑤ 마스코트, 그리고 description ① 예외 '로그인 사용자는 시작 대신 대시보드 CTA 표시' 분기)가 현재 미구현. 현 상태에서 hero + 2 CTA + 3 feature cards만 렌더되어 description.md 충족율이 4/8 이하.

DECISION: 이 4개 영역을 (A) Phase 7 marketing polish로 이연 — 현재 audit은 PARTIAL 유지, OR (B) 지금 추가 IA todo로 등록 — backlog 우선순위 P2 부여, OR (C) description.md 자체를 축소 — 4 영역을 'future' 명시.`,
    referenceDocs: ["docs/Wireframe/23-X-01-product-landing/description.md", "src/app/page.tsx"],
  },
  {
    id: "D2",
    iaCode: "X-01",
    slug: "cta-copy-alignment",
    question: `IA X-01 의 primary CTA 라벨 drift 결정. description.md ③ 권장 어휘는 '무료 시작 / 회원가입'. 실제 src/app/page.tsx 의 라벨은 '지금 가입하기'. 그리고 tests/e2e/coverage/ia-catalog.ts 의 검수 regex 는 /(무료\\s*시작|시작하기|회원가입)/i.

DECISION: (A) UI를 '회원가입' 또는 '무료 시작'으로 정정 — docs 권장에 맞춤, OR (B) description.md ③를 '지금 가입하기' 또는 일반화된 phrasing으로 정정 — UI를 정본으로 인정, OR (C) 검수 regex 만 확장하여 '지금 가입하기'까지 매칭하도록 — 둘 다 유지. 어떤 방향이 사용자 가치 + 일관성 양쪽을 가장 잘 보존하나?`,
    referenceDocs: ["docs/Wireframe/23-X-01-product-landing/description.md", "tests/e2e/coverage/ia-catalog.ts"],
  },
  {
    id: "D3",
    iaCode: "A-01",
    slug: "displayname-required-vs-optional",
    question: `IA A-01 (Sign-up, /sign-up) — displayName 필드 drift. description.md ③ 제약 조건은 '이름 2-30자' (즉 필수 + 길이 제한). 실제 src/components/auth/SignUpForm.tsx 는 displayName 라벨이 '이름 (선택)' 이고 Form.Item rules 에 min/max 없음.

DECISION: (A) UI를 '이름' (필수) + min:2 max:30 으로 정정 — docs 명세에 맞춤, OR (B) description.md ③를 '이름 2-30자 (선택)' 으로 정정 — UI를 정본으로 인정, OR (C) name 필드 자체를 삭제 — Supabase user_metadata에 빈 값 허용. 한국어 사용자 + TOPIK 학습 컨텍스트에서 '이름' 입력의 product value는?`,
    referenceDocs: ["docs/Wireframe/01-A-01-sign-up/description.md", "src/components/auth/SignUpForm.tsx", "docs/development/auth-overview.md"],
  },
  {
    id: "D4",
    iaCode: "A-01",
    slug: "terms-policy-page",
    question: `IA A-01 — 약관 체크박스 라벨 '이용약관과 개인정보처리방침에 동의합니다' 가 화면에 보이지만 /terms 또는 /privacy 같은 정책 페이지 anchor 가 미연결. 즉 사용자가 동의 강제 받지만 동의 대상을 읽을 수 없음 (dark-pattern 경계).

DECISION: (A) /terms + /privacy placeholder 페이지 즉시 추가 + 체크박스 라벨에 링크 anchor — 법적 기본 충족, OR (B) deferred-scope.md 에 '약관/정책 페이지는 운영 진입 전까지 deferred' 명시 + 체크박스 자체 일시 제거 — 사용자 신뢰 risk 회피, OR (C) 라벨 정정 '운영 정책에 동의 (정책 페이지는 추후 게시)' + 동의 강제 유지 — 솔직 disclosure. TOPIK 사용자 신뢰 + 한국 개인정보보호법 컨텍스트에서 어느 쪽?`,
    referenceDocs: ["docs/Wireframe/01-A-01-sign-up/description.md", "src/components/auth/SignUpForm.tsx", "docs/development/deferred-scope.md"],
  },
  {
    id: "D5",
    iaCode: "A-02",
    slug: "lockout-spec-clarify",
    question: `IA A-02 (Login, /login) — description.md ③ '3회 실패 시 잠금 안내'. 실제 src/components/auth/LoginForm.tsx 는 client-side 실패 counter 미구현. Supabase 는 server-side over_request_rate_limit 으로 처리 + X-11 카드에 reason 매핑 있음.

DECISION: (A) description.md ③를 'Supabase server-side rate-limit 응답으로 잠금 처리 — 클라이언트는 X-11 reason 카드 surface' 로 명확화 (서버 보안 + 정직 명세), OR (B) client-side counter (예: 3회 실패 후 30초 cooldown UI) 구현 — 사용자 친화 + 서버 race 방어, OR (C) 두 layer 동시 — client UI hint + server 강제. 보안 + UX 균형은?`,
    referenceDocs: ["docs/Wireframe/02-A-02-login/description.md", "src/components/auth/LoginForm.tsx", "docs/development/auth-overview.md"],
  },
  {
    id: "D6",
    iaCode: "X-06",
    slug: "stepper-defer",
    question: `IA X-06 (Password reset, /password-reset) — wireframe ② '단계 표시 (이메일 확인 → 인증 코드 → 새 PW 설정 → 완료)' 미구현. 실제 흐름은 /password-reset (request) 와 /password-reset/confirm (confirm) 두 페이지 분리 + 사이에 이메일 링크. Stepper 컴포넌트 자체 부재.

DECISION: (A) Stepper UI 즉시 추가 — antd Steps 컴포넌트로 양 페이지 상단에 배치, 사용자가 절차 위치 파악, OR (B) Phase 7 polish로 이연 — 현 흐름이 working하므로 priority 낮음, OR (C) description.md ②를 '두 페이지 분리 흐름으로 단순화 — Stepper 불필요' 로 정정 — 디자인 결정 변경. 사용자 흐름 + 인증 보안 컨텍스트에서?`,
    referenceDocs: ["docs/Wireframe/28-X-06-password-reset/description.md", "src/app/password-reset/page.tsx", "src/app/password-reset/confirm/page.tsx", "docs/development/auth-overview.md"],
  },
  {
    id: "D7",
    iaCode: "X-06",
    slug: "cooldown-port-from-x12",
    question: `IA X-06 의 PasswordResetRequestForm 에 재전송 cooldown UI 부재. X-12 (VerifyEmailCard.tsx) 는 localStorage 기반 60초 cooldown + Retry-After 헤더 갱신 패턴 (Phase 8 v2.3 hardening) 구현됨.

DECISION: (A) X-12 cooldown 패턴을 X-06 request side로 이식 — code reuse + 일관 UX, priority P1, OR (B) Phase 7로 이연 — request page는 일회성 진입이라 사용자가 빠른 재요청 시도 빈도 낮음, OR (C) 서버 측 rate-limit 응답에만 의존 — UI 부재로 두고 사용자가 over_email_send_rate_limit 으로 X-11 redirect 받음. 보안 + 사용자 인지 부담은?`,
    referenceDocs: ["docs/Wireframe/28-X-06-password-reset/description.md", "src/components/auth/PasswordResetRequestForm.tsx", "src/components/auth/VerifyEmailCard.tsx", "docs/development/auth-overview.md"],
  },
  {
    id: "D8",
    iaCode: "X-11",
    slug: "callback-retry-after-forward-fix",
    question: `IA X-11 (Auth error, /auth/error) — critical eng gap. src/app/auth/callback/route.ts 의 buildErrorUrl 이 Supabase response Retry-After 헤더를 forward하지 않음. 즉 over_email_send_rate_limit / over_request_rate_limit 발생 시 X-11이 받는 retry_after_seconds query 는 항상 sanitizeRetryAfterSeconds 의 60s default. 실제 server 측 Retry-After 가 5분이거나 60분이어도 사용자에게는 항상 60초만 표시. (Codex C-ε note 에 명시된 gap)

DECISION: (A) callback route를 수정하여 Supabase response headers 의 Retry-After 를 추출 + buildErrorUrl 의 retry_after_seconds query 로 forward — 즉시 fix, 1 PR scope, OR (B) X-11 UI를 '재시도 가능 시점은 약 60초 후' 로 일반화 — backend fix 회피, OR (C) Retry-After forward 를 별도 Phase로 이연 — 현 60s default 가 80% case 에서 acceptable. 보안·정확성 + 사용자 신뢰 우선순위?`,
    referenceDocs: ["docs/Wireframe/33-X-11-auth-error/description.md", "src/app/auth/callback/route.ts", "src/lib/auth/error-mapping.ts", "docs/development/auth-overview.md"],
  },
  {
    id: "D9",
    iaCode: "X-11",
    slug: "h1-promotion",
    question: `IA X-11 + X-12 — visibleH1=null in browser-results. 원인: AuthErrorCard 와 VerifyEmailCard 가 antd Card 안의 Typography.Title level=3 (H3) 사용, page level h1 부재. WCAG document outline + 검수 도구 양쪽 영향.

DECISION: (A) page.tsx 에 sr-only h1 추가 (예: <h1 className="sr-only">인증 오류</h1>) — a11y 보완, UI 영향 0, OR (B) Card 내부 Title level=1 으로 승격 — visual hierarchy 변동, OR (C) WCAG 1.3.1 conformance 측면에서 acceptable 로 판단하고 미수정 — Card title role 로 충분. A11y 표준 + 검수 자동화 양쪽 best는?`,
    referenceDocs: ["docs/Wireframe/33-X-11-auth-error/description.md", "docs/Wireframe/34-X-12-auth-verify-email/description.md", "src/components/auth/AuthErrorCard.tsx", "src/components/auth/VerifyEmailCard.tsx", "src/app/auth/error/page.tsx", "src/app/auth/verify-email/page.tsx"],
  },
  {
    id: "D10",
    iaCode: "X-12",
    slug: "smtp-rate-limit-copy",
    question: `IA X-12 (Verify-email, /auth/verify-email) — auth-overview.md §6.3 'Built-in SMTP 2/hour limit' 가 사용자에게 사전 고지되지 않음. 사용자가 60초 cooldown 지났는데도 over_email_send_rate_limit 받으면 X-11 redirect 후에야 인지. Reviewer A 발견: pre-emptive copy 한 줄 권장.

DECISION: (A) VerifyEmailCard 에 neutral pre-emptive 안내 한 줄 추가 (예: '메일이 자주 발송되면 몇 분 후 다시 시도해주세요') — 사용자 친절도 향상, OR (B) reactive only 유지 — over_email_send_rate_limit 시점에 카운트다운으로 surface 됨이 충분, OR (C) Custom SMTP 도입 — 한도 자체 해결, 별건 ops 작업. 신규 가입자 onboarding 마찰 + Custom SMTP 도입 비용 trade-off는?`,
    referenceDocs: ["docs/Wireframe/34-X-12-auth-verify-email/description.md", "src/components/auth/VerifyEmailCard.tsx", "docs/development/auth-overview.md"],
  },
];

// --- run codex per decision -----------------------------------------------

import { writeFileSync as writeFile2 } from "node:fs";
import { tmpdir } from "node:os";

function runCodexExec(prompt) {
  // Windows: `codex` is npm-installed as a .cmd wrapper. spawnSync without
  // shell:true fails silently (exit null, no stdout/stderr). We write the
  // prompt to a tempfile and use `bash -c 'codex exec "$(cat tmpfile)" ...'`
  // to handle both path resolution AND prompt arguments that contain newlines
  // / quotes safely.
  const promptFile = join(tmpdir(), `codex-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  writeFile2(promptFile, prompt, "utf8");

  const cmd = `codex exec "$(cat '${promptFile.replaceAll("\\", "/")}')" -s read-only -c 'model_reasoning_effort="medium"' --enable web_search_cached < /dev/null`;
  const result = spawnSync("bash", ["-c", cmd], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 240_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  // best-effort cleanup
  try {
    spawnSync("rm", ["-f", promptFile.replaceAll("\\", "/")], { encoding: "utf8" });
  } catch {}

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
    timedOut: result.signal === "SIGTERM",
  };
}

const summary = {
  startedAt: new Date().toISOString(),
  decisions: [],
};

for (const decision of DECISIONS) {
  const outPath = join(OUT_DIR, `${decision.id}-${decision.slug}.md`);
  if (existsSync(outPath)) {
    console.log(`[${decision.id}] already exists, skipping`);
    summary.decisions.push({ id: decision.id, iaCode: decision.iaCode, status: "SKIPPED-EXISTS", path: outPath });
    continue;
  }

  const prompt =
    FILESYSTEM_BOUNDARY +
    COMMON_DOCS_CONTEXT +
    `=== DECISION ${decision.id} (${decision.iaCode}) ===\n\n` +
    decision.question +
    `\n\nReference these files to make the call:\n` +
    decision.referenceDocs.map((d) => `- ${d}`).join("\n") +
    `\n\nReturn your verdict in the exact 4-section format specified above.`;

  console.log(`[${decision.id}] ${decision.iaCode} — ${decision.slug}: invoking codex…`);
  const t0 = Date.now();
  const result = runCodexExec(prompt);
  const elapsedMs = Date.now() - t0;

  const body = [
    `# Codex Verdict — ${decision.id} (${decision.iaCode})`,
    "",
    `- Slug: ${decision.slug}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
    `- Codex exit: ${result.status} (timedOut=${result.timedOut})`,
    "",
    "## Question",
    "",
    decision.question,
    "",
    "## Codex stdout (verbatim)",
    "",
    "```",
    result.stdout.trim() || "(empty)",
    "```",
    "",
    "## Codex stderr (tail)",
    "",
    "```",
    (result.stderr || "").trim().split(/\r?\n/).slice(-10).join("\n") || "(empty)",
    "```",
  ].join("\n");

  writeFileSync(outPath, body, "utf8");
  summary.decisions.push({
    id: decision.id,
    iaCode: decision.iaCode,
    status: result.status === 0 ? "PASS" : "FAIL",
    elapsedMs,
    path: outPath,
    timedOut: result.timedOut,
  });
  console.log(`  ↳ wrote ${outPath} (${(elapsedMs / 1000).toFixed(1)}s, exit ${result.status})`);
}

summary.completedAt = new Date().toISOString();
writeFileSync(join(OUT_DIR, "_summary.json"), JSON.stringify(summary, null, 2));
console.log("\nAll 10 decisions processed.");
console.log(`Summary: ${join(OUT_DIR, "_summary.json")}`);
