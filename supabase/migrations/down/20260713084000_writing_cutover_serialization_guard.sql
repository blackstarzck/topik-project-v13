drop trigger if exists writing_cron_retirement_event_guard
  on private.writing_scheduler_event;
drop trigger if exists writing_cron_retirement_snapshot_guard
  on private.writing_cron_definition_snapshot;
drop trigger if exists writing_runtime_transition_serialization
  on private.writing_read_control;

drop function if exists private.verify_writing_cron_retirement_event();
drop function if exists private.guard_writing_cron_retirement_snapshot();
drop function if exists private.guard_writing_runtime_transition();
drop function if exists private.assert_latest_writing_draft_reconciliation(text);
