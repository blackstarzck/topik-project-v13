# v13 클라이언트 운영 계약

| 항목 | 값 |
| --- | --- |
| 상태 | 활성 운영 정책 |
| owner | TALKPIK AI v13 클라이언트 운영 |
| 범위 | 사용자 안전, 임시 복구, 실행 환경·에이전트 안전, AI 개발 lifecycle, 저장소 간 복구 경계 |
| 마지막 검토 | 2026-07-24 |
| 재검토 | 관련 제품·환경·복구 계약 변경 때마다, 최소 분기 1회 |

이 문서는 v13의 클라이언트 운영 정책을 찾는 정식 색인이다. 세부 정책의 상태와 owner도 이 색인에서 관리한다. 제품 약속은 [`../prd.md`](../prd.md), 실행 가능한 데이터 정본은 timestamp 순으로 재생한 `supabase/migrations/*.sql`이 우선하며, 이 문서는 그 owner를 대체하지 않는다.

## 정책 지도

| 문서 | 상태 | owner | 다루는 범위 | 검토 기준 |
| --- | --- | --- | --- | --- |
| [`ai-development-pipeline.md`](./ai-development-pipeline.md) | 활성 | v13 개발·승격 lifecycle | 요청별 branch·workspace, Codex↔Claude 인수인계, 산출물·CI, Black→Keduall 승격, DB·Vercel gate, 자동 정리 | 작업·release 명령, registry, CI·Git·DB·배포 정책 변경 때 |
| [`client-resilience-policy.md`](./client-resilience-policy.md) | 활성 | v13 클라이언트 운영 | 사용자에게 안전한 실패 처리, IndexedDB 크기·버전·retention, 충돌·제출 복구 | 저장·제출·약관·프로필·리소스 UX 변경 때 |
| [`environment-and-agent-safety.md`](./environment-and-agent-safety.md) | 활성 | v13 클라이언트 운영 | 환경 ref 검증, 에이전트 허용·금지 행위, 출력 정제 | 환경·배포·권한 경계 변경 때 |
| [`cross-repo-recovery-boundary.md`](./cross-repo-recovery-boundary.md) | 활성 | v13과 topik-ai의 경계 계약 | 백업·복구 owner, 약관 projection·동의 RPC·Data API 권한 이관, 복구 후 읽기 전용 확인 | 복구·약관·권한 경계 또는 운영 owner 변경 때 |
| [`topik-ai-operations-handoff.md`](./topik-ai-operations-handoff.md) | 실행 대기 | topik-ai 운영 | credential 대응, 자동 백업·외부 보관, 약관 원자성·권한 migration, production 적용, 복원 훈련 | topik-ai issue 생성·실행·handback 때 |
| [`topik-ai-notification-migration-order-handoff.md`](./topik-ai-notification-migration-order-handoff.md) | 실행 대기 | topik-ai DB·migration 운영 | 알림 관리자 원본과 v13 dispatcher의 교차 저장소 migration 순서·단독 재생 복구 | 관련 migration 소유권 이전·replay 수정·handback 때 |
| [`topik-ai-writing-pdf-metrics-handoff.md`](./topik-ai-writing-pdf-metrics-handoff.md) | 실행 대기 | topik-ai 운영·분석 | 쓰기 제출 시도·분석 결과·PDF 생성 결과의 분리 집계와 관리자 화면 계약 | 관련 migration·관리자 화면 구현·handback 때 |

## 적용 원칙

- 이 정책은 v13에서 지켜야 할 운영 계약이다. 문서가 있다는 사실만으로 기능 구현이나 운영 자동화가 완료·검증됐다고 보지 않는다.
- v13은 사용자 앱의 안전한 실패와 복구 UX를 소유하고, 원격 백업·복원·감사 운영을 수행하지 않는다.
- 정책과 현재 구현이 다르면 차이를 숨기지 않고 구현·테스트·관련 owner를 같은 변경 묶음에서 갱신한다.
- 개발 task의 준비·인수인계·종료·자동 정리와 Keduall 운영 승격은 [`ai-development-pipeline.md`](./ai-development-pipeline.md), 공용 `task:*`와 `release:*` 명령을 따른다. credential 교체와 history rewrite는 문서화와 별개인 사용자 승인 작업이다. 자동 정리는 예약 작업 없이 병합 직후 또는 다음 코드 작업 준비 시 일회성으로 실행한다.
