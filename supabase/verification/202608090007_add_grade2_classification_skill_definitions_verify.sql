begin transaction read only;

with expected(skill_code, subject_code, display_name, description) as (
  values
    ('identify-classification-rule', 'math', '분류 기준 찾기', '함께 묶인 것들의 공통된 특징을 살펴 분류 기준을 찾습니다.'),
    ('classify-by-given-rule', 'math', '주어진 기준으로 분류하기', '주어진 한 가지 기준에 맞는 항목을 빠짐없이 골라 분류합니다.'),
    ('compare-classification-rules', 'math', '분류 기준 비교하기', '같은 대상을 나눈 여러 기준을 비교하여 목적에 알맞은 기준을 고릅니다.'),
    ('infer-rule-from-groups', 'math', '분류 결과에서 기준 추론하기', '나누어진 모둠의 항목을 살펴 사용한 분류 기준을 거꾸로 알아냅니다.'),
    ('find-misclassified-item', 'math', '잘못 분류된 항목 찾기', '분류 기준에 맞지 않는 항목을 찾아 알맞은 모둠을 판단합니다.'),
    ('find-missing-classified-item', 'math', '빠진 분류 항목 찾기', '전체와 분류 결과를 비교하여 빠진 항목이나 모둠을 찾습니다.'),
    ('classify-by-two-properties', 'math', '두 가지 특징으로 분류하기', '두 가지 특징을 모두 만족하는 항목을 찾아 정확하게 분류합니다.'),
    ('explain-classification-reasoning', 'math', '분류 이유 설명하기', '분류 기준과 각 항목의 특징을 연결하여 분류가 알맞은 이유를 설명합니다.')
), checks(check_order, check_name, passed) as (
  values
    (1, 'grade2 classification definitions exact',
      (select count(*) from expected) = 8
      and not exists (
        select 1 from expected
        left join public.learning_skill_definitions actual using (skill_code)
        where actual.skill_code is null
          or actual.subject_code <> expected.subject_code
          or actual.display_name <> expected.display_name
          or actual.description is distinct from expected.description
          or actual.curriculum_code is not null
      )),
    (2, 'grade2 classification skill codes valid',
      not exists (select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
    (3, 'skill definitions remain force rls',
      (select relrowsecurity and relforcerowsecurity
       from pg_catalog.pg_class where oid = 'public.learning_skill_definitions'::regclass)),
    (4, 'browser roles remain blocked',
      not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
    (5, 'service role remains read only',
      has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
      and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
    (6, 'skill definitions remain outside realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables
        where schemaname = 'public' and tablename = 'learning_skill_definitions'
      ))
)
select check_order, check_name, passed,
  jsonb_build_object('summary', false) as result_data
from checks
union all
select 999, 'grade2 classification skill verification summary', bool_and(passed),
  jsonb_build_object(
    'summary', true,
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
