# 대시보드 알림 섹션 공지사항 전용화 제안

## 제안 배경

대시보드 우측 하단 카드가 `알림` 피드 역할을 하면서, 워크스페이스 전역의 플로팅 알림 버튼과 기능이 겹친다. 사용자는 대시보드 카드가 공지사항 전용 영역이 되기를 요청했다.

## 대상 SOT

- `docs/Wireframe/04-B-01-home-dashboard/description.md`
- `docs/Wireframe/04-B-01-home-dashboard/functional-spec.md`
- `docs/Wireframe/04-B-01-home-dashboard/screen-data-summary.md`
- `docs/Wireframe/data-usage-index.md`

## 갱신 방향

- B-01 No.4 영역명을 `일정/알림 보조 영역`에서 `공지사항 보조 영역`으로 변경한다.
- 대시보드 카드는 `user_notifications.category = notice` 최신 5건만 표시한다고 명시한다.
- 시험 D-day, 작성 중 draft, 학습 알림 등 일반 알림은 전역 플로팅 알림 버튼/알림함에서 다루는 것으로 역할을 분리한다.
- 대시보드 공지사항 카드의 제목은 `공지사항`으로 확정한다.
- 공지사항 카드 안의 `알림 설정` CTA는 제거하고, 로드 실패 시 재시도만 제공한다고 정리한다.

## 구현 반영 상태

- 2026-06-25 현재 구현은 위 방향으로 먼저 반영됨.
- SOT 본문은 아직 직접 수정하지 않았으므로, 다음 문서 정리 작업에서 위 대상 문서 갱신이 필요하다.
