export const meta = {
  name: 'wireframe-page-review-2layer',
  description: '2-layer review (SOT conformance + multi-lens independent analysis + adversarial verify) of 35 user-facing screens vs docs/Wireframe; writes one md per page',
  phases: [
    { title: 'Layer1-SOT', detail: 'one reviewer per screen vs docs/Wireframe + real capture' },
    { title: 'Layer2-lenses', detail: '3 parallel lenses per screen: interaction / visual+responsive+a11y / content+data' },
    { title: 'Adversarial-verify', detail: 'refute high-severity findings per screen' },
    { title: 'Synthesize', detail: 'merge + write pages/<screen>.md + scorecard' },
  ],
}

const BASE = 'C:/Users/admin/Desktop/workspace/topik-project/v13'
const SHOTS = BASE + '/.design-review-shots/20260609'
const WF = BASE + '/docs/Wireframe'
const PAGES = BASE + '/docs/design-review-result/20260609-wireframe-page-review/pages'
const FINDINGS = BASE + '/.scratch/review-2026-06-09/capture-findings.md'
const HEALTH = SHOTS + '/_health.json'

// 35 user-facing screens (admin H-01/X-08/X-10/X-15 excluded). wf = wireframe folder.
// shots = capture label prefixes present under SHOTS (viewport suffixes -360/-768/-1280).
const REGISTRY = [
  { ia: 'A-01', wf: '01-A-01-sign-up', route: '/sign-up', audience: 'public', status: 'rendered', img: true, shots: ['01-A-01-sign-up'] },
  { ia: 'A-02', wf: '02-A-02-login', route: '/login', audience: 'public', status: 'rendered', img: true, shots: ['02-A-02-login', '02-A-02-login-session-expired'] },
  { ia: 'A-03', wf: '03-A-03-learning-goal-setup', route: '/onboarding/learning-goal', audience: 'user', status: 'rendered', img: true, shots: ['03-A-03-learning-goal-setup'] },
  { ia: 'B-01', wf: '04-B-01-home-dashboard', route: '/dashboard', audience: 'user', status: 'rendered', img: true, shots: ['04-B-01-home-dashboard'] },
  { ia: 'C-01', wf: '05-C-01-problem-type-recommendations', route: '/practice/recommendations', audience: 'user', status: 'rendered', img: true, shots: ['05-C-01-problem-type-recommendations'] },
  { ia: 'C-02', wf: '06-C-02-problem-list', route: '/practice/problems', audience: 'user', status: 'rendered', img: true, shots: ['06-C-02-problem-list'] },
  { ia: 'C-03', wf: '07-C-03-retry-modal', route: '(host C-02 /practice/problems)', audience: 'user', status: 'deferred', img: true, shots: ['_diag-07-C-03-retry-modal', '_diag-c03-search'], defer: 'retry affordance unreachable: problem_attempts empty so solve_state never marks rows solved (verified 3 ways). See capture-findings.md.', src: ['src/components/practice/RetryModal.tsx', 'src/components/practice/ProblemListView.tsx', 'src/components/practice/ProblemRow.tsx'] },
  { ia: 'D-01', wf: '08-D-01-short-answer-writing-51', route: '/writing/short-answer-writing-51', audience: 'user', status: 'rendered', img: true, shots: ['08-D-01-short-answer-writing-51'] },
  { ia: 'D-02', wf: '09-D-02-answer-writing-52', route: '/writing/answer-writing-52', audience: 'user', status: 'rendered', img: true, shots: ['09-D-02-answer-writing-52'] },
  { ia: 'D-03', wf: '10-D-03-long-form-writing-53', route: '/writing/long-form-writing-53', audience: 'user', status: 'rendered', img: true, shots: ['10-D-03-long-form-writing-53'] },
  { ia: 'D-04', wf: '11-D-04-essay-writing-54', route: '/writing/essay-writing-54', audience: 'user', status: 'rendered', img: true, shots: ['11-D-04-essay-writing-54'] },
  { ia: 'D-M1', wf: '12-D-M1-submission-confirmation-modal', route: '(host writing editor)', audience: 'user', status: 'rendered', img: true, shots: ['12-D-M1-submission-confirmation-modal'] },
  { ia: 'D-M2', wf: '13-D-M2-ai-analysis-loading', route: '(host writing submit transition)', audience: 'user', status: 'deferred', img: true, shots: [], defer: 'transient state; mock feedback resolves sub-second so not captured live.', src: ['src/components/feedback/AnalysisLoadingModal.tsx', 'src/components/feedback/FeedbackPendingPanel.tsx'] },
  { ia: 'E-01', wf: '14-E-01-short-answer-feedback', route: '/writing/feedback/short/<id>', audience: 'user', status: 'rendered', img: true, shots: ['14-E-01-short-answer-feedback'] },
  { ia: 'E-02', wf: '15-E-02-long-form-feedback', route: '/writing/feedback/long/<id>', audience: 'user', status: 'rendered', img: true, shots: ['15-E-02-long-form-feedback'] },
  { ia: 'R-01', wf: '16-R-01-comparison-report', route: '/writing/reports/<id>/compare', audience: 'user', status: 'rendered', img: true, shots: ['16-R-01-comparison-report'], note: 'seeded via app flow; no-previous (single-result) state' },
  { ia: 'R-02', wf: '17-R-02-next-problem-recommendation', route: '/practice/next', audience: 'user', status: 'rendered', img: true, shots: ['17-R-02-next-problem-recommendation'] },
  { ia: 'F-01', wf: '18-F-01-my-library', route: '/library', audience: 'user', status: 'rendered', img: true, shots: ['18-F-01-my-library-empty', '18-F-01-my-library-populated'] },
  { ia: 'F-M1', wf: '19-F-M1-pdf-export-modal', route: '(host /library)', audience: 'user', status: 'rendered', img: true, shots: ['19-F-M1-pdf-export-modal'] },
  { ia: 'G-01', wf: '20-G-01-language-settings', route: '/settings/language', audience: 'user', status: 'rendered', img: true, shots: ['20-G-01-language-settings'] },
  { ia: 'D-M3', wf: '22-D-M3-autosave-warning', route: '(host writing editor)', audience: 'user', status: 'rendered', img: true, shots: ['22-D-M3-autosave-warning'] },
  { ia: 'X-01', wf: '23-X-01-product-landing', route: '/', audience: 'public', status: 'rendered', img: true, shots: ['23-X-01-product-landing'] },
  { ia: 'X-02', wf: '24-X-02-growth-dashboard', route: '/growth', audience: 'user', status: 'rendered', img: true, shots: ['24-X-02-growth-dashboard'] },
  { ia: 'X-03', wf: '25-X-03-paywall', route: '/paywall', audience: 'user', status: 'rendered', img: true, shots: ['25-X-03-paywall'] },
  { ia: 'X-04', wf: '26-X-04-subscription-management', route: '/subscription', audience: 'user', status: 'rendered', img: true, shots: ['26-X-04-subscription-management'] },
  { ia: 'X-05', wf: '27-X-05-profile-editing', route: '/profile', audience: 'user', status: 'rendered', img: true, shots: ['27-X-05-profile-editing'] },
  { ia: 'X-06', wf: '28-X-06-password-reset', route: '/password-reset', audience: 'public', status: 'rendered', img: true, shots: ['28-X-06-password-reset'] },
  { ia: 'X-07', wf: '29-X-07-weakness-based-recommendations', route: '/practice/weakness', audience: 'user', status: 'rendered', img: true, shots: ['29-X-07-weakness-based-recommendations'] },
  { ia: 'X-09', wf: '31-X-09-notification-settings', route: '/settings/notifications', audience: 'user', status: 'rendered', img: true, shots: ['31-X-09-notification-settings'] },
  { ia: 'X-11', wf: '33-X-11-auth-error', route: '/auth/error', audience: 'public', status: 'rendered', img: false, shots: ['33-X-11-auth-error-otp', '33-X-11-auth-error-ratelimit'] },
  { ia: 'X-12', wf: '34-X-12-auth-verify-email', route: '/auth/verify-email', audience: 'public', status: 'rendered', img: false, shots: ['34-X-12-auth-verify-email'] },
  { ia: 'X-13', wf: '35-X-13-terms', route: '/terms', audience: 'public', status: 'rendered', img: false, shots: ['35-X-13-terms'] },
  { ia: 'X-14', wf: '36-X-14-privacy-policy', route: '/privacy', audience: 'public', status: 'rendered', img: false, shots: ['36-X-14-privacy'] },
  { ia: 'X-16', wf: '38-X-16-password-reset-confirm', route: '/password-reset/confirm', audience: 'public', status: 'rendered', img: false, shots: ['38-X-16-password-reset-confirm'] },
  { ia: 'X-17', wf: '39-X-17-auth-callback-fragment', route: '/auth/callback-fragment', audience: 'public', status: 'rendered', img: false, shots: ['39-X-17-auth-callback-fragment'] },
]

const shotPath = (label, vp) => `${SHOTS}/${label}-${vp}.png`
const sotFiles = (s) => {
  const d = `${WF}/${s.wf}`
  const f = [`${d}/description.md`, `${d}/functional-spec.md`, `${d}/screen-data-summary.md`]
  if (s.img) { f.push(`${d}/hifi.png`); f.push(`${d}/wireframe.png`) }
  return f
}
const shots1280 = (s) => s.shots.map((l) => l.startsWith('_diag') ? `${SHOTS}/${l}.png` : shotPath(l, 1280))
const shotsResp = (s) => s.shots.flatMap((l) => l.startsWith('_diag') ? [`${SHOTS}/${l}.png`] : [shotPath(l, 360), shotPath(l, 1280)])
const srcFiles = (s) => (s.src || []).map((p) => `${BASE}/${p}`)

const L1_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'perception', 'elements', 'summary'],
  properties: {
    verdict: { type: 'string', enum: ['일치', '부분일치', '불일치', '문서에없음', 'UNVERIFIED'] },
    perception: { type: 'string', description: 'precise factual description of what is actually rendered (elements, layout per viewport, visible Korean copy, anomalies, dev indicators)' },
    elements: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'status'], properties: { name: { type: 'string' }, status: { type: 'string', enum: ['present', 'missing', 'deviated'] }, note: { type: 'string' } } } },
    stateCoverage: { type: 'array', items: { type: 'string' } },
    copyIssues: { type: 'array', items: { type: 'string' } },
    dataContractNotes: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}
const LENS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'findings'],
  properties: {
    lens: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'severity', 'evidence', 'recommendation'], properties: {
      title: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'nit'] }, evidence: { type: 'string' }, viewport: { type: 'string' }, recommendation: { type: 'string' } } } },
    notes: { type: 'string' },
  },
}
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'judgment', 'reason'], properties: {
      title: { type: 'string' }, judgment: { type: 'string', enum: ['confirmed', 'refuted', 'downgraded'] }, finalSeverity: { type: 'string', enum: ['P0', 'P1', 'P2', 'nit', 'removed'] }, reason: { type: 'string' } } } },
    falsePositivesRemoved: { type: 'number' },
  },
}
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['ia', 'writtenPath', 'scorecard', 'counts', 'topFindings', 'captureStatus'],
  properties: {
    ia: { type: 'string' }, writtenPath: { type: 'string' }, captureStatus: { type: 'string' },
    scorecard: { type: 'object', additionalProperties: false, required: ['overall'], properties: { sotConformance: { type: 'number' }, ux: { type: 'number' }, visual: { type: 'number' }, a11y: { type: 'number' }, responsive: { type: 'number' }, content: { type: 'number' }, overall: { type: 'number' } } },
    counts: { type: 'object', additionalProperties: false, properties: { p0: { type: 'number' }, p1: { type: 'number' }, p2: { type: 'number' } } },
    topFindings: { type: 'array', items: { type: 'string' } },
  },
}

const CTX = `App: TALKPIK, a Korean TOPIK writing-practice web app (Next.js 16 App Router + antd 6). Screens default to Korean. Captures are REAL hydrated dev renders on localhost/127.0.0.1. Caveats: Korean innerText is dense (short text length != thin content); the small dark "N" / "1 Issue" badge bottom-left is the Next.js dev indicator (note if it reports issues, that means console errors). Do NOT invent facts; if unverifiable, say UNVERIFIED.`

function l1Prompt(s) {
  const evid = s.status === 'deferred'
    ? `LIVE CAPTURE DEFERRED for this screen. Reason: ${s.defer}\nEvaluate from COMPONENT SOURCE: ${srcFiles(s).join(', ')}\nDiagnostic screenshots (if any): ${s.shots.map((l) => `${SHOTS}/${l}.png`).join(', ') || '(none)'}`
    : `Read the REAL captured screenshots (1280px): ${shots1280(s).join(', ')}`
  return `${CTX}\n\nYou are the Layer-1 SOT-conformance reviewer for screen ${s.ia} (${s.route}), audience=${s.audience}.\n\n${evid}\n\nRead the source-of-truth (SOT) docs: ${sotFiles(s).join(', ')}\n\nTASK: Judge whether the implemented screen matches the SOT wireframe/spec. Assess (1) main UI regions present/missing/deviated, (2) buttons/CTAs & navigation, (3) states loading/empty/error/success/disabled, (4) copy/labels (i18n), (5) data contract (fields displayed vs documented meaning), (6) flow links.\nAlso fill 'perception': a precise, factual description of what is ACTUALLY rendered (elements, layout, visible Korean copy, anomalies, dev-indicator issues) — downstream reviewers depend on it.\nReturn the structured object. Be exact and honest; mark UNVERIFIED rather than guessing.`
}

function lensPrompt(s, lens, l1) {
  const per = `First-pass perception (verify it yourself, don't trust blindly):\n${l1.perception}`
  const look = s.status === 'deferred'
    ? `Live capture deferred (${s.defer}). Read component source: ${srcFiles(s).join(', ')}`
    : (lens === 'visual'
        ? `Read these screenshots yourself (mobile 360 + desktop 1280): ${shotsResp(s).join(', ')}`
        : `Read this screenshot yourself (1280): ${shots1280(s).join(', ')}`)
  let focus
  if (lens === 'interaction') focus = `LENS = UX / IA / state-coverage. Evaluate information hierarchy, click paths, cognitive load, empty-state guidance, and whether loading/empty/error/success/disabled states are present and sensible. Flow connection to neighbouring screens.`
  else if (lens === 'visual') focus = `LENS = visual design-system + responsive + accessibility. antd component/token consistency, spacing/alignment, typography, visual slop; responsive 360 vs 1280 (layout breaks, overflow, truncation, tap targets); a11y (contrast, focus, labels/aria). Cite the viewport for each responsive finding.`
  else focus = `LENS = content/i18n + data contract. Copy clarity & Korean quality, untranslated/hardcoded leftovers, redundant/duplicated labels; whether displayed data agrees with the documented schema meaning. ALSO read ${FINDINGS} for console-error and data findings that are NOT visible in screenshots, and incorporate the ones relevant to this screen.`
  return `${CTX}\n\nIndependent reviewer for screen ${s.ia} (${s.route}).\n${focus}\n\n${per}\n\n${look}\n\nSOT for reference: ${sotFiles(s).slice(0, 3).join(', ')}\n\nReport findings as a list with severity P0(fix now)/P1(this week)/P2(later)/nit, concrete evidence (what you saw + viewport), and a recommendation. No slop; if nothing material, return an empty findings array.`
}

function verifyPrompt(s, st2) {
  const bundle = { l1Verdict: st2.l1.verdict, l1Elements: st2.l1.elements, l1Copy: st2.l1.copyIssues, l1Data: st2.l1.dataContractNotes, lenses: (st2.lenses || []).map((x) => ({ lens: x.lens, findings: x.findings })) }
  const look = s.status === 'deferred' ? `Source: ${srcFiles(s).join(', ')}` : `Re-read the 1280 screenshot to verify: ${shots1280(s).join(', ')}`
  return `${CTX}\n\nADVERSARIAL VERIFIER for screen ${s.ia} (${s.route}). Self-evaluation has confirmation bias, so your job is to REFUTE.\n\nFindings from the 4 reviewers (JSON):\n${JSON.stringify(bundle).slice(0, 9000)}\n\n${look}\n\nFor every P0/P1 finding, try to disprove it: is it actually true on THIS rendered screen, or a misread / over-claim / SOT misunderstanding / dev-only noise? Default to skeptical. Output a verdict per high-severity finding: confirmed / refuted / downgraded, with finalSeverity and a one-line reason. Count how many false positives you removed.`
}

function synthPrompt(s, st3) {
  const file = `${PAGES}/${s.wf}.md`
  const bundle = { ia: s.ia, route: s.route, audience: s.audience, status: s.status, defer: s.defer || null, note: s.note || null, l1: st3.l1, lenses: (st3.lenses || []).map((x) => ({ lens: x.lens, findings: x.findings, notes: x.notes })), verify: st3.verify }
  const evid = s.status === 'deferred'
    ? `Capture status: DEFERRED — ${s.defer}. Diagnostic/source basis only.`
    : `Screenshots (cite relative paths): ${s.shots.map((l) => `.design-review-shots/20260609/${l}-{360,768,1280}.png`).join(' ; ')}`
  return `${CTX}\n\nYou are the SYNTHESIS author for screen ${s.ia} (${s.route}).\nInputs (Layer1 + 3 Layer2 lenses + adversarial verdicts), JSON:\n${JSON.stringify(bundle).slice(0, 12000)}\n\nAlso read the global capture facts ${FINDINGS} and the render-health file ${HEALTH} (find entries whose label starts with one of: ${s.shots.join(', ')}) to state HTTP status / console-error count / hydration honestly.\n\nMERGE RULES: drop findings the verifier marked 'refuted'; apply 'downgraded' severities; dedupe across lenses; keep only what survives. ${evid}\n\nThen WRITE the review to EXACTLY this path with the Write tool: ${file}\nUse this Korean template (write for non-developers per the project style; put expert terms in parentheses):\n\n# ${s.wf} — 와이어프레임 기준 리뷰\n\n## 1. 메타\n- IA / 라우트 / audience / 캡처 상태(rendered·deferred·UNVERIFIED) / host(모달이면)\n\n## 2. 캡처 증거\n- 뷰포트별 스크린샷 경로 + 렌더 헬스(HTTP 상태·콘솔에러 수·하이드레이션·에러 오버레이). 헬스는 ${HEALTH} 근거.\n\n## 3. Layer 1 — SOT 정합 리뷰\n- 표: 요소 / 상태 / 문구 / 데이터계약 = 있음·없음·벗어남, 그리고 종합 verdict(일치/부분일치/불일치/문서에없음/UNVERIFIED).\n\n## 4. Layer 2 — 멀티 에이전트 독립 분석\n- 차원별(UX·IA / 비주얼·디자인시스템 / 접근성 / 반응형 / 콘텐츠·i18n / 상태 커버리지 / 데이터계약) 발견 + 심각도. 적대적 검증에서 제거/하향된 항목은 제외하거나 그 사실을 명시.\n\n## 5. 결론 — 개선안\n- P0(지금 당장) / P1(이번 주 안에) / P2(여유 있을 때)로 묶어 각 항목에 근거(어느 레이어·어느 증거)와 영향 범위를 적는다.\n\nAfter writing, RETURN the structured summary. scorecard fields are 0–10 (10=best); set dimensions you could not assess to a reasonable estimate and lower 'overall' if capture was deferred/UNVERIFIED. topFindings = up to 4 one-line strings of the surviving highest-priority items.`
}

const only = (args && args.only) ? new Set(args.only) : null
const screens = only ? REGISTRY.filter((s) => only.has(s.ia)) : REGISTRY
log(`reviewing ${screens.length} screen(s): ${screens.map((s) => s.ia).join(', ')}`)

const results = await pipeline(
  screens,
  (s) => agent(l1Prompt(s), { label: `L1:${s.ia}`, phase: 'Layer1-SOT', schema: L1_SCHEMA }).then((l1) => ({ s, l1 })),
  (p, s) => parallel([
    () => agent(lensPrompt(s, 'interaction', p.l1), { label: `L2-ux:${s.ia}`, phase: 'Layer2-lenses', schema: LENS_SCHEMA }),
    () => agent(lensPrompt(s, 'visual', p.l1), { label: `L2-vis:${s.ia}`, phase: 'Layer2-lenses', schema: LENS_SCHEMA }),
    () => agent(lensPrompt(s, 'content', p.l1), { label: `L2-content:${s.ia}`, phase: 'Layer2-lenses', schema: LENS_SCHEMA }),
  ]).then((lenses) => ({ ...p, lenses: lenses.filter(Boolean) })),
  (p, s) => agent(verifyPrompt(s, p), { label: `verify:${s.ia}`, phase: 'Adversarial-verify', schema: VERIFY_SCHEMA }).then((verify) => ({ ...p, verify })),
  (p, s) => agent(synthPrompt(s, p), { label: `synth:${s.ia}`, phase: 'Synthesize', schema: SYNTH_SCHEMA }),
)

const ok = results.filter(Boolean)
log(`synthesized ${ok.length}/${screens.length} pages`)
return { count: ok.length, total: screens.length, pages: ok }
