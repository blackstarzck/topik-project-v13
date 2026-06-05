# A-02 로그인 화면 데이터 계약

## 화면 요약
기존 학습자가 이메일 또는 소셜 provider로 세션을 만들고 workspace로 진입하는 화면이다.

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
- 로그인 안내 문구
- 이메일/비밀번호 입력 라벨
- 소셜 로그인 버튼
- 비밀번호 재설정 링크
- 인증/권한 오류 메시지

## 사용자 입력/상태 데이터
- 이메일
- 비밀번호
- 소셜 provider 선택
- 자동 로그인 또는 세션 유지 상태

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 로그인 세션 생성 | DB 계약 없음 | 세션 생성은 Supabase Auth signIn 흐름이다. public schema 테이블로 직접 저장하지 않는다. | Auth 오류 reason은 클라이언트 상태로 처리한다. |
| 로그인 후 사용자 상태 | 현재 스키마로 충족 | profiles.status, profiles.plan_label, profiles.app_role, ui_locale로 진입 분기와 표시 상태를 보조할 수 있다. | 사용자용 앱은 learner 화면만 소비한다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| profiles | 로그인 후 사용자 상태와 화면 분기 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
사용자가 로그인 정보를 제출하면 Supabase Auth가 세션을 만든다. 세션 생성 뒤 profiles를 읽어 상태와 기본 locale을 확인하고 대시보드로 이동한다.

## RLS/권한 기준
- profiles는 본인 row만 읽을 수 있다.
- 비밀번호는 Auth 내부 값이며 public schema RLS 대상이 아니다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
로그인 화면은 public schema에 인증 시도 이력을 남기는 구조가 없다. 보안 감사나 로그인 ledger가 필요하면 스키마 보강 필요다.

## 검수 필요 항목
- 차단/삭제 계정의 사용자 문구를 profiles.status와 어떻게 연결할지 정한다.
- 소셜 provider별 오류 문구 저장 위치를 정한다.
