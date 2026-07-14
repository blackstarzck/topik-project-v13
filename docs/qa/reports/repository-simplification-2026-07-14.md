# Repository simplification migration record

> Date: 2026-07-14
> Baseline: `d99d74b6d01ea77a2276d1df9beb193ca87ab8d4`
> Classification: historical QA evidence, not SOT

## 이전 입력 기록

통합 시작 시 존재한 6개 untracked 파일을 경로와 SHA-256으로 기록했다. 값은 파일 내용의 동일성 확인용이며 이 보고서는 해당 파일을 active owner로 승격하지 않는다.

| SHA-256 | 당시 경로 |
| --- | --- |
| `0C641ECA3941A040F7150BF9D903474503498A7EE0208A18198B6008554052D2` | `docs/sot-change-proposals/2026-07-14-agent-skill-and-communication-simplification.md` |
| `0C69339AA9B21739E0089FFEA7D8FEA2BF1FC5EDC63F6759B51FE5519DDCC859` | `docs/sot-change-proposals/2026-07-14-worktree-env-browser-verification.md` |
| `AE39E1E10BC9FC8927D2E81BAA6366266BCD2D48B3BAAA616E0219B5C5B0DCDA` | `docs/superpowers/plans/2026-07-14-worktree-env-browser-verification.md` |
| `9F6F7FDCFAC9BECBA9C5D42BA1682AA06C90A29385965DE05EC703FF747052C5` | `docs/superpowers/specs/2026-07-14-agent-skill-and-communication-simplification-design.md` |
| `54749538A29CC2667D49CE97F368FF6AAFCAE683F4A2B7D15D4C2E8ECC960C5B` | `docs/superpowers/specs/2026-07-14-worktree-env-browser-verification-design.md` |
| `99A53DFDD59A6A452691C7357E771DF5002622EFEBE3F8E64953E8AAE9AF853D` | `tests/scripts/agent-workflow-runtime-contract.test.mjs` |

## 계약 이전 범주

- AI 작업 계약과 쉬운 사용자 소통 원칙 → `AGENTS.md`
- 제품 범위, 사용자 흐름과 실패 복구 약속 → `docs/prd.md`
- UI theme architecture와 review 기준 → `DESIGN.md`
- DB·Data API·Auth·RLS·RPC·Storage 계약 → migration SQL과 `docs/supabase/`
- 테스트와 UI browser 검증 기준 → `TESTING.md`
- `.env.local` worktree 준비와 Playwright MCP 단계 → `AGENTS.md`와 실행 helper/tests

## 삭제 실행 결과

새 owner와 검사 통과 후 `docs/prd.md`, `docs/swagger-api/`, `docs/supabase/`, `docs/qa/`를 제외한 기존 `docs/` 상위 항목 21개(1,106 files, 210,007,328 bytes)를 삭제했다. SOT registry/index와 checker, `.gstack/`, 현재 worktree의 `.omx/`, dynamic workflow skill, 삭제 경로를 전제로 한 script/test도 함께 제거했다.

별도 archive 복사는 만들지 않았으며 삭제 자료는 일반 Git history로만 보존한다. 삭제 전에 active source/script/test에 필요한 계약과 fixture가 새 owner로 이전됐는지 검사했고, 삭제 후 project structure 검사로 허용 구조와 active reference를 다시 확인했다.

## 역사 참조 예외

- 이 보고서의 위 6개 경로는 baseline 기록이므로 삭제 후에도 그대로 둔다.
- 기존 날짜별 QA 보고서와 이미 적용된 migration SQL의 과거 문서명은 당시 의사결정 증거로 허용한다.
- README, AGENTS, active source, active scripts/tests와 migration index는 삭제 경로를 실행 기준으로 사용하지 않아야 한다.

이 문서는 제품 범위, DB 권한 또는 workflow를 새로 정하지 않는다. 현재 계약은 각 owner 문서와 실행 가능한 source/tests에서 확인한다.
