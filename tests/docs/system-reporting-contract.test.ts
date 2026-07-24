import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readDoc(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const prd = readDoc("docs/prd.md");
const databaseContract = readDoc(
  "docs/supabase/database-api-contract.md",
);
const securityContract = readDoc(
  "docs/supabase/security-and-ownership.md",
);
const operationsIndex = readDoc("docs/operations/README.md");
const handoff = readDoc("docs/operations/system-reporting-handoff.md");

describe("system reporting product and operations contract", () => {
  it("records the user-facing reporting promise and exclusions in the PRD", () => {
    expect(prd).toContain("### 시스템 리포팅");
    expect(prd).toContain("랜딩 페이지(`/`)");
    expect(prd).toContain("익명 사용자와 로그인 사용자");
    expect(prd).toContain("버그·문의·제안");
    expect(prd).toContain("query·hash");
    expect(prd).toContain("IP·referrer·원본 User-Agent");
    expect(prd).toContain("입력값을 유지");
    expect(prd).toContain("페이지 스크롤과 화면 전환");
    expect(prd).toContain("플로팅 버튼으로만");
    expect(prd).toContain("작성 중인 입력값과 오류 상태");
    expect(prd).toContain("외부 이메일·메신저 알림");
    expect(prd).toContain("관리자 처리 화면");
  });

  it("documents the HTTP, storage and idempotency contract", () => {
    expect(databaseContract).toContain("## 시스템 리포팅");
    expect(databaseContract).toContain("POST /api/system-reports");
    expect(databaseContract).toContain("Idempotency-Key");
    expect(databaseContract).toContain("16 KiB");
    expect(databaseContract).toContain("same-origin");
    expect(databaseContract).toContain("private.system_reports");
    expect(databaseContract).toContain("submit_system_report");
    expect(databaseContract).toContain(
      "20260723170000_system_reports.sql",
    );
    expect(databaseContract).toContain("201");
    expect(databaseContract).toContain("200");
    expect(databaseContract).toContain("400");
    expect(databaseContract).toContain("413");
    expect(databaseContract).toContain("503");
    expect(databaseContract).toContain("query·hash");
    expect(databaseContract).toContain("IP·referrer·원본 User-Agent");
  });

  it("keeps the table private and the RPC server-only", () => {
    expect(securityContract).toContain("## 시스템 리포팅");
    expect(securityContract).toContain("private.system_reports");
    expect(securityContract).toContain("submit_system_report");
    expect(securityContract).toContain("service_role");
    expect(securityContract).toContain("PUBLIC");
    expect(securityContract).toContain("anon");
    expect(securityContract).toContain("authenticated");
    expect(securityContract).toContain("쿠키 session");
    expect(securityContract).toContain("browser");
  });

  it("provides an indexed, executable topik-ai handoff", () => {
    expect(operationsIndex).toContain(
      "[`system-reporting-handoff.md`](./system-reporting-handoff.md)",
    );
    expect(handoff).toContain(
      "supabase/migrations/20260723170000_system_reports.sql",
    );
    expect(handoff).toContain("src/lib/supabase/types.ts");
    expect(handoff).toContain("topik-dev");
    expect(handoff).toContain("topik-prod");
    expect(handoff).toContain("dev 검증");
    expect(handoff).toContain("production 적용");
    expect(handoff).toContain("v13 handback");
    expect(handoff).toContain("v13 앱 배포");
    expect(handoff).toContain("role별");
    expect(handoff).toContain("service_role");
    expect(handoff).toContain("PUBLIC");
    expect(handoff).toContain("anon");
    expect(handoff).toContain("authenticated");
    expect(handoff).toContain("원격 DB에 적용하지 않는다");
  });

  it("fixes the intentionally deferred operations and retention policy", () => {
    expect(handoff).toContain("무기한 수동 보관");
    expect(handoff).toContain("수동 삭제");
    expect(handoff).toContain("rate limit");
    expect(handoff).toContain("CAPTCHA");
    expect(handoff).toContain("외부 알림");
    expect(handoff).toContain("관리자 처리 화면");
    expect(handoff).toContain("입력값을 유지");
    expect(handoff).toContain("잠시 후 다시 시도");
  });

  it("provides copy-runnable catalog, API and cleanup acceptance", () => {
    expect(handoff).toContain("PGSERVICE=topik-dev psql");
    expect(handoff).toContain("PGSERVICE=topik-prod psql");
    expect(handoff).toContain("pg_catalog.pg_class");
    expect(handoff).toContain("relrowsecurity");
    expect(handoff).toContain("relforcerowsecurity");
    expect(handoff).toContain("pg_catalog.aclexplode");
    expect(handoff).toContain("pg_catalog.pg_get_userbyid");
    expect(handoff).toContain(
      "pg_catalog.pg_get_userbyid(f.proowner) = 'postgres'",
    );
    expect(handoff).toContain("search_path=pg_catalog, private");
    expect(handoff).toContain("schema_authenticated_usage_ok");
    expect(handoff).toContain("table_direct_acl_ok");
    expect(handoff).toContain(
      "pg_catalog.pg_get_userbyid(t.relowner) as table_owner",
    );
    expect(handoff).toContain(
      "pg_catalog.pg_get_userbyid(t.relowner) = 'postgres' as table_owner_ok",
    );
    expect(handoff).toContain("function_acl_ok");
    expect(handoff).toContain("function_execute_allowlist_ok");
    expect(handoff).toContain("not in ('postgres', 'service_role')");
    expect(handoff).toContain("/rest/v1/rpc/submit_system_report");
    expect(handoff).toContain("SYNTHETIC_SESSION_COOKIE_FILE");
    expect(handoff).toContain("referenceCode");
    expect(handoff).toContain("--set=direct_key=\"$direct_key\"");
    expect(handoff).toContain("delete from private.system_reports");
    expect(handoff).toContain("get diagnostics v_deleted = row_count");
    expect(handoff).toContain("cleanup_acceptance_rows() {");
    expect(handoff).toContain("finalize_acceptance() {");
    expect(handoff).toContain("acceptance_status=$?");
    expect(handoff).toContain("trap finalize_acceptance EXIT");
    expect(handoff).toContain('exit "$acceptance_status"');
    expect(handoff).toContain('exit "$cleanup_status"');
    expect(handoff).toContain("모든 `*_ok` 열이 `t`");

    const acceptanceSection = handoff.slice(
      handoff.indexOf("### 4.2"),
      handoff.indexOf("## 5."),
    );
    expect(acceptanceSection.match(/```bash/g)).toHaveLength(1);
    expect(acceptanceSection.indexOf('direct_key="$(uuidgen)"')).toBeLessThan(
      acceptanceSection.indexOf("trap finalize_acceptance EXIT"),
    );
  });
});
