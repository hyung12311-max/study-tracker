-- Additive skill definitions for Grade 2 classification content authoring.
begin;

create temporary table grade2_classification_expected_skills (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text not null
) on commit drop;

insert into grade2_classification_expected_skills values
  ('identify-classification-rule', 'math', '분류 기준 찾기', '함께 묶인 것들의 공통된 특징을 살펴 분류 기준을 찾습니다.'),
  ('classify-by-given-rule', 'math', '주어진 기준으로 분류하기', '주어진 한 가지 기준에 맞는 항목을 빠짐없이 골라 분류합니다.'),
  ('compare-classification-rules', 'math', '분류 기준 비교하기', '같은 대상을 나눈 여러 기준을 비교하여 목적에 알맞은 기준을 고릅니다.'),
  ('infer-rule-from-groups', 'math', '분류 결과에서 기준 추론하기', '나누어진 모둠의 항목을 살펴 사용한 분류 기준을 거꾸로 알아냅니다.'),
  ('find-misclassified-item', 'math', '잘못 분류된 항목 찾기', '분류 기준에 맞지 않는 항목을 찾아 알맞은 모둠을 판단합니다.'),
  ('find-missing-classified-item', 'math', '빠진 분류 항목 찾기', '전체와 분류 결과를 비교하여 빠진 항목이나 모둠을 찾습니다.'),
  ('classify-by-two-properties', 'math', '두 가지 특징으로 분류하기', '두 가지 특징을 모두 만족하는 항목을 찾아 정확하게 분류합니다.'),
  ('explain-classification-reasoning', 'math', '분류 이유 설명하기', '분류 기준과 각 항목의 특징을 연결하여 분류가 알맞은 이유를 설명합니다.');

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata foundation is missing';
  end if;

  if (select count(*) from grade2_classification_expected_skills) <> 8 then
    raise exception using errcode = 'P0001', message = 'grade2 classification skill source is incomplete';
  end if;

  if exists (
    select 1
    from grade2_classification_expected_skills expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
       or actual.curriculum_code is not null
  ) then
    raise exception using errcode = '23505', message = 'grade2 classification skill definition conflicts with reviewed source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from grade2_classification_expected_skills
on conflict (skill_code) do nothing;

commit;
