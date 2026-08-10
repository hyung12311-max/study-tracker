-- Roll back only unused Grade 2 multiplication-table skills. Reused skills are intentionally excluded.
begin;
do $guard$
declare target_skill_codes text[]:=array['multiply-by-2','multiply-by-3','multiply-by-4','multiply-by-5','multiply-by-6','multiply-by-7','multiply-by-8','multiply-by-9','identify-multiplication-table-pattern','infer-missing-multiplication-factor','compare-multiplication-products','reason-about-multiplication-facts']::text[];
begin
  if exists(select 1 from public.learning_question_skills where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes)
  or exists(select 1 from public.learning_mistake_review_sessions where filter_skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_overrides where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_events where skill_code=any(target_skill_codes)) then raise exception using errcode='55000',message='grade2 multiplication tables skills are in use'; end if;
end
$guard$;
delete from public.learning_skill_definitions where skill_code=any(array['multiply-by-2','multiply-by-3','multiply-by-4','multiply-by-5','multiply-by-6','multiply-by-7','multiply-by-8','multiply-by-9','identify-multiplication-table-pattern','infer-missing-multiplication-factor','compare-multiplication-products','reason-about-multiplication-facts']::text[]);
commit;
