# X-12 인증 메일 확인 안내 화면 데이터 계약

## 화면 요약
회원가입 후 사용자가 이메일 인증을 완료하도록 안내하고 재발송 흐름을 제공하는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |

소스 우선순위는 description.md, functional-spec.md, browser-screenshot.png(있는 경우) 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 인증 메일 발송 안내
- 이메일 주소 요약
- 재발송 CTA
- 로그인으로 이동
- 인증 완료 안내

## 사용자 입력/상태 데이터
- 재발송 선택
- 로그인 이동
- 인증 완료 후 callback

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 이메일 인증 흐름 | DB 계약 없음 | 인증 메일, token, confirm 처리는 Supabase Auth 내부 흐름이다. | public schema에 인증 token을 저장하지 않는다. |
| 가입 후 프로필 생성 | 현재 스키마로 충족 | Auth 사용자 생성 뒤 handle_new_user가 profiles row를 만든다. | 인증 완료 여부 자체는 Auth 상태다. |
| 인증 재발송 이력 | 스키마 보강 필요 | 재발송 횟수와 사용자 안내 이력을 public schema에 저장하는 구조는 없다. | 보안/운영 정책이 생기면 별도 계약이 필요하다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| rpc:public.handle_new_user | 가입 후 프로필 생성 | 20260521120000_auth_user_profile_bootstrap.sql, 20260602120000_handle_new_user_display_name.sql: auth.users 생성 뒤 public.profiles row를 만든다. |
| profiles | 프로필 상태 보조 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
가입 후 화면은 인증 안내를 보여준다. 재발송은 Supabase Auth 메일 재발송 흐름을 호출하고, 인증 완료 callback은 세션 설정 뒤 앱 진입으로 이어진다.

## RLS/권한 기준
- 인증 전에는 사용자 소유 public schema 접근을 최소화한다.
- profiles row 생성은 Auth trigger가 수행한다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
인증 토큰과 메일 상태는 DB 계약 없음이다. 재발송 ledger는 스키마 보강 필요다.

## 검수 필요 항목
- 재발송 제한과 메시지 기준을 정한다.
- 인증 완료 뒤 이동 경로를 Auth callback 화면과 맞춘다.
