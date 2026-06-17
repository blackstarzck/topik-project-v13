# TALKPIK AI 분기형 QA 설계 보강

- 작성일: 2026-06-17
- 모드: 리포트 전용 QA. 개발 작업, 소스 수정, 테스트 추가, 커밋 없음.
- 목적: 기존 30개 QA 시나리오를 leaf test case로 확장하기 위한 분기 설계 기준.

## 결론

기존 `qa-scenario-matrix-talkpik-2026-06-17.md`의 QA-00~QA-29는 **leaf test case가 아니라 상위 사용자 흐름**이다.

사용자가 지적한 대로 실제 QA는 한 기능만 보더라도 아래 축이 곱해져 나무가지처럼 커진다.

```text
기능
  ├─ 환경: desktop / tablet / mobile / slow network / locale
  ├─ 사용자 상태: anonymous / authenticated / session expired / incomplete consent / incomplete onboarding
  ├─ 데이터 상태: empty / seeded / invalid id / unauthorized id / stale data / failed request
  ├─ 사용자 액션: click / input / submit / cancel / back / refresh / direct URL
  ├─ 시스템 반응: loading / success / validation error / server error / redirect / disabled
  └─ 회복 흐름: retry / go back / fallback CTA / safe error / preserved draft
```

따라서 "시나리오 30개"는 너무 적다. 정확히는 30개를 기준으로 **기능별 leaf case 300~800개 정도로 쪼개는 설계**가 필요하다.

다만 모든 축을 전수 곱하면 비현실적이다. QA 실행은 아래처럼 나눈다.

| 구간 | 전략 | 이유 |
| --- | --- | --- |
| Auth, password reset, consent, protected direct URL | 거의 전수 분기 | 보안/접근 제어 실패가 치명적 |
| Writing 51~54, submit, feedback, library/PDF | 주요 상태 전수 + 환경 pairwise | 데이터 유실과 핵심 사용 흐름 영향 |
| Dashboard, growth, recommendations, settings | risk-based + 대표 상태 | 오류 영향은 크지만 조합 폭이 넓음 |
| Terms/privacy, static public page | smoke + responsive | 동적 상태가 적음 |

## 분기 축 표준

모든 기능은 최소 아래 축으로 leaf case를 만든다.

| 축 | 값 |
| --- | --- |
| Viewport | desktop 1280, tablet 768, mobile 360 |
| Auth | anonymous, authenticated, expired/stale session, authenticated but missing consent, authenticated but missing onboarding |
| Data | empty, normal seeded, long content, invalid id, missing id, unauthorized id, deleted/stale id |
| Network | normal, slow/loading, request 4xx, request 5xx, offline/abort |
| Locale/content | ko, en/vi 가능 화면, 긴 한국어 텍스트, 긴 이메일/파일명 |
| Action | landing, click, input, toggle, submit, cancel, close modal, Esc, refresh, browser Back, app Back, direct URL |
| Expected UI | loading, empty, success, warning, error, disabled, active, selected, dirty, saved |
| Recovery | retry, edit again, go dashboard, go login, go previous page, preserve draft/state |

## Leaf case 작성 형식

```md
### QA-XX.YY leaf case title

- Feature:
- Route:
- Viewport:
- Auth state:
- Data state:
- Network state:
- Entry:
- User action:
- Expected state change:
- Expected UI response:
- Back behavior:
- Direct URL behavior:
- UX review:
- UI review:
- Product review:
- Dev review:
- Evidence:
- Result:
```

## 예시 1. QA-07 verify-email 확장

상위 시나리오 하나가 아래 leaf case로 갈라진다.

| Leaf ID | Viewport | Entry | Param/Data | Action | Expected |
| --- | --- | --- | --- | --- | --- |
| QA-07.01 | desktop | direct URL | no `email` | page landing | 이메일 입력 가능한 안내, 성공성 문구 최소화 |
| QA-07.02 | mobile | direct URL | no `email` | page landing | 모바일에서 CTA/입력/안내 overflow 없음 |
| QA-07.03 | desktop | direct URL | valid email | resend click | resend 요청, cooldown 시작, 중복 클릭 disabled |
| QA-07.04 | desktop | direct URL | malformed email | page landing | 성공성 "보냈어요" 문구 금지 또는 warning |
| QA-07.05 | desktop | direct URL | encoded email with plus | page landing | 표시/재전송 payload가 깨지지 않음 |
| QA-07.06 | desktop | direct URL | very long email | page landing | UI overflow 없음, resend validation |
| QA-07.07 | desktop | direct URL | known inbox domain | inbox link click | 외부 링크 노출 정책대로 동작 |
| QA-07.08 | desktop | direct URL | unknown domain | page landing | inbox link 숨김 |
| QA-07.09 | desktop | from sign-up success | valid email | browser Back | sign-up 또는 이전 화면으로 안전 복귀 |
| QA-07.10 | desktop | from auth error | malformed email | browser Back | 잘못된 email 상태가 성공처럼 보이지 않음 |
| QA-07.11 | desktop | direct URL | valid email | resend 500 | error toast/alert, retry 가능, 입력값 보존 |
| QA-07.12 | desktop | direct URL | valid email | resend rate limited | cooldown/disabled/안내 문구 |
| QA-07.13 | mobile | direct URL | valid email | resend click | 버튼 크기, 입력 라벨, toast 위치 확인 |
| QA-07.14 | authenticated | direct URL | valid email | page landing | 이미 로그인된 사용자의 redirect/안내 정책 확인 |

## 예시 2. QA-05 password reset confirm 확장

| Leaf ID | Auth/session | Entry | Data | Action | Expected |
| --- | --- | --- | --- | --- | --- |
| QA-05.01 | no recovery session | direct URL | none | page landing | 유효하지 않은 링크 안내 또는 submit 전 차단 |
| QA-05.02 | no recovery session | direct URL | none | valid password submit | session error, 재요청 CTA, raw error 없음 |
| QA-05.03 | recovery session | email link | valid token | weak password | strength validation, submit disabled/error |
| QA-05.04 | recovery session | email link | valid token | mismatch confirm | mismatch validation |
| QA-05.05 | recovery session | email link | valid token | valid submit | password update success, login/dashboard 이동 |
| QA-05.06 | expired token | email link | expired | page landing | 만료 안내, 재요청 CTA |
| QA-05.07 | mobile | direct URL | no session | submit | alert/CTA가 viewport 밖으로 밀리지 않음 |
| QA-05.08 | desktop | direct URL | no session | browser Back | 이전 page로 복귀, 실패 alert 반복 노출 없음 |
| QA-05.09 | desktop | direct URL | no session | refresh after error | error state 유지 또는 안전 초기화 |
| QA-05.10 | desktop | recovery session | network 500 | submit | 입력값 보존, retry 가능 |

## 예시 3. QA-16 writing 51~54 확장

writing은 유형별로 동일 축을 반복하되, 문항별 제약이 다르므로 51/52/53/54를 별도 leaf로 둔다.

| Leaf ID | Type | Data state | Action | Expected |
| --- | --- | --- | --- | --- |
| QA-16.01 | 51 | normal problem | empty answer submit | submit disabled or validation |
| QA-16.02 | 51 | normal problem | valid answer typing | char count, dirty, autosave queued/saved |
| QA-16.03 | 51 | normal problem | browser Back while dirty | D-M3 warning, stay/leave 선택 |
| QA-16.04 | 51 | normal problem | sidebar click while dirty | D-M3 warning, draft preserved |
| QA-16.05 | 51 | autosave 500 | type answer | save failed state, retry/preserve text |
| QA-16.06 | 51 | stale draft | page landing | conflict or latest draft policy |
| QA-16.07 | 51 | missing problem | direct URL | safe empty/error, no crash |
| QA-16.08 | 52 | normal problem | valid answer submit | D-M1 confirm, D-M2 loading, E-01/E-02 target |
| QA-16.09 | 53 | long prompt | page landing mobile | prompt/editor layout no overlap |
| QA-16.10 | 54 | very long answer | type/paste | char counter performance, no layout jump |
| QA-16.11 | 54 | network slow | submit | duplicate submit blocked |
| QA-16.12 | all | authenticated | refresh after autosave | answer restored |
| QA-16.13 | all | session expired | submit | login redirect or safe session error, draft not lost |
| QA-16.14 | all | mobile | keyboard/input | CTA reachable, editor not hidden |

## 예시 4. QA-19 feedback direct URL 확장

| Leaf ID | Auth | ID state | Entry | Expected |
| --- | --- | --- | --- | --- |
| QA-19.01 | anonymous | valid id | direct URL | login redirect, next 보존 여부 확인 |
| QA-19.02 | authenticated owner | valid short id | direct URL desktop | feedback heading/content render |
| QA-19.03 | authenticated owner | valid long id | direct URL desktop | feedback heading/content render |
| QA-19.04 | authenticated owner | valid short id | direct URL mobile | feedback render, sidebar/mobile nav 정상 |
| QA-19.05 | authenticated owner | invalid uuid | direct URL | safe 404/error, dashboard CTA |
| QA-19.06 | authenticated owner | uuid not found | direct URL | deleted/not found 안내 |
| QA-19.07 | authenticated non-owner | other user id | direct URL | no data leakage, 404/403 safe |
| QA-19.08 | authenticated owner | valid id | save to library | saved state/toast |
| QA-19.09 | authenticated owner | valid id | compare click | report route, Back returns feedback |
| QA-19.10 | authenticated owner | valid id | browser Back from report | feedback state preserved |
| QA-19.11 | authenticated owner | valid id | PDF save click | modal/export state |
| QA-19.12 | authenticated owner | server 500 | page landing | error state, retry/back CTA |

## 예시 5. QA-25 notification settings 확장

| Leaf ID | State | Action | Expected |
| --- | --- | --- |
| QA-25.01 | settings loaded | toggle channel | dirty state, save enabled |
| QA-25.02 | dirty | browser Back | unsaved warning or defined discard policy |
| QA-25.03 | dirty | sidebar click | unsaved warning or defined discard policy |
| QA-25.04 | save success | click save | success toast, dirty cleared |
| QA-25.05 | save 500 | click save | error toast, input preserved, retry enabled |
| QA-25.06 | load 500 | page landing | error Alert, screen not trapped |
| QA-25.07 | inbox unread | open bell | unread item visible |
| QA-25.08 | read PATCH 500 | click unread | optimistic rollback, error toast |
| QA-25.09 | empty inbox | open bell | empty state |
| QA-25.10 | mobile | open bell | panel fits viewport, close/back works |

## 실행량 산정

기존 30개 상위 시나리오를 아래 기준으로 확장하면 현실적인 leaf case 수는 다음 정도다.

| 영역 | 상위 시나리오 | leaf case 예상 |
| --- | --- | --- |
| Auth/signup/login/reset/verify/callback/consent | QA-02~QA-09 | 90~140 |
| Onboarding/dashboard/recommendations/problems/sidebar | QA-10~QA-15 | 80~130 |
| Writing/submit/analysis/feedback/report/library/PDF | QA-16~QA-22 | 130~220 |
| Growth/settings/profile/paywall/legal/invalid routes | QA-23~QA-29 | 80~140 |
| 합계 | QA-00~QA-29 | 약 380~630 |

## 실제 운영 방식

1. 먼저 전체 leaf case를 만든다.
2. 각 leaf에 `P0/P1/P2/P3`, 자동화 가능 여부, 수동 필요 여부를 붙인다.
3. P0/P1은 release 전 필수 실행한다.
4. P2/P3는 pairwise, smoke, 회귀 주기로 나눈다.
5. 실패가 한 번이라도 나온 축은 같은 기능의 sibling leaf를 추가 확장한다.

## 이번 QA 산출물의 보정 방향

기존 문서는 다음처럼 해석해야 한다.

- QA-00~QA-29: 테스트할 기능/흐름의 목차.
- 이 문서: 각 목차를 leaf case로 확장하는 분기 규칙.
- 실행 리포트: 이번에 실제 실행한 subset과 발견 이슈.

다음 산출물 단계는 `QA-XX.YY` 단위의 leaf case 체크리스트다. 이 단계에서는 30개가 아니라 최소 300개 이상의 행이 생기는 것이 정상이다.
