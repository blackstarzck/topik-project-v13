# CLAUDE.md

Claude와 Claude 계열 AI 에이전트의 root 진입점이다.

1. `AGENTS.md`의 project constitution을 따른다.
2. `docs/INDEX.md`에서 요청 범위의 active SOT owner를 찾는다.
3. 상세 공통 절차는 `docs/agent-workflow/core.md`를 따른다.
4. worktree/PR/cleanup 안전 조건은 `docs/agent-workflow/codex.md`의 공통 lifecycle을 따른다.

Claude task의 branch 기본값은 `claude/<slug>`다. `codex/<slug>`와 Codex Desktop metadata·native cleanup 절차는 Claude task에 적용하지 않는다.

Claude 고유 도구 adapter가 추가되기 전까지 그 밖의 공통 정책을 이 파일에 복제하지 않는다. 충돌하면 `AGENTS.md`와 active registry가 우선한다.
