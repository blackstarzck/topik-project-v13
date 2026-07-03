# 기관 초대 코드 브라우저 보관 TTL 30분 단축

작성일: 2026-07-03

상태: 사용자 결정 확정(2026-07-03), 구현 반영

## 제안 요약

`talkpik:affiliation-code`(localStorage)의 브라우저 임시 보관 TTL을 **24시간에서 30분**으로 줄인다.

- 목적은 서버 초대 만료가 아니라 **브라우저 임시 보관 시간 축소**다.
- v13은 계속 기관 코드를 opaque string으로 다루며, 코드 존재/기관명/서버 만료/관리자 승인 검증은 하지 않는다. `2026-07-01-institution-invite-flow.md`의 신뢰 모델과 제한은 그대로 유지된다.
- 구현 단일 소스: `src/lib/auth/affiliation-code.ts`의 `AFFILIATION_CODE_TTL_MS = 30 * 60 * 1000`.

## 결정 이유

- 현행 임시 신뢰 모델에서는 형식상 유효한 코드를 수락하면 `profiles.affiliation_code`가 설정되고 writing visibility가 달라진다. 즉 저장 코드는 단순 표시 속성이 아니라 콘텐츠 접근 상태 변경의 트리거다. 브라우저에 코드가 남는 시간을 줄여 의도치 않은 기관 연결 위험을 축소한다.
- 박람회 QR·공용 PC 시나리오에서 코드가 하루 동안 잔존하면, 이후 같은 브라우저를 쓰는 다른 사용자의 가입/로그인에 코드가 따라붙을 수 있다. 30분은 "스캔 직후 가입/로그인 왕복"을 감당하면서 잔존 노출을 최소화하는 절충값이다.
- `localStorage`는 자체 만료 개념이 없고(MDN), 보안 신뢰 경계로 삼지 말라는 권고(OWASP)가 있으므로 클라이언트 보관은 최소 시간으로 유지한다.

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| 24시간 유지 | OAuth/이메일 인증 왕복 생존성에는 유리하나, 임시 신뢰 모델에서 공용 브라우저 잔존 노출이 과다해 기각. |
| sessionStorage/쿠키 전환 | 탭 간 공유와 OAuth 왕복 생존성이 나빠지고 저장 구조 변경 범위가 커져 기각. |
| 서버 측 코드 만료(admin catalog/RPC) | v13 사용자 앱 범위 밖. 기존 결정대로 deferred 유지. |

## 동작 규칙

| 규칙 | 내용 |
| --- | --- |
| 만료 판정 | `expiresAt <= now`. 저장 후 29분 59.999초까지 유효, 30분 0초 정각부터 만료. 만료 항목은 다음 read 시 localStorage에서 삭제된다. |
| TTL 갱신 | 로그인 CTA 클릭 등으로 갱신하지 않는다. `?aff=` 재진입 시에만 새로 저장된다. |
| 만료 코드와 가입 | 만료된 코드는 `buildAffiliationMetadata()`에 포함되지 않아 가입 metadata로 전달되지 않는다. |
| 저장 코드 삭제 CTA | "초대 없이 계속하기", "연결하지 않고 계속", "대시보드로 이동"은 저장 코드를 삭제한다. "기존 계정으로 로그인", "다른 계정으로 로그인"은 명시 삭제하지 않는다(만료 시 다음 read에서 삭제). |
| 만료 후 왕복 | 30분을 넘긴 로그인/OAuth/이메일 인증 왕복은 no-code 상태로 전환된다. no-code 화면의 CTA는 2026-07-03 expired invite 복귀 흐름(인증 사용자 → 대시보드, 비인증 사용자 → 로그인)을 따른다. |

## 트레이드오프와 영향

- `docs/handoff-institution-member-phase2.md` 60행·114행의 "OAuth 왕복·이메일 인증 왕복·새로고침 생존" 요구는 **30분 이내 왕복**으로 좁혀진다. 인증 메일을 30분 뒤에 클릭하고 초대 확인 화면으로 돌아온 학습자는 코드가 소실되어 no-code 화면을 보게 되며, `?aff=` 링크 재진입으로 복구할 수 있다.
- 같은 문서 62행의 "만료(예: 24h) 고려"는 예시 제안이었고, 본 결정으로 기준값은 30분이 된다. handoff 문서 원문은 수정하지 않으며 본 제안 문서가 최신 기준이다.
- UI 문구에 "30분"을 새로 노출하지 않으므로 `messages/*.json` 변경은 없다. Supabase migration, `profiles.affiliation_code`, `accept_affiliation_invite`, RLS, institution writing visibility는 변경하지 않는다.

## 검증

- `pnpm vitest run tests/lib/auth/affiliation-code.test.ts tests/components/auth/InstitutionInvitePanel.test.tsx tests/components/auth/SignUpForm.test.tsx` — 50 passed. 30분 경계(직전 유효/정각 만료/직후 삭제), 만료 코드 metadata 제외, CTA별 삭제/유지 매트릭스 포함.
- `pnpm exec playwright test tests/e2e/flows/institution-invite.spec.ts --project=mobile-360 -g "removes an expired stored invite"` — 만료된 저장 코드가 no-code 진입 시 삭제되는지 확인.
- `pnpm lint`(0 errors), `pnpm typecheck` 통과.

## 근거 문서

- `docs/sot-change-proposals/2026-07-01-institution-invite-flow.md` — 신뢰 모델, "코드가 없거나 만료됨 → no-code 상태" 규칙.
- `docs/handoff-institution-member-phase2.md` — 기존 24h 예시와 왕복 생존 요구(본 결정으로 30분 이내로 재해석).
- MDN Web Storage: localStorage에는 만료 시간이 없다 — https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- OWASP HTML5 Security Cheat Sheet: localStorage를 신뢰 경계로 두지 말 것 — https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
