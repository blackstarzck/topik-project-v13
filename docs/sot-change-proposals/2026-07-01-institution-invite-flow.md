# 기관 소속 초대 흐름 구현 제안

작성일: 2026-07-01

상태: 구현 brief

## 제안 요약

`?aff=CODE` 기관 초대 링크로 들어온 사용자를 `/auth/institution-invite`로 모아 처리한다.

- 비로그인 사용자는 비회원으로 단정하지 않고 "미확인 사용자"로 본다. 새 계정 가입과 기존 계정 로그인을 모두 선택할 수 있어야 한다.
- 신규 이메일 가입자는 저장된 `aff` 코드를 `auth.signUp.options.data.affiliation_code`로 전달해 기관 소속으로 시작한다.
- 기존 로그인 회원은 초대 화면에서 `이 계정으로 기관에 연결`을 명시적으로 선택한 경우에만 `profiles.affiliation_code`를 채운다.
- 이미 다른 기관 코드가 있는 계정은 자동 전환하지 않는다. v13 MVP에서는 전환 UX를 만들지 않고 안내 상태로 멈춘다.
- Google OAuth는 신규/기존 계정 판별이 불확실하므로 자동 연결하지 않고 로그인 완료 뒤 초대 확인 화면을 거친다.
- 2026-06-29 writing visibility 정책 이후 `profiles.affiliation_code`는 문제 노출 범위에 영향을 준다. 따라서 v13에서 코드를 수락하는 행위는 단순 표시 속성이 아니라 콘텐츠 접근 상태 변경이다.

## 범위

- 사용자 앱(v13): 초대 코드 저장, 초대 수락/거절 UX, 로그인/가입 redirect 보존, `profiles.affiliation_code` one-shot 등록.
- Supabase: `public.accept_affiliation_invite(p_code text, p_confirmed boolean)` RPC 추가. `p_confirmed = true`일 때만 업데이트한다.
- 테스트: auth helper, login/OAuth redirect, invite 화면 상태, migration static test, Playwright e2e.

## 제외

- 기관 코드 카탈로그, 기관명 표시, 만료 검증, 관리자 승인, 감사 로그 UI, 기관 전환 self-service는 v13 범위가 아니다.
- admin table/RPC를 v13에 새로 만들지 않는다.
- 기존 `public.claim_affiliation_code(p_code)`는 즉시 제거하지 않고 호환/deprecated 경로로 유지한다.

## 신뢰 모델과 제한

- v13 MVP는 기관 코드를 opaque string으로 취급한다. 코드 존재, 기관명, 만료, 관리자 승인 여부는 검증하지 않는다.
- 이 때문에 초대 링크를 받은 사용자가 형식상 유효한 코드를 수락하면 `profiles.affiliation_code`가 설정되고, 최신 writing visibility 정책에 따라 기관 배정 문제 노출이 달라질 수 있다.
- 코드 카탈로그가 admin app에 연결되기 전까지는 링크 배포 통제와 코드 추측 난이도에 의존하는 임시 신뢰 모델이다.
- 이미 다른 기관 코드가 있는 계정은 v13에서 self-switch를 허용하지 않는다. 이 제한은 임시 신뢰 모델에서 잘못된 코드 수락의 피해를 줄이기 위한 안전장치다.

## 동작 규칙

| 상황 | 동작 |
| --- | --- |
| 비로그인 사용자가 `?aff=CODE`로 진입 | 코드를 저장하고 `/auth/institution-invite`에서 새 가입/기존 로그인/초대 없이 계속 선택지를 보여준다. |
| 신규 이메일 가입 | 저장된 코드가 있으면 `options.data.affiliation_code`로 전달하고 가입 성공 뒤 저장 코드를 삭제한다. |
| Google OAuth 가입/로그인 | 로그인 완료 뒤 `/auth/institution-invite`로 돌아와 사용자가 연결 여부를 확인한다. |
| 로그인된 일반 회원 | `이 계정으로 기관에 연결` 클릭 시에만 RPC를 호출한다. |
| 이미 같은 기관 소속 | `already_affiliated_same` 상태로 보고 계속 진행할 수 있게 한다. |
| 이미 다른 기관 소속 | 자동 전환하지 않고 다른 계정 로그인 또는 연결하지 않고 계속만 제공한다. |
| 코드가 없거나 만료됨 | 가입/연결 RPC를 호출하지 않고 초대 없음 상태를 보여준다. |
| 형식이 잘못된 코드 | 저장하지 않거나 `invalid` 상태로 처리한다. 코드 존재/만료 검증은 admin catalog 연결 전까지 보류한다. |

## 검증 기준

- `aff` query가 `/`, `/login`, `/sign-up` 등 public entry로 들어와도 canonical invite route로 수렴한다.
- 로그인 경로는 password, magic link, Google OAuth 모두 `next=/auth/institution-invite`를 보존한다.
- `accept_affiliation_invite`는 `p_confirmed = true` 없이는 업데이트하지 않는다.
- 기존 소속이 다른 경우 업데이트하지 않고 `already_affiliated_other`를 반환한다.
- `claim_affiliation_code` silent claim 흐름은 새 UX에서 사용하지 않는다.
