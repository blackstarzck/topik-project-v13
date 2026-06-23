select
  to_regclass('public.writing_submissions_draft_active_unique') is not null as index_present,
  (select count(*) from supabase_migrations.schema_migrations where version='20260619150000') as version_recorded,
  position('existing_id' in pg_get_functiondef('public.create_external_writing_submission(jsonb)'::regprocedure)) > 0 as rpc_has_dedup_logic,
  obj_description('public.create_external_writing_submission(jsonb)'::regprocedure, 'pg_proc') as rpc_comment;
