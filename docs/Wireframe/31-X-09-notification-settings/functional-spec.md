# X-09 알림 설정 기능명세

## 화면 목적

사용자가 알림 채널과 조건을 저장하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/settings/notifications`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 홈 대시보드의 알림 진입.
- 이탈 경로: 저장 후 같은 화면에 머물며 별도 다음 화면으로 이동하지 않는다.
- 화면 내부 동작: 이메일/푸시 채널, 알림 유형, 요일/시간, 토글 변경과 저장을 처리한다.

## 주요 기능

- 채널 토글
- 조건 입력
- 미리보기
- 저장

## 상태/오류

- 전송 채널 미연동, 권한 없음, 저장 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `notification_prefs` | read/write | 알림 채널과 조건 설정을 JSON object로 저장한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | 인앱 발송 파이프라인은 구현됨(2026-06-12). email/Zalo/push transport만 deferred. |
| `notification_log` | `channel`, `template_key`, `status`, `sent_at` | (사용 안 함 — **deprecated**) | 구 발송 이력 패널 소스. 2026-06-12 attempts 소스로 교체되어 화면 데이터 경로에서 제거됨(O-9 — 변경·사용 금지 봉인, 최종 drop은 백로그). | authenticated user; auth.uid() owner select | `src/components/settings/learning-settings-data.ts` (`fetchNotificationLog` legacy reader 잔존 — 화면 미사용) | none |
| `notification_delivery_attempts` | `template_key`, `channel`, `status`, `sent_at`, `created_at` | read | 발송 이력 패널 최근 5건(상태 6종 라벨: sent/failed/skipped/opted_out/pending/deduped). | authenticated user; `user_id = auth.uid()` owner select(쓰기는 발송 파이프라인 전용). **topik-ai 소유 공유 객체** — `docs/architecture/shared-supabase-schema-ownership.md` 참조 | `src/components/notifications/notifications-data.ts` (`fetchDeliveryHistory`)<br>`src/components/settings/NotificationPrefsForm.tsx` | none |

## 현재 구현 상태

- profiles.notification_prefs + notification_settings(시간/요일/채널/timezone)가 선호 저장소다.
- **구현됨 (2026-06-12, feat/notifications)**:
  - 인앱 발송 파이프라인 — DB dispatcher `private.dispatch_notifications()` + pg_cron 10분 tick (`supabase/migrations/20260612180000_notification_dispatcher.sql`, `20260612180100_register_notification_cron.sql`). 스케줄형(사용자 timezone 보정)·이벤트형·관리자 발송을 dispatch/attempt 2계층 ledger와 dedupe 2단으로 집행한다.
  - 발송 이력 패널 — `notification_delivery_attempts` owner-select 소스로 교체(`notification_log`는 deprecated — O-9).
  - 인앱 알림센터 — 헤더 벨(미읽음 뱃지 99+ 상한, 60초 폴링) + 수신함(읽음/모두 읽음) (`src/components/notifications/NotificationBell.tsx`).
  - B-01 홈 대시보드 알림 카드 — `user_notifications` 최신 5건 피드.
  - 템플릿 catalog — `notification_templates`(관리자 앱 topik-ai 소유, 관리자 화면에서 CRUD·발송).
  - channels 계약 — `in_app`/`email`/`push`/`zalo` 4종, 기존 row의 missing `in_app`은 true(기본 수신)로 해석.
- **미구현 유지**: email/Zalo/push 발송 transport(준비 중 — provider 미연동), timezone 선택 UI.

## 코드 구현 근거

- `NotificationSettingsPage` - `src/app/(workspace)/settings/notifications/page.tsx`
- `NotificationPrefsForm`, `handleFinish`, `computeNotificationDiff` - `src/components/settings/NotificationPrefsForm.tsx`
- `fetchNotificationSettings` - `src/components/settings/learning-settings-data.ts` (`fetchNotificationLog`는 deprecated legacy reader)
- `fetchDeliveryHistory` - `src/components/notifications/notifications-data.ts` (발송 이력 패널 소스)
- `useUpdateNotificationPrefs`, `updateNotificationPrefs` - `src/lib/settings/mutations.ts`

## 미구현/불일치

- email/Zalo/push 발송 transport는 미구현(준비 중)이다. 인앱(in_app) 발송은 파이프라인까지 동작한다(2026-06-12).
- timezone 선택 UI는 미구현이다(저장 컬럼은 존재, 기본 Asia/Seoul).

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
