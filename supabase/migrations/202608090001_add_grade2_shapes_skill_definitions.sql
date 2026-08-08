-- Additive skill definitions for Grade 2 shapes content authoring.
begin;

create temporary table grade2_shapes_expected_skills (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text not null
) on commit drop;

insert into grade2_shapes_expected_skills values
  ('identify-plane-shape', 'math', '평면 모양 알아보기', '세모 모양과 네모 모양과 동그라미 모양을 구별합니다.'),
  ('identify-solid-shape', 'math', '입체 모양 알아보기', '상자 모양과 통 모양과 공 모양을 구별합니다.'),
  ('connect-object-to-shape', 'math', '생활 물건에서 모양 찾기', '생활 속 물건과 닮은 평면 또는 입체 모양을 찾습니다.'),
  ('classify-shapes', 'math', '모양 분류하기', '공통된 특징을 기준으로 평면 모양과 입체 모양을 분류합니다.'),
  ('describe-shape-properties', 'math', '모양의 특징 설명하기', '선과 만나는 곳과 면의 특징을 관찰하여 설명합니다.'),
  ('compose-decompose-shapes', 'math', '모양 만들고 나누기', '모양을 붙이거나 나누어 새로운 모양을 이해합니다.'),
  ('infer-shape-from-properties', 'math', '특징으로 모양 추론하기', '주어진 특징과 조건을 이용해 알맞은 모양을 찾습니다.'),
  ('correct-shape-reasoning', 'math', '모양 설명 바로잡기', '모양의 특징을 잘못 설명한 이유를 찾고 바르게 고칩니다.');

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata foundation is missing';
  end if;

  if (select count(*) from grade2_shapes_expected_skills) <> 8 then
    raise exception using errcode = 'P0001', message = 'grade2 shapes skill source is incomplete';
  end if;

  if exists (
    select 1
    from grade2_shapes_expected_skills expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
       or actual.curriculum_code is not null
  ) then
    raise exception using errcode = '23505', message = 'grade2 shapes skill definition conflicts with reviewed source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from grade2_shapes_expected_skills
on conflict (skill_code) do nothing;

commit;
