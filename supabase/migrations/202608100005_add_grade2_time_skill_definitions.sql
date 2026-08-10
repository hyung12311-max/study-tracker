-- Additive skill definitions for grade2 time.
begin;
create temporary table grade2_time_expected_skills (skill_code text primary key, subject_code text not null, display_name text not null, description text not null) on commit drop;
insert into grade2_time_expected_skills values
  ('read-clock-time','math','시계의 시각 읽기','시침과 분침이 나타내는 몇 시 몇 분을 정확하게 읽습니다.'),
  ('interpret-clock-hands','math','시침과 분침 해석하기','시침과 분침의 위치와 역할을 연결하여 시각을 해석합니다.'),
  ('use-five-minute-intervals','math','5분 단위 읽기','분침이 가리키는 숫자를 5분 단위로 바꾸어 읽습니다.'),
  ('distinguish-am-pm','math','오전과 오후 구별하기','생활 시간대와 시각을 연결하여 오전과 오후를 구별합니다.'),
  ('calculate-time-after','math','몇 분 후 시각 구하기','시작 시각에 지난 분을 더하여 끝 시각을 구합니다.'),
  ('calculate-time-before','math','몇 분 전 시각 구하기','기준 시각에서 분을 빼어 이전 시각이나 시작 시각을 구합니다.'),
  ('calculate-elapsed-time','math','지난 시간 구하기','시작 시각과 끝 시각 사이에 지난 시간을 분 단위로 구합니다.'),
  ('correct-time-reasoning','math','시각 계산 바로잡기','시계 읽기와 전후 시간 계산의 오류를 찾아 바르게 고칩니다.');
do $preflight$
begin
  if to_regclass('public.learning_skill_definitions') is null or to_regclass('public.learning_question_skills') is null then raise exception using errcode='P0001',message='learning skill metadata foundation is missing'; end if;
  if (select count(*) from grade2_time_expected_skills)<>8 then raise exception using errcode='P0001',message='grade2 time skill source is incomplete'; end if;
  if exists(select 1 from grade2_time_expected_skills expected join public.learning_skill_definitions actual using(skill_code) where actual.subject_code<>expected.subject_code or actual.display_name<>expected.display_name or actual.description is distinct from expected.description or actual.curriculum_code is not null) then raise exception using errcode='23505',message='grade2 time skill definition conflicts with reviewed source'; end if;
end
$preflight$;
insert into public.learning_skill_definitions(skill_code,subject_code,display_name,description,curriculum_code)
select skill_code,subject_code,display_name,description,null from grade2_time_expected_skills on conflict(skill_code) do nothing;
commit;
