# X-09 알림 설정 — 채널 섹션 재디자인 & 미리보기/발송 이력 제거 제안

- 날짜: 2026-06-21
- 화면: X-09 알림 설정 (`/settings/notifications`)
- 상태: 제안 (active SOT 미수정). 사용자 결정으로 방향 확정됨.
- 관련 코드: `src/components/settings/NotificationPrefsForm.tsx`, `src/styles/global.css`
- 영향 SOT: `docs/Wireframe/31-X-09-notification-settings/description.md`, `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`

## 결정 이유

사용자(제품 결정권자)가 채널 섹션을 더 단순·정직하게 만들기 위해 다음을 요청·확정함.

- 이메일/Zalo를 토글 가능한 체크박스가 아니라 **비활성("준비 중") 카드**로 노출 → 외부 발송이 동작할 것이라는 오해를 원천 차단(정직성 UX 개선).
- 중복 안내였던 두 alert(상단 파란 deferred 안내, 채널 내 노란 externalNotice)를 제거. 디스클로저는 채널별 "준비 중" 라벨 + 비활성 상태가 대신함.
- "자세히 보기 → 미리보기/발송 이력(Region 4)" 기능은 불필요로 판단하여 **전체 제거**(2026-06-21 대화에서 명시 선택).

## 변경 내용

1. 상단 파란 info alert(`deferredSummary`/`deferredNotice` + `자세히 보기` 토글) 제거.
2. 채널 카드 내 노란 warning alert(`channel.externalNotice`) 제거.
3. 미리보기/발송 이력(Region 4) 전체 제거: detail panel, `notification-details-toggle`, `detailsOpen`/`historyLoad`/`log` state, `fetchDeliveryHistory` 호출, `LOG_STATUS_BADGE_META`, 미리보기 문구.
4. 채널 옵션 재디자인:
   - 체크박스 제거, 각 옵션을 카드로 표현.
   - 인앱 알림: 클릭 토글(버튼, `aria-pressed`), 선택 시 outline 강조(`--app-color-primary`).
   - 이메일/Zalo: 비활성(`disabled`) "준비 중" 카드. 비활성 표현은 카드 내부 텍스트+아이콘 색에 투명도만 적용(테두리/배경은 유지).
5. 조건부 alert(`error`, `noChannel`, `onlyExternalChannelsSelected`)는 유지(이미지에서 지목된 2개가 아님).

## active SOT와의 충돌 및 갱신 필요(승인 시)

| SOT 위치 | 현재 기술 | 제안 후 |
| --- | --- | --- |
| functional-spec.md "채널 탭": "이메일 채널은 수신 선호를 저장한다 / Zalo UI 선호 저장은 가능" | 이메일/Zalo 선호 저장 가능 | 이메일/Zalo는 비활성, 사용자 토글·저장 불가(기존 저장값은 보존, 사용자 변경 없음) |
| functional-spec.md "미리보기와 발송 이력", description.md Region 4 | 미리보기·최근 발송 이력 5건 표시 | 기능 제거 |
| description.md "구현 주의": 인앱/외부 transport 상태 구분 | alert로 구분 | 채널별 "준비 중" 라벨 + 비활성 상태로 구분(디스클로저 유지) |

데이터 계약(`notification_delivery_attempts` owner-read)은 인앱 알림센터(`NotificationBell`)에서 계속 사용하므로 DB/RLS 변경 없음. 본 화면에서만 발송 이력 조회 UI를 제거.

## 수용 기준

- 채널 섹션에 체크박스가 없고, 인앱은 클릭 토글 + 선택 시 outline 강조, 이메일/Zalo는 비활성 "준비 중"으로 보인다.
- 두 alert와 미리보기/발송 이력 패널이 화면에 없다.
- 인앱 알림 on/off 저장·복원이 동작한다(이메일/Zalo 저장값은 변경되지 않고 보존).
- 외부 발송이 동작하는 듯한 표현이 없다(정직성 유지).
- desktop/mobile, loading/empty/disabled 상태 정상.

## 테스트 영향

- e2e `tests/e2e/screens/notification-settings.spec.ts`: 체크박스 role 조작, `notification-details-toggle`, deferredNotice 텍스트, 채널 옵션 `expectZeroBorder`, 발송 이력 실패 테스트 → 새 디자인에 맞게 갱신/제거.
- 컴포넌트 `tests/components/settings/NotificationPrefsForm.test.tsx`: deferred alert 텍스트, details 토글, 발송 이력 오류 테스트 → 갱신/제거.
