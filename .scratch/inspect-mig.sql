select
  (select string_agg(column_name||':'||data_type, ', ' order by ordinal_position)
     from information_schema.columns
    where table_schema='supabase_migrations' and table_name='schema_migrations') as columns,
  (select string_agg(version, ', ' order by version desc)
     from (select version from supabase_migrations.schema_migrations order by version desc limit 8) t) as recent_versions,
  (select count(*) from supabase_migrations.schema_migrations where version='20260619150000') as mine_present,
  (select to_regclass('public.writing_submissions_draft_active_unique')) as index_present_now;
