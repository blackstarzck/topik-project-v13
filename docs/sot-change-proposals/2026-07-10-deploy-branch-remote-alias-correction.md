# 배포 브랜치 정의 정정: `collab` 브랜치 → keduall 배포 저장소(remote `collab`)의 `main`

- 상태: **확정 및 적용됨** (사용자 결정)
- 날짜: 2026-07-10
- 적용 문서: `CLAUDE.md`, `AGENTS.md`
- 결정자: 저장소 오너 (chat 지시)

## 대상 문서

- `CLAUDE.md` → `## 배포 브랜치 보호` 섹션
- `AGENTS.md` → `## 배포 브랜치 보호` 섹션 + `## 파일과 Git 규칙`의 배포 브랜치 항목

## 수정 이유 (문제)

기존 SOT는 "**`collab` 브랜치**가 Vercel에 연결된 배포 브랜치"라고 기술했다. 그러나 실제 git 원격 구성과 오너 확인 결과는 다음과 같다.

- 이 작업 폴더에는 원격이 두 개 등록돼 있다.
  - `origin` → `https://github.com/blackstarzck/topik-project-v13.git`
  - `collab` → `https://github.com/keduall/topik-project-v13.git`
- 즉 `collab`은 **브랜치가 아니라 keduall 저장소를 가리키는 remote 이름(별칭)** 이다.
- Vercel 프로덕션 배포에 연결된 것은 **keduall 저장소의 `main` 브랜치**다. (오너 확인)
- 문서의 예시(`git push origin HEAD:collab`, `git push origin main:collab`)는 존재하지 않는 `origin/collab` 브랜치를 가정하고 있어 실제 구성과 불일치했다.

이 불일치로 인해 에이전트가 "keduall/main은 배포 브랜치가 아니다"라고 잘못 안내하고, 배포 브랜치 보호를 엉뚱한 대상(존재하지 않는 collab 브랜치)에 적용하는 위험이 있었다.

## 수정 방향 (변경 내용)

- 배포 대상 정의를 "**`collab` 브랜치**" → "**keduall 저장소(remote `collab`)의 `main` 브랜치**"로 정정.
- `collab`이 remote 별칭임을 명시하여 브랜치와 혼동하지 않도록 함.
- 금지 예시를 `git push origin ...:collab` → `git push collab main` / `git push collab HEAD:main` / `git push collab <branch>:main`으로 교체.
- 경고 문구를 `keduall 배포 저장소(remote collab)의 main은 Vercel 프로덕션이라 즉시 노출됩니다`로 갱신.
- Git 작업 전 확인 항목에 `git remote -v`(대상 **remote**)를 추가.
- 보호 강도(기본 대상 금지 + 명시 확인 + 경고 + fail closed)는 그대로 유지. 완화 아님.

## 결정 이유

- 문서와 실제 원격/배포 구성이 불일치하면 배포 브랜치 보호 규칙이 실효성을 잃는다.
- 실제 배포 트리거 대상(keduall `main`)에 보호를 정확히 걸어야 오배포를 막을 수 있다.

## 근거

- `git remote -v` 출력: `collab` = keduall 저장소, `origin` = blackstarzck 저장소.
- `git ls-remote --heads collab`: keduall 서버에 `main`(배포), `collab`, `before-convention`, `codex/landing-4-state-cta`, `feat/writing-source-topik-ai-mirror` 존재.
- Vercel 기본 동작상 프로덕션 브랜치(기본값 `main`) push 시 프로덕션 배포가 트리거된다. 근거: https://vercel.com/docs/git
- 오너 확인: "collab은 별칭으로 keduall 레포의 main을 의미", "keduall 레포 main이 배포 브랜치".

## 검토한 대안

1. **문서를 그대로 두고 별도 주석만 추가** — 기각. 핵심 정의가 틀린 채로 남아 재혼동을 유발.
2. **keduall의 실제 `collab` 브랜치를 배포 브랜치로 승격** — 기각. 오너 확인상 배포는 `main`이며, `collab` 브랜치는 stale(아래 참조)이라 제거 결정.
3. **정의를 remote 별칭 기준으로 정정(채택)** — 실제 구성과 일치, 보호 대상 명확.

## 연계 조치 (같은 세션에서 수행)

- keduall 저장소의 stale `collab` 브랜치(`687bfb6a`) 제거. 해당 커밋은 `main`(`56c87d75`)에 완전히 포함되어 커밋 손실 없음(`git merge-base --is-ancestor 687bfb6a main` = true).
- keduall `main`에 대한 이전 push(`d201dc87..56c87d75`)는 오너 지시로 유지.
