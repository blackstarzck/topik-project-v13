#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import {
  buildManifest,
  generatedAt,
  normalizePathText,
  normalizeSlashes,
  parseArgs,
  resolvePath,
  timestampId,
  writeJson,
} from "./ia-audit-lib.mjs";

const DEFAULT_RUN_ROOT = "reports/wireframe-functional-specs/runs";
const SCAN_ROOTS = ["src", "tests", "scripts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const PAGE_DATA_BLUEPRINTS = {
  "A-01": [
    table("profiles", ["id", "email", "display_name", "app_role", "plan_label", "status"], "triggered-write", "회원가입 후 auth.users 트리거가 프로필 기본 row를 만든다."),
    rpc("public.handle_new_user", "trigger", "auth.users 생성 후 public.profiles를 보강한다."),
  ],
  "A-02": [
    table("profiles", ["id", "status", "app_role"], "read", "로그인 후 세션 사용자의 상태와 권한을 확인한다."),
  ],
  "A-03": [
    table("learning_goals", ["user_id", "topik_level", "target_grade", "exam_date", "weekly_goal_minutes", "weak_areas", "is_active"], "read/write", "온보딩 학습 목표를 저장하고 이후 대시보드 추천에 연결한다."),
    table("profiles", ["id", "ui_locale", "status"], "read", "사용자 기본 설정과 onboarding 상태 판단에 사용한다."),
  ],
  "B-01": [
    rpc("public.get_dashboard_kpi", "rpc", "대시보드 KPI 요약을 만든다."),
    table("profiles", ["id", "display_name", "plan_label", "status"], "read", "대시보드 사용자 표시와 권한 상태에 사용한다."),
    table("learning_goals", ["topik_level", "target_grade", "exam_date", "weekly_goal_minutes"], "read", "목표 달성률과 다음 행동 안내에 사용한다."),
    table("writing_feedback", ["submission_id", "score_total", "generated_at"], "read", "최근 첨삭과 점수 요약에 사용한다."),
    table("writing_drafts", ["problem_id", "autosave_status", "updated_at"], "read", "이어 쓸 문제와 자동저장 상태에 사용한다."),
    table("study_events", ["event_type", "occurred_at", "payload"], "derived-read", "학습 연속성, 오늘 활동, 이벤트 기반 KPI에 사용한다."),
    table("recommendation_runs", ["source_type", "reason_summary"], "read", "추천 묶음의 출처와 설명에 사용한다."),
    table("recommendation_items", ["problem_id", "rank", "reason", "status"], "read/update", "추천 카드와 클릭/완료 상태에 사용한다."),
  ],
  "C-01": [
    table("recommendation_runs", ["source_type", "reason_summary", "created_at"], "read", "추천이 어떤 근거로 만들어졌는지 보여준다."),
    table("recommendation_items", ["problem_id", "rank", "reason", "weakness_tags"], "read/update", "추천 유형과 선택 상태를 제공한다."),
    table("feedback_dimension_scores", ["dimension", "score", "weakness_level"], "derived-read", "취약 영역 기반 추천 근거가 된다."),
    table("problems", ["id", "domain", "question_no", "topik_level", "difficulty", "tags"], "read", "추천 문제 후보를 조회한다."),
  ],
  "C-02": [
    rpc("public.list_user_problems", "rpc", "사용자 문제 목록(필터/정렬/시도 상태 포함)을 제공한다."),
    table("problems", ["id", "domain", "question_no", "topik_level", "difficulty", "title", "prompt", "tags", "publish_status", "visibility"], "read", "문제 목록, 필터, 정렬, 상세 진입에 사용한다."),
    table("problem_assets", ["problem_id", "storage_path", "asset_type", "sort_order"], "read", "문제 자료 이미지/오디오를 연결한다."),
    table("problem_attempts", ["problem_id", "status", "is_correct", "bookmarked", "time_spent_seconds"], "read/write", "풀이 이력, 재도전, 북마크 상태에 사용한다."),
    table("writing_drafts", ["problem_id", "autosave_status", "last_saved_at"], "read", "작성 중인 문제 표시와 이어쓰기 CTA에 사용한다."),
  ],
  "C-03": [
    table("problem_attempts", ["problem_id", "status", "is_correct", "submitted_at"], "read/write", "재도전 가능 여부와 새 시도 시작에 사용한다."),
    table("writing_drafts", ["problem_id", "status", "last_saved_at"], "read/update", "이어쓰기 또는 새로 시작 판단에 사용한다."),
  ],
  "D-01": writingPageLinks("51"),
  "D-02": writingPageLinks("52"),
  "D-03": writingPageLinks("53"),
  "D-04": writingPageLinks("54"),
  "D-M1": [
    table("writing_drafts", ["problem_id", "answer_text", "answer_json", "char_count", "autosave_status"], "read", "제출 전 임시 저장 답안을 확인한다."),
    rpc("public.submit_writing_with_feedback", "rpc", "최종 제출과 초기 feedback row 생성을 원자적으로 처리한다."),
    table("writing_submissions", ["problem_id", "answer_text", "char_count", "feedback_status"], "write", "확정 제출본을 만든다."),
  ],
  "D-M2": [
    table("writing_submissions", ["id", "feedback_status", "submitted_at"], "read/update", "AI 분석 대기/완료 상태를 표시한다."),
    table("writing_feedback", ["submission_id", "score_total", "overall_summary", "raw_ai_result"], "read/write", "분석 완료 후 첨삭 결과를 연결한다."),
    rpc("private.set_submission_feedback_status", "function", "service role 전용 상태 전이를 담당한다."),
  ],
  "D-M3": [
    table("writing_drafts", ["autosave_status", "last_saved_at", "answer_text", "char_count"], "read/write", "자동저장 실패, 지연, 충돌 경고에 사용한다."),
    table("study_events", ["event_type", "payload", "occurred_at"], "write", "자동저장 이벤트를 기록한다."),
  ],
  "E-01": feedbackPageLinks("short"),
  "E-02": feedbackPageLinks("long"),
  "R-01": [
    rpc("public.create_comparison_report_with_metrics", "rpc", "현재 제출과 이전 제출 비교 리포트를 생성한다."),
    table("comparison_reports", ["current_submission_id", "previous_submission_id", "metrics", "narrative", "generated_at"], "read/write", "비교 리포트 본문과 지표에 사용한다."),
    table("writing_submissions", ["id", "answer_text", "char_count", "submitted_at"], "read", "비교 대상 제출본을 불러온다."),
    table("writing_feedback", ["submission_id", "score_total", "overall_summary"], "read", "점수 변화와 요약 비교에 사용한다."),
    table("feedback_dimension_scores", ["dimension", "score", "summary"], "read", "영역별 성장 지표에 사용한다."),
    table("study_events", ["event_type", "report_id", "occurred_at"], "write", "리포트 조회 이벤트를 남긴다."),
  ],
  "R-02": [
    table("recommendation_items", ["problem_id", "rank", "reason", "weakness_tags", "status"], "read/update", "다음 문제 추천 카드와 클릭 상태에 사용한다."),
    table("problems", ["id", "question_no", "difficulty", "title", "tags"], "read", "추천 대상 문제 정보를 표시한다."),
    table("writing_submissions", ["problem_id", "submitted_at"], "derived-read", "최근 제출 흐름을 추천 근거로 사용한다."),
    table("writing_feedback", ["score_total", "generated_at"], "derived-read", "최근 첨삭 결과를 추천 근거로 사용한다."),
    table("feedback_dimension_scores", ["dimension", "weakness_level"], "derived-read", "취약 영역 추천 근거에 사용한다."),
  ],
  "F-01": [
    table("library_items", ["item_type", "attempt_id", "submission_id", "report_id", "export_file_id", "problem_id", "note", "tags", "saved_at"], "read/write", "내 보관함 탭, 저장/해제, 태그에 사용한다."),
    table("writing_submissions", ["id", "problem_id", "submitted_at", "char_count"], "read", "제출 이력 탭에 사용한다."),
    table("comparison_reports", ["id", "metrics", "narrative", "generated_at"], "read", "리포트 탭에 사용한다."),
    table("problems", ["id", "title", "question_no", "difficulty"], "read", "저장한 문제 탭에 사용한다."),
    table("export_files", ["source_type", "source_id", "storage_path", "status", "created_at"], "read", "내보내기 파일 목록에 사용한다."),
    table("study_events", ["event_type", "occurred_at", "payload"], "read", "학습 활동 기록에 사용한다."),
  ],
  "F-M1": [
    table("export_files", ["source_type", "source_id", "storage_path", "options", "status"], "read/write", "PDF 생성 요청과 결과 파일 상태를 저장한다."),
    table("study_events", ["event_type", "export_file_id", "payload"], "write", "PDF 다운로드 이벤트를 기록한다."),
    storage("generated-exports", "read/write", "생성된 PDF 파일을 저장하고 소유자에게만 노출한다."),
  ],
  "G-01": [
    table("profiles", ["ui_locale", "updated_at"], "read/write", "앱 표시 언어를 저장한다."),
  ],
  "H-01": [
    table("problems", ["domain", "question_no", "topik_level", "difficulty", "title", "prompt", "materials", "answer_key", "rubric", "publish_status", "review_status", "visibility"], "read/write", "관리자 문제 목록, 편집, 공개 상태에 사용한다."),
    table("problem_assets", ["problem_id", "storage_path", "asset_type", "sort_order"], "read/write", "문제 첨부 자료 관리에 사용한다."),
    table("admin_audit_logs", ["admin_user_id", "action", "target_table", "target_id", "diff", "payload"], "write/read", "관리자 변경 이력을 남긴다."),
    rpc("public.admin_toggle_problem_publish", "rpc", "문제 공개/비공개 전환을 감사 로그와 함께 처리한다."),
    rpc("public.admin_update_problem", "rpc", "문제 본문/메타 수정을 감사 로그와 함께 처리한다."),
    rpc("public.admin_delete_problem", "rpc", "문제 삭제를 감사 로그와 함께 처리한다."),
    rpc("public.admin_add_problem_asset", "rpc", "문제 첨부 자료 추가를 처리한다."),
    rpc("public.admin_remove_problem_asset", "rpc", "문제 첨부 자료 삭제를 처리한다."),
    rpc("private.is_content_admin", "RLS helper", "콘텐츠 관리자 권한 확인에 사용한다."),
    storage("problem-assets", "read/write", "문제 자료 파일 업로드와 공개 읽기에 사용한다."),
  ],
  "X-01": [
    table("profiles", ["plan_label"], "derived-read", "랜딩의 플랜/권한 CTA 문구와 연결될 수 있으나 현재 직접 DB 의존은 낮다."),
  ],
  "X-02": [
    rpc("public.get_dashboard_kpi", "rpc", "성장 지표 일부를 재사용할 수 있다."),
    table("study_events", ["event_type", "occurred_at", "payload"], "derived-read", "학습 추세와 활동 그래프에 사용한다."),
    table("writing_feedback", ["score_total", "generated_at"], "derived-read", "점수 추세에 사용한다."),
    table("feedback_dimension_scores", ["dimension", "score", "weakness_level"], "derived-read", "영역별 성장/취약 분석에 사용한다."),
    table("problem_attempts", ["is_correct", "submitted_at", "time_spent_seconds"], "derived-read", "풀이 정확도와 학습 시간 지표에 사용한다."),
  ],
  "X-03": [
    table("profiles", ["plan_label", "status"], "read", "현재 플랜과 접근 제한 안내에 사용한다."),
    table("subscription_plans", ["plan_key", "name", "price_cents", "cadence", "active"], "read", "페이월에 표시할 활성 플랜 목록을 불러온다."),
    table("subscriptions", ["status", "plan_key"], "read", "이미 구독 중인 사용자는 구독 관리로 보낸다."),
  ],
  "X-04": [
    table("profiles", ["plan_label", "status"], "read", "구독 상태 셸 화면에 사용한다."),
    table("subscriptions", ["status", "plan_key", "current_period_end", "cancel_at"], "read", "현재 구독 상태 요약에 사용한다."),
    table("subscription_plans", ["plan_key", "name"], "read", "구독한 플랜의 표시 이름을 보강한다."),
    table("payment_history", ["amount_cents", "currency", "status", "paid_at", "receipt_url"], "read", "결제 이력 표에 사용한다."),
  ],
  "X-05": [
    table("profiles", ["display_name", "nickname", "avatar_path", "bio", "ui_locale", "plan_label", "status"], "read/write", "프로필 편집, 160자 자기소개, 아바타 경로에 사용한다."),
    table("learning_goals", ["topik_level", "target_grade", "exam_date", "weekly_goal_minutes", "weak_areas"], "read/write", "프로필의 시험 목표 정보에 사용한다."),
    rpc("private.protect_profile_columns", "trigger", "사용자가 app_role, plan_label, status를 직접 바꾸지 못하게 막는다."),
    storage("avatars", "read/write", "프로필 이미지 업로드와 공개 읽기에 사용한다."),
  ],
  "X-06": [
    table("profiles", ["id", "email", "status"], "read", "비밀번호 재설정 성공 후 사용자 상태 확인에 연결될 수 있다."),
  ],
  "X-07": [
    table("feedback_dimension_scores", ["dimension", "score", "weakness_level", "summary"], "read", "취약 영역 계산에 사용한다."),
    table("recommendation_items", ["problem_id", "rank", "reason", "weakness_tags", "status"], "read/update", "취약 기반 추천 목록과 상태에 사용한다."),
    table("problems", ["id", "domain", "question_no", "difficulty", "tags"], "read", "추천 문제 상세 표시와 필터에 사용한다."),
  ],
  "X-08": [
    rpc("public.get_admin_org_dashboard", "rpc", "기관 관리자 대시보드 KPI를 제공한다."),
    table("profiles", ["app_role", "plan_label", "status"], "read", "조직/권한 대시보드의 사용자 집계에 사용한다."),
    table("study_events", ["event_type", "occurred_at", "payload"], "derived-read", "기관 단위 활동 집계에 사용한다."),
    table("admin_audit_logs", ["admin_user_id", "action", "target_table", "created_at"], "read", "최근 관리자 활동 표시에 사용한다."),
    table("organizations", ["id", "name", "created_at"], "read", "기관 디렉터리와 대시보드 헤더에 사용한다."),
    table("org_members", ["org_id", "user_id", "role"], "read", "기관별 구성원과 역할 집계에 사용한다."),
    table("assignments", ["id", "org_id", "title", "problem_id", "due_at"], "read", "기관 과제 목록과 생성에 사용한다."),
    table("assignment_submissions", ["assignment_id", "user_id", "submission_id", "status", "submitted_at"], "read", "과제 제출률과 학습자별 상태에 사용한다."),
    rpc("private.is_org_admin", "RLS helper", "기관 관리자 권한 확인에 사용한다."),
  ],
  "X-09": [
    table("profiles", ["notification_prefs"], "read/write", "알림 채널과 조건 설정을 JSON object로 저장한다."),
    table("notification_settings", ["reminder_time", "reminder_days", "channels", "timezone"], "read/write", "리마인더 시간/요일과 채널 토글을 저장한다(profiles.notification_prefs 보강)."),
    table("notification_log", ["channel", "template_key", "status", "sent_at"], "read", "최근 알림 발송 이력을 표시한다. 발송 자체는 service_role 담당."),
  ],
  "X-10": [
    table("profiles", ["id", "display_name", "email", "app_role", "plan_label", "status", "created_at"], "read/write", "관리자 사용자 목록, 역할/상태 변경에 사용한다."),
    table("admin_audit_logs", ["admin_user_id", "action", "target_table", "target_id", "diff"], "write/read", "관리자 권한 변경 이력을 남긴다."),
    rpc("public.admin_change_user_role", "rpc", "사용자 역할 변경을 서버 측 검증과 감사 로그로 처리한다."),
    rpc("public.get_admin_users", "rpc", "관리자 사용자 목록(검색/필터/페이지네이션)을 제공한다."),
    rpc("public.get_admin_user_stats", "rpc", "사용자 콘솔 상단 KPI 집계를 제공한다."),
    rpc("public.admin_set_user_status", "rpc", "사용자 상태(활성/정지 등) 변경을 감사 로그와 함께 처리한다."),
    rpc("public.get_admin_audit_logs", "rpc", "사용자 상세의 최근 관리자 변경 이력을 제공한다."),
    rpc("private.is_platform_admin", "RLS helper", "플랫폼 관리자 권한 확인에 사용한다."),
  ],
  "X-11": [
    table("profiles", ["id", "status"], "read", "인증 오류 후 계정 상태 안내와 재시도 분기에 연결될 수 있다."),
  ],
  "X-12": [
    table("profiles", ["id", "email", "status"], "read", "가입 직후 이메일 인증 안내와 인증 상태 확인에 연결된다."),
    rpc("public.handle_new_user", "trigger", "가입 직후 프로필 row 생성을 보장한다."),
  ],
  "X-15": [
    table("profiles", ["id", "app_role", "status"], "read", "관리자 root 접근 권한 확인에 사용한다."),
    rpc("private.is_content_admin", "RLS helper", "하위 콘텐츠 관리자 route의 권한 확인에 사용한다."),
    rpc("private.is_org_admin", "RLS helper", "하위 기관 관리자 route의 권한 확인에 사용한다."),
    rpc("private.is_platform_admin", "RLS helper", "하위 플랫폼 관리자 route의 권한 확인에 사용한다."),
  ],
};

const PAGE_SPEC_OVERRIDES = {
  "A-01": spec("회원가입", "새 사용자가 계정을 만들고 이메일 인증 또는 온보딩으로 이어지게 한다.", ["이메일/비밀번호 입력", "약관 동의", "가입 요청", "인증 메일 안내"], ["이메일 중복, 약한 비밀번호, 발송 제한, 가입 비활성화"], ["가입 폼은 구현되어 있으나 실제 상태별 문구는 Auth 오류 화면과 함께 검증해야 한다."]),
  "A-02": spec("로그인", "기존 사용자가 세션을 만들고 학습 대시보드로 들어가게 한다.", ["이메일/비밀번호 로그인", "비밀번호 재설정 진입", "회원가입 전환", "인증 오류 분기"], ["잘못된 계정, 이메일 미인증, rate limit"], ["기본 로그인은 구현되어 있으나 Auth callback/error와 연결 상태를 계속 확인해야 한다."]),
  "A-03": spec("학습 목표 설정", "첫 사용자가 TOPIK 목표와 학습 조건을 저장하게 한다.", ["TOPIK 수준 선택", "목표 급수/시험일 입력", "주간 목표 설정", "취약 영역 선택"], ["목표 미입력, 잘못된 날짜, 저장 실패"], ["learning_goals 저장 흐름은 구현 기준이며 대시보드 반영까지 함께 검증해야 한다."]),
  "B-01": spec("홈 대시보드", "현재 학습 상태와 다음 행동을 한 화면에서 보여준다.", ["KPI 요약", "이어쓰기", "추천 문제", "최근 피드백", "시험/알림 보조 영역"], ["신규 사용자 빈 상태, 추천 없음, KPI 로드 실패"], ["dashboard page에서 실제 Supabase 읽기가 있으며 일부 추천 영역은 source module 기반으로 보강되어야 한다."]),
  "C-01": spec("문제 유형 추천", "학습자 상태에 맞는 문제 유형과 이유를 제안한다.", ["추천 묶음 표시", "추천 이유", "유형 선택", "문제 목록 이동"], ["추천 없음, 취약 데이터 부족"], ["추천 데이터는 recommendation_*와 feedback_dimension_scores를 함께 확인해야 한다."]),
  "C-02": spec("문제 목록", "추천/필터 결과에 맞는 문제를 고르고 풀이로 진입하게 한다.", ["문제 카드", "필터/정렬", "풀이 이력 표시", "재도전 모달 호출"], ["문제 없음, 비공개 문제 제외, 자료 로드 실패"], ["problem_assets와 문제 공개 상태가 표시 규칙에 포함된다."]),
  "C-03": spec("재도전 모달", "이전 시도나 임시 저장이 있는 문제의 계속/새 시작을 선택하게 한다.", ["이전 상태 요약", "이어풀기", "새로 시작", "취소"], ["임시 저장 없음, 이미 완료된 시도"], ["hosted modal이라 독립 route가 없으며 문제 목록 컨텍스트가 필요하다."]),
  "D-01": writingSpec("51번 단답 작성", "짧은 답안을 빠르게 작성하고 저장/제출하게 한다."),
  "D-02": writingSpec("52번 문장 완성", "정답형 답안을 조건에 맞춰 작성하고 제출하게 한다."),
  "D-03": writingSpec("53번 장문 작성", "자료를 읽고 긴 답안을 구성하게 한다."),
  "D-04": writingSpec("54번 에세이 작성", "논리 구조가 있는 긴 글을 작성하고 첨삭으로 이어지게 한다."),
  "D-M1": spec("제출 확인 모달", "최종 제출 전 답안과 글자 수를 확인하게 한다.", ["답안 요약", "글자 수 확인", "제출 확정", "돌아가기"], ["빈 답안, 저장 지연, 중복 제출"], ["제출은 직접 insert보다 RPC 경로가 기준이다."]),
  "D-M2": spec("AI 분석 로딩", "제출 후 첨삭 생성 중 상태를 사용자가 이해하게 한다.", ["분석 상태", "대기 안내", "완료 후 피드백 이동", "오류 안내"], ["분석 실패, 지연, 상태 조회 실패"], ["feedback_status와 writing_feedback 생성 시점이 핵심이다."]),
  "D-M3": spec("자동저장 경고", "작성 중 저장 실패나 충돌을 바로 인지하고 복구하게 한다.", ["저장 상태 표시", "재시도", "최근 저장 시각", "계속 작성"], ["네트워크 실패, 중복 저장, 충돌"], ["writing_drafts 상태와 study_events 기록을 함께 본다."]),
  "E-01": feedbackSpec("단답 피드백", "짧은 답안의 점수와 문장별 수정 제안을 보여준다."),
  "E-02": feedbackSpec("장문 피드백", "긴 글의 총평, 영역별 점수, 문장별 피드백을 보여준다."),
  "R-01": spec("비교 리포트", "현재 제출과 이전 제출을 비교해 성장과 다음 개선점을 보여준다.", ["제출본 비교", "점수 변화", "영역별 지표", "다음 문제 이동"], ["이전 제출 없음, 리포트 생성 실패"], ["comparison_reports와 create_comparison_report_with_metrics RPC가 기준이다."]),
  "R-02": spec("다음 문제 추천", "피드백 이후 바로 이어 풀 문제를 제안한다.", ["추천 카드", "추천 이유", "예상 시간", "문제 목록/작성 이동"], ["추천 없음, 문제 비공개"], ["추천 상태 업데이트가 필요하다."]),
  "F-01": spec("내 보관함", "저장한 문제, 제출, 리포트, 내보내기 파일을 모아 보여준다.", ["탭별 목록", "태그/메모", "저장 해제", "PDF 내역"], ["저장 항목 없음, export 실패"], ["library_items의 단일 FK 제약을 문서에 남긴다."]),
  "F-M1": spec("PDF 내보내기 모달", "피드백/리포트를 PDF로 저장하고 다운로드하게 한다.", ["내보내기 옵션", "생성 요청", "다운로드", "실패 재시도"], ["생성 실패, 권한 없음, 파일 없음"], ["generated-exports bucket과 export_files 상태가 기준이다."]),
  "G-01": spec("언어 설정", "사용자가 앱 표시 언어를 바꾸게 한다.", ["언어 선택", "저장", "현재 언어 표시"], ["지원하지 않는 언어, 저장 실패"], ["profiles.ui_locale만 변경한다."]),
  "H-01": spec("관리자 문제 관리", "콘텐츠 관리자가 문제와 자료, 공개 상태를 관리한다.", ["문제 목록", "문제 편집", "자료 관리", "공개 전환", "감사 로그"], ["권한 없음, 비공개 상태, 저장 실패"], ["content admin 권한과 audit log 기록이 필수다."]),
  "X-01": spec("제품 랜딩", "방문자가 서비스 가치를 보고 가입/로그인으로 이동하게 한다.", ["가치 제안", "시작 CTA", "로그인 CTA", "요금/기능 안내"], ["이미 로그인한 사용자", "CTA 링크 실패"], ["현재 직접 DB 의존은 낮고 public route로 유지한다."]),
  "X-02": spec("성장 대시보드", "학습자의 성장 추세와 취약 변화를 보여준다.", ["추세 그래프", "점수 변화", "학습 시간", "취약 영역"], ["데이터 부족, 기간 필터 없음"], ["study_events와 feedback 기반 파생 지표를 명확히 표시한다."]),
  "X-03": spec("페이월", "제한된 기능 접근 시 현재 플랜과 업그레이드 선택지를 보여준다.", ["현재 플랜", "업그레이드 CTA", "제한 안내"], ["결제 연동 없음, 플랜 정보 없음"], ["billing 테이블은 없고 profiles.plan_label만 현재 근거다."]),
  "X-04": spec("구독 관리", "사용자가 현재 구독 상태 셸을 확인하게 한다.", ["현재 플랜", "관리 CTA", "결제 deferred 안내"], ["구독 데이터 없음"], ["실제 subscription table은 deferred scope라 DATA-GAP으로 남긴다."]),
  "X-05": spec("프로필 편집", "사용자가 이름, 닉네임, 자기소개, 아바타, 목표 정보를 관리한다.", ["기본 정보", "160자 자기소개", "아바타", "학습 목표", "저장"], ["닉네임 중복, bio 길이 초과, 권한 보호 컬럼"], ["profiles.bio migration이 최신 기준이다."]),
  "X-06": spec("비밀번호 재설정", "비밀번호를 잊은 사용자가 재설정 메일을 요청하고 복귀하게 한다.", ["이메일 입력", "메일 발송", "재시도 안내", "로그인 복귀"], ["존재하지 않는 사용자, rate limit"], ["Auth 중심 화면이며 DB 직접 변경은 제한적이다."]),
  "X-07": spec("취약 기반 추천", "첨삭 결과에서 약한 영역을 찾아 맞춤 문제를 추천한다.", ["취약 영역 요약", "추천 문제", "추천 이유", "상태 업데이트"], ["첨삭 데이터 없음, 추천 없음"], ["feedback_dimension_scores와 recommendation_items가 핵심이다."]),
  "X-08": spec("기관 관리자 대시보드", "기관 관리자가 사용자/활동/운영 상태를 한 화면에서 본다.", ["기관 KPI", "최근 활동", "관리자 감사 로그", "사용자 관리 이동"], ["기관 테이블 없음, 권한 없음"], ["전용 organization table은 없고 get_admin_org_dashboard RPC와 profiles/study_events 기반 집계가 현재 근거다."]),
  "X-09": spec("알림 설정", "사용자가 알림 채널과 조건을 저장하게 한다.", ["채널 토글", "조건 입력", "미리보기", "저장"], ["전송 채널 미연동, 권한 없음, 저장 실패"], ["profiles.notification_prefs JSON 컬럼이 현재 저장소다. 실제 발송은 deferred다."]),
  "X-10": spec("관리자 사용자 관리", "플랫폼 관리자가 사용자 상태와 역할을 관리한다.", ["사용자 목록", "역할 변경", "상태 표시", "감사 로그"], ["권한 없음, 보호 컬럼 직접 변경 차단"], ["admin_change_user_role RPC와 admin_audit_logs가 필수다."]),
  "X-11": spec("인증 오류", "Supabase 인증 실패 이유를 안전한 문구와 재시도 행동으로 안내한다.", ["오류 이유 분기", "재시도 CTA", "카운트다운", "로그인/가입 이동"], ["raw error 노출 금지, rate limit"], ["query reason은 신뢰하지 않고 canonical reason만 표시한다."]),
  "X-12": spec("이메일 인증 안내", "가입 직후 이메일 확인과 재발송 제한을 안내한다.", ["인증 메일 안내", "재발송", "cooldown", "로그인 복귀"], ["메일 미도착, rate limit, 이미 인증됨"], ["handle_new_user trigger와 profile 상태를 함께 고려한다."]),
  "X-13": spec("이용약관", "회원가입 약관 동의 대상 문서를 공개 route로 제공한다.", ["임시 약관 안내", "서비스 성격 요약", "개인정보처리방침 링크", "홈/가입 복귀"], ["정식 약관 미게시", "운영 문의 채널 미확정"], ["기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면이다. 직접 DB 의존은 없다."]),
  "X-14": spec("개인정보처리방침", "회원가입 및 서비스 이용 전 개인정보 처리 범위를 공개 route로 안내한다.", ["임시 개인정보 안내", "수집 항목", "이용 목적", "외부 LLM 전송 고지", "관련 링크"], ["정식 처리방침 미게시", "동의/삭제 요청 흐름 미확정"], ["기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면이다. 직접 DB 의존은 없다."]),
  "X-15": spec("관리자 인덱스", "관리자가 /admin으로 직접 진입했을 때 안전한 상위 허브와 안내 상태를 제공한다.", ["관리자 placeholder", "role guard", "하위 관리 화면 이동 맥락"], ["권한 없음, 프로필 읽기 실패"], ["기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면이다. 직접 변경 action은 없어 admin_audit_logs 대상이 아니다."]),
  "X-16": spec("새 비밀번호 설정", "비밀번호 재설정 링크를 받은 사용자가 새 비밀번호를 저장하고 로그인으로 복귀하게 한다.", ["새 비밀번호", "비밀번호 확인", "8-64자 검증", "비밀번호 변경", "재설정 링크 재요청"], ["링크 만료, recovery session 없음, provider 오류"], ["기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면이다. Supabase Auth updateUser 중심이며 앱 DB 직접 의존은 없다."]),
  "X-17": spec("인증 콜백 fragment 처리", "Supabase implicit flow URL fragment를 browser에서 안전하게 처리해 세션을 설정하거나 인증 오류로 이동시킨다.", ["fragment 파싱", "setSession", "canonical error redirect", "relative next sanitization", "처리 상태 표시"], ["fragment 없음, setSession 실패, open redirect 차단"], ["기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면이다. Supabase Auth setSession 중심이며 앱 DB 직접 의존은 없다."]),
};

function table(name, columns, usage, pageFeature) {
  return { objectType: "table", objectName: name, columns, usage, pageFeature };
}

function rpc(name, usage, pageFeature) {
  const parts = name.split(".");
  return {
    objectType: "rpc",
    objectName: parts.at(-1),
    schema: parts.length > 1 ? parts[0] : "public",
    columns: [],
    usage,
    pageFeature,
  };
}

function storage(name, usage, pageFeature) {
  return { objectType: "storage", objectName: name, columns: [], usage, pageFeature };
}

function writingPageLinks(questionNo) {
  return [
    table("problems", ["id", "question_no", "prompt", "materials", "rubric", "answer_key"], "read", `${questionNo}번 작성 문제 본문과 조건을 표시한다.`),
    table("problem_assets", ["problem_id", "storage_path", "asset_type"], "read", "문제 자료 이미지/오디오를 연결한다."),
    table("writing_drafts", ["problem_id", "answer_text", "answer_json", "char_count", "autosave_status", "last_saved_at"], "read/write", "작성 중 임시 저장과 자동저장 상태에 사용한다."),
    table("writing_submissions", ["problem_id", "answer_text", "answer_json", "char_count", "feedback_status"], "write/read", "최종 제출과 제출 상태 확인에 사용한다."),
    table("study_events", ["event_type", "problem_id", "submission_id", "payload"], "write", "작성 시작과 제출 이벤트를 기록한다."),
  ];
}

function feedbackPageLinks(kind) {
  return [
    table("writing_submissions", ["id", "problem_id", "answer_text", "char_count", "submitted_at", "feedback_status"], "read", `${kind} 제출 원문과 상태를 표시한다.`),
    table("writing_feedback", ["submission_id", "score_total", "score_max", "overall_summary", "ai_model", "generated_at"], "read", "AI 첨삭 총점과 요약을 표시한다."),
    table("feedback_dimension_scores", ["dimension", "score", "score_max", "summary", "weakness_level"], "read", "영역별 점수와 약점 수준을 표시한다."),
    table("sentence_feedback", ["sentence_index", "original_text", "corrected_text", "comment"], "read", "문장별 수정 제안을 표시한다."),
    table("library_items", ["submission_id", "item_type", "note", "tags"], "read/write", "피드백 저장/보관함 추가에 사용한다."),
    table("export_files", ["source_type", "source_id", "status", "storage_path"], "read/write", "피드백 PDF 내보내기와 연결된다."),
    table("study_events", ["event_type", "submission_id", "payload"], "write", "피드백 조회 이벤트를 기록한다."),
  ];
}

function spec(title, intent, features, states, implementationNotes) {
  return { title, intent, features, states, implementationNotes };
}

function writingSpec(title, intent) {
  return spec(title, intent, ["문제 본문/자료", "답안 입력", "글자 수", "자동저장", "제출 확인"], ["문제 없음, 저장 실패, 글자 수 부족/초과, 중복 제출"], ["작성 화면은 문제 번호별 route를 가지며 공통 writing data flow를 공유한다."]);
}

function feedbackSpec(title, intent) {
  return spec(title, intent, ["총점/총평", "영역별 점수", "문장별 피드백", "보관함 저장", "PDF 내보내기"], ["분석 대기, 결과 없음, 권한 없음, export 실패"], ["피드백 화면은 제출 소유자 RLS와 feedback_status를 함께 확인해야 한다."]);
}

export function buildWireframeDataInventory({ auditDir } = {}) {
  const runId = basename(auditDir ?? timestampId());
  const manifest = buildManifest(auditDir ?? `${DEFAULT_RUN_ROOT}/${runId}`);
  const migrations = parseMigrations();
  const sourceUsages = parseSourceUsages();
  const pageDataLinks = buildPageDataLinks(manifest.entries, migrations, sourceUsages);
  const unmappedDbObjects = classifyUnmappedDbObjects(migrations, pageDataLinks);
  const docConflicts = detectDocConflicts(manifest.entries, migrations);

  return {
    runId,
    generatedAt: generatedAt(),
    sourceDocs: [
      "docs/Wireframe/README.md",
      "docs/sitemap.md",
      "docs/flow/user-flow.md",
      "docs/development/database-schema.md",
      "docs/development/backend-auth.md",
      "supabase/migrations/*.sql",
    ],
    pages: manifest.entries.map((entry) => ({
      iaCode: entry.iaCode,
      screenName: entry.screenName,
      folder: entry.iaFolder,
      routeOrHostRoute: entry.routeOrHostRoute,
      routeType: entry.routeType,
      audience: entry.audience,
      descriptionPath: entry.descriptionPath,
      wireframePath: entry.wireframePath,
    })),
    dbObjects: migrations,
    sourceUsages,
    pageDataLinks,
    unmappedDbObjects,
    unmappedSourceUsages: classifyUnmappedSourceUsages(sourceUsages, pageDataLinks),
    docConflicts,
    summary: {
      pageCount: manifest.entries.length,
      tableCount: migrations.tables.length,
      rpcCount: migrations.rpcs.length,
      storageBucketCount: migrations.storageBuckets.length,
      sourceUsageCount: sourceUsages.length,
      pageDataLinkCount: pageDataLinks.length,
      unclassifiedDbObjectCount: unmappedDbObjects.filter((item) => item.classification === "unclassified").length,
    },
  };
}

function parseMigrations() {
  const migrationRoot = resolvePath("supabase/migrations");
  const files = readdirSync(migrationRoot)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      path: `supabase/migrations/${name}`,
      text: readFileSync(join(migrationRoot, name), "utf8"),
    }));

  const tables = new Map();
  const rpcs = new Map();
  const policies = [];
  const triggers = [];
  const storageBuckets = new Map();

  for (const file of files) {
    collectTables(file, tables);
    collectAlterColumns(file, tables);
    collectRpcs(file, rpcs);
    collectPolicies(file, policies);
    collectTriggers(file, triggers);
    collectStorageBuckets(file, storageBuckets);
  }

  return {
    tables: [...tables.values()].sort(byName).map((table) => ({
      ...table,
      columns: [...table.columns.values()].sort(byName),
      migrationFiles: [...table.migrationFiles].sort(),
    })),
    rpcs: [...rpcs.values()].sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`)).map((rpcObject) => ({
      ...rpcObject,
      migrationFiles: [...rpcObject.migrationFiles].sort(),
    })),
    policies: policies.sort((a, b) => a.name.localeCompare(b.name)),
    triggers: triggers.sort((a, b) => a.name.localeCompare(b.name)),
    storageBuckets: [...storageBuckets.values()].sort(byName).map((bucket) => ({
      ...bucket,
      migrationFiles: [...bucket.migrationFiles].sort(),
    })),
    migrationFiles: files.map((file) => file.path),
  };
}

function collectTables(file, tables) {
  const pattern = /create\s+table\s+if\s+not\s+exists\s+public\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi;
  let match;
  while ((match = pattern.exec(file.text))) {
    const tableName = match[1];
    const table = ensureTable(tables, tableName);
    table.migrationFiles.add(file.path);
    for (const column of parseColumns(match[2])) {
      table.columns.set(column.name, { ...column, source: "create table", migrationFile: file.path });
    }
  }
}

function collectAlterColumns(file, tables) {
  const pattern = /alter\s+table\s+public\.([a-z_][a-z0-9_]*)[\s\r\n]+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+([^;\n]+)/gi;
  let match;
  while ((match = pattern.exec(file.text))) {
    const table = ensureTable(tables, match[1]);
    table.migrationFiles.add(file.path);
    table.columns.set(match[2], {
      name: match[2],
      type: match[3].replace(/\s+/g, " ").trim(),
      source: "alter table add column",
      migrationFile: file.path,
    });
  }
}

function collectRpcs(file, rpcs) {
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+(public|private)\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s+returns/gi;
  let match;
  while ((match = pattern.exec(file.text))) {
    const schema = match[1];
    const name = match[2];
    const key = `${schema}.${name}`;
    if (!rpcs.has(key)) {
      rpcs.set(key, {
        schema,
        name,
        arguments: normalizeWhitespace(match[3]),
        migrationFiles: new Set(),
      });
    }
    rpcs.get(key).migrationFiles.add(file.path);
  }
}

function collectPolicies(file, policies) {
  const pattern = /create\s+policy\s+([a-z_][a-z0-9_]*)[\s\S]{0,220}?\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  let match;
  while ((match = pattern.exec(file.text))) {
    policies.push({ name: match[1], table: match[2], migrationFile: file.path });
  }
}

function collectTriggers(file, triggers) {
  const pattern = /create\s+trigger\s+([a-z_][a-z0-9_]*)[\s\S]{0,260}?\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  let match;
  while ((match = pattern.exec(file.text))) {
    triggers.push({ name: match[1], table: match[2], migrationFile: file.path });
  }
}

function collectStorageBuckets(file, storageBuckets) {
  if (!file.text.includes("storage.buckets")) return;
  const pattern = /\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  let match;
  while ((match = pattern.exec(file.text))) {
    const name = match[2];
    if (!storageBuckets.has(name)) {
      storageBuckets.set(name, { name, id: match[1], migrationFiles: new Set() });
    }
    storageBuckets.get(name).migrationFiles.add(file.path);
  }
}

function parseColumns(body) {
  const columns = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line || line.startsWith("--")) continue;
    if (/^(constraint|primary|foreign|unique|check|exclude)\b/i.test(line)) continue;
    const match = line.match(/^([a-z_][a-z0-9_]*)\s+(.+)$/i);
    if (!match) continue;
    columns.push({ name: match[1], type: normalizeWhitespace(match[2]) });
  }
  return columns;
}

function ensureTable(tables, tableName) {
  if (!tables.has(tableName)) {
    tables.set(tableName, { name: tableName, columns: new Map(), migrationFiles: new Set() });
  }
  return tables.get(tableName);
}

function parseSourceUsages() {
  const files = SCAN_ROOTS.flatMap((root) => listFiles(root)).filter((file) => SOURCE_EXTENSIONS.has(extension(file)));
  const usages = [];

  for (const absoluteFile of files) {
    const sourceFile = normalizeSlashes(relative(process.cwd(), absoluteFile));
    const text = readFileSync(absoluteFile, "utf8");
    collectSourcePattern(usages, text, sourceFile, "table", /\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g);
    collectSourcePattern(usages, text, sourceFile, "rpc", /\.rpc\(\s*["'`]([^"'`]+)["'`]/g);
    collectSourcePattern(usages, text, sourceFile, "storage", /storage\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g);
  }

  return usages.sort((a, b) => `${a.kind}:${a.objectName}:${a.sourceFile}`.localeCompare(`${b.kind}:${b.objectName}:${b.sourceFile}`));
}

function collectSourcePattern(usages, text, sourceFile, kind, pattern) {
  let match;
  while ((match = pattern.exec(text))) {
    usages.push({ kind, objectName: match[1], sourceFile });
  }
}

function listFiles(root) {
  const fullRoot = resolvePath(root);
  if (!existsSync(fullRoot)) return [];
  const entries = [];
  for (const name of readdirSync(fullRoot)) {
    if (name === "node_modules" || name === ".next") continue;
    const fullPath = join(fullRoot, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      entries.push(...listFiles(normalizeSlashes(relative(process.cwd(), fullPath))));
    } else {
      entries.push(fullPath);
    }
  }
  return entries;
}

function extension(file) {
  const name = basename(file);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

function buildPageDataLinks(pages, migrations, sourceUsages) {
  return pages.flatMap((page) => {
    const links = PAGE_DATA_BLUEPRINTS[page.iaCode] ?? [];
    return links.map((link) => {
      const evidence = evidenceForLink(link, migrations, sourceUsages);
      return {
        iaCode: page.iaCode,
        screenName: page.screenName,
        folder: page.iaFolder,
        routeOrHostRoute: page.routeOrHostRoute,
        audience: page.audience,
        objectType: link.objectType,
        objectName: link.objectName,
        schema: link.schema,
        columns: link.columns ?? [],
        usage: link.usage,
        pageFeature: link.pageFeature,
        permission: permissionFor(page, link),
        evidence,
        uncertainty: uncertaintyFor(page.iaCode, link),
      };
    });
  });
}

function evidenceForLink(link, migrations, sourceUsages) {
  const sourceMatches = sourceUsages
    .filter((usage) => {
      if (link.objectType === "table") return usage.kind === "table" && usage.objectName === link.objectName;
      if (link.objectType === "rpc") return usage.kind === "rpc" && usage.objectName === link.objectName;
      if (link.objectType === "storage") return usage.kind === "storage" && usage.objectName === link.objectName;
      return false;
    })
    .map((usage) => usage.sourceFile);

  const migrationMatches = migrationFilesForLink(link, migrations);
  const evidence = [...new Set([...sourceMatches, ...migrationMatches])];
  return evidence.length > 0 ? evidence.sort() : ["docs/Wireframe description and route-level inference"];
}

function migrationFilesForLink(link, migrations) {
  if (link.objectType === "table") {
    return migrations.tables.find((tableObject) => tableObject.name === link.objectName)?.migrationFiles ?? [];
  }
  if (link.objectType === "rpc") {
    const schema = link.schema ?? "public";
    return migrations.rpcs.find((rpcObject) => rpcObject.name === link.objectName && rpcObject.schema === schema)?.migrationFiles ?? [];
  }
  if (link.objectType === "storage") {
    return migrations.storageBuckets.find((bucket) => bucket.name === link.objectName)?.migrationFiles ?? [];
  }
  return [];
}

function permissionFor(page, link) {
  if (page.audience === "public") return "public/auth flow; no user-owned row access unless session exists";
  if (page.audience === "admin") return "admin guard + RLS helper/admin RPC; audit log required for mutations";
  if (link.objectType === "storage") return "owner or public bucket policy depending on bucket";
  return "authenticated user; auth.uid() owner RLS where user-owned";
}

function uncertaintyFor(iaCode, link) {
  if (["X-03", "X-04"].includes(iaCode) && ["subscriptions", "subscription_plans", "payment_history"].includes(link.objectName)) {
    return "Billing tables exist but writes come from the billing service (service_role); no payment provider is wired yet.";
  }
  if (iaCode === "X-09" && ["notification_settings", "notification_log"].includes(link.objectName)) {
    return "Notification transport (email/push) is deferred; only preference persistence + a service-written log exist.";
  }
  if (iaCode === "X-09") return "Notification transport is deferred; only preference persistence is current evidence.";
  if (link.usage.includes("derived")) return "Derived usage inferred from current source/domain docs.";
  return "none";
}

function classifyUnmappedDbObjects(migrations, pageDataLinks) {
  const linked = new Set(pageDataLinks.map(linkKey));
  const objects = [
    ...migrations.tables.map((object) => ({ objectType: "table", objectName: object.name, key: `table:${object.name}` })),
    ...migrations.rpcs.map((object) => ({
      objectType: "rpc",
      objectName: `${object.schema}.${object.name}`,
      key: `rpc:${object.schema}.${object.name}`,
    })),
    ...migrations.storageBuckets.map((object) => ({ objectType: "storage", objectName: object.name, key: `storage:${object.name}` })),
  ];

  return objects
    .filter((object) => !linked.has(object.key))
    .map((object) => ({
      objectType: object.objectType,
      objectName: object.objectName,
      classification: classifyDbObject(object),
      reason: classifyReason(object),
    }))
    .sort((a, b) => `${a.objectType}:${a.objectName}`.localeCompare(`${b.objectType}:${b.objectName}`));
}

function linkKey(link) {
  if (link.objectType === "table") return `table:${link.objectName}`;
  if (link.objectType === "rpc") return `rpc:${link.schema ?? "public"}.${link.objectName}`;
  if (link.objectType === "storage") return `storage:${link.objectName}`;
  return `${link.objectType}:${link.objectName}`;
}

function classifyDbObject(object) {
  if (object.objectType === "rpc") {
    if (
      object.objectName.includes("cleanup_unconfirmed_users") ||
      object.objectName.includes("is_email_confirmed") ||
      object.objectName.includes("protect_profile_columns") ||
      object.objectName.includes("set_submission_feedback_status") ||
      object.objectName.includes("touch_updated_at") ||
      object.objectName.includes("supersede_active_draft") ||
      object.objectName.includes("assert_submission_payload") ||
      object.objectName.includes("is_admin") ||
      object.objectName.includes("is_org_member") ||
      object.objectName.includes("is_org_manager")
    ) {
      return "infrastructure/security";
    }
  }
  return "unclassified";
}

function classifyReason(object) {
  if (classifyDbObject(object) === "infrastructure/security") {
    return "Function is a trigger, RLS helper, cleanup job, validator, or security hardening helper rather than a direct page data surface.";
  }
  return "No page mapping found; review needed.";
}

function classifyUnmappedSourceUsages(sourceUsages, pageDataLinks) {
  const linked = new Set(pageDataLinks.map((link) => `${link.objectType === "table" ? "table" : link.objectType}:${link.objectName}`));
  return sourceUsages
    .filter((usage) => !linked.has(`${usage.kind}:${usage.objectName}`))
    .map((usage) => ({
      ...usage,
      classification: usage.sourceFile.startsWith("tests/") || usage.sourceFile.startsWith("scripts/") ? "test/script support" : "review-needed",
    }));
}

function detectDocConflicts(pages, migrations) {
  const conflicts = [];
  const sitemap = safeRead("docs/sitemap.md");
  if (sitemap.includes("current 32-screen IA inventory") && pages.length !== 32) {
    conflicts.push({
      id: "wireframe-count-prose",
      detail: `\`docs/sitemap.md\` prose says 32-screen IA inventory, but current Wireframe inventory has ${pages.length} folders.`,
      evidence: ["docs/sitemap.md", "docs/Wireframe/README.md"],
    });
  }

  const databaseSchema = safeRead("docs/development/database-schema.md");
  if (
    migrations.migrationFiles.length > 16 ||
    !databaseSchema.includes("notification_prefs") ||
    !databaseSchema.includes("profiles.bio")
  ) {
    conflicts.push({
      id: "database-schema-drift",
      detail: "`docs/development/database-schema.md` does not fully reflect the later migration set now present under `supabase/migrations/`.",
      evidence: ["docs/development/database-schema.md", "supabase/migrations/INDEX.md"],
    });
  }

  const latestAudit = latestDirectory("reports/ia-verification/runs");
  if (latestAudit && directoryContains(latestAudit, "docs/IA/")) {
    conflicts.push({
      id: "stale-ia-paths-in-audit-output",
      detail: "Latest IA audit artifacts still contain legacy `docs/IA/...` strings; current docs use `docs/Wireframe/...`.",
      evidence: [normalizeSlashes(latestAudit)],
    });
  }

  return conflicts;
}

function latestDirectory(root) {
  const fullRoot = resolvePath(root);
  if (!existsSync(fullRoot)) return null;
  const dirs = readdirSync(fullRoot)
    .map((name) => join(fullRoot, name))
    .filter((path) => statSync(path).isDirectory())
    .sort()
    .reverse();
  return dirs[0] ?? null;
}

function directoryContains(root, needle) {
  for (const file of listFiles(normalizeSlashes(relative(process.cwd(), root)))) {
    if (!SOURCE_EXTENSIONS.has(extension(file)) && !file.endsWith(".json") && !file.endsWith(".md") && !file.endsWith(".txt")) {
      continue;
    }
    try {
      if (readFileSync(file, "utf8").includes(needle)) return true;
    } catch {
      // Ignore binary or transient files.
    }
  }
  return false;
}

function safeRead(path) {
  const fullPath = resolvePath(path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

export function writeFunctionalSpecDocs(inventory) {
  for (const page of inventory.pages) {
    const links = inventory.pageDataLinks.filter((link) => link.iaCode === page.iaCode);
    const pageSpec = PAGE_SPEC_OVERRIDES[page.iaCode] ?? spec(page.screenName, `${page.screenName} 화면의 목적과 기능을 정리한다.`, ["주요 CTA", "상태 표시", "오류 처리"], ["로드 실패, 권한 없음"], ["상세 구현 상태는 source-map과 함께 재검증한다."]);
    writeText(`${page.folder}/functional-spec.md`, renderFunctionalSpec(page, pageSpec, links, inventory));
  }

  writeText("docs/Wireframe/functional-spec-index.md", renderFunctionalSpecIndex(inventory));
  writeText("docs/Wireframe/data-usage-index.md", renderDataUsageIndex(inventory));
}

function renderFunctionalSpec(page, pageSpec, links, inventory) {
  const featureLines = pageSpec.features.map((item) => `- ${item}`).join("\n");
  const stateLines = pageSpec.states.map((item) => `- ${item}`).join("\n");
  const implementationLines = pageSpec.implementationNotes.map((item) => `- ${item}`).join("\n");
  const dataTable = links.map(renderDataLinkRow).join("\n");
  const gaps = gapLinesFor(page, links);
  const candidates = candidateLinesFor(page, links);
  const sourceEvidence = [...new Set(links.flatMap((link) => link.evidence).filter(Boolean))].slice(0, 12);

  return `# ${page.iaCode} ${pageSpec.title} 기능명세

## 화면 목적

${pageSpec.intent}

## 진입/이탈 흐름

- Route: \`${page.routeOrHostRoute}\`
- Route type: ${page.routeType}
- Audience: ${page.audience}
- 기준 흐름: \`docs/flow/user-flow.md\`의 IA 순서를 따른다.
- 이탈: 다음 CTA, 상위 목록, 인증 오류, 권한 오류, 또는 빈 상태 CTA로 이동한다.

## 주요 기능

${featureLines}

## 상태/오류/권한

${stateLines}
- 권한 기준: ${permissionSummary(page)}

## 현재 구현 상태

${implementationLines}
- 실제 구현 여부는 \`src/**\`, IA 감사 산출물, 이 문서의 DB 근거를 함께 확인한다.

## 미구현/불일치

${gaps}

## 추가 발견 후보

${candidates}

## DB 데이터 사용 명세

| 테이블/버킷/RPC | 컬럼/필드 | 사용 방식 | 화면 기능 | 권한/RLS | 근거 | 불확실성 |
| --- | --- | --- | --- | --- | --- | --- |
${dataTable || "| - | - | - | 현재 직접 DB 사용 근거 없음 | - | Wireframe/source 검토 | 직접 데이터 사용 없음 또는 미확인 |"}

## 수용 기준

- 이 화면의 주요 CTA와 상태가 Wireframe description과 route map에 맞게 설명되어 있다.
- 위 DB 데이터 사용 명세의 모든 객체가 \`docs/Wireframe/data-usage-index.md\`에도 역색인되어 있다.
- 확정할 수 없는 기능 또는 데이터는 구현된 것처럼 쓰지 않고 gap/candidate로 남긴다.
- user/admin/public 권한 경계가 \`docs/sitemap.md\` audience와 맞는다.

## 검증 근거

- Description: \`${page.descriptionPath}\`
- Wireframe: \`${page.wireframePath}\`
- Route map: \`docs/sitemap.md\`
- Active user flow: \`docs/flow/user-flow.md\`
- DB inventory: \`reports/wireframe-functional-specs/runs/${inventory.runId}/data-inventory.json\`
${sourceEvidence.map((item) => `- Evidence: \`${item}\``).join("\n")}
`;
}

function renderDataLinkRow(link) {
  const objectLabel = link.objectType === "table" ? link.objectName : `${link.objectType}:${link.schema ? `${link.schema}.` : ""}${link.objectName}`;
  return `| \`${objectLabel}\` | ${formatList(link.columns)} | ${link.usage} | ${escapePipes(link.pageFeature)} | ${escapePipes(link.permission)} | ${formatEvidence(link.evidence)} | ${escapePipes(link.uncertainty)} |`;
}

function renderFunctionalSpecIndex(inventory) {
  const rows = inventory.pages
    .map((page) => {
      const linkCount = inventory.pageDataLinks.filter((link) => link.iaCode === page.iaCode).length;
      return `| ${page.iaCode} | ${page.screenName} | \`${page.routeOrHostRoute}\` | ${page.audience} | ${linkCount} | [functional-spec.md](./${page.folder.split("/").at(-1)}/functional-spec.md) |`;
    })
    .join("\n");

  return `# Wireframe Functional Spec Index

이 문서는 ${inventory.summary.pageCount}개 Wireframe 페이지의 기능명세 문서와 DB 사용 명세를 한곳에서 찾기 위한 인덱스입니다.

## 기준

- Active IA: \`docs/Wireframe/\`
- Active flow: \`docs/flow/user-flow.md\`
- DB source of truth: \`supabase/migrations/*.sql\`
- Source usage scan: \`src/**\`, \`tests/**\`, \`scripts/**\`

## Page Index

| IA | Screen | Route | Audience | DB links | Spec |
| --- | --- | --- | --- | ---: | --- |
${rows}

## Known Document Conflicts

${inventory.docConflicts.map((conflict) => `- ${conflict.id}: ${conflict.detail}`).join("\n")}
`;
}

function renderDataUsageIndex(inventory) {
  const grouped = new Map();
  for (const link of inventory.pageDataLinks) {
    const key = link.objectType === "table" ? link.objectName : link.objectType === "rpc" ? `${link.schema ?? "public"}.${link.objectName}` : link.objectName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(link);
  }

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([objectName, links]) => {
      const rows = links
        .map((link) => `| ${link.iaCode} | ${link.screenName} | ${link.objectType} | ${formatList(link.columns)} | ${link.usage} | ${escapePipes(link.pageFeature)} |`)
        .join("\n");
      return `## ${objectName}

| IA | Screen | Type | Columns/fields | Usage | Page feature |
| --- | --- | --- | --- | --- | --- |
${rows}`;
    })
    .join("\n\n");

  const unmapped = inventory.unmappedDbObjects
    .map((item) => `| ${item.objectType} | \`${item.objectName}\` | ${item.classification} | ${item.reason} |`)
    .join("\n");

  return `# Wireframe Data Usage Index

이 문서는 DB 객체 기준으로 어떤 Wireframe 페이지가 어떤 데이터를 쓰는지 역색인합니다.

## Summary

- Pages: ${inventory.summary.pageCount}
- Tables: ${inventory.summary.tableCount}
- RPC/functions: ${inventory.summary.rpcCount}
- Storage buckets: ${inventory.summary.storageBucketCount}
- Page data links: ${inventory.summary.pageDataLinkCount}
- Unclassified DB objects: ${inventory.summary.unclassifiedDbObjectCount}

${sections}

## Unmapped Or Infrastructure DB Objects

| Type | Object | Classification | Reason |
| --- | --- | --- | --- |
${unmapped || "| - | - | - | - |"}

## Document Conflicts

${inventory.docConflicts.map((conflict) => `- ${conflict.id}: ${conflict.detail}`).join("\n")}
`;
}

function permissionSummary(page) {
  if (page.audience === "public") return "public route. 세션이 없을 수 있으므로 사용자 row 접근을 전제로 하지 않는다.";
  if (page.audience === "admin") return "admin guard와 RLS helper/RPC를 통과해야 한다. 변경은 감사 로그 대상이다.";
  return "로그인한 사용자만 접근하며 user-owned table은 auth.uid() 기반 RLS가 기준이다.";
}

function gapLinesFor(page) {
  const gaps = [];
  if (["X-03", "X-04"].includes(page.iaCode)) gaps.push("- Billing 테이블(subscriptions/subscription_plans/payment_history)은 있으나 실제 결제 provider 연동은 아직 없고 쓰기는 service_role 담당이다.");
  if (page.iaCode === "X-08") gaps.push("- 조직/기관 테이블(organizations/org_members/assignments/assignment_submissions)은 추가되었고, 집계 RPC와 함께 사용된다. 운영 연동(과제 알림 등)은 후속 범위다.");
  if (page.iaCode === "X-09") gaps.push("- 실제 이메일/푸시 발송 transport는 구현 범위 밖이고 preference 저장 + service가 쓰는 발송 로그만 확인된다.");
  if (["X-01", "X-06", "X-11", "X-12", "X-16", "X-17"].includes(page.iaCode)) gaps.push("- Auth 중심 화면은 Supabase Auth 동작과 UI 상태 연결을 함께 확인해야 한다.");
  if (["X-13", "X-14"].includes(page.iaCode)) gaps.push("- 정식 legal/policy 문서는 운영 전 법무/개인정보 검토로 교체해야 한다.");
  if (gaps.length === 0) gaps.push("- 현재 확인된 gap은 DB/source inventory 기준으로 문서에 기록된 항목뿐이다.");
  return gaps.join("\n");
}

function candidateLinesFor(page, links) {
  const candidates = [
    "- IA 감사 결과와 source-map이 바뀌면 구현 상태 문구를 갱신한다.",
    "- 새 migration이나 Supabase 호출이 추가되면 DB 데이터 사용 명세를 다시 생성한다.",
  ];
  if (links.some((link) => link.uncertainty !== "none")) {
    candidates.push("- 불확실성이 표시된 데이터는 제품 결정 또는 후속 구현 전까지 후보로만 취급한다.");
  }
  if (page.audience === "admin") {
    candidates.push("- 관리자 변경 기능은 admin_audit_logs 기록 여부를 후속 QA 기준에 포함한다.");
  }
  return candidates.join("\n");
}

function writeText(path, value) {
  const fullPath = resolvePath(path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, value, "utf8");
}

function formatList(items) {
  if (!items || items.length === 0) return "-";
  return items.map((item) => `\`${item}\``).join(", ");
}

function formatEvidence(items) {
  if (!items || items.length === 0) return "-";
  return items.slice(0, 5).map((item) => `\`${item}\``).join("<br>");
}

function escapePipes(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function main() {
  const args = parseArgs();
  const auditDir = typeof args["audit-dir"] === "string" ? normalizePathText(args["audit-dir"]) : `${DEFAULT_RUN_ROOT}/${timestampId()}`;
  const normalizedAuditDir = isAbsolute(auditDir) ? auditDir : normalizePathText(auditDir);
  const inventory = buildWireframeDataInventory({ auditDir: normalizedAuditDir });
  const outputPath = join(normalizedAuditDir, "data-inventory.json");
  writeJson(outputPath, inventory);

  if (args["write-specs"]) {
    writeFunctionalSpecDocs(inventory);
  }

  console.log(`Wrote ${outputPath}`);
  console.log(`Pages: ${inventory.summary.pageCount}, DB links: ${inventory.summary.pageDataLinkCount}`);
}

if (import.meta.url === `file://${process.argv[1].replaceAll("\\", "/")}` || import.meta.url.endsWith(`/${basename(process.argv[1] ?? "")}`)) {
  main();
}
