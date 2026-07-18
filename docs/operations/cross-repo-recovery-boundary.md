# 저장소 간 복구 경계

| 항목 | 값 |
| --- | --- |
| 상태 | 활성 경계 계약; 자동화 구현 증거 아님 |
| owner | topik-ai 운영과 TALKPIK AI v13 클라이언트 운영 |
| 범위 | 백업·복원 운영과 복구 후 클라이언트 확인의 책임 분리 |
| 마지막 검토 | 2026-07-18 |
| 재검토 | 복구 절차, 보존 정책 또는 owner 변경 때마다 |

## 책임 분리

| topik-ai가 소유 | v13이 소유 |
| --- | --- |
| DB·Storage 백업 정책, 보존 기간과 보호 범위 | 사용자 입력 보존, 안전한 오류, IndexedDB 임시 복구 UX |
| 백업 자동화, 실행 감시, 실패 경보와 운영 credential | 클라이언트 실패에서 안전하게 쓰기를 막는 동작 |
| 복원 절차, 승인, 복원 연습과 정기 drill | 복구 후 공개 클라이언트의 읽기 전용 acceptance 확인 |
| 복구 시점·결과·감사 기록과 증거 보관 | 비식별·비밀정보 없는 클라이언트 확인 결과 전달 |
| 운영 데이터 정리·삭제와 사고 대응 | 자동 재제출·자동 병합을 하지 않는 사용자 안전 경계 |

v13은 원격 백업을 만들거나 보존 기간을 집행하지 않으며, restore·delete·원격 SQL을 실행하지 않는다. topik-ai도 v13의 사용자 입력·충돌·오류 UX를 대신 소유하지 않는다.

복구 상태나 버전을 주고받는 별도 계약이 필요하다면 향후 topik-ai와 승인할 후보이며, 현재 v13이 소비하거나 UI로 노출하는 구현 계약이 아니다.

## topik-ai 데이터 계약 이관 항목

다음 항목은 v13 클라이언트가 원격 DB에 직접 적용하지 않는다. topik-ai가 migration과 운영 evidence를 소유하고, v13은 적용 전까지 불일치 시 안전하게 가입 완료를 막는다.

- `complete_auth_gate`가 v13과 동일하게 관리자 원본에서 동기화된 비-placeholder 공식 약관만 선택하고, locale fallback과 최신 버전 판정도 동일하게 수행하도록 맞춘다.
- 같은 문서 종류에서 최신 효력 시각이 같은 두 행이 있으면 임의 선택하지 않고 중단하거나, 관리자 정책 식별자까지 포함한 단일 결정 규칙을 DB에서 강제한다.
- `complete_auth_gate`가 화면에 표시된 문서 ID·버전을 입력으로 받고, 같은 transaction 안에서 현재 동의 대상과 정확히 일치할 때만 동의 행을 기록하도록 forward migration을 만든다. 화면과 저장 action의 사전 비교만으로는 그 확인과 RPC 실행 사이의 변경 경쟁을 제거할 수 없다.
- 공식 약관 동기화 함수는 빈 source policy 식별자를 거부하고, 관리자 앱이 projection table을 직접 수정하지 못하도록 RPC 경계를 DB 권한으로 강제한다.
- 새 환경에서도 RLS policy만 믿지 않고 Data API table privilege를 forward migration에 명시한다. 최소 계약은 `legal_documents`의 `anon`·`authenticated` 읽기, `user_consents`의 `authenticated` 본인 읽기·추가이며, `legal_documents`의 공개 쓰기와 `user_consents`의 `anon` 접근·수정·삭제는 명시적으로 회수한다. 실제 행 허용 범위는 기존 RLS가 추가로 제한하고, 관리자 projection 쓰기와 원자적 동의 기록은 승인된 RPC의 `EXECUTE` 권한으로만 연다.
- 위 권한 migration에는 약관 projection RPC와 정확한 문서 ID·버전을 받는 동의 RPC의 `EXECUTE` 대상도 명시하고, `public` 또는 불필요한 role에 남은 실행 권한을 회수하는 검증을 포함한다.
- `topik-prod`에 위 계약과 공식 terms/privacy 두 문서가 적용·동기화됐다는 evidence를 남긴 뒤 가입 acceptance를 수행한다.
- 로컬 E2E가 service-role로 직접 넣는 공식 약관 fixture는 loopback 검증 데이터일 뿐이며, 관리자 RPC 경계나 운영 동기화 완료의 evidence로 사용하지 않는다.

v13은 화면이 표시한 문서 ID·버전을 저장 요청에 포함하고, 가입 처리 직전에 현재 공식 문서 집합 및 DB 완료 함수가 선택할 수 있는 문서 집합과 비교한다. 서로 다르거나 최신 시각이 동률이면 placeholder나 다른 버전에 동의한 것으로 기록하지 않고 넓은 재시도 안내로 종료한다. 이 방어는 화면 표시 후 변경을 줄이는 사전검사이며, check와 write를 한 transaction으로 묶는 topik-ai의 DB 계약 교정을 대체하지 않는다.

## 복구 후 읽기 전용 acceptance

1. topik-ai가 복원 대상과 상태, 읽기 전용 확인 가능 시점을 선언한다.
2. v13은 승인된 논리 환경 이름의 일치 여부만 확인하고 credential 값을 출력하지 않는다.
3. 승인된 공개 클라이언트로 앱 진입, 필요한 약관 조회, 본인 프로필·문제·기존 기록 조회처럼 대표 읽기 경로를 확인한다.
4. create/update/delete/submission, 파일 업로드, 자동 복구 write는 수행하지 않는다.
5. 성공·실패 경로와 비식별 문의 정보만 topik-ai에 전달한다. write 허용 전환과 복구 완료 판정은 topik-ai owner가 수행한다.

## 현재 증명 수준

이 문서는 책임과 acceptance 계약을 정의한다. v13에는 topik-ai의 백업 자동화, 보존 집행, restore drill, 감사 기록이 구현됐거나 성공했다는 증거가 없다. 따라서 이 문서나 v13 테스트 통과를 근거로 백업·복원 준비가 완료됐다고 보고하지 않는다.

topik-ai의 실행 순서, 완료 증거와 v13 handback 형식은 [`topik-ai-operations-handoff.md`](./topik-ai-operations-handoff.md)를 따른다.
