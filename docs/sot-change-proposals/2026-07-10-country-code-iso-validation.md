# 국가 코드 ISO 3166-1 alpha-2 검증 강화 (implementation brief)

작성일: 2026-07-10

상태: implementation brief (구현 전 승인 필요). net-new data rule이므로 승인 전에는 구현하지 않는다.

## 배경

`profiles.nationality_country_code`와 `profiles.phone_country_code`는 DB 계층에서 **정규식 `^[A-Z]{2}$`로만** 검증된다. 이는 대문자 2글자면 무엇이든 통과시켜, 실제로 배정되지 않은 코드(`ZZ`, `XX`, `QQ` 등)도 저장을 허용한다.

애플리케이션 계층은 이미 실제 ISO 목록으로 제한한다:
- `src/lib/geo/country-codes.ts`: `ISO_COUNTRY_CODES`, `isSupportedCountryCode()`.
- `src/components/shared/CountryRegionSelect.tsx`: 위 목록만 렌더.
- `src/lib/auth/profile-completion.ts:107`: `isRequiredProfileInputValid`가 `isSupportedCountryCode`로 검증.

따라서 UI/서버 액션 경로로는 비정상 코드가 들어오지 않는다. 그러나 DB/RPC를 직접 호출하거나 향후 다른 코드 경로가 생기면 `ZZ` 등이 그대로 저장될 수 있다. **defense-in-depth 데이터 정합성 갭**이다.

## 현재 검증 지점 (근거)

DB CHECK 제약:
- `supabase/migrations/20260617195000_profiles_nationality.sql:19` — `nationality_country_code ~ '^[A-Z]{2}$'`
- `supabase/migrations/20260709153000_profiles_optional_gender_phone.sql:35`, `20260709165000_profiles_split_phone_country_code.sql:21` — `phone_country_code ~ '^[A-Z]{2}$'`

RPC 내부 검증/정규화 (`complete_auth_gate` 계열):
- `20260623103000:135,137`, `20260629120000:81,83`, `20260710094000:97,99` — nationality
- `20260709153000:103,190`, `20260709165000:70,160` — phone_country_code

## 제안 (구현 시)

1. **단일 소스**: DB에 ISO 3166-1 alpha-2 코드 집합을 두고, 앱의 `ISO_COUNTRY_CODES`와 값이 일치하도록 유지한다. 두 방식 중 택1:
   - (A) reference 테이블 `public.iso_country_codes(code text primary key)` seed + `EXISTS` 기반 CHECK/검증.
   - (B) immutable 함수 `private.is_iso_3166_alpha2(text) returns boolean` (정적 배열) 후 CHECK/RPC에서 사용.
   - 권장: (A). 앱 목록과의 drift를 seed 마이그레이션 한 곳에서 관리하고, 추후 목록 갱신이 값 변경만으로 끝난다.
2. **forward-only 마이그레이션**으로:
   - `profiles` CHECK 제약을 정규식 → ISO 집합 검증으로 교체(기존 제약 drop + 신규 add, idempotent).
   - `complete_auth_gate` 계열 RPC의 `^[A-Z]{2}$` 검증을 ISO 집합 검증으로 교체(현재 최신 base는 `20260710094000`; phone은 `20260709165000`).
   - 기존 데이터 중 비-ISO 코드가 있으면 backfill 정책 결정 필요(예: `null`로 정리 또는 유지). **적용 전 실측 필요**.
3. **`ZZ` 취급**: ISO 3166 예약(“unknown”). 앱 목록에 없으므로 **불허**로 통일한다(사용자 선택지에 없음).
4. 앱 계층은 이미 검증하므로 코드 변경은 원칙적으로 불필요. 단 DB 검증 강화 후 오류 메시지 UX 회귀만 확인.

## Acceptance Criteria

- DB에 비-ISO alpha-2 코드(`ZZ`, `XX` 등) 저장 시도가 거부된다(CHECK/RPC 양쪽).
- 유효 ISO 코드(`KR`, `US`, `VN` 등)는 그대로 저장된다.
- 앱 `ISO_COUNTRY_CODES`와 DB 허용 집합이 일치한다(drift 없음).
- 기존 `profiles` 행에 대한 backfill/무결성 영향이 문서화되고, 적용 전 실측으로 검증된다.
- 마이그레이션은 forward-only, idempotent. 원격 적용은 운영 절차 소관(v13에서 원격 apply하지 않음).

## 범위 밖 / 주의

- 국가별 표시명·전화 국가번호 매핑 변경.
- 앱 UI 목록 자체의 변경(추가/삭제).
- 원격 DB 직접 적용 — v13 작업면에서 수행하지 않는다.

## 검토한 대안

- **현행 유지(정규식)**: 앱이 이미 막으므로 사용자 경로 위험은 낮음. 그러나 직접 RPC/API·향후 신규 경로에서 무결성 보장 없음. 감사에서 지적된 갭이라 강화 권장.
- **앱 계층만 강화**: 이미 강화돼 있어 추가 이득 없음. DB 갭이 핵심.
