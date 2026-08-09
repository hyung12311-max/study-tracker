begin transaction read only;

with expected(skill_code, subject_code, display_name, description) as (
  values
    ('identify-equal-groups', 'math', '같은 수씩 묶인 것 찾기', '각 묶음에 같은 수의 대상이 들어 있는지 살펴 곱셈으로 나타낼 수 있는 묶음을 찾습니다.'),
    ('count-equal-groups', 'math', '같은 수 묶음 세기', '한 묶음의 수와 묶음 수를 구분하여 같은 수씩 몇 묶음인지 셉니다.'),
    ('connect-repeated-addition-to-multiplication', 'math', '반복 덧셈과 곱셈 연결하기', '같은 수를 여러 번 더한 식을 한 묶음의 수와 묶음 수를 사용한 곱셈식으로 연결합니다.'),
    ('represent-equal-groups-as-multiplication', 'math', '같은 수 묶음을 곱셈식으로 나타내기', '한 묶음의 수 곱하기 묶음 수의 순서로 같은 수 묶음을 곱셈식으로 나타냅니다.'),
    ('interpret-multiplication-expression', 'math', '곱셈식의 뜻 해석하기', '곱셈식의 앞 수는 한 묶음의 수이고 뒤 수는 묶음 수임을 해석합니다.'),
    ('model-multiplication-situation', 'math', '생활 상황을 곱셈으로 나타내기', '생활 속 같은 수씩 묶인 상황을 찾아 알맞은 곱셈식이나 문장으로 나타냅니다.'),
    ('infer-missing-group-value', 'math', '묶음의 빠진 값 찾기', '전체 수와 한 묶음의 수 또는 묶음 수를 이용하여 빠진 묶음 값을 찾습니다.'),
    ('correct-multiplication-reasoning', 'math', '곱셈 의미의 오류 바로잡기', '묶음 조건과 반복 덧셈을 비교하여 잘못된 곱셈 표현이나 설명을 찾아 바로잡습니다.')
), checks(check_order, check_name, passed) as (
  values
    (1, 'grade2 multiplication meaning definitions exact',
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
    (2, 'grade2 multiplication meaning skill codes valid',
      not exists (select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
    (3, 'skill definitions remain force rls',
      (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_skill_definitions'::regclass)),
    (4, 'browser roles remain blocked',
      not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
    (5, 'service role remains read only',
      has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
      and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
    (6, 'skill definitions remain outside realtime',
      not exists (select 1 from pg_catalog.pg_publication_tables where schemaname = 'public' and tablename = 'learning_skill_definitions'))
)
select check_order, check_name, passed, jsonb_build_object('summary', false) as result_data
from checks
union all
select 999, 'grade2 multiplication meaning skill verification summary', bool_and(passed),
  jsonb_build_object('summary', true, 'total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
