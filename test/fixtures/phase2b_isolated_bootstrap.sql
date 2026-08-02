\set ON_ERROR_STOP on

-- Test-only baseline for disposable, isolated PostgreSQL databases.
-- Provides platform roles and the minimum family/ledger schema only.

begin;

do $bootstrap_roles$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'anon'
  ) then
    execute 'create role anon nologin';
  else
    execute 'alter role anon nologin';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
  ) then
    execute 'create role authenticated nologin';
  else
    execute 'alter role authenticated nologin';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    execute 'create role service_role nologin bypassrls';
  else
    execute 'alter role service_role nologin bypassrls';
  end if;
end
$bootstrap_roles$;

create extension if not exists pgcrypto;
create extension if not exists dblink;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  family_key text not null unique,
  display_name text not null
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  member_key text not null,
  display_name text not null,
  role text not null check (role in ('parent', 'child')),
  is_active boolean not null default true,
  unique (family_id, member_key)
);

create unique index if not exists family_members_family_id_id_uidx
  on public.family_members using btree (family_id, id);

create table if not exists public.sticker_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  member_id uuid not null references public.family_members(id),
  amount integer not null,
  transaction_type text not null,
  source_type text not null,
  source_id text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (member_id, source_type, source_id)
);

do $bootstrap_contract$
declare
  missing_contract text;
begin
  select string_agg(required_role.role_name, ', ' order by required_role.role_name)
  into missing_contract
  from (
    values ('anon'), ('authenticated'), ('service_role')
  ) required_role(role_name)
  where not exists (
    select 1
    from pg_catalog.pg_roles role_row
    where role_row.rolname = required_role.role_name
      and not role_row.rolcanlogin
  );

  if missing_contract is not null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap role contract failed: ' || missing_contract;
  end if;

  if not coalesce((
    select role_row.rolbypassrls
    from pg_catalog.pg_roles role_row
    where role_row.rolname = 'service_role'
  ), false) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap service_role must bypass RLS';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension extension_row
    where extension_row.extname = 'pgcrypto'
  ) or to_regprocedure('gen_random_uuid()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap pgcrypto contract failed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension extension_row
    where extension_row.extname = 'dblink'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap dblink contract failed';
  end if;

  if to_regclass('public.families') is null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap families table is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'families'
      and column_row.column_name = 'id'
      and column_row.udt_name = 'uuid'
      and column_row.is_nullable = 'NO'
  ) or not exists (
    select 1
    from pg_catalog.pg_index index_row
    where index_row.indrelid = 'public.families'::regclass
      and index_row.indisunique
      and regexp_replace(
        lower(pg_catalog.pg_get_indexdef(index_row.indexrelid)),
        '\s+',
        '',
        'g'
      ) like '%onpublic.familiesusingbtree(id)%'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap families identity contract failed';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'families'
      and column_row.column_name = 'family_key'
      and column_row.udt_name = 'text'
      and column_row.is_nullable = 'NO'
  ) or not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'families'
      and column_row.column_name = 'display_name'
      and column_row.udt_name = 'text'
      and column_row.is_nullable = 'NO'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap families fixture contract failed';
  end if;

  if to_regclass('public.family_members') is null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap family_members table is missing';
  end if;

  select string_agg(
    expected_column.column_name,
    ', ' order by expected_column.column_name
  )
  into missing_contract
  from (
    values
      ('id', 'uuid', 'NO'),
      ('family_id', 'uuid', 'NO'),
      ('member_key', 'text', 'NO'),
      ('display_name', 'text', 'NO'),
      ('role', 'text', 'NO'),
      ('is_active', 'bool', 'NO')
  ) expected_column(column_name, udt_name, is_nullable)
  where not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'family_members'
      and column_row.column_name = expected_column.column_name
      and column_row.udt_name = expected_column.udt_name
      and column_row.is_nullable = expected_column.is_nullable
  );

  if missing_contract is not null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap family_members column contract failed: '
        || missing_contract;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.family_members'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.families'::regclass
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        = 'FOREIGN KEY (family_id) REFERENCES families(id)'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap family_members family foreign key failed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index index_row
    where index_row.indrelid = 'public.family_members'::regclass
      and index_row.indisunique
      and regexp_replace(
        lower(pg_catalog.pg_get_indexdef(index_row.indexrelid)),
        '\s+',
        '',
        'g'
      ) like '%onpublic.family_membersusingbtree(family_id,id)%'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap family/member composite uniqueness failed';
  end if;

  if to_regclass('public.sticker_transactions') is null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap sticker ledger is missing';
  end if;

  select string_agg(
    expected_column.column_name,
    ', ' order by expected_column.column_name
  )
  into missing_contract
  from (
    values
      ('id', 'uuid', 'NO'),
      ('family_id', 'uuid', 'NO'),
      ('member_id', 'uuid', 'NO'),
      ('amount', 'int4', 'NO'),
      ('transaction_type', 'text', 'NO'),
      ('source_type', 'text', 'NO'),
      ('source_id', 'text', 'NO'),
      ('description', 'text', 'NO'),
      ('metadata', 'jsonb', 'NO'),
      ('created_at', 'timestamptz', 'NO')
  ) expected_column(column_name, udt_name, is_nullable)
  where not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'sticker_transactions'
      and column_row.column_name = expected_column.column_name
      and column_row.udt_name = expected_column.udt_name
      and column_row.is_nullable = expected_column.is_nullable
  );

  if missing_contract is not null then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap sticker ledger column contract failed: '
        || missing_contract;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.sticker_transactions'::regclass
      and constraint_row.contype = 'p'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.sticker_transactions'::regclass
      and constraint_row.contype = 'u'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        = 'UNIQUE (member_id, source_type, source_id)'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap sticker ledger key contract failed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.sticker_transactions'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.families'::regclass
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        = 'FOREIGN KEY (family_id) REFERENCES families(id)'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.sticker_transactions'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.family_members'::regclass
      and pg_catalog.pg_get_constraintdef(constraint_row.oid)
        = 'FOREIGN KEY (member_id) REFERENCES family_members(id)'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap sticker ledger foreign key contract failed';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'sticker_transactions'
      and column_row.column_name = 'id'
      and column_row.column_default like '%gen_random_uuid()%'
  ) or not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'sticker_transactions'
      and column_row.column_name = 'metadata'
      and column_row.column_default = '''{}''::jsonb'
  ) or not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = 'sticker_transactions'
      and column_row.column_name = 'created_at'
      and column_row.column_default = 'now()'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap sticker ledger default contract failed';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_courses'),
        ('learning_units'),
        ('learning_content_versions'),
        ('learning_stages'),
        ('learning_questions'),
        ('learning_question_options'),
        ('learning_assignments'),
        ('learning_stage_progress'),
        ('learning_attempts'),
        ('learning_attempt_questions'),
        ('learning_attempt_answers'),
        ('learning_stage_first_passes'),
        ('learning_member_subject_profiles'),
        ('learning_unit_recommendation_metadata'),
        ('learning_assignment_plans'),
        ('learning_assignment_stage_targets'),
        ('learning_assignment_plan_revisions')
    ) forbidden_relation(relation_name)
    where to_regclass('public.' || forbidden_relation.relation_name) is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap created a forbidden learning relation';
  end if;

  if exists (
    select 1
    from (
      values
        ('create_learning_assignment_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)'),
        ('update_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,date,date,text,jsonb,uuid)'),
        ('pause_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)'),
        ('resume_learning_assignment_plan(uuid,uuid,uuid,uuid,integer,uuid)'),
        ('create_learning_assignment_with_plan(uuid,uuid,uuid,uuid,date,date,text,jsonb,uuid)'),
        ('guard_learning_attempt_plan_pause()')
    ) forbidden_function(function_identity)
    where to_regprocedure('public.' || forbidden_function.function_identity)
      is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap created a forbidden planning function';
  end if;

  if (select count(*) from public.families) <> 0
     or (select count(*) from public.family_members) <> 0
     or (select count(*) from public.sticker_transactions) <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'isolated bootstrap must remain schema-only';
  end if;
end
$bootstrap_contract$;

commit;
