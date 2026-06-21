# Workspace 본문 컨테이너 폭 통일 proposal

## 제안 요약

51~54번 문제 풀이(쓰기 시험) 편집기 화면을 제외한 모든 workspace 페이지의 본문 컨테이너 폭을 대시보드와 동일한 `workspace`(1152px) variant로 통일한다. 기존에 `form`(640px) variant를 쓰던 설정/프로필 5개 화면(`/profile`, `/settings/account`, `/settings/language`, `/settings/learning`, `/settings/notifications`)은 `WorkspaceBody` 컨테이너를 `workspace`로 올리되, 폼 입력 영역은 가독성을 위해 내부에 좌측 정렬된 `max-width: 640px` 열로 감싼다. 즉 **컨테이너 폭/좌측 정렬은 대시보드와 동일**하게 맞추고, **입력칸은 읽기 편한 폭을 유지**한다. writing 부가 화면 3종(`/writing/feedback/long/[id]`, `/writing/feedback/short/[id]`, `/writing/reports/[id]/compare`)도 본문 콘텐츠를 `workspace`(1152px) 폭으로 정렬한다. 단기 피드백(`feedback/short`)은 풀-블리드 sticky 헤더 바 배경은 그대로 두고, 바 내부 콘텐츠와 본문만 1152px 중앙 정렬로 제한한다. 그 결과 현재 어떤 화면도 `form`(640px) variant를 직접 사용하지 않으며, `form`은 향후 필요 시 쓸 수 있는 사용 가능 variant로만 남는다.

## 변경 이유

- 사용자 요청(2026-06-21): 설정/프로필 화면이 640px 중앙 정렬이라 좌우 여백이 모두 생겨 "오른쪽으로 치우친" 느낌이었고, 좌측 정렬 풀폭인 대시보드와 시각적으로 어긋났다. 모든 화면의 본문 컨테이너 폭과 좌측 시작 위치를 대시보드와 동일하게 맞춰 일관성을 확보한다.
- 컨테이너만 1152px로 올리고 입력칸은 640px 좌측 정렬로 유지하면, 본문 좌측 시작점이 대시보드와 정확히 일치하면서도 입력 폼이 과도하게 가로로 늘어나지 않는다.
- writing 피드백/리포트 화면은 기존에 전용 풀-블리드/무폭제한 레이아웃이라 다른 화면과 폭 기준이 달랐다. 51~54 풀이 편집기만 예외로 두고 나머지를 통일하는 사용자 결정에 따라 이들도 workspace 폭으로 맞춘다.
- 51~54 풀이 편집기(`isWritingExamRoute`)는 사이드바를 숨기고 화면 전체를 쓰는 전용 몰입형 레이아웃이라 통일 대상에서 제외한다.

## 영향 문서

- `docs/ant-design/04-page-patterns-for-talkpik.md`
  - "Workspace body variants" 목록에서 `form (640px): focused settings forms such as language and notifications.` 설명 갱신 필요. 현재는 어떤 활성 화면도 `form`을 직접 사용하지 않으므로, `form`은 "향후 좁은 폼용으로 남겨둔 사용 가능 variant"로 기술하고, 설정/언어/알림 폼은 `workspace` 컨테이너 + 내부 가독 폭(≤640px) 좌측 정렬 열을 사용한다고 명시.
  - `workspace (1152px)` 목록에 `settings/account`, `settings/language`, `settings/learning`, `settings/notifications`, writing 피드백(short/long), comparison report를 포함하도록 갱신. profile은 이미 목록에 있으므로 유지.
  - 설정/프로필 폼은 컨테이너 폭은 `workspace`이되 폼 입력 열은 좌측 정렬 가독 폭(640px)으로 제한한다는 패턴 1줄 추가 권장.

## 수용 기준

- `/profile`, `/settings/account`, `/settings/language`, `/settings/learning`, `/settings/notifications`의 `WorkspaceBody`는 `data-workspace-body-size="workspace"`이며, 본문 컨테이너의 좌측 위치와 폭이 같은 viewport의 `/dashboard`·`/library`·`/practice/next`와 1px 이내로 일치한다.
- 위 5개 화면의 폼 입력 열은 데스크톱에서 약 640px 폭으로 좌측 정렬되어 컨테이너 폭(1152px 한도) 전체로 늘어나지 않는다. 모바일에서는 가용 폭을 채운다.
- `/writing/feedback/long/[id]`, `/writing/reports/[id]/compare` 본문 콘텐츠는 `workspace`(1152px) 한도로 중앙 정렬된다.
- `/writing/feedback/short/[id]`는 sticky 헤더 바 배경은 풀-블리드를 유지하되, 헤더 내부 콘텐츠와 본문 영역은 `workspace`(1152px) 한도로 중앙 정렬된다.
- `/writing/short-answer-writing-51`, `/writing/answer-writing-52`, `/writing/long-form-writing-53`, `/writing/essay-writing-54`(쓰기 시험 편집기)는 기존 전용 전체화면 레이아웃을 그대로 유지하며 이 통일에서 제외된다.
- 데스크톱/모바일 모두에서 위 화면들에 가로 스크롤(overflow)이 발생하지 않는다.
- `form`(640px) variant는 코드/CSS에 정의로 남되, 활성 화면에서 직접 사용되지 않는다.

## 검증 기록 (2026-06-21)

- `pnpm typecheck` 통과, `pnpm lint` 통과(0 errors; 경고는 변경과 무관한 기존 파일).
- 격리된 git worktree + 별도 포트(3210) dev 서버로 직접 브라우저 측정: 설정/프로필 5종 모두 데스크톱(1280)에서 body width=932px·left=324px로 `/dashboard`와 동일, 폼 입력 열 640px, overflow=0. 모바일(390)에서 body width=358·left=16, overflow=0.
- 공식 Playwright `tests/e2e/screens/workspace-layout.spec.ts`(desktop-1280) 통과: "workspace body variants share the same layout contract" 포함 3 passed / 1 skipped(service-role key 필요 fixture). 해당 spec의 `LAYOUT_ROUTES`도 profile·settings를 `form`→`workspace`로 갱신함.
- 잔여 검증 공백: writing 피드백/리포트 3종은 학생 테스트 계정에 제출물 데이터가 없고 `SUPABASE_SERVICE_ROLE_KEY`가 .env.local에 없어 fixture 생성이 불가하여 라이브 렌더 확인을 하지 못함. 변경은 Phase 1에서 검증된 동일 폭 메커니즘(`WorkspaceBody`/`app-workspace-body--workspace`)을 재사용하며, 관련 e2e spec은 service-role key 부재 시 정상 skip되어 회귀 없음.
