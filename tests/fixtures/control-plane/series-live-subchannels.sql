-- After 20260926090000: the job table admits the five Studio series and no other.
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
  where conrelid = 'public.video_studio_jobs'::regclass and conname = 'video_studio_jobs_series_check';
  if def is null then raise exception 'the series check is missing'; end if;
  if def not like '%money_of_ai%' or def not like '%built_with_ai%' then raise exception 'a retired series was dropped: %', def; end if;
  if def not like '%follow_the_money%' or def not like '%mind_the_gap%' or def not like '%under_the_hood%' then raise exception 'a live subchannel is missing: %', def; end if;
  if def like '%general%' then raise exception 'a non-Studio slug was admitted: %', def; end if;
end $$;
