# topik-ai 쓰기·PDF 운영 지표 handoff

| 항목 | 값 |
| --- | --- |
| 상태 | 실행 대기 |
| 요청 저장소 | TALKPIK AI v13 사용자 앱 |
| 실행 owner | topik-ai 운영·분석 |
| 범위 | 쓰기 제출 시도, 분석 결과, PDF 생성 결과의 관리자 집계와 조회 화면 |
| 사용자 답안·개인정보 | 집계 API와 관리자 지표에 포함하지 않음 |

## 목적

사용자 앱은 분석과 피드백까지 완료된 기록만 `제출 완료`로 계산한다. 운영자는 외부 API 실패처럼 사용자 완료 기록이 생기지 않은 요청도 놓치지 않아야 하므로 제출 시도, 분석 결과, PDF 생성 결과를 서로 다른 지표로 확인해야 한다.

## 지표 계약

| 지표 | 원천 | 계산 |
| --- | --- | --- |
| 제출 시도 | `writing_submission_intents` | 기간 내 생성된 intent ID 수 |
| 외부 처리 결과 | `writing_submission_intents` | accepted·materialized·failed·ambiguous 상태별 수 |
| 분석 완료 | `writing_submissions` + `writing_feedback` | 양쪽 status가 모두 complete인 수 |
| 분석 실패 | `writing_submissions` | feedback_status가 failed인 수 |
| 분석 성공률 | 완료·실패 종료 건 | `complete / (complete + failed)`; pending·analyzing·ambiguous 제외 |
| PDF server render 성공 | `export_files` | source가 server_render이고 status가 ready인 수 |
| PDF 기술 실패 | `export_files` | source가 server_render이고 status가 failed이며 technical failure code인 수 |
| PDF 기술 성공률 | 종료된 server render | `ready / (ready + technical_failed)` |
| PDF 정책 거절 | `export_files` | quota_exceeded 등 정책 거절 수; 기술 성공률에서 제외 |
| browser print 전달 | `export_files` | source가 browser_print이고 ready인 수; 실제 파일 저장 성공으로 해석하지 않음 |

기술 실패 코드는 `quota_claim_failed`, `item_resolution_failed`, `server_render_failed`, `storage_upload_failed`, `browser_print_prepare_failed`, `quota_commit_failed`, `export_record_failed`, `unknown`이다. `quota_exceeded`, `analysis_unavailable`, `item_unavailable`은 정책·업무 거절로 분리하며 기술 성공률 분모에서 제외한다. `legacy_unknown`은 과거 데이터이므로 별도 표시하고 새 성공률 분모에는 자동 포함하지 않는다.

## 관리자 구현 요구사항

- 기간, 문제 번호, 문항 유형, 처리 경로(server render/browser print), 정제된 실패 코드로 필터링한다.
- 제출 시도, 분석 결과, PDF 결과를 하나의 성공률로 합치지 않고 별도 카드와 추이로 표시한다.
- unresolved ambiguous와 queued를 별도 진행 중 상태로 보여 주고 종료 결과의 분모에서 제외한다.
- 사용자 답안, AI 원문, provider raw response, 원본 예외 메시지, service-role credential을 응답·로그·화면에 포함하지 않는다.
- 관리자 집계는 service-only aggregate RPC 또는 동등한 서버 전용 경로로 제공하고 일반 authenticated 사용자의 실행 권한을 회수한다.
- v13의 사용자용 `list_user_problems`를 관리자 통계 원천으로 사용하지 않는다.

## v13에서 제공하는 전제

- 제출 전 intent가 기록되고 accepted·materialized·failed·ambiguous 상태 전이가 보존된다.
- 사용자 완료 횟수와 전체 materialized submission 수가 분리된다.
- 인증되고 형식이 검증된 PDF 요청은 `export_files`에 queued로 먼저 기록된 뒤 ready 또는 failed로 종료된다.
- PDF 실패에는 허용된 failure code와 종료 시각만 저장되며 quota 실패 시 예약 사용량을 해제한다.

## topik-ai handback

- migration/집계 RPC 파일 경로와 적용 version 또는 hash
- role별 EXECUTE 권한과 사용자 A/B 격리 검증 결과
- 각 지표의 fixture별 기대값과 실제 집계 결과
- 관리자 화면의 기간·상태·문제 번호 필터 검증 결과
- dev 적용 및 read-only smoke 결과; production 적용 여부는 별도 표시
- rollback 또는 fail-close 절차와 운영 owner

v13 작업면에서는 topik-ai 관리자 화면을 만들거나 원격 Supabase schema/data apply를 실행하지 않는다.
