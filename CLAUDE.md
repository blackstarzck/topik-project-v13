# CLAUDE.md

Claude와 Claude 계열 AI 에이전트는 이 파일을 진입점으로 읽고, 상세 규칙은 `AGENTS.md`를 따른다.

## 최우선 규칙

- 답변과 작업 보고는 한국어로 한다.
- 작업 전 `AGENTS.md`와 `README.md`를 먼저 확인한다.
- 제품, 화면, 데이터, 보안, UX 동작을 새로 만들거나 바꾸기 전에는 관련 SOT와 현재 source를 함께 확인한다.
- secret, token, private key, service role key는 출력하거나 commit하지 않는다.

## 병렬 작업과 worktree

이 저장소에서 병렬 작업은 반드시 `한 작업/세션 = 한 branch = 한 worktree`로 진행한다.

- 여러 AI 세션이 같은 프로젝트 폴더에서 동시에 수정하면 안 된다.
- 기준 폴더 `v13`은 가능하면 `main` 기준 확인, 통합, 전체 검증용으로 둔다.
- 새 병렬 작업을 시작할 때는 별도 git worktree를 만들고, 해당 worktree 폴더에서만 작업한다.
- 이미 Codex Desktop 또는 다른 도구가 worktree를 만들어 세션을 시작했다면 그 안에서 다시 중첩 worktree를 만들지 않는다.
- 작업 시작 전 `pwd`, `git branch --show-current`, `git status`, 필요하면 `git worktree list`로 현재 위치와 branch를 확인한다.
- 예상한 worktree가 아니면 파일을 수정하지 말고 먼저 위치를 바로잡는다.
- 병렬 작업 중 공유 기준 폴더에서 `git switch`, `git checkout`, `git reset`, `git rebase`, `git merge`를 실행하지 않는다.

수동 생성 예시:

```powershell
git worktree add ..\v13-practice-filter -b codex/practice-filter main
git worktree add ..\v13-auth-redirect -b codex/auth-redirect main
```

작업 완료 후에는 해당 worktree에서 검증과 diff를 확인하고 commit 또는 PR 단위로 정리한다. 병합은 기준 폴더에서 최신 `main`을 기준으로 branch를 하나씩 통합한다.

worktree는 코드 파일을 격리하지만 포트, 로컬 DB, Supabase 테스트 데이터, `.env.local`, dev server 같은 런타임 자원은 자동으로 격리하지 않는다. 병렬 실행 검증이 필요하면 포트와 데이터 자원 충돌을 별도로 피한다.
