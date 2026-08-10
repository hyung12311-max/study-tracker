-- Roll back only unused grade2 time skills. Reused skills are intentionally excluded.
begin;
do $guard$
declare target_skill_codes text[]:=array['read-clock-time','interpret-clock-hands','use-five-minute-intervals','distinguish-am-pm','calculate-time-after','calculate-time-before','calculate-elapsed-time','correct-time-reasoning']::text[];
begin
  if exists(select 1 from public.learning_question_skills where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_attempt_questions where skill_codes_snapshot && target_skill_codes)
  or exists(select 1 from public.learning_mistake_review_sessions where filter_skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_overrides where skill_code=any(target_skill_codes))
  or exists(select 1 from public.learning_review_schedule_events where skill_code=any(target_skill_codes)) then raise exception using errcode='55000',message='grade2 time skills are in use'; end if;
end
$guard$;
delete from public.learning_skill_definitions where skill_code=any(array['read-clock-time','interpret-clock-hands','use-five-minute-intervals','distinguish-am-pm','calculate-time-after','calculate-time-before','calculate-elapsed-time','correct-time-reasoning']::text[]);
commit;
