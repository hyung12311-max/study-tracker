begin transaction read only;

-- SECTION 3: inspect duplicate sticker_history groups without exposing UUIDs or
-- study details. The assessment is evidence for a later decision and does not
-- identify a row to delete and does not modify data.
with
duplicate_plan_ids as (
  select
    sticker_history.study_plan_id
  from public.sticker_history
  group by sticker_history.study_plan_id
  having count(*) > 1
),
duplicate_history_rows as (
  select
    sticker_history.study_plan_id,
    sticker_history.id as sticker_history_id,
    sticker_history.family_id,
    sticker_history.member_id,
    families.family_key,
    family_members.member_key,
    family_members.role,
    sticker_history.sticker_count,
    sticker_history.reward_type,
    sticker_history.reward_reason,
    sticker_history.created_at,
    row_number() over (
      partition by sticker_history.study_plan_id
      order by sticker_history.created_at, sticker_history.id
    )::bigint as group_row_number,
    (families.id is null) as family_reference_missing,
    (family_members.id is null) as member_reference_missing,
    (
      family_members.id is not null
      and family_members.family_id <> sticker_history.family_id
    ) as family_member_mismatch
  from duplicate_plan_ids
  join public.sticker_history
    on sticker_history.study_plan_id = duplicate_plan_ids.study_plan_id
  left join public.families
    on families.id = sticker_history.family_id
  left join public.family_members
    on family_members.id = sticker_history.member_id
),
history_group_stats as (
  select
    duplicate_history_rows.study_plan_id,
    count(*)::bigint as history_count,
    count(distinct duplicate_history_rows.family_id) filter (
      where duplicate_history_rows.family_id is not null
    )::bigint as distinct_family_count,
    count(distinct duplicate_history_rows.member_id) filter (
      where duplicate_history_rows.member_id is not null
    )::bigint as distinct_member_count,
    count(distinct duplicate_history_rows.sticker_count)::bigint
      as distinct_sticker_count,
    count(distinct coalesce(
      duplicate_history_rows.reward_type,
      '<NULL>'
    ))::bigint as distinct_reward_type_count,
    count(distinct coalesce(
      duplicate_history_rows.reward_reason,
      '<NULL>'
    ))::bigint as distinct_reward_reason_count,
    min(duplicate_history_rows.created_at) as history_created_at_min,
    max(duplicate_history_rows.created_at) as history_created_at_max,
    round(
      extract(epoch from (
        max(duplicate_history_rows.created_at)
        - min(duplicate_history_rows.created_at)
      ))::numeric,
      3
    ) as history_created_gap_seconds,
    round(
      (
        extract(epoch from (
          max(duplicate_history_rows.created_at)
          - min(duplicate_history_rows.created_at)
        )) * 1000
      )::numeric
    )::bigint as history_created_gap_milliseconds,
    coalesce(sum(duplicate_history_rows.sticker_count), 0)::bigint
      as history_sticker_count_sum,
    min(duplicate_history_rows.sticker_count)::bigint
      as history_sticker_count_min,
    max(duplicate_history_rows.sticker_count)::bigint
      as history_sticker_count_max,
    count(*) filter (
      where duplicate_history_rows.family_id is null
         or duplicate_history_rows.member_id is null
         or duplicate_history_rows.family_reference_missing
         or duplicate_history_rows.member_reference_missing
         or duplicate_history_rows.family_member_mismatch
    )::bigint as owner_reference_issue_count,
    (array_agg(
      duplicate_history_rows.family_id
      order by duplicate_history_rows.group_row_number
    ) filter (
      where duplicate_history_rows.family_id is not null
    ))[1] as sole_history_family_id,
    (array_agg(
      duplicate_history_rows.member_id
      order by duplicate_history_rows.group_row_number
    ) filter (
      where duplicate_history_rows.member_id is not null
    ))[1] as sole_history_member_id
  from duplicate_history_rows
  group by duplicate_history_rows.study_plan_id
),
corresponding_transaction_rows as (
  select
    duplicate_plan_ids.study_plan_id,
    sticker_transactions.family_id,
    sticker_transactions.member_id,
    families.family_key,
    family_members.member_key,
    family_members.role,
    sticker_transactions.amount,
    sticker_transactions.transaction_type,
    sticker_transactions.source_type,
    sticker_transactions.created_at,
    (families.id is null) as family_reference_missing,
    (family_members.id is null) as member_reference_missing,
    (
      family_members.id is not null
      and family_members.family_id <> sticker_transactions.family_id
    ) as family_member_mismatch
  from duplicate_plan_ids
  join public.sticker_transactions
    on sticker_transactions.source_type = 'study_complete'
   and sticker_transactions.source_id = duplicate_plan_ids.study_plan_id::text
  left join public.families
    on families.id = sticker_transactions.family_id
  left join public.family_members
    on family_members.id = sticker_transactions.member_id
),
transaction_group_stats as (
  select
    duplicate_plan_ids.study_plan_id,
    count(corresponding_transaction_rows.study_plan_id)::bigint
      as transaction_count,
    coalesce(sum(corresponding_transaction_rows.amount), 0)::bigint
      as transaction_amount_sum,
    count(distinct corresponding_transaction_rows.family_id) filter (
      where corresponding_transaction_rows.family_id is not null
    )::bigint as distinct_transaction_family_count,
    count(distinct corresponding_transaction_rows.member_id) filter (
      where corresponding_transaction_rows.member_id is not null
    )::bigint as distinct_transaction_member_count,
    count(distinct corresponding_transaction_rows.transaction_type) filter (
      where corresponding_transaction_rows.transaction_type is not null
    )::bigint as distinct_transaction_type_count,
    min(corresponding_transaction_rows.transaction_type)
      as transaction_type,
    case
      when count(corresponding_transaction_rows.study_plan_id) > 0
        then 'study_complete'::text
      else null::text
    end as source_type,
    min(corresponding_transaction_rows.created_at)
      as transaction_created_at_min,
    max(corresponding_transaction_rows.created_at)
      as transaction_created_at_max,
    min(corresponding_transaction_rows.family_key) as family_key,
    min(corresponding_transaction_rows.member_key) as member_key,
    min(corresponding_transaction_rows.role) as role,
    count(*) filter (
      where corresponding_transaction_rows.study_plan_id is not null
        and (
          corresponding_transaction_rows.family_id is null
          or corresponding_transaction_rows.member_id is null
          or corresponding_transaction_rows.family_reference_missing
          or corresponding_transaction_rows.member_reference_missing
          or corresponding_transaction_rows.family_member_mismatch
        )
    )::bigint as owner_reference_issue_count,
    (array_agg(
      corresponding_transaction_rows.family_id
      order by corresponding_transaction_rows.created_at
    ) filter (
      where corresponding_transaction_rows.family_id is not null
    ))[1] as sole_transaction_family_id,
    (array_agg(
      corresponding_transaction_rows.member_id
      order by corresponding_transaction_rows.created_at
    ) filter (
      where corresponding_transaction_rows.member_id is not null
    ))[1] as sole_transaction_member_id
  from duplicate_plan_ids
  left join corresponding_transaction_rows
    on corresponding_transaction_rows.study_plan_id
      = duplicate_plan_ids.study_plan_id
  group by duplicate_plan_ids.study_plan_id
),
duplicate_evidence as (
  select
    history_group_stats.*,
    transaction_group_stats.transaction_count,
    transaction_group_stats.transaction_amount_sum,
    transaction_group_stats.distinct_transaction_family_count,
    transaction_group_stats.distinct_transaction_member_count,
    transaction_group_stats.distinct_transaction_type_count,
    transaction_group_stats.transaction_type,
    transaction_group_stats.source_type,
    transaction_group_stats.transaction_created_at_min,
    transaction_group_stats.transaction_created_at_max,
    transaction_group_stats.family_key as transaction_family_key,
    transaction_group_stats.member_key as transaction_member_key,
    transaction_group_stats.role as transaction_role,
    transaction_group_stats.owner_reference_issue_count
      as transaction_owner_reference_issue_count,
    study_plans.status as study_plan_status,
    (study_plans.completed_date is not null) as completed_date_exists,
    (
      history_group_stats.owner_reference_issue_count = 0
      and history_group_stats.distinct_family_count = 1
      and history_group_stats.distinct_member_count = 1
    ) as same_owner,
    (
      history_group_stats.distinct_sticker_count = 1
      and history_group_stats.distinct_reward_type_count = 1
      and history_group_stats.distinct_reward_reason_count = 1
    ) as same_reward,
    (transaction_group_stats.transaction_count = 1)
      as exactly_one_transaction,
    exists (
      select 1
      from duplicate_history_rows
      where duplicate_history_rows.study_plan_id
        = history_group_stats.study_plan_id
        and duplicate_history_rows.sticker_count
          = transaction_group_stats.transaction_amount_sum
    ) as ledger_amount_matches_any_history_value,
    (
      transaction_group_stats.transaction_amount_sum
        = history_group_stats.history_sticker_count_sum
    ) as ledger_amount_matches_history_sum,
    (
      transaction_group_stats.transaction_count = 1
      and transaction_group_stats.owner_reference_issue_count = 0
      and transaction_group_stats.distinct_transaction_family_count = 1
      and transaction_group_stats.distinct_transaction_member_count = 1
      and transaction_group_stats.sole_transaction_family_id
        = history_group_stats.sole_history_family_id
      and transaction_group_stats.sole_transaction_member_id
        = history_group_stats.sole_history_member_id
    ) as transaction_owner_matches_history
  from history_group_stats
  join transaction_group_stats
    on transaction_group_stats.study_plan_id
      = history_group_stats.study_plan_id
  left join public.study_plans
    on study_plans.id = history_group_stats.study_plan_id
),
assessment_classified as (
  select
    duplicate_evidence.*,
    case
      when duplicate_evidence.transaction_count = 0
        then 'transaction_missing'
      when duplicate_evidence.transaction_count > 1
        then 'multiple_transactions'
      when not duplicate_evidence.same_owner
        or (
          duplicate_evidence.transaction_count = 1
          and not duplicate_evidence.transaction_owner_matches_history
        )
        then 'multiple_owner_conflict'
      when not duplicate_evidence.same_reward
        then 'same_owner_different_reward_history'
      when duplicate_evidence.exactly_one_transaction
        and duplicate_evidence.ledger_amount_matches_any_history_value
        and not duplicate_evidence.ledger_amount_matches_history_sum
        then 'same_owner_same_reward_duplicate_history'
      else 'manual_review_required'
    end as assessment,
    case
      when duplicate_evidence.history_created_gap_milliseconds = 0
        then 'same_timestamp'
      when duplicate_evidence.history_created_gap_seconds <= 5
        then 'within_5_seconds'
      when duplicate_evidence.history_created_gap_seconds <= 60
        then 'within_60_seconds'
      when duplicate_evidence.history_created_gap_seconds < 86400
        then 'same_day'
      else 'different_days'
    end as timing_bucket
  from duplicate_evidence
),
assessment_final as (
  select
    assessment_classified.*,
    (
      assessment_classified.assessment
        = 'same_owner_same_reward_duplicate_history'
      and assessment_classified.completed_date_exists
      and assessment_classified.transaction_owner_matches_history
      and assessment_classified.distinct_transaction_type_count = 1
      and assessment_classified.transaction_type = 'earn'
    ) as automatic_cleanup_candidate
  from assessment_classified
),
section_23 as (
  select
    '23_duplicate_group_summary'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'result_kind', 'overview',
      'duplicate_group_count', count(*)::bigint,
      'unique_constraint_safe_now', (count(*) = 0),
      'note', case
        when count(*) = 0
          then 'No duplicate sticker_history study_plan groups found.'
        else 'Duplicate groups require assessment before a unique constraint.'
      end
    ) as result_data
  from assessment_final

  union all

  select
    '23_duplicate_group_summary'::text,
    (
      100 + row_number() over (
        order by assessment_final.study_plan_id
      )
    )::bigint,
    jsonb_build_object(
      'result_kind', 'duplicate_group',
      'study_plan_id', assessment_final.study_plan_id,
      'history_count', assessment_final.history_count,
      'distinct_family_count', assessment_final.distinct_family_count,
      'distinct_member_count', assessment_final.distinct_member_count,
      'distinct_sticker_count', assessment_final.distinct_sticker_count,
      'distinct_reward_type_count',
        assessment_final.distinct_reward_type_count,
      'distinct_reward_reason_count',
        assessment_final.distinct_reward_reason_count,
      'history_created_at_min', assessment_final.history_created_at_min,
      'history_created_at_max', assessment_final.history_created_at_max,
      'history_created_gap_seconds',
        assessment_final.history_created_gap_seconds,
      'history_created_gap_milliseconds',
        assessment_final.history_created_gap_milliseconds,
      'timing_bucket', assessment_final.timing_bucket,
      'origin_inference', case
        when assessment_final.history_created_gap_seconds <= 5
          then 'same_request_or_immediate_retry_possible'
        when assessment_final.history_created_gap_seconds <= 60
          then 'short_retry_possible'
        when assessment_final.history_created_gap_seconds >= 86400
          then 'legacy_or_manual_history_possible'
        else 'timing_inconclusive'
      end,
      'study_complete_transaction_count',
        assessment_final.transaction_count,
      'ledger_amount_sum', assessment_final.transaction_amount_sum,
      'history_sticker_count_sum',
        assessment_final.history_sticker_count_sum,
      'history_sticker_count_min',
        assessment_final.history_sticker_count_min,
      'history_sticker_count_max',
        assessment_final.history_sticker_count_max,
      'study_plan_status', assessment_final.study_plan_status,
      'completed_date_exists', assessment_final.completed_date_exists
    )
  from assessment_final
),
section_24 as (
  select
    '24_duplicate_history_rows'::text as section,
    row_number() over (
      order by
        duplicate_history_rows.study_plan_id,
        duplicate_history_rows.group_row_number
    )::bigint as item_order,
    jsonb_build_object(
      'study_plan_id', duplicate_history_rows.study_plan_id,
      'sticker_history_id', duplicate_history_rows.sticker_history_id,
      'family_key', duplicate_history_rows.family_key,
      'member_key', duplicate_history_rows.member_key,
      'role', duplicate_history_rows.role,
      'sticker_count', duplicate_history_rows.sticker_count,
      'reward_type', duplicate_history_rows.reward_type,
      'reward_reason', duplicate_history_rows.reward_reason,
      'created_at', duplicate_history_rows.created_at,
      'group_row_number', duplicate_history_rows.group_row_number
    ) as result_data
  from duplicate_history_rows
),
section_25 as (
  select
    '25_corresponding_transaction'::text as section,
    row_number() over (
      order by assessment_final.study_plan_id
    )::bigint as item_order,
    jsonb_build_object(
      'study_plan_id', assessment_final.study_plan_id,
      'family_key', case
        when assessment_final.distinct_transaction_family_count = 1
          then assessment_final.transaction_family_key
        else null
      end,
      'member_key', case
        when assessment_final.distinct_transaction_member_count = 1
          then assessment_final.transaction_member_key
        else null
      end,
      'role', case
        when assessment_final.distinct_transaction_member_count = 1
          then assessment_final.transaction_role
        else null
      end,
      'transaction_count', assessment_final.transaction_count,
      'amount_sum', assessment_final.transaction_amount_sum,
      'transaction_type', case
        when assessment_final.distinct_transaction_type_count = 1
          then assessment_final.transaction_type
        else null
      end,
      'source_type', assessment_final.source_type,
      'created_at_min', assessment_final.transaction_created_at_min,
      'created_at_max', assessment_final.transaction_created_at_max,
      'history_count', assessment_final.history_count,
      'history_sticker_count_sum',
        assessment_final.history_sticker_count_sum
    ) as result_data
  from assessment_final
),
section_26 as (
  select
    '26_duplicate_assessment'::text as section,
    row_number() over (
      order by assessment_final.study_plan_id
    )::bigint as item_order,
    jsonb_build_object(
      'result_kind', 'assessment',
      'study_plan_id', assessment_final.study_plan_id,
      'assessment', assessment_final.assessment,
      'same_owner', assessment_final.same_owner,
      'same_reward', assessment_final.same_reward,
      'exactly_one_transaction',
        assessment_final.exactly_one_transaction,
      'transaction_owner_matches_history',
        assessment_final.transaction_owner_matches_history,
      'ledger_amount_matches_any_history_value',
        assessment_final.ledger_amount_matches_any_history_value,
      'ledger_amount_matches_history_sum',
        assessment_final.ledger_amount_matches_history_sum,
      'unique_constraint_safe_now', false,
      'history_row_cleanup_required_before_unique', true,
      'history_rows_to_remove_for_unique',
        assessment_final.history_count - 1,
      'exactly_one_history_row_cleanup_required',
        assessment_final.history_count = 2,
      'automatic_cleanup_candidate',
        assessment_final.automatic_cleanup_candidate,
      'manual_review_required',
        not assessment_final.automatic_cleanup_candidate,
      'timing_bucket', assessment_final.timing_bucket,
      'origin_inference', case
        when assessment_final.history_created_gap_seconds <= 5
          then 'same_request_or_immediate_retry_possible'
        when assessment_final.history_created_gap_seconds <= 60
          then 'short_retry_possible'
        when assessment_final.history_created_gap_seconds >= 86400
          then 'legacy_or_manual_history_possible'
        else 'timing_inconclusive'
      end,
      'timing_is_decision_evidence_only', true
    ) as result_data
  from assessment_final

  union all

  select
    '26_duplicate_assessment'::text,
    1::bigint,
    jsonb_build_object(
      'result_kind', 'no_duplicate_groups',
      'assessment', 'no_duplicate_groups',
      'unique_constraint_safe_now', true,
      'history_row_cleanup_required_before_unique', false,
      'history_rows_to_remove_for_unique', 0,
      'exactly_one_history_row_cleanup_required', false,
      'automatic_cleanup_candidate', false,
      'manual_review_required', false,
      'note', 'No duplicate group requires assessment.'
    )
  where not exists (
    select 1
    from assessment_final
  )
),
combined_results as (
  select section, item_order, result_data from section_23
  union all
  select section, item_order, result_data from section_24
  union all
  select section, item_order, result_data from section_25
  union all
  select section, item_order, result_data from section_26
)
select
  combined_results.section,
  combined_results.item_order,
  combined_results.result_data
from combined_results
order by
  combined_results.section,
  combined_results.item_order;

rollback;
