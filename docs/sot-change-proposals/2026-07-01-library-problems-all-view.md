# F-01 `/library/problems` 학습 문제 전체보기 보조 페이지 제안

## 대상 SOT

- `docs/Wireframe/18-F-01-my-library/description.md`
- `docs/Wireframe/18-F-01-my-library/functional-spec.md`
- `docs/Wireframe/18-F-01-my-library/screen-data-summary.md`
- `docs/ia.md`
- `docs/flow/user-flow.md`
- `docs/flow/sitemap.md`
- `docs/Wireframe/share/03-learner-side-nav-state/description.md`

## 변경 이유

현재 F-01 active SOT는 `/library`를 탭별 자료 관리 화면으로 정의하지만, `2026-06-30-library-dashboard-redesign.md` 제안은 `/library` 기본 화면을 저장 제출 기반 학습 행동 대시보드로 전환한다. 이 전환 후에도 사용자는 저장 답안과 저장 문제를 검색하고 관리할 전체보기 진입점이 필요하다.

## 제안 범위

- `/library` 대시보드의 `복습 후보` 헤더 우측에 `전체 보기` anchor 버튼을 둔다.
- `전체 보기`는 protected route인 `/library/problems`로 이동한다.
- `/library/problems`는 저장 답안과 저장 문제를 단일 혼합 리스트로 보여준다.
- 리포트, PDF 내보내기 이력, 전체 4탭 서재 복원은 이번 범위에서 제외한다.
- `/library/problems`는 사이드바 메뉴에 추가하지 않고 `/library`에서 진입하는 보조 페이지로 둔다.
- 새 DB 테이블, review state, 복습 제외/완료/snooze 상태는 만들지 않는다.

## 데이터 계약

- 기존 `library_items`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `problems`만 조회한다.
- 저장 답안과 저장 문제는 `library_items.saved_at`을 포함해 클라이언트에서 최신 저장순으로 합친다.
- `study_events`, `library_items.tags`, `library_items.note`는 후보 노출/제외/완료 상태 저장에 사용하지 않는다.

## 수용 기준

- `/library` 복습 후보 섹션은 후보 유무와 관계없이 `/library/problems`로 가는 `전체 보기` 링크를 제공한다.
- `/library/problems`는 `검색 패널 + 혼합 리스트 + 페이지네이션` 구조를 가진다. 별도 내 서재 통계 패널은 노출하지 않는다.
- 저장 답안 row는 피드백 상태, 점수, 요약, 글자 수, 제출일, 피드백 링크를 유지한다.
- 저장 문제 row는 제목, 사용 가능/불가 상태, 다시 풀기 액션을 유지한다.
- 공통 row는 기존 태그 표시와 저장 해제 mutation을 재사용한다.
- 검색은 제목, 문제 번호/ID, 피드백 요약, 태그, 타입 라벨을 대상으로 한다.
- desktop/mobile에서 `/library`의 `전체 보기` 이동과 `/library/problems` 렌더링이 검증된다.

## Active SOT 충돌

- active F-01 SOT는 `/library` 자체에 탭별 자료 관리 기능을 둔다.
- 이번 제안은 `/library` 기본 화면을 대시보드로 둔 상태에서 자료 관리 일부를 `/library/problems`로 재배치한다.
- 따라서 active SOT는 직접 수정하지 않고, 이 문서를 승인 후보로 남긴다.
