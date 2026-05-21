# Light Specs

phase 단위 작업을 시작하기 전, **1쪽 분량**으로 phase의 의도와 경계를 압축한 라이트 스펙을 이 폴더에 둡니다.

## 언제 만드나

- Phase 단위 작업을 시작할 때 (예: Phase 4 Learning Core 진입 직전)
- ledger 작성과 같은 단계에서 만들고, 작업 시작 전에 사용자/리뷰어가 한 번 훑을 수 있어야 합니다.

소규모 작업(tiny docs/config edits, 단일 함수 수정 등)에는 만들지 않습니다. 그 경우 ledger와 plan만으로 충분합니다.

## 파일명 규칙

```
docs/ai-workflow/light-specs/phase-{n}-{slug}.md
```

예: `phase-1-app-foundation.md`, `phase-4-learning-core.md`.

ledger의 `## Verification State`에서 다음 한 줄로 가리킵니다:

```
- Light Spec: docs/ai-workflow/light-specs/phase-4-learning-core.md
```

`scripts/ai-workflow-check.mjs`는 phase ledger(파일명에 `phase-N` 포함 또는 본문에 `Phase: ...` 마커)인 경우 이 줄을 의무로 검사합니다.

## 6개 의무 섹션

라이트 스펙에는 다음 6개 섹션만 둡니다. 그 이상은 plan 또는 docs/spec.md에 넣고, 라이트 스펙은 항상 1쪽을 유지합니다.

1. **핵심 기능 (Core Functionality)** — 이번 phase에서 만드는 핵심 가치 1–3개.
2. **제외 기능 (Out of Scope)** — 이번 phase에서 일부러 만들지 않는 것과 그 이유.
3. **최소 동작 기준 (Minimum Acceptable Behavior)** — 이게 동작한다고 말하기 위한 최소 조건.
4. **사용자 흐름 (User Flow)** — 진입→이탈까지 한 줄짜리 흐름. 세부는 `docs/flow/user-flow.md` 참조.
5. **도메인 경계 (Domain Boundary)** — 이 phase가 다루는 도메인과 폴더(예: `src/learning/`). `docs/domain-glossary.md` 참조.
6. **성공 조건 (Success Criteria)** — 어떻게 닫을지. 테스트, QA, 사용자 피드백, 데이터 등.

## 분량/스타일

- 한 섹션당 3–6줄.
- 코드 스니펫은 두지 않습니다.
- 결정 로그는 ledger에 두고, 여기에는 결과만 적습니다.

## 관련 문서

- 워크플로우: [docs/ai-development-workflow.md](../../ai-development-workflow.md)
- Plan 템플릿: [docs/ai-workflow/plans/README.md](../plans/README.md)
- 도메인 라우팅: [docs/domain-glossary.md](../../domain-glossary.md)
- Ledger 템플릿: [docs/ai-workflow/context-ledger-template.md](../context-ledger-template.md)
