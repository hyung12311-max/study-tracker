-- Additive skill definitions for Grade 2 measuring length content authoring.
begin;

create temporary table grade2_measuring_length_expected_skills (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text not null
) on commit drop;

insert into grade2_measuring_length_expected_skills values
  ('measure-length-with-ruler', 'math', '자로 길이 재기', '물체의 한쪽 끝을 기준 눈금에 맞추고 다른 쪽 끝의 눈금을 읽어 길이를 잽니다.'),
  ('read-ruler-scale', 'math', '자의 눈금 읽기', '자의 눈금 간격과 표시된 위치를 읽어 알맞은 길이를 확인합니다.'),
  ('choose-length-unit', 'math', '알맞은 길이 단위 고르기', '물체나 공간의 크기에 맞게 cm와 m 중 알맞은 길이 단위를 고릅니다.'),
  ('compare-lengths', 'math', '길이 비교하기', '측정한 길이를 비교하여 더 긴 것과 더 짧은 것을 찾습니다.'),
  ('estimate-length', 'math', '길이 어림하기', '생활 속 물체의 길이를 cm와 m 단위로 알맞게 어림합니다.'),
  ('measure-from-nonzero-start', 'math', '0이 아닌 눈금에서 길이 재기', '물체의 시작 눈금과 끝 눈금의 차를 이용하여 실제 길이를 구합니다.'),
  ('infer-length-from-measurement', 'math', '측정 정보로 길이 추론하기', '시작 눈금과 끝 눈금 및 길이 사이의 관계를 이용해 모르는 측정값을 찾습니다.'),
  ('correct-measurement-reasoning', 'math', '길이 측정 방법 바로잡기', '잘못된 자 사용이나 눈금 해석을 찾아 올바른 측정 방법과 결과로 고칩니다.');

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null then
    raise exception using errcode = 'P0001', message = 'learning skill metadata foundation is missing';
  end if;

  if (select count(*) from grade2_measuring_length_expected_skills) <> 8 then
    raise exception using errcode = 'P0001', message = 'grade2 measuring length skill source is incomplete';
  end if;

  if exists (
    select 1
    from grade2_measuring_length_expected_skills expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
       or actual.curriculum_code is not null
  ) then
    raise exception using errcode = '23505', message = 'grade2 measuring length skill definition conflicts with reviewed source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from grade2_measuring_length_expected_skills
on conflict (skill_code) do nothing;

commit;
