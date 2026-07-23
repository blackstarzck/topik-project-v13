import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENABLED = process.env.SYSTEM_REPORTING_DB_RUNTIME_TEST === "1";
const IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.143";
const containerName = `v13-system-report-${process.pid}-${randomUUID().slice(0, 8)}`;
const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260723170000_system_reports.sql",
);

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function docker(args: string[], input?: string): CommandResult {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function expectDockerSuccess(args: string[], input?: string) {
  const result = docker(args, input);
  if (result.status !== 0) {
    throw new Error(
      `docker ${args[0]} failed (${result.status}): ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}

function psql(sql: string, role = "supabase_admin") {
  return expectDockerSuccess(
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-A",
      "-t",
      "-F",
      "|",
      "-U",
      role,
      "-d",
      "postgres",
    ],
    sql,
  );
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const logs = docker(["logs", containerName]);
    const initializationComplete = `${logs.stdout}\n${logs.stderr}`.includes(
      "PostgreSQL init process complete; ready for start up.",
    );
    if (initializationComplete) {
      const ready = docker([
        "exec",
        containerName,
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ]);
      if (ready.status === 0) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("temporary PostgreSQL did not become ready");
}

describe.skipIf(!ENABLED)("system reporting migration runtime", () => {
  beforeAll(async () => {
    expectDockerSuccess([
      "run",
      "--detach",
      "--name",
      containerName,
      "--env",
      "POSTGRES_PASSWORD=local-system-report-test",
      IMAGE,
    ]);
    await waitForPostgres();

    psql(`
      create extension if not exists pgcrypto;
      do $roles$
      begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
        if not exists (
          select 1 from pg_roles where rolname = 'authenticated'
        ) then
          create role authenticated nologin;
        end if;
        if not exists (
          select 1 from pg_roles where rolname = 'service_role'
        ) then
          create role service_role nologin bypassrls;
        end if;
      end
      $roles$;
      create schema if not exists auth;
      create schema if not exists private;
      create table if not exists auth.users (
        id uuid primary key
      );
      grant usage on schema public to anon, authenticated, service_role;
    `);
    psql(readFileSync(migrationPath, "utf8"));
  }, 60_000);

  afterAll(() => {
    docker(["rm", "--force", containerName]);
  });

  it("allows only service_role to execute the RPC", () => {
    const signature =
      "public.submit_system_report(uuid,uuid,text,text,text,text,text,text,text,text,integer,integer,text,text)";
    const privileges = psql(`
      select
        has_function_privilege('anon', '${signature}', 'EXECUTE'),
        has_function_privilege('authenticated', '${signature}', 'EXECUTE'),
        has_function_privilege('service_role', '${signature}', 'EXECUTE');
    `);
    expect(privileges).toBe("f|f|t");

    for (const role of ["anon", "authenticated"]) {
      const denied = docker(
        [
          "exec",
          "-i",
          containerName,
          "psql",
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "supabase_admin",
          "-d",
          "postgres",
        ],
        `
          set role ${role};
          select * from public.submit_system_report(
            '${randomUUID()}', null, 'bug', 'denied@example.com',
            'Denied', 'Denied call', '/terms', 'chrome', 'windows',
            'desktop', 1280, 800, 'ko', '0.0.0'
          );
        `,
      );
      expect(denied.status).not.toBe(0);
      expect(denied.stderr).toContain("permission denied");
    }
  });

  it("denies direct table access to every API role", () => {
    const privileges = psql(`
      select role_name, can_select
      from (
        values
          ('anon', has_table_privilege('anon', 'private.system_reports', 'SELECT')),
          ('authenticated', has_table_privilege('authenticated', 'private.system_reports', 'SELECT')),
          ('service_role', has_table_privilege('service_role', 'private.system_reports', 'SELECT'))
      ) as access(role_name, can_select)
      order by role_name;
    `);
    expect(privileges.split(/\r?\n/)).toEqual([
      "anon|f",
      "authenticated|f",
      "service_role|f",
    ]);

    for (const role of ["anon", "authenticated", "service_role"]) {
      const denied = docker(
        [
          "exec",
          "-i",
          containerName,
          "psql",
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "supabase_admin",
          "-d",
          "postgres",
        ],
        `set role ${role}; select * from private.system_reports;`,
      );
      expect(denied.status).not.toBe(0);
      expect(denied.stderr).toContain("permission denied");
    }
  });

  it("creates one report and returns it on an idempotent retry", () => {
    const userId = randomUUID();
    const idempotencyKey = randomUUID();
    psql(`insert into auth.users (id) values ('${userId}');`);

    const call = `
      set role service_role;
      select reference_code, inserted
      from public.submit_system_report(
        '${idempotencyKey}', '${userId}', 'bug', 'learner@example.com',
        'Runtime check', 'The same request must create only one row.',
        '/practice/next', 'chrome', 'windows', 'desktop',
        1280, 800, 'ko', '0.0.0'
      );
    `;
    const first = psql(call).split("|");
    const duplicate = psql(call).split("|");

    expect(first[0]).toMatch(/^SR-[0-9A-F]{16}$/);
    expect(first[1]).toBe("t");
    expect(duplicate).toEqual([first[0], "f"]);
    expect(
      psql(
        `select count(*) from private.system_reports where idempotency_key = '${idempotencyKey}';`,
      ),
    ).toBe("1");
  });
});
