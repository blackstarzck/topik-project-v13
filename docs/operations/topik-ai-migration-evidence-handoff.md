# 승격 DB 게이트 마이그레이션 증거 handoff

| 항목 | 값 |
| --- | --- |
| 상태 | 실행 대기 handoff |
| 인계자 | TALKPIK AI v13 클라이언트 |
| 인수 owner | topik-ai DB·운영 |
| 대상 | `topik-dev` 검증과 `topik-prod` 수동 적용 |
| 마지막 검토 | 2026-07-30 |
| 완료 판정 | 아래 계약대로 만든 증거 파일이 v13 승격 executor의 DB gate를 통과하고, 같은 SHA의 production 적용 기록이 남았을 때 |

## 1. 목적과 경계

v13 승격 파이프라인은 Black `main`의 정확한 SHA를 Keduall `stg`로 올린 뒤, production으로 넘어가기 전에 데이터베이스 gate를 통과해야 한다. v13 작업면은 원격 데이터베이스를 조회하거나 변경하지 않는다. 따라서 gate에 필요한 사실은 topik-ai의 운영 절차가 만들어 JSON 파일 하나로 전달하고, v13 executor는 그 파일을 안전하게 읽어 계약대로 검증만 한다.

- v13은 증거를 만들지 않는다. 값을 추정하거나 기본값으로 채우지 않으며, 빠진 항목은 통과시키지 않는다.
- v13은 원격 데이터베이스에 schema·data를 적용하지 않는다. production 적용은 topik-ai의 trusted operations 절차만 수행한다.
- 자동 적용은 반드시 비활성이어야 한다. 증거에 자동 적용이 켜진 것으로 표시되면 gate는 즉시 차단한다.
- 실패 복구는 forward-fix만 허용한다. 이미 적용된 migration을 되돌리거나 고쳐 쓰는 복구는 계약 위반이다.

## 2. 증거 파일의 위치와 형식

| 항목 | 값 |
| --- | --- |
| 두는 곳 | `%LOCALAPPDATA%\TalkpikPipeline\db-evidence\` 아래 |
| 형식 | UTF-8 JSON 객체 하나 |
| 크기 상한 | 256 KiB |
| 파일 조건 | 일반 파일이어야 하며 symbolic link·reparse point를 거치면 거부 |
| 사용 방법 | `pnpm release:exec -- next --repo <기준-checkout> --run-id <run-id> --db-evidence <파일 경로>` |

허용 폴더 밖 경로, 폴더 탈출 경로, symbolic link, 일반 파일이 아닌 대상, 크기 초과, JSON 파싱 실패는 각각 `DB_EVIDENCE_PATH_ESCAPE`, `DB_EVIDENCE_SYMLINK`, `DB_EVIDENCE_UNREADABLE`, `DB_EVIDENCE_TOO_LARGE`, `DB_EVIDENCE_INVALID_JSON`으로 거부한다. 이 검사는 의미 검증보다 먼저 실행되고, 어떤 원격 작업보다 앞선다.

증거에는 secret, token, 연결 문자열, service-role key, 명령 출력 원문을 담지 않는다. 아래 표의 field 외에 다른 key가 하나라도 있으면 gate는 차단한다.

## 3. 필수 field 계약

아래 18개 field가 전부이며 하나도 생략할 수 없다. `자리 표시` 열의 `SHA-256`은 소문자 16진수 64자, `timestamp`는 숫자 14자다.

| field | 자리 표시 | 의미 | 통과 조건 |
| --- | --- | --- | --- |
| `productionProjectIdentityHash` | SHA-256 | 적용 대상 production project를 식별하는 안전한 hash | 형식이 맞아야 한다 |
| `remoteTrackerDigest` | SHA-256 | 원격 migration tracker 목록 전체의 digest | 형식이 맞아야 한다 |
| `trackerIsExactManifestPrefix` | 참·거짓 | 원격 tracker가 저장소 manifest의 정확한 앞부분인지 | 반드시 참 |
| `schemaRpcRlsGrantFingerprint` | SHA-256 | 적용 후 schema·RPC·RLS·권한 상태의 fingerprint | 형식이 맞아야 한다 |
| `appliedMigrationManifestDigest` | SHA-256 | 적용한 migration manifest의 digest. 승격 기록에 그대로 보관된다 | 형식이 맞아야 한다 |
| `backupPitrEvidenceDigest` | SHA-256 | 적용 직전 backup·PITR 확인 증거의 digest | 형식이 맞아야 한다 |
| `pinnedToolchainDigest` | SHA-256 | 고정한 Supabase CLI·action 버전 조합의 digest | 형식이 맞아야 한다 |
| `previousMaxTimestamp` | timestamp | 적용 전 원격에 이미 있던 마지막 migration의 timestamp | 숫자 14자여야 한다 |
| `newMigrations` | 목록 | 이번에 새로 적용한 migration 목록 | 아래 3-1 조건 |
| `historicalChanges` | 목록 | 과거 migration이 수정·삭제·이름 변경된 내역 | 반드시 빈 목록 |
| `dryRunDigest` | SHA-256 | 예행 적용 결과의 digest | 형식이 맞아야 한다 |
| `applyDigest` | SHA-256 | 실제 적용 결과의 digest | 형식이 맞고 `dryRunDigest`와 같아야 한다 |
| `destructiveSql` | 참·거짓 | 파괴적 SQL이 포함됐는지 | 반드시 거짓 |
| `grantRevocation` | 참·거짓 | 권한 회수가 포함됐는지 | 반드시 거짓 |
| `compatibilityBreak` | 참·거짓 | 앱 호환성이 깨지는 변경이 포함됐는지 | 반드시 거짓 |
| `nMinusOneTopikDevPassed` | 참·거짓 | 이전 앱 버전으로 `topik-dev` 호환성 검증을 통과했는지 | 반드시 참 |
| `nTopikDevPassed` | 참·거짓 | 이번 앱 버전으로 `topik-dev` 호환성 검증을 통과했는지 | 반드시 참 |
| `autoApplyEnabled` | 참·거짓 | production 자동 적용 상태 | 반드시 거짓 |

### 3-1. `newMigrations` 항목 계약

각 항목은 아래 3개 key만 가진다.

| key | 자리 표시 | 통과 조건 |
| --- | --- | --- |
| `path` | 문자열 | `supabase/migrations/<timestamp>_<소문자·숫자·밑줄>.sql` 형식이어야 한다 |
| `timestamp` | timestamp | 숫자 14자이고 `previousMaxTimestamp`보다 커야 한다 |
| `sha256` | SHA-256 | 해당 파일 내용의 digest |

새 migration이 없으면 빈 목록으로 둔다. 항목 하나라도 `previousMaxTimestamp`보다 작거나 같으면 과거 구간에 끼워 넣은 변경으로 보고 차단한다.

### 3-2. `historicalChanges` 항목 계약

각 항목은 `path`와 `change` 두 key만 가진다. 이 목록은 진단용이며 항목이 하나라도 있으면 gate는 차단한다. 과거 migration을 고치는 대신 새 timestamp의 forward migration을 추가한다.

## 4. 판정 결과와 다음 행동

| 결과 코드 | 뜻 | 승격 상태 | 다음 행동 |
| --- | --- | --- | --- |
| `DB_GATE_PASSED_MANUAL_APPLY` | 계약을 모두 만족했고 자동 적용은 계속 비활성 | 사람 최종 승인 대기 또는 승인 완료로 진행 | production 승격 절차를 이어간다 |
| `DB_BASELINE_REQUIRED` | 증거가 없거나 기준선 항목의 형식이 맞지 않음 | 기준선 필요 | 빠진 항목을 실제로 측정해 다시 제출한다 |
| `DB_GATE_BLOCKED` | 허용되지 않은 key, 과거 변경, 예행·실제 불일치, 파괴적 변경, 권한 회수, 호환성 실패 | 차단 | 원인을 forward-fix로 해결한 뒤 새 증거를 제출한다 |
| `DB_AUTO_APPLY_DISABLED` | 자동 적용이 켜진 것으로 표시됨 | 차단 | 자동 적용을 끄고 수동 적용 기록으로 다시 만든다 |

차단된 뒤 같은 파일로 다시 실행하면 같은 결과가 나온다. v13의 `run` 반복 실행은 차단을 감지하면 즉시 멈추고 같은 증거로 재시도하지 않는다. 증거를 고쳐 다시 제출하는 것은 사람의 결정이다.

gate를 통과하면 v13은 증거 원문을 승격 기록에 저장하지 않고 manifest digest와 증거 digest만 남긴다. 사후 감사를 위해 제출한 event 사본은 기준 checkout의 Git 공용 폴더 안 승격 증거 폴더에만 원자적으로 기록되며, token 유사 key·값이 있으면 사본을 만들지 않고 거부한다.

## 5. topik-ai가 남길 handback 항목

이 절은 gate가 읽는 JSON 파일의 내용이 아니라, 사람이 주고받는 인계 기록이다. gate 스키마는 3절의 18개 field로 닫혀 있고 다른 key가 하나라도 늘어나면 차단하므로, 아래 항목을 증거 JSON 안에 넣으면 안 된다. executor는 증거 JSON만 읽고 이 인계 기록은 읽지 않는다. 인계 기록은 topik-ai의 운영 절차 문서와 승격 작업 보고로 전달·보관하며, gate 판정에는 쓰이지 않는다.

secret과 실제 사용자 데이터를 제외하고 다음을 인계 기록으로 남긴다.

| 인계 항목 | gate 증거에서 대응하는 값 |
| --- | --- |
| 적용한 migration 경로·timestamp·checksum 목록 | `newMigrations` 항목이 같은 사실을 담는다 |
| 적용 전후 원격 tracker 상태 | `remoteTrackerDigest`와 `trackerIsExactManifestPrefix`가 digest·판정으로만 담는다 |
| `topik-dev` 이전·현재 앱 버전 호환성 검증 결과 | `nMinusOneTopikDevPassed`, `nTopikDevPassed` |
| 예행 적용과 실제 적용 결과가 같다는 확인 | `dryRunDigest`와 `applyDigest`가 같아야 한다 |
| 사용한 고정 tool 버전 | `pinnedToolchainDigest`가 digest로만 담는다 |
| backup·PITR 확인 사실 | `backupPitrEvidenceDigest`가 digest로만 담는다 |
| 적용 대상 논리 환경 이름, 적용 시각 | gate 증거에 없다. 인계 기록에만 남긴다 |
| backup·PITR 확인 시각과 확인자 | gate 증거에 없다. 인계 기록에만 남긴다 |
| 증거 JSON 파일의 경로와 checksum | gate 증거에 없다. 인계 기록에만 남긴다 |

마지막 세 항목을 gate가 직접 검사하게 만들려면 3절의 닫힌 스키마를 늘려야 한다. 스키마를 늘리면 승격 기록의 계약이 함께 바뀌므로 별도 승인이 필요한 후속 작업으로 남긴다.

## 6. 제외 범위

- production 자동 적용, destructive migration, 권한 회수는 이 handoff의 범위가 아니며 각각 별도 승인 절차를 따른다.
- production credential은 v13 로컬 에이전트나 candidate PR에 전달하지 않는다.
- v13 에이전트는 증거 값을 만들거나 보정하지 않고, 원격 데이터베이스를 직접 조회하지 않는다.
- 적용 실패의 되돌림(rollback)은 제공하지 않는다. 배포 실패 시 alias만 이전 `READY` 배포로 되돌리며 데이터베이스는 되돌리지 않는다.
