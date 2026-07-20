# 환경 및 에이전트 안전 정책

| 항목        | 값                                                        |
| ----------- | --------------------------------------------------------- |
| 상태        | 활성 정책                                                 |
| owner       | TALKPIK AI v13 클라이언트 운영                            |
| 범위        | 로컬·Preview·Production 환경 연결과 AI 에이전트 행위 경계 |
| 마지막 검토 | 2026-07-18                                                |
| 재검토      | Vercel·Supabase 환경 또는 권한 경계 변경 때마다           |

## 실행 환경 매핑

| 실행면                                   | 연결 대상    | 허용되는 클라이언트 범위                                                                                                                                                                  |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로컬 Supabase stack                      | loopback URL | `SUPABASE_LOCAL_STACK=1`과 `E2E_ALLOW_DEV_DB_MUTATION=1`을 모두 명시하고 승인된 env 준비 도구와 로컬 E2E 프로세스가 값을 노출하지 않은 채 사용하는 경우에만 로컬 테스트 write를 허용한다. |
| 로컬 개발 실행                           | `topik-dev`  | 공개 클라이언트 경로를 기본으로 사용한다. 원격 변경 검증은 명시 승인과 격리된 테스트 데이터가 있을 때만 허용한다.                                                                         |
| Vercel Preview                           | `topik-dev`  | 공개 클라이언트와 신뢰된 Next.js 서버 경로 전용 secret을 각자 맞는 Vercel scope에 둔다. 에이전트가 실행하는 DB create/update/delete, submission, schema apply는 허용하지 않는다.            |
| Vercel Production 프로젝트 `dotoretopik` | `topik-prod` | 운영 공개 클라이언트와 운영 서버 전용 secret을 Production scope에 둔다. 에이전트의 브라우저 확인은 읽기 전용으로 제한한다.                                                               |

실제 연결 대상은 배포·실행 시 주입된 URL에서 판정한다. Git branch, remote 이름, worktree 이름, `topik-dev`·`topik-prod` 같은 label이나 Vercel 화면 이름만으로 쓰기를 허용하지 않는다. 환경 값 자체는 출력하지 않고 정제된 판정 결과만 남긴다.

## 원격 쓰기 사전검증

- URL host가 loopback임을 확인한 로컬 Supabase stack은 원격 환경과 분리해 판정한다. privileged mutation 대상은 DNS 이름 `localhost`를 허용하지 않고 숫자 주소 `127.0.0.1` 또는 `::1`만 허용한다. 일반 공개 로컬 앱과 Playwright 앱 runtime은 `localhost`를 사용할 수 있다.
- 원격 dev write는 코드에 고정된 dev ref `fglggyfvzjdsbyckinqa`와 실제 runtime URL에서 추출한 ref가 모두 `fglggyfvzjdsbyckinqa`로 정확히 일치할 때만 환경 사전검증을 통과한다. 이 검증만으로 write가 승인되지는 않으며 명시 승인·격리 계정·고유 테스트 데이터 조건도 충족해야 한다.
- 실제 URL에서 추출한 ref가 prod ref `eymlabowhfgtxbiqwxqh`이면 원격 자동 write를 금지한다. ref를 추출할 수 없거나 dev ref와 다를 때도 fail-closed한다.
- 두 ref는 환경 동일성 비교를 위한 공개 식별자이지 credential이나 권한이 아니다. key·token·전체 URL은 이 판정 결과에 포함하지 않는다.
- 표준 Playwright account setup은 위 원격 dev write 예외를 사용하지 않는다. loopback URL과 두 명시 플래그를 모두 확인한 로컬 stack에서만 실행하며 Preview·Production과 hosted dev에서는 실행하지 않는다.

## 에이전트 허용·금지 행위

Vercel의 서버 전용 secret은 쓰기 제출, quota 확정·해제, 평가 동기화, 알림처럼 제품이 정상 동작하는 데 필요한 신뢰된 서버 경로에서만 사용한다. 이는 브라우저 credential도, 에이전트의 원격 쓰기 권한도 아니다. Preview에는 `topik-dev`, Production에는 `topik-prod`의 대응 값을 Vercel이 런타임에 주입하고, 값은 source·로그·빌드 산출물·브라우저 bundle에 포함하지 않는다.

| 행위                                                                                                      | 로컬 파일·테스트                           | `topik-dev`                                                                                           | `topik-prod`                          |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 문서·source 읽기, 격리 worktree 편집, 정적 검사·unit test                                                 | 허용                                       | 해당 없음                                                                                             | 해당 없음                             |
| 공개 클라이언트를 통한 읽기 확인                                                                          | 허용                                       | 허용                                                                                                  | 명시된 운영 확인에서 읽기 전용만 허용 |
| 공개 클라이언트를 통한 create/update/submission                                                           | loopback 로컬 stack의 자체 데이터만 허용   | 위 ref 사전검증과 명시 승인·격리 계정·고유 테스트 데이터가 모두 있을 때만 허용; Preview 자동화는 금지 | 금지                                  |
| SQL 실행, migration/schema/data 원격 apply                                                                | 로컬 Supabase stack에서 승인된 작업만 허용 | 금지                                                                                                  | 금지                                  |
| backup, restore, retention 변경, drill 실행, 사용자·운영 데이터 삭제                                      | 해당 운영 저장소 절차가 아니면 금지        | 금지                                                                                                  | 금지                                  |
| 에이전트가 `service_role`, secret key, private key, token 값을 직접 읽거나 출력·로그·문서화·브라우저 전달 | 금지                                       | 금지                                                                                                  | 금지                                  |
| 승인된 env 준비 도구와 로컬 E2E 프로세스가 값을 노출하지 않고 사용                                        | loopback target에서만 허용                 | 에이전트 사용 금지; 제품의 신뢰된 서버 경로만 Vercel 주입 값을 사용                                     | 에이전트 사용 금지; 제품의 신뢰된 서버 경로만 Vercel 주입 값을 사용 |

브라우저에서 사용하는 공개 client credential은 RLS를 대체하지 않는다. 공개 credential도 값 자체를 기록하거나 보고서·스크린샷·명령 출력에 노출하지 않는다.

v13 source·script·test에는 Supabase Management API의 원격 SQL endpoint나 `session_replication_role` 우회 경로를 두지 않는다. 기존 원격 SQL canary와 cleanup은 클라이언트 저장소에서 제거하며, 필요한 DB 검증은 topik-ai가 소유한 절차와 증거로 이관한다. v13은 loopback 로컬 stack의 공개·검증된 테스트 경계만 자동 실행한다.

## 출력 정제 규칙

- key, token, cookie, Authorization header, 연결 문자열, 환경 변수 값, 사용자 개인정보와 답안 원문을 terminal·로그·문서·issue·PR·스크린샷에 남기지 않는다. 위의 두 ref는 비밀값이 아니므로 환경 동일성 판정에 사용할 수 있지만 권한 증명으로 취급하지 않는다.
- 환경은 `topik-dev`, `topik-prod` 같은 승인된 논리 이름으로만 보고한다. 필요한 값은 `<redacted>`로 대체하고 길이·접두사·뒷자리도 공개하지 않는다.
- 오류는 작업 종류, 성공·실패, 안전한 다음 행동만 남긴다. 원본 DB/provider 오류, query, 내부 policy/function 이름은 사용자 메시지와 공유 로그에서 제거한다.
- 화면 증거는 민감 영역을 캡처 전에 닫거나 잘라내며, 사후 흐림 처리만을 유일한 보호 수단으로 삼지 않는다.
- secret 노출 가능성이 있으면 값을 재출력해 확인하지 않고 즉시 작업을 중단해 노출 위치와 필요한 폐기·회전 절차만 보고한다.

## 세션·credential 노출 사고 대응

- `.scratch/student-state.json` 같은 세션 파일을 worktree에서 삭제하고 재발을 막아도 Git 이력에 이미 노출된 세션·credential은 폐기되지 않는다. 노출 가능성을 확인한 즉시 운영 owner가 해당 세션을 revoke하고 관련 key·credential을 rotate해야 한다.
- 운영 owner는 노출 범위와 저장소 배포·복제 상태를 확인해 Git history purge가 필요한지 결정하고 별도 승인 절차로 수행한다. 이 저장소의 일반 코드 수정 작업은 원격 revoke·rotate 또는 history rewrite를 대신 실행하지 않는다.
