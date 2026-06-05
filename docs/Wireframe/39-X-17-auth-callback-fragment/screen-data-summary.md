# X-17 인증 콜백 fragment 처리 화면 데이터 계약

## 화면 요약
Auth callback URL의 fragment token을 세션으로 바꾸고 다음 화면으로 보내는 처리 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 처리 중 상태
- 성공 후 이동 안내
- 오류 메시지
- 다시 로그인 CTA

## 사용자 입력/상태 데이터
- access token fragment
- refresh token fragment
- next redirect
- error reason

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| fragment token 세션 설정 | DB 계약 없음 | access/refresh token 처리는 Supabase Auth setSession 흐름이며 public schema에 저장하지 않는다. | URL fragment는 처리 뒤 제거한다. |
| callback 오류 문구 | 스키마 보강 필요 | callback reason별 문구와 redirect 정책을 운영 데이터로 관리하는 구조는 없다. | 현재는 앱 라우팅 계약이다. |

## Supabase 테이블 스키마 정보
현재 public schema migration에서 이 화면 전용 테이블/RPC/storage 계약은 없다. Supabase Auth 또는 정적 콘텐츠 흐름은 앱 DB 계약과 분리한다.

## 저장/조회/이벤트 흐름
화면은 URL fragment를 읽어 Auth 세션을 설정한다. 성공하면 next 경로로 이동하고 실패하면 인증 오류 화면으로 이동한다.

## RLS/권한 기준
- public schema 테이블 접근이 없다.
- 세션 설정 뒤 필요한 화면에서 각 테이블 RLS가 적용된다.

## 스키마 정합성 메모
콜백 token은 DB에 저장하지 않는다. 오류 문구와 redirect 정책 운영화는 스키마 보강 필요다.

## 검수 필요 항목
- fragment 제거 timing을 정한다.
- next redirect allowlist 기준을 정한다.
