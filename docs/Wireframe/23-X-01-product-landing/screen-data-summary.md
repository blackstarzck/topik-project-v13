# X-01 제품 랜딩 화면 데이터 계약

## 화면 요약
비로그인 또는 신규 사용자가 제품 가치, 기능, 시작 CTA, 가격 정보를 보는 공개 진입 화면이다.

이 문서는 사용자 화면이 소비하는 운영/관리 대상 데이터만 정리한다. 관리자 전용 화면 구현이나 관리자 스키마 확장은 이번 범위에 포함하지 않는다.

## 기준 소스
| 우선순위 | 소스 | 적용 |
| --- | --- | --- |
| 1 | description.md | 사용 |
| 2 | functional-spec.md | 보조 |
| 3 | hifi.png | 보조 |
| 4 | wireframe.png | 보조 |

소스 우선순위는 description.md, functional-spec.md, hifi.png, wireframe.png 순서다. 문서와 이미지가 다르면 description.md 기준으로 확정한다.

## 사용자 화면 표시 데이터
- 브랜드/헤더
- 가치 제안 문구
- 시작 CTA
- 기능 카드
- 제품 미리보기
- 플랜/가격 요약

## 사용자 입력/상태 데이터
- 시작 CTA 클릭
- 헤더 로그인/히어로 가입 클릭
- 가격 카드 클릭
- 섹션 이동

## 운영/관리 대상 데이터 계약
| 데이터 | 분류 | 확정 계약 | 메모 |
| --- | --- | --- | --- |
| 플랜/가격 표시 | 현재 스키마로 충족 | subscription_plans가 active plan의 이름, 주기, 가격, 통화, 기능, 추천 여부를 제공한다. | authenticated read 정책이 있다. |
| 로그인 사용자 CTA 분기 | 현재 스키마로 충족 | profiles와 subscriptions로 로그인 사용자와 구독 상태에 따른 CTA 분기를 보조할 수 있다. | 비로그인 사용자는 Auth 상태만 본다. |
| 랜딩 문구/기능 카드 | 스키마 보강 필요 | 히어로 문구, 기능 카드, 제품 미리보기 콘텐츠를 운영 데이터로 관리하는 구조는 없다. | 현재는 정적/앱 문구 중심이다. |

## Supabase 테이블 스키마 정보
| 객체 | 화면 역할 | migration 기준 |
| --- | --- | --- |
| subscription_plans | 플랜/가격/혜택 표시 | 20260602120100_billing.sql: plan_key, name, cadence, price_cents, currency, features, recommended, active, created_at, updated_at. |
| subscriptions | 현재 구독자 분기 | 20260602120100_billing.sql: id, user_id, plan_key, billing_cadence, status, current_period_start, current_period_end, cancel_at, provider, provider_subscription_id, created_at, updated_at. |
| profiles | 로그인 사용자 CTA 분기 | 20260520120100_profiles_goals.sql, 20260521141000_phase_6_notification_prefs.sql, 20260526170000_phase_7_profile_bio.sql, 20260602120200_notifications_and_settings.sql: id, display_name, nickname, avatar_path, ui_locale, app_role, plan_label, status, notification_prefs, bio, learning_locale, content_prefs. |

## 저장/조회/이벤트 흐름
랜딩은 active subscription_plans를 읽어 가격 영역을 표시한다. CTA는 Auth 상태와 subscription 상태에 따라 가입, 대시보드, 결제 화면으로 이동한다.

## RLS/권한 기준
- subscription_plans는 active plan만 authenticated 사용자에게 읽힌다.
- subscriptions와 profiles는 본인 row만 읽는다.
- subscription_plans는 active plan을 authenticated 사용자가 읽을 수 있고 쓰기는 운영 권한 흐름이다.
- subscriptions는 본인 select만 가능하고 쓰기는 결제 서비스 권한 흐름이다.
- profiles는 본인 select/update가 가능하지만 app_role, plan_label, status는 보호 컬럼이다.

## 스키마 정합성 메모
가격 catalog는 현재 스키마로 충족된다. 마케팅 콘텐츠 운영 구조는 없다.

## 검수 필요 항목
- 비로그인 사용자의 가격 표시를 public API로 둘지 authenticated 전환 뒤 표시할지 정한다.
- 랜딩 문구 변경 주체와 저장소를 정한다.
