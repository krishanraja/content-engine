-- The Studio learns the three subchannel names. Krish, 2026-09-26: teach the
-- video side follow.the.money, mind.the.gap and under.the.hood.
--
-- The Studio's series ids sit inside hashed and signed records (briefs, jobs,
-- projections) that the runner re-parses strictly, so the change is additive:
-- the retired pair stays valid for every record made under it, and new briefs
-- carry the live names (packages/contracts/src/series.ts).
--
-- Live, this table's series check was gone and a foreign key to
-- venture_formats(slug) ON UPDATE CASCADE stood in its place, added outside
-- this history. That cascade rewrote the two retired validation jobs' series
-- through each subchannel rename (built_with_ai, then lift_the_lid, then
-- under_the_hood) while the runner's own records kept built_with_ai. The
-- check below pins the Studio's five ids on top of that key, so a future
-- subchannel rename stops here instead of silently moving a job's series
-- away from its signed record. Renaming a Studio series is a contract change
-- (packages/contracts/src/series.ts), never a cascade.

begin;

alter table public.video_studio_jobs drop constraint if exists video_studio_jobs_series_check;
alter table public.video_studio_jobs add constraint video_studio_jobs_series_check
  check (series in ('money_of_ai', 'built_with_ai', 'follow_the_money', 'mind_the_gap', 'under_the_hood'));

commit;
