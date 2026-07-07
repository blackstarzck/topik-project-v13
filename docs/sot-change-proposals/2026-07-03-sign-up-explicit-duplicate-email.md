# 이메일 회원가입 중복 이메일 명시 안내 전환

작성일: 2026-07-03

상태: 사용자 결정 확정(2026-07-03), 구현 반영

## 제안 요약

이메일 회원가입에서 이미 가입된 이메일이 감지되면, 계정 존재 여부를 숨기는 보안-safe 안내 대신 **"이미 가입된 이메일"임을 명시적으로 알리고 로그인/비밀번호 재설정으로 유도**한다.

- 중복 감지는 두 경로를 모두 처리한다: ① Supabase가 `user_already_exists`/`email_exists`/`email_address_already_in_use` 에러를 반환하는 경우, ② 이메일 확인(Confirm email)이 켜진 프로젝트에서 Supabase가 에러 대신 **`identities`가 빈 성공형(난독화) 응답**을 반환하는 경우.
- 중복이면 verify-email 페이지로 이동하지 않고 `/sign-up`에 머물며, 이메일 필드 인라인 오류 + warning message 토스트("이 이메일로 가입한 계정이 이미 있어요. 로그인하거나 비밀번호를 재설정해 주세요.")를 표시한다. message는 5초 뒤 자동으로 닫히고(hover 시 일시정지), 인라인 오류는 사용자가 이메일을 고칠 때까지 남는 지속 단서다. 로그인/비밀번호 재설정 CTA 버튼은 message 컴포넌트 특성상 두지 않으며, 화면 하단 로그인 링크와 문구 안내로 대체한다. (2026-07-03 사용자 결정: Alert → Notification → Message 순으로 확정)
- 구현 단일 소스: `src/components/auth/SignUpForm.tsx`의 `handleSignUp` 내 중복 판정과 `messages/*.json`의 `auth.signUp.emailDuplicate` / `accountCheckTitle` / `accountCheckDescription`.

## 결정 이유

- 기존 흐름에서는 기존 가입자가 재가입을 시도하면 X-12 "인증 메일을 보냈어요" 화면으로 이동하지만 **실제로는 메일이 발송되지 않아**, 사용자가 "내가 가입을 안 했었나?"라는 틀린 믿음을 갖고 오지 않을 메일을 기다리게 된다(2026-07-03 사용자 재현: 기존 계정 이메일로 가입 → verify-email 화면 도달, 메일 미수신).
- 이 프레임이 고정되면 사용자는 메일 미수신을 "메일 시스템 문제"로 해석하고, 최악의 경우 다른 이메일로 재가입해 학습 기록이 계정 두 개로 분절된다. 학습 이력이 핵심 자산인 서비스에서 실질 비용이 크다.
- 이메일 열거(enumeration) 노출 위험은 남지만, Supabase 응답 자체(`identities: []` 여부)가 이미 클라이언트에 전달되는 정보이므로 화면 안내가 새로운 유출 경로를 만드는 것은 아니다. 다만 화면 반응 차이로 존재 여부가 관찰 가능해지는 트레이드오프는 사용자가 인지하고 수용했다.

## 검토한 대안

| 대안 | 판단 |
| --- | --- |
| 현행 유지(보안-safe 숨김) | 열거 방어는 완전하나 기존 가입자에게 침묵하는 막다른 길을 만들고 틀린 믿음("가입 안 돼 있었구나")을 심음. 사용자 결정으로 기각. |
| 카피만 수정(발송 단정 제거 + 두 경우 설명) | 저비용·방어 유지 절충안이었으나, 사용자가 명시적 중복 안내를 원해 기각. |
| 기존 계정에 "이미 계정이 있어요" 안내 메일 발송(업계 정석) | 화면 동일 + 메일로 안내하는 완성형이지만 Supabase 기본 signUp 동작 밖이라 edge function 등 커스텀 발송 인프라가 필요. 중기 과제로 보류. |
| 이메일 입력 시 실시간 사전 중복 조회 API | `auth.users` 조회용 service role 엔드포인트가 필요해 열거 공격 표면을 오히려 넓히고 v13 범위(원격 DB 조작 금지)와 충돌. 기각. |

## 동작 규칙

| 상황 | Supabase 응답 | 화면 동작 |
| --- | --- | --- |
| 새 이메일 가입 성공 | `data.user.identities` 비어 있지 않음(또는 `data`/`user` 부재) | 기존과 동일: `/auth/verify-email?email=...`로 이동 |
| 중복(에러형) | `error.code`가 `user_already_exists`/`email_exists`/`email_address_already_in_use` | `/sign-up` 유지, 이메일 필드 인라인 오류 `emailDuplicate` + 중복 안내 warning message(5초 자동 닫힘) |
| 중복(난독화 성공형) | `error` 없음 + `data.user.identities`가 빈 배열 | 위와 동일한 중복 안내 |
| user가 null인 성공형 | `error` 없음 + `data.user` 없음 | 판정 불가 → 안전 fallback으로 기존 verify-email 이동 유지 |
| 이메일 수정 | — | 인라인 오류와 message를 즉시 지움(기존 onChange 동작 유지). 재제출 시에도 이전 message를 먼저 닫는다(고정 key) |
| rate limit / 기타 오류 | 429 또는 기타 `error.code` | 기존 쿨다운/토스트 동작 유지 |

- raw provider 문구("User already registered")와 `duplicate`/`exists`/`reason` query param은 계속 노출하지 않는다.
- 저장된 기관 코드(affiliation code)는 중복 안내 시 삭제하지 않는다(기존 동작 유지).

## 트레이드오프와 영향

- **열거 노출**: 가입 화면 응답 차이로 특정 이메일의 계정 존재 여부를 제3자가 확인할 수 있게 된다. OWASP 인증 치트시트는 가입 화면에서 존재 여부 비노출을 권장하므로, 본 결정은 UX를 우선한 의도적 예외다. rate limit(기존 60초 쿨다운 + Supabase 서버 rate limit)이 대량 열거를 완화한다.
- **SOT 충돌(갱신 필요)**: `docs/Wireframe/01-A-01-sign-up/description.md` 64행("중복 이메일 여부는 공개 화면에서 확정적으로 판정하지 않고 … 보안-safe 안내로 처리") 및 104행과 충돌한다. 승인 후 해당 문서 갱신이 필요하며, 원문은 본 제안이 확정 기준임을 전제로 직접 수정하지 않았다.
- `docs/Wireframe/34-X-12-auth-verify-email/description.md`(존재 여부 확정 문구 금지)는 문서 자체 수정 없이 유지 — 다만 기존 확인 계정 사용자가 X-12에 도달하는 경로가 사라진다(user null fallback 제외).
- Supabase 설정, migration, RLS 변경 없음. `emailDuplicate` 메시지 키는 기존 미사용 키를 재활용한다.

## 검증

- `pnpm vitest run tests/components/auth/SignUpForm.test.tsx` — 중복 에러형/난독화 성공형/새 계정 성공형/no-user fallback 분기.
- `pnpm exec playwright test tests/e2e/flows/sign-up.spec.ts` — 데스크톱/모바일 프로젝트에서 중복 안내 표시, verify-email 미이동, raw 문구 미노출, 성공 가입 경로 회귀.
- `pnpm lint`, `pnpm typecheck`.
- 실행 결과는 구현 커밋 보고에 기록한다.

## 근거 문서

- `docs/Wireframe/01-A-01-sign-up/description.md` 64행 — 변경 전 보안-safe 규칙(본 제안으로 대체).
- `docs/Wireframe/34-X-12-auth-verify-email/description.md` 53·55행 — 기존 흐름이 전제한 X-12 동작.
- Supabase signUp의 기존 계정 난독화 응답과 `identities` 빈 배열 판별: https://github.com/orgs/supabase/discussions/1282
- Supabase Auth 에러 코드(`user_already_exists`, `email_exists`): https://supabase.com/docs/guides/auth/debugging/error-codes
- OWASP Authentication Cheat Sheet(가입 화면 열거 방지 권장 — 본 결정이 의도적으로 예외를 취하는 기준): https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- 사용자 결정 맥락: 기존 가입자가 verify-email 화면에서 오지 않는 메일을 기다리는 UX 결함(2026-07-03 대화, "이메일 중복 체크하는 흐름으로 가고싶어").
