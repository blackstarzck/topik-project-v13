# QA 기록 안내

`docs/qa/`는 테스트 계획과 실행 결과를 날짜별로 보존하는 증거 공간이다. 제품 또는 기술 SOT가 아니다.

```text
docs/qa/
├── plan/       실행 전 검증 계획
└── reports/    실행 결과와 발견사항
```

- 새 제품 약속은 `docs/prd.md`, DB 계약은 migration과 `docs/supabase/`, UI 계약은 `DESIGN.md`에서 결정한다.
- 보고서는 작성 당시 baseline을 설명하는 immutable historical evidence다. 나중에 source나 문서 구조가 바뀌어도 과거 결과를 현재 사실처럼 고쳐 쓰지 않는다.
- 과거 보고서의 삭제된 문서·경로 링크는 깨진 active reference가 아니라 기록 당시 Git baseline의 경로다. 필요하면 해당 보고서의 commit에서 확인한다.
- 새 보고서는 날짜, baseline SHA, 범위, 실행 명령과 결과, 미실행 항목, 남은 위험을 기록하고 secret·token·개인정보를 포함하지 않는다.
