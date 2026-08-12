# topik-ai 알림 migration 실행 순서 handoff

| 항목 | 내용 |
| --- | --- |
| 상태 | 실행 대기 handoff |
| 주 owner | topik-ai DB·migration 운영 |
| 협업 owner | v13 데이터 계약·로컬 개발 환경 |
| 영향 범위 | 알림 관리자 원본, dispatcher·email pipeline, v13 단독 DB 재생 |
| 원격 적용 | 이 문서에서는 실행하지 않음 |

## 결론

v13의 migration 체인은 `20260612180000_notification_dispatcher.sql`에서 `public.notification_templates`를 정적으로 참조하지만, 해당 테이블은 topik-ai의 별도 migration인 `supabase/migrations-admin/20260612170000_notification_admin_tables.sql`이 소유하고 생성한다. 두 저장소를 합치는 실행 순서가 v13의 단독 `db reset`에 존재하지 않아 빈 DB 재생이 함수 생성 단계에서 중단된다.

이 문제를 v13에 관리자 테이블을 복제하는 방식으로 해결하면 안 된다. 관리자 알림 원본의 소유권은 topik-ai에 유지하고, topik-ai가 없는 v13 단독 재생과 두 저장소가 결합된 공유 DB 재생을 모두 명시적으로 지원해야 한다.

## 확인된 근거

- v13 `supabase/migrations/20260612180000_notification_dispatcher.sql`은 다음과 같이 테이블 존재가 필요한 정적 타입과 쿼리를 사용한다.
  - `public.notification_templates%rowtype`
  - `from public.notification_templates`
- 같은 정적 의존성은 다음 후속 migration에도 이어진다.
  - `20260612190000_notification_email_pipeline.sql`
  - `20260612190200_email_live_defer.sql`
  - `20260612200100_marketing_consent_in_dispatch.sql`
- v13 migration 폴더에는 `notification_templates`를 생성하는 migration이 없다.
- 실제 테이블 생성 정본은 topik-ai의 `supabase/migrations-admin/20260612170000_notification_admin_tables.sql`이다. 이 migration은 `notification_templates`, `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`를 생성하고 RLS를 설정한다.
- topik-ai의 migration 소유권 검사도 위 네 테이블을 topik-ai 관리자 소유 객체로 분류한다.

## 사용자·개발 영향

- 이미 관리자 migration이 적용된 공유 DB에서는 즉시 사용자 장애가 없을 수 있다.
- v13 저장소만으로 빈 로컬 DB를 만들면 migration이 중단되므로 이후 migration, 테스트 데이터와 RPC를 준비할 수 없다.
- 그 결과 쓰기 제출 완료 상태와 PDF 결과 계측처럼 뒤에 추가된 migration을 로컬 DB에서 실행 검증할 수 없다.
- 신규 환경이나 복구 환경이 같은 순서로 구성되면 뒤쪽 DB 기능 전체가 누락될 수 있으므로 배포·복구 위험은 높다.
- 운영 DB에 관리자 원본 테이블이 실제로 없는지는 별도 catalog 확인 전까지 미확인이다.

## 권장 수정 방향

1. topik-ai가 관리자 테이블뿐 아니라 해당 테이블에 강하게 의존하는 dispatcher·email pipeline의 최종 migration home도 소유하도록 정리한다.
2. 이미 적용된 운영 이력을 훼손하지 않는 forward migration으로 topik-ai 쪽 함수·cron·권한의 최종 상태를 재선언한다.
3. v13의 과거 dispatcher 계열 migration은 빈 DB에서 관리자 객체가 없을 때 안전하게 건너뛰도록 replay 호환 처리를 한다. 단순 `to_regclass` 확인만 추가하고 함수 본문에 정적 `%rowtype` 참조를 남기면 생성 시점 오류가 계속될 수 있으므로, 전체 DDL을 조건부 실행하거나 해당 DDL의 migration home을 완전히 이전해야 한다.
4. v13에는 `notification_templates` 등의 관리자 테이블을 생성하는 호환용 복제 migration을 추가하지 않는다.
5. 공유 환경의 실행 순서를 다음처럼 문서와 자동화로 고정한다.
   - v13 사용자 알림 기반 객체
   - topik-ai 관리자 알림 테이블
   - topik-ai dispatcher·email pipeline
   - 양 앱의 후속 참조 migration
6. 기존 환경에서는 객체를 삭제하거나 데이터를 재시드하지 않고, 정의·권한·RLS 차이만 멱등적으로 수렴시킨다.

## 완료 조건

- v13 단독 로컬 `supabase db reset`이 관리자 테이블을 만들지 않고 끝까지 성공한다.
- topik-ai 관리자 migration을 포함한 통합 재생에서도 모든 알림 테이블과 dispatcher 함수가 정상 생성된다.
- 다음 객체의 owner, RLS, role별 권한이 계약과 일치한다.
  - `notification_templates`
  - `notification_groups`
  - `notification_dispatches`
  - `notification_delivery_attempts`
- 스케줄 알림, 관리자 테스트 발송, 이벤트형 `feedback_ready`, email defer 경로가 중복 발송 없이 동작한다.
- v13 사용자 알림 조회·읽음 처리에는 회귀가 없다.
- 이미 적용된 dev·production 데이터가 삭제되거나 재시드되지 않는다.
- v13과 topik-ai의 migration 소유권 검사 및 관련 단위·통합 테스트가 모두 통과한다.

## topik-ai handback에 포함할 증거

- 적용한 topik-ai·v13 PR과 최종 commit SHA
- 최종 migration 실행 순서와 각 migration의 소유 저장소
- 빈 DB 단독 재생과 통합 재생 명령·결과
- 네 관리자 테이블과 dispatcher 함수의 존재·owner·RLS·grant 확인 결과
- 기존 데이터 건수 전후 비교와 비파괴 확인 결과
- 적용 환경 목록과 미적용 환경 목록
- 실패 시 롤백이 아닌 roll-forward 복구 절차

## v13 경계

v13은 사용자 알림 표시와 사용자 소유 설정·기록의 안전한 처리를 담당한다. 관리자 템플릿·그룹·발송 운영 화면과 관리자 원본 테이블을 새로 소유하지 않으며, 이 handoff 작업 중 v13에서 원격 Supabase schema/data apply를 실행하지 않는다.
