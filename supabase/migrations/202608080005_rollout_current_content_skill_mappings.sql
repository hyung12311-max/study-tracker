-- Content rollout: publish reviewed skill definitions and primary question mappings
-- for both existing learning units without changing content-version identity.

begin;

create temporary table content_skill_rollout_definitions (
  skill_code text primary key,
  subject_code text not null,
  display_name text not null,
  description text
) on commit drop;

insert into content_skill_rollout_definitions values
  ('make-ten.compose', 'math', '10 만들기', '두 수를 모아 10을 구성합니다.'),
  ('build-second-largest-number', 'math', '두 번째로 큰 세 자리 수 만들기', null),
  ('build-smallest-number-above-bound', 'math', '조건보다 큰 가장 작은 수 만들기', null),
  ('compare-after-swapping-digits', 'math', '자리 숫자를 바꾼 수 비교', null),
  ('compare-three-digit-numbers', 'math', '세 자리 수 비교', null),
  ('complete-number-sequence', 'math', '수 배열 완성', null),
  ('compose-three-digit-number', 'math', '세 자리 수 구성', null),
  ('correct-comparison-order-error', 'math', '수 비교 순서 오류 바로잡기', null),
  ('correct-zero-place-value-error', 'math', '0의 자릿값 오류 바로잡기', null),
  ('decompose-three-digit-number', 'math', '세 자리 수 분해', null),
  ('exchange-ten-bundles-for-hundred', 'math', '십 묶음을 백 묶음으로 교환', null),
  ('find-predecessor-successor', 'math', '바로 앞수와 바로 뒷수 찾기', null),
  ('identify-place-value', 'math', '자릿값 식별', null),
  ('infer-digit-after-swap-comparison', 'math', '자리 교환 비교로 숫자 추론', null),
  ('infer-number-from-digit-relations', 'math', '숫자 관계로 수 추론', null),
  ('infer-number-from-place-conditions', 'math', '자릿값 조건으로 수 추론', null),
  ('order-three-digit-numbers', 'math', '세 자리 수 순서 정하기', null),
  ('read-three-digit-number', 'math', '세 자리 수 읽기', null),
  ('recognize-equivalent-bundle-expression', 'math', '같은 묶음 표현 찾기', null),
  ('represent-hundreds-tens-ones', 'math', '백·십·일로 수 나타내기', null),
  ('understand-zero-placeholder', 'math', '빈 자릿값의 0 이해', null),
  ('value-of-digit', 'math', '숫자가 나타내는 값', null),
  ('write-three-digit-number', 'math', '세 자리 수 쓰기', null);

create temporary table content_skill_rollout_mappings (
  question_id uuid primary key,
  skill_code text not null
) on commit drop;

insert into content_skill_rollout_mappings (question_id, skill_code)
select question.id, 'make-ten.compose'
from public.learning_questions question
join public.learning_stages stage on stage.id = question.stage_id
where stage.content_version_id in (
  '51000000-0000-4000-8000-000000000003'::uuid,
  '61000000-0000-4000-8000-000000000003'::uuid
);

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
)
insert into content_skill_rollout_mappings (question_id, skill_code)
select question.id, authored.skill_code
from authored
join public.learning_stages stage
  on stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
 and stage.difficulty = authored.difficulty
join public.learning_questions question
  on question.stage_id = stage.id
 and question.display_order = authored.question_order;

do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null
     or to_regclass('public.learning_question_skills') is null
     or to_regclass('public.learning_content_versions') is null then
    raise exception using errcode = 'P0001', message = 'content skill rollout prerequisites are missing';
  end if;

  if (select count(*) from content_skill_rollout_definitions) <> 23
     or (select count(*) from content_skill_rollout_mappings) <> 100 then
    raise exception using errcode = 'P0001', message = 'content skill rollout source is incomplete';
  end if;

  if (select count(*) from public.learning_content_versions version
      where version.id in (
        '51000000-0000-4000-8000-000000000003'::uuid,
        '61000000-0000-4000-8000-000000000003'::uuid,
        '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
      ) and version.status = 'published') <> 3 then
    raise exception using errcode = 'P0002', message = 'target published content versions are missing or changed';
  end if;

  if exists (
    select 1
    from content_skill_rollout_definitions expected
    join public.learning_skill_definitions actual using (skill_code)
    where actual.subject_code <> expected.subject_code
       or actual.display_name <> expected.display_name
       or actual.description is distinct from expected.description
  ) then
    raise exception using errcode = '23505', message = 'skill definition conflicts with reviewed rollout source';
  end if;

  if exists (
    select 1
    from public.learning_question_skills actual
    join content_skill_rollout_mappings expected on expected.question_id = actual.question_id
    where actual.skill_code <> expected.skill_code or not actual.is_primary
  ) then
    raise exception using errcode = '23505', message = 'question skill mapping conflicts with reviewed rollout source';
  end if;
end
$preflight$;

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
)
select skill_code, subject_code, display_name, description, null
from content_skill_rollout_definitions
on conflict (skill_code) do nothing;

insert into public.learning_question_skills (question_id, skill_code, is_primary)
select question_id, skill_code, true
from content_skill_rollout_mappings
on conflict (question_id, skill_code) do nothing;

commit;
