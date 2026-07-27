begin transaction read only;

with
verified_owner as (
  select
    families.id as family_id,
    family_members.id as member_id
  from public.families
  join public.family_members
    on family_members.family_id = families.id
  where families.family_key = 'default'
    and family_members.member_key = 'hagyeom'
    and family_members.role = 'child'
    and family_members.is_active = true
),
ownership_columns as (
  select
    columns.table_name,
    columns.column_name,
    columns.data_type,
    columns.is_nullable
  from information_schema.columns
  where columns.table_schema = 'public'
    and (
      (
        columns.table_name in (
          'study_plans',
          'book_plans',
          'academy_schedules'
        )
        and columns.column_name in (
          'family_id',
          'assigned_member_id',
          'created_by_member_id'
        )
      )
      or (
        columns.table_name = 'reading_plans'
        and columns.column_name = 'assigned_member_id'
      )
    )
),
new_foreign_keys as (
  select constraints.conname
  from pg_catalog.pg_constraint constraints
  where constraints.connamespace = 'public'::regnamespace
    and constraints.contype = 'f'
    and constraints.convalidated
    and constraints.conname in (
      'study_plans_family_fk',
      'study_plans_assigned_family_member_fk',
      'study_plans_created_by_family_member_fk',
      'book_plans_family_fk',
      'book_plans_assigned_family_member_fk',
      'book_plans_created_by_family_member_fk',
      'reading_plans_assigned_family_member_fk',
      'academy_schedules_family_fk',
      'academy_schedules_assigned_family_member_fk',
      'academy_schedules_created_by_family_member_fk'
    )
),
required_legacy_table_privileges as (
  select
    roles.role_name,
    tables.table_name,
    privileges.privilege_name
  from (
    values ('anon'::text), ('authenticated'::text)
  ) roles(role_name)
  cross join (
    values
      ('study_plans'::text),
      ('book_plans'::text),
      ('academy_schedules'::text)
  ) tables(table_name)
  cross join (
    values
      ('SELECT'::text),
      ('INSERT'::text),
      ('UPDATE'::text),
      ('DELETE'::text)
  ) privileges(privilege_name)
),
check_rows as (
  select
    1::bigint as check_order,
    'ownership_columns_are_nullable_uuid'::text as check_name,
    (
      count(*) = 10
      and count(*) filter (
        where data_type = 'uuid'
          and is_nullable = 'YES'
      ) = 10
    ) as passed,
    jsonb_build_object(
      'expected_column_count', 10,
      'actual_column_count', count(*)::bigint,
      'nullable_uuid_count', count(*) filter (
        where data_type = 'uuid'
          and is_nullable = 'YES'
      )::bigint
    ) as result_data
  from ownership_columns

  union all

  select
    2::bigint,
    'study_plan_id_type_contract',
    (
      select count(*) = 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'study_plans'
        and column_name = 'id'
        and data_type = 'bigint'
        and is_identity = 'YES'
        and identity_generation = 'ALWAYS'
    ),
    jsonb_build_object(
      'expected', 'bigint identity always',
      'matching_column_count', (
        select count(*)::bigint
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'study_plans'
          and column_name = 'id'
          and data_type = 'bigint'
          and is_identity = 'YES'
          and identity_generation = 'ALWAYS'
      )
    )

  union all

  select
    3::bigint,
    'study_plans_backfilled_default_hagyeom',
    (
      (select count(*) from public.study_plans) = 42
      and (
        select count(*)
        from public.study_plans
        join verified_owner
          on verified_owner.family_id = study_plans.family_id
         and verified_owner.member_id = study_plans.assigned_member_id
        where study_plans.created_by_member_id is null
      ) = 42
    ),
    jsonb_build_object(
      'total_count', (select count(*)::bigint from public.study_plans),
      'matching_count', (
        select count(*)::bigint
        from public.study_plans
        join verified_owner
          on verified_owner.family_id = study_plans.family_id
         and verified_owner.member_id = study_plans.assigned_member_id
        where study_plans.created_by_member_id is null
      )
    )

  union all

  select
    4::bigint,
    'book_plans_remain_empty_and_compatible',
    (select count(*) = 0 from public.book_plans),
    jsonb_build_object(
      'book_plan_count', (select count(*)::bigint from public.book_plans),
      'new_columns_nullable', true
    )

  union all

  select
    5::bigint,
    'reading_plan_assigned_default_hagyeom',
    (
      (select count(*) from public.reading_plans) = 1
      and (
        select count(*)
        from public.reading_plans
        join verified_owner
          on verified_owner.family_id = reading_plans.family_id
         and verified_owner.member_id = reading_plans.assigned_member_id
        join public.family_members creators
          on creators.id = reading_plans.created_by_member_id
         and creators.family_id = reading_plans.family_id
      ) = 1
    ),
    jsonb_build_object(
      'total_count', (select count(*)::bigint from public.reading_plans),
      'matching_count', (
        select count(*)::bigint
        from public.reading_plans
        join verified_owner
          on verified_owner.family_id = reading_plans.family_id
         and verified_owner.member_id = reading_plans.assigned_member_id
        join public.family_members creators
          on creators.id = reading_plans.created_by_member_id
         and creators.family_id = reading_plans.family_id
      )
    )

  union all

  select
    6::bigint,
    'academy_schedules_match_completion_owner',
    (
      (select count(*) from public.academy_schedules) = 2
      and not exists (
        select 1
        from public.academy_schedules
        left join public.academy_completion_history
          on academy_completion_history.academy_schedule_id
            = academy_schedules.id
        where academy_completion_history.id is null
           or academy_schedules.family_id
                is distinct from academy_completion_history.family_id
           or academy_schedules.assigned_member_id
                is distinct from academy_completion_history.member_id
           or academy_schedules.created_by_member_id is not null
      )
    ),
    jsonb_build_object(
      'schedule_count',
        (select count(*)::bigint from public.academy_schedules),
      'owner_mismatch_count', (
        select count(*)::bigint
        from public.academy_schedules
        left join public.academy_completion_history
          on academy_completion_history.academy_schedule_id
            = academy_schedules.id
        where academy_completion_history.id is null
           or academy_schedules.family_id
                is distinct from academy_completion_history.family_id
           or academy_schedules.assigned_member_id
                is distinct from academy_completion_history.member_id
           or academy_schedules.created_by_member_id is not null
      )
    )

  union all

  select
    7::bigint,
    'sticker_history_duplicate_removed',
    (
      (select count(*) from public.sticker_history) = 31
      and not exists (
        select 1
        from public.sticker_history
        group by sticker_history.study_plan_id
        having count(*) > 1
      )
      and (
        select count(*)
        from public.sticker_history
        where study_plan_id = 9
          and id = 3
      ) = 1
      and not exists (
        select 1
        from public.sticker_history
        where id = 4
      )
    ),
    jsonb_build_object(
      'history_count', (select count(*)::bigint from public.sticker_history),
      'duplicate_group_count', (
        select count(*)::bigint
        from (
          select sticker_history.study_plan_id
          from public.sticker_history
          group by sticker_history.study_plan_id
          having count(*) > 1
        ) duplicate_groups
      ),
      'plan_9_history_count', (
        select count(*)::bigint
        from public.sticker_history
        where study_plan_id = 9
      )
    )

  union all

  select
    8::bigint,
    'study_complete_ledger_and_balance_preserved',
    (
      (
        select count(*)
        from public.sticker_transactions
        where source_type = 'study_complete'
      ) = 31
      and (
        select count(*)
        from public.sticker_transactions
        join verified_owner
          on verified_owner.family_id = sticker_transactions.family_id
         and verified_owner.member_id = sticker_transactions.member_id
        where source_type = 'study_complete'
          and source_id = '9'
          and transaction_type = 'earn'
          and amount = 1
      ) = 1
      and (
        select coalesce(sum(sticker_transactions.amount), 0)
        from public.sticker_transactions
        join verified_owner
          on verified_owner.member_id = sticker_transactions.member_id
      ) = 47
    ),
    jsonb_build_object(
      'study_complete_transaction_count', (
        select count(*)::bigint
        from public.sticker_transactions
        where source_type = 'study_complete'
      ),
      'plan_9_transaction_count', (
        select count(*)::bigint
        from public.sticker_transactions
        where source_type = 'study_complete'
          and source_id = '9'
      ),
      'hagyeom_balance', (
        select coalesce(sum(sticker_transactions.amount), 0)::bigint
        from public.sticker_transactions
        join verified_owner
          on verified_owner.member_id = sticker_transactions.member_id
      )
    )

  union all

  select
    9::bigint,
    'new_owner_references_have_no_orphans',
    (
      not exists (
        select 1
        from public.study_plans
        left join public.families
          on families.id = study_plans.family_id
        left join public.family_members assigned
          on assigned.id = study_plans.assigned_member_id
        left join public.family_members creators
          on creators.id = study_plans.created_by_member_id
        where (study_plans.family_id is not null and families.id is null)
           or (
             study_plans.assigned_member_id is not null
             and assigned.id is null
           )
           or (
             study_plans.created_by_member_id is not null
             and creators.id is null
           )
      )
      and not exists (
        select 1
        from public.book_plans
        left join public.families
          on families.id = book_plans.family_id
        left join public.family_members assigned
          on assigned.id = book_plans.assigned_member_id
        left join public.family_members creators
          on creators.id = book_plans.created_by_member_id
        where (book_plans.family_id is not null and families.id is null)
           or (
             book_plans.assigned_member_id is not null
             and assigned.id is null
           )
           or (
             book_plans.created_by_member_id is not null
             and creators.id is null
           )
      )
      and not exists (
        select 1
        from public.reading_plans
        left join public.family_members assigned
          on assigned.id = reading_plans.assigned_member_id
        where reading_plans.assigned_member_id is not null
          and assigned.id is null
      )
      and not exists (
        select 1
        from public.academy_schedules
        left join public.families
          on families.id = academy_schedules.family_id
        left join public.family_members assigned
          on assigned.id = academy_schedules.assigned_member_id
        left join public.family_members creators
          on creators.id = academy_schedules.created_by_member_id
        where (
          academy_schedules.family_id is not null
          and families.id is null
        )
           or (
             academy_schedules.assigned_member_id is not null
             and assigned.id is null
           )
           or (
             academy_schedules.created_by_member_id is not null
             and creators.id is null
           )
      )
    ),
    jsonb_build_object('orphan_count', 0)

  union all

  select
    10::bigint,
    'new_owner_family_member_pairs_match',
    (
      not exists (
        select 1
        from public.study_plans
        left join public.family_members assigned
          on assigned.id = study_plans.assigned_member_id
         and assigned.family_id = study_plans.family_id
        left join public.family_members creators
          on creators.id = study_plans.created_by_member_id
         and creators.family_id = study_plans.family_id
        where (
          study_plans.assigned_member_id is not null
          and assigned.id is null
        )
           or (
             study_plans.created_by_member_id is not null
             and creators.id is null
           )
      )
      and not exists (
        select 1
        from public.book_plans
        left join public.family_members assigned
          on assigned.id = book_plans.assigned_member_id
         and assigned.family_id = book_plans.family_id
        left join public.family_members creators
          on creators.id = book_plans.created_by_member_id
         and creators.family_id = book_plans.family_id
        where (
          book_plans.assigned_member_id is not null
          and assigned.id is null
        )
           or (
             book_plans.created_by_member_id is not null
             and creators.id is null
           )
      )
      and not exists (
        select 1
        from public.reading_plans
        left join public.family_members assigned
          on assigned.id = reading_plans.assigned_member_id
         and assigned.family_id = reading_plans.family_id
        where reading_plans.assigned_member_id is not null
          and assigned.id is null
      )
      and not exists (
        select 1
        from public.academy_schedules
        left join public.family_members assigned
          on assigned.id = academy_schedules.assigned_member_id
         and assigned.family_id = academy_schedules.family_id
        left join public.family_members creators
          on creators.id = academy_schedules.created_by_member_id
         and creators.family_id = academy_schedules.family_id
        where (
          academy_schedules.assigned_member_id is not null
          and assigned.id is null
        )
           or (
             academy_schedules.created_by_member_id is not null
             and creators.id is null
           )
      )
    ),
    jsonb_build_object('family_member_mismatch_count', 0)

  union all

  select
    11::bigint,
    'new_foreign_keys_present_and_valid',
    (select count(*) = 10 from new_foreign_keys),
    jsonb_build_object(
      'expected_count', 10,
      'actual_count', (select count(*)::bigint from new_foreign_keys)
    )

  union all

  select
    12::bigint,
    'family_members_composite_unique_present',
    exists (
      select 1
      from pg_catalog.pg_index indexes
      where indexes.indrelid = 'public.family_members'::regclass
        and indexes.indisunique
        and indexes.indisvalid
        and indexes.indpred is null
        and indexes.indexprs is null
        and indexes.indnkeyatts = 2
        and (
          select array_agg(
            attributes.attname::text
            order by keys.ordinality
          )
          from unnest(indexes.indkey) with ordinality
            as keys(attribute_number, ordinality)
          join pg_catalog.pg_attribute attributes
            on attributes.attrelid = indexes.indrelid
           and attributes.attnum = keys.attribute_number
          where keys.ordinality <= indexes.indnkeyatts
        ) = array['family_id', 'id']::text[]
    ),
    jsonb_build_object(
      'required_key_columns', jsonb_build_array('family_id', 'id')
    )

  union all

  select
    13::bigint,
    'ownership_query_indexes_present',
    (
      select count(*) = 5
      from pg_catalog.pg_class indexes
      join pg_catalog.pg_namespace namespaces
        on namespaces.oid = indexes.relnamespace
      where namespaces.nspname = 'public'
        and indexes.relkind = 'i'
        and indexes.relname in (
          'study_plans_family_assigned_date_idx',
          'study_plans_family_created_by_idx',
          'book_plans_family_assigned_idx',
          'reading_plans_family_assigned_idx',
          'academy_schedules_family_assigned_idx'
        )
    ),
    jsonb_build_object(
      'expected_count', 5,
      'actual_count', (
        select count(*)::bigint
        from pg_catalog.pg_class indexes
        join pg_catalog.pg_namespace namespaces
          on namespaces.oid = indexes.relnamespace
        where namespaces.nspname = 'public'
          and indexes.relkind = 'i'
          and indexes.relname in (
            'study_plans_family_assigned_date_idx',
            'study_plans_family_created_by_idx',
            'book_plans_family_assigned_idx',
            'reading_plans_family_assigned_idx',
            'academy_schedules_family_assigned_idx'
          )
      )
    )

  union all

  select
    14::bigint,
    'sticker_history_partial_unique_present',
    exists (
      select 1
      from pg_catalog.pg_index indexes
      join pg_catalog.pg_class index_relations
        on index_relations.oid = indexes.indexrelid
      where indexes.indrelid = 'public.sticker_history'::regclass
        and index_relations.relname
          = 'sticker_history_study_plan_unique_idx'
        and indexes.indisunique
        and indexes.indisvalid
        and pg_catalog.pg_get_indexdef(indexes.indexrelid)
          ilike '%(study_plan_id)%'
        and pg_catalog.pg_get_expr(
          indexes.indpred,
          indexes.indrelid
        ) ilike '%study_plan_id is not null%'
    ),
    jsonb_build_object(
      'index_name', 'sticker_history_study_plan_unique_idx',
      'predicate', 'study_plan_id is not null'
    )

  union all

  select
    15::bigint,
    'hangul_constraints_preserved',
    (
      select count(*) = 7
      from pg_catalog.pg_constraint constraints
      where constraints.conrelid
          = 'public.hangul_daily_completions'::regclass
        and constraints.conname in (
          'hangul_daily_completions_member_date_key',
          'hangul_daily_completions_member_session_key',
          'hangul_daily_completions_target_check',
          'hangul_daily_completions_completed_check',
          'hangul_daily_completions_sticker_check',
          'hangul_daily_completions_session_check',
          'hangul_daily_completions_summary_check'
        )
        and constraints.convalidated
    ),
    jsonb_build_object(
      'required_named_constraint_count', 7
    )

  union all

  select
    16::bigint,
    'academy_completion_unique_preserved',
    exists (
      select 1
      from pg_catalog.pg_constraint constraints
      where constraints.conrelid
          = 'public.academy_completion_history'::regclass
        and constraints.contype = 'u'
        and constraints.convalidated
        and replace(
          pg_catalog.pg_get_constraintdef(constraints.oid),
          ' ',
          ''
        ) ilike '%unique(member_id,academy_schedule_id,completed_date)%'
    ),
    jsonb_build_object(
      'required_unique_columns',
      jsonb_build_array(
        'member_id',
        'academy_schedule_id',
        'completed_date'
      )
    )

  union all

  select
    17::bigint,
    'reward_ledger_constraints_preserved',
    (
      exists (
        select 1
        from pg_catalog.pg_constraint constraints
        where constraints.conrelid
            = 'public.sticker_transactions'::regclass
          and constraints.contype = 'u'
          and constraints.convalidated
          and replace(
            pg_catalog.pg_get_constraintdef(constraints.oid),
            ' ',
            ''
          ) ilike '%unique(member_id,source_type,source_id)%'
      )
      and exists (
        select 1
        from pg_catalog.pg_constraint constraints
        where constraints.conrelid
            = 'public.sticker_transactions'::regclass
          and constraints.contype = 'c'
          and constraints.convalidated
          and pg_catalog.pg_get_constraintdef(constraints.oid)
            ilike '%amount <> 0%'
      )
      and exists (
        select 1
        from pg_catalog.pg_constraint constraints
        where constraints.conrelid
            = 'public.sticker_transactions'::regclass
          and constraints.contype = 'c'
          and constraints.convalidated
          and pg_catalog.pg_get_constraintdef(constraints.oid)
            ilike '%transaction_type%'
          and pg_catalog.pg_get_constraintdef(constraints.oid)
            ilike '%adjustment%'
      )
    ),
    jsonb_build_object(
      'unique_source_preserved', true,
      'amount_check_preserved', true,
      'transaction_type_check_preserved', true
    )

  union all

  select
    18::bigint,
    'legacy_unconditional_policies_intentionally_retained',
    (
      (
        select count(*) = 3
        from pg_catalog.pg_policies policies
        where policies.schemaname = 'public'
          and (
            (
              policies.tablename = 'study_plans'
              and policies.policyname = 'single user study plans access'
            )
            or (
              policies.tablename = 'book_plans'
              and policies.policyname = 'book_plans_existing_app_access'
            )
            or (
              policies.tablename = 'academy_schedules'
              and policies.policyname
                = 'single user academy schedules access'
            )
          )
          and policies.cmd = 'ALL'
          and policies.qual = 'true'
          and policies.with_check = 'true'
      )
      and (
        select count(*) = 3
        from pg_catalog.pg_class relations
        where relations.oid in (
          'public.study_plans'::regclass,
          'public.book_plans'::regclass,
          'public.academy_schedules'::regclass
        )
          and relations.relrowsecurity
      )
    ),
    jsonb_build_object(
      'expected_retained_policy_count', 3,
      'phase_3_removal_required', true
    )

  union all

  select
    19::bigint,
    'legacy_rpc_execute_grants_intentionally_retained',
    (
      coalesce(
        pg_catalog.has_function_privilege(
          'anon',
          to_regprocedure(
            'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'
          ),
          'EXECUTE'
        ),
        false
      )
      and coalesce(
        pg_catalog.has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.create_book_plan(text,text,text,text,text,date,integer,integer,integer,integer[],text,text)'
          ),
          'EXECUTE'
        ),
        false
      )
      and coalesce(
        pg_catalog.has_function_privilege(
          'anon',
          to_regprocedure(
            'public.complete_study_plan_and_reschedule(bigint,date)'
          ),
          'EXECUTE'
        ),
        false
      )
      and coalesce(
        pg_catalog.has_function_privilege(
          'authenticated',
          to_regprocedure(
            'public.complete_study_plan_and_reschedule(bigint,date)'
          ),
          'EXECUTE'
        ),
        false
      )
    ),
    jsonb_build_object(
      'create_book_plan_legacy_execute_retained', true,
      'complete_and_reschedule_legacy_execute_retained', true,
      'phase_3_revocation_required', true
    )

  union all

  select
    20::bigint,
    'legacy_direct_table_grants_intentionally_retained',
    not exists (
      select 1
      from required_legacy_table_privileges
      where not pg_catalog.has_table_privilege(
        required_legacy_table_privileges.role_name,
        'public.' || required_legacy_table_privileges.table_name,
        required_legacy_table_privileges.privilege_name
      )
    ),
    jsonb_build_object(
      'expected_grant_count',
        (select count(*)::bigint from required_legacy_table_privileges),
      'actual_grant_count', (
        select count(*)::bigint
        from required_legacy_table_privileges
        where pg_catalog.has_table_privilege(
          required_legacy_table_privileges.role_name,
          'public.' || required_legacy_table_privileges.table_name,
          required_legacy_table_privileges.privilege_name
        )
      ),
      'phase_3_revocation_required', true
    )

  union all

  select
    21::bigint,
    'sticker_ledger_sync_trigger_restored',
    (
      select count(*) = 1
      from pg_catalog.pg_trigger triggers
      join pg_catalog.pg_proc procedures
        on procedures.oid = triggers.tgfoid
      where triggers.tgrelid = 'public.sticker_history'::regclass
        and triggers.tgname = 'sync_study_sticker_transaction'
        and not triggers.tgisinternal
        and triggers.tgenabled = 'O'
        and procedures.proname = 'sync_study_sticker_transaction'
    ),
    jsonb_build_object(
      'trigger_name', 'sync_study_sticker_transaction',
      'enabled', true
    )
)
select
  check_rows.check_order,
  check_rows.check_name,
  check_rows.passed,
  check_rows.result_data
from check_rows
order by check_rows.check_order;

rollback;
