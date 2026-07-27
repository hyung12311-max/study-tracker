begin transaction read only;

-- Read-only verification for the effects of migration 202607190001.
-- This file does not execute the project function and does not expose row identifiers,
-- session values, result payloads, ledger descriptions, or other personal data.

with
target_relation as (
  select
    c.oid,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity,
    c.relowner,
    c.relacl
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'hangul_daily_completions'
),
target_function as (
  select
    p.oid,
    p.proowner,
    p.prosecdef,
    p.provolatile,
    p.proconfig,
    l.lanname,
    pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) as result_type,
    lower(pg_catalog.pg_get_functiondef(p.oid)) as function_definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where p.oid = to_regprocedure(
    'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)'
  )
),
history_state as (
  select count(*)::bigint as recorded_count
  from supabase_migrations.schema_migrations
  where version = '202607190001'
),
expected_columns (
  column_order,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  default_kind,
  is_identity,
  is_generated
) as (
  values
    (1,  'id',              'uuid',                     'uuid',        'NO', 'gen_random_uuid', 'NO', 'NEVER'),
    (2,  'family_id',       'uuid',                     'uuid',        'NO', 'none',            'NO', 'NEVER'),
    (3,  'member_id',       'uuid',                     'uuid',        'NO', 'none',            'NO', 'NEVER'),
    (4,  'study_date',      'date',                     'date',        'NO', 'none',            'NO', 'NEVER'),
    (5,  'target_count',    'smallint',                 'int2',        'NO', 'none',            'NO', 'NEVER'),
    (6,  'completed_count', 'smallint',                 'int2',        'NO', 'none',            'NO', 'NEVER'),
    (7,  'session_id',      'text',                     'text',        'NO', 'none',            'NO', 'NEVER'),
    (8,  'result_summary',  'jsonb',                    'jsonb',       'NO', 'none',            'NO', 'NEVER'),
    (9,  'sticker_count',   'smallint',                 'int2',        'NO', 'constant_2',      'NO', 'NEVER'),
    (10, 'completed_at',    'timestamp with time zone', 'timestamptz', 'NO', 'none',            'NO', 'NEVER'),
    (11, 'created_at',      'timestamp with time zone', 'timestamptz', 'NO', 'now',             'NO', 'NEVER')
),
actual_columns as (
  select
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    case
      when c.column_default is null then 'none'
      when c.column_default ilike '%gen_random_uuid%' then 'gen_random_uuid'
      when regexp_replace(c.column_default, '[^0-9]', '', 'g') = '2' then 'constant_2'
      when c.column_default ilike '%now()%' then 'now'
      else 'other'
    end as default_kind,
    c.is_identity,
    c.is_generated
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'hangul_daily_completions'
),
expected_constraints (
  constraint_order,
  constraint_name,
  constraint_type,
  referenced_table,
  delete_action,
  required_tokens
) as (
  values
    (1,  'hangul_daily_completions_pkey',               'p', null,             null, array['primarykey(id)']),
    (2,  'hangul_daily_completions_family_id_fkey',     'f', 'families',       'NO ACTION', array['foreignkey(family_id)']),
    (3,  'hangul_daily_completions_member_id_fkey',     'f', 'family_members', 'NO ACTION', array['foreignkey(member_id)']),
    (4,  'hangul_daily_completions_member_date_key',    'u', null,             null, array['unique(member_id,study_date)']),
    (5,  'hangul_daily_completions_member_session_key', 'u', null,             null, array['unique(member_id,session_id)']),
    (6,  'hangul_daily_completions_target_check',       'c', null,             null, array['target_count', '=20']),
    (7,  'hangul_daily_completions_completed_check',    'c', null,             null, array['completed_count', '=20']),
    (8,  'hangul_daily_completions_sticker_check',      'c', null,             null, array['sticker_count', '=2']),
    (9,  'hangul_daily_completions_session_check',      'c', null,             null, array[]::text[]),
    (10, 'hangul_daily_completions_summary_check',      'c', null,             null, array[
      'jsonb_typeof(result_summary)',
      'questioncount',
      'completedquestionids',
      'jsonb_array_length',
      '=20'
    ])
),
actual_constraints as (
  select
    con.conname as constraint_name,
    con.contype::text as constraint_type,
    con.convalidated,
    ref.relname as referenced_table,
    case con.confdeltype
      when 'a' then 'NO ACTION'
      when 'r' then 'RESTRICT'
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      else null
    end as delete_action,
    case
      when con.conname = 'hangul_daily_completions_session_check' then
        regexp_replace(
          replace(
            regexp_replace(pg_catalog.pg_get_constraintdef(con.oid), '\s+', '', 'g'),
            '::text',
            ''
          ),
          '[()]',
          '',
          'g'
        ) in (
          'CHECKchar_lengthsession_idBETWEEN16AND160ANDsession_id~''^[A-Za-z0-9._:+-]+$''',
          'CHECKlengthsession_idBETWEEN16AND160ANDsession_id~''^[A-Za-z0-9._:+-]+$''',
          'CHECKchar_lengthsession_id>=16ANDchar_lengthsession_id<=160ANDsession_id~''^[A-Za-z0-9._:+-]+$''',
          'CHECKlengthsession_id>=16ANDlengthsession_id<=160ANDsession_id~''^[A-Za-z0-9._:+-]+$'''
        )
      else null
    end as session_definition_contract_matches,
    lower(regexp_replace(pg_catalog.pg_get_constraintdef(con.oid), '\s+', '', 'g')) as normalized_definition
  from pg_catalog.pg_constraint con
  join target_relation tr on tr.oid = con.conrelid
  left join pg_catalog.pg_class ref on ref.oid = con.confrelid
),
explicit_index as (
  select
    i.indisunique,
    i.indisvalid,
    i.indisready,
    lower(regexp_replace(pg_catalog.pg_get_indexdef(i.indexrelid), '\s+', '', 'g')) as normalized_definition
  from pg_catalog.pg_index i
  join pg_catalog.pg_class idx on idx.oid = i.indexrelid
  join target_relation tr on tr.oid = i.indrelid
  where idx.relname = 'hangul_daily_completions_family_date_idx'
),
function_body_contract (clause_order, clause_name, required_tokens) as (
  values
    (1, 'seoul_current_date_guard', array['asia/seoul', 'p_study_date']),
    (2, 'exact_question_count_guard', array['p_target_count <> 20', 'p_completed_count <> 20']),
    (3, 'session_contract_guard', array['char_length(p_session_id)', 'invalid session id']),
    (4, 'result_summary_contract_guard', array['jsonb_typeof(p_result_summary)', 'completedquestionids']),
    (5, 'active_dayul_child_guard', array['member_key = ''dayul''', 'role = ''child''', 'is_active = true', 'for update']),
    (6, 'completion_insert', array['insert into public.hangul_daily_completions', 'on conflict do nothing']),
    (7, 'idempotent_existing_completion', array['already_completed', 'completion_row.id is null']),
    (8, 'reward_ledger_insert', array['insert into public.sticker_transactions', '''hangul_daily_complete''', '''earn''']),
    (9, 'two_sticker_reward', array['p_family_id, p_member_id, 2', 'completion_row.id::text']),
    (10, 'new_completion_return', array['return query select true, false', 'completion_row.study_date'])
),
function_body_results as (
  select
    contract.clause_order,
    contract.clause_name,
    count(tf.oid)::bigint as function_count,
    coalesce(
      bool_and(
        not exists (
          select 1
          from unnest(contract.required_tokens) token
          where position(lower(token) in tf.function_definition) = 0
        )
      ),
      false
    ) as clause_present
  from function_body_contract contract
  left join target_function tf on true
  group by contract.clause_order, contract.clause_name
),
data_metrics (metric_order, metric_name, expected_count, actual_count) as (
  select 1, 'completion_orphan_family_rows', 0::bigint, count(*)::bigint
  from public.hangul_daily_completions c
  left join public.families f on f.id = c.family_id
  where f.id is null

  union all

  select 2, 'completion_orphan_member_rows', 0::bigint, count(*)::bigint
  from public.hangul_daily_completions c
  left join public.family_members m on m.id = c.member_id
  where m.id is null

  union all

  select 3, 'completion_member_family_mismatch_rows', 0::bigint, count(*)::bigint
  from public.hangul_daily_completions c
  join public.family_members m on m.id = c.member_id
  where m.family_id <> c.family_id

  union all

  select 4, 'invalid_completion_contract_rows', 0::bigint, count(*)::bigint
  from public.hangul_daily_completions c
  where c.target_count <> 20
     or c.completed_count <> 20
     or c.sticker_count <> 2
     or char_length(c.session_id) not between 16 and 160
     or c.session_id !~ '^[A-Za-z0-9._:+-]+$'
     or jsonb_typeof(c.result_summary) <> 'object'
     or coalesce((c.result_summary ->> 'questionCount')::integer, 0) <> 20
     or jsonb_typeof(c.result_summary -> 'completedQuestionIds') <> 'array'
     or jsonb_array_length(c.result_summary -> 'completedQuestionIds') <> 20

  union all

  select 5, 'duplicate_member_date_groups', 0::bigint, count(*)::bigint
  from (
    select member_id, study_date
    from public.hangul_daily_completions
    group by member_id, study_date
    having count(*) > 1
  ) duplicates

  union all

  select 6, 'duplicate_member_session_groups', 0::bigint, count(*)::bigint
  from (
    select member_id, session_id
    from public.hangul_daily_completions
    group by member_id, session_id
    having count(*) > 1
  ) duplicates

  union all

  select 7, 'completion_reward_cardinality_mismatch_rows', 0::bigint, count(*)::bigint
  from public.hangul_daily_completions c
  where (
    select count(*)
    from public.sticker_transactions st
    where st.source_type = 'hangul_daily_complete'
      and st.source_id = c.id::text
      and st.member_id = c.member_id
  ) <> 1

  union all

  select 8, 'orphan_hangul_reward_rows', 0::bigint, count(*)::bigint
  from public.sticker_transactions st
  left join public.hangul_daily_completions c
    on c.id::text = st.source_id
   and c.member_id = st.member_id
  where st.source_type = 'hangul_daily_complete'
    and c.id is null

  union all

  select 9, 'hangul_reward_contract_mismatch_rows', 0::bigint, count(*)::bigint
  from public.sticker_transactions st
  join public.hangul_daily_completions c
    on c.id::text = st.source_id
   and c.member_id = st.member_id
  where st.source_type = 'hangul_daily_complete'
    and (
      st.family_id <> c.family_id
      or st.amount <> 2
      or st.transaction_type <> 'earn'
    )

  union all

  select 10, 'duplicate_hangul_reward_groups', 0::bigint, count(*)::bigint
  from (
    select member_id, source_id
    from public.sticker_transactions
    where source_type = 'hangul_daily_complete'
    group by member_id, source_id
    having count(*) > 1
  ) duplicates
),
checks (
  section,
  item_order,
  check_name,
  expected,
  actual,
  passed,
  severity,
  repair_blocking
) as (
  select
    '27_migration_contract',
    1::bigint,
    'remote_history_version_absent_before_repair',
    jsonb_build_object('recorded_count', 0),
    jsonb_build_object('recorded_count', hs.recorded_count),
    hs.recorded_count = 0,
    'error',
    true
  from history_state hs

  union all

  select
    '27_migration_contract',
    dependency.dependency_order::bigint + 1,
    dependency.object_name || '_dependency_exists',
    jsonb_build_object('exists', true),
    jsonb_build_object('exists', to_regclass(dependency.qualified_name) is not null),
    to_regclass(dependency.qualified_name) is not null,
    'error',
    true
  from (
    values
      (1, 'families', 'public.families'),
      (2, 'family_members', 'public.family_members'),
      (3, 'sticker_transactions', 'public.sticker_transactions')
  ) dependency(dependency_order, object_name, qualified_name)

  union all

  select
    '28_schema_objects',
    1::bigint,
    'hangul_daily_completions_table',
    jsonb_build_object('exists', true, 'relation_kind', 'ordinary_table'),
    jsonb_build_object(
      'exists', count(tr.oid) = 1,
      'relation_kind', min(tr.relkind::text)
    ),
    count(tr.oid) = 1 and min(tr.relkind::text) = 'r',
    'error',
    true
  from target_relation tr

  union all

  select
    '28_schema_objects',
    (ec.column_order + 1)::bigint,
    'column_' || ec.column_name,
    jsonb_build_object(
      'ordinal_position', ec.column_order,
      'data_type', ec.data_type,
      'udt_name', ec.udt_name,
      'is_nullable', ec.is_nullable,
      'default_kind', ec.default_kind,
      'is_identity', ec.is_identity,
      'is_generated', ec.is_generated
    ),
    jsonb_build_object(
      'exists', ac.column_name is not null,
      'ordinal_position', ac.ordinal_position,
      'data_type', ac.data_type,
      'udt_name', ac.udt_name,
      'is_nullable', ac.is_nullable,
      'default_kind', ac.default_kind,
      'is_identity', ac.is_identity,
      'is_generated', ac.is_generated
    ),
    ac.column_name is not null
      and ac.ordinal_position = ec.column_order
      and ac.data_type = ec.data_type
      and ac.udt_name = ec.udt_name
      and ac.is_nullable = ec.is_nullable
      and ac.default_kind = ec.default_kind
      and ac.is_identity = ec.is_identity
      and ac.is_generated = ec.is_generated,
    'error',
    true
  from expected_columns ec
  left join actual_columns ac on ac.column_name = ec.column_name

  union all

  select
    '28_schema_objects',
    13::bigint,
    'unexpected_columns',
    jsonb_build_object('count', 0),
    jsonb_build_object('count', count(*)::bigint),
    count(*) = 0,
    'error',
    true
  from actual_columns ac
  left join expected_columns ec on ec.column_name = ac.column_name
  where ec.column_name is null

  union all

  select
    '28_schema_objects',
    14::bigint,
    'family_date_desc_index',
    jsonb_build_object(
      'exists', true,
      'unique', false,
      'valid', true,
      'ready', true,
      'keys', array['family_id', 'study_date_desc']
    ),
    jsonb_build_object(
      'count', count(*)::bigint,
      'unique', min(ei.indisunique::text)::boolean,
      'valid', min(ei.indisvalid::text)::boolean,
      'ready', min(ei.indisready::text)::boolean,
      'key_contract_matches', coalesce(bool_and(
        position('(family_id,study_datedesc)' in ei.normalized_definition) > 0
      ), false)
    ),
    count(*) = 1
      and not bool_or(ei.indisunique)
      and bool_and(ei.indisvalid)
      and bool_and(ei.indisready)
      and bool_and(position('(family_id,study_datedesc)' in ei.normalized_definition) > 0),
    'error',
    true
  from explicit_index ei

  union all

  select
    '29_constraints',
    ec.constraint_order::bigint,
    ec.constraint_name,
    jsonb_build_object(
      'exists', true,
      'type', ec.constraint_type,
      'validated', true,
      'referenced_table', ec.referenced_table,
      'delete_action', ec.delete_action,
      'definition_contract_matches', true
    ),
    jsonb_build_object(
      'exists', ac.constraint_name is not null,
      'type', ac.constraint_type,
      'validated', ac.convalidated,
      'referenced_table', ac.referenced_table,
      'delete_action', ac.delete_action,
      'definition_contract_matches', ac.constraint_name is not null and (
        (
          ec.constraint_name = 'hangul_daily_completions_session_check'
          and coalesce(ac.session_definition_contract_matches, false)
        )
        or (
          ec.constraint_name <> 'hangul_daily_completions_session_check'
          and not exists (
            select 1
            from unnest(ec.required_tokens) token
            where position(lower(regexp_replace(token, '\s+', '', 'g')) in ac.normalized_definition) = 0
          )
        )
      )
    ),
    ac.constraint_name is not null
      and ac.constraint_type = ec.constraint_type
      and ac.convalidated
      and (ec.referenced_table is null or ac.referenced_table = ec.referenced_table)
      and (ec.delete_action is null or ac.delete_action = ec.delete_action)
      and (
        (
          ec.constraint_name = 'hangul_daily_completions_session_check'
          and coalesce(ac.session_definition_contract_matches, false)
        )
        or (
          ec.constraint_name <> 'hangul_daily_completions_session_check'
          and not exists (
            select 1
            from unnest(ec.required_tokens) token
            where position(lower(regexp_replace(token, '\s+', '', 'g')) in ac.normalized_definition) = 0
          )
        )
      ),
    'error',
    true
  from expected_constraints ec
  left join actual_constraints ac on ac.constraint_name = ec.constraint_name

  union all

  select
    '29_constraints',
    11::bigint,
    'unexpected_table_constraints',
    jsonb_build_object('count', 0),
    jsonb_build_object('count', count(*)::bigint),
    count(*) = 0,
    'error',
    true
  from actual_constraints ac
  left join expected_constraints ec on ec.constraint_name = ac.constraint_name
  where ec.constraint_name is null

  union all

  select
    '30_function_contract',
    1::bigint,
    'exact_function_signature_presence',
    jsonb_build_object('count', 1),
    jsonb_build_object('count', count(tf.oid)::bigint),
    count(tf.oid) = 1,
    'error',
    true
  from target_function tf

  union all

  select
    '30_function_contract',
    2::bigint,
    'function_metadata',
    jsonb_build_object(
      'language', 'plpgsql',
      'security_definer', true,
      'volatility', 'volatile',
      'search_path', 'public',
      'owner', 'postgres'
    ),
    jsonb_build_object(
      'language', min(tf.lanname),
      'security_definer', min(tf.prosecdef::text)::boolean,
      'volatility', case min(tf.provolatile::text)
        when 'v' then 'volatile'
        when 's' then 'stable'
        when 'i' then 'immutable'
        else null
      end,
      'search_path_public', coalesce(bool_and(tf.proconfig @> array['search_path=public']), false),
      'owner', min(tf.owner_name)
    ),
    count(tf.oid) = 1
      and min(tf.lanname) = 'plpgsql'
      and bool_and(tf.prosecdef)
      and min(tf.provolatile::text) = 'v'
      and bool_and(tf.proconfig @> array['search_path=public'])
      and min(tf.owner_name) = 'postgres',
    'error',
    true
  from target_function tf

  union all

  select
    '30_function_contract',
    3::bigint,
    'function_arguments_and_result',
    jsonb_build_object(
      'identity_arguments',
      'p_family_id uuid, p_member_id uuid, p_study_date date, p_target_count integer, p_completed_count integer, p_session_id text, p_result_summary jsonb',
      'result_type',
      'TABLE(success boolean, already_completed boolean, completion_id uuid, sticker_awarded integer, study_date date)'
    ),
    jsonb_build_object(
      'identity_arguments', min(tf.identity_arguments),
      'result_type', min(tf.result_type)
    ),
    count(tf.oid) = 1
      and min(tf.identity_arguments) =
        'p_family_id uuid, p_member_id uuid, p_study_date date, p_target_count integer, p_completed_count integer, p_session_id text, p_result_summary jsonb'
      and min(tf.result_type) =
        'TABLE(success boolean, already_completed boolean, completion_id uuid, sticker_awarded integer, study_date date)',
    'error',
    true
  from target_function tf

  union all

  select
    '30_function_contract',
    (fbr.clause_order + 3)::bigint,
    'function_body_' || fbr.clause_name,
    jsonb_build_object('clause_present', true),
    jsonb_build_object(
      'function_count', fbr.function_count,
      'clause_present', fbr.clause_present
    ),
    fbr.function_count = 1 and fbr.clause_present,
    'error',
    true
  from function_body_results fbr

  union all

  select
    '31_rls_and_grants',
    1::bigint,
    'row_level_security',
    jsonb_build_object('enabled', true, 'forced', false),
    jsonb_build_object(
      'enabled', coalesce(bool_and(tr.relrowsecurity), false),
      'forced', coalesce(bool_or(tr.relforcerowsecurity), false)
    ),
    count(tr.oid) = 1
      and bool_and(tr.relrowsecurity)
      and not bool_or(tr.relforcerowsecurity),
    'error',
    true
  from target_relation tr

  union all

  select
    '31_rls_and_grants',
    2::bigint,
    'policy_count',
    jsonb_build_object('count', 0),
    jsonb_build_object('count', count(pol.oid)::bigint),
    count(pol.oid) = 0,
    'error',
    true
  from target_relation tr
  left join pg_catalog.pg_policy pol on pol.polrelid = tr.oid
  where pol.oid is not null

  union all

  select
    '31_rls_and_grants',
    grant_check.item_order::bigint,
    grant_check.check_name,
    grant_check.expected,
    grant_check.actual,
    grant_check.passed,
    'error',
    true
  from (
    select
      3 as item_order,
      'table_service_role_crud' as check_name,
      jsonb_build_object('select', true, 'insert', true, 'update', true, 'delete', true) as expected,
      jsonb_build_object(
        'select', has_table_privilege('service_role', 'public.hangul_daily_completions', 'SELECT'),
        'insert', has_table_privilege('service_role', 'public.hangul_daily_completions', 'INSERT'),
        'update', has_table_privilege('service_role', 'public.hangul_daily_completions', 'UPDATE'),
        'delete', has_table_privilege('service_role', 'public.hangul_daily_completions', 'DELETE')
      ) as actual,
      has_table_privilege('service_role', 'public.hangul_daily_completions', 'SELECT')
        and has_table_privilege('service_role', 'public.hangul_daily_completions', 'INSERT')
        and has_table_privilege('service_role', 'public.hangul_daily_completions', 'UPDATE')
        and has_table_privilege('service_role', 'public.hangul_daily_completions', 'DELETE') as passed

    union all

    select
      4,
      'table_anon_no_crud',
      jsonb_build_object('select', false, 'insert', false, 'update', false, 'delete', false),
      jsonb_build_object(
        'select', has_table_privilege('anon', 'public.hangul_daily_completions', 'SELECT'),
        'insert', has_table_privilege('anon', 'public.hangul_daily_completions', 'INSERT'),
        'update', has_table_privilege('anon', 'public.hangul_daily_completions', 'UPDATE'),
        'delete', has_table_privilege('anon', 'public.hangul_daily_completions', 'DELETE')
      ),
      not has_table_privilege('anon', 'public.hangul_daily_completions', 'SELECT')
        and not has_table_privilege('anon', 'public.hangul_daily_completions', 'INSERT')
        and not has_table_privilege('anon', 'public.hangul_daily_completions', 'UPDATE')
        and not has_table_privilege('anon', 'public.hangul_daily_completions', 'DELETE')

    union all

    select
      5,
      'table_authenticated_no_crud',
      jsonb_build_object('select', false, 'insert', false, 'update', false, 'delete', false),
      jsonb_build_object(
        'select', has_table_privilege('authenticated', 'public.hangul_daily_completions', 'SELECT'),
        'insert', has_table_privilege('authenticated', 'public.hangul_daily_completions', 'INSERT'),
        'update', has_table_privilege('authenticated', 'public.hangul_daily_completions', 'UPDATE'),
        'delete', has_table_privilege('authenticated', 'public.hangul_daily_completions', 'DELETE')
      ),
      not has_table_privilege('authenticated', 'public.hangul_daily_completions', 'SELECT')
        and not has_table_privilege('authenticated', 'public.hangul_daily_completions', 'INSERT')
        and not has_table_privilege('authenticated', 'public.hangul_daily_completions', 'UPDATE')
        and not has_table_privilege('authenticated', 'public.hangul_daily_completions', 'DELETE')

    union all

    select
      6,
      'function_execute_grants',
      jsonb_build_object('service_role', true, 'anon', false, 'authenticated', false),
      jsonb_build_object(
        'service_role', has_function_privilege(
          'service_role',
          'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
          'EXECUTE'
        ),
        'anon', has_function_privilege(
          'anon',
          'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
          'EXECUTE'
        ),
        'authenticated', has_function_privilege(
          'authenticated',
          'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
          'EXECUTE'
        )
      ),
      has_function_privilege(
        'service_role',
        'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
        'EXECUTE'
      )
        and not has_function_privilege(
          'anon',
          'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
          'EXECUTE'
        )
        and not has_function_privilege(
          'authenticated',
          'public.complete_hangul_daily_with_reward(uuid,uuid,date,integer,integer,text,jsonb)',
          'EXECUTE'
        )
  ) grant_check

  union all

  select
    '32_triggers',
    1::bigint,
    'non_internal_trigger_count',
    jsonb_build_object('count', 0),
    jsonb_build_object('count', count(t.oid)::bigint),
    count(t.oid) = 0,
    'error',
    true
  from target_relation tr
  left join pg_catalog.pg_trigger t
    on t.tgrelid = tr.oid
   and not t.tgisinternal
  where t.oid is not null

  union all

  select
    '33_nonidentifying_data_integrity',
    dm.metric_order::bigint,
    dm.metric_name,
    jsonb_build_object('count', dm.expected_count),
    jsonb_build_object('count', dm.actual_count),
    dm.actual_count = dm.expected_count,
    'error',
    true
  from data_metrics dm
),
summary as (
  select
    count(*)::bigint as total_checks,
    count(*) filter (where passed)::bigint as passed_checks,
    count(*) filter (where not passed)::bigint as failed_checks,
    count(*) filter (where repair_blocking and not passed)::bigint as blocking_failed_checks,
    coalesce(
      bool_and(passed) filter (
        where check_name <> 'remote_history_version_absent_before_repair'
      ),
      false
    ) as migration_effects_fully_present,
    coalesce(bool_and(not repair_blocking or passed), false)
      as history_repair_safe_candidate
  from checks
),
result_rows as (
  select
    c.section::text as section,
    c.item_order::bigint as item_order,
    jsonb_build_object(
      'check_name', c.check_name,
      'expected', c.expected,
      'actual', c.actual,
      'passed', c.passed,
      'severity', c.severity,
      'repair_blocking', c.repair_blocking
    ) as result_data
  from checks c

  union all

  select
    '34_summary'::text,
    1::bigint,
    jsonb_build_object(
      'check_name', 'migration_effects_and_history_repair_readiness',
      'expected', jsonb_build_object(
        'failed_checks', 0,
        'blocking_failed_checks', 0,
        'migration_effects_fully_present', true,
        'history_repair_safe_candidate', true
      ),
      'actual', jsonb_build_object(
        'total_checks', s.total_checks,
        'passed_checks', s.passed_checks,
        'failed_checks', s.failed_checks,
        'blocking_failed_checks', s.blocking_failed_checks,
        'migration_effects_fully_present', s.migration_effects_fully_present,
        'history_repair_safe_candidate', s.history_repair_safe_candidate
      ),
      'passed', s.migration_effects_fully_present and s.history_repair_safe_candidate,
      'severity', 'error',
      'repair_blocking', true
    )::jsonb
  from summary s
)
select
  section,
  item_order,
  result_data
from result_rows
order by section, item_order;

rollback;
