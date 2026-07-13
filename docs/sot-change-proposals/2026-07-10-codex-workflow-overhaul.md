# Codex 작업 워크플로우 전면 개편 제안

- 작성일: 2026-07-10
- 상태: `superseded`
- 효력: **Phase 1 정책은 active workflow 문서로 승격되었다. 이 문서는 결정 이유와 검토한 대안을 보존하는 이력이다.**
- 대상: 공통 에이전트 정책 핵심 + Codex 상세 adapter 우선
- 후속 범위: Claude 상세 adapter는 공통 핵심이 안정화된 뒤 별도 제안으로 다룬다.

## 1. 요약

현재 에이전트 작업 방식은 다음 문제가 서로 증폭되는 구조다.

1. `AGENTS.md`, `README.md`, `docs/`, repo-local skill이 같은 결정을 중복 소유해 정책이 충돌한다.
2. Codex Desktop 작업이 자동 worktree에서 시작되지만 branch 연결, PR 이후 감시, 병합 후 정리가 하나의 수명주기로 이어지지 않는다.
3. UI 공통 레이아웃과 theme 시스템이 있어도 페이지별 CSS와 AntD override가 `global.css`에 계속 누적된다.
4. 작은 변경과 고위험 변경에 같은 계획·멀티 에이전트·웹 조사·검증 절차가 적용돼 실행 비용은 높고 실제 위험은 잘 구분되지 않는다.

이 제안은 이를 아래 네 층으로 재구성한다.

| 층 | 단일 책임 |
| --- | --- |
| 얇은 `AGENTS.md` | 비협상 안전 경계, 정책 우선순위, 작업 분류, 상세 문서 진입점 |
| Active SOT Registry | 어떤 문서가 어떤 범위의 active 계약인지와 상태 전이 |
| Shared Workflow Core | FAST/STANDARD/STRICT 작업 흐름, 검증, 문서·UI·Git 공통 계약 |
| Codex Adapter | Codex Desktop worktree, branch, task registry, PR 감시, guarded cleanup 실행 방식 |

핵심 운영 결정은 다음과 같다.

- 새 Codex 작업은 `한 task = 한 논리 slug = 한 branch = 한 worktree 소유권`을 갖는다.
- Codex가 생성한 랜덤 worktree 경로는 강제로 바꾸지 않고 registry에 실제 경로를 기록한다.
- PR을 만든 작업은 자기 PR 감시 상태를 소유한다. 중앙 sweeper는 두지 않는다.
- 병합 후 삭제는 작업 worktree 내부가 아니라, 그 작업만을 위한 일회성 supervisor가 중립 경로에서 수행한다.
- dirty, untracked, 예상 밖 ignored 파일, 실행 중 process/port/lock, 닫힌 미병합 PR이 있으면 자동 삭제하지 않는다.
- UI는 기존 공통 레이아웃 → AntD props → theme token → Tailwind layout utility → 기록된 CSS 예외 순서로 해결한다.
- `global.css`에는 새 페이지 전용 selector를 추가하지 않고 기존 부채는 화면별로 점진 이관한다.

## 2. 제안이 필요한 근거

### 2.1 정책 충돌

현재 규칙은 `docs/` 전체를 SOT로 선언하면서 `docs/sot-change-proposals/`도 같은 범위에 둔다. 그 결과 미확정 제안도 형식상 SOT가 되는 자기모순이 생긴다.

그 밖의 대표 충돌은 다음과 같다.

- SOT 직접 수정 금지와 SOT 변경 제안 파일 생성 전 승인 규칙이 서로 순환한다.
- 프로젝트 규칙은 Git 반영 전 사용자 승인을 요구하지만 일부 repo-local skill은 설계나 구현 직후 commit을 요구한다.
- 모든 변경에 계획·멀티 에이전트·critic을 요구하는 규칙과, 작은 작업에는 가장 가벼운 절차를 쓰라는 실행 원칙이 충돌한다.
- Codex 자동 worktree는 detached HEAD나 랜덤 경로일 수 있는데 기존 규칙은 즉시 의미 있는 worktree 경로와 branch 이름을 요구한다.
- 모든 작업 뒤 웹 조사를 요구해 로컬·정적 사실만으로 충분한 작업에도 불필요한 외부 조사가 붙는다.

### 2.2 worktree 감사 스냅샷

2026-07-10 읽기 전용 감사 시점에는 다음이 관찰됐다.

- worktree 27개
- detached HEAD worktree 15개
- dirty worktree 2개
- clean 상태이며 당시 `origin/main`에 포함된 worktree 22개
- upstream gone 로컬 branch 18개
- upstream이 없는 로컬 branch 9개
- `git worktree prune --dry-run --verbose` 결과는 비어 있음

이는 stale metadata만의 문제가 아니다. 실제 worktree 디렉터리가 남아 있으며, 병합 이후 종료 상태를 소유하는 단계가 없다는 뜻이다.

감사 중 다른 세션이 공통 Git metadata를 변경하는 것도 관찰됐다. 따라서 위 숫자는 현황 증거이지 정리 명령의 입력값이 아니다. 실제 정리 전에는 반드시 새 inventory를 만든다.

### 2.3 UI 감사 스냅샷

2026-07-10 기준 `src/styles/global.css`는 약 8,620줄, 179KB였다.

- raw hex 약 252회
- `.ant-*` 참조 약 478회
- `!important` 약 64회

반면 runtime에는 이미 아래 공통 구조가 있다.

- `PublicShell`, `PageContainer`
- `WorkspaceShell`, `WorkspaceBody`
- `PageHeader`
- `AppCard`, `AppModal`, `AppDrawer`
- `DESIGN/tokens.json` → `src/theme` → AntD preset 및 Tailwind bridge

문제는 시스템 부재가 아니라 소유권과 집행 장치 부재다.

## 3. 목표와 비목표

### 3.1 목표

- 정책 충돌 시 어느 문서와 상태가 권한을 갖는지 기계적으로 판정할 수 있다.
- Codex task가 생성부터 PR 병합 후 정리까지 자기 상태를 잃지 않는다.
- 병렬 작업이 같은 checkout, branch, index, runtime 자원을 무심코 공유하지 않는다.
- 병합된 clean worktree는 안전 조건을 통과할 때 자동 정리된다.
- dirty·미병합·미게시 작업은 삭제 대신 발견되고 복구 가능하게 보존된다.
- UI 에이전트가 기존 Page Recipe와 token을 먼저 사용한다.
- 새 `global.css` 부채는 즉시 차단하되 기존 부채는 점진적으로 줄인다.
- 작업 위험에 비례한 계획과 검증을 수행한다.

### 3.2 이번 제안의 비목표

- 기존 `global.css` 전체 일괄 변환
- 모든 기존 UI 화면 동시 재설계
- dirty 또는 미병합 worktree 자동 폐기
- `--force` worktree 삭제나 force push 자동화
- Claude 상세 adapter 전면 재작성
- `collab` 자동 배포
- 원격 Supabase schema/data 변경

## 4. 정책 권한 구조

### 4.1 우선순위

| 순위 | 권한 | 의미 |
| --- | --- | --- |
| 1 | 비협상 안전 경계 | secret, `collab`, 파괴적 작업, 원격 DB, admin 범위, 사용자 변경 보존 |
| 2 | 현재 사용자의 명시적 요청 | 안전 경계 안에서 현재 task의 목적과 범위를 결정 |
| 3 | Active SOT | 제품 의도, UX, 데이터, 보안, 기술 계약 |
| 4 | 현재 source와 tests | 이미 구현된 관찰 사실. SOT와 다르면 defect 또는 SOT 변경 후보 |
| 5 | Codex adapter와 선택형 skill | 작업 방법. 상위 제품·안전 계약을 바꾸지 못함 |

사용자 요청이 active SOT와 충돌할 때 사용자 요청은 **제안 작성과 promotion 검토를 승인할 수 있지만**, promotion 전에 기존 active SOT를 조용히 우회하는 구현 권한으로 해석하지 않는다.

### 4.2 얇은 `AGENTS.md`

개편 뒤 `AGENTS.md`에는 아래만 남긴다.

- 프로젝트 정체성과 응답 언어
- 비협상 안전 경계
- 정책 우선순위와 Active SOT Registry 진입점
- FAST/STANDARD/STRICT 분류 기준
- 사용자 확인이 필요한 작업
- Git/worktree의 최소 불변 조건
- UI·DB·auth 등 상세 계약으로 가는 링크

아래 내용은 상세 문서나 adapter로 이동한다.

- 긴 도구 사용법
- worktree 명령 순서
- PR 감시 polling 방식
- 모든 UI selector 규칙의 세부 목록
- repo-local skill별 호출 순서
- 특정 런타임의 상태 관리 방식

## 5. Active SOT Registry

### 5.1 상태 모델

| 상태 | 의미 | 제품/구현 권한 |
| --- | --- | --- |
| `proposed` | 검토 중인 제안 | 없음 |
| `accepted_pending_promotion` | 결정은 승인됐지만 active 문서 반영이 끝나지 않음 | 기존 active SOT 유지 |
| `active` | 현재 적용되는 계약 | 있음 |
| `superseded` | 다른 active 문서로 대체됨 | 없음, 이력 보존 |
| `rejected` | 검토 후 채택하지 않음 | 없음 |
| `withdrawn` | 제안자가 철회 | 없음 |

`promoted`는 상태로 사용하지 않는다. `accepted_pending_promotion → active` 전환 사건의 이름으로만 사용한다.

### 5.2 registry 필드

각 항목은 최소한 다음을 가진다.

- `id`
- `title`
- `path`
- `role`
- `scope`
- `owner`
- `status`
- `precedence`
- `effectiveDate`
- `replaces`
- `replacedBy`
- `decisionLink`

초기 구현은 기계가 안정적으로 검사할 수 있는 `docs/sot-registry.json`을 canonical registry로 둔다. 사람이 읽는 `docs/INDEX.md`는 이 JSON에서 생성하며 직접 편집하지 않는다. CI는 schema, 중복 scope, 깨진 경로, 두 active owner 충돌과 생성물 drift를 검사한다.

### 5.3 초기 registry 채움

초기 등록 시 `docs/` 전체를 active로 선언하지 않는다.

- 현재 진입 문서와 명시적인 우선순위 문서만 근거를 확인해 active 항목으로 등록한다.
- `docs/sot-change-proposals/`는 `role=proposal`로 분류하고 각 문서의 lifecycle status를 보존한다.
- 그 밖의 문서는 근거에 따라 `reference`, `archive`, `unclassified`로 분류한다.
- `role`은 문서 용도이고 `status`는 lifecycle이므로 서로 다른 필드로 관리한다.
- 분류 근거가 없는 문서를 편의상 active로 승격하지 않는다.

### 5.4 promotion 절차

1. proposal에 충돌 위치, 대안, 선택 이유, acceptance criteria를 기록한다.
2. 사용자가 결정을 승인하면 `accepted_pending_promotion`으로 전환한다.
3. active 문서와 registry를 같은 변경 묶음에서 갱신한다.
4. 검증이 통과하면 새 정책 항목을 `active`, 대체된 정책과 구현을 마친 proposal을 `superseded`로 바꾸고 replacement ID를 남긴다.
5. source/test 변경이 필요한 경우 별도 구현 PR에서 active 계약을 따른다.

부분 promotion으로 old/new active owner가 동시에 생기면 CI가 실패해야 한다.

## 6. 작업 위험도 라우팅

### 6.1 FAST

대상 예시:

- 오탈자
- 명확한 한 줄 수정
- 동작을 바꾸지 않는 좁은 문서 정리

절차:

1. 관련 파일 확인
2. 최소 수정
3. 좁은 검증
4. diff 확인

설계 문서, 멀티 에이전트, 전체 테스트, 웹 조사를 기본 요구하지 않는다.

### 6.2 STANDARD

기본 등급이다.

대상 예시:

- 일반 기능
- UI 컴포넌트
- 한 영역의 버그 수정
- 작은 리팩터링

절차:

1. 관련 SOT와 source 확인
2. 짧은 실행 계획
3. 구현
4. 관련 test, lint, typecheck
5. self-review

독립적인 조사나 비판적 검토가 품질·속도·안전성을 실제로 높일 때만 subagent를 사용한다.

### 6.3 STRICT

다음은 파일 수와 무관하게 항상 STRICT다.

- auth, session, cookie, redirect
- RLS, migration, profile/storage/admin role
- secret, credential, 외부 비용
- `collab`, production, 배포
- app shell, middleware, route guard
- 공통 theme, global style, shared navigation
- active SOT와 registry 변경
- 되돌리기 어려운 데이터 또는 외부 연동

절차:

1. implementation brief 또는 spec
2. 독립적인 비판 검토
3. 단계별 구현
4. 실패 케이스를 포함한 광범위 검증
5. rollback과 남은 위험 기록

분류가 애매하면 한 단계 올린다.

### 6.4 사전 승인된 STRICT remediation lane

공통 theme, global style처럼 위험 등급은 STRICT이지만 같은 규칙으로 반복되는 부채 정리는 별도 architecture 재승인 없이 실행할 수 있는 remediation lane을 둔다.

- 최초 brief에서 허용 selector 범위, 보존할 동작, 시각 회귀 기준, rollback 단위를 고정한다.
- 각 화면 PR은 같은 brief와 fixture를 재사용하되 대상 화면과 검증 증거를 명시한다.
- 새 token, 새 Page Recipe, 공통 레이아웃 변경처럼 계약 자체가 바뀌면 lane을 벗어나 다시 STRICT 설계 검토를 받는다.
- 위험 등급은 낮추지 않는다. 반복 승인 비용만 줄인다.

## 7. Codex task와 worktree 수명주기

### 7.1 상태 모델

```text
DISCOVERED
  → ISOLATED
  → SYNC_DECISION
  → WORKING
  → VERIFIED
  → COMMITTED
  → PUBLISHED
  → PR_OPEN
  → MERGE_VERIFIED
  → FINALIZING
  → CLEANED
```

분기 상태:

- 리뷰 변경 요청: `PR_OPEN → WORKING`
- dirty, closed-unmerged, lock 충돌, unknown owner: `NEEDS_ATTENTION`
- 사용자가 명시적으로 중단하고 보존: `PRESERVED`
- 복구 불가능한 외부 장애: `BLOCKED`와 재개 조건 기록

### 7.2 task identity

하나의 논리 slug를 아래에 공유한다.

- task registry의 `slug`
- 가능하면 Codex task 제목
- branch `codex/<slug>`
- PR 제목 또는 metadata

Codex Desktop이 만든 `C:\...\.codex\worktrees\<random-id>\v13` 같은 실제 경로는 harness 자산이므로 강제로 rename하지 않는다. registry에 실제 경로와 `owner=codex-desktop`을 기록한다.

수동 worktree는 기존 규칙대로 의미 있는 폴더명을 사용할 수 있으며 `owner=manual`로 기록한다.

### 7.3 task registry

worktree가 제거된 뒤에도 상태가 남아야 하므로 registry를 worktree 내부에 두지 않는다.

제안 위치:

```text
$CODEX_HOME/worktree-lifecycle/<repo-id>/<task-id>.json
```

최소 schema:

```json
{
  "schemaVersion": 1,
  "taskId": "...",
  "slug": "workflow-overhaul",
  "owner": "codex-desktop",
  "repoId": "...",
  "gitCommonDir": "...",
  "worktreePath": "...",
  "branch": "codex/workflow-overhaul",
  "baseRef": "origin/main",
  "baseSha": "...",
  "publishedHeadSha": "...",
  "pullRequest": "...",
  "state": "PR_OPEN",
  "ports": [],
  "lastVerification": {},
  "updatedAt": "..."
}
```

registry write는 temporary file 생성 후 atomic rename으로 수행한다. lock도 `$CODEX_HOME/worktree-lifecycle/` 아래 repo/task scope에 두어 worktree와 Git common dir 삭제의 영향을 받지 않게 한다. secret 값은 저장하지 않는다.

### 7.4 시작 프로토콜

수정 전 반드시 확인한다.

- 실제 CWD
- `git rev-parse --git-common-dir`
- `git worktree list --porcelain`
- 현재 branch 또는 detached 상태
- tracked, untracked, ignored 파일
- registry에 같은 branch/worktree를 소유한 다른 task가 있는지
- 기준 branch와 원격 상태

공유 기준 폴더에서 무조건 `pull`, `switch`, `rebase`하지 않는다. 먼저 `fetch`로 원격 참조만 갱신하고 현재 task의 worktree 안에서 sync 방법을 결정한다.

Codex Worktree 모드를 사용자가 선택해 새 task를 연 행위는 해당 task 안에서 `codex/<slug>` branch를 연결하는 범위의 승인으로 본다. 다른 branch 재사용, 기존 변경 폐기, publish는 별도 조건을 따른다.

### 7.5 detached HEAD 처리

수정 전이고 clean인 경우:

1. `fetch`로 기준 ref를 확인한다.
2. branch 이름과 registry 충돌을 확인한다.
3. 최신 허용 base에서 `codex/<slug>` branch를 연결한다.

수정이 이미 있는 경우:

1. 현재 HEAD에 고유 rescue branch를 먼저 연결한다.
2. dirty/untracked/ignored inventory를 registry에 기록한다.
3. 변경을 보존한 상태에서 rebase, merge, 새 branch 이관 중 안전한 sync 방법을 결정한다.

기존 branch는 task registry의 owner/task ID가 일치할 때만 재사용한다.

### 7.6 publish 권한

- 일반 변경 요청은 로컬 수정과 검증, task branch 연결까지 승인한다.
- stage, commit, push, PR은 사용자가 요청에 publish 의도를 포함했거나 변경·검증 보고 후 별도 승인한 경우 수행한다.
- `collab` 대상 publish는 기존의 별도 경고·명시 확인 규칙을 유지한다.
- commit subject는 변경 내용 나열보다 변경 의도를 우선한다. `Constraint`, `Rejected`, `Directive`, `Tested`, `Not-tested` 같은 결정 trailer는 미래 작업에 가치가 있을 때만 사용한다.

`pull → commit → push`를 고정 순서로 사용하지 않는다. `fetch → sync decision → verify → commit → push → PR`로 바꾼다.

## 8. PR 감시와 guarded cleanup

### 8.1 선택한 소유 모델

- 중앙 sweeper를 두지 않는다.
- 각 task가 자기 PR의 감시 상태와 재예약을 소유한다.
- task heartbeat 또는 one-shot monitor는 PR 상태를 판정한다.
- 실제 cleanup은 task별 ephemeral supervisor가 worktree 밖 중립 CWD에서 수행한다.

이는 중앙 청소기가 아니다. supervisor는 하나의 `taskId + nonce`만 처리하고 종료한다.

### 8.2 merge 판정

단순 commit ancestry만 사용하지 않는다. squash merge와 rebase merge를 고려해 다음을 함께 확인한다.

- GitHub PR의 실제 merged 상태
- PR number와 repository identity
- 기록된 PR head SHA와 publish 시점의 branch tip
- PR base가 승인된 target인지. 기본값은 `main`이며, `collab`은 별도의 배포 경고와 명시 확인 없이는 허용하지 않음
- PR이 closed-unmerged가 아닌지

remote branch가 GitHub 설정으로 삭제돼도 PR metadata로 판정할 수 있어야 한다.

### 8.3 `FINALIZING` lease

1. monitor가 merge를 확인한다.
2. task registry를 `FINALIZING`으로 atomic 전환한다.
3. `taskId + nonce` lease를 획득한다.
4. supervisor가 모든 안전 조건을 처음부터 다시 검사한다.
5. 하나라도 바뀌었으면 lease를 해제하고 `NEEDS_ATTENTION`으로 전환한다.
6. cleanup이 끝난 뒤 `CLEANED` 기록과 결과 로그를 남긴다.

동시에 두 monitor가 실행돼도 하나만 lease를 획득해야 한다.

### 8.4 자동 cleanup 안전 조건

모두 참이어야 한다.

- PR 실제 merged 확인
- published head/PR head/task registry 일치
- tracked 변경 없음
- untracked 파일 없음
- ignored 파일이 명시적 disposable allowlist 안에만 있음
- `.env*`, local DB, 사용자 생성 report, fixture, screenshot 등 preserve-sensitive glob 없음
- task가 등록한 PID, dev server, port가 모두 종료됨
- 다른 task registry가 같은 worktree 또는 branch를 active로 소유하지 않음
- 다른 worktree가 같은 branch를 사용하지 않음
- `main`, `collab`, 기준 checkout이 아님
- worktree owner가 알려져 있음
- cleanup lease 획득

예상 밖 ignored 파일은 clean으로 취급하지 않고 `NEEDS_ATTENTION`으로 보낸다.

### 8.5 owner별 실행

`owner=codex-desktop`:

- Codex Desktop의 native workspace-exit/cleanup 경로를 우선한다.
- native API 지원과 종료 task 재기동이 smoke test로 증명되기 전에는 auto mode를 켜지 않는다.
- 지원되지 않으면 task 상태를 보존하고 재개 시 정리하는 degraded mode를 사용한다.

`owner=manual`:

- 중립 CWD에서만 `git worktree remove <path>`를 실행한다.
- 성공 후 `git worktree prune`으로 stale metadata만 정리한다.
- 다른 worktree와 registry가 사용하지 않을 때만 로컬 branch를 삭제한다.

모든 owner 공통:

- 자동화에서 `--force` 금지
- remote branch 삭제는 GitHub의 merged-branch 자동 삭제 정책 또는 별도 명시 승인에 맡김
- task 보관은 `CLEANED` 이후에만 수행

### 8.6 실패 처리

| 상황 | 결과 |
| --- | --- |
| 리뷰 변경 요청 | 같은 worktree와 branch에서 `WORKING` 재개 |
| PR closed-unmerged | `NEEDS_ATTENTION`, 보존/재개/폐기 결정 요청 |
| dirty/untracked/예상 밖 ignored | `NEEDS_ATTENTION`, 파일 목록과 재개 명령 기록 |
| process/port/lock active | cleanup 연기, 재예약 |
| GitHub 상태 확인 불가 | 삭제 금지, 재예약 또는 degraded mode |
| native Codex cleanup 미지원 | `PR_OPEN` 또는 `MERGE_VERIFIED` 보존, task 재개 시 처리 |

## 9. 기존 worktree 일회성 remediation

새 lifecycle 도입과 기존 찌꺼기 삭제를 같은 작업으로 수행하지 않는다.

첫 remediation은 read-only inventory만 만든다.

| 분류 | 조건 | 기본 행동 |
| --- | --- | --- |
| `ACTIVE` | task/process/lock이 현재 사용 중 | 건드리지 않음 |
| `PRESERVE` | dirty, untracked, ignored-sensitive, 미게시 commit | 보존 및 복구 정보 작성 |
| `SAFE_CANDIDATE` | clean, merged PR 확인, owner 확인 | 사용자 검토 목록에 포함 |
| `NEEDS_DECISION` | remote gone, squash 여부 불명, owner 불명 | 사용자 판단 요청 |

감사 때 발견된 22개 후보를 그대로 삭제 목록으로 사용하지 않는다. 동시 작업으로 상태가 달라졌을 수 있으므로 remediation 시작 시 재스캔한다.

## 10. UI 작업 계약

### 10.1 스타일 소유권 순서

1. 기존 공통 component와 Page Recipe
2. AntD props, variant, semantic DOM
3. global/component theme token 또는 scoped `ConfigProvider`
4. semantic token을 소비하는 Tailwind `className`
5. owner, 범위, 이유, 만료/제거 조건이 있는 CSS escape hatch

위 단계에서 해결되면 아래 단계로 내려가지 않는다.

### 10.2 Page Recipe

| 화면 유형 | 기본 조합 |
| --- | --- |
| Workspace | `WorkspaceShell → WorkspaceBody → PageHeader → shared section/surface` |
| Public/Auth | `PublicShell → PageContainer` |
| Form | `WorkspaceBody size="form"` |
| Reading | 의미 기반 reading width variant |
| Wide/List | 공통 wide/list variant |

페이지별 `max-w-[640px]` 같은 width 복제 대신 이름 있는 variant를 사용한다.

일반 workspace 화면에서 다음을 금지한다.

- 추가 `<main>` landmark
- `WorkspaceBody` 안의 임의 content width 재정의
- 조상 selector로 `AppCard` surface를 다시 꾸미기
- wrapper가 있는데 raw AntD `Card`, `Modal`, `Drawer` 직접 사용

### 10.3 `global.css` freeze

즉시 금지할 신규 부채:

- 새 페이지 전용 selector
- 새 광범위 `.ant-*` override
- raw palette, 임의 radius/shadow/font
- AntD hover, active, focus, disabled 상태 재구현
- 공통 wrapper를 되돌리는 조상 selector

장기적으로 `global.css`에는 아래만 남긴다.

- Tailwind import
- `@theme inline` semantic bridge
- 최소 base/global style
- 검증된 third-party escape hatch

기존 CSS는 한 번에 변환하지 않는다. 변경하는 화면과 우선 remediation 묶음부터 이동한다.

### 10.4 `DESIGN.md` 재구성

개편된 문서는 최소한 다음 질문에 답해야 한다.

- 한 화면에서 무엇이 먼저 보여야 하는가?
- primary action은 몇 개까지 허용하는가?
- 한국어 본문의 읽기 폭, 글자 크기, 행간, 문단 간격은 무엇인가?
- desktop과 mobile에서 위계가 어떻게 변하는가?
- workspace, public, form, reading, list/detail, empty/error의 Page Recipe는 무엇인가?
- color, typography, spacing, radius, shadow token의 canonical source는 어디인가?
- AntD component state는 누가 소유하는가?
- 허용 사례와 금지 사례는 무엇인가?

문서 값과 runtime token이 다르면 둘을 동시에 active로 두지 않는다. 하나의 theme source에서 AntD adapter와 Tailwind bridge가 같은 semantic token을 소비하게 한다.

## 11. UI 자동 검사

### 11.1 rollout 모드

1. `report`: 기존 부채와 신규 위반을 보고만 함
2. `diff-block`: 새로 추가된 위반만 CI에서 차단
3. `enforce`: baseline이 제거된 영역부터 전체 계약 적용

처음부터 기존 8천 줄 CSS 전체를 실패시키지 않는다.

### 11.2 검사 후보

- 새 static visual `style={{...}}` 또는 AntD `styles` 사용
- theme source 밖 raw color/radius/shadow/font
- `global.css`의 새 페이지 selector
- 새 `.ant-*` 상태 override
- `bg-[#...]`, `rounded-[...]`, `shadow-[...]`, `max-w-[...]` 같은 임의 visual value
- workspace 내부 추가 `<main>`
- wrapper 대상 raw AntD component 직접 import
- `WorkspaceBody` 없이 만드는 새 workspace page

runtime 측정값처럼 실제 계산이 필요한 geometry는 명시적 annotation과 좁은 범위로 예외 처리할 수 있다.

예외 항목은 다음을 가진다.

- path/pattern
- owner
- reason
- created date
- expires date 또는 removal condition

### 11.3 구현 원칙

- 새 dependency를 추가하지 않는다.
- TypeScript compiler API, ESLint, diff 기반 Node script 등 현재 dependency로 구현한다.
- regex만으로 TSX 의미를 단정하지 않는다.
- 오탐 fixture와 허용 fixture를 함께 둔다.

## 12. 검증 계약

검증은 변경 파일 수가 아니라 완료 주장과 위험에 연결한다.

```text
주장 정의 → 증거 선택 → 실행 → 출력 확인 → 실패 수정 → 결과 보고
```

### 12.1 공통 보고

- 읽은 active SOT
- 확인한 요구사항
- 충돌 여부
- 실행한 명령과 범위
- 결과
- 미실행 항목과 남은 위험

### 12.2 UI

- desktop/mobile 실제 렌더링
- 주요 상호작용
- 변경과 관련된 loading/empty/success/error/disabled 상태
- 같은 Page Recipe를 쓰는 sibling 화면과 위계 비교
- 관련 unit/integration, lint, typecheck

### 12.3 auth/data/security

- 실패 케이스
- redirect, session, cookie
- RLS 영향
- secret 노출
- migration idempotency
- 관련 data consumer와 문서 갱신 여부

### 12.4 외부 조사

최신 정보, 공식 API 동작, 법률·보안, dependency 비교처럼 외부 사실이 결과를 바꿀 때만 공식 자료를 확인한다. 오탈자나 repo-local 정적 사실 확인에 모든 작업 후 웹 조사를 강제하지 않는다.

## 13. 구현 표면 제안

이 proposal이 `accepted_pending_promotion`으로 승인된 뒤 아래를 작은 PR로 나눈다.

### 13.1 정책 기반

- `AGENTS.md`: 얇은 constitution으로 축소
- `CLAUDE.md`: 중복 worktree·배포 규칙을 제거한 얇은 Claude 진입 문서
- `.claude/CLAUDE.md`: root 정책을 import하는 단일 진입점으로 정리
- `README.md`: `docs/` 전체 SOT 표현과 AI deferred scope 충돌 정리
- `docs/sot-registry.json`: canonical Active SOT Registry 신설
- `docs/INDEX.md`: registry에서 생성되는 사람이 읽는 색인
- `docs/agent-workflow/core.md`: 공통 workflow와 검증 계약
- `docs/agent-workflow/codex.md`: Codex adapter와 상태 모델
- `docs/agent-workflow/ui.md`: UI 소유권, Page Recipe, 예외 절차
- `docs/user-communication-style.md`: 절대적인 형식 제한을 위험·요청 기반 권고로 조정

### 13.2 repo-local skill

다음 skill에서 프로젝트 Git 승인 규칙과 충돌하는 자동 commit/branch 전제를 제거하거나 project override를 명시한다.

- `.codex/skills/brainstorming/`
- `.codex/skills/subagent-driven-development/`
- `.codex/skills/using-git-worktrees/`
- `.codex/skills/finishing-a-development-branch/`
- `.codex/skills/verification-before-completion/`

canonical `.codex/skills` 변경 뒤 `scripts/sync-agent-skills.mjs`로 `.claude/skills` mirror 일치를 검증한다. 이는 Claude 상세 adapter 재작성과 다르다.

root `CLAUDE.md`와 `.claude/CLAUDE.md`의 Phase 1 정리는 이미 중복된 공통 정책을 제거하는 진입 문서 정리다. Claude 고유 lifecycle, 도구 호출, adapter 설계는 공통 핵심 안정화 뒤 별도 범위로 남긴다.

### 13.3 실행 도구와 검사

정확한 파일 분리는 구현 계획에서 결정하되 다음 역할을 제공한다.

- task inspect/start/resume/finalize CLI
- external task registry schema와 atomic lease
- SOT registry checker
- UI contract diff checker
- legacy worktree inventory reporter
- package scripts와 CI wiring
- temp Git repo 기반 fixture tests

## 14. 단계별 rollout과 acceptance criteria

### Phase 0. Proposal, baseline, Desktop spike

- 이 proposal 검토·승인
- policy conflict matrix 확정
- legacy worktree와 UI debt를 read-only baseline으로 재수집
- Codex Desktop task heartbeat, native cleanup, task 보관 순서를 작은 smoke test로 확인
- 증명되지 않은 Desktop cleanup 경로는 `report` mode로 고정

완료 기준:

- active SOT는 아직 변경되지 않음
- 기존 dirty 작업 목록이 삭제 없이 보존됨
- 각 후속 PR의 소유 문서와 rollback 범위가 정해짐
- Desktop native cleanup을 자동화할 수 있는지 여부와 근거가 기록됨

### Phase 1. Policy Core

- 얇은 `AGENTS.md`
- 중복 규칙을 제거한 root `CLAUDE.md`와 `.claude/CLAUDE.md`
- canonical `docs/sot-registry.json`과 생성된 `docs/INDEX.md`
- shared core 및 Codex/UI adapter 문서
- SOT checker는 seed 중 `report`, promotion과 동시에 `block`

완료 기준:

- proposal이 active로 오인되지 않음
- 동일 scope의 active owner 중복을 fixture에서 검출
- 깨진 registry 경로, 잘못된 lifecycle 조합, 비대칭 replacement 연결을 검출
- 게시 전에는 task-owned diff만 역패치할 수 있고, 게시 승인 뒤에는 정책 변경을 되돌리는 단일 rollback commit을 만들 수 있음

### Phase 2. Codex lifecycle report-only

- read-only inventory와 최소 task registry schema
- detached clean/dirty, branch conflict, ignored file, PR state fixture
- cleanup은 report-only
- Phase 0 spike가 증명하기 전에는 lease, supervisor, 실제 cleanup 명령을 구현하지 않음

완료 기준:

- 실제 worktree 삭제 명령이 실행되지 않음
- 모든 fixture가 예상 상태로 분류됨
- dirty/unknown 상태가 항상 `NEEDS_ATTENTION`으로 감
- legacy worktree 후보가 owner와 보존 사유를 포함한 사용자 검토 보고서로 출력됨

### Phase 2A. Legacy worktree 수동 remediation

- read-only inventory를 사용자가 검토한 뒤 후보를 작은 묶음으로 정리
- 삭제 직전에 dirty, untracked, ignored-sensitive, owner, process, branch 상태를 다시 검사
- 자동 삭제나 `--force`는 사용하지 않음

완료 기준:

- 사용자 검토를 통과한 후보만 수동 정리됨
- 불명확하거나 dirty인 후보는 `NEEDS_ATTENTION`으로 보존됨
- 삭제된 후보와 보존된 후보의 근거가 각각 남음

### Phase 3. Guarded cleanup opt-in

- Phase 0/2에서 native cleanup과 lifecycle 지속성이 검증된 owner에만 적용
- external registry, atomic lease, task별 monitor와 ephemeral supervisor
- manual owner cleanup부터 제한적 활성화
- Codex Desktop owner는 native cleanup smoke test 후 활성화

완료 기준:

- Windows에서 worktree 밖 중립 CWD로 cleanup 수행
- 종료된 task의 monitor 재기동 또는 명시된 degraded mode 확인
- squash/merge/rebase merge fixture 통과
- ignored-sensitive fixture가 삭제되지 않음
- 실패 시 worktree와 branch가 보존됨

### Phase 4. UI contract

- `DESIGN.md`와 Page Recipe 정리
- UI checker report → diff-block
- 기존 `global.css` baseline

완료 기준:

- 기존 부채 때문에 무관한 PR이 실패하지 않음
- 신규 selector, raw visual token, broad AntD override fixture 차단
- 허용된 runtime geometry와 만료 있는 예외 fixture 통과
- UI 변경 PR이 관련 desktop/mobile 검증 근거를 남김

### Phase 5. Debt remediation

- `global.css`와 중복 layout을 화면별 PR로 이관
- Claude 상세 adapter 필요성을 재평가

완료 기준:

- UI remediation이 동작과 시각 회귀를 잠그는 테스트를 가짐
- 한 PR에 전체 CSS 재작성이나 전체 화면 재설계를 섞지 않음
- 반복되는 CSS 정리는 사전 승인된 STRICT remediation lane을 사용함

## 15. rollback과 관측성

구현 시 다음 모드를 제공한다.

- worktree cleanup: `off | report | enforce`
- SOT checker: `report | block`
- UI checker: `report | diff-block | enforce`

상태 전이와 cleanup 결과는 task ID, 이전/다음 상태, 판정 근거, timestamp만 기록한다. secret, env value, 사용자 입력 내용은 기록하지 않는다.

cleanup 실패는 성공으로 숨기지 않는다. task에 다음을 남긴다.

- 실패 조건
- 보존된 경로와 branch
- 재개 명령
- 마지막 PR 상태
- 다시 시도할 수 있는 조건

## 16. 검토한 대안

### 대안 A. 현재 `AGENTS.md`에 규칙을 더 추가

거절한다. 중복 소유권과 충돌을 더 키우고 실행 규칙의 변경이 constitution 전체를 흔든다.

### 대안 B. 중앙 정기 sweeper 하나가 모든 worktree 정리

거절한다. task 소유권과 현재 실행 상태를 잃기 쉽고, 병렬 세션에서 잘못된 삭제 반경이 커진다.

### 대안 C. 오래된 worktree는 시간 기준으로 강제 삭제

거절한다. 오래됨은 조사 신호일 뿐 dirty, ignored, 미게시 commit의 폐기 근거가 아니다.

### 대안 D. `global.css` 전체 일괄 Tailwind 변환

거절한다. 기존 동작과 시각 회귀의 원인을 분리하기 어렵고 arbitrary value로 부채 위치만 옮길 위험이 크다.

### 대안 E. Codex와 Claude adapter를 동시에 전면 재작성

거절한다. 공통 핵심과 Codex lifecycle을 먼저 검증한 뒤 Claude 차이를 좁게 반영하는 편이 rollback과 학습에 유리하다.

## 17. 미확정 기술 항목

다음은 구현 전 spike 또는 smoke test로 확정해야 한다. 1~3은 Phase 0에서 먼저 확인하고, 증명되지 않으면 Phase 2를 report-only로 유지한다.

1. Codex Desktop task heartbeat가 task 종료 뒤에도 재기동·재예약되는지
2. Codex Desktop이 소유한 worktree의 native cleanup API/수명주기
3. task 보관과 worktree cleanup의 안전한 순서
4. GitHub PR 상태를 조회할 수 없는 환경의 degraded mode
5. Windows에서 process CWD와 port ownership을 안정적으로 판정하는 방법

이 항목이 증명되지 않았다는 이유로 삭제를 추측 실행하지 않는다. 해당 owner의 cleanup mode를 `report`로 유지한다.

## 18. 외부 근거

- Git은 stale administrative metadata 정리에 `prune`을 사용하고, 실제 연결된 worktree 제거에는 `remove`를 사용한다. dirty worktree는 기본 제거가 거부된다: [Git `git-worktree` documentation](https://git-scm.com/docs/git-worktree.html)
- GitHub은 merged PR의 head branch 자동 삭제와 삭제 branch 복구 흐름을 제공한다. remote branch 정리는 task가 force로 수행하기보다 repository policy와 결합할 수 있다: [Managing automatic deletion of branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches), [Deleting and restoring branches in a pull request](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/deleting-and-restoring-branches-in-a-pull-request)
- Tailwind는 utility 조합과 React component 추출을 재사용 경계로 안내하며, custom CSS는 필요한 경우에 추가하도록 한다: [Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes), [Adding custom styles](https://tailwindcss.com/docs/adding-custom-styles)
- Ant Design은 `ConfigProvider`, global token, component token을 theme customization의 공식 표면으로 제공한다: [Customize Theme](https://ant.design/docs/react/customize-theme/)

## 19. 승인 결정과 다음 단계

사용자는 이 설계를 `accepted_pending_promotion`으로 승인했고 Phase 1 Policy Core의 구현·검증 뒤 active promotion을 확정했다. 다음 단계는 active core를 기준으로 Phase 2 report-only lifecycle을 구현하는 것이다.

- 완료: 정책 문서, registry/checker, 생성 색인, 진입 문서 정리, report-only spike
- 현재 비허용: branch/worktree 자동 삭제, `global.css` 대규모 이관, cleanup enforce 활성화
- 새 workflow 정책 문서는 `active`로 promotion했고, 이 proposal은 replacement ID와 함께 `superseded`로 보존한다.

### Phase 1B 구현 이력 — 2026-07-10

Phase 1 promotion 뒤 repo-local 실행 skill이 active workflow보다 더 넓은 Git·cleanup 권한을 암시하지 않도록 정렬했다.

- 변경 대상: `brainstorming`, `subagent-driven-development`, `using-git-worktrees`, `finishing-a-development-branch`, `verification-before-completion`
- 권한 결정: 설계 승인, 구현 할당, worktree 격리 동의, 완료 선택지, 검증 성공은 각각 별도의 branch/commit/push/PR/merge/cleanup 권한을 만들지 않는다.
- cleanup 결정: Phase 2 lifecycle과 owner 증명이 끝나기 전까지 finish skill은 integration handoff와 `report-only` 보존만 제공한다.
- 리뷰 결정: 전역의 안전 문구만 찾는 checker는 모순된 실행 지시를 가릴 수 있어, 실제 action line과 인접 gate를 검사하도록 보강했다.
- 회귀 방지: `pnpm check:agent-skill-policy`와 전용 Vitest를 독립 CI step으로 연결하고 canonical `.codex/skills`를 ignored `.claude/skills` mirror에 동기화한다.
- 근거: `docs/qa/reports/2026-07-10-agent-skill-policy-pressure.md`, `docs/superpowers/plans/2026-07-10-agent-skill-policy-alignment.md`

검토하고 거절한 대안은 다음과 같다.

- skill의 넓은 자동 실행 지시를 유지하고 상위 `AGENTS.md`만 믿는 방식: 하위 prompt가 상위 정책과 충돌하며 agent 판단에만 안전을 의존하므로 거절했다.
- 완료 skill이 shared base checkout 통합과 정리를 직접 수행하는 방식: app-managed worktree ownership과 lifecycle 지속성이 아직 증명되지 않아 거절했다.
- checker가 문서 어딘가의 `authority` 또는 `report-only` 문구만 확인하는 방식: 떨어진 위치의 모순된 action directive를 놓치므로 거절했다.

이 이력 추가는 proposal의 `superseded` 상태를 바꾸지 않으며, Phase 2 guarded cleanup이나 제품 동작 변경을 승인하지 않는다.

### Phase 2 구현 이력 — 2026-07-10

Codex Desktop cleanup mode를 `report`로 유지한 채 최소 task registry, synthetic lifecycle transition, read-only worktree inventory와 보수적 분류기를 구현했다.

- lifecycle state와 inventory disposition을 분리하고 report mode에서 `FINALIZING`, `CLEANED`, `cleanupAuthorized=true`를 거부한다.
- production registry root는 `$CODEX_HOME/worktree-lifecycle/<repo-id>`로 제한하고 test는 OS temp capability만 사용한다. 이번 검증에서 실제 `$CODEX_HOME` write는 0건이다.
- registry PR/owner 값은 display hint로만 취급한다. fresh GitHub API, process/port/file-lock, clean/ignored/owner/head 증거가 모두 없으면 `REVIEW_CANDIDATE`가 될 수 없다.
- report CLI는 registry writer, network, scheduler, cleanup capability를 import하지 않으며 exact read-only Git argv와 NUL-delimited porcelain을 사용한다.
- 실제 25개 worktree 재수집 결과는 모두 `NEEDS_ATTENTION`, `REVIEW_CANDIDATE` 0개였다. 실행 전후 worktree 목록, refs, current status는 동일했다.
- 검증 근거: `docs/qa/reports/2026-07-10-worktree-lifecycle-phase-2.md`, `docs/superpowers/plans/2026-07-10-codex-lifecycle-report-only.md`

이 구현은 cleanup lease, monitor, supervisor, task archive, worktree/branch 삭제를 활성화하지 않는다. Phase 2A의 사용자 검토와 별도 삭제 권한 없이 어떤 후보도 정리하지 않는다. proposal의 `superseded` 상태와 active owner는 바뀌지 않는다.

### Phase 2A 검토 이력 — 2026-07-10

최신 report-only inventory를 수동 remediation 기준으로 다시 검토했지만 `REVIEW_CANDIDATE`가 0개였다. 25개 worktree를 모두 `NEEDS_ATTENTION`으로 보존했고 cleanup command, branch deletion, worktree removal, `--force` 실행은 0건이었다. owner, live PR, runtime process/port/file-lock 증거가 새로 확보되기 전에는 동일 대상을 삭제 후보로 승격하지 않는다.

Phase 1 promotion은 branch 삭제나 `global.css` 대규모 수정을 승인하는 것이 아니다. Phase별 구현·검증·Git 반영은 각 변경 범위와 현재 안전 조건을 다시 확인한다.

### Phase 4 구현 이력 — 2026-07-10

기존 UI 부채를 즉시 실패시키지 않으면서 새 부채만 차단하는 diff baseline 계약을 구현했다.

- TypeScript compiler API와 PostCSS AST를 사용해 React inline style, arbitrary visual Tailwind 값, raw visual token, 보호된 AntD surface 우회, workspace recipe 누락, global CSS selector/declaration 부채를 구조적으로 수집한다.
- candidate baseline은 current source와 정확히 일치해야 하고, CI는 base commit의 baseline을 ratchet authority로 사용한다. 초기 3-file bootstrap 뒤에는 candidate가 기준선을 늘리거나 바꿔치기할 수 없다.
- 예외는 exact path/rule/fingerprint approval을 먼저 merge한 뒤 다음 PR에서 source/active exception을 적용하는 두 단계로 제한했다. wildcard와 같은-PR CI suppression은 허용하지 않는다.
- active UI owner는 `DESIGN.md`, `docs/agent-workflow/ui.md`, `docs/ant-design/07-review-checklist.md`로 유지한다. proposal은 `superseded` 상태를 유지하며 registry path/status 변경은 없다.
- 제품 runtime UI와 `src/styles/global.css`는 Phase 4에서 변경하지 않았다. 실제 selector 이관은 화면별 Phase 5 STRICT remediation에서 desktop/mobile 회귀 증거와 함께 수행한다.
- 검증 근거: `docs/qa/reports/2026-07-10-ui-contract-baseline.md`, `docs/superpowers/plans/2026-07-10-ui-contract-diff-block.md`

### PR #39 리뷰 보완 이력 — 2026-07-13

아키텍처 BLOCK 리뷰에서 확인된 권한·검사기·SOT 소유권 우회를 active workflow 계약에 반영했다.

- 실행 skill 검사는 고정 목록을 폐기하고 `.codex/skills/`의 실행 surface를 재귀적으로 찾는다. `writing-plans`와 `executing-plans`는 계획 승인이나 테스트 성공을 Git 권한으로 해석하지 않고, 권한이 없으면 stage/commit 단계를 verified diff checkpoint로 바꾼다.
- UI scanner 변경은 source digest와 scanner version을 함께 관리하고, 기준 브랜치의 trusted runner 및 사전 merge된 migration approval 없이는 candidate scanner를 실행 권한으로 사용하지 않는다. 최초 bootstrap은 독립적으로 tamper-proof하지 않으므로 CODEOWNER 검토가 필요하다.
- raw visual token 탐지는 객체 literal뿐 아니라 JSX `color`·`fill`·`stroke`와 정적 식별자 binding까지 포함한다. 탐지 의미가 바뀌므로 scanner version과 baseline을 함께 migration한다.
- `docs/sot-registry.json` schema v2의 `pathPrefix` 상속으로 `docs/Wireframe/`과 `docs/ant-design/` 하위 상세 계약의 lifecycle owner를 명시한다. exact path 등록은 prefix 상속보다 우선한다.

검토하고 거절한 대안은 candidate scanner가 자기 자신의 해시만 검증하는 방식이다. candidate가 검증 코드와 해시를 함께 약화할 수 있으므로 기준 브랜치 코드를 실행하는 trusted runner를 선택했다.

## 20. SOT 체크

- 읽은 공통 진입 문서: `AGENTS.md`, `README.md`
- 확인한 관련 기준: `DESIGN.md`, `docs/ant-design/`, repo-local workflow skill, 현재 theme/layout source, Git worktree 상태
- 확인된 충돌: SOT 범위와 proposal 상태, Git 승인과 skill auto-commit, detached harness와 path 규칙, DESIGN/runtime token, global CSS ownership
- 직접 갱신한 active SOT: `AGENTS.md`, `README.md`, `docs/user-communication-style.md`, `docs/agent-workflow/`
- 이번에 생성한 것: SOT registry/checker, 생성 색인, active workflow 계약, report-only 조사 근거
- 후속 구현 허용 여부: active Policy Core와 report-only 범위에 한해 허용; 파괴적 cleanup과 제품 동작 변경은 별도 승인 전 불허
