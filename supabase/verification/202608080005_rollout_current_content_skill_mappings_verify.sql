begin transaction read only;

with authored(difficulty, question_order, skill_code) as (
  values
    ('seed', 1, 'read-three-digit-number'),
    ('seed', 2, 'read-three-digit-number'),
    ('seed', 3, 'write-three-digit-number'),
    ('seed', 4, 'write-three-digit-number'),
    ('seed', 5, 'represent-hundreds-tens-ones'),
    ('seed', 6, 'represent-hundreds-tens-ones'),
    ('seed', 7, 'represent-hundreds-tens-ones'),
    ('seed', 8, 'identify-place-value'),
    ('seed', 9, 'identify-place-value'),
    ('seed', 10, 'identify-place-value'),
    ('leaf', 1, 'compose-three-digit-number'),
    ('leaf', 2, 'compose-three-digit-number'),
    ('leaf', 3, 'compose-three-digit-number'),
    ('leaf', 4, 'decompose-three-digit-number'),
    ('leaf', 5, 'decompose-three-digit-number'),
    ('leaf', 6, 'decompose-three-digit-number'),
    ('leaf', 7, 'value-of-digit'),
    ('leaf', 8, 'value-of-digit'),
    ('leaf', 9, 'understand-zero-placeholder'),
    ('leaf', 10, 'understand-zero-placeholder'),
    ('tree', 1, 'compare-three-digit-numbers'),
    ('tree', 2, 'compare-three-digit-numbers'),
    ('tree', 3, 'compare-three-digit-numbers'),
    ('tree', 4, 'order-three-digit-numbers'),
    ('tree', 5, 'order-three-digit-numbers'),
    ('tree', 6, 'order-three-digit-numbers'),
    ('tree', 7, 'find-predecessor-successor'),
    ('tree', 8, 'find-predecessor-successor'),
    ('tree', 9, 'complete-number-sequence'),
    ('tree', 10, 'complete-number-sequence'),
    ('crown', 1, 'infer-number-from-place-conditions'),
    ('crown', 2, 'infer-number-from-digit-relations'),
    ('crown', 3, 'build-second-largest-number'),
    ('crown', 4, 'build-smallest-number-above-bound'),
    ('crown', 5, 'compare-after-swapping-digits'),
    ('crown', 6, 'infer-digit-after-swap-comparison'),
    ('crown', 7, 'exchange-ten-bundles-for-hundred'),
    ('crown', 8, 'recognize-equivalent-bundle-expression'),
    ('crown', 9, 'correct-zero-place-value-error'),
    ('crown', 10, 'correct-comparison-order-error')
), expected_mappings as (
  select question.id as question_id, 'make-ten.compose'::text as skill_code
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id in (
    '51000000-0000-4000-8000-000000000003'::uuid,
    '61000000-0000-4000-8000-000000000003'::uuid
  )
  union all
  select question.id, authored.skill_code
  from authored
  join public.learning_stages stage
    on stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
   and stage.difficulty = authored.difficulty
  join public.learning_questions question
    on question.stage_id = stage.id
   and question.display_order = authored.question_order
), rollout_skills as (
  select distinct skill_code from expected_mappings
), actual_mappings as (
  select mapping.question_id, mapping.skill_code, mapping.is_primary
  from public.learning_question_skills mapping
  join expected_mappings expected on expected.question_id = mapping.question_id
), checks(name, passed) as (
  values
    ('target content identity preserved',
      (select count(*) from public.learning_content_versions version
       where (version.id, version.content_hash, version.status) in (
         ('51000000-0000-4000-8000-000000000003'::uuid, '0b8af9c77d5dae197fb77619025ba21958de7f768d05e1ec06be986ba1f73bbc', 'published'),
         ('61000000-0000-4000-8000-000000000003'::uuid, '2deee8d9fe17db4e8d04870de6520c946ce029641f98abe3ce48a4bde172557d', 'published'),
         ('376377cb-4093-4f29-bc92-5ca42b27a726'::uuid, '7d079fa600b1c7e3b25a7eb08ff117fc5c174602fc3c04082637ca845f671a3b', 'published')
       )) = 3),
    ('reviewed skill definitions published',
      (select count(*) from rollout_skills) = 23
      and not exists (
        select 1 from rollout_skills expected
        left join public.learning_skill_definitions actual using (skill_code)
        where actual.skill_code is null or actual.subject_code <> 'math'
      )),
    ('question mappings exactly match rollout',
      (select count(*) from expected_mappings) = 100
      and not exists ((select question_id, skill_code from expected_mappings)
                      except
                      (select question_id, skill_code from actual_mappings))
      and not exists ((select question_id, skill_code from actual_mappings)
                      except
                      (select question_id, skill_code from expected_mappings))),
    ('every target question has one primary skill',
      (select count(*) from actual_mappings where is_primary) = 100
      and not exists (
        select question_id from actual_mappings
        group by question_id having count(*) <> 1 or count(*) filter (where is_primary) <> 1
      )),
    ('no orphan rollout definition',
      not exists (
        select 1 from rollout_skills skill
        where not exists (select 1 from actual_mappings mapping where mapping.skill_code = skill.skill_code)
      )),
    ('no orphan or invalid mapping',
      not exists (
        select 1 from actual_mappings mapping
        left join public.learning_questions question on question.id = mapping.question_id
        left join public.learning_skill_definitions definition on definition.skill_code = mapping.skill_code
        where question.id is null or definition.skill_code is null
          or mapping.skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      )),
    ('primary uniqueness enforced',
      exists (
        select 1 from pg_catalog.pg_indexes
        where schemaname = 'public' and tablename = 'learning_question_skills'
          and indexname = 'learning_question_skills_one_primary_uidx'
      )),
    ('published mappings remain protected',
      exists (
        select 1 from pg_catalog.pg_trigger
        where tgrelid = 'public.learning_question_skills'::regclass
          and not tgisinternal and tgname = 'learning_question_skills_guard_change'
      )),
    ('skill metadata acl remains read only',
      not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
      and has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
      and has_table_privilege('service_role','public.learning_question_skills','SELECT')
      and not has_table_privilege('service_role','public.learning_question_skills','INSERT,UPDATE,DELETE')),
    ('skill metadata remains outside realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables
        where schemaname = 'public'
          and tablename in ('learning_skill_definitions','learning_question_skills')
      ))
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    ((select count(*) from public.learning_skill_definitions where subject_code = 'math') >= 23),
    ((select count(*) from public.learning_question_skills where is_primary) >= 100),
    ((select count(*) from public.learning_question_skills mapping
      join public.learning_questions question on question.id = mapping.question_id
      join public.learning_stages stage on stage.id = question.stage_id
      where stage.content_version_id in (
        '51000000-0000-4000-8000-000000000003'::uuid,
        '61000000-0000-4000-8000-000000000003'::uuid,
        '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
      )) = 100),
    (not exists (select 1 from public.learning_question_skills where not is_primary)),
    (not exists (
      select question_id from public.learning_question_skills
      group by question_id having count(*) filter (where is_primary) > 1
    )),
    (exists (select 1 from pg_catalog.pg_trigger where not tgisinternal and tgname = 'learning_question_skills_guard_change')),
    (has_table_privilege('service_role','public.learning_question_skills','SELECT')),
    (not exists (
      select 1 from pg_catalog.pg_publication_tables
      where schemaname = 'public' and tablename in ('learning_skill_definitions','learning_question_skills')
    ))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
