-- Roll back only unused grade2 length calculation skills. Reused skills are intentionally excluded.
begin;
do $guard$
declare target_skill_codes text[]:=array['calculate-length-addition','calculate-length-subtraction','solve-total-length','solve-remaining-length','compare-length-difference','infer-missing-length','use-meter-centimeter-relation','correct-length-calculation-reasoning']::text[];
begin
  if exists(select 1 from public.learning_question_skills where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes)
  or exists(select 1 from public.learning_mistake_review_sessions where filter_skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_overrides where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_events where skill_code=any(target_skill_codes)) then raise exception using errcode='55000',message='grade2 length calculation skills are in use'; end if;
end
$guard$;
delete from public.learning_skill_definitions where skill_code=any(array['calculate-length-addition','calculate-length-subtraction','solve-total-length','solve-remaining-length','compare-length-difference','infer-missing-length','use-meter-centimeter-relation','correct-length-calculation-reasoning']::text[]);
commit;
