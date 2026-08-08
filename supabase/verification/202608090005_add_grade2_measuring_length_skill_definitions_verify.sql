begin transaction read only;

with expected(skill_code, subject_code, display_name, description) as (
  values
    ('measure-length-with-ruler', 'math', '자로 길이 재기', '물체의 한쪽 끝을 기준 눈금에 맞추고 다른 쪽 끝의 눈금을 읽어 길이를 잽니다.'),
    ('read-ruler-scale', 'math', '자의 눈금 읽기', '자의 눈금 간격과 표시된 위치를 읽어 알맞은 길이를 확인합니다.'),
    ('choose-length-unit', 'math', '알맞은 길이 단위 고르기', '물체나 공간의 크기에 맞게 cm와 m 중 알맞은 길이 단위를 고릅니다.'),
    ('compare-lengths', 'math', '길이 비교하기', '측정한 길이를 비교하여 더 긴 것과 더 짧은 것을 찾습니다.'),
    ('estimate-length', 'math', '길이 어림하기', '생활 속 물체의 길이를 cm와 m 단위로 알맞게 어림합니다.'),
    ('measure-from-nonzero-start', 'math', '0이 아닌 눈금에서 길이 재기', '물체의 시작 눈금과 끝 눈금의 차를 이용하여 실제 길이를 구합니다.'),
    ('infer-length-from-measurement', 'math', '측정 정보로 길이 추론하기', '시작 눈금과 끝 눈금 및 길이 사이의 관계를 이용해 모르는 측정값을 찾습니다.'),
    ('correct-measurement-reasoning', 'math', '길이 측정 방법 바로잡기', '잘못된 자 사용이나 눈금 해석을 찾아 올바른 측정 방법과 결과로 고칩니다.')
), checks(check_order, check_name, passed) as (
  values
    (1, 'grade2 measuring length definitions exact',
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
    (2, 'grade2 measuring length skill codes valid',
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
select 999, 'grade2 measuring length skill verification summary', bool_and(passed),
  jsonb_build_object(
    'summary', true,
    'total_checks', count(*),
    'passed_checks', count(*) filter (where passed),
    'failed_checks', count(*) filter (where not passed)
  )
from checks
order by check_order;

rollback;
