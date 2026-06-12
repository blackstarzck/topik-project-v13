-- =====================================================================
-- TALKPIK AI · Notification feature WP1-2 · 2026-06-12
-- private.dispatch_notifications() pg_cron 등록 (10분 주기)
--
-- 20260527110000_register_cleanup_cron.sql 패턴 준수:
--   - pg_cron extension 존재 시에만 등록 (미설치 환경은 조용히 skip)
--   - idempotent unschedule-then-register
--   - jobname: dispatch_notifications
--   - 권한: job은 등록 role(postgres — bypassrls 실측 확인)로 실행,
--     함수는 SECURITY DEFINER. 슬롯 판정은 함수 내부에서 사용자 timezone
--     보정으로 수행하므로 cron 자체는 UTC 10분 주기면 충분하다.
-- =====================================================================

do $$
declare
  v_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron extension not installed — skipping dispatch_notifications registration';
    return;
  end if;

  select jobid
  into v_jobid
  from cron.job
  where jobname = 'dispatch_notifications'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise log 'dispatch_notifications: existing job (jobid=%) unscheduled before reregister', v_jobid;
  end if;

  perform cron.schedule(
    'dispatch_notifications',
    '*/10 * * * *',
    $sql$ select private.dispatch_notifications() $sql$
  );

  raise log 'dispatch_notifications cron job registered (*/10 * * * * UTC)';
end $$;
