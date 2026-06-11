# TALKPIK AI — 화면별 데이터베이스 구조 안내

> 대상 독자: 이 제품을 처음 인계받는 개발자
> 데이터베이스: Supabase(PostgreSQL)
> 목적: 각 화면이 어떤 데이터를 읽고 쓰는지, 그리고 그 데이터가 어떻게
> 생겼는지를 한 문서로 파악할 수 있게 정리한 안내서입니다.

이 문서는 **데이터 구조 자체**만 설명합니다. 특정 코드의 파일 위치, 내부 함수,
화면 컴포넌트 이름은 다루지 않습니다. 같은 데이터 구조 위에서 어떤 방식으로
화면을 구현하든 참고할 수 있도록 작성했습니다.

---

## 1. 읽는 방법

- **화면(IA 코드)** 단위로 정리되어 있습니다. 예: `A-01`은 회원가입,
  `D-01`은 51번 쓰기 작성 화면입니다.
- 각 화면 항목에는 그 화면이 다루는 **테이블**과 **사용 형태**가 적혀 있습니다.
- 테이블 하나하나의 컬럼·타입·의미는 뒤쪽 **6장 테이블 레퍼런스**에 모았습니다.
  화면 설명에서 처음 보는 테이블이 나오면 6장을 같이 보세요.
- 자주 쓰이는 상태값(열거형) 목록은 **7장**에 모았습니다.

**사용 형태 표기**

| 표기 | 뜻 |
| --- | --- |
| 읽기 | 화면에 보여주려고 데이터를 가져온다 |
| 쓰기 | 사용자의 행동으로 데이터를 새로 만들거나 바꾼다 |
| 파생 | 원본 데이터를 모아서 통계·점수·추세로 계산해 쓴다 |

---

## 2. 전체 그림 (도메인 묶음)

데이터는 크게 다음 묶음으로 나뉩니다.

| 묶음 | 테이블 | 한 줄 설명 |
| --- | --- | --- |
| 사용자 | `profiles`, `learning_goals` | 계정 프로필과 학습 목표 |
| 문제 | `problems`, `problem_assets` | 문제 본문과 문제에 붙은 이미지·오디오 |
| 객관식 풀이 | `problem_attempts` | 읽기·듣기 같은 선택형 풀이 기록 |
| 쓰기 | `writing_drafts`, `writing_submissions` | 자동저장 초안과 최종 제출본 |
| 피드백 | `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback` | AI 첨삭 총평·영역별 점수·문장별 교정 |
| 리포트 | `comparison_reports` | 이전 답안과 현재 답안 비교 결과 |
| 추천 | `recommendation_runs`, `recommendation_items` | 추천이 만들어진 단위와 추천된 문제 목록 |
| 서재 | `library_items` | 사용자가 저장해 둔 항목 모음 |
| 활동 로그 | `study_events` | 학습 행동의 시간축 기록 |
| 파일 | `export_files` | PDF 등 사용자가 만든 파일 메타데이터 |
| 알림 | `notification_settings`, `notification_log` | 리마인더 설정과 발송 이력 |
| 결제 | `subscription_plans`, `subscriptions`, `payment_history` | 플랜 카탈로그·구독 상태·결제 이력 |
| 약관·동의 | `legal_documents`, `user_consents` | 버전별 약관 문서와 사용자 동의 기록 |
| 관리자 | `admin_audit_logs`, `organizations` 외 | 관리자 작업 기록 및 조직 데이터(아래 주의 참고) |

> **관리자 영역 주의**
> `H-01`, `X-08`, `X-10`, `X-15` 화면과 조직 관련 테이블은 **별도 관리자
> 앱이 담당하는 영역**입니다. 이 문서에서는 데이터 구조를 설명만 하고,
> 사용자용 앱에서 새로 만들거나 확장하지 않습니다. 데이터 스키마는
> 관리자 쪽 설계를 먼저 따르고, 사용자 화면이 그 스키마에 맞춥니다.

---

## 3. 모든 화면에 공통으로 적용되는 규칙

1. **계정 연결**
   모든 사용자 데이터는 인증 사용자(로그인 계정)에 1:1로 연결된 프로필을
   기준으로 묶입니다. 프로필이 사용자 데이터의 중심점입니다.

2. **본인 데이터만 접근**
   사용자가 만든 데이터(초안, 제출본, 피드백, 서재 등)는 **본인만 읽고
   쓸 수 있도록** 데이터베이스 차원에서 막혀 있습니다. 화면 코드가
   실수로 막아 주는 것이 아니라, DB 정책 자체가 다른 사람 데이터를
   걸러 줍니다.

3. **제출본은 못 고친다 (불변)**
   쓰기 최종 제출본은 한 번 만들어지면 수정·삭제가 막혀 있습니다.
   재채점·기록 보존·AI 결과 재현을 위해 그대로 남겨 둡니다. 다시 풀고
   싶으면 새 제출본을 만들고, 이전 제출본과 연결만 해 둡니다.

4. **상태값은 정해진 단어만**
   대부분의 상태 컬럼은 미리 정해진 단어 집합만 허용합니다(7장 참고).
   예를 들어 문제 공개 상태는 `draft` / `published` / `archived` 세 가지뿐입니다.

5. **권한은 DB가 진실**
   관리자 여부·플랜·계정 상태 같은 민감한 값은 로그인 토큰이 아니라
   **DB에 저장된 값**을 기준으로 판단합니다. 사용자가 임의로 자기 권한을
   바꿀 수 없도록 보호 장치가 걸려 있습니다.

6. **첨부 파일은 별도 저장소**
   이미지·오디오·PDF 같은 파일 자체는 테이블이 아니라 파일 저장소에
   보관하고, 테이블에는 그 위치 정보만 둡니다(8장 참고).

---

## 4. 화면별 데이터 구조

### A. 인증·온보딩

#### A-01 · 회원가입
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 쓰기(자동) | 가입이 끝나면 기본 프로필 한 줄이 자동으로 생긴다 |
| `legal_documents` | 읽기 | 가입 화면과 OAuth 약관 게이트에 보여줄 약관·개인정보 문서(공개 버전)를 가져온다 |
| `user_consents` | 쓰기 | 사용자가 동의한 약관 버전과 시각을 기록으로 남긴다 |

가입 시 로그인 이메일은 인증 시스템이 보관하고, 프로필에는 표시 이름·언어·
권한·플랜·상태 같은 앱 전용 정보가 들어갑니다.

#### A-02 · 로그인
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 로그인한 사용자의 계정 상태와 권한을 확인한다 |

#### A-03 · 학습 목표 설정 (온보딩)
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `learning_goals` | 읽기/쓰기 | 목표 시험 등급, 시험일, 주간 목표, 약점 영역을 저장한다 |
| `profiles` | 읽기 | 기본 언어와 온보딩 진행 여부를 판단한다 |

---

### B. 홈

#### B-01 · 홈 대시보드
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 사용자 표시와 플랜 상태 |
| `learning_goals` | 읽기 | 목표 달성률과 다음 행동 안내 |
| `recommendation_runs`, `recommendation_items` | 읽기 | 추천 카드와 추천 사유 |
| `writing_drafts` | 읽기 | 이어 쓸 문제와 자동저장 상태 |
| `writing_feedback` | 읽기 | 최근 첨삭 점수 요약 |
| `study_events` | 파생 | 학습 연속일, 오늘 활동 같은 요약 지표 |

대시보드 상단 요약 수치는 위 데이터를 서버에서 한 번에 집계해 내려줍니다.

---

### C. 문제 탐색·풀이

#### C-01 · 문제 유형 추천
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `recommendation_runs`, `recommendation_items` | 읽기 | 추천 묶음과 추천 문제 목록 |
| `problems` | 읽기 | 추천 후보 문제의 기본 정보 |
| `feedback_dimension_scores` | 파생 | 약한 영역을 추천 근거로 사용 |

#### C-02 · 문제 목록
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `problems` | 읽기 | 목록, 필터, 정렬, 상세 진입 |
| `problem_assets` | 읽기 | 문제에 붙은 이미지·오디오 |
| `problem_attempts` | 읽기/쓰기 | 풀이 이력, 북마크, 소요 시간 |
| `writing_drafts` | 읽기 | 작성 중인 문제 표시와 이어쓰기 안내 |

목록은 필터·정렬·페이지 조건에 맞는 문제와 **정확한 총 건수**를 서버에서
계산해 내려줍니다. 이때 문제의 활성/비활성·만료 상태도 함께 반영됩니다.

#### C-03 · 재도전 모달
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `problem_attempts` | 읽기/쓰기 | 재도전 가능 여부 판단과 새 시도 시작 |
| `writing_drafts` | 읽기/쓰기 | 이어쓰기와 새로 시작 중 선택 |

---

### D. 쓰기 (51~54번)

`D-01`(51번), `D-02`(52번), `D-03`(53번), `D-04`(54번)은 데이터 사용이
동일합니다. 다른 점은 문제 번호와 답안 형태뿐입니다.

| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `problems` | 읽기 | 문제 지문, 조건, 채점 기준 |
| `problem_assets` | 읽기 | 문제 자료 이미지·오디오 |
| `writing_drafts` | 읽기/쓰기 | 작성 중 자동저장과 임시 보관 |
| `writing_submissions` | 쓰기 | 최종 제출본 생성 |
| `study_events` | 쓰기 | 작성 시작·제출 이벤트 기록 |

> 51번은 빈칸 채우기처럼 구조화된 답(예: 빈칸1·빈칸2), 53번은 도입·본문·결론
> 같은 구조를 가집니다. 이런 구조화된 답은 답안 JSON 형태로 저장됩니다.
> 화면은 문제의 원본 자료를 곧장 그리지 않고, 한 번 정돈된 형태로 변환한
> 뒤 보여 줍니다.

#### D-M1 · 제출 확인 모달
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `writing_drafts` | 읽기 | 제출 직전 임시 답안 확인 |
| `writing_submissions` | 쓰기 | 확정 제출본 생성 |

최종 제출과 첫 피드백 대기 레코드 생성은 한 번에(원자적으로) 처리되어,
"제출은 됐는데 분석이 안 걸린" 상태가 생기지 않습니다.

#### D-M2 · AI 분석 대기 화면
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `writing_submissions` | 읽기 | 분석 대기/완료 상태 표시 |
| `writing_feedback` | 읽기/쓰기 | 분석이 끝나면 첨삭 결과를 연결 |

제출본의 피드백 상태 전환(대기→분석중→완료/실패)은 **서버 측에서만**
일어나고, 정해진 흐름 외의 전환은 막혀 있습니다.

#### D-M3 · 자동저장 경고
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `writing_drafts` | 읽기/쓰기 | 자동저장 실패·지연·충돌 경고 |
| `study_events` | 쓰기 | 자동저장 관련 이벤트 기록 |

---

### E. 피드백

`E-01`(단답형 피드백)과 `E-02`(장문형 피드백)은 데이터 사용이 거의 같습니다.
`E-02`는 문장별 교정을 더 많이 활용합니다.

| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `writing_submissions` | 읽기 | 제출 원문과 제출 상태 |
| `writing_feedback` | 읽기 | 총점과 총평 |
| `feedback_dimension_scores` | 읽기 | 영역별 점수와 약점 수준 |
| `sentence_feedback` | 읽기 | 문장별 수정 제안 |
| `library_items` | 읽기/쓰기 | 피드백을 서재에 저장 |
| `export_files` | 읽기/쓰기 | 피드백 PDF 내보내기 연결 |
| `study_events` | 쓰기 | 피드백 조회 이벤트 기록 |

---

### R. 리포트·추천

#### R-01 · 비교 리포트
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `comparison_reports` | 읽기/쓰기 | 비교 리포트 본문과 지표 |
| `writing_submissions` | 읽기 | 비교 대상 제출본 불러오기 |
| `writing_feedback` | 읽기 | 점수 변화와 요약 비교 |
| `feedback_dimension_scores` | 읽기 | 영역별 성장 지표 |
| `study_events` | 쓰기 | 리포트 조회 이벤트 기록 |

AI 분석은 매번 결과가 달라질 수 있어, 리포트 생성 시점의 지표와 서술을
**스냅샷으로 저장**해 둡니다.

#### R-02 · 다음 문제 추천
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `recommendation_runs`, `recommendation_items` | 읽기/갱신 | 추천 카드와 클릭 상태 |
| `problems` | 읽기 | 추천 대상 문제 정보 |
| `writing_feedback`, `writing_submissions`, `feedback_dimension_scores` | 파생 | 최근 결과를 추천 근거로 사용 |

---

### F. 서재·내보내기

#### F-01 · 내 서재
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `library_items` | 읽기/쓰기 | 저장 탭, 저장/해제, 태그 |
| `problems` | 읽기 | 저장한 문제 탭 |
| `writing_submissions` | 읽기 | 제출 이력 탭 |
| `comparison_reports` | 읽기 | 리포트 탭 |
| `export_files` | 읽기 | 내보낸 파일 탭 |
| `feedback_dimension_scores` | 읽기 | 저장 항목의 점수 표시 |
| `study_events` | 읽기 | 학습 활동 기록 표시 |

서재는 문제·제출본·리포트·내보낸 파일을 **한 테이블에서 종류 구분과 함께**
다룹니다. 한 항목은 정확히 한 종류만 가리키도록 제약이 걸려 있습니다.

#### F-M1 · PDF 내보내기 모달
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `export_files` | 읽기/쓰기 | PDF 생성 요청과 결과 파일 상태 |
| `study_events` | 쓰기 | 다운로드 이벤트 기록 |

생성된 PDF 파일은 비공개 저장소에 보관되며 본인에게만 노출됩니다.

---

### G. 설정

#### G-01 · 언어 설정
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기/쓰기 | 앱 표시 언어 저장 |

---

### X. 계정·결제·법적 문서·기타

#### X-01 · 제품 랜딩
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 파생 | 플랜에 맞춘 안내 문구(직접 DB 의존은 낮음) |

#### X-02 · 성장 대시보드
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `study_events` | 파생 | 학습 추세와 활동 그래프 |
| `problem_attempts` | 파생 | 정확도와 학습 시간 |
| `writing_feedback` | 파생 | 점수 추세 |
| `feedback_dimension_scores` | 파생 | 영역별 성장·취약 분석 |

#### X-03 · 페이월
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `subscription_plans` | 읽기 | 보여줄 플랜 카탈로그 |
| `profiles` | 읽기 | 현재 플랜과 접근 제한 안내 |

#### X-04 · 구독 관리
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `subscriptions` | 읽기 | 현재 구독 상태와 기간 |
| `payment_history` | 읽기 | 결제 이력과 영수증 링크 |
| `profiles` | 읽기 | 플랜·상태 표시 |

#### X-05 · 프로필 편집
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기/쓰기 | 표시 이름, 별명, 자기소개, 아바타, 언어 |
| `learning_goals` | 읽기/쓰기 | 시험 목표 정보 |

아바타 이미지는 파일 저장소에 올리고, 프로필에는 그 위치만 저장합니다.
권한·플랜·계정 상태 컬럼은 사용자가 직접 바꿀 수 없습니다.

#### X-06 · 비밀번호 재설정 (요청)
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 재설정 이후 계정 상태 확인에 연결될 수 있음 |

비밀번호 변경 자체는 인증 시스템이 처리하며 앱 테이블에는 저장하지 않습니다.

#### X-07 · 약점 기반 추천
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `feedback_dimension_scores` | 읽기 | 약한 영역 계산 |
| `recommendation_runs`, `recommendation_items` | 읽기/갱신 | 추천 목록과 상태 |
| `problems` | 읽기 | 추천 문제 상세 |
| `writing_feedback` | 파생 | 최근 결과를 근거로 사용 |

#### X-08 · 기관 관리자 대시보드 *(관리자 영역)*
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `admin_audit_logs` | 읽기 | 최근 관리자 활동 |
| `profiles` | 읽기 | 사용자 집계 |
| `study_events` | 파생 | 기관 단위 활동 집계 |
| `organizations` 외 조직 테이블 | 읽기 | 조직·과제 데이터 |

#### X-09 · 알림 설정
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `notification_settings` | 읽기/쓰기 | 리마인더 시간·요일·채널·시간대 |
| `notification_log` | 읽기 | 최근 발송 이력 |

알림 발송 기록 작성은 서버 측에서 수행하고, 사용자는 본인 이력만 봅니다.

#### X-10 · 관리자 사용자 관리 *(관리자 영역)*
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기/쓰기 | 사용자 목록, 역할·상태 변경 |
| `admin_audit_logs` | 쓰기 | 권한 변경 이력 기록 |

#### X-11 · 인증 오류
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 계정 상태 안내와 재시도 분기 |

#### X-12 · 이메일 인증 안내
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 가입 직후 인증 상태 확인 |

가입 직후 프로필 한 줄이 반드시 생기도록 보장됩니다.

#### X-13 · 이용약관
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `legal_documents` | 읽기 | 현재 공개된 약관 문서 본문 |
| `user_consents` | 쓰기 | 정식 약관 공개 시 재동의 기록 |

약관은 **버전별로 한 줄씩** 저장되며, 기존 버전은 고치지 않고 새 버전을
한 줄 더 추가하는 방식(이력 보존)입니다. 약관·개인정보 화면은 로그인 전에도
열 수 있어, 공개된 문서는 누구나 읽을 수 있습니다.

#### X-14 · 개인정보 처리방침
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `legal_documents` | 읽기 | 현재 공개된 개인정보 문서 본문 |

#### X-15 · 관리자 인덱스 *(관리자 영역)*
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `profiles` | 읽기 | 관리자 루트 접근 권한 확인 |

#### X-16 · 비밀번호 재설정 (확정)
새 비밀번호 확정은 인증 시스템이 처리하며 앱 테이블에는 저장하지 않습니다.

#### X-17 · 인증 콜백 처리
로그인·인증 후 세션을 확정하는 단계입니다. 앱 테이블에 직접 데이터를 쓰지
않고, 프로필 한 줄이 존재하도록 보장하는 역할만 합니다.

---

### H. 관리자 문제 관리

#### H-01 · 관리자 문제 관리 *(관리자 영역)*
| 테이블 | 사용 형태 | 무엇에 쓰나 |
| --- | --- | --- |
| `problems` | 읽기/쓰기 | 문제 목록, 편집, 공개 상태, 검수 상태 |
| `problem_assets` | 읽기/쓰기 | 문제 첨부 자료 관리 |
| `admin_audit_logs` | 쓰기 | 변경 이력 기록 |

문제 공개 전환이나 내용 수정 같은 관리자 작업은 **변경 전/후 차이와 함께
감사 로그로 남도록** 서버 측에서 처리됩니다.

---

## 5. 화면 → 테이블 빠른 색인

| 테이블 | 이 테이블을 쓰는 화면 |
| --- | --- |
| `profiles` | A-01, A-02, A-03, B-01, G-01, X-01, X-03, X-04, X-05, X-06, X-08, X-10, X-11, X-12, X-15 |
| `learning_goals` | A-03, B-01, X-05 |
| `problems` | C-01, C-02, D-01~D-04, R-02, F-01, X-07, H-01 |
| `problem_assets` | C-02, D-01~D-04, H-01 |
| `problem_attempts` | C-02, C-03, X-02 |
| `writing_drafts` | B-01, C-02, C-03, D-01~D-04, D-M1, D-M3 |
| `writing_submissions` | D-01~D-04, D-M1, D-M2, E-01, E-02, R-01, R-02, F-01 |
| `writing_feedback` | B-01, D-M2, E-01, E-02, R-01, R-02, X-02 |
| `feedback_dimension_scores` | C-01, E-01, E-02, R-01, R-02, X-02, X-07 |
| `sentence_feedback` | E-01, E-02 |
| `comparison_reports` | R-01, F-01 |
| `recommendation_runs` | B-01, C-01 |
| `recommendation_items` | B-01, C-01, R-02, X-07 |
| `library_items` | E-01, E-02, F-01 |
| `study_events` | B-01, D-01~D-04, D-M3, E-01, E-02, R-01, F-01, F-M1, X-02, X-08 |
| `export_files` | E-01, E-02, F-01, F-M1 |
| `notification_settings`, `notification_log` | X-09 |
| `subscription_plans` | X-03 |
| `subscriptions`, `payment_history` | X-04 |
| `legal_documents` | A-01, X-13, X-14 |
| `user_consents` | A-01, X-13 |
| `admin_audit_logs` | H-01, X-08, X-10 |
| 조직 테이블 | X-08 |

---

## 6. 테이블 레퍼런스

각 테이블의 핵심 컬럼과 의미입니다. 상태값 후보는 7장에 모았습니다.
"본인만 접근"이라고 적힌 테이블은 다른 사용자의 데이터가 DB 차원에서
걸러집니다.

### 6.1 사용자

#### `profiles` — 계정 프로필
인증 계정과 1:1로 연결되는 사용자 정보의 중심 테이블. 로그인 이메일은
인증 시스템이 보관하고, 여기에는 앱 전용 정보가 들어갑니다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 인증 계정과 동일한 식별자 (기본키) |
| `display_name` | text | 표시 이름 |
| `nickname` | text | 별명(중복 불가) |
| `avatar_path` | text | 아바타 이미지 저장 위치 |
| `bio` | text | 자기소개 |
| `ui_locale` | text | 앱 표시 언어 (`ko`/`en`/`vi`) |
| `app_role` | text | 권한 등급(아래 7장) |
| `plan_label` | text | 표시용 플랜 라벨 |
| `status` | text | 계정 상태 (`active`/`blocked`/`deleted`) |
| `notification_prefs` | json | 간단 알림 설정(상세 설정은 별도 알림 테이블) |
| `created_at`, `updated_at` | 시각 | 생성·수정 시각 |

권한·플랜·상태는 사용자가 직접 못 바꾸도록 보호됩니다.

#### `learning_goals` — 학습 목표
사용자당 하나. 온보딩에서 만들고 프로필·대시보드에서 다시 씁니다. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `user_id` | uuid | 사용자 (기본키) |
| `topik_level` | text | 목표 시험 구분 (`TOPIK_I`/`TOPIK_II`) |
| `target_grade` | 정수 | 목표 등급(1~6) |
| `exam_date` | 날짜 | 시험 예정일 |
| `weekly_goal_minutes` | 정수 | 주간 학습 목표 시간(분) |
| `weak_areas` | 문자열 배열 | 약점 영역 태그 |
| `is_active` | 불리언 | 현재 활성 목표 여부 |

### 6.2 문제

#### `problems` — 문제 카탈로그
AI 생성 문제와 큐레이션 문제를 한 테이블에서 다룹니다. 공개·검수·수명 상태를
여러 축으로 관리합니다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `source` | text | 출처 (`ai_generated`/`curated`) |
| `author_id` | uuid | 작성자(있을 때) |
| `domain` | text | **영역**: 읽기/듣기/쓰기 (`reading`/`listening`/`writing`) |
| `question_no` | 정수 | 쓰기 51/52/53/54, 그 외는 비어 있음 |
| `topik_level` | 정수 | TOPIK 구분(1/2) |
| `difficulty` | 정수 | 난이도(1~5) |
| `title` | text | 제목 |
| `prompt` | text | 문제 지문 |
| `materials` | json | 자료(이미지·오디오 위치, 조건 등) |
| `answer_key` | json | 객관식 정답 또는 쓰기 모범 예시 |
| `rubric` | json | 쓰기 채점 기준 |
| `explanation` | text | 해설 |
| `tags` | 문자열 배열 | 분류 태그 |
| `topic_category_code` | text | **주제 분류**(생활/학습/사회 등). 영역(`domain`)과는 다른 축. 현재는 비어 있을 수 있음 |
| `publish_status` | text | 공개 상태 (`draft`/`published`/`archived`) |
| `review_status` | text | 검수 **최종 결과** (`pending`/`approved`/`rejected`) |
| `review_workflow_status` | text | 검수 **진행 단계**(별도 축). 현재는 비어 있을 수 있음 |
| `lifecycle_status` | text | 수명 상태 (`active`/`inactive`/`expired`) |
| `lifecycle_reason` | text | 비활성 사유(사용자 화면 표시용) |
| `expires_at` | 시각 | 만료 시각(자동 만료 로직은 없음) |
| `visibility` | text | 노출 범위 (`private`/`public`/`org`) |

> 일반 사용자에게는 **공개 상태가 `published`이고 노출 범위가 `public`인**
> 문제만 보입니다.
> `domain`(영역)과 `topic_category_code`(주제)는 의미가 다릅니다. 영역은
> "읽기/듣기/쓰기" 같은 기능 축이고, 주제는 "생활/학습/사회" 같은 소재 축입니다.
> `review_status`(최종 결과)와 `review_workflow_status`(진행 단계)도 별개입니다.
> 뒤 두 컬럼은 관리자 쪽 코드 체계 확정 전이라 현재 비어 있을 수 있습니다.

#### `problem_assets` — 문제 첨부 자료
문제에 붙는 이미지·오디오의 위치 정보.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `problem_id` | uuid | 어느 문제의 자료인지 |
| `storage_path` | text | 파일 저장 위치 |
| `asset_type` | text | 종류 (`image`/`audio`) |
| `sort_order` | 정수 | 표시 순서 |

### 6.3 풀이·쓰기

#### `problem_attempts` — 객관식 풀이 기록
읽기·듣기 같은 선택형 풀이. 쓰기는 아래 별도 테이블이 담당. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `problem_id` | uuid | 문제 |
| `selected_answer` | json | 선택한 답 |
| `is_correct` | 불리언 | 정답 여부 |
| `score` | 숫자 | 점수 |
| `status` | text | 상태 (`started`/`submitted`/`reviewed`) |
| `started_at`, `submitted_at` | 시각 | 시작·제출 시각 |
| `bookmarked` | 불리언 | 북마크 여부 |
| `time_spent_seconds` | 정수 | 소요 시간(초) |

#### `writing_drafts` — 쓰기 자동저장 초안
작성 중 임시 저장본. 한 문제당 활성 초안은 1개만 유지됩니다. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `problem_id` | uuid | 문제 |
| `question_no` | 정수 | 51/52/53/54 |
| `answer_text` | text | 답안 본문 |
| `answer_json` | json | 구조화된 답(빈칸·문단 등) |
| `char_count` | 정수 | 글자 수 |
| `autosave_status` | text | 자동저장 상태 (`clean`/`dirty`/`syncing`/`failed`/`superseded`) |
| `last_saved_at` | 시각 | 마지막 저장 시각 |

#### `writing_submissions` — 쓰기 최종 제출본
한 번 만들어지면 **수정·삭제 불가(불변)**. 재도전 시 이전 제출본과 연결됩니다.
본인만 읽기(관리자도 읽기 가능).

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `problem_id` | uuid | 문제 |
| `draft_id` | uuid | 어느 초안에서 제출됐는지 |
| `question_no` | 정수 | 51/52/53/54 |
| `answer_text` | text | 제출 답안 |
| `answer_json` | json | 구조화된 답 |
| `char_count` | 정수 | 글자 수 |
| `submitted_at` | 시각 | 제출 시각 |
| `feedback_status` | text | 피드백 진행 상태 (`pending`/`analyzing`/`complete`/`failed`) |
| `parent_submission_id` | uuid | 재도전 체인에서 이전 제출본 |

### 6.4 피드백·리포트

#### `writing_feedback` — AI 첨삭 총평
제출본 하나당 하나. 본인만 접근(관리자도 읽기).

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `submission_id` | uuid | 어느 제출본의 피드백인지 (기본키) |
| `status` | text | 상태 (`partial`/`complete`/`failed`) |
| `score_total`, `score_max` | 숫자 | 총점 / 만점 |
| `overall_summary` | text | AI 총평 |
| `ai_model`, `ai_model_version` | text | 사용 모델 정보(재현용) |
| `raw_ai_result` | json | 원본 분석 결과 보관 |
| `generated_at` | 시각 | 생성 시각 |

#### `feedback_dimension_scores` — 영역별 점수
문법·어휘·구조 등 차원별 점수. 약점 추천과 성장 차트의 근거. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `submission_id` | uuid | 제출본 |
| `dimension` | text | 영역 (`grammar`/`vocab`/`structure`/`content`/`expression`/`topic_fit`) |
| `score`, `score_max` | 숫자 | 점수 / 만점 |
| `summary` | text | 영역 코멘트 |
| `weakness_level` | 정수 | 약점 수준(1~5) |

#### `sentence_feedback` — 문장별 교정
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `submission_id` | uuid | 제출본 |
| `sentence_index` | 정수 | 문장 순서 |
| `original_text` | text | 원문 |
| `corrected_text` | text | 수정문 |
| `comment` | text | 코멘트 |

#### `comparison_reports` — 비교 리포트
이전 답안과 현재 답안의 비교 결과. 생성 시점 스냅샷으로 보존. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `current_submission_id` | uuid | 현재 제출본 |
| `previous_submission_id` | uuid | 비교 대상 이전 제출본 |
| `metrics` | json | 차트 지표 |
| `narrative` | text | AI 서술 |
| `generated_at` | 시각 | 생성 시각 |

### 6.5 추천

#### `recommendation_runs` — 추천 실행 단위
추천이 한 번 만들어진 묶음. "왜 이 추천이 나왔는지"를 보존. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `source_type` | text | 추천 출처 (`dashboard`/`feedback`/`weakness`/`next_problem`) |
| `source_id` | uuid | 출처가 된 데이터 |
| `reason_summary` | text | 추천 사유 요약 |
| `created_at`, `expires_at` | 시각 | 생성·만료 시각 |

#### `recommendation_items` — 추천된 문제
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `run_id` | uuid | 어느 추천 묶음인지 |
| `problem_id` | uuid | 추천 문제 |
| `rank` | 정수 | 추천 순위 |
| `reason` | text | 개별 추천 이유 |
| `estimated_minutes` | 정수 | 예상 소요 시간 |
| `weakness_tags` | 문자열 배열 | 관련 약점 태그 |
| `status` | text | 상태 (`active`/`consumed`/`expired`) |

### 6.6 서재·활동·파일

#### `library_items` — 내 서재
문제·제출본·리포트·내보낸 파일을 한 테이블에서 종류 구분과 함께 저장.
한 항목은 정확히 한 종류만 가리킵니다. 본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `item_type` | text | 종류 (`attempt`/`submission`/`report`/`export`/`problem`) |
| `attempt_id` / `submission_id` / `report_id` / `export_id` / `problem_id` | uuid | 종류에 맞는 대상 하나만 채워짐 |
| `note` | text | 사용자 메모 |
| `tags` | 문자열 배열 | 태그 |
| `saved_at` | 시각 | 저장 시각 |

#### `study_events` — 학습 활동 로그
대시보드·성장·추천이 함께 보는 시간축 기록. 본인만 접근(관리자 읽기 가능).

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `event_type` | text | 활동 종류(7장 목록) |
| `occurred_at` | 시각 | 발생 시각 |
| `problem_id` / `submission_id` / `attempt_id` | uuid | 관련 대상(있을 때) |
| `session_id` | uuid | 묶음용 세션 식별자 |
| `payload` | json | 활동별 부가 정보 |

#### `export_files` — 내보낸 파일
PDF 등 사용자가 만든 파일의 메타데이터. 파일 자체는 비공개 저장소에 보관.
본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `source_type` | text | 출처 (`submission`/`report`/`library_selection`) |
| `source_id` | uuid | 출처 데이터 |
| `storage_path` | text | 파일 저장 위치 |
| `options` | json | 생성 옵션 |
| `status` | text | 상태 (`queued`/`ready`/`failed`) |
| `created_at`, `ready_at` | 시각 | 요청·완료 시각 |

### 6.7 알림

#### `notification_settings` — 알림 설정
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `user_id` | uuid | 사용자 |
| `reminder_time` | 시각 | 리마인더 시간 |
| `reminder_days` | 배열 | 리마인더 요일 |
| `channels` | 배열 | 알림 채널 |
| `timezone` | text | 시간대 |
| `updated_at` | 시각 | 수정 시각 |

#### `notification_log` — 알림 발송 이력
사용자는 본인 이력만 읽고, 발송 기록 작성은 서버 측에서 합니다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `channel` | text | 발송 채널 |
| `template_key` | text | 사용한 템플릿 |
| `status` | text | 발송 상태 |
| `payload` | json | 부가 정보 |
| `sent_at`, `created_at` | 시각 | 발송·기록 시각 |

### 6.8 결제

#### `subscription_plans` — 플랜 카탈로그
페이월에서 보여줄 플랜 목록.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `plan_key` | text | 플랜 식별 키 |
| `name` | text | 플랜 이름 |
| `cadence` | text | 결제 주기 |
| `price_cents` | 정수 | 가격(센트 단위) |
| `currency` | text | 통화 |
| `features` | json | 포함 기능 |
| `recommended` | 불리언 | 추천 플랜 표시 |
| `active` | 불리언 | 노출 여부 |

#### `subscriptions` — 구독 상태
본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `plan_key` | text | 구독 플랜 |
| `billing_cadence` | text | 결제 주기 |
| `status` | text | 구독 상태 |
| `current_period_start`, `current_period_end` | 시각 | 현재 결제 기간 |
| `cancel_at` | 시각 | 해지 예정 시각 |
| `provider`, `provider_subscription_id` | text | 결제 제공사 정보 |

#### `payment_history` — 결제 이력
본인만 접근.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `subscription_id` | uuid | 관련 구독 |
| `amount_cents` | 정수 | 결제 금액(센트) |
| `currency` | text | 통화 |
| `status` | text | 결제 상태 |
| `receipt_url` | text | 영수증 링크 |
| `paid_at` | 시각 | 결제 시각 |

### 6.9 약관·동의

#### `legal_documents` — 버전별 약관 문서
약관·개인정보 문서를 **버전마다 한 줄씩** 저장. 기존 줄은 고치지 않고 새
버전을 추가합니다(이력 보존). 공개된 문서는 로그인 전에도 누구나 읽을 수 있습니다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `doc_type` | text | 문서 종류 (`terms`/`privacy`) |
| `version` | text | 버전 표기 |
| `locale` | text | 언어 (`ko`/`en`/`vi`) |
| `title`, `body`, `summary` | text | 제목·본문·요약 |
| `is_placeholder` | 불리언 | 임시 자리표시 여부 |
| `requires_consent` | 불리언 | 동의가 필요한 문서인지 |
| `status` | text | 상태 (`draft`/`published`/`archived`) |
| `effective_at` | 시각 | 시행 시각 |

#### `user_consents` — 동의 기록
사용자가 어떤 약관 버전을 언제 동의했는지의 기록. 한 번 남기면 바뀌지
않습니다(추가만). 본인만 읽기(관리자 읽기 가능).

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `user_id` | uuid | 사용자 |
| `document_id` | uuid | 동의한 문서 |
| `doc_type` | text | 문서 종류 (`terms`/`privacy`) |
| `version` | text | 동의한 버전 |
| `source` | text | 동의 경로 (`signup`/`re_consent`/`settings`) |
| `accepted_at` | 시각 | 동의 시각 |

### 6.10 관리자 *(관리자 영역)*

#### `admin_audit_logs` — 관리자 작업 기록
관리자 작업을 변경 전/후 차이와 함께 남깁니다. 추가만 가능(고치거나 지울 수 없음).

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | 기본키 |
| `admin_user_id` | uuid | 작업한 관리자 |
| `action` | text | 작업 종류 |
| `target_table`, `target_id` | text | 대상 |
| `diff` | json | 변경 전/후 차이 |
| `payload` | json | 부가 정보 |
| `created_at` | 시각 | 시각 |

#### 조직 테이블 *(관리자 영역, 현재 사용자 앱 미사용)*
조직 디렉터리, 조직 멤버십, 조직 과제, 과제 제출을 담는 테이블들이 있으나,
사용자용 앱에서는 직접 쓰지 않습니다. 관리자 앱 영역에 속합니다.

---

## 7. 상태값(열거형) 모음

> 표시된 값 외의 값은 허용되지 않습니다. 단, 일부 신규 컬럼은 코드 체계가
> 확정되기 전이라 현재 비어 있을 수 있습니다(아래 표시).

| 대상 | 허용 값 |
| --- | --- |
| 계정 상태 (`profiles.status`) | `active`, `blocked`, `deleted` |
| 권한 등급 (`profiles.app_role`) | `learner`, `content_admin`, `org_admin`, `platform_admin` |
| 앱 언어 (`profiles.ui_locale`) | `ko`, `en`, `vi` |
| 학습 목표 시험 (`learning_goals.topik_level`) | `TOPIK_I`, `TOPIK_II` |
| 문제 출처 (`problems.source`) | `ai_generated`, `curated` |
| 문제 영역 (`problems.domain`) | `reading`, `listening`, `writing` |
| 문제 공개 (`problems.publish_status`) | `draft`, `published`, `archived` |
| 문제 검수 결과 (`problems.review_status`) | `pending`, `approved`, `rejected` |
| 문제 검수 단계 (`problems.review_workflow_status`) | (코드 확정 전 — 현재 비어 있을 수 있음) |
| 문제 주제 (`problems.topic_category_code`) | (코드 확정 전 — 현재 비어 있을 수 있음) |
| 문제 수명 (`problems.lifecycle_status`) | `active`, `inactive`, `expired` |
| 문제 노출 (`problems.visibility`) | `private`, `public`, `org` |
| 자료 종류 (`problem_assets.asset_type`) | `image`, `audio` |
| 객관식 풀이 (`problem_attempts.status`) | `started`, `submitted`, `reviewed` |
| 쓰기 문제 번호 (`question_no`) | `51`, `52`, `53`, `54` |
| 자동저장 (`writing_drafts.autosave_status`) | `clean`, `dirty`, `syncing`, `failed`, `superseded` |
| 제출 피드백 (`writing_submissions.feedback_status`) | `pending`, `analyzing`, `complete`, `failed` |
| 피드백 총평 (`writing_feedback.status`) | `partial`, `complete`, `failed` |
| 피드백 영역 (`feedback_dimension_scores.dimension`) | `grammar`, `vocab`, `structure`, `content`, `expression`, `topic_fit` |
| 추천 출처 (`recommendation_runs.source_type`) | `dashboard`, `feedback`, `weakness`, `next_problem` |
| 추천 항목 (`recommendation_items.status`) | `active`, `consumed`, `expired` |
| 서재 종류 (`library_items.item_type`) | `attempt`, `submission`, `report`, `export`, `problem` |
| 활동 종류 (`study_events.event_type`) | `practice_started`, `attempt_submitted`, `draft_autosaved`, `submission_submitted`, `feedback_viewed`, `report_viewed`, `recommendation_clicked`, `export_downloaded` |
| 내보내기 출처 (`export_files.source_type`) | `submission`, `report`, `library_selection` |
| 내보내기 상태 (`export_files.status`) | `queued`, `ready`, `failed` |
| 약관 종류 (`legal_documents.doc_type`) | `terms`, `privacy` |
| 약관 상태 (`legal_documents.status`) | `draft`, `published`, `archived` |
| 동의 경로 (`user_consents.source`) | `signup`, `re_consent`, `settings` |

---

## 8. 파일 저장소

이미지·오디오·PDF 같은 실제 파일은 테이블이 아닌 파일 저장소에 보관하고,
테이블에는 위치만 둡니다.

| 저장소 | 공개 여부 | 용도 |
| --- | --- | --- |
| 아바타 저장소 | 공개 읽기 | 프로필 이미지 |
| 문제 자료 저장소 | 공개 읽기 | 문제 이미지·오디오 |
| 내보내기 저장소 | 비공개 | 사용자가 만든 PDF (본인만 접근) |

- 공개 저장소라도 **업로드·수정·삭제는 권한이 있는 주체만** 가능합니다.
- 내보내기 PDF는 본인 폴더에만 저장·접근할 수 있고, 한 번 만들면 덮어쓰지
  않습니다(필요하면 새로 만듭니다).

---

## 9. 인계 시 꼭 기억할 점

1. **제출본·동의·관리자 기록은 못 고친다.** 이 세 가지는 "추가만" 되는
   보존용 데이터입니다. 바꾸려 하지 말고 새 줄을 추가하세요.
2. **본인 데이터 분리는 DB가 보장한다.** 화면에서 다른 사람 데이터를
   걸러 줄 필요가 없습니다. 단, 우회 경로를 만들지 마세요.
3. **공개 문제만 사용자에게 보인다.** 새 문제는 공개·검수 상태를 맞춰야
   목록에 나옵니다.
4. **관리자·조직 영역은 별도 앱 소유.** 사용자 앱에서 새로 만들거나 확장하지
   않습니다. 스키마는 관리자 쪽을 먼저 따릅니다.
5. **신규 코드 컬럼은 비어 있을 수 있다.** 문제의 주제 분류와 검수 진행
   단계 컬럼은 코드 체계 확정 전이라 값이 비어 있을 수 있습니다. 값이 없다고
   오류로 보지 마세요.
