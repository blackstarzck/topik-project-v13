-- down: 20260710095000_profiles_country_code_iso_check 롤백.
--
-- 두 CHECK 제약을 직전 정의로 되돌린 뒤 public.is_supported_country_code(text)
-- 를 제거한다:
--   * profiles_phone_country_code_check
--       → 20260709165000 의 '^[A-Z]{2}$' 모양 검사(느슨한 집합)
--   * profiles_nationality_country_code_format
--       → 20260617195000 의 인라인 249개 ISO 배열(수용 집합은 forward 와 동일)
-- 두 제약이 함수를 참조하므로 반드시 제약을 먼저 재작성하고 함수를 drop 한다.
-- 원본 nationality 제약은 NOT VALID 없이 추가되었지만 최종 카탈로그 상태가
-- 같은 not valid + validate 로 복원한다(락 시간 단축). forward 이후 저장된
-- 값은 모두 ISO 집합이므로 두 VALIDATE 는 백필 없이 통과한다.
--
-- 기능 경고: 이미 적용된 20260718120000 의 complete_auth_gate(jsonb 오버로드)
-- 는 본문에서 public.is_supported_country_code 를 호출한다(B10 이 바로 그
-- 런타임 의존성 때문에 승격 적용되었다). 이 down 이후 온보딩 게이트는 42883
-- 을 다시 던진다 — 그것이 B10 적용 전의 원래 상태다. 앱 버전 동시 롤백을
-- 포함한 창 전체 롤백의 일부로만 실행한다(전체 롤백 역순의 첫 번째 파일).

begin;

-- phone_country_code: ISO 집합 -> [A-Z]{2} 모양 검사로 복원.
alter table public.profiles
  drop constraint if exists profiles_phone_country_code_check;

alter table public.profiles
  add constraint profiles_phone_country_code_check
  check (
    phone_country_code is null
    or phone_country_code ~ '^[A-Z]{2}$'
  ) not valid;

alter table public.profiles
  validate constraint profiles_phone_country_code_check;

-- nationality_country_code: 함수 참조 -> 인라인 249개 배열로 복원(집합 동일).
alter table public.profiles
  drop constraint if exists profiles_nationality_country_code_format;

alter table public.profiles
  add constraint profiles_nationality_country_code_format
  check (
    nationality_country_code is null
    or (
      nationality_country_code ~ '^[A-Z]{2}$'
      and nationality_country_code = any (array[
        'AD'::text, 'AE'::text, 'AF'::text, 'AG'::text,
        'AI'::text, 'AL'::text, 'AM'::text, 'AO'::text,
        'AQ'::text, 'AR'::text, 'AS'::text, 'AT'::text,
        'AU'::text, 'AW'::text, 'AX'::text, 'AZ'::text,
        'BA'::text, 'BB'::text, 'BD'::text, 'BE'::text,
        'BF'::text, 'BG'::text, 'BH'::text, 'BI'::text,
        'BJ'::text, 'BL'::text, 'BM'::text, 'BN'::text,
        'BO'::text, 'BQ'::text, 'BR'::text, 'BS'::text,
        'BT'::text, 'BV'::text, 'BW'::text, 'BY'::text,
        'BZ'::text, 'CA'::text, 'CC'::text, 'CD'::text,
        'CF'::text, 'CG'::text, 'CH'::text, 'CI'::text,
        'CK'::text, 'CL'::text, 'CM'::text, 'CN'::text,
        'CO'::text, 'CR'::text, 'CU'::text, 'CV'::text,
        'CW'::text, 'CX'::text, 'CY'::text, 'CZ'::text,
        'DE'::text, 'DJ'::text, 'DK'::text, 'DM'::text,
        'DO'::text, 'DZ'::text, 'EC'::text, 'EE'::text,
        'EG'::text, 'EH'::text, 'ER'::text, 'ES'::text,
        'ET'::text, 'FI'::text, 'FJ'::text, 'FK'::text,
        'FM'::text, 'FO'::text, 'FR'::text, 'GA'::text,
        'GB'::text, 'GD'::text, 'GE'::text, 'GF'::text,
        'GG'::text, 'GH'::text, 'GI'::text, 'GL'::text,
        'GM'::text, 'GN'::text, 'GP'::text, 'GQ'::text,
        'GR'::text, 'GS'::text, 'GT'::text, 'GU'::text,
        'GW'::text, 'GY'::text, 'HK'::text, 'HM'::text,
        'HN'::text, 'HR'::text, 'HT'::text, 'HU'::text,
        'ID'::text, 'IE'::text, 'IL'::text, 'IM'::text,
        'IN'::text, 'IO'::text, 'IQ'::text, 'IR'::text,
        'IS'::text, 'IT'::text, 'JE'::text, 'JM'::text,
        'JO'::text, 'JP'::text, 'KE'::text, 'KG'::text,
        'KH'::text, 'KI'::text, 'KM'::text, 'KN'::text,
        'KP'::text, 'KR'::text, 'KW'::text, 'KY'::text,
        'KZ'::text, 'LA'::text, 'LB'::text, 'LC'::text,
        'LI'::text, 'LK'::text, 'LR'::text, 'LS'::text,
        'LT'::text, 'LU'::text, 'LV'::text, 'LY'::text,
        'MA'::text, 'MC'::text, 'MD'::text, 'ME'::text,
        'MF'::text, 'MG'::text, 'MH'::text, 'MK'::text,
        'ML'::text, 'MM'::text, 'MN'::text, 'MO'::text,
        'MP'::text, 'MQ'::text, 'MR'::text, 'MS'::text,
        'MT'::text, 'MU'::text, 'MV'::text, 'MW'::text,
        'MX'::text, 'MY'::text, 'MZ'::text, 'NA'::text,
        'NC'::text, 'NE'::text, 'NF'::text, 'NG'::text,
        'NI'::text, 'NL'::text, 'NO'::text, 'NP'::text,
        'NR'::text, 'NU'::text, 'NZ'::text, 'OM'::text,
        'PA'::text, 'PE'::text, 'PF'::text, 'PG'::text,
        'PH'::text, 'PK'::text, 'PL'::text, 'PM'::text,
        'PN'::text, 'PR'::text, 'PS'::text, 'PT'::text,
        'PW'::text, 'PY'::text, 'QA'::text, 'RE'::text,
        'RO'::text, 'RS'::text, 'RU'::text, 'RW'::text,
        'SA'::text, 'SB'::text, 'SC'::text, 'SD'::text,
        'SE'::text, 'SG'::text, 'SH'::text, 'SI'::text,
        'SJ'::text, 'SK'::text, 'SL'::text, 'SM'::text,
        'SN'::text, 'SO'::text, 'SR'::text, 'SS'::text,
        'ST'::text, 'SV'::text, 'SX'::text, 'SY'::text,
        'SZ'::text, 'TC'::text, 'TD'::text, 'TF'::text,
        'TG'::text, 'TH'::text, 'TJ'::text, 'TK'::text,
        'TL'::text, 'TM'::text, 'TN'::text, 'TO'::text,
        'TR'::text, 'TT'::text, 'TV'::text, 'TW'::text,
        'TZ'::text, 'UA'::text, 'UG'::text, 'UM'::text,
        'US'::text, 'UY'::text, 'UZ'::text, 'VA'::text,
        'VC'::text, 'VE'::text, 'VG'::text, 'VI'::text,
        'VN'::text, 'VU'::text, 'WF'::text, 'WS'::text,
        'YE'::text, 'YT'::text, 'ZA'::text, 'ZM'::text,
        'ZW'::text
      ])
    )
  ) not valid;

alter table public.profiles
  validate constraint profiles_nationality_country_code_format;

drop function if exists public.is_supported_country_code(text);

commit;
