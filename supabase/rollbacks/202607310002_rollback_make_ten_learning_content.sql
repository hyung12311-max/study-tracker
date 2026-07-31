-- Pre-use rollback for the Make Ten v1 pilot content only.
begin;

do $guard$
begin
  if exists (
    select 1 from public.learning_assignments
    where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
  ) or exists (
    select 1 from public.learning_attempts
    where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
  ) or exists (
    select 1 from public.learning_stage_first_passes
    where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
  ) then
    raise exception using
      errcode = '55000',
      message = 'rollback blocked: make-ten content has assignment or learning history';
  end if;
end
$guard$;

select pg_catalog.set_config('session_replication_role', 'replica', true);

delete from public.learning_question_options option
using public.learning_questions question, public.learning_stages stage
where option.question_id = question.id
  and question.stage_id = stage.id
  and stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid;

delete from public.learning_questions question
using public.learning_stages stage
where question.stage_id = stage.id
  and stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid;

delete from public.learning_stages
where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid;

delete from public.learning_content_versions
where id = '51000000-0000-4000-8000-000000000003'::uuid;

delete from public.learning_units unit
where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
  and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
  and not exists (
    select 1 from public.learning_content_versions version
    where version.unit_id = unit.id
  );

delete from public.learning_courses course
where course.id = '51000000-0000-4000-8000-000000000001'::uuid
  and not exists (
    select 1 from public.learning_units unit
    where unit.course_id = course.id
  );

select pg_catalog.set_config('session_replication_role', 'origin', true);

commit;
