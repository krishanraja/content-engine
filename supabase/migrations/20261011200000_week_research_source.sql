-- The Sunday session's own finds get their own source (2026-10-11).
--
-- .agents/skills/plan-week writes the ideas it researches for the week
-- through POST /api/content-ideas. Stored as 'lane_sourcing' they would be
-- counted as the n8n Lane Sourcing workflow's rows, so that workflow's
-- quiet-source alarm (intake_source_health, 336 hours) could never fire
-- while the Sunday session kept writing. Stored as 'manual' they would read
-- as ideas Krish dropped in. content_ideas.source_type is a foreign key to
-- intake_sources, so the new value needs its row.
--
-- No expectation is set: most Sundays the session offers rows that already
-- exist and writes no new ones, so silence here is not a failure.

insert into public.intake_sources (slug, label, what, active, owner, formerly, sort_order)
values (
  'week_research',
  'Sunday planning',
  'Ideas the Sunday planning session found while researching the week''s options (.agents/skills/plan-week). Most Sundays it offers existing rows and writes none.',
  true,
  'content-engine',
  null,
  65
)
on conflict (slug) do nothing;
