# AI 개발 파이프라인 구현 보고서

> 작성일: 2026-07-21 · 성격: 당시 구현·검증 기록 · 운영 정본: [`../../operations/ai-development-pipeline.md`](../../operations/ai-development-pipeline.md)

## 결과 요약

Codex와 Claude가 같은 작업을 안전하게 이어받고, 작업마다 branch와 worktree를 한 쌍으로 관리하며, 임시 파일이 PR에 섞이지 않도록 막고, 사용자 승인 전에는 어떤 worktree나 branch도 삭제하지 않는 공용 파이프라인을 구현했다.

핵심 기능과 영향 범위 검증은 통과했다. 다만 GitHub required check·head branch 자동 삭제·최초 bootstrap 승인 SHA는 저장소 밖의 설정이므로 적용하지 않았고, stage·commit·push·PR·merge도 사용자 승인 전이라 수행하지 않았다. 저장소 전체 Prettier 검사는 이번 작업과 무관한 기존 파일 52개 때문에 실패했지만 이번 변경 파일만 대상으로 한 형식 검사는 통과했다.

기존 worktree·branch·산출물은 읽기 전용으로 조사했으며 하나도 삭제하거나 이동하지 않았다.

## 구현 전·후 비교

| 비교 항목 | 구현 전 | 구현 후 |
| --- | --- | --- |
| 작업 시작 기준 | 각 도구와 세션이 수동 판단 | `origin`을 fetch한 뒤 고정한 `origin/main` SHA에서만 시작 |
| branch 이름 | `codex/…`, `claude/…` 등 도구 이름 혼용 | `feat|fix|refactor|test|docs|chore|ci/<slug>` 공용 규칙 |
| worktree 위치 | 형제 폴더와 도구별 폴더 혼재 | `.worktrees/<type>-<slug>` 한 곳 |
| Codex↔Claude 인수인계 | 대화와 메모에 의존 | 같은 v2 task record와 상태 fingerprint로 인수인계 |
| 동시 작업 | 두 AI가 같은 폴더를 동시에 수정할 수 있음 | 현재 실행자 한 명만 허용하고 handoff 중에는 수정 차단 |
| 임시 산출물 | root, `.tmp/`, `artifacts/` 등에 누적 | `.codex/work/<slug>/`만 허용하고 Git 추가 차단 |
| PR 증거 | 중간 screenshot과 최종 증거 구분이 약함 | 날짜별 증거 폴더와 SHA-256 manifest 요구 |
| 작업 종료 | 사람이 임의로 폴더와 branch 삭제 | finalize 보고 → fingerprint 승인 → 비강제 cleanup |
| 기존 누적물 | 소유권 확인 없이 방치하거나 수동 정리할 위험 | legacy baseline으로 보존하고 별도 승인 정리로 이관 |

## 구현된 흐름

```mermaid
flowchart LR
  A["origin fetch·SHA 고정"] --> B["branch·worktree 생성"]
  B --> C["구현·검증"]
  C --> D{"Codex↔Claude 인수인계?"}
  D -- 예 --> E["snapshot·resume"]
  E --> C
  D -- 아니요 --> F["PR·CI"]
  F --> G["finalize: 삭제 가능성만 보고"]
  G --> H{"사용자 fingerprint 승인"}
  H -- 없음 --> I["그대로 보존"]
  H -- 일치 --> J["상태 재검사·비강제 cleanup"]
  J --> K["CLEANED 기록"]
```

삭제 조건을 하나라도 확인하지 못하거나 승인 뒤 상태가 바뀌면 보존한다. squash merge처럼 현재 계약으로 안전성을 증명할 수 없는 경우도 자동 정리하지 않는다.

## 구현 범위

- 공용 명령: `task:start`, `task:status`, `task:handoff`, `task:resume`, `task:runtime`, `task:finalize`, `task:cleanup`
- Git common directory 기반의 도구 중립 v2 registry와 엄격한 공개 record schema
- 최신 원격 branch 직접 확인, 고정 base SHA, worktree 생성 rollback, actor lock, fingerprint 인수인계
- runtime 등록, PR·HEAD·`origin/main`·소유권 확인, 승인 fingerprint 기반 정리와 부분 실패 journal 복구
- 산출물 report/check, root allowlist, legacy 삭제-only 정책, 최종 evidence manifest
- PR·merge queue·main push의 trusted-base 검사와 Windows lifecycle CI job
- 운영 정본, 문서 지도, project structure allowlist와 회귀 테스트

## 최종 검증 결과와 실제 시간

아래 시간은 해당 실행의 실제 wall time이다. 일부 초기 실행은 wall time만 계측하고 시작·종료 시각을 별도 저장하지 못했다. Vitest가 자체 출력한 시작 시각이 있는 최종 실행은 함께 적었다. 시각은 KST다.

| 실행 명령 또는 단계 | 결과 | 시작 시각 | 실제 wall time |
| --- | --- | --- | ---: |
| `git fetch --prune origin` | 성공 | 초기 계측 시각 미보존 | 1.3초 |
| bootstrap worktree 생성 | 성공 | 초기 계측 시각 미보존 | 3.7초 |
| worktree env 준비·의존성 설치 | 성공 | 초기 계측 시각 미보존 | 24.4초 |
| baseline project structure | 성공 | 초기 계측 시각 미보존 | 4.3초 |
| baseline agent policy | 성공 | 초기 계측 시각 미보존 | 3.3초 |
| baseline agent skills | 성공 | 초기 계측 시각 미보존 | 3.1초 |
| baseline v1 lifecycle | 성공 | 초기 계측 시각 미보존 | 10.8초 |
| `pnpm check:worktree-lifecycle` | 94/94 성공 | 16:31:27 | 7.9초 |
| `pnpm check:task-lifecycle` | 81/81 성공 | 16:31:41 | 275.9초 |
| artifact hygiene unit test | 38/38 성공 | 16:37:05 | 28.1초 |
| project structure·CI contract | 121/121 성공 | 16:37:38 | 52.3초 |
| `pnpm check:project-structure` | 성공 | 최종 계측 시각 미보존 | 2.3초 |
| `pnpm check:artifact-hygiene` | 성공 | 최종 계측 시각 미보존 | 2.6초 |
| `pnpm check:agent-skill-policy` | 성공 | 최종 계측 시각 미보존 | 1.5초 |
| `pnpm check:agent-skills` | 성공 | 최종 계측 시각 미보존 | 1.3초 |
| `pnpm typecheck` | 성공 | 최종 계측 시각 미보존 | 4.9초 |
| `pnpm test` 재실행 | 성공, 종료 코드 0 | 최종 계측 시각 미보존 | 517.1초 |
| `pnpm lint` | 성공 | 최종 계측 시각 미보존 | 25.0초 |
| `pnpm build` | 성공 | 최종 계측 시각 미보존 | 34.1초 |
| 변경 파일 Prettier 검사 | 성공 | 최종 계측 시각 미보존 | 0.2초 |
| 저장소 전체 `pnpm format` | 실패: 기존 52개 파일 | 최종 계측 시각 미보존 | 64.6초 |

UI 제품 동작이나 화면 스타일은 변경하지 않았으므로 Playwright CLI와 직접 브라우저 확인은 적용 대상이 아니다.

## 실패·리뷰·미완료

| 구분 | 발견 내용 | 현재 상태 | 영향과 다음 행동 |
| --- | --- | --- | --- |
| lifecycle 보안 리뷰 | junction 경로 탈출, stale base, 생성 뒤 orphan, handoff metadata와 lock 교체 가능성 | 해결 | 실제 경로·원격 ref·lock identity 재검사와 회귀 테스트 추가 |
| artifact 보안 리뷰 | moving base, PR 안에서 checker와 policy 동시 변조, 임의 script·증거 우회, legacy 내용 수정 | 해결 | base의 trusted surface를 외부 임시 경로에서 실행하고 exact manifest·삭제-only 계약 추가 |
| cleanup 안전 리뷰 | ignored 파일의 영구 blocker, 부분 삭제 뒤 불일치, 승인 뒤 상태 변경, operation lock | 해결 | disposable inventory, `CLEANING` journal, content fingerprint, 단계별 재검사 추가 |
| v2 lifecycle 합산 실행 | 첫 합산 실행이 도구의 604초 제한을 초과 | 해결 | 현재 두 파일 81/81이 275.9초에 통과. 기능 실패가 아닌 실행 환경 변동으로 확인 |
| 전체 test 1차 실행 | Git 통합 테스트 2건이 병렬 부하에서 공통 40초 제한 초과 | 해결 | 해당 Git 통합 테스트 파일에만 120초 한도 적용. 전체 test 재실행 517.1초, 종료 코드 0 |
| 저장소 전체 Prettier | 기존 제품·테스트 파일 52개 형식 불일치 | 미완료·이번 범위 밖 | 이번 변경 파일은 통과. 기존 52개는 별도 formatting PR 권고 |
| 실행 시각 계측 | 일부 명령의 start/end timestamp를 별도 보존하지 않고 wall time만 기록 | 미완료 | 다음 작업부터 공통 계측 wrapper 또는 CI artifact로 ISO 시작·종료 시각 자동 보존 권고 |
| bootstrap trusted check | 최초 설치 승인 SHA 저장소 변수 미설정 | 외부 승인 대기 | 변수 값이 정확한 PR head SHA와 일치하기 전 bootstrap PR CI는 의도적으로 실패 |
| GitHub 설정 | required check와 head branch 자동 삭제 | 외부 승인 대기 | 코드 반영 뒤 사용자가 승인하면 `origin`에만 적용. `collab` 제외 |
| Git 반영 | stage, commit, push, PR, merge | 사용자 승인 대기 | 결과 보고 뒤 승인된 단계만 수행 |
| bootstrap 정리 | 이번 branch와 worktree 제거 | 사용자 승인 대기 | publish·merge·runtime·소유권 확인 뒤 새 finalize/cleanup 절차 사용 |

## 오래 걸린 단계와 줄이는 방법

| 단계 | 오래 걸린 이유 | 다음 작업에서 줄이는 방법 |
| --- | --- | --- |
| 전체 test 517.1초 | 일반 제품 테스트와 실제 Git 저장소를 만드는 lifecycle 테스트가 함께 병렬 실행됨 | lifecycle 통합 테스트를 명시적인 직렬 CI 단계로 유지하고 기본 test와의 중복 실행 구조를 별도 검토 |
| v2 lifecycle 275.9초 | fetch, branch, linked worktree, rollback, Windows 경로 경계를 임시 저장소에서 반복 확인 | 빠른 schema 테스트와 느린 Git 통합 테스트를 구분하고 안전한 read-only fixture만 재사용 |
| cleanup 단독 최종 실행 359.1초 | remote·worktree·PR·runtime·부분 실패 상태를 실제로 만들고 비강제 정리를 검증 | 삭제 안전성 테스트는 줄이지 말고 Windows 전용 직렬 job에 유지. fixture 생성 비용만 최적화 |
| project structure·CI contract 52.3초 | 각 경우에 Git inventory가 있는 임시 저장소를 생성 | allowlist 순수 함수 테스트와 Git inventory 통합 테스트 분리 검토 |
| 보안 리뷰 반복 | 경로·삭제·trusted base의 작은 누락이 사용자 파일 손실이나 CI 우회로 이어질 수 있음 | junction, TOCTOU, moving ref, partial cleanup을 작업 시작 threat checklist에 고정 |

가장 많은 시간은 기능 작성보다 “잘못 지우지 않는가”와 “PR이 검사기 자체를 바꿔 우회하지 못하는가”를 증명하는 데 사용했다. cleanup이 긴 것은 실제 사용자 worktree가 아니라 매번 새 임시 Git 저장소를 만들어 보존·삭제 순서를 검사했기 때문이다.

## 기존 누적물 읽기 전용 감사

| 조사 대상 | 확인 수량 | 이번 작업의 처리 |
| --- | ---: | --- |
| Git 등록 worktree | 17개 | 삭제·이동 없음 |
| detached worktree | 2개 | 소유권 불명으로 보존 |
| local branch | 51개 | 삭제 없음 |
| `codex/` branch | 36개 | legacy 후보로만 기록 |
| `claude/` branch | 3개 | legacy 후보로만 기록 |
| 새 conventional 규칙 branch | 7개 | 상태만 기록 |
| tracked `artifacts/` 파일 | 136개 | legacy baseline으로 보존, 삭제만 허용하고 수정·추가는 차단 |
| tracked `.tmp/` 파일 | 0개 | 새 경로 차단 |

수량은 2026-07-21 감사 시점의 snapshot이다. 어떤 항목도 소유자·게시·PR·runtime 상태를 확인하지 않고 정리 대상으로 확정하지 않았다.

## 남은 위험과 권고 순서

1. 이번 변경을 검토하고 승인하면 stage와 commit을 먼저 수행한다.
2. push·PR을 승인할 때 bootstrap 저장소 변수에 그 PR의 정확한 head SHA를 별도 승인해 설정해야 trusted artifact check가 통과한다.
3. PR 검증 뒤 required check와 head branch 자동 삭제 설정은 별도 외부 변경 승인으로 `origin`에만 적용한다.
4. squash merge branch는 현재 자동 정리하지 않는다. squash 안전 증명 계약이 추가되기 전에는 보존한다.
5. 기존 17개 worktree와 51개 branch는 별도 read-only finalize 감사와 사용자 승인 없이 삭제하지 않는다.
6. 기존 Prettier 불일치 52개는 기능 변경과 분리한 formatting 전용 작업으로 처리한다.

원격 Supabase apply, `collab` 변경, 기존 누적물 강제 삭제는 수행하지 않았다.
