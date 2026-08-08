-- Pre-use rollback for the grade2-shapes v1 pilot content only.
begin;

do $guard$
begin
  if exists (
    select 1 from public.learning_assignments
    where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
  ) or exists (
    select 1 from public.learning_attempts
    where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
  ) or exists (
    select 1 from public.learning_stage_first_passes
    where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
  ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: grade2_shapes_v1 content has assignment or learning history';
  end if;

  if to_regclass('public.learning_unit_recommendation_metadata') is null
    or (
      select count(*)
      from public.learning_unit_recommendation_metadata metadata
      where metadata.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
        and metadata.subject = 'math'
        and metadata.recommended_start_level_code = 'elementary_2'
        and metadata.recommended_end_level_code = 'elementary_2'
        and metadata.parent_sort_order = 2
    ) <> 1
    or exists (
      select 1
      from public.learning_unit_recommendation_metadata metadata
      where metadata.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
        and (
          metadata.subject is distinct from 'math'
          or metadata.recommended_start_level_code is distinct from 'elementary_2'
          or metadata.recommended_end_level_code is distinct from 'elementary_2'
          or metadata.parent_sort_order is distinct from 2
        )
    ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: recommendation metadata is missing or changed';
  end if;
end
$guard$;

delete from public.learning_unit_recommendation_metadata metadata
where metadata.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
  and metadata.subject = 'math'
  and metadata.recommended_start_level_code = 'elementary_2'
  and metadata.recommended_end_level_code = 'elementary_2'
  and metadata.parent_sort_order = 2;

select pg_catalog.set_config('session_replication_role', 'replica', true);

delete from public.learning_question_skills mapping
using public.learning_questions question, public.learning_stages stage
where mapping.question_id = question.id
  and question.stage_id = stage.id
  and stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid;

delete from public.learning_question_options option
using public.learning_questions question, public.learning_stages stage
where option.question_id = question.id
  and question.stage_id = stage.id
  and stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid;

delete from public.learning_questions question
using public.learning_stages stage
where question.stage_id = stage.id
  and stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid;

delete from public.learning_stages
where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid;

delete from public.learning_content_versions
where id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid;

delete from public.learning_units unit
where unit.id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
  and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
  and not exists (
    select 1 from public.learning_content_versions version
    where version.unit_id = unit.id
  );

select pg_catalog.set_config('session_replication_role', 'origin', true);

commit;
