# 회원가입 선택 정보 수집 변경 제안

작성일: 2026-07-09

상태: 구현 동반 제안. active SOT 직접 수정 없이, 사용자 앱의 회원가입/인증 완료 흐름에서 선택 입력으로 수집하는 데이터 계약을 기록한다.

## 요약

회원가입 시 성별과 전화번호를 선택 입력으로 받을 수 있게 한다.

- 성별과 전화번호는 필수값이 아니다.
- 이메일 가입은 `/sign-up`에서 입력한 값을 Supabase Auth metadata로 전달하고, `handle_new_user()`가 `profiles`에 저장한다.
- Google OAuth와 매직링크 가입은 기존 `/auth/consent` 게이트가 열리는 경우에만 같은 선택 필드를 표시하고 저장한다.
- 선택 필드 누락만으로 `/auth/consent`에 강제 진입시키지 않는다.
- Google People API 또는 추가 Google OAuth scope는 사용하지 않는다.

## 데이터 계약

`profiles`에 아래 nullable 컬럼을 추가한다.

| column | type | nullable | validation |
| --- | --- | --- | --- |
| `gender` | `text` | yes | `male`, `female` 중 하나 또는 `null` |
| `phone_country_code` | `text` | yes | ISO 3166-1 alpha-2 국가 코드 또는 `null`. 예: `KR` |
| `phone_number` | `text` | yes | 국가번호를 제외한 로컬 번호 숫자만 저장 또는 `null`. 예: `1012345678` |

전화번호는 사용자가 입력한 자기 신고 값이다. Google 계정의 전화번호를 자동 조회하지 않는다.
전화번호를 저장할 때는 국가 코드와 로컬 번호를 분리한다.

## 화면 영향

| 화면 | 변경 |
| --- | --- |
| `/sign-up` | 기존 단계형 필수 입력 흐름을 유지하고, 비밀번호 확인까지 유효해져 약관 단계가 열릴 때 성별 select와 전화번호 input을 함께 표시한다. 둘 다 선택 입력이며 다음 단계 노출 조건이 아니다. |
| `/auth/consent` | 필수 프로필/필수 약관 완료 게이트가 열렸을 때 선택 정보 섹션을 함께 표시한다. 선택값이 비어 있어도 계속할 수 있다. |
| `/profile` | 사용자가 선택 입력한 전화 국가 코드와 로컬 번호를 수정하거나 비울 수 있다. |

## 갱신이 필요한 active SOT

아래 문서는 별도 SOT 확정 절차에서 갱신이 필요하다.

- `docs/Wireframe/data-usage-index.md`: `profiles.gender`, `profiles.phone_country_code`, `profiles.phone_number` 사용처와 수집 경로 추가.
- 회원가입 관련 Wireframe 기능명세: `/sign-up`과 `/auth/consent` 선택 입력 표시 규칙 추가.
- 개인정보 처리 관련 문서: 전화번호와 성별이 선택 수집 항목임을 반영.

## 범위 밖

- Google People API 연동.
- Google OAuth scope에 `user.gender.read`, `user.phonenumbers.read` 추가.
- 기존 사용자에게 선택값 입력을 강제하는 리마인더 또는 게이트.

## 결정 기록 (2026-07-10 accepted)

- 사용자 승인으로 이 제안의 "갱신이 필요한 active SOT"를 직접 반영했다. 갱신 문서: `docs/Wireframe/data-usage-index.md`(A-01/X-05/X-18 profiles에 `gender`/`phone_country_code`/`phone_number` 역색인), `docs/Wireframe/01-A-01-sign-up/functional-spec.md`, `docs/Wireframe/40-X-18-auth-consent/functional-spec.md`.
- 근거: 제안 기능은 이미 shipped(migration `20260709153000`/`20260709165000`, `SignUpForm.tsx`, `consent/actions.ts`)되어 있었고, 편집은 새 동작 도입이 아니라 구현·검증된 동작을 SOT에 정합화하는 reconciliation이다(각 화면 수용기준의 data-usage-index 역색인 요구 준수).
- 성별 편집/리마인더는 [[2026-07-09-phone-number-profile-reminder]]가 전화번호 한정으로 supersede했으므로 X-05 편집에서 성별을 제외했다(범위 유지).
