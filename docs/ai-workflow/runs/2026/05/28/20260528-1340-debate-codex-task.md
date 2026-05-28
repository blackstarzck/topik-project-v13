# Task Packet — Codex Debate Partner

- Agent: Codex (GPT-5.5)
- Role: Independent debate partner — challenge or agree with Opus findings on the IA verification plan
- Objective: Opus가 정본 md(`docs/ai-workflow/ia-implementation-verification-execution-plan.md`)에서 발견한 9개 이슈에 대해 항목별로 (1) 동의/반대 (2) 근거 (3) 더 나은 대안 또는 제안 수정안 보강을 제시
- Audience: n/a (workflow doc audit)
- Accepted scope:
  - 9개 이슈 각각에 대해 입장 표명 + 근거
  - 정본 md 의 구체 line number 인용 권장
  - 합의 또는 대안 제시 시 정확한 diff 또는 paragraph 단위 제안
- Out of scope:
  - 새 이슈 발굴 (시간 절약 — 단, 9개 중 어느 하나가 잘못된 전제 위에 있다면 그건 지적 가능)
  - 코드 실행, 스크립트 작성 (문서 토론만)
  - HTML 설명서 변경
- Docs consulted (반드시 읽어주세요):
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md` (정본, 1367 lines)
  - `package.json` (npm scripts 확인용)
  - `scripts/audit-setup/` 폴더 (실제 builder/validator 존재 확인)
- Extracted requirements:
  - 정본 md 의 핵심 원칙(34개 IA, JSON 우선, 라벨 6개, collector-first, monitor lane) 은 보존
  - 합의 결과는 정본 md 의 영어 본문 스타일에 맞춰 영어로 제안
  - 합의 못 보면 명확히 "STALEMATE — opus position X, my counter Y" 라고 표시 (제3 codex 가 판정할 수 있게)
- Exact read scope:
  - `docs/ai-workflow/ia-implementation-verification-execution-plan.md`
  - `package.json`
  - `scripts/audit-setup/*.mjs`, `scripts/*.mjs`
  - `reports/ia-verification/runs/20260528-112902/*.json` (기존 run 결과 — 실제 산출물 형태 확인용)
- Exact write scope:
  - 응답으로 markdown text 만 반환 — 파일 직접 수정 금지
- Files not to touch: (이 packet 응답에는 파일 수정 없음)
- Constraints:
  - 응답은 issue 별로 분리, "Issue #N — AGREE/DISAGREE/PARTIAL/STALEMATE" 헤더 사용
  - 각 이슈마다 "Evidence:", "My recommendation:" 두 줄 의무
  - 토론은 한 라운드만 (재토론 무한 루프 회피)
- Required verification:
  - 정본 md 의 line number 인용이 실제와 일치해야 함
  - 새 룰 제안 시 기존 룰과 충돌 여부 자체 확인 후 응답
- Expected output:
  - 단일 markdown 문서, 9개 issue 모두 다룸
  - 끝에 "Summary table" — issue 번호 / 입장 / 한 줄 핵심
- Context ledger path: `docs/ai-workflow/runs/2026/05/28/20260528-1340-ia-plan-debate.md`

## Docs Consulted

- Exact files read: see parent ledger `20260528-1340-ia-plan-debate.md` §Docs Consulted.
- Extracted requirements: see parent ledger.
- Doc conflicts: none beyond the 9 issues debated here.
- Untouched relevant docs and reason: n/a (this is a child packet; the parent ledger owns the canonical list).

## Verification State

- Required checks: codex exec response received and parsed.
- Checks run: codex exec one round (non-interactive, sandbox=read-only).
- Latest results: response stored at `C:\Users\admin\AppData\Local\Temp\codex-debate-response.md`; per-issue stance table reflected in parent ledger.
- Known failures: none.
- Skipped checks and reason: n/a — debate-only packet, no code changed by this packet itself.
- Cross-model review: codex (GPT-5.5) — this packet is the cross-model review.
- Architecture Pass: n/a — doc-only debate.
- Light Spec: n/a — not a phase task.
- UX/UI Consistency Pass: n/a — no UI change.
- QA Gate: n/a — no UI change.

## Ledger/File-State Consistency

- Files changed match accepted scope: yes (parent ledger tracks plan md edits; this packet records no direct file edits).
- Docs consulted match implemented behavior: yes.
- Child result packets integrated: yes — codex response captured and decisions table built in parent ledger.
- Verification state current: yes.
- Remaining risks listed: yes — see parent ledger §Risks And Follow-Up.

---

## Opus 의 9개 이슈 요약 (전체 본문은 ledger 참조)

### 🔴 #1 — Phase 0.5 `doc-receipts.json` builder 부재

**Opus position**: Step 0.5.1 은 receipt 생성을 지시하나 builder 미정의. validator(0.5.2)만 있음. Phase 1 은 builder/validator 쌍인데 0.5 는 비대칭. 사람이 34개 IA × 다수 필드를 수기 작성하는 건 비현실적, line 7 "script-backed" 원칙과 어긋남.

**Opus 제안**: 두 옵션 중 택1
- A: `scripts/audit-setup/build-doc-receipts.mjs` 신설 (IA 폴더 스캐닝으로 skeleton 자동 생성)
- B: "doc-receipts 는 Phase 0.5 dispatch task packet 으로 IA shard agent 가 작성" 임을 plan 에 명시

### 🔴 #2 — `dirtyState` / `evidenceBundleId` / `resultPacketHash` 정의 부재

**Opus position**: line 124–143 모든 JSON row 필수 필드인데 계산식이 어디에도 정의 없음. merger 와 validator 가 다르게 계산하면 false positive/negative 발생.

**Opus 제안**: §4 끝에 "Identifier Definitions" 소절 추가.
- `evidenceBundleId = sha256(sorted phase JSON row hashes)`
- `dirtyState = "clean" if git status --porcelain == "" else "dirty"`
- `resultPacketHash = sha256(result packet JSON content)`
- `sourceCommit = git rev-parse HEAD`

### 🟡 #3 — Phase 5 부분 재실행 vs `evidenceBundleId` 일치 룰 충돌

**Opus position**: line 1188–1191 "Re-run Phase 5 only for changed pages" 와 line 145–148 "evidenceBundleId must match" 충돌 가능성. 새 runId 로 0.5–4 돌리면 옛 Phase 5 row 는 stale.

**Opus 제안**: §13 Execution Order step 16–18 에 carry-over 룰 추가: "변경 영향 없는 IA 는 옛 evidenceBundleId 유지·carry-over, 변경된 IA 만 새 row 생성".

### 🟡 #4 — Phase 0.4 `pnpm test` 실패 시 진입 조건 모호

**Opus position**: pre-implementation 단계에서 `pnpm test` FAIL 거의 확실. checkpoint FAIL 이면 진입 불가, `CONCERN_ACCEPTED` 우회는 coordinator 재량 — 객관 기준 없으면 게이트 무력화 위험.

**Opus 제안**: Step 0.4 에 "src/ 부재 또는 명시적 pre-implementation 상태에서 `pnpm test` 실패는 자동 `CONCERN_ACCEPTED`, audit-flow-monitor 에 root cause 기록 의무" 명시.

### 🟡 #5 — Step 1.6 dispatch 명령 순서

**Opus position**: line 608–611 명령 순서가 manifest → source-map → dispatch → static. dispatch builder(1.5)는 static 결과 require 안 함이 사실이나, 산출물 목록(line 614–624)은 manifest/source-map/static/dispatch 순서를 자연스럽게 시사하여 독자 혼선.

**Opus 제안**: 명령 순서를 manifest → source-map → static → dispatch 로 재정렬 (가벼운 cosmetic 수정).

### 🟢 #6 — `monitorMode` 혼합 케이스 미정의

**Opus position**: line 421 두 값(`independent-agent`/`single-session-degraded`)만. 일부 phase 만 child agent 인 혼합 모드 처리 X.

**Opus 제안**: §4.Audit Flow Monitor Contract 에 (A) 세 번째 값 `mixed` 추가 OR (B) "phase 별 monitorMode 분리 기록 가능" 명시.

### 🟢 #7 — Audit flow monitor 의 6 child agent 정원 포함 여부

**Opus position**: line 247–249 max 6 child agent. monitor 가 정원 내인지 외인지 모호.

**Opus 제안**: Multi-Agent Dispatch Contract 에 "monitor lane 은 IA shard 6 agent 정원 외" 명시.

### 🟢 #8 — `tests/e2e/auth-state/` 부분 부재 시 role 별 BLOCKED

**Opus position**: Phase 2.3 line 670–683 은 Supabase local 전체 부재만 다룸. role 별 일부만 누락 시 처리 미정의.

**Opus 제안**: Step 2.3 에 "role 별 storage state 가 일부만 준비되면 누락된 role 시나리오만 BLOCKED, 준비된 role 은 진행" 추가.

### 🟢 #9 — "Untouched Relevant Docs" 와 Step 0.5.1 description.md 요구 충돌

**Opus position**: §18 line 1335 "description.md 는 Phase 5 에서 읽는다" 진술과 Step 0.5.1 line 453 (description.md path 필수)·0.5.2 line 491 (미수록 fail) 충돌.

**Opus 제안**: §18 의 표현을 "Phase 0.5 records path+exists, Phase 5 reads full body for UX review" 로 분리·명확화.

---

## 응답 형식 (엄수)

각 이슈마다:

```
### Issue #N — [AGREE | DISAGREE | PARTIAL | STALEMATE]

**Evidence**: (정본 md 의 line number 인용 또는 다른 근거)

**Reasoning**: (2–4 줄)

**My recommendation**: (구체 diff/문구 또는 "Opus 안 그대로" 또는 "STALEMATE — counter position: ...")
```

마지막에:

```
## Summary Table

| # | Stance | One-line core |
| --- | --- | --- |
| 1 | ... | ... |
...
```
