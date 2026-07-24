# topik-ai PDF 요청 식별자 전환 handoff

| 항목 | 값 |
| --- | --- |
| 상태 | 실행 대기 |
| 주 owner | topik-ai DB·배포 운영 |
| 협조 owner | TALKPIK AI v13 |
| 대상 | `20260724140000_pdf_export_request_idempotency.sql`과 같은 버전의 v13 앱 |
| 원격 적용 | v13 작업면에서 금지 |

## 목적

기존 PDF 생성 흐름에는 안정적인 요청 번호와 처리 lease가 없었다. 새 migration과 앱은 사용자 JWT로 요청을 획득하고 같은 요청 번호로 quota를 묶는다. 구 앱과 신 앱이 동시에 PDF를 쓰는 동안에는 두 계약이 호환되지 않으므로, PDF 요청을 잠시 멈춘 한 전환 창에서 migration과 앱을 함께 바꾼다.

## migration의 기존 데이터 처리

- `request_id is null and status = 'queued'`인 기존 export는 `failed`, `failure_code = 'legacy_unknown'`으로 종료한다. 원본 오류·답안·provider 응답은 기록하지 않는다.
- 요청 식별자 도입 전의 `reserved` quota는 `released`, `release_reason = 'request_identity_cutover'`로 해제한 뒤 과거 행 구분용 UUID를 채운다. 따라서 전환 때문에 사용자의 quota가 계속 잠기지 않는다.
- 기존 `ready`와 `committed` 기록은 과거 결과로 보존한다. 과거 UUID는 새 사용자 요청의 재시도 키로 사용하지 않는다.

## 필수 전환 순서

1. 새 PDF 요청을 maintenance 상태로 전환한다. 최소 대상은 `/api/export/pdf`, `/api/export/pdf/print`와 PDF background worker다. 다른 학습 기능은 별도 영향 검토 후 유지할 수 있다.
2. 구 버전 worker가 새 작업을 받지 않는지 확인하고 현재 PDF 작업이 끝날 때까지 기다린다. 적용 직전 `export_files.status = 'queued'` 수와 15분 미만 `pdf_export_quota_usages.status = 'reserved'` 수를 기록한다.
3. 남은 작업이 0인지 확인한다. 업무상 기다릴 수 없는 잔여 작업은 migration이 `legacy_unknown`/`request_identity_cutover`로 안전 종료한다는 사실을 운영 기록에 남긴다.
4. 승인된 backup과 대상 Supabase ref를 확인한다. secret 값은 handback이나 로그에 남기지 않는다.
5. maintenance를 유지한 채 migration `20260724140000`을 적용하고, 이어서 이 migration의 typed caller가 포함된 v13 앱을 같은 rollout window에 배포한다. 둘 사이에 PDF 요청을 다시 열지 않는다.
6. 아래 검증과 role matrix를 통과시킨다.
7. 새 JWT 획득→quota claim→service-only terminal 처리 smoke를 한 건 실행하고 ledger·quota를 대사한 뒤 PDF 요청을 재개한다.

## 적용 후 검증

다음 조건은 모두 0건이어야 한다.

```sql
select count(*)
from public.export_files
where status = 'queued'
  and request_id is null;

select count(*)
from public.pdf_export_quota_usages
where request_id is null;

select count(*)
from public.pdf_export_quota_usages
where status = 'reserved'
  and release_reason = 'request_identity_cutover';
```

추가로 확인한다.

- legacy queued 표본은 `failed`, `legacy_unknown`, `failed_at not null`, `ready_at is null`, `lease_expires_at is null`이다.
- legacy reserved 표본은 `released`, `request_identity_cutover`, `released_at not null`이다.
- authenticated는 `acquire_pdf_export_attempt`와 `claim_pdf_export_quota`만 실행할 수 있고 `export_files` 직접 INSERT·UPDATE·DELETE 및 terminal RPC는 실행할 수 없다.
- service role은 acquire를 실행할 수 없다. current attempt의 complete/fail과 ready 응답 재전송·실패 정리에서 필요한 멱등 commit/release만 실행할 수 있다.
- 새 claim은 같은 사용자·요청 번호의 `queued | ready` export가 없거나, 획득한 원본에서 다시 계산한 문제 집합과 정렬·중복 제거된 1~6개 입력이 정확히 같지 않거나, 원본 항목이 사라졌으면 quota row를 만들지 않는다.

## 실패 시 처리

- migration 또는 앱 배포 중 하나라도 실패하면 PDF maintenance를 유지한다.
- migration이 적용된 DB에 구 writer를 다시 연결하지 않는다. DB down migration이나 권한 완화로 되돌리지 않고, 신 앱 수정 또는 호환 forward migration으로 복구한다.
- `legacy_unknown` export와 `request_identity_cutover` release는 삭제하지 않는다. 운영 대사와 사용자 문의의 비민감 증거로 보존한다.

## 무중단이 필요한 경우

현재 변경은 maintenance를 전제로 한 단일 cutover다. 무중단이 필수라면 원격 승인 전에 두 단계 migration으로 다시 설계한다.

1. additive 단계에서 nullable request/attempt 필드와 호환 RPC를 먼저 배포하고, 구·신 앱이 함께 동작하는 동안 새 앱의 요청 식별자 기록률을 관찰한다.
2. 구 앱과 legacy worker가 완전히 drain된 뒤 enforcement 단계에서 legacy 예약 정리, NOT NULL·unique 계약, direct DML 회수와 terminal role 분리를 적용한다.

현재 단일 migration을 부분 적용하거나 두 단계처럼 취급하지 않는다.

## topik-ai handback

- 적용한 project ref, migration version/hash와 앱 배포 version
- maintenance 시작·종료 시각과 구 worker drain 결과
- 적용 전 queued/reserved 수, migration이 종료·해제한 수, 적용 후 검증 쿼리 결과
- authenticated/service role matrix와 신규 smoke 결과
- backup 확인, 실패·복구 여부와 남은 운영 위험
