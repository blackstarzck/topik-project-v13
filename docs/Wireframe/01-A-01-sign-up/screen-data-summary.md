# A-01 회원가입 화면 데이터 계약

## 화면 요약
이메일 또는 소셜 계정으로 새 학습자 계정을 만들고 인증 메일 흐름으로 넘기는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |
| 3 | hifi.png | 보조 |
| 4 | wireframe.png | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 서비스 로고와 회원가입 안내
- 이메일/비밀번호 입력 라벨과 오류 메시지
- 소셜 가입 버튼
- 약관/개인정보 동의 문구
- 인증 메일 발송 안내

## 사용자 입력/상태 데이터
- 이메일
- 비밀번호
- 비밀번호 확인
- 소셜 provider 선택
- 약관 동의 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 가입 요청과 인증 메일 | DB 계약 없음 | 이메일/비밀번호와 provider 처리는 Supabase Auth 내부 흐름이다. public schema 테이블로 직접 저장하지 않는다. | Auth 설정과 메일 템플릿은 앱 DB 계약 밖이다. |
| 가입 후 기본 사용자 row | 현재 스키마로 충족 | auth.users 생성 뒤 public.handle_new_user가 profiles row를 만든다. | 표시명 초기값 보강은 20260602120000 migration 기준이다. |
| 가입 약관 문구와 동의 이력 | 스키마 보강 필요 | 화면에는 동의 문구가 있지만 정책 버전과 사용자 동의 기록을 저장하는 public schema 구조가 없다. | 정책 버전 관리가 도입되면 별도 계약이 필요하다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| rpc:public.handle_new_user | 가입 후 프로필 생성 | 20260521120000_auth_user_profile_bootstrap.sql, 20260602120000_handle_new_user_display_name.sql: auth.users 생성 뒤 public.profiles row를 만든다. |
| profiles | 가입 뒤 기본 사용자 상태 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
사용자가 가입 정보를 입력하면 Supabase Auth signUp을 호출한다. Auth가 사용자를 만들면 handle_new_user trigger가 profiles row를 만든다. 화면은 인증 메일 발송 안내로 전환한다.

## RLS/권한 기준
- profiles insert는 클라이언트가 직접 하지 않는다.
- 가입 전 사용자는 public schema의 사용자 소유 테이블에 접근하지 않는다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
회원가입 화면 자체의 비밀번호와 인증 토큰은 public schema에 저장하지 않는다. 약관 동의 이력은 현재 migration에 없으므로 스키마 보강 필요로 둔다.

## 검수 필요 항목
- 정책 동의 저장을 다음 단계 스키마에 포함할지 결정한다.
- 인증 메일 재발송과 가입 실패 reason mapping의 저장 범위를 정한다.
