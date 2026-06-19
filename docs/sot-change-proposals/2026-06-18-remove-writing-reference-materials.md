# 2026-06-18 51~54 쓰기 화면 참고 자료 제거 제안

## 배경

51~54 쓰기 풀이 화면에서 문제 지문 아래의 `참고 자료` 영역을 제거하기로 했다.
이에 따라 구현에서는 참고 자료 카드 렌더링, `problem_assets` 조회, 참고 자료 정규화 필드 전달을 제거한다.

## 변경이 필요한 SOT

- `docs/Wireframe/08-D-01-short-answer-writing-51/description.md`
  - `Wireframe Number Map`의 `3 | 참고 이미지` 항목 제거 또는 비활성 처리
  - `Detailed Description`의 `■ 참고 이미지` 섹션 제거 또는 보류 상태로 변경
- `docs/Wireframe/08-D-01-short-answer-writing-51/screen-data-summary.md`
  - `problem_assets`와 `storage:problem-assets`를 51번 풀이 화면 표시 데이터에서 제거
  - “문항 본문/자료/조건” 설명에서 첨부 자료 제공 문구 제거
- `docs/Wireframe/08-D-01-short-answer-writing-51/functional-spec.md`
  - `problem_assets` read 의존성 제거
  - `renderWritingQuestionPage`, `loadProblemExtras` 관련 설명 갱신

## 구현 반영 방향

- 51~54 workspace에서 `<ReferenceMaterials />`를 렌더링하지 않는다.
- 쓰기 route 서버 컴포넌트에서 `problem_assets`를 조회하지 않는다.
- 문제 `materials`에서 참고 자료 카드용 `referenceMaterials`/`materialCards`를 만들지 않는다.
- 기존 문제 지문, 빈칸 입력, 조건 패널, 저장, 자동저장, 제출, 피드백 이동은 유지한다.

## 결정 근거

사용자 요청에 따라 실제 풀이 화면에서 참고 자료 컨텐츠를 제거한다. 현재 활성 SOT에는 참고 이미지/자료 영역이 남아 있으므로, 문서 갱신 없이는 구현과 SOT가 불일치한다.

## 검증 기준

- 51~54 풀이 화면에 `참고 자료` 카드가 표시되지 않는다.
- `problem_assets` 조회가 51~54 풀이 route에서 발생하지 않는다.
- `writing.reference` 번역 키가 더 이상 사용되지 않는다.
- `pnpm typecheck`, `pnpm lint`, 51~54 desktop/mobile 렌더 검증을 통과한다.
