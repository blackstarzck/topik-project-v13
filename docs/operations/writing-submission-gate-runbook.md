# 작문 제출 게이트 운영 runbook

| 항목 | 값 |
| --- | --- |
| 상태 | 활성 운영 절차 |
| owner | v13 클라이언트 운영 (원격 DB 실행은 운영자 승인 필요) |
| 범위 | `private.writing_submission_control` 게이트의 상태 확인, 재개(활성화), 비상 차단 |
| 마지막 검토 | 2026-07-24 |
| 재검토 | outbox 계약(`20260714141000`) 또는 제출 경로 변경 때마다 |

작문 제출 경로는 fail-closed 게이트로 보호된다. 2026-07-15 canonical cutover(PR #43)는 게이트를 `blocked`로 출고했고, 재개는 이 runbook의 활성화 절차를 명시적으로 실행해야만 가능하다. 게이트는 DB 단일 행이므로 같은 DB를 보는 모든 앱(localhost 개발 서버 포함)에 동시에 적용된다.

## 게이트 구조

| 모드(submission_mode) | 계약 상태(submission_contract_state) | 의미 | 사용자 제출 |
| --- | --- | --- | :---: |
| `blocked` | `unverified` | 기본·비상 차단 | 불가 — "작문 제출을 잠시 중단했습니다" 모달 |
| `verification` | `unverified` | 서비스 전용 드릴 창 | 불가 (동일 모달) |
| `canonical` | `local_outbox_verified` | 검증 증거로 활성화된 정상 상태 | 가능 |

- 서버는 제출마다 `public.get_writing_submission_control()`을 새로 읽는다. 상태 변경은 재배포 없이 즉시 반영된다.
- `canonical` 전환은 `private.writing_submission_contract_evidence`에 등록된 증거의 `contract_digest`가 현재 `private.writing_outbox_contract_digest()` 값과 일치해야만 허용된다(트리거가 강제).
- 모든 상태 변경은 `private.writing_submission_control_audit`에 남는다. 증거 행은 불변(immutable)이다.

## 상태 확인 (읽기 전용)

Supabase 대시보드 SQL 편집기 또는 Management API(postgres 권한)에서:

```sql
select control.submission_mode, control.submission_contract_state,
       control.evidence_id, control.changed_by, control.changed_at
from private.writing_submission_control control
where control.singleton;

select * from private.writing_submission_control_audit
order by audit_id desc limit 5;

select evidence_id, contract_digest,
       contract_digest = private.writing_outbox_contract_digest() as digest_matches_current,
       verified_by, verified_at
from private.writing_submission_contract_evidence
order by verified_at desc;
```

사용자에게 "작문 제출을 잠시 중단했습니다" 모달이 보이면 이 조회가 첫 진단이다. 모드가 `canonical + local_outbox_verified`가 아니면 게이트가 원인이다.

## 재개(활성화) 절차

### 전제 조건

1. canonical 카탈로그에 문항이 있고(`public.topik_writing_question_import` promoted), 앱 배포에 채점 API 주소(`TALKPIK_API_BASE_URL`)가 설정돼 있다.
2. `private.writing_outbox_contract_digest()`가 저장소 기준값과 일치한다. 기준값은 `supabase/migrations/20260714141000_writing_submission_outbox.sql`의 상수 문자열에서 파생되며, 2026-07-23 기준 `e8d33e2e43be7c1c990b475f9f2e8390d327bb3458653a3e90095b01b445e90c`다. 불일치하면 아래 "알려진 함정"의 드리프트 사례를 먼저 확인한다.
3. 진행 중 intent가 없다: `select count(*) from private.writing_submission_intents where state in ('pending','dispatching');` = 0.

### 경로 A — 유효한 기존 증거 재사용 (권장, 계약 무변경일 때)

`digest_matches_current = true`인 증거가 이미 있으면 드릴 없이 활성화한다:

```sql
select public.set_writing_submission_state(
  'canonical', 'local_outbox_verified',
  '<actor>', '<재개 사유>', '<digest 일치 evidence_id>'
);
```

### 경로 B — 라이브 드릴 재인증 (증거가 없거나 digest가 갱신됐을 때)

1. **드릴 창 개방**: `select public.set_writing_submission_state('verification','unverified','<actor>','<사유>', null);`
2. **드릴 5종 실행**: 실제 outbox 모듈(`src/lib/writing/submission-outbox.ts`)로 아래 시나리오를 대상 DB에 실행한다. 공급자는 가짜 응답을 쓰며 실제 채점 API를 호출하지 않는다. 임시 계정으로 실행하고 종료 시 삭제한다.

   | 시나리오 | 통과 기준 (리포트 필드) |
   | --- | --- |
   | concurrentDuplicate — 동일 답안 동시 2건 | 공급자 호출 1회, 1건만 성공 (`oneFulfilled`, `providerDispatches: 1`) |
   | timeout — 공급자 타임아웃 | ambiguous 격리, 재호출 없음 (`quarantined`, `providerDispatches: 1`) |
   | deterministicFailure — 확정 실패 후 재시도 | failed 후 새 intent 재시도 성공 (`failed`, `retrySucceededWithNewIntent`, `providerDispatches: 2`) |
   | acceptedMarkerFailure — 승인 기록 유실 | ambiguous 영구 격리, 자동 재발송 차단 (`quarantined`, `providerDispatches: 1`) |
   | materializationRecovery — 구체화 응답 유실 | 재시도에서 공급자 재호출 없이 복구 (`recovered`, `providerDispatches: 1`) |

   먼저 추적된 로컬 리허설을 실행해 outbox의 중복 차단·타임아웃 격리·구체화 복구 계약을 확인한다.

   ```bash
   pnpm prepare:worktree-env --profile e2e
   pnpm test:supabase:local
   ```

   이 로컬 리허설은 대상 DB의 라이브 증거를 대신하지 않는다. 대상 DB에서 위 5종을 실행할 live runner는 별도 운영 저장소에서 코드 리뷰와 secret 점검을 마친 추적 파일이어야 한다. ignored `.codex/work/` 산출물이나 로컬 절대 경로에서 credential을 읽는 도구는 사용하지 않는다. 승인된 live runner가 없으면 경로 B를 중단하고 게이트를 `blocked`로 유지한다.
3. **증거 등록**: 검증 리포트(JSON — `contract: "writing-outbox-v2"`, `schemaVersion: "2"`, `contractDigest`, 위 5개 시나리오 결과, `cleanup: "complete"`)를 등록한다. 형식이 정확하지 않으면 DB가 거부한다.

   ```sql
   select public.record_writing_submission_contract_evidence(
     '<evidence-id>',
     jsonb_build_object(
       'contract', 'writing-outbox-v2',
       'schemaVersion', '2',
       'contractDigest', 'e8d33e2e43be7c1c990b475f9f2e8390d327bb3458653a3e90095b01b445e90c',
       'cleanup', 'complete',
       'scenarios', jsonb_build_object(
         'concurrentDuplicate', jsonb_build_object(
           'oneFulfilled', true,
           'providerDispatches', 1
         ),
         'timeout', jsonb_build_object(
           'quarantined', true,
           'providerDispatches', 1
         ),
         'deterministicFailure', jsonb_build_object(
           'failed', true,
           'retrySucceededWithNewIntent', true,
           'providerDispatches', 2
         ),
         'acceptedMarkerFailure', jsonb_build_object(
           'quarantined', true,
           'providerDispatches', 1
         ),
         'materializationRecovery', jsonb_build_object(
           'recovered', true,
           'providerDispatches', 1
         )
       )
     ),
     '<actor>',
     '<사유>'
   );
   ```

   `contractDigest`는 위 전제 조건에서 확인한 현재 값으로 바꾼다. 각 시나리오 값은 승인된 live runner의 실제 결과와 일치할 때만 등록한다.
4. **활성화**: 경로 A와 동일하게 새 evidence_id로 `set_writing_submission_state('canonical', ...)`를 호출한다.
5. **드릴 데이터 정리 확인**: 임시 계정 삭제 후 profiles·writing_drafts·writing_submissions·intents 잔존 0건을 확인한다.

### 활성화 후 검증

```sql
select * from public.get_writing_submission_control();
-- 기대: canonical / local_outbox_verified
```

앱에서 실제 제출 1건으로 최종 확인한다(차단 모달이 아닌 분석 대기 화면 진입).

## 비상 차단

즉시 모든 제출을 멈춰야 할 때:

```sql
select public.set_writing_submission_state(
  'blocked', 'unverified', '<actor>', '<차단 사유>', null
);
```

사용자는 "작문 제출을 잠시 중단했습니다" 모달을 보게 되며 작성 중 답안은 임시저장으로 보존된다. 재개는 위 활성화 절차를 다시 따른다(유효 증거가 남아 있으면 경로 A).

## 실행 채널과 권한

- 상태 변경 함수 2종(`set_writing_submission_state`, `record_writing_submission_contract_evidence`)은 service_role 전용이다. 실행 채널: Supabase 대시보드 SQL 편집기, Management API(`POST /v1/projects/{ref}/database/query`), 또는 service key를 쓰는 스크립트.
- v13 에이전트는 기본적으로 원격 DB에 privileged 실행을 하지 않는다(`environment-and-agent-safety.md`). 이 runbook의 원격 실행은 운영자 본인 실행 또는 사용자의 명시 승인 하에서만 수행한다.
- secret 값(service key, access token)은 어떤 경우에도 출력·로그·문서화하지 않는다.

## 실행 이력

| 일시(UTC) | 대상 | 조치 | 증거 |
| --- | --- | --- | --- |
| 2026-07-15 | dev·prod | cutover 출고, 게이트 `blocked` (PR #43 / topik-ai#10) | — |
| 2026-07-23 01:02 | topik-dev | 경로 A로 활성화 (7/15 증거 재사용) | `dev-outbox-v2-20260715-0855` |
| 2026-07-23 02:15 | topik-prod | 경로 B로 활성화 (라이브 드릴 5종) | `prod-outbox-v2-20260723-6215` |
| 2026-07-23 (시간 미확인) | topik-dev | 초안 계약 드리프트 수리 후 경로 B로 재인증 | `dev-outbox-v2-20260723-6258` |

## 알려진 함정

- **활성화 누락 방치**: cutover 이후 활성화가 실행되지 않으면 모든 환경에서 제출이 무기한 차단된다. 2026-07-16~23 운영에서 실제 발생했다(제출 중단). 게이트 차단 모달 문의가 오면 가장 먼저 이 runbook의 상태 확인을 실행한다.
- **digest 드리프트**: DB에 migration 초안·리허설 잔재가 남으면 digest가 저장소 기준과 달라져 활성화가 거부된다. 2026-07-23 dev에서 실제 발생(초안 v1 함수·제약 잔존) — 기준 DB(최종본이 설치된 곳)와 함수·제약·인덱스 정의를 전수 비교해 정렬한 뒤 경로 B로 재인증했다.
- **verification 창 방치 금지**: 드릴 실패 시 반드시 `blocked`로 되돌리거나 재인증을 완료한다. `verification` 상태도 사용자 제출은 차단된 상태다.
