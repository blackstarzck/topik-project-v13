# TALKPIK AI 사용자 플로우 (현행)

이 문서는 `docs/Wireframe/`의 35개 페이지 IA와 연동된 **현행 사용자 플로우**입니다.
이 중 X-13~X-17은 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면입니다.
노드명은 `docs/Wireframe/{...}/description.md`의 `Source` 값과 일치합니다(참조 규칙: `docs/Wireframe/README.md`).

새 구현/QA는 본 문서를 정본으로 사용합니다.

> 관리자 화면은 별도 관리자 앱(topik-ai) 소관이라 이 흐름도 범위에 없습니다. 경계 기준은 `docs/admin-scope-boundary.md`를 따릅니다.

## Mermaid 사용자 플로우

```mermaid
flowchart TD
  X01["23 X-01 제품 랜딩"]
  X13["35 X-13 이용약관"]
  X14["36 X-14 개인정보처리방침"]
  A01["01 A-01 회원가입"]
  A02["02 A-02 로그인"]
  X06["28 X-06 비밀번호 재설정"]
  X16["38 X-16 새 비밀번호 설정"]
  PA["/auth/post-auth OAuth 후처리"]
  CONSENT["/auth/consent 필수 약관 동의"]
  A03["03 A-03 학습 목표 설정"]
  B01["04 B-01 홈 대시보드"]

  X01 -->|"무료 시작"| A01
  X01 -->|"로그인"| A02
  X01 -. "약관/개인정보" .-> X13
  X13 -. "개인정보처리방침" .-> X14
  X01 -. "내비/미리보기/혜택 확인" .-> X01

  A01 -->|"이메일 가입"| A03
  A01 -. "Google로 계속" .-> PA
  A01 -. "약관/개인정보 확인" .-> X13
  A01 -. "약관/혜택 확인" .-> A01

  A02 -->|"로그인 성공: 학습자"| B01
  A02 -->|"회원가입"| A01
  A02 -->|"계정 찾기"| X06
  A02 -. "Google로 계속" .-> PA

  PA -->|"필수 약관 미동의"| CONSENT
  CONSENT -->|"동의 기록"| PA
  PA -->|"학습 목표 없음"| A03
  PA -->|"동의+학습 목표 있음"| B01

  X06 -->|"재설정 링크"| X16
  X16 -->|"비밀번호 변경 완료 / 로그인 복귀"| A02
  A03 -->|"다음 단계 / 건너뛰기"| B01

  B01 -->|"추천 학습"| C01
  B01 -->|"최근 첨삭"| F01
  B01 -->|"목표/성장 카드"| X02
  B01 -->|"알림"| X09
  B01 -->|"설정"| G01
  B01 -->|"프로필 편집"| X05
  B01 -->|"멤버십 / 구독 관리"| X04

  C01["05 C-01 문제 유형 추천"]
  C02["06 C-02 문제 목록"]
  C03["07 C-03 다시 풀기 모달"]
  D01["08 D-01 51번 단답 작성"]
  D02["09 D-02 52번 답안 작성"]
  D03["10 D-03 53번 장문 작성"]
  D04["11 D-04 54번 에세이 작성"]
  DM1["12 D-M1 제출 확인 모달"]
  DM2["13 D-M2 AI 분석 로딩"]
  DM3["22 D-M3 자동저장 경고"]
  E01["14 E-01 단답 피드백"]
  E02["15 E-02 장문 피드백"]
  R01["16 R-01 비교 리포트"]
  R02["17 R-02 다음 문제 추천"]

  C01 -->|"카드 선택 / 추천 유형 시작"| C02
  C01 -. "필터 변경" .-> C01
  C02 -->|"상세 보기 / 문제 선택"| C03
  C02 -. "유형 필터 / 정렬 / 검색 / 페이지 이동" .-> C02

  C03 -->|"시작: 51번"| D01
  C03 -->|"시작: 52번"| D02
  C03 -->|"시작: 53번"| D03
  C03 -->|"시작: 54번"| D04
  C03 -->|"취소"| C02

  D01 -->|"제출"| DM1
  D02 -->|"제출"| DM1
  D03 -->|"제출"| DM1
  D04 -->|"제출"| DM1
  D01 -. "저장 / 도구 / 이미지 확인 / 답안 작성" .-> D01
  D02 -. "조건 확인 / 가이드 / 임시저장" .-> D02
  D03 -. "자료 카드 / 본문 편집 / 저장" .-> D03
  D04 -. "조건 / 개요 / 표현 / 루브릭 확인" .-> D04

  D01 -. "저장 경고 / 이탈" .-> DM3
  D02 -. "저장 경고 / 이탈" .-> DM3
  D03 -. "저장 경고 / 이탈" .-> DM3
  D04 -. "저장 경고 / 이탈" .-> DM3
  DM3 -->|"취소 / 저장 후 이동: 51"| D01
  DM3 -->|"취소 / 저장 후 이동: 52"| D02
  DM3 -->|"취소 / 저장 후 이동: 53"| D03
  DM3 -->|"취소 / 저장 후 이동: 54"| D04
  DM3 -. "저장 안 함" .-> C02

  DM1 -->|"확인 CTA"| DM2
  DM1 -->|"취소: 51"| D01
  DM1 -->|"취소: 52"| D02
  DM1 -->|"취소: 53"| D03
  DM1 -->|"취소: 54"| D04
  DM1 -. "요약 재확인" .-> DM1

  DM2 -->|"분석 완료: 단답"| E01
  DM2 -->|"분석 완료: 장문"| E02
  DM2 -. "대기 유지" .-> DM2

  E01 -->|"다시 풀기"| C03
  E01 -->|"다음 문제 추천"| R02
  E01 -->|"비교 리포트"| R01
  E01 -. "결과 저장" .-> F01

  E02 -->|"다시 작성: 53"| D03
  E02 -->|"다시 작성: 54"| D04
  E02 -->|"비교 리포트"| R01
  E02 -->|"다음 문제 추천"| R02
  E02 -->|"PDF 저장"| FM1

  R01 -->|"약점 인사이트"| X07
  R01 -->|"다음 문제"| R02
  R01 -. "공유 / 차트 확인" .-> R01

  R02 -->|"추천 시작 / 카드 선택"| C02
  R02 -->|"목록 탐색"| C02

  X02["24 X-02 성장 대시보드"]
  X07["29 X-07 약점 기반 추천"]
  F01["18 F-01 내 서재"]
  FM1["19 F-M1 PDF 내보내기 모달"]
  G01["20 G-01 설정 언어"]
  X03["25 X-03 페이월"]
  X04["26 X-04 구독 관리"]
  X05["27 X-05 프로필 편집"]
  X09["31 X-09 알림 설정"]

  X02 -->|"추천 액션 선택"| X07
  X02 -. "KPI / 차트 확인" .-> X02
  X07 -->|"추천 문제 시작"| C02
  X07 -. "탭 변경 / 인사이트 확인" .-> X07

  F01 -->|"PDF 내보내기"| FM1
  F01 -. "검색 / 행 선택 / 상세 패널 / 저장 해제" .-> F01
  FM1 -->|"다운로드 완료 / 닫기"| F01

  G01 -. "언어/지역/학습 언어 선택 후 저장" .-> G01
  R02 -. "유료 잠금 진입" .-> X03
  FM1 -. "유료 잠금 진입" .-> X03
  R01 -. "유료 잠금 진입" .-> X03
  X03 -->|"구독 CTA / 결제 완료"| X04
  X03 -->|"결제 완료 후 학습 복귀"| B01
  X04 -->|"플랜 변경"| X03
  X04 -. "결제수단 / 이력 확인" .-> X04
  G01 -. "멤버십 / 결제 진입" .-> X04
  X05 -. "멤버십 / 결제 진입" .-> X04
  X05 -. "입력 수정 / 이미지 변경 / 저장" .-> X05
  X09 -. "이메일/푸시 선택 / 토글 변경 / 저장" .-> X09

  X11["33 X-11 인증 에러"]
  X12["34 X-12 인증 메일 확인 안내"]
  X17["39 X-17 인증 콜백 fragment 처리"]
  CB[["/auth/callback 라우트 핸들러"]]

  A01 -->|"가입 직후"| X12
  X12 -. "60초 cooldown 후 인증 메일 재전송" .-> X12
  X12 -->|"이메일 링크 클릭"| CB
  A02 -. "매직 링크 / 비밀번호 재설정 링크 클릭" .-> CB
  A01 -. "Google OAuth callback" .-> CB
  A02 -. "Google OAuth callback" .-> CB
  X06 -. "오류 callback" .-> CB

  CB -->|"Google OAuth 성공"| PA
  PA -->|"필수 약관 미동의"| CONSENT
  CONSENT -->|"동의 기록"| PA
  PA -->|"학습 목표 없음"| A03
  PA -->|"동의+학습 목표 있음"| B01
  CB -->|"토큰 교환 성공: 학습자"| B01
  CB -. "query 없는 implicit fragment" .-> X17
  X17 -->|"setSession 성공"| B01
  X17 -->|"fragment 실패/unknown"| X11
  CB -->|"토큰 교환 실패"| X11

  X11 -. "user_not_found → 다시 가입" .-> A01
  X11 -. "otp_expired / email_not_confirmed → 재전송" .-> X12
  X11 -. "flow_state_* / bad_code_verifier → 다시 시도" .-> A02
  X11 -. "Retry-After 카운트다운 후 자동 활성" .-> X11

  A02 -. "세션 만료 = ?reason=session_expired" .-> A02

```

## 인증 콜백 / 에러 흐름 — 상세 시나리오

위 다이어그램의 `CB` (`/auth/callback`)와 X-11/X-12는 cleanup 정책(30일 미인증 자동 삭제)과 함께 가야 의미가 있다. cleanup이 켜진 상태에서 사용자가 옛 인증 링크를 클릭하면 Supabase가 보낼 응답이 늘어나기 때문이다. 시나리오는 다음 여섯 가지.

| # | 상황 | Supabase 응답 | UX 결과 |
| --- | --- | --- | --- |
| 1 | 정상 가입 직후 30분 안에 메일 클릭 | `verifyOtp` success | `next` 또는 `/dashboard`로 redirect |
| 2 | 24h 토큰 만료 후 클릭 | `error.code = otp_expired` | X-11에서 "다시 인증 메일 받기" 안내 (이메일 prefill, 60초 cooldown) |
| 3 | 30일 미인증 cleanup 후 옛 링크 클릭 | `error.code = user_not_found` | X-11에서 "다시 가입하기" primary CTA → A-01 |
| 4 | 같은 메일 60초 이내 재전송 시도 | `error.code = over_email_send_rate_limit` + `Retry-After` 헤더 | X-11에서 `retry_after_seconds` 카운트다운, 다 끝나면 CTA 자동 활성 |
| 5 | 다른 브라우저/기기에서 PKCE 토큰 검증 시도 | `error.code = bad_code_verifier` 또는 `flow_state_not_found` | X-11에서 "처음부터 다시" 안내, A-02 로그인으로 secondary |
| 6 | Google OAuth callback 성공 | `exchangeCodeForSession` success | `/auth/post-auth`에서 약관 동의 누락 시 `/auth/consent`, 학습 목표 누락 시 A-03, 모두 있으면 B-01 |

세션 만료(in-app JWT expiry)는 미들웨어에서 잡혀 `/login?reason=session_expired`로 친절 redirect한다. X-11/X-12를 거치지 않는다.

`/auth/error`의 `reason` query는 Supabase 공식 `error.code` 11개 (`otp_expired`, `flow_state_expired`, `flow_state_not_found`, `bad_code_verifier`, `user_not_found`, `over_email_send_rate_limit`, `over_request_rate_limit`, `email_not_confirmed`, `signup_disabled`, `access_denied`, `unknown`)에 매핑된다. 자세한 메시지/CTA 표는 `docs/Wireframe/33-X-11-auth-error/description.md` 참고.
