begin transaction read only;

-- Study Plus Multi Family preflight — SECTION 2.
-- Run this whole file in Supabase Dashboard > SQL Editor only after SECTION 1.
-- The statement returns de-identified aggregates in sections 12 through 22.
-- Mapping rules:
--   1. A family candidate may come from reading_plans.family_id,
--      sticker_history.family_id, or the family of sticker_history.member_id.
--   2. A member candidate may come only from sticker_history.member_id.
--   3. reading_plans.created_by_member_id is never treated as the assigned child.
--   4. A mapping is deterministic only when every available candidate agrees.
--   5. Plans without evidence are never assigned to a default child by assumption.

with
migration_versions as (
  select
    row_number() over (
      order by schema_migrations.version, schema_migrations.name
    )::bigint as version_order,
    schema_migrations.version,
    schema_migrations.name
  from supabase_migrations.schema_migrations schema_migrations
),
family_role_counts as (
  select
    family_members.role,
    count(*)::bigint as member_count
  from public.family_members
  group by family_members.role
),
family_member_counts as (
  select
    families.family_key,
    count(family_members.id)::bigint as member_count,
    count(*) filter (
      where family_members.is_active
    )::bigint as active_member_count,
    count(*) filter (
      where family_members.role = 'parent'
    )::bigint as parent_count,
    count(*) filter (
      where family_members.role = 'child'
    )::bigint as child_count,
    count(*) filter (
      where family_members.is_active
        and family_members.role = 'parent'
    )::bigint as active_parent_count,
    count(*) filter (
      where family_members.is_active
        and family_members.role = 'child'
    )::bigint as active_child_count
  from public.families
  left join public.family_members
    on family_members.family_id = families.id
  group by families.id, families.family_key
),
default_required_members(member_order, member_key, expected_role) as (
  values
    (1, 'father', 'parent'),
    (2, 'mother', 'parent'),
    (3, 'hagyeom', 'child'),
    (4, 'dayul', 'child')
),
default_member_status as (
  select
    default_required_members.member_order,
    default_required_members.member_key,
    default_required_members.expected_role,
    count(family_members.id)::bigint as matching_count,
    count(family_members.id) filter (
      where family_members.role = default_required_members.expected_role
    )::bigint as expected_role_count,
    count(family_members.id) filter (
      where family_members.is_active
    )::bigint as active_count,
    case
      when count(family_members.id) = 1
        then min(family_members.role)
      else null
    end as actual_role,
    case
      when count(family_members.id) = 1
        then bool_and(family_members.is_active)
      else null
    end as is_active
  from default_required_members
  left join public.families
    on families.family_key = 'default'
  left join public.family_members
    on family_members.family_id = families.id
   and family_members.member_key = default_required_members.member_key
  group by
    default_required_members.member_order,
    default_required_members.member_key,
    default_required_members.expected_role
),
family_integrity as (
  select
    (
      select count(*)::bigint
      from public.family_members
      left join public.families
        on families.id = family_members.family_id
      where families.id is null
    ) as orphan_family_members,
    (
      select count(*)::bigint
      from (
        select
          family_members.family_id,
          family_members.member_key
        from public.family_members
        group by family_members.family_id, family_members.member_key
        having count(*) > 1
      ) duplicate_groups
    ) as duplicate_member_key_groups,
    (
      select count(*)::bigint
      from public.family_members
      where family_members.role not in ('parent', 'child')
         or family_members.role is null
    ) as invalid_role_members,
    (
      select count(*)::bigint
      from family_member_counts
      where family_member_counts.active_parent_count = 0
    ) as families_without_active_parent,
    (
      select count(*)::bigint
      from family_member_counts
      where family_member_counts.active_child_count = 0
    ) as families_without_active_child
),
table_counts(table_order, table_name, row_count) as (
  select 1, 'families', count(*)::bigint from public.families
  union all
  select 2, 'family_members', count(*)::bigint from public.family_members
  union all
  select 3, 'study_plans', count(*)::bigint from public.study_plans
  union all
  select 4, 'book_plans', count(*)::bigint from public.book_plans
  union all
  select 5, 'reading_plans', count(*)::bigint from public.reading_plans
  union all
  select 6, 'academy_schedules', count(*)::bigint
    from public.academy_schedules
  union all
  select 7, 'sticker_history', count(*)::bigint
    from public.sticker_history
  union all
  select 8, 'sticker_transactions', count(*)::bigint
    from public.sticker_transactions
  union all
  select 9, 'academy_completion_history', count(*)::bigint
    from public.academy_completion_history
  union all
  select 10, 'hangul_daily_completions', count(*)::bigint
    from public.hangul_daily_completions
  union all
  select 11, 'reward_settings', count(*)::bigint
    from public.reward_settings
  union all
  select 12, 'sticker_reward_settings', count(*)::bigint
    from public.sticker_reward_settings
  union all
  select 13, 'reward_milestones', count(*)::bigint
    from public.reward_milestones
  union all
  select 14, 'reward_products', count(*)::bigint
    from public.reward_products
  union all
  select 15, 'reward_exchange_requests', count(*)::bigint
    from public.reward_exchange_requests
  union all
  select 16, 'reward_exchange_history', count(*)::bigint
    from public.reward_exchange_history
  union all
  select 17, 'reward_wishlist', count(*)::bigint
    from public.reward_wishlist
  union all
  select 18, 'completion_notifications', count(*)::bigint
    from public.completion_notifications
),
study_direct_sticker_evidence as (
  select
    sticker_history.study_plan_id,
    count(*)::bigint as history_count,
    count(distinct sticker_history.family_id) filter (
      where sticker_history.family_id is not null
    )::bigint as direct_family_count,
    count(distinct sticker_history.member_id) filter (
      where sticker_history.member_id is not null
    )::bigint as member_count
  from public.sticker_history
  group by sticker_history.study_plan_id
),
study_family_candidates as (
  select
    study_plans.id as study_plan_id,
    reading_plans.family_id
  from public.study_plans
  join public.reading_plans
    on reading_plans.id = study_plans.reading_plan_id
  union
  select
    sticker_history.study_plan_id,
    sticker_history.family_id
  from public.sticker_history
  where sticker_history.family_id is not null
  union
  select
    sticker_history.study_plan_id,
    family_members.family_id
  from public.sticker_history
  join public.family_members
    on family_members.id = sticker_history.member_id
),
study_family_evidence as (
  select
    study_family_candidates.study_plan_id,
    count(*)::bigint as family_candidate_count,
    (array_agg(study_family_candidates.family_id))[1]
      as deterministic_family_id
  from study_family_candidates
  group by study_family_candidates.study_plan_id
),
study_member_candidates as (
  select distinct
    sticker_history.study_plan_id,
    sticker_history.member_id
  from public.sticker_history
  where sticker_history.member_id is not null
),
study_member_evidence as (
  select
    study_member_candidates.study_plan_id,
    count(*)::bigint as member_candidate_count,
    (array_agg(study_member_candidates.member_id))[1]
      as deterministic_member_id
  from study_member_candidates
  group by study_member_candidates.study_plan_id
),
study_reading_sticker_mismatch as (
  select distinct study_plans.id as study_plan_id
  from public.study_plans
  join public.reading_plans
    on reading_plans.id = study_plans.reading_plan_id
  join public.sticker_history
    on sticker_history.study_plan_id = study_plans.id
  where sticker_history.family_id is not null
    and sticker_history.family_id <> reading_plans.family_id
),
study_mapping as (
  select
    study_plans.id as study_plan_id,
    study_plans.reading_plan_id,
    study_plans.book_plan_id,
    coalesce(study_family_evidence.family_candidate_count, 0)::bigint
      as family_candidate_count,
    study_family_evidence.deterministic_family_id,
    coalesce(study_member_evidence.member_candidate_count, 0)::bigint
      as member_candidate_count,
    study_member_evidence.deterministic_member_id,
    family_members.family_id as deterministic_member_family_id,
    coalesce(study_direct_sticker_evidence.direct_family_count, 0)::bigint
      as sticker_direct_family_count,
    coalesce(study_direct_sticker_evidence.member_count, 0)::bigint
      as sticker_member_count,
    (study_reading_sticker_mismatch.study_plan_id is not null)
      as reading_sticker_family_mismatch,
    case
      when coalesce(study_family_evidence.family_candidate_count, 0) > 1
        or coalesce(study_member_evidence.member_candidate_count, 0) > 1
        or study_reading_sticker_mismatch.study_plan_id is not null
        or (
          study_family_evidence.family_candidate_count = 1
          and study_member_evidence.member_candidate_count = 1
          and family_members.family_id
            is distinct from study_family_evidence.deterministic_family_id
        )
        then 'ambiguous'
      when coalesce(study_family_evidence.family_candidate_count, 0) = 1
        and coalesce(study_member_evidence.member_candidate_count, 0) = 1
        and family_members.family_id
          = study_family_evidence.deterministic_family_id
        then 'family_and_member_deterministic'
      when coalesce(study_family_evidence.family_candidate_count, 0) = 1
        and coalesce(study_member_evidence.member_candidate_count, 0) = 0
        then 'family_only_deterministic'
      else 'unmapped'
    end as mapping_class
  from public.study_plans
  left join study_family_evidence
    on study_family_evidence.study_plan_id = study_plans.id
  left join study_member_evidence
    on study_member_evidence.study_plan_id = study_plans.id
  left join public.family_members
    on family_members.id = study_member_evidence.deterministic_member_id
  left join study_direct_sticker_evidence
    on study_direct_sticker_evidence.study_plan_id = study_plans.id
  left join study_reading_sticker_mismatch
    on study_reading_sticker_mismatch.study_plan_id = study_plans.id
),
book_link_counts as (
  select
    book_plans.id as book_plan_id,
    count(study_plans.id)::bigint as linked_study_plan_count
  from public.book_plans
  left join public.study_plans
    on study_plans.book_plan_id = book_plans.id
  group by book_plans.id
),
book_family_candidates as (
  select distinct
    study_plans.book_plan_id,
    sticker_history.family_id
  from public.study_plans
  join public.sticker_history
    on sticker_history.study_plan_id = study_plans.id
  where study_plans.book_plan_id is not null
    and sticker_history.family_id is not null
  union
  select distinct
    study_plans.book_plan_id,
    family_members.family_id
  from public.study_plans
  join public.sticker_history
    on sticker_history.study_plan_id = study_plans.id
  join public.family_members
    on family_members.id = sticker_history.member_id
  where study_plans.book_plan_id is not null
),
book_member_candidates as (
  select distinct
    study_plans.book_plan_id,
    sticker_history.member_id
  from public.study_plans
  join public.sticker_history
    on sticker_history.study_plan_id = study_plans.id
  where study_plans.book_plan_id is not null
    and sticker_history.member_id is not null
),
book_family_evidence as (
  select
    book_family_candidates.book_plan_id,
    count(*)::bigint as family_candidate_count,
    (array_agg(book_family_candidates.family_id))[1]
      as deterministic_family_id
  from book_family_candidates
  group by book_family_candidates.book_plan_id
),
book_member_evidence as (
  select
    book_member_candidates.book_plan_id,
    count(*)::bigint as member_candidate_count,
    (array_agg(book_member_candidates.member_id))[1]
      as deterministic_member_id
  from book_member_candidates
  group by book_member_candidates.book_plan_id
),
book_mapping as (
  select
    book_plans.id as book_plan_id,
    book_link_counts.linked_study_plan_count,
    coalesce(book_family_evidence.family_candidate_count, 0)::bigint
      as family_candidate_count,
    coalesce(book_member_evidence.member_candidate_count, 0)::bigint
      as member_candidate_count,
    case
      when coalesce(book_family_evidence.family_candidate_count, 0) = 1
        and coalesce(book_member_evidence.member_candidate_count, 0) = 1
        and family_members.family_id
          = book_family_evidence.deterministic_family_id
        then 'family_and_member_deterministic'
      when coalesce(book_family_evidence.family_candidate_count, 0) > 1
        or coalesce(book_member_evidence.member_candidate_count, 0) > 1
        or (
          book_family_evidence.family_candidate_count = 1
          and book_member_evidence.member_candidate_count = 1
          and family_members.family_id
            is distinct from book_family_evidence.deterministic_family_id
        )
        then 'ambiguous'
      else 'unmapped'
    end as mapping_class
  from public.book_plans
  join book_link_counts
    on book_link_counts.book_plan_id = book_plans.id
  left join book_family_evidence
    on book_family_evidence.book_plan_id = book_plans.id
  left join book_member_evidence
    on book_member_evidence.book_plan_id = book_plans.id
  left join public.family_members
    on family_members.id = book_member_evidence.deterministic_member_id
),
academy_family_candidates as (
  select distinct
    academy_completion_history.academy_schedule_id,
    academy_completion_history.family_id
  from public.academy_completion_history
  where academy_completion_history.family_id is not null
  union
  select distinct
    academy_completion_history.academy_schedule_id,
    family_members.family_id
  from public.academy_completion_history
  join public.family_members
    on family_members.id = academy_completion_history.member_id
),
academy_member_candidates as (
  select distinct
    academy_completion_history.academy_schedule_id,
    academy_completion_history.member_id
  from public.academy_completion_history
  where academy_completion_history.member_id is not null
),
academy_family_evidence as (
  select
    academy_family_candidates.academy_schedule_id,
    count(*)::bigint as family_candidate_count,
    (array_agg(academy_family_candidates.family_id))[1]
      as deterministic_family_id
  from academy_family_candidates
  group by academy_family_candidates.academy_schedule_id
),
academy_member_evidence as (
  select
    academy_member_candidates.academy_schedule_id,
    count(*)::bigint as member_candidate_count,
    (array_agg(academy_member_candidates.member_id))[1]
      as deterministic_member_id
  from academy_member_candidates
  group by academy_member_candidates.academy_schedule_id
),
academy_completion_counts as (
  select
    academy_schedules.id as academy_schedule_id,
    count(academy_completion_history.id)::bigint as completion_count
  from public.academy_schedules
  left join public.academy_completion_history
    on academy_completion_history.academy_schedule_id = academy_schedules.id
  group by academy_schedules.id
),
academy_mapping as (
  select
    academy_schedules.id as academy_schedule_id,
    academy_completion_counts.completion_count,
    coalesce(academy_family_evidence.family_candidate_count, 0)::bigint
      as family_candidate_count,
    coalesce(academy_member_evidence.member_candidate_count, 0)::bigint
      as member_candidate_count,
    case
      when coalesce(academy_family_evidence.family_candidate_count, 0) = 1
        and coalesce(academy_member_evidence.member_candidate_count, 0) = 1
        and family_members.family_id
          = academy_family_evidence.deterministic_family_id
        then 'family_and_member_deterministic'
      when coalesce(academy_family_evidence.family_candidate_count, 0) > 1
        or coalesce(academy_member_evidence.member_candidate_count, 0) > 1
        or (
          academy_family_evidence.family_candidate_count = 1
          and academy_member_evidence.member_candidate_count = 1
          and family_members.family_id
            is distinct from academy_family_evidence.deterministic_family_id
        )
        then 'ambiguous'
      else 'unmapped'
    end as mapping_class
  from public.academy_schedules
  join academy_completion_counts
    on academy_completion_counts.academy_schedule_id = academy_schedules.id
  left join academy_family_evidence
    on academy_family_evidence.academy_schedule_id = academy_schedules.id
  left join academy_member_evidence
    on academy_member_evidence.academy_schedule_id = academy_schedules.id
  left join public.family_members
    on family_members.id = academy_member_evidence.deterministic_member_id
),
sticker_history_integrity as (
  select
    count(*)::bigint as total_count,
    count(*) filter (
      where sticker_history.family_id is null
    )::bigint as null_family_count,
    count(*) filter (
      where sticker_history.member_id is null
    )::bigint as null_member_count,
    count(*) filter (
      where sticker_history.study_plan_id is null
    )::bigint as null_study_plan_count,
    count(*) filter (
      where sticker_history.family_id is not null
        and families.id is null
    )::bigint as orphan_family_count,
    count(*) filter (
      where sticker_history.member_id is not null
        and family_members.id is null
    )::bigint as orphan_member_count,
    count(*) filter (
      where sticker_history.study_plan_id is not null
        and study_plans.id is null
    )::bigint as orphan_study_plan_count,
    count(*) filter (
      where sticker_history.family_id is not null
        and family_members.id is not null
        and sticker_history.family_id <> family_members.family_id
    )::bigint as family_member_mismatch_count
  from public.sticker_history
  left join public.families
    on families.id = sticker_history.family_id
  left join public.family_members
    on family_members.id = sticker_history.member_id
  left join public.study_plans
    on study_plans.id = sticker_history.study_plan_id
),
sticker_history_duplicate_groups as (
  select count(*)::bigint as duplicate_group_count
  from (
    select sticker_history.study_plan_id
    from public.sticker_history
    group by sticker_history.study_plan_id
    having count(*) > 1
  ) duplicate_groups
),
sticker_history_ambiguous_groups as (
  select count(*)::bigint as ambiguous_group_count
  from (
    select sticker_history.study_plan_id
    from public.sticker_history
    group by sticker_history.study_plan_id
    having count(distinct sticker_history.family_id) filter (
      where sticker_history.family_id is not null
    ) > 1
       or count(distinct sticker_history.member_id) filter (
         where sticker_history.member_id is not null
       ) > 1
  ) ambiguous_groups
),
transaction_integrity as (
  select
    count(*)::bigint as total_count,
    count(*) filter (
      where families.id is null
    )::bigint as orphan_family_count,
    count(*) filter (
      where family_members.id is null
    )::bigint as orphan_member_count,
    count(*) filter (
      where family_members.id is not null
        and sticker_transactions.family_id <> family_members.family_id
    )::bigint as family_member_mismatch_count,
    count(*) filter (
      where family_members.id is not null
        and family_members.role <> 'child'
    )::bigint as non_child_transaction_count
  from public.sticker_transactions
  left join public.families
    on families.id = sticker_transactions.family_id
  left join public.family_members
    on family_members.id = sticker_transactions.member_id
),
transaction_duplicate_groups as (
  select count(*)::bigint as duplicate_group_count
  from (
    select
      sticker_transactions.member_id,
      sticker_transactions.source_type,
      sticker_transactions.source_id
    from public.sticker_transactions
    group by
      sticker_transactions.member_id,
      sticker_transactions.source_type,
      sticker_transactions.source_id
    having count(*) > 1
  ) duplicate_groups
),
transaction_source_summary as (
  select
    sticker_transactions.source_type,
    count(*)::bigint as transaction_count,
    coalesce(sum(sticker_transactions.amount), 0)::bigint as amount_sum
  from public.sticker_transactions
  group by sticker_transactions.source_type
),
member_wallet_summary as (
  select
    families.family_key,
    family_members.member_key,
    family_members.role,
    coalesce(sum(sticker_transactions.amount), 0)::bigint as balance
  from public.sticker_transactions
  join public.family_members
    on family_members.id = sticker_transactions.member_id
   and family_members.family_id = sticker_transactions.family_id
  join public.families
    on families.id = sticker_transactions.family_id
  group by
    families.family_key,
    family_members.member_key,
    family_members.role
),
academy_integrity as (
  select
    count(*) filter (
      where academy_schedules.id is null
    )::bigint as orphan_schedule_count,
    count(*) filter (
      where family_members.id is null
    )::bigint as orphan_member_count,
    count(*) filter (
      where families.id is null
    )::bigint as orphan_family_count,
    count(*) filter (
      where family_members.id is not null
        and academy_completion_history.family_id <> family_members.family_id
    )::bigint as family_member_mismatch_count
  from public.academy_completion_history
  left join public.academy_schedules
    on academy_schedules.id
      = academy_completion_history.academy_schedule_id
  left join public.family_members
    on family_members.id = academy_completion_history.member_id
  left join public.families
    on families.id = academy_completion_history.family_id
),
academy_duplicate_groups as (
  select count(*)::bigint as duplicate_group_count
  from (
    select
      academy_completion_history.member_id,
      academy_completion_history.academy_schedule_id,
      academy_completion_history.completed_date
    from public.academy_completion_history
    group by
      academy_completion_history.member_id,
      academy_completion_history.academy_schedule_id,
      academy_completion_history.completed_date
    having count(*) > 1
  ) duplicate_groups
),
hangul_integrity as (
  select
    count(*)::bigint as total_count,
    count(*) filter (
      where families.id is null
    )::bigint as orphan_family_count,
    count(*) filter (
      where family_members.id is null
    )::bigint as orphan_member_count,
    count(*) filter (
      where family_members.id is not null
        and hangul_daily_completions.family_id <> family_members.family_id
    )::bigint as family_member_mismatch_count,
    count(*) filter (
      where family_members.id is not null
        and family_members.role <> 'child'
    )::bigint as non_child_completion_count,
    count(*) filter (
      where hangul_daily_completions.target_count <> 20
    )::bigint as invalid_target_count,
    count(*) filter (
      where hangul_daily_completions.completed_count
        < hangul_daily_completions.target_count
    )::bigint as incomplete_count,
    count(*) filter (
      where hangul_daily_completions.sticker_count <> 2
    )::bigint as invalid_sticker_count
  from public.hangul_daily_completions
  left join public.families
    on families.id = hangul_daily_completions.family_id
  left join public.family_members
    on family_members.id = hangul_daily_completions.member_id
),
hangul_date_duplicate_groups as (
  select count(*)::bigint as duplicate_group_count
  from (
    select
      hangul_daily_completions.member_id,
      hangul_daily_completions.study_date
    from public.hangul_daily_completions
    group by
      hangul_daily_completions.member_id,
      hangul_daily_completions.study_date
    having count(*) > 1
  ) duplicate_groups
),
hangul_session_duplicate_groups as (
  select count(*)::bigint as duplicate_group_count
  from (
    select
      hangul_daily_completions.member_id,
      hangul_daily_completions.session_id
    from public.hangul_daily_completions
    group by
      hangul_daily_completions.member_id,
      hangul_daily_completions.session_id
    having count(*) > 1
  ) duplicate_groups
),
hangul_transaction_correspondence as (
  select
    count(*) filter (
      where matching_transactions.transaction_count is null
    )::bigint as completions_without_transaction,
    count(*) filter (
      where matching_transactions.transaction_count > 1
    )::bigint as completions_with_multiple_transactions
  from public.hangul_daily_completions
  left join lateral (
    select count(*)::bigint as transaction_count
    from public.sticker_transactions
    where sticker_transactions.source_type = 'hangul_daily_complete'
      and sticker_transactions.member_id
        = hangul_daily_completions.member_id
      and sticker_transactions.source_id
        = hangul_daily_completions.id::text
    having count(*) > 0
  ) matching_transactions
    on true
),
reward_consistency as (
  select
    (
      select count(*)::bigint
      from public.sticker_transactions
      where sticker_transactions.source_type = 'study_complete'
        and not exists (
          select 1
          from public.sticker_history
          where sticker_history.study_plan_id::text
              = sticker_transactions.source_id
            and sticker_history.member_id = sticker_transactions.member_id
        )
    ) as study_transactions_without_history,
    (
      select count(*)::bigint
      from (
        select sticker_transactions.source_id
        from public.sticker_transactions
        where sticker_transactions.source_type = 'study_complete'
        group by sticker_transactions.source_id
        having count(*) > 1
      ) duplicate_groups
    ) as duplicate_study_transaction_groups,
    (
      select count(*)::bigint
      from public.sticker_transactions
      where sticker_transactions.source_type = 'academy_complete'
        and not exists (
          select 1
          from public.academy_completion_history
          where academy_completion_history.id::text
              = sticker_transactions.source_id
            and academy_completion_history.member_id
              = sticker_transactions.member_id
        )
    ) as academy_transactions_without_completion,
    (
      select count(*)::bigint
      from public.sticker_transactions
      where sticker_transactions.source_type = 'hangul_daily_complete'
        and not exists (
          select 1
          from public.hangul_daily_completions
          where hangul_daily_completions.id::text
              = sticker_transactions.source_id
            and hangul_daily_completions.member_id
              = sticker_transactions.member_id
        )
    ) as hangul_transactions_without_completion,
    (
      select count(*)::bigint
      from public.sticker_transactions
      where sticker_transactions.amount < 0
        and sticker_transactions.transaction_type
          not in ('spend', 'adjustment')
    ) as negative_amount_type_mismatch,
    (
      select count(*)::bigint
      from public.sticker_transactions
      where sticker_transactions.amount > 0
        and sticker_transactions.transaction_type
          not in ('earn', 'adjustment')
    ) as positive_amount_type_mismatch
),
backfill_status as (
  select
    (select count(*) from public.families where family_key = 'default')
      ::bigint as default_family_count,
    (
      select matching_count
      from default_member_status
      where member_key = 'father'
        and expected_role_count = matching_count
        and active_count = matching_count
    ) as father_parent_count,
    (
      select matching_count
      from default_member_status
      where member_key = 'mother'
        and expected_role_count = matching_count
        and active_count = matching_count
    ) as mother_parent_count,
    (
      select matching_count
      from default_member_status
      where member_key = 'hagyeom'
        and expected_role_count = matching_count
        and active_count = matching_count
    ) as hagyeom_child_count,
    (
      select matching_count
      from default_member_status
      where member_key = 'dayul'
        and expected_role_count = matching_count
        and active_count = matching_count
    ) as dayul_child_count,
    (
      select count(*)::bigint
      from study_mapping
      where family_candidate_count <> 1
    ) as study_plan_families_requiring_decision,
    (
      select count(*)::bigint
      from study_mapping
      where mapping_class <> 'family_and_member_deterministic'
    ) as study_plan_members_requiring_decision,
    (
      select count(*)::bigint
      from book_mapping
      where family_candidate_count <> 1
    ) as book_plan_families_requiring_decision,
    (
      select count(*)::bigint
      from book_mapping
      where mapping_class <> 'family_and_member_deterministic'
    ) as book_plan_members_requiring_decision,
    (
      select count(*)::bigint
      from academy_mapping
      where family_candidate_count <> 1
    ) as academy_schedule_families_requiring_decision,
    (
      select count(*)::bigint
      from academy_mapping
      where mapping_class <> 'family_and_member_deterministic'
    ) as academy_schedule_members_requiring_decision,
    (
      family_integrity.orphan_family_members
      + sticker_history_integrity.orphan_family_count
      + sticker_history_integrity.orphan_member_count
      + sticker_history_integrity.orphan_study_plan_count
      + transaction_integrity.orphan_family_count
      + transaction_integrity.orphan_member_count
      + academy_integrity.orphan_schedule_count
      + academy_integrity.orphan_member_count
      + academy_integrity.orphan_family_count
      + hangul_integrity.orphan_family_count
      + hangul_integrity.orphan_member_count
    )::bigint as orphan_total,
    (
      sticker_history_integrity.family_member_mismatch_count
      + transaction_integrity.family_member_mismatch_count
      + academy_integrity.family_member_mismatch_count
      + hangul_integrity.family_member_mismatch_count
    )::bigint as family_member_mismatch_total,
    (
      sticker_history_duplicate_groups.duplicate_group_count
      + sticker_history_ambiguous_groups.ambiguous_group_count
      + transaction_duplicate_groups.duplicate_group_count
      + academy_duplicate_groups.duplicate_group_count
      + hangul_date_duplicate_groups.duplicate_group_count
      + hangul_session_duplicate_groups.duplicate_group_count
      + reward_consistency.duplicate_study_transaction_groups
      + hangul_transaction_correspondence.completions_with_multiple_transactions
    )::bigint as duplicate_or_ambiguous_total,
    (
      reward_consistency.study_transactions_without_history
      + reward_consistency.academy_transactions_without_completion
      + reward_consistency.hangul_transactions_without_completion
    )::bigint as source_orphan_total,
    (
      hangul_transaction_correspondence.completions_without_transaction
      + hangul_transaction_correspondence.completions_with_multiple_transactions
    )::bigint as completion_transaction_issue_total,
    (
      reward_consistency.negative_amount_type_mismatch
      + reward_consistency.positive_amount_type_mismatch
    )::bigint as transaction_type_mismatch_total
  from family_integrity
  cross join sticker_history_integrity
  cross join sticker_history_duplicate_groups
  cross join sticker_history_ambiguous_groups
  cross join transaction_integrity
  cross join transaction_duplicate_groups
  cross join academy_integrity
  cross join academy_duplicate_groups
  cross join hangul_integrity
  cross join hangul_date_duplicate_groups
  cross join hangul_session_duplicate_groups
  cross join hangul_transaction_correspondence
  cross join reward_consistency
),
section_12 as (
  select
    '12_migration_versions'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'metric', 'migration_version_count',
      'count', count(*)::bigint
    ) as result_data
  from migration_versions
  union all
  select
    '12_migration_versions'::text,
    migration_versions.version_order + 1,
    jsonb_build_object(
      'metric', 'migration_version',
      'order', migration_versions.version_order,
      'version', migration_versions.version,
      'name', migration_versions.name
    )
  from migration_versions
),
section_13 as (
  select
    '13_family_summary'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'metric', 'overall',
      'family_count', (select count(*)::bigint from public.families),
      'default_family_count',
        (select count(*)::bigint from public.families where family_key = 'default'),
      'member_count', (select count(*)::bigint from public.family_members),
      'active_member_count',
        (select count(*)::bigint from public.family_members where is_active),
      'inactive_member_count',
        (select count(*)::bigint from public.family_members where not is_active)
    ) as result_data
  union all
  select
    '13_family_summary'::text,
    100::bigint + row_number() over (order by family_role_counts.role),
    jsonb_build_object(
      'metric', 'role_count',
      'role', family_role_counts.role,
      'count', family_role_counts.member_count
    )
  from family_role_counts
  union all
  select
    '13_family_summary'::text,
    200::bigint + row_number() over (order by family_member_counts.family_key),
    jsonb_build_object(
      'metric', 'family_member_count',
      'family_key', family_member_counts.family_key,
      'member_count', family_member_counts.member_count,
      'active_member_count', family_member_counts.active_member_count
    )
  from family_member_counts
  union all
  select
    '13_family_summary'::text,
    300::bigint + default_member_status.member_order,
    jsonb_build_object(
      'metric', 'default_required_member',
      'member_key', default_member_status.member_key,
      'exists', (default_member_status.matching_count > 0),
      'matching_count', default_member_status.matching_count,
      'role', default_member_status.actual_role,
      'expected_role', default_member_status.expected_role,
      'is_active', default_member_status.is_active
    )
  from default_member_status
),
section_14 as (
  select
    '14_family_integrity'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from family_integrity
  cross join lateral (
    values
      (1, 'orphan_family_members', orphan_family_members),
      (2, 'duplicate_family_member_key_groups', duplicate_member_key_groups),
      (3, 'invalid_role_members', invalid_role_members),
      (4, 'families_without_active_parent', families_without_active_parent),
      (5, 'families_without_active_child', families_without_active_child)
  ) metrics(item_order, metric, metric_count)
  union all
  select
    '14_family_integrity'::text,
    100::bigint + row_number() over (order by family_member_counts.family_key),
    jsonb_build_object(
      'metric', 'family_role_counts',
      'family_key', family_member_counts.family_key,
      'parent_count', family_member_counts.parent_count,
      'child_count', family_member_counts.child_count,
      'active_parent_count', family_member_counts.active_parent_count,
      'active_child_count', family_member_counts.active_child_count
    )
  from family_member_counts
),
section_15 as (
  select
    '15_table_counts'::text as section,
    table_counts.table_order::bigint as item_order,
    jsonb_build_object(
      'table_name', table_counts.table_name,
      'row_count', table_counts.row_count
    ) as result_data
  from table_counts
),
section_16 as (
  select
    '16_study_plan_mapping'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from (
    values
      (1, 'total', (select count(*)::bigint from study_mapping)),
      (2, 'with_reading_plan',
        (select count(*)::bigint from study_mapping where reading_plan_id is not null)),
      (3, 'with_book_plan',
        (select count(*)::bigint from study_mapping where book_plan_id is not null)),
      (4, 'standalone',
        (select count(*)::bigint from study_mapping
         where reading_plan_id is null and book_plan_id is null)),
      (5, 'both_reading_and_book',
        (select count(*)::bigint from study_mapping
         where reading_plan_id is not null and book_plan_id is not null)),
      (6, 'orphan_reading_plan',
        (select count(*)::bigint
         from public.study_plans
         left join public.reading_plans
           on reading_plans.id = study_plans.reading_plan_id
         where study_plans.reading_plan_id is not null
           and reading_plans.id is null)),
      (7, 'orphan_book_plan',
        (select count(*)::bigint
         from public.study_plans
         left join public.book_plans
           on book_plans.id = study_plans.book_plan_id
         where study_plans.book_plan_id is not null
           and book_plans.id is null)),
      (8, 'family_via_reading_plan',
        (select count(*)::bigint
         from public.study_plans
         join public.reading_plans
           on reading_plans.id = study_plans.reading_plan_id)),
      (9, 'family_via_sticker_history',
        (select count(*)::bigint from study_mapping
         where sticker_direct_family_count = 1)),
      (10, 'member_via_sticker_history',
        (select count(*)::bigint from study_mapping
         where sticker_member_count = 1)),
      (11, 'reading_sticker_family_mismatch',
        (select count(*)::bigint from study_mapping
         where reading_sticker_family_mismatch)),
      (12, 'ambiguous_sticker_family_or_member',
        (select count(*)::bigint from study_mapping
         where sticker_direct_family_count > 1 or sticker_member_count > 1)),
      (13, 'family_unmapped',
        (select count(*)::bigint from study_mapping
         where family_candidate_count = 0)),
      (14, 'member_unmapped',
        (select count(*)::bigint from study_mapping
         where member_candidate_count = 0))
  ) metrics(item_order, metric, metric_count)
  union all
  select
    '16_study_plan_mapping'::text,
    100::bigint + row_number() over (order by mapping_class),
    jsonb_build_object(
      'metric', 'mapping_class',
      'mapping_class', mapping_class,
      'count', count(*)::bigint
    )
  from study_mapping
  group by mapping_class
),
section_17 as (
  select
    '17_book_plan_mapping'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from (
    values
      (1, 'total', (select count(*)::bigint from book_mapping)),
      (2, 'without_linked_study_plan',
        (select count(*)::bigint from book_mapping
         where linked_study_plan_count = 0)),
      (3, 'linked_study_plan_rows',
        (select coalesce(sum(linked_study_plan_count), 0)::bigint
         from book_mapping)),
      (4, 'single_family_candidate',
        (select count(*)::bigint from book_mapping
         where family_candidate_count = 1)),
      (5, 'multiple_family_candidates',
        (select count(*)::bigint from book_mapping
         where family_candidate_count > 1)),
      (6, 'single_member_candidate',
        (select count(*)::bigint from book_mapping
         where member_candidate_count = 1)),
      (7, 'multiple_member_candidates',
        (select count(*)::bigint from book_mapping
         where member_candidate_count > 1)),
      (8, 'family_and_member_deterministic',
        (select count(*)::bigint from book_mapping
         where mapping_class = 'family_and_member_deterministic')),
      (9, 'ambiguous',
        (select count(*)::bigint from book_mapping
         where mapping_class = 'ambiguous')),
      (10, 'without_completion_member_evidence',
        (select count(*)::bigint from book_mapping
         where member_candidate_count = 0))
  ) metrics(item_order, metric, metric_count)
),
section_18 as (
  select
    '18_academy_mapping'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from (
    values
      (1, 'total_schedules', (select count(*)::bigint from academy_mapping)),
      (2, 'without_completion',
        (select count(*)::bigint from academy_mapping
         where completion_count = 0)),
      (3, 'with_completion',
        (select count(*)::bigint from academy_mapping
         where completion_count > 0)),
      (4, 'single_family_candidate',
        (select count(*)::bigint from academy_mapping
         where family_candidate_count = 1)),
      (5, 'multiple_family_candidates',
        (select count(*)::bigint from academy_mapping
         where family_candidate_count > 1)),
      (6, 'single_member_candidate',
        (select count(*)::bigint from academy_mapping
         where member_candidate_count = 1)),
      (7, 'multiple_member_candidates',
        (select count(*)::bigint from academy_mapping
         where member_candidate_count > 1)),
      (8, 'family_and_member_deterministic',
        (select count(*)::bigint from academy_mapping
         where mapping_class = 'family_and_member_deterministic')),
      (9, 'automatic_mapping_unavailable',
        (select count(*)::bigint from academy_mapping
         where mapping_class <> 'family_and_member_deterministic')),
      (10, 'completion_family_member_mismatch',
        (select family_member_mismatch_count from academy_integrity)),
      (11, 'orphan_schedule',
        (select orphan_schedule_count from academy_integrity)),
      (12, 'orphan_member',
        (select orphan_member_count from academy_integrity)),
      (13, 'orphan_family',
        (select orphan_family_count from academy_integrity))
  ) metrics(item_order, metric, metric_count)
),
section_19 as (
  select
    '19_sticker_integrity'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from sticker_history_integrity
  cross join transaction_integrity
  cross join sticker_history_duplicate_groups
  cross join sticker_history_ambiguous_groups
  cross join transaction_duplicate_groups
  cross join lateral (
    values
      (1, 'sticker_history_total', sticker_history_integrity.total_count),
      (2, 'sticker_history_null_family',
        sticker_history_integrity.null_family_count),
      (3, 'sticker_history_null_member',
        sticker_history_integrity.null_member_count),
      (4, 'sticker_history_null_study_plan',
        sticker_history_integrity.null_study_plan_count),
      (5, 'sticker_history_orphan_family',
        sticker_history_integrity.orphan_family_count),
      (6, 'sticker_history_orphan_member',
        sticker_history_integrity.orphan_member_count),
      (7, 'sticker_history_orphan_study_plan',
        sticker_history_integrity.orphan_study_plan_count),
      (8, 'sticker_history_family_member_mismatch',
        sticker_history_integrity.family_member_mismatch_count),
      (9, 'sticker_history_duplicate_study_plan_groups',
        sticker_history_duplicate_groups.duplicate_group_count),
      (10, 'sticker_history_ambiguous_owner_groups',
        sticker_history_ambiguous_groups.ambiguous_group_count),
      (11, 'sticker_transactions_total', transaction_integrity.total_count),
      (12, 'sticker_transactions_orphan_family',
        transaction_integrity.orphan_family_count),
      (13, 'sticker_transactions_orphan_member',
        transaction_integrity.orphan_member_count),
      (14, 'sticker_transactions_family_member_mismatch',
        transaction_integrity.family_member_mismatch_count),
      (15, 'sticker_transactions_non_child_member',
        transaction_integrity.non_child_transaction_count),
      (16, 'sticker_transactions_duplicate_source_groups',
        transaction_duplicate_groups.duplicate_group_count)
  ) metrics(item_order, metric, metric_count)
  union all
  select
    '19_sticker_integrity'::text,
    100::bigint + row_number() over (
      order by transaction_source_summary.source_type
    ),
    jsonb_build_object(
      'metric', 'transaction_source',
      'source_type', transaction_source_summary.source_type,
      'transaction_count', transaction_source_summary.transaction_count,
      'amount_sum', transaction_source_summary.amount_sum
    )
  from transaction_source_summary
  union all
  select
    '19_sticker_integrity'::text,
    200::bigint + row_number() over (
      order by
        member_wallet_summary.family_key,
        member_wallet_summary.member_key
    ),
    jsonb_build_object(
      'metric', 'member_balance',
      'family_key', member_wallet_summary.family_key,
      'member_key', member_wallet_summary.member_key,
      'role', member_wallet_summary.role,
      'balance', member_wallet_summary.balance
    )
  from member_wallet_summary
),
section_20 as (
  select
    '20_hangul_integrity'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from hangul_integrity
  cross join hangul_date_duplicate_groups
  cross join hangul_session_duplicate_groups
  cross join hangul_transaction_correspondence
  cross join lateral (
    values
      (1, 'completion_total', hangul_integrity.total_count),
      (2, 'orphan_family', hangul_integrity.orphan_family_count),
      (3, 'orphan_member', hangul_integrity.orphan_member_count),
      (4, 'family_member_mismatch',
        hangul_integrity.family_member_mismatch_count),
      (5, 'non_child_completion',
        hangul_integrity.non_child_completion_count),
      (6, 'duplicate_member_date_groups',
        hangul_date_duplicate_groups.duplicate_group_count),
      (7, 'duplicate_member_session_groups',
        hangul_session_duplicate_groups.duplicate_group_count),
      (8, 'target_count_not_20', hangul_integrity.invalid_target_count),
      (9, 'completed_below_target', hangul_integrity.incomplete_count),
      (10, 'sticker_count_not_2', hangul_integrity.invalid_sticker_count),
      (11, 'completion_without_transaction',
        hangul_transaction_correspondence.completions_without_transaction),
      (12, 'completion_with_multiple_transactions',
        hangul_transaction_correspondence.completions_with_multiple_transactions),
      (13, 'hangul_transaction_count',
        (select count(*)::bigint
         from public.sticker_transactions
         where source_type = 'hangul_daily_complete'))
  ) metrics(item_order, metric, metric_count)
),
section_21 as (
  select
    '21_reward_consistency'::text as section,
    metrics.item_order::bigint,
    jsonb_build_object(
      'metric', metrics.metric,
      'count', metrics.metric_count
    ) as result_data
  from reward_consistency
  cross join lateral (
    values
      (1, 'study_transactions_without_history',
        reward_consistency.study_transactions_without_history),
      (2, 'duplicate_study_transaction_groups',
        reward_consistency.duplicate_study_transaction_groups),
      (3, 'academy_transactions_without_completion',
        reward_consistency.academy_transactions_without_completion),
      (4, 'hangul_transactions_without_completion',
        reward_consistency.hangul_transactions_without_completion),
      (5, 'negative_amount_type_mismatch',
        reward_consistency.negative_amount_type_mismatch),
      (6, 'positive_amount_type_mismatch',
        reward_consistency.positive_amount_type_mismatch)
  ) metrics(item_order, metric, metric_count)
  union all
  select
    '21_reward_consistency'::text,
    100::bigint + row_number() over (
      order by transaction_source_summary.source_type
    ),
    jsonb_build_object(
      'metric', 'source_type_summary',
      'source_type', transaction_source_summary.source_type,
      'transaction_count', transaction_source_summary.transaction_count,
      'amount_sum', transaction_source_summary.amount_sum
    )
  from transaction_source_summary
),
section_22 as (
  select
    '22_backfill_decision'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'default_family_count', backfill_status.default_family_count,
      'default_family_exactly_one',
        (backfill_status.default_family_count = 1),
      'father_parent_count', coalesce(backfill_status.father_parent_count, 0),
      'mother_parent_count', coalesce(backfill_status.mother_parent_count, 0),
      'hagyeom_child_count', coalesce(backfill_status.hagyeom_child_count, 0),
      'dayul_child_count', coalesce(backfill_status.dayul_child_count, 0),
      'required_members_unique',
        (
          coalesce(backfill_status.father_parent_count, 0) = 1
          and coalesce(backfill_status.mother_parent_count, 0) = 1
          and coalesce(backfill_status.hagyeom_child_count, 0) = 1
          and coalesce(backfill_status.dayul_child_count, 0) = 1
        ),
      'all_study_plans_family_and_member_deterministic',
        (
          backfill_status.study_plan_families_requiring_decision = 0
          and backfill_status.study_plan_members_requiring_decision = 0
        ),
      'all_study_plan_families_deterministic',
        (backfill_status.study_plan_families_requiring_decision = 0),
      'all_study_plan_members_deterministic',
        (backfill_status.study_plan_members_requiring_decision = 0),
      'all_book_plan_families_deterministic',
        (backfill_status.book_plan_families_requiring_decision = 0),
      'all_book_plan_members_deterministic',
        (backfill_status.book_plan_members_requiring_decision = 0),
      'all_book_plans_family_and_member_deterministic',
        (
          backfill_status.book_plan_families_requiring_decision = 0
          and backfill_status.book_plan_members_requiring_decision = 0
        ),
      'all_academy_schedule_families_deterministic',
        (backfill_status.academy_schedule_families_requiring_decision = 0),
      'all_academy_schedule_members_deterministic',
        (backfill_status.academy_schedule_members_requiring_decision = 0),
      'all_academy_schedules_family_and_member_deterministic',
        (
          backfill_status.academy_schedule_families_requiring_decision = 0
          and backfill_status.academy_schedule_members_requiring_decision = 0
        ),
      'study_plan_families_requiring_user_decision',
        backfill_status.study_plan_families_requiring_decision,
      'study_plans_requiring_user_decision',
        backfill_status.study_plan_members_requiring_decision,
      'book_plan_families_requiring_user_decision',
        backfill_status.book_plan_families_requiring_decision,
      'book_plans_requiring_user_decision',
        backfill_status.book_plan_members_requiring_decision,
      'academy_schedule_families_requiring_user_decision',
        backfill_status.academy_schedule_families_requiring_decision,
      'academy_schedules_requiring_user_decision',
        backfill_status.academy_schedule_members_requiring_decision,
      'orphan_total', backfill_status.orphan_total,
      'family_member_mismatch_total',
        backfill_status.family_member_mismatch_total,
      'duplicate_or_ambiguous_total',
        backfill_status.duplicate_or_ambiguous_total,
      'source_orphan_total', backfill_status.source_orphan_total,
      'completion_transaction_issue_total',
        backfill_status.completion_transaction_issue_total,
      'transaction_type_mismatch_total',
        backfill_status.transaction_type_mismatch_total,
      'integrity_clean',
        (
          backfill_status.orphan_total = 0
          and backfill_status.family_member_mismatch_total = 0
          and backfill_status.duplicate_or_ambiguous_total = 0
          and backfill_status.source_orphan_total = 0
          and backfill_status.completion_transaction_issue_total = 0
          and backfill_status.transaction_type_mismatch_total = 0
        ),
      'requires_user_decision',
        (
          backfill_status.study_plan_members_requiring_decision > 0
          or backfill_status.book_plan_members_requiring_decision > 0
          or backfill_status.academy_schedule_members_requiring_decision > 0
        ),
      'migration_ready',
        (
          backfill_status.default_family_count = 1
          and coalesce(backfill_status.father_parent_count, 0) = 1
          and coalesce(backfill_status.mother_parent_count, 0) = 1
          and coalesce(backfill_status.hagyeom_child_count, 0) = 1
          and coalesce(backfill_status.dayul_child_count, 0) = 1
          and backfill_status.study_plan_families_requiring_decision = 0
          and backfill_status.study_plan_members_requiring_decision = 0
          and backfill_status.book_plan_families_requiring_decision = 0
          and backfill_status.book_plan_members_requiring_decision = 0
          and backfill_status.academy_schedule_families_requiring_decision = 0
          and backfill_status.academy_schedule_members_requiring_decision = 0
          and backfill_status.orphan_total = 0
          and backfill_status.family_member_mismatch_total = 0
          and backfill_status.duplicate_or_ambiguous_total = 0
          and backfill_status.source_orphan_total = 0
          and backfill_status.completion_transaction_issue_total = 0
          and backfill_status.transaction_type_mismatch_total = 0
        )
    ) as result_data
  from backfill_status
),
unified_results as (
  select section, item_order, result_data from section_12
  union all
  select section, item_order, result_data from section_13
  union all
  select section, item_order, result_data from section_14
  union all
  select section, item_order, result_data from section_15
  union all
  select section, item_order, result_data from section_16
  union all
  select section, item_order, result_data from section_17
  union all
  select section, item_order, result_data from section_18
  union all
  select section, item_order, result_data from section_19
  union all
  select section, item_order, result_data from section_20
  union all
  select section, item_order, result_data from section_21
  union all
  select section, item_order, result_data from section_22
)
select
  section,
  item_order,
  result_data
from unified_results
order by section, item_order;

rollback;
