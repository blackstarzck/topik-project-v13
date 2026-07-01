# F-01 내 서재 학습 행동 대시보드 전환 제안

## 대상 문서

- `docs/Wireframe/18-F-01-my-library/description.md`
- `docs/Wireframe/18-F-01-my-library/functional-spec.md`
- `docs/Wireframe/18-F-01-my-library/screen-data-summary.md`
- `docs/Wireframe/data-usage-index.md`
- `docs/flow/user-flow.md`

## 수정 이유

현재 active F-01 SOT는 `/library` 기본 화면을 탭별 자료 목록, 검색/필터, 저장 해제, 태그 편집, PDF 내보내기 중심으로 정의한다. 새 방향은 `/library` 기본 화면을 저장 답안의 학습 행동 대시보드로 완전 대체해, 학습자가 다시 볼 답안과 피드백 대기 상태, 최근 약점, 학습 타임라인을 먼저 확인하도록 바꾸는 것이다.

이 변경은 active SOT의 화면 구조와 직접 충돌하므로, active SOT 문서를 바로 수정하지 않고 이 제안 문서로 변경 의도와 acceptance criteria를 먼저 기록한다.

## 제안 범위

### 기본 화면 변경

- `/library` 기본 화면은 `KPI -> 복습 후보 스와이퍼 -> 피드백 대기/최근 낮게 나온 항목/학습 타임라인` 구조로 전환한다.
- 기존 `LibraryTabs`, `LibrarySubmissionsTab`, `LibraryStatsPanel`, `LibraryActionsPanel`, PDF 관련 컴포넌트는 첫 구현에서 삭제하지 않는다.
- 기존 목록/검색/필터/PDF/태그/삭제 기능은 기본 화면에서는 노출하지 않는다. 후속 SOT에서 별도 경로, 별도 모드, 또는 폐기 여부를 결정한다.

### 데이터 기준

- 새 DB 테이블은 만들지 않는다.
- 복습 후보는 실제 persistent review queue가 아니라 저장된 답안과 피드백 데이터를 서버에서 계산한 추천 목록이다.
- 원천 데이터는 `library_items`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `study_events`, `problems`를 사용한다.
- 후보 범위는 `library_items.item_type = 'submission'`인 저장 답안으로 제한한다.
- 복습 후보는 `writing_submissions.feedback_status = 'complete'`이고 `writing_feedback.status = 'complete'`인 항목만 포함한다.
- 분석 실패 항목은 복습 후보, PDF, 복습 세트 대상에서 제외하고 피드백 대기/상태 패널에만 표시한다.
- `study_events` 타임라인은 기존 이벤트 중 `submission_submitted`, `feedback_viewed`, `report_viewed`, `export_downloaded`만 표시한다. `review_set_created` 같은 catalog 불일치 이벤트는 이번 대시보드 범위에서 확장하지 않는다.

## Acceptance Criteria

- `/library` 기본 화면은 기존 탭 목록 대신 학습 행동 대시보드를 렌더링한다.
- KPI는 복습 가능, 피드백 대기, 비교 가능, 최근 학습을 표시한다.
- 복습 후보는 최대 12개이며, 정렬 우선순위는 다음 순서를 따른다.
  1. 53번 200-300자 또는 54번 600-700자 범위 이탈
  2. 같은 `problem_id`의 재작성 기록 있음
  3. 낮은 dimension 점수 있음
  4. 최근 제출순
- 51/52번은 분량 이탈을 강한 사유로 쓰지 않고 `피드백 확인 가능`, `비교 가능`, `짧은 답안` 같은 사유만 표시한다.
- `피드백 보기`는 기존 `writingFeedbackHref`를 사용한다.
- `다시 풀기`는 기존 `writingProblemHref({ fresh: true, retrySubmissionId })`를 사용한다.
- 피드백 대기는 `pending`, `analyzing`, `failed` 저장 답안을 최대 2개 표시하고, `failed`는 분석 실패로 구분한다.
- 최근 낮게 나온 항목은 최근 완료 피드백의 dimension 점수를 0-100으로 정규화해 가장 낮은 3개만 표시한다.
- 약점 표본이 부족하면 낮은 항목 대신 데이터 부족 상태를 표시한다.
- 학습 타임라인은 최신 `study_events`를 한국어 라벨로 표시한다.
- 새 UI는 loading, empty, error, success, disabled 상태를 갖는다.
- Swiper는 기존 설치된 `swiper`를 사용하고, 다중행 grid에서는 `slidesPerView: 'auto'` 대신 숫자형 breakpoint를 사용한다.

## SOT 충돌

- 현재 F-01 active SOT의 탭별 목록, 검색, 필터, 저장 해제, 태그 편집, PDF 내보내기 요구사항과 충돌한다.
- 이 제안이 승인되면 active F-01 SOT는 `/library` 기본 화면을 대시보드로 바꾸고, 기존 자료 관리 기능의 후속 배치 여부를 별도 결정해야 한다.
- 승인 전 active SOT 문서는 직접 수정하지 않는다.

## 검증 계획

- Unit: KPI 집계, 후보 12개 제한, 53/54 분량 사유, 비교 가능 판정, pending/failed 분리, weak dimension 정규화 검증.
- Component: KPI 4개, 복습 후보 카드, 하단 3패널, empty/loading/error/disabled 상태 렌더링 검증.
- E2E: desktop/mobile에서 `/library` 렌더링, 카드 CTA 이동, 스와이퍼 next/prev, empty/pending 상태 검증.
- Static: `pnpm lint`, `pnpm typecheck`.

## 결정 필요

- 기존 자료 관리 기능을 후속 경로로 옮길지, 대시보드 안의 secondary action으로 되살릴지, 제품 범위에서 폐기할지 결정해야 한다.
- 이 결정 전까지 기존 구현 컴포넌트와 관련 mutation/server 코드는 삭제하지 않는다.
