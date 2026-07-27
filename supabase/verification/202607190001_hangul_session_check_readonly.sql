begin transaction read only;

-- Narrow read-only diagnosis for hangul_daily_completions_session_check.
-- No session value, row identifier, or personal data is returned.

with
constants as (
  select
    'CHECK (char_length(session_id) BETWEEN 16 AND 160 AND session_id ~ ''^[A-Za-z0-9._:+-]+$'')'::text
      as local_migration_definition,
    array['session_id', 'char_length', 'between16and160', '~']::text[]
      as verifier_required_patterns
),
target_constraint as (
  select
    con.oid,
    con.contype::text as constraint_type,
    con.convalidated,
    pg_catalog.pg_get_constraintdef(con.oid) as actual_definition
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class rel on rel.oid = con.conrelid
  join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'hangul_daily_completions'
    and con.conname = 'hangul_daily_completions_session_check'
),
constraint_state as (
  select
    count(tc.oid)::bigint as constraint_count,
    min(tc.constraint_type) as constraint_type,
    coalesce(bool_and(tc.convalidated), false) as validated,
    min(tc.actual_definition) as actual_definition
  from target_constraint tc
),
normalized as (
  select
    cs.*,
    c.local_migration_definition,
    c.verifier_required_patterns,
    lower(regexp_replace(cs.actual_definition, '\s+', '', 'g'))
      as actual_whitespace_normalized,
    lower(regexp_replace(c.local_migration_definition, '\s+', '', 'g'))
      as local_whitespace_normalized
  from constraint_state cs
  cross join constants c
),
structural_analysis as (
  select
    n.*,
    position('session_id' in n.actual_whitespace_normalized) > 0
      as has_session_id,
    position('char_length' in n.actual_whitespace_normalized) > 0
      as has_char_length,
    (
      position('length(session_id)' in n.actual_whitespace_normalized) > 0
      and position('char_length(session_id)' in n.actual_whitespace_normalized) = 0
    )
      as has_length_alias,
    position('between16and160' in n.actual_whitespace_normalized) > 0
      as has_between_form,
    (
      (
        position('char_length(session_id)>=16' in n.actual_whitespace_normalized) > 0
        and position('char_length(session_id)<=160' in n.actual_whitespace_normalized) > 0
      )
      or (
        position('length(session_id)>=16' in n.actual_whitespace_normalized) > 0
        and position('length(session_id)<=160' in n.actual_whitespace_normalized) > 0
      )
    ) as has_canonical_boundary_form,
    position(
      'session_id~''^[a-za-z0-9._:+-]+$'''
      in n.actual_whitespace_normalized
    ) > 0 as has_exact_regex,
    position('~' in n.actual_whitespace_normalized) > 0 as has_regex_operator,
    (
      length(n.actual_whitespace_normalized)
      - length(replace(n.actual_whitespace_normalized, 'and', ''))
    ) / 3 as and_operator_count,
    position('or' in n.actual_whitespace_normalized) > 0 as has_or_operator,
    position('not' in n.actual_whitespace_normalized) > 0 as has_not_operator
  from normalized n
),
comparison as (
  select
    sa.*,
    (
      sa.constraint_count = 1
      and sa.constraint_type = 'c'
      and sa.validated
      and sa.has_session_id
      and (sa.has_char_length or sa.has_length_alias)
      and (sa.has_between_form or sa.has_canonical_boundary_form)
      and sa.has_exact_regex
      and sa.has_regex_operator
      and not sa.has_or_operator
      and not sa.has_not_operator
      and (
        (sa.has_between_form and sa.and_operator_count = 1)
        or (sa.has_canonical_boundary_form and sa.and_operator_count = 2)
      )
    ) as recognized_same_semantic_contract,
    (
      sa.actual_whitespace_normalized = sa.local_whitespace_normalized
    ) as whitespace_normalized_source_identical,
    (
      sa.has_session_id
      and sa.has_char_length
      and sa.has_between_form
      and sa.has_regex_operator
    ) as current_verifier_would_match
  from structural_analysis sa
),
data_counts as (
  select
    count(*)::bigint as total_rows,
    count(*) filter (where hdc.session_id is null)::bigint as null_session_rows,
    count(*) filter (
      where hdc.session_id is not null
        and (
          char_length(hdc.session_id) not between 16 and 160
         or hdc.session_id !~ '^[A-Za-z0-9._:+-]+$'
        )
    )::bigint as local_migration_violation_rows
  from public.hangul_daily_completions hdc
),
result_rows as (
  select
    '35_session_constraint_definition'::text as section,
    1::bigint as item_order,
    jsonb_build_object(
      'check_name', 'constraint_presence_type_and_validation',
      'constraint_exists', cmp.constraint_count = 1,
      'constraint_count', cmp.constraint_count,
      'constraint_type', cmp.constraint_type,
      'validated', cmp.validated
    ) as result_data
  from comparison cmp

  union all

  select
    '35_session_constraint_definition'::text,
    2::bigint,
    jsonb_build_object(
      'check_name', 'definition_source_and_normalization',
      'actual_pg_get_constraintdef', cmp.actual_definition,
      'actual_whitespace_normalized', cmp.actual_whitespace_normalized,
      'local_migration_expected_definition', cmp.local_migration_definition,
      'local_migration_whitespace_normalized', cmp.local_whitespace_normalized,
      'verifier_required_patterns', to_jsonb(cmp.verifier_required_patterns)
    )
  from comparison cmp

  union all

  select
    '35_session_constraint_definition'::text,
    3::bigint,
    jsonb_build_object(
      'check_name', 'current_verifier_pattern_diagnosis',
      'pattern_session_id_matches', cmp.has_session_id,
      'pattern_char_length_matches', cmp.has_char_length,
      'pattern_between_16_and_160_matches', cmp.has_between_form,
      'pattern_regex_operator_matches', cmp.has_regex_operator,
      'canonical_greater_equal_and_less_equal_found', cmp.has_canonical_boundary_form,
      'current_verifier_would_match', cmp.current_verifier_would_match,
      'specific_false_reason', case
        when cmp.constraint_count <> 1 then 'constraint_missing_or_duplicated'
        when not cmp.has_session_id then 'session_id_token_missing'
        when not cmp.has_char_length then
          case
            when cmp.has_length_alias then 'length_alias_used_instead_of_char_length'
            else 'char_length_token_missing'
          end
        when not cmp.has_between_form and cmp.has_canonical_boundary_form
          then 'postgresql_canonicalized_between_to_greater_equal_and_less_equal'
        when not cmp.has_between_form then 'between_boundary_pattern_missing'
        when not cmp.has_regex_operator then 'regex_operator_missing'
        else 'all_current_verifier_patterns_match'
      end
    )
  from comparison cmp

  union all

  select
    '36_session_data_integrity'::text,
    1::bigint,
    jsonb_build_object(
      'check_name', 'nonidentifying_session_counts',
      'total_rows', dc.total_rows,
      'session_id_null_rows', dc.null_session_rows,
      'local_migration_condition_violation_rows', dc.local_migration_violation_rows,
      'actual_production_constraint_condition_violation_rows', case
        when cmp.recognized_same_semantic_contract
          then dc.local_migration_violation_rows
        else null
      end,
      'different_condition_outcome_rows', case
        when cmp.recognized_same_semantic_contract then 0::bigint
        else null
      end,
      'actual_count_limit', case
        when cmp.recognized_same_semantic_contract
          then 'actual definition structurally recognized; the equivalent predicate is counted'
        else 'unrecognized catalog expression; dynamic execution is prohibited, so actual count is null'
      end
    )
  from data_counts dc
  cross join comparison cmp

  union all

  select
    '37_semantic_comparison'::text,
    1::bigint,
    jsonb_build_object(
      'check_name', 'session_constraint_semantic_assessment',
      'source_text_identical_after_whitespace_only', cmp.whitespace_normalized_source_identical,
      'postgresql_canonicalization_only', (
        cmp.recognized_same_semantic_contract
        and not cmp.whitespace_normalized_source_identical
        and (
          cmp.has_canonical_boundary_form
          or cmp.has_length_alias
          or position('::text' in cmp.actual_whitespace_normalized) > 0
        )
      ),
      'current_data_equivalent', case
        when cmp.recognized_same_semantic_contract then true
        else null
      end,
      'all_possible_text_inputs_logically_equivalent', case
        when cmp.recognized_same_semantic_contract then true
        else null
      end,
      'semantic_difference_found', case
        when cmp.recognized_same_semantic_contract then false
        else null
      end,
      'verifier_false_positive', (
        cmp.recognized_same_semantic_contract
        and not cmp.current_verifier_would_match
      ),
      'keep_history_repair_blocked_until_review', true,
      'verifier_only_minimal_fix_candidate', (
        cmp.recognized_same_semantic_contract
        and not cmp.current_verifier_would_match
      ),
      'production_constraint_change_needed', case
        when cmp.recognized_same_semantic_contract then false
        else null
      end,
      'local_migration_change_needed', case
        when cmp.recognized_same_semantic_contract then false
        else null
      end,
      'null_semantics', 'CHECK alone accepts UNKNOWN, while the separate NOT NULL column contract rejects NULL',
      'empty_and_space_semantics', 'empty, whitespace-containing, and whitespace-only text are rejected by length and/or the exact regex',
      'length_boundaries', '16 and 160 characters are inclusive; below 16 and above 160 are rejected',
      'regex_contract', 'only ASCII letters, digits, dot, underscore, colon, plus, and hyphen are accepted',
      'proof_basis', case
        when cmp.recognized_same_semantic_contract then
          'static structural match of the same inclusive bounds, text character-length operation, exact regex, AND-only shape, and NOT NULL column contract'
        else
          'catalog expression was not one of the safely recognized equivalent shapes; no universal equivalence conclusion is made'
      end
    )
  from comparison cmp
)
select
  section,
  item_order,
  result_data
from result_rows
order by section, item_order;

rollback;
