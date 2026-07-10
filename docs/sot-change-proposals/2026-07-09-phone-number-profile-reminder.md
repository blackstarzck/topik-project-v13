# 전화번호 프로필 보완 안내 및 편집 변경 제안

작성일: 2026-07-09

상태: 구현 동반 제안. active SOT 직접 수정 없이, 회원가입에 추가된 전화번호를 기존/신규 사용자가 프로필 화면에서 보완할 수 있게 하고, 전화번호가 없는 사용자에게 비차단 안내 배너를 제공하는 데이터/UI 계약을 기록한다.

## 배경

`2026-07-09-optional-profile-gender-phone.md`(구현 완료, migration `20260709153000_profiles_optional_gender_phone.sql`)로 회원가입과 `/auth/consent`에서 전화번호를 **선택 입력**으로 수집할 수 있게 되었다. 그러나 그 제안의 "범위 밖"에는 아래 두 항목이 명시되어 있었다.

- 프로필 설정 화면에서 성별/전화번호를 수정하는 기능
- 기존 사용자에게 선택값 입력을 강제하는 리마인더 또는 게이트

이번 요청은 위 두 항목 중 **전화번호에 한해** 다음을 새 범위로 연다. 즉 이 문서는 이전 제안의 "범위 밖" 경계를 전화번호 범위에서 **supersede**한다. 성별(`gender`)은 이번 범위에 포함하지 않는다.

## 요약

- 전화번호는 계속 **선택 입력**이며 서비스 이용 필수값이 아니다. 저장하지 않아도 모든 기존 route 접근이 유지된다.
- `/profile` 편집 화면에서 전화번호를 조회/수정/삭제할 수 있게 한다.
- 전화번호가 없는 사용자에게 workspace 공통 shell에서 **안내 모달**을 띄운다. 대시보드뿐 아니라 어느 페이지로 직접 URL 진입해도 노출되며(브라우저 세션당 1회), `/profile`로 이동하는 CTA와 "다시 보지 않기"를 제공한다.
- "다시 보지 않기"는 **영구(계정 단위) dismiss**다. 값은 `profiles.phone_number_prompt_dismissed_at`에 기록되어 계정/기기 간 유지된다. 사용자가 이후 전화번호를 삭제해도 모달을 다시 띄우지 않는다.
- `/auth/post-auth`, `/auth/consent`, required profile completion 판정은 변경하지 않는다. 전화번호 누락만으로 `/auth/consent`에 강제 진입시키지 않는다.
- Google/매직링크 신규 가입 흐름은 기존과 동일하다(필수 약관/필수 프로필 누락 시에만 consent 게이트 진입).

## 데이터 계약

`profiles`에 아래 nullable 컬럼을 추가한다.

| column | type | nullable | 의미 |
| --- | --- | --- | --- |
| `phone_number_prompt_dismissed_at` | `timestamptz` | yes | 전화번호 보완 안내 배너를 "다시 보지 않기"로 닫은 시각. `null`이면 아직 닫지 않음. |

- 기존 `profiles.phone_country_code`(ISO 국가 코드 또는 `null`)와 `profiles.phone_number`(국가번호를 제외한 로컬 번호 숫자만 저장 또는 `null`, migration `20260709153000` + `20260709165000`)를 그대로 사용한다.
- 신규 프로필은 `handle_new_user()`에서 이 컬럼을 세팅하지 않으므로 자동 `null`로 초기화된다. **기존 사용자 backfill 불필요**(default null이 "아직 닫지 않음"과 동일).
- 컬럼 갱신은 owner self-update로만 이뤄진다. `profiles_self_update` RLS(`id = auth.uid()`)와 `private.protect_profile_columns()` 트리거(보호 대상은 `app_role`/`plan_label`/`status`뿐)에 의해 자연히 소유자만 갱신할 수 있으며, RLS/트리거 변경이 필요 없다.

## 화면 영향

| 화면 | 변경 |
| --- | --- |
| `/profile` (X-05) | 기존 프로필 편집 폼에 전화번호 입력을 추가한다. 기존 값이 있으면 표시하고, 빈 값 저장은 `phone_country_code = null`, `phone_number = null`(삭제), 값이 있으면 국가 코드는 `KR` 같은 ISO 코드로, 번호는 국가번호를 제외한 숫자만 저장할 수 있다(형식 오류 시 저장 차단 + 안내). `/auth/consent`와 같은 저장 정책을 사용한다. |
| workspace 공통 shell | 전화번호가 없고(`phone_number` 비어 있음) 아직 영구 dismiss하지 않았을(`phone_number_prompt_dismissed_at` 비어 있음) 때, 워크스페이스 어느 라우트로 진입하든(직접 URL 포함) 안내 모달을 띄운다. 단 몰입/입력 집중 화면인 작성 시험(51~54), 온보딩(`/onboarding/learning-goal`), 프로필 편집(`/profile`)에서는 띄우지 않는다. 브라우저 세션당 1회만 노출한다. |

## UI 계약

- 모달은 Ant Design `Modal`(`centered`)로 구현한다. footer에 "다시 보지 않기"(default)와 `/profile` 이동 CTA(primary) 버튼을 둔다.
- 노출 빈도: 브라우저 세션당 1회. 모달을 닫으면(X/Esc/배경(mask) 클릭) 그 세션 동안은 다시 뜨지 않도록 `sessionStorage`로 세션 suppress하며, 새 세션에서는 다시 노출한다. 배경 클릭 닫힘(`maskClosable` 기본값 true)도 X/Esc와 동일하게 세션 suppress로 처리한다.
- "다시 보지 않기" 성공 시 모달을 즉시 닫고 시각을 영구 저장한다(`phone_number_prompt_dismissed_at`). 실패 시 모달을 유지하고 짧은 오류 메시지를 노출하며 재시도할 수 있게 한다(로컬 state 기반, 별도 큐/백오프 없음).
- 인라인 스타일 금지 규칙을 지키고 레이아웃 보정은 Tailwind `className`으로만 한다.

## 알려진 한계

- 모달 노출 판정의 기준 데이터(`phone_number`, `phone_number_prompt_dismissed_at`)는 workspace layout의 서버 렌더 prop으로 전달된다. 같은 세션에서 `/profile`에 전화번호를 저장한 직후에는 다음 네비게이션(layout 재실행) 시점에 반영된다(그 전에는 세션 suppress로 이미 안 뜬다). 저장 즉시 optimistic 반영은 이번 범위 밖으로 둔다.
- dismiss 후 재발견 경로는 프로필 드롭다운 메뉴(→ `/profile`)로 보장된다.

## 갱신이 필요한 active SOT

아래 문서는 별도 SOT 확정 절차에서 갱신이 필요하다(이 제안은 직접 수정하지 않는다).

- `docs/Wireframe/data-usage-index.md`: `profiles.phone_number_prompt_dismissed_at` 사용처 추가.
- `/profile`(X-05) 관련 Wireframe 기능명세: 전화번호 편집 필드와 workspace 안내 모달 규칙 추가.
- 개인정보 처리 관련 문서: 전화번호가 선택 수집 항목이며 미입력 사용자에게 비차단 안내를 노출함을 반영.

## 범위 밖

- 성별(`gender`) 편집/리마인더.
- 시간제한(예: N일) 재노출, 가입 코호트(email/Google/매직링크)별 분기.
- `/profile` 저장 직후 same-session optimistic 모달 숨김.
- 모달 노출 빈도 제어를 위한 알림 센터/대시보드 notice 통합.

## 결정 기록 (2026-07-10 accepted)

- 사용자 승인으로 이 제안의 "갱신이 필요한 active SOT"를 직접 반영했다. 갱신 문서: `docs/Wireframe/data-usage-index.md`(X-05 profiles에 `phone_country_code`/`phone_number`/`phone_number_prompt_dismissed_at` 역색인), `docs/Wireframe/27-X-05-profile-editing/functional-spec.md`(전화번호 편집 필드 + workspace 안내 모달 규칙).
- 함께 정정한 drift: `docs/Wireframe/36-X-14-privacy-policy/functional-spec.md`가 "직접 DB 사용 근거 없음"으로 단정했으나 실제 `src/app/privacy/page.tsx`는 `legal_documents`를 조회하므로 read 사용을 반영. 개인정보 fallback 문구(ko/en/vi)에 전화번호·성별 선택 수집을 명시.
- 근거: 기능은 이미 shipped(migration `20260709154000`, `ProfileForm.tsx`, `WorkspaceShell.tsx`, `PhoneNumberReminderModal.tsx`)되어 있었고 편집은 SOT 정합화 reconciliation이다.
