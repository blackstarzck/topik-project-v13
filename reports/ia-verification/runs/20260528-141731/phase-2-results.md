# IA Verification Phase 2 Results — Browser Coverage (Partial)

- Run id: `20260528-141731`
- Audit dir: `reports/ia-verification/runs/20260528-141731/`
- Source commit: `b7b7189681aaf7f5aed8a3b2ec7d34c187f365ff`
- Evidence bundle: `96e5d23b0ad1221f`
- Monitor mode: `single-session-degraded`
- Phase ledger: `docs/ai-workflow/runs/2026/05/28/20260528-1530-ia-verification-phase-2.md`

## 한 줄 결론

Phase 2 절반 통과. 카탈로그 + 스펙 + 빌더 다 깔고 Playwright 돌려서 public 6개 IA × 3 viewport = 18개 row는 실제 증거 수집했어. Protected/admin 28개 IA는 `storageState` 파일 부재로 BLOCKED — service_role 키가 security 이유로 회전된 상태라 이번 세션에선 못 만듦. 최종 라벨은 여전히 34 BLOCKED (Phase 3-5도 남아있어서).

## 3카드 스코어보드

### 🟢 Phase 2 달성
- `tests/e2e/coverage/ia-catalog.ts` 신규 — 34 IA + 5 hosted surface 모든 metadata
- `tests/e2e/coverage/coverage-matrix.spec.ts` 리라이트 — catalog 임포트, X-11/X-12/모달 5개 포함 (이전엔 누락)
- `scripts/audit-setup/build-storage-state.mjs` skeleton + precondition guard
- `scripts/audit-setup/build-browser-results.mjs` 신규 — Playwright JSON → schema-conformant evidence
- `pnpm test:ia:storage-state`, `pnpm test:ia:browser-results` 명령 추가
- Playwright 102/102 PASS (0 unexpected, ~89초)
- 18개 public 라우트 스크린샷 (360/768/1280)
- `browser-results.json` 102 rows 발행

### 🟡 정직한 PARTIAL/BLOCKED
- Public 18 rows = `PARTIAL` — heading은 PASS, heuristic CTA-pattern 매칭 실패 + dev-mode HMR WebSocket console error (환경적 잡음, product defect 아님 — `audit-flow-monitor.json knownNoise` 분류)
- Protected 84 rows = `BLOCKED` — `storageStateMissing: true` 정직 기록
- Final IA labels: **34 BLOCKED** (변동 없음; Phase 3-5 미완)

### 🔴 다음 작업
| 우선순위 | 할 일 | 차단/조건 |
| --- | --- | --- |
| 🔴 P0 | SUPABASE_SERVICE_ROLE_KEY 회전 → build-storage-state.mjs `--apply` 본체 구현 | security ops 결정 + .env.local 갱신 |
| 🔴 P1 | `tests/e2e/coverage/hosted-surfaces.spec.ts` (C-03/D-M1/D-M2/D-M3/F-M1) | storage state P0 우선 |
| 🟡 P2 | `tests/e2e/coverage/session-navigation.spec.ts` + auth-route-handlers | 마찬가지 |
| 🟡 P3 | `/auth/sign-out` route handler 구현 | source-map FAIL 해결 |
| 🟢 P4 | Phase 5 AI UX review (multi-agent 6 shard) | Phase 2-4 evidence 전부 |
| 🟢 P5 | Codex cross-model review | 본 catalog + spec |

## 무슨 일? / 왜 문제? / 고치는 법

### 무슨 일?

계획서 §8 (Phase 2 Browser Coverage Upgrade) 그대로 실행:
1. 34 IA 메타데이터를 typed catalog로 추출
2. coverage-matrix를 catalog-driven으로 리라이트 (이전엔 inline ROUTES, 27 IA만; 이젠 34 IA + 모달 5개 포함)
3. Playwright 실행 — 외부에서 이미 실행 중이던 dev 서버 활용
4. 결과를 `browser-results.json` 스키마로 변환

### 왜 문제 (있다면)?

- **Public**: 6개 IA 다 HTTP 200 + heading 매칭 OK. 다만 CTA pattern 일부 미스 + HMR WS error — Phase 5 AI UX 리뷰어가 actual rendered UX와 대조해서 정합성 판정해야 함.
- **Protected**: 84개 row 모두 storageState 부재. service_role 키 (DB admin 권한)가 2026-05-27에 chat transcript 노출로 회전 처리됨 — 보안 사고 후 일시적으로 비활성. 이번 세션에서 회전 못 됨.
- **Phase 6 final label**: Plan §12 Step 6.2는 "non-PASS 라벨이 1개라도 있으면 final PASS 불가"라 Phase 3-5가 비어있는 한 34 BLOCKED 유지.

### 고치는 법 (다음 세션)

```text
1. service_role 회전 + .env.local 업데이트 (SUPABASE_TEST_PASSWORD 포함)
   → pnpm test:ia:storage-state --apply
   → tests/e2e/auth-state/{student,content_admin,org_admin,platform_admin}.json 생성
2. pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts
   → 84개 protected row BLOCKED → PASS/PARTIAL로 전환
3. Phase 3 hosted-surfaces.spec.ts 작성
4. Phase 4 session-navigation.spec.ts + auth-route-handlers
5. Phase 5 multi-agent IA shard 리뷰 dispatch
```

## 검증 명령 + 결과

| 명령 | 결과 | 메모 |
| --- | --- | --- |
| `curl http://127.0.0.1:3000/` | 200 | 기존 dev 서버 (PID 39752) 활용 |
| `pnpm test:ia:storage-state` | exit 1 BLOCKED | precondition snapshot at `tests/e2e/auth-state/build-status.json` |
| `pnpm exec playwright test tests/e2e/coverage/coverage-matrix.spec.ts` | 102/102 PASS | 0 unexpected, ~89s, 3 viewports |
| `pnpm test:ia:browser-results` | PASS | 102 rows, 18 PARTIAL + 84 BLOCKED |
| `pnpm test:ia:merge` | PASS | 34 BLOCKED final |
| `pnpm test:ia:validate` | PASS | BLOCKED labels accepted (monitor evidence 정합성 통과) |

## 변경된 파일

### 신규
- `docs/ai-workflow/runs/2026/05/28/20260528-1530-ia-verification-phase-2.md` (run ledger)
- `tests/e2e/coverage/ia-catalog.ts`
- `scripts/audit-setup/build-storage-state.mjs`
- `scripts/audit-setup/build-browser-results.mjs`
- `tests/e2e/auth-state/build-status.json`
- `reports/ia-verification/runs/20260528-141731/browser-results.json`
- `reports/ia-verification/runs/20260528-141731/phase-2-results.md` (이 파일)
- `screenshots/coverage-{A-01,A-02,X-01,X-06,X-11,X-12}-{360,768,1280}.png` (18개)

### 수정
- `tests/e2e/coverage/coverage-matrix.spec.ts` (전면 리라이트)
- `package.json` (`test:ia:storage-state`, `test:ia:browser-results` 추가)
- `tests/e2e/coverage/failure-log.json` (Playwright 자동 갱신)
- `reports/ia-verification/runs/20260528-141731/audit-flow-monitor.json` (Phase 2 checkpoint 갱신)
- `reports/ia-verification/runs/20260528-141731/ia-implementation-audit.{json,md}` (re-merged)
- `reports/ia-verification/runs/20260528-141731/ia-implementation-audit-validation.json` (re-validated)

## Doc Conflicts (Phase 2 발견·기록)

- `playwright.config.ts` 헤더 코멘트가 legacy plan(`20260523-0100-implementation-coverage-audit.md`)을 가리킴 — 현재 active plan은 `docs/ai-workflow/ia-implementation-verification-execution-plan.md`. cosmetic drift, 별건 정정.
- `tests/e2e/coverage/golden-path.spec.ts`와 `coverage-matrix.spec.ts` 사이 일관성은 본 run에선 검사 안 함 (Phase 5에서 cross-check 권장).

## Risks / Follow-Up

- Heuristic CTA regex가 Phase 5 reviewer 판정에서 false-negative로 분류될 수 있음 — actual rendered UI와 대조해 catalog 정정 가능성.
- HMR WebSocket console error는 dev-server 공유 환경 잡음이라 `knownNoise`에 분류했지만 production smoke test에서는 안 나와야 함.
- Cross-model review (Codex) 안 거침 — degraded.

## 정직 보고

- Final IA labels: **34 BLOCKED** (Phase 2 evidence 새로 통합됐어도 Phase 3/4/5 부재로 BLOCKED 유지).
- 어떤 IA도 PASS 못 받았어. Public 라우트는 PARTIAL까지 올라왔지만 final PASS는 Phase 4 (security-navigation) + Phase 5 (AI UX + human confirmation) 통과해야만 가능 — 계획서 §14 Completion Gate 룰.
- `pnpm test:ia:validate` PASS는 "false PASS 검출 없음"의 의미지 시스템이 PASS 받은 게 아니야.
- 18개 public-route 스크린샷은 disk에 저장됨; `screenshots/coverage-*.png` 확인 가능.
