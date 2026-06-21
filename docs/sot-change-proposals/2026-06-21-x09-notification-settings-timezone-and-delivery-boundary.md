# X-09 Notification Settings Timezone And Delivery Boundary Proposal

## 대상 문서

- `docs/Wireframe/31-X-09-notification-settings/functional-spec.md`
- `docs/Wireframe/31-X-09-notification-settings/screen-data-summary.md`
- `docs/Wireframe/data-usage-index.md`

## 수정 이유

현재 코드의 `/settings/notifications` 화면은 timezone selector를 표시하고 `notification_settings.timezone`에 저장한다. 그러나 X-09 기능명세의 구현 상태 표에는 "사용자 편집 가능한 timezone selector"가 미구현/deferred로 남아 있다.

또한 이메일 발송 worker와 DB pipeline 코드는 존재하지만, 프로젝트 스코프 결정상 Zalo, 운영 이메일, 외부 리마인더는 실제 발송 가능 상태가 검증되기 전까지 완료 기능으로 표현하면 안 된다.

## 제안

1. Timezone selector는 현재 구현을 유지한다.
2. 활성 SOT에는 timezone selector가 구현됨으로 갱신한다.
3. 허용 timezone 목록은 현재 코드 기준으로 `Asia/Seoul`, `Asia/Ho_Chi_Minh`, `UTC`로 문서화한다.
4. 기본값은 `Asia/Seoul`로 유지한다.
5. 기존 DB 값이 없거나 잘못된 경우 앱은 `Asia/Seoul`로 안전하게 해석한다.
6. 이메일/Zalo/push는 "설정 저장 가능"과 "실제 외부 발송 완료"를 분리해 문서화한다.
7. `notification_delivery_attempts`는 v13 사용자 앱에서 최근 5건 owner-read 용도로만 사용하고, 쓰기/운영 관리는 topik-ai 소유 경계로 유지한다.

## 수용 기준

- `/settings/notifications`에서 timezone selector가 보이고 저장 가능한 것이 SOT와 충돌하지 않는다.
- 사용자 문구는 앱 안 알림, 저장되는 선호, 외부 발송 준비 중 상태를 구분한다.
- Zalo는 선호 저장만 가능하며 실제 provider/API/transport가 없음을 유지한다.
- 이메일은 transition worker가 있어도 운영 발송 완료 기능으로 말하지 않는다.
- service role key, `NOTIFICATION_WORKER_SECRET`, `RESEND_API_KEY`는 브라우저에 노출하지 않는다.

## 검토한 대안

| 대안 | 장점 | 단점 | 제안 여부 |
| --- | --- | --- | --- |
| timezone selector 제거 | 기존 SOT와 즉시 일치 | 이미 구현된 저장 기능과 테스트 흐름을 후퇴시킴 | 비추천 |
| timezone selector 유지 후 SOT 갱신 | 현재 source와 사용자 기능을 보존 | SOT 승인 절차 필요 | 추천 |
| timezone을 표시만 하고 수정 불가 처리 | 충돌을 일부 줄임 | `notification_settings.timezone` 저장 요구와 맞지 않고 UX가 모호함 | 비추천 |

## 결정 필요

사용자가 승인하면 위 제안을 active SOT에 반영한다. 승인 전에는 active SOT 원문을 직접 수정하지 않는다.
