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
| `profiles` | `notification_prefs` | read/write | 알림 채널과 조건 설정을 JSON object로 저장한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/admin/queries.ts`<br>`src/lib/admin/server.ts`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | Notification transport is deferred; only preference persistence is current evidence. |

## 현재 구현 상태

- profiles.notification_prefs JSON 컬럼이 현재 저장소다. 실제 발송은 deferred다.

## 코드 구현 근거

- `NotificationSettingsPage` - `src/app/(workspace)/settings/notifications/page.tsx`
- `NotificationPrefsForm`, `handleFinish`, `computeNotificationDiff` - `src/components/settings/NotificationPrefsForm.tsx`
- `fetchNotificationSettings`, `fetchNotificationLog` - `src/components/settings/learning-settings-data.ts`
- `useUpdateNotificationPrefs`, `updateNotificationPrefs` - `src/lib/settings/mutations.ts`

## 미구현/불일치

- 실제 이메일/푸시 발송 transport는 구현 범위 밖이고 preference 저장만 확인된다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.
- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/sitemap.md` audience와 맞는다.
