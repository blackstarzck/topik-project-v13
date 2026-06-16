# A-03 학습 목표 설정 기능명세

## 화면 목적

첫 사용자가 TOPIK 목표와 학습 조건을 저장하게 한다.

## 사용자와 권한

- Audience: user
- 권한 기준: 로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.

## 진입/이탈 흐름

- Route: `/onboarding/learning-goal`
- Route type: page
- 기준 흐름: `docs/flow/user-flow.md`의 IA 순서를 따른다.
- 진입 경로: A-01 회원가입 완료 또는 소셜 가입 완료 후 온보딩 단계로 진입한다.
- 이탈 경로: 다음 단계 또는 건너뛰기 CTA로 B-01 홈 대시보드로 이동한다.
- 화면 내부 동작: 목표 시험, 학습 목적, 약점, 선호 학습량을 선택하고 저장한다.

## 주요 기능

- TOPIK 수준 선택
- 목표 급수/시험일 입력
- 주간 목표 설정
- 취약 영역 선택

## 상태/오류

- 목표 미입력, 잘못된 날짜, 저장 실패

## 데이터 사용

- 아래 표는 현재 문서화된 DB/스토리지/RPC 사용 근거다.

### DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
| `learning_goals` | `user_id`, `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas`, `is_active` | read/write | 온보딩 학습 목표를 저장하고 이후 대시보드 추천에 연결한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/lib/learning/mutations.ts`<br>`src/lib/learning/queries.ts`<br>`src/lib/learning/server.ts`<br>`supabase/migrations/20260520120100_profiles_goals.sql` | none |
| `profiles` | `id`, `ui_locale`, `status` | read | 사용자 기본 설정과 onboarding 상태 판단에 사용한다. | authenticated user; auth.uid() owner RLS where user-owned | `src/app/(workspace)/profile/page.tsx`<br>`src/lib/auth/profile.ts`<br>`src/lib/settings/mutations.ts` | none |

## 현재 구현 상태

- learning_goals 저장 흐름은 구현 기준이며 대시보드 반영까지 함께 검증해야 한다.

## 코드 구현 근거

- `LearningGoalPage` - `src/app/(workspace)/onboarding/learning-goal/page.tsx`
- `LearningGoalForm` - `src/components/learning/LearningGoalForm.tsx`
- `OnboardingSteps` - `src/app/(workspace)/onboarding/learning-goal/OnboardingSteps.tsx`
- `OnboardingNavCta` - `src/app/(workspace)/onboarding/learning-goal/OnboardingNavCta.tsx`
- `useSaveLearningGoal`, `saveLearningGoal` - `src/lib/learning/mutations.ts`
- `getLearningGoal` - `src/lib/learning/server.ts`

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
