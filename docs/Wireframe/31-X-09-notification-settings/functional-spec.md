# X-09 알림 설정 기능명세

## 화면 목적

사용자가 알림 채널, 수신 조건, 리마인더 시간/요일을 저장하게 한다. 인앱(in_app) 발송은 구현되어 있지만 email/Zalo/push 외부 transport는 아직 구현 범위 밖이므로, 이 화면은 인앱 알림과 외부 발송 준비 상태를 명확히 구분한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 `auth.uid()` 기반 RLS가 기준이다.
- 관리자 기능이나 관리자 전용 발송 운영 화면은 이 저장소 범위가 아니다.

## Paper 원천 정보 요약

Paper의 31 X-09 알림 설정 화면은 다음 표시 항목을 갖는다.

- 사이드 내비
- 알림 설정 제목
- 이메일 채널
- Zalo 채널
- 둘 다 채널
- 알림 주기 선택
- 알림 시간 선택
- 알림 내용 설정
- 시간대/권한 상태
- 알림 미리보기
- 도움말/마스코트
- 발송 이력 패널
- 저장 CTA

## 진입/이탈 흐름

- Route: `/settings/notifications`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 홈 대시보드의 알림 진입 또는 프로필/설정 영역의 알림 설정 링크.
- 이탈 경로: 저장 후 같은 화면에 머물며 별도 다음 화면으로 이동하지 않는다.
- 변경값 존재 시 내부 링크 이동, 새로고침, 탭 닫기 전에 이탈 확인을 표시한다.

## 주요 기능

### 채널 탭

- 이메일, Zalo, 둘 다 탭을 제공한다.
- 이메일 채널은 가입 이메일 기준 수신 선호를 저장한다.
- Zalo 채널은 Paper에 포함되어 있고 UI 선호 저장은 가능하지만, 실제 Zalo 외부 연동과 발송은 준비 중으로 표시한다.
- 이메일과 Zalo가 모두 꺼져 있으면 수신 채널 없음 안내를 표시한다.

### 조건 입력

- `profiles.notification_prefs`에 3개 boolean 조건을 저장한다.
  - `weekly_summary`
  - `feedback_ready`
  - `study_reminder`
- `notification_settings`에 스케줄 세부 값을 저장한다.
  - `reminder_time`: `HH:mm[:ss]`
  - `reminder_days`: 0-6 정수 배열, 0=일요일
  - `channels`: `{ "in_app": boolean, "email": boolean, "zalo": boolean }`
  - `timezone`: 기본 `Asia/Seoul`
- 채널이 모두 off이면 리마인더 시간/요일 입력은 비활성화한다.

### 미리보기와 발송 이력

- 리마인더 시간이 있으면 예정 발송 예시 문구를 표시한다.
- 최근 발송 이력은 `notification_delivery_attempts`에서 최신 5개를 조회한다.
- 인앱 발송분부터 이력이 채워진다. 아직 발송 이력이 없는 계정에서는 빈 상태를 정상 상태로 처리한다.

### 저장

- 변경값이 없으면 저장 CTA를 비활성화한다.
- 저장 중 중복 클릭을 차단한다.
- 저장 성공 시 성공 토스트를 표시한다.
- 저장 실패 시 오류 토스트를 표시한다.

## 상태/오류

| 상태 | 표시/동작 |
| --- | --- |
| 로딩 | 설정과 발송 이력 영역에 skeleton을 표시한다. |
| 저장 전 변경 없음 | 저장 CTA 비활성. |
| 저장 전 변경 있음 | 저장 CTA 활성, 이탈 확인 활성. |
| 수신 채널 없음 | 경고 안내 표시, 스케줄 입력 비활성. |
| Zalo 미연동 | 미연동/연동 예정 표시. 실제 발송 성공으로 표현하지 않는다. |
| 발송 이력 없음 | 빈 상태 표시. |
| 설정 로드 실패 | 오류 Alert 표시. |
| 저장 실패 | 오류 토스트 표시. |

## 데이터 사용

아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `notification_prefs` | read/write | `weekly_summary`, `feedback_ready`, `study_reminder` 3개 boolean 조건을 JSON object로 저장한다. | authenticated user; 본인 profile row update. 보호 컬럼(`app_role`, `plan_label`, `status`)은 변경하지 않는다. | `src/lib/settings/types.ts`<br>`src/lib/settings/mutations.ts`<br>`src/components/settings/NotificationPrefsForm.tsx` | 인앱 발송 파이프라인은 구현됨. email/Zalo/push transport만 deferred. |
| `notification_settings` | `user_id`, `reminder_time`, `reminder_days`, `channels`, `timezone`, `updated_at` | read/write upsert | 알림 시간, 요일, 채널, timezone을 사용자별 1:1 설정으로 저장한다. | authenticated user; `user_id = auth.uid()` owner full control. | `supabase/migrations/20260602120200_notifications_and_settings.sql`<br>`src/components/settings/learning-settings-data.ts`<br>`src/components/settings/NotificationPrefsForm.tsx` | `channels` 허용 key는 `in_app`, `email`, `push`, `zalo` 4종 계약이다. 현재 화면은 `in_app`, `email`, `zalo`만 저장하며 push 토글은 없다. timezone 편집 UI는 현재 없음. |
| `notification_log` | `channel`, `template_key`, `status`, `sent_at` | deprecated | 구 발송 이력 소스. 2026-06-12부터 화면 데이터 경로는 `notification_delivery_attempts`로 교체됐다. | authenticated user; 본인 select만 가능. | `supabase/migrations/20260602120200_notifications_and_settings.sql`<br>`src/components/settings/learning-settings-data.ts` (`fetchNotificationLog` legacy reader) | 새 화면 구현에서 사용하지 않는다. |
| `notification_delivery_attempts` | `template_key`, `channel`, `status`, `sent_at`, `created_at` | read | 발송 이력 패널 최근 5건을 표시한다. 상태는 `sent`, `failed`, `skipped`, `opted_out`, `pending`, `deduped`를 다룬다. | authenticated user; `user_id = auth.uid()` owner select. 쓰기는 발송 파이프라인 전용. | `src/components/notifications/notifications-data.ts` (`fetchDeliveryHistory`)<br>`src/components/settings/NotificationPrefsForm.tsx` | topik-ai 소유 공유 객체를 owner-select로 읽는다. |
| `user_notifications` | `id`, `template_key`, `category`, `title`, `body`, `link_url`, `read_at`, `created_at` | read/update | 인앱 알림센터와 B-01 알림 카드의 최신 알림 피드에 사용한다. | authenticated user; 본인 select 및 `read_at` update만 가능. | `supabase/migrations/20260612160000_user_notifications.sql`<br>`src/components/notifications/notifications-data.ts`<br>`src/components/notifications/NotificationBell.tsx` | insert/delete는 service_role 발송 파이프라인 전용이다. |

## 현재 구현 상태

- 구현됨:
  - `/settings/notifications` route 렌더링
  - `profiles.notification_prefs` 조건 저장
  - `notification_settings` 조회/upsert
  - `notification_delivery_attempts` 최신 5개 조회
  - `user_notifications` 기반 인앱 알림센터와 B-01 알림 카드
  - 인앱 발송 파이프라인(DB dispatcher + pg_cron 10분 tick)
  - 채널 탭, 조건 카드, 미리보기 카드, 발송 이력 카드, 저장 dirty-gating
  - 실제 발송 준비 중 안내
- 미구현/deferred:
  - 실제 이메일 발송 transport
  - 실제 Zalo 외부 연동/발송 transport
  - 실제 push provider 연동/발송 transport
  - 사용자 편집 가능한 timezone selector

## 코드 구현 근거

- `NotificationSettingsPage` - `src/app/(workspace)/settings/notifications/page.tsx`
- `NotificationPrefsForm`, `handleFinish`, `computeNotificationDiff` - `src/components/settings/NotificationPrefsForm.tsx`
- `fetchNotificationSettings`, `upsertNotificationSettings` - `src/components/settings/learning-settings-data.ts`
- `fetchDeliveryHistory`, `fetchNotifications`, `markNotificationRead` - `src/components/notifications/notifications-data.ts`
- `useUpdateNotificationPrefs`, `updateNotificationPrefs` - `src/lib/settings/mutations.ts`
- `NOTIFICATION_PREF_KEYS`, `coerceNotificationPrefs` - `src/lib/settings/types.ts`
- Supabase DDL/RLS - `supabase/migrations/20260602120200_notifications_and_settings.sql`, `supabase/migrations/20260612160000_user_notifications.sql`, `supabase/migrations/20260612180000_notification_dispatcher.sql`, `supabase/migrations/20260612180100_register_notification_cron.sql`, `supabase/migrations/20260612190000_notification_email_pipeline.sql`, `supabase/migrations/20260612190100_email_transport_fail_user.sql`, `supabase/migrations/20260612190200_email_live_defer.sql`

## 후속 알림 발송 개발 브리프

email/Zalo/push 외부 발송을 구현할 때는 이 화면 문서의 범위만으로 transport를 확정하지 않는다. 최소 implementation brief 또는 별도 설계 문서에서 아래를 먼저 확정한다.

- 발송 대상 산정: `notification_settings.channels`, `reminder_time`, `reminder_days`, `timezone`, `profiles.notification_prefs`를 함께 평가한다.
- 발송 채널: 이메일 provider, Zalo provider/API, push provider, 실패/재시도 정책.
- 실행 주기: 외부 transport queue/worker 위치와 중복 발송 방지 idempotency key.
- 로그 쓰기: 발송 결과는 `notification_delivery_attempts`와 외부 provider callback 정책에 맞춘다.
- 템플릿: `template_key`별 본문 관리 방식은 topik-ai 소유 운영 영역과 충돌하지 않게 설계한다.
- 보안: service role key는 browser-visible 변수로 노출하지 않는다.
- 사용자 표현: 외부 transport 연결 전까지는 “저장됨”, “인앱 알림”, “외부 발송 준비 중”을 구분한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Paper의 X-09 영역과 route map에 맞게 설명되어 있다.
- DB 데이터 사용 명세의 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 구현된 저장/조회와 미구현 발송 transport가 명확히 분리되어 있다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
