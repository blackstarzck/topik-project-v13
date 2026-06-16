# X-05 프로필 편집 기능명세

## 화면 목적

사용자가 이름, 닉네임, 자기소개, 아바타, 목표 정보를 관리한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/profile`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: B-01 홈 대시보드의 프로필 편집 진입.
- 이탈 경로: 멤버십/결제 진입은 X-04 구독 관리로 이동하며, 저장 후에는 같은 화면에 머문다.
- 화면 내부 동작: 이름/상태/자기소개 수정, 아바타 변경, 저장, 미저장 이탈 경고를 처리한다.

## 주요 기능

- 기본 정보
- 160자 자기소개
- 아바타
- 학습 목표
- 저장

## 상태/오류

- 닉네임 중복, bio 길이 초과, 권한 보호 컬럼

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | `display_name`, `nickname`, `avatar_path`, `bio`, `ui_locale`, `plan_label`, `status` | read/write | 프로필 편집, 160자 자기소개, 아바타 경로에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |
| `learning_goals` | `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas` | read/write | 프로필의 시험 목표 정보에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/learning/mutations.ts`<br>`src/lib/learning/queries.ts`<br>`src/lib/learning/server.ts`<br>`supabase/migrations/20260520120100_profiles_goals.sql` | none |
| `rpc:private.protect_profile_columns` | - | trigger | 사용자가 app_role, plan_label, status를 직접 바꾸지 못하게 막는다. | authenticated user; auth.uid() owner RLS where user-owned | `supabase/migrations/20260520121400_profiles_protected_columns.sql` | none |
| `storage:avatars` | - | read/write | 프로필 이미지 업로드와 공개 읽기에 사용한다. | owner or public bucket policy depending on bucket | `supabase/migrations/20260520121200_storage_buckets.sql` | none |

## 현재 구현 상태

- profiles.bio migration이 최신 기준이다.

## 코드 구현 근거

- `ProfilePage` - `src/app/(workspace)/profile/page.tsx`
- `ProfileForm`, `handleFinish`, `handleAvatarSelect` - `src/components/profile/ProfileForm.tsx`
- `uploadAvatar` - `src/components/profile/avatar-upload.ts`
- `useUpdateProfile`, `updateProfile` - `src/lib/settings/mutations.ts`
- `getProfileSettings` - `src/lib/settings/server.ts`

## 미구현/불일치

- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.

## 추가 발견 후보

- 코드 구현 근거와 DB/source inventory가 바뀌면 구현 상태 문구를 갱신한다.
- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 `docs/Wireframe/data-usage-index.md`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 `docs/ia.md`와 화면 기능명세의 audience와 맞는다.
