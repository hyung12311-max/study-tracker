-- Disposable Phase C-1 behavior checks against the synthetic Make Ten fixture content.

insert into public.learning_skill_definitions (
  skill_code, subject_code, display_name, description, curriculum_code
) values
  ('make-ten.compose', 'math', '10 만들기', '두 수를 모아 10을 구성합니다.', null),
  ('make-ten.decompose', 'math', '10 가르기', null, null);

insert into public.learning_question_skills (question_id, skill_code, is_primary)
values ('53000000-0000-4000-8000-000000000001'::uuid, 'make-ten.compose', true);

do $fixture$
begin
  begin
    update public.learning_question_skills
    set is_primary = false
    where question_id = '53000000-0000-4000-8000-000000000001'::uuid
      and skill_code = 'make-ten.compose';
    raise exception 'published question skill update was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from public.learning_question_skills
    where question_id = '53000000-0000-4000-8000-000000000001'::uuid
      and skill_code = 'make-ten.compose';
    raise exception 'published question skill delete was accepted';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    insert into public.learning_question_skills (question_id, skill_code, is_primary)
    values ('53000000-0000-4000-8000-000000000001'::uuid, 'make-ten.decompose', true);
    raise exception 'second primary skill was accepted';
  exception when unique_violation then null;
  end;

  if has_table_privilege('anon','public.learning_skill_definitions','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.learning_question_skills','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','public.learning_question_skills','INSERT,UPDATE,DELETE') then
    raise exception 'skill metadata ACL failed';
  end if;
  if not has_table_privilege('service_role','public.learning_skill_definitions','SELECT')
     or not has_table_privilege('service_role','public.learning_question_skills','SELECT') then
    raise exception 'skill metadata service read failed';
  end if;
end
$fixture$;

select 'phase2c learning skill metadata fixture passed' as result;
