# X-09 알림 설정 화면 데이터 계약

## 화면 요약

사용자가 학습 알림 채널, 알림 조건, 리마인더 시간/요일, timezone 상태를 설정하고 최근 발송 이력을 확인하는 화면이다.

이 문서는 사용자 화면이 소비하는 데이터만 정리한다. 관리자 전용 화면 구현, 관리자 스키마 확장, 운영자용 템플릿 관리 화면은 이번 범위에 포함하지 않는다.

## 기준 소스

| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | Paper `31 X-09 알림 설정` | 사용 |
| 2 | description.md | 사용 |
| 3 | functional-spec.md | 사용 |
| 4 | current source code | 구현 상태 확인 |
| 5 | hifi.png / wireframe.png | 보조 |

문서와 이미지가 다르면 `description.md`와 `functional-spec.md`를 기준으로 확정한다. 코드에서 확인되지 않은 transport 동작은 구현된 것으로 쓰지 않는다.

## 사용자 화면 표시 데이터

- 알림 설정 제목
- 이메일 채널
- Zalo 채널
- 둘 다 채널
- 채널 미연동/수신 채널 없음 안내
- 알림 주기 선택
- 알림 시간 선택
- 알림 내용 설정
- 시간대/권한 상태
- 알림 미리보기
- 도움말/마스코트 영역
- 최근 발송 이력 5개
- 저장 상태
- 실제 발송 준비 중 안내

## 사용자 입력/상태 데이터

- `notification_prefs.weekly_summary`
- `notification_prefs.feedback_ready`
- `notification_prefs.study_reminder`
- `notification_settings.reminder_time`
- `notification_settings.reminder_days`
- `notification_settings.channels.email`
- `notification_settings.channels.zalo`
- `notification_settings.timezone`
- 저장 액션
- 이탈 확인 상태

## 운영/관리 대상 데이터 계약

| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 간단 알림 조건 플래그 | 현재 스키마로 충족 | `profiles.notification_prefs`가 3개 boolean 조건을 JSON object로 저장한다. | missing key는 false로 해석하는 코드 계약이다. |
| 알림 시간/요일/채널 | 현재 스키마로 충족 | `notification_settings`가 `reminder_time`, `reminder_days`, `channels`, `timezone`을 저장한다. | user_id 1:1 구조다. |
| 발송 이력 | 현재 스키마로 충족, 생성 경로는 미구현 | `notification_log`가 `channel`, `template_key`, `status`, `payload`, `sent_at`을 저장한다. | 사용자는 본인 이력만 읽는다. 실제 transport/worker가 없어 row 생성 경로는 아직 없다. |
| 알림 템플릿 catalog | 스키마 보강 필요 | 알림 문구와 `template_key`별 본문을 운영 데이터로 관리하는 구조는 없다. | 현재는 발송 이력 ledger 중심이다. |
| 외부 발송 transport | deferred | 이메일/Zalo 실제 발송 provider, scheduler, retry, idempotency 정책은 없다. | QA §11-S 기준 스텁/deferred. |

## Supabase 테이블 스키마 정보

| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| `profiles` | 간단 알림 조건 플래그 | `20260521141000_phase_6_notification_prefs.sql`: `notification_prefs` jsonb object. |
| `notification_settings` | 알림 시간/요일/채널 | `20260602120200_notifications_and_settings.sql`: `user_id`, `reminder_time`, `reminder_days`, `channels`, `timezone`, `updated_at`. |
| `notification_log` | 발송 이력 | `20260602120200_notifications_and_settings.sql`: `id`, `user_id`, `channel`, `template_key`, `status`, `payload`, `sent_at`, `created_at`. |

## 저장/조회/이벤트 흐름

1. 화면 진입 시 서버에서 `profiles.notification_prefs`를 조회해 초기 조건 토글을 만든다.
2. 클라이언트에서 `notification_settings`와 `notification_log`를 조회한다.
3. 사용자가 채널, 요일, 시간, 조건 토글을 변경하면 dirty 상태가 된다.
4. 저장 시 `profiles.notification_prefs` diff를 merge 저장하고, 스케줄 값이 바뀌었으면 `notification_settings`를 upsert한다.
5. `notification_log`는 읽기 전용으로 표시한다. 실제 발송 service가 연결되기 전에는 쓰기 경로가 없다.

## RLS/권한 기준

- `profiles`: 본인 row select/update가 가능하지만 `app_role`, `plan_label`, `status`는 보호 컬럼이다.
- `notification_settings`: `user_id = auth.uid()` 기준 본인 설정만 전체 작업이 가능하다.
- `notification_log`: 본인 select만 가능하다. 쓰기는 알림 서비스/service role 흐름이다.
- service role key와 외부 provider secret은 브라우저에 노출하면 안 된다.

## 스키마 정합성 메모

사용자 알림 설정 저장과 발송 이력 조회는 현재 스키마로 충족된다. 실제 발송 transport, scheduler, retry 정책, template catalog는 아직 없다.

## 검수 필요 항목

- `channels` JSON의 허용 key를 `email`, `zalo`로 고정할지 확정한다.
- timezone 기본값과 daylight saving 처리를 정한다.
- Paper의 “시간대/권한 상태” 영역을 사용자 편집 UI로 확장할지, 상태 표시만 둘지 정한다.
- 실제 발송 구현 전까지 UI와 문서에서 “발송 성공”을 단정하지 않는다.
- transport 구현 시 발송 로그 idempotency key와 재시도 정책을 설계한다.
