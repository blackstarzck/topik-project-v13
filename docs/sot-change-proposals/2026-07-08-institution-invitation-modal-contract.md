# 기관 초대 알림 모달 계약 변경 제안

작성일: 2026-07-08

상태: 확정 제안. PR26의 기관 초대 알림 UX 구현과 리뷰 해소 기준으로 사용한다. Active SOT 직접 수정이 필요하면 이 문서를 근거로 별도 확정 절차를 진행한다.

## 요약

기관 초대 알림은 기존 QR/링크 기반 `institution_invite` 흐름과 별도 계약으로 운영한다.

- 새 알림 계약: template_key = `institution_invitation` 또는 `payload.kind = institution_invitation`.
- 새 UI 동작: NotificationBell 알림함에서만 보이고, 클릭하면 라우팅보다 수락/거부 모달을 우선한다.
- 새 응답 계약: `respond_institution_invitation(p_invitation_id uuid, p_accept boolean)` RPC를 호출한다.
- 기존 계약 유지: `institution_invite` + `/auth/institution-invite` + `accept_affiliation_invite`는 QR/레거시 초대 링크 경로로 유지한다.

## 기존 proposal과의 관계

`docs/sot-change-proposals/2026-07-04-institution-invite-notification-and-account-status.md`는 관리자 앱이 `institution_invite` 알림 row와 `/auth/institution-invite` 링크를 발행한다고 가정했다.

2026-07-07 topik-ai handoff 이후 관리자 발행 계약은 아래처럼 바뀌었다.

| 항목 | 2026-07-04 proposal | 2026-07-08 modal 계약 |
| --- | --- | --- |
| `template_key` | `institution_invite` | `institution_invitation` |
| payload 식별 | `kind: institution_invite`, `affiliation_code` | `kind: institution_invitation`, `invitation_id`, `code`, `code_label` |
| 사용자 진입 | `/auth/institution-invite?aff=...` route | NotificationBell popover click -> modal |
| 응답 RPC | `accept_affiliation_invite(p_code,p_confirmed)` | `respond_institution_invitation(p_invitation_id,p_accept)` |
| 기존 소속 처리 | 다른 소속이면 전환 거부 | 수락 시 서버가 교체하고 `prev_code` 반환 |

따라서 2026-07-04 proposal은 QR/레거시 링크 기반 초대에는 계속 유효하지만, topik-ai admin이 새로 발행하는 알림 초대에는 이 문서가 우선한다.

## 데이터 계약

topik-ai admin은 `user_notifications`에 아래 형태의 row를 만든다.

```json
{
  "template_key": "institution_invitation",
  "category": "notice",
  "title": "기관 소속 초대가 도착했습니다",
  "body": "{사용자명}님에게 기관 소속 초대가 도착했습니다. 수락하면 해당 기관 회원으로 등록됩니다.",
  "link_url": null,
  "payload": {
    "kind": "institution_invitation",
    "invitation_id": "<uuid>",
    "code": "CAMPAIGN-01",
    "code_label": "Campaign 01 New Class"
  }
}
```

v13 판별 규칙:

- `template_key === "institution_invitation"` 또는 `payload.kind === "institution_invitation"`이면 기관 초대 모달 액션이다.
- 이 알림은 `link_url`, `route_path`, payload route가 있어도 라우팅하지 않고 모달을 우선한다.
- `invitation_id`가 없거나 UUID가 아니면 모달은 열되 수락/거부 버튼을 비활성화한다.
- `code`와 `code_label`은 표시 전용이다. RPC에는 `invitation_id`만 전달한다.

## RPC 계약과 소유권

v13은 아래 RPC만 호출한다.

```sql
public.respond_institution_invitation(p_invitation_id uuid, p_accept boolean) returns jsonb
```

호출 형태:

```ts
supabase.rpc("respond_institution_invitation", {
  p_invitation_id: invitationId,
  p_accept: accept,
});
```

RPC의 migration home은 v13이 아니라 topik-ai admin이다.

- topik-ai migration: `supabase/migrations-admin/20260707140000_institution_invitations.sql`
- topik-ai migration: `supabase/migrations-admin/20260707141000_institution_invitation_respond.sql`
- topik-ai SOT: `docs/requests/v13-institution-invitation-handoff-2026-07-07.md`
- topik-ai ownership note: `docs/architecture/shared-supabase-schema-ownership.md`의 "2026-07-07 기관 초대" 섹션
- topik-ai notification contract: `docs/specs/notification-contract.md`의 `institution_invitation`

v13 migration을 추가하지 않는다. 이유는 `institution_code_invitations`, `institution_codes`, `admin_invite_institution_members`, `respond_institution_invitation`이 topik-ai admin 소유의 shared Supabase 계약이며, v13은 user-facing client 호출과 화면 상태만 소유하기 때문이다.

다만 v13 client가 typed RPC를 호출하도록 `src/lib/supabase/types.ts`에는 shared DB 함수 시그니처를 반영한다.

## 응답과 UI 상태 매핑

| 서버 결과 | v13 UI |
| --- | --- |
| `{ "status": "accepted" }` | 성공 toast, 모달 accepted 상태, `router.refresh()` |
| `{ "status": "declined" }` | 확인 toast, 모달 declined 상태 |
| `{ "status": "canceled", "error": "code_inactive" }` | 만료된 초대 |
| exception `invitation already responded: accepted/declined` | 이미 처리된 초대 |
| exception `invitation already responded: canceled` | 관리자가 회수한 초대 |
| exception `unauthenticated` | 로그인 만료 안내 |
| 기타 owner/unknown/profile error | raw DB error 노출 없이 일반 오류 또는 invalid 상태 |

## 검증 증거

2026-07-08 dev DB smoke:

- 환경: v13 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `E2E_STUDENT_EMAIL`, `E2E_STUDENT_PASSWORD` 또는 `SUPABASE_TEST_PASSWORD` 사용. 값은 출력하지 않음.
- 방법: E2E 학생 계정으로 로그인 후 무작위 UUID로 `respond_institution_invitation({ p_invitation_id, p_accept: false })` 호출.
- 결과: `SMOKE_PASS`, `errorCode = P0001`, `messageClass = unknown_invitation`.
- 의미: 함수가 PostgREST schema cache에서 resolve되었고, 무작위 초대 ID에 대해 서버가 계약된 controlled error를 반환했다. 초대 데이터는 생성/수정하지 않았다.

추가 정적 회귀 테스트:

- `tests/lib/supabase/institution-invitation-rpc-contract.test.ts`
- `src/lib/supabase/types.ts`에 RPC 시그니처가 남아 있는지 확인한다.
- 이 proposal이 새 알림 계약, topik-ai migration home, v13 migration 제외 결정을 기록하는지 확인한다.

## 범위 밖

- v13에서 `institution_code_invitations` 테이블이나 admin RPC를 새로 만들지 않는다.
- v13에서 service role API route를 만들지 않는다.
- v13에서 `profiles.affiliation_code`를 직접 update하지 않는다.
- topik-ai 이메일 템플릿 CTA 수정은 topik-ai 소유 범위다.
