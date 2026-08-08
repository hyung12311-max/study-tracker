-- Disposable behavior checks for the current-content skill mapping rollout.

do $fixture$
declare
  target_question_id uuid := '53000000-0000-4000-8000-000000000001'::uuid;
begin
  if (select count(*) from public.learning_skill_definitions
      where subject_code = 'math') <> 23 then
    raise exception 'expected 23 rollout skill definitions';
  end if;

  if (select count(*)
      from public.learning_question_skills mapping
      join public.learning_questions question on question.id = mapping.question_id
      join public.learning_stages stage on stage.id = question.stage_id
      where stage.content_version_id in (
        '51000000-0000-4000-8000-000000000003'::uuid,
        '61000000-0000-4000-8000-000000000003'::uuid,
        '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
      ) and mapping.is_primary) <> 100 then
    raise exception 'expected 100 primary rollout mappings';
  end if;

  if exists (
    select question_id
    from public.learning_question_skills
    group by question_id
    having count(*) filter (where is_primary) > 1
  ) then
    raise exception 'primary skill uniqueness failed';
  end if;

  begin
    update public.learning_question_skills
    set is_primary = false
    where question_id = target_question_id and skill_code = 'make-ten.compose';
    raise exception 'published question skill update was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from public.learning_question_skills
    where question_id = target_question_id and skill_code = 'make-ten.compose';
    raise exception 'published question skill delete was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    insert into public.learning_question_skills (question_id, skill_code, is_primary)
    values (target_question_id, 'read-three-digit-number', true);
    raise exception 'second primary skill was accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.learning_skill_definitions (skill_code, subject_code, display_name)
    values ('Invalid Skill', 'math', 'invalid');
    raise exception 'invalid skill code was accepted';
  exception when check_violation then null;
  end;

  if has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.learning_question_skills','INSERT,UPDATE,DELETE') then
    raise exception 'skill rollout ACL failed';
  end if;

  if not has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
     or not has_table_privilege('service_role','public.learning_question_skills','SELECT') then
    raise exception 'skill rollout service read failed';
  end if;

  if exists (
    select 1 from pg_catalog.pg_publication_tables
    where schemaname = 'public'
      and tablename in ('learning_skill_definitions','learning_question_skills')
  ) then
    raise exception 'skill rollout tables entered realtime';
  end if;
end
$fixture$;

select 'content skill mapping rollout fixture passed' as result;
