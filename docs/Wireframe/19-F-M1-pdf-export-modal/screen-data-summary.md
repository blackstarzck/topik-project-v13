# F-M1 PDF 내보내기 모달 화면 데이터 계약

## 화면 요약
피드백, 리포트, 서재 선택 항목을 PDF로 만들 때 옵션과 생성 상태를 보여주는 모달이다.

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
- PDF 대상 요약
- 내보내기 옵션
- 생성 상태
- 다운로드 버튼
- 실패 메시지

## 사용자 입력/상태 데이터
- source_type
- source_id
- options
- 다운로드 선택
- 재시도 선택

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| PDF 생성 요청/상태 | 현재 스키마로 충족 | export_files가 source_type, source_id, options, status, storage_path, ready_at을 저장한다. | status는 queued, ready, failed다. |
| PDF 파일 저장 | 현재 스키마로 충족 | generated-exports private bucket에 PDF 파일을 저장한다. | 파일 경로는 exports/{user_id}/{export_id}.pdf 계약이다. |
| PDF 템플릿/레이아웃 | 스키마 보강 필요 | PDF 표지, 섹션 순서, 브랜딩 옵션을 운영 데이터로 관리하는 구조는 없다. | 현재 options jsonb와 파일 상태 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| export_files | PDF 생성 요청/상태 | 20260520120700_library_events_exports.sql: id, user_id, source_type, source_id, storage_path, options, status, created_at, ready_at. |
| storage:generated-exports | PDF 파일 저장 | 20260520121200_storage_buckets.sql, 20260520121300_storage_policies.sql, 20260527113000_storage_email_confirmed_hardening.sql: private bucket, PDF만 허용, 경로는 exports/{user_id}/{export_id}.pdf, 소유자 읽기/생성. |
| study_events | 다운로드 이벤트 | 20260520120700_library_events_exports.sql: id, user_id, event_type, occurred_at, problem_id, submission_id, attempt_id, session_id, payload. |

## 저장/조회/이벤트 흐름
사용자가 옵션을 선택하면 export_files row를 만들고 PDF 생성 job이 storage_path에 파일을 저장한다. ready 상태가 되면 다운로드 링크를 표시한다.

## RLS/권한 기준
- export_files는 본인 row만 접근한다.
- generated-exports는 본인 경로 PDF만 읽고 생성한다.
- 파일 생성은 이메일 인증 강화 정책을 따른다.
- export_files는 user_id = auth.uid() 기준 본인 export만 전체 작업이 가능하다.
- generated-exports 파일은 private이며 본인 경로의 PDF만 읽고 만들 수 있다.
- study_events는 본인 select/insert가 가능하다.

## 스키마 정합성 메모
PDF 요청과 파일 저장은 현재 스키마로 충족된다. PDF 템플릿 운영 구조는 스키마 보강 필요다.

## 검수 필요 항목
- options JSON의 허용 key를 정한다.
- PDF 생성 실패 후 재시도 시 같은 export row를 재사용할지 정한다.
