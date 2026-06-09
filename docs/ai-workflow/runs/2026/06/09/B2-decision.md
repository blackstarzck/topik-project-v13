# B2 결정 — lifecycle_status ↔ operationStatus 값 매핑 + expires_at (G5) (2026-06-09)

> owner가 **Opus 4.8 에이전트에 위임**(codex 대체). 에이전트가 양 저장소 실소스 대조 후 확정. 파일:라인 근거 포함.

## DECISION
`operationStatus`는 **권고/의도 레이어**(admin이 후보로 제안), 별도 컬럼 아님 → 결정적으로 `lifecycle_status` 값으로 write. **expires_at = 수동/저장만, 자동만료 트리거·cron 없음.** v13에 admin 전용 스키마 추가 없음.

## 값 매핑 (operationStatus → lifecycle_status)
| operationStatus | → lifecycle_status | 비고 |
|---|---|---|
| **미지정** | **(write 안 함)** → 기본 active 유지 | "의도 없음" — 강제 write 금지(대량변경 방지). 현재 sentinel·write disabled |
| **노출 후보** | **active** | lifecycle_reason=액션 사유 |
| **숨김 후보** | **inactive** | 가역적 비공개 |
| **운영 제외** | **inactive** (expired 아님) | 편집/운영 제외(시간만료 아님). `expired`는 만료채널 전용 보존. 구분은 lifecycle_reason+audit action(operation_excluded)로 |
> `expired`는 어떤 operationStatus 액션으로도 안 만들어짐 — 만료 정책 전용(채널 분리).

## expires_at 정책
**수동 + 저장만, 자동만료 없음.** 마이그 주석이 만료 기준을 의도적으로 보류(`20260608120100:69-72`). 자동만료는 사용자 안전 최고위험(시계/타임존 버그→대량 숨김) + 검증된 규칙 부재 → 지금 자동화 금지. 은퇴는 admin이 `lifecycle_status='expired'` 수동 설정. 향후 자동만료 원하면 **v13/DB scope의 별도 owner 게이트 결정**(admin앱 통해 들어오면 안 됨).

## 쓰기 활성 + 선행 (블로킹)
1. 경로: `admin_update_problem(problem_id, patch)`로 `lifecycle_status`(+reason/expires_at) 패치.
2. **선행-allowlist**: 현재 13키 allowlist에 **lifecycle_status/reason/expires_at 없음**(`20260608120400:45-49`) → 지금 패치하면 **조용히 무시(silent no-op)**. create-or-replace 마이그로 allowed[]+typed branch 추가 필요.
3. **선행-A1-pre**: live에 lifecycle 컬럼 미적용 → 마이그 `20260608120100` 먼저 적용. 안 하면 RPC 에러/no-op.
4. topik-ai: `OPERATION_WRITE_ENABLED=true` + `updateOperationStatus`(위 매핑) 구현. 권한은 이미 `is_content_admin`만.

## 시퀀싱/게이트
DB게이트(v13, Docker): ① A1-pre lifecycle 적용 → ② allowlist 마이그 → ③ 타입 재생성(G12). topik-ai+owner게이트: ④ 플래그 flip+서비스. **이 결정=docs-only(now), G5 종결.**

## 리스크/완화
- 미지정 대량숨김 → 미지정=write안함(고정), 명시 3액션만 per-row confirm+reason.
- allowlist 전 flip 시 silent no-op→가짜성공 → 플래그를 allowlist 마이그 뒤로 게이트 + write후 재read 검증.
- expired 누수 → 화면 `='active'` 필터·RLS가 fail-closed. (pre-migration fallback이 유일 노출경로라 A1-pre 선행.)

## 출처
`20260608120100`(lifecycle), `20260608120400:45-49,52,66-68,131-133`(allowlist/authz/no-op), `server.ts:137,144-147`, `rls_policies.sql:72`, topik-ai `supabase-assessment-question-bank-service.ts:146`·`manage-page:52-80`·`system-audit-logs-page.tsx:107-114`, B0-report.md.
