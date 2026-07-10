# Shared Agent Workflow Core

## 1. 정책 우선순위

충돌할 때 다음 순서로 판단한다.

1. 플랫폼/system 안전 제약과 최신 사용자 지시
2. root `AGENTS.md`의 비협상 경계
3. `docs/sot-registry.json`에서 `active`인 계약. precedence 숫자가 낮을수록 먼저 적용
4. 현재 source와 tests가 증명하는 이미 구현된 동작
5. reference, design record, proposal, archive

사용자 지시가 active SOT 변경을 명확히 승인하면 proposal과 promotion 절차로 계약을 바꿀 수 있다. 단순 기능 요청을 기존 계약을 조용히 우회하는 권한으로 해석하지 않는다.

## 2. 작업 시작

1. 현재 CWD, Git branch/detached 상태, tracked/untracked 변경을 확인한다.
2. 요청의 제품, 코드, 데이터, UI, 테스트, 문서 영향 범위를 정한다.
3. `docs/INDEX.md`에서 범위 owner를 찾고 필요한 active SOT와 current source만 읽는다.
4. 충돌, net-new scope, 외부 부작용을 먼저 분리한다.
5. 위험 등급에 맞는 계획과 검증을 선택한다.

전체 `docs/`를 매번 읽거나 모든 작업에 웹 조사·멀티 에이전트·전체 테스트를 강제하지 않는다.

## 3. 위험 등급

### FAST

오탈자, 명확한 한 줄 수정, 동작을 바꾸지 않는 좁은 문서 정리다.

- 관련 파일 확인
- 최소 수정
- 좁은 검증
- diff 확인

### STANDARD

일반 기능, UI 컴포넌트, 한 영역의 버그 수정, 작은 리팩터링의 기본 등급이다.

- 관련 SOT와 source 확인
- 짧은 실행 계획
- 구현
- 관련 test/lint/typecheck
- self-review

### STRICT

파일 수와 무관하게 다음은 STRICT다.

- auth, session, cookie, redirect
- RLS, migration, profile/storage/admin role
- secret, credential, 외부 비용
- `collab`, production, 배포
- app shell, middleware, route guard
- 공통 theme, global style, shared navigation
- active SOT와 registry
- 되돌리기 어려운 데이터 또는 외부 연동

STRICT는 implementation brief, 독립적인 비판 검토, 단계별 구현, 실패 케이스를 포함한 검증, rollback/남은 위험 기록이 필요하다.

반복적인 global style 부채 정리는 승인된 동일 brief와 fixture를 재사용할 수 있다. 새 token, Page Recipe, 공통 레이아웃 변경이 생기면 remediation lane을 벗어나 다시 STRICT 검토를 받는다.

## 4. SOT lifecycle

문서 `role`과 lifecycle `status`를 분리한다.

- status: `proposed → accepted_pending_promotion → active → superseded`
- terminal: `rejected`, `withdrawn`
- role: constitution, entry, active-sot, workflow, proposal, decision-record, reference, archive, unclassified

Promotion 절차:

1. proposal에 충돌 위치, 선택 이유, 대안, acceptance criteria를 기록한다.
2. 사용자 승인 뒤 `accepted_pending_promotion`으로 전환한다.
3. checker, 새 active 문서와 registry를 한 변경 묶음으로 준비한다.
4. 검증이 통과하면 새 정책 문서를 `active`로 두고 proposal/이전 owner를 `superseded`로 보존한다.
5. `replacedBy`/`replaces`에는 registry ID를 기록하고 index를 재생성한다.

등록되지 않은 문서를 active라고 추정하지 않는다. `docs/INDEX.md`는 생성물이므로 직접 편집하지 않는다.

## 5. 실행과 역할 분리

- 한 agent가 안전하고 정확하게 끝낼 수 있으면 직접 수행한다.
- 독립적인 조사나 검토가 속도·정확성·안전을 실제로 높일 때만 subagent를 사용한다.
- STRICT 계획은 구현자와 critic 관점을 분리한다.
- 병렬 쓰기 작업은 같은 worktree를 공유하지 않는다.
- 실패나 새 증거가 나오면 기존 가설을 고집하지 않고 원인을 다시 확인한다.

## 6. 권한과 외부 부작용

일반적인 변경 요청은 현재 task worktree 안의 로컬 편집과 검증을 허용한다. 다음은 별도 권한이나 명시 조건이 필요하다.

- 새 branch 생성
- stage, commit, push, PR 생성
- merge, rebase, branch/worktree 삭제
- production/collab 배포
- 원격 DB 변경, 외부 메시지, 유료 API 실행

사용자가 이미 publish를 명시했다면 별도 재확인 대신 변경 범위, 검증, secret, 대상 branch를 확인하고 진행한다. `collab`은 이름과 즉시 배포 의도를 명시한 뒤 별도 경고·확인이 있어야 한다.

Commit subject는 변경 파일 나열보다 변경 의도를 설명한다. 결정 trailer는 미래 작업에 유용할 때만 사용한다.

## 7. 검증

완료 주장을 먼저 정의하고 그 주장을 증명하는 검증을 선택한다.

```text
주장 정의 → 증거 선택 → 실행 → 출력 확인 → 실패 수정 → 결과 보고
```

| 변경 | 최소 증거 |
| --- | --- |
| 문서/정책 | registry/path/link/checker, diff |
| 코드 | 관련 unit/integration, lint/typecheck 중 영향 범위에 맞는 항목 |
| UI | 관련 test, desktop/mobile 실제 렌더링, 주요 상호작용과 변경 관련 상태 |
| auth/data/security | 실패 케이스, redirect/session/RLS/secret/migration 영향 |
| app shell/global theme | 영향 범위를 좁힐 수 없으면 전체 e2e와 build |

테스트가 실패했거나 실행하지 못했으면 완료라고 말하지 않는다. 원인, 재현 명령, 남은 위험을 남긴다. 다른 task의 dev server가 build를 막으면 그 process를 임의 종료하거나 `--force`하지 않는다.

## 8. 사용자 보고

한국어와 쉬운 결론을 먼저 쓴다. 완료 보고에는 다음을 포함한다.

- 사용자가 체감하는 변화 또는 정책 변화
- 읽은 active SOT와 확인한 요구사항
- 충돌 여부와 갱신한 owner 문서
- 실행한 검증과 실제 결과
- 미실행 항목과 남은 위험
- 현재 worktree/branch와 Git 반영 여부가 중요할 때 그 상태

외부 조사는 최신 정보, 공식 API, 법률·보안, dependency 결정처럼 결과를 바꾸는 외부 사실이 있을 때 수행하고 근거 링크를 남긴다.
