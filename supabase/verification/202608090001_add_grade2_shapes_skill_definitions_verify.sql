begin transaction read only;

with expected(skill_code, subject_code, display_name, description) as (
  values
    ('identify-plane-shape', 'math', '평면 모양 알아보기', '세모 모양과 네모 모양과 동그라미 모양을 구별합니다.'),
    ('identify-solid-shape', 'math', '입체 모양 알아보기', '상자 모양과 통 모양과 공 모양을 구별합니다.'),
    ('connect-object-to-shape', 'math', '생활 물건에서 모양 찾기', '생활 속 물건과 닮은 평면 또는 입체 모양을 찾습니다.'),
    ('classify-shapes', 'math', '모양 분류하기', '공통된 특징을 기준으로 평면 모양과 입체 모양을 분류합니다.'),
    ('describe-shape-properties', 'math', '모양의 특징 설명하기', '선과 만나는 곳과 면의 특징을 관찰하여 설명합니다.'),
    ('compose-decompose-shapes', 'math', '모양 만들고 나누기', '모양을 붙이거나 나누어 새로운 모양을 이해합니다.'),
    ('infer-shape-from-properties', 'math', '특징으로 모양 추론하기', '주어진 특징과 조건을 이용해 알맞은 모양을 찾습니다.'),
    ('correct-shape-reasoning', 'math', '모양 설명 바로잡기', '모양의 특징을 잘못 설명한 이유를 찾고 바르게 고칩니다.')
), checks(name, passed) as (
  values
    ('grade2 shapes definitions exact',
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
    ('grade2 shapes skill codes valid',
      not exists (select 1 from expected where skill_code !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')),
    ('skill definitions remain force rls',
      (select relrowsecurity and relforcerowsecurity
       from pg_catalog.pg_class where oid = 'public.learning_skill_definitions'::regclass)),
    ('browser roles remain blocked',
      not has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
    ('service role remains read only',
      has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
      and not has_table_privilege('service_role','public.learning_skill_definitions','INSERT,UPDATE,DELETE')),
    ('skill definitions remain outside realtime',
      not exists (
        select 1 from pg_catalog.pg_publication_tables
        where schemaname = 'public' and tablename = 'learning_skill_definitions'
      ))
)
select name, passed from checks order by name;

with checks(passed) as (
  values
    ((select count(*) from public.learning_skill_definitions where skill_code in (
      'identify-plane-shape','identify-solid-shape','connect-object-to-shape','classify-shapes',
      'describe-shape-properties','compose-decompose-shapes','infer-shape-from-properties','correct-shape-reasoning'
    )) = 8),
    ((select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.learning_skill_definitions'::regclass)),
    (not has_table_privilege('authenticated','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')),
    (has_table_privilege('service_role','public.learning_skill_definitions','SELECT'))
)
select count(*)::integer total_checks,
  count(*) filter (where passed)::integer passed_checks,
  count(*) filter (where not passed)::integer failed_checks
from checks;

rollback;
