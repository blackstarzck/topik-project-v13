# X-16 새 비밀번호 설정 화면 데이터 계약

## 화면 요약
비밀번호 재설정 링크로 들어온 사용자가 새 비밀번호를 저장하는 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |

소스 우선순위는 description.md, functional-spec.md, browser-screenshot.png(있는 경우) 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 새 비밀번호 입력
- 비밀번호 확인
- 강도/조건 안내
- 저장 완료 메시지
- 로그인 이동

## 사용자 입력/상태 데이터
- 새 비밀번호
- 비밀번호 확인
- recovery session
- 저장 액션

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 새 비밀번호 저장 | DB 계약 없음 | 비밀번호 변경은 Supabase Auth updateUser 흐름이며 public schema 테이블에 저장하지 않는다. | recovery session이 있을 때만 수행한다. |
| 비밀번호 조건 문구 | 스키마 보강 필요 | 비밀번호 정책 문구를 운영 데이터로 관리하는 구조는 없다. | Auth 설정과 앱 validation 문구를 맞춰야 한다. |

## Supabase 테이블 스키마 정보
현재 public schema migration에서 이 화면 전용 테이블/RPC/storage 계약은 없다. Supabase Auth 또는 정적 콘텐츠 흐름은 앱 DB 계약과 분리한다.

## 저장/조회/이벤트 흐름
Auth recovery session을 가진 사용자가 새 비밀번호를 입력하면 Supabase Auth updateUser를 호출한다. 성공 뒤 로그인 화면으로 이동한다.

## RLS/권한 기준
- 비밀번호 값은 public schema에 저장하지 않는다.
- 세션 검증은 Supabase Auth가 처리한다.

## 스키마 정합성 메모
이 화면은 DB 계약 없음이다. 비밀번호 정책 문구 운영화는 스키마 보강 필요다.

## 검수 필요 항목
- 비밀번호 조건과 Auth 설정을 맞춘다.
- 만료된 recovery session의 오류 문구를 표준화한다.
