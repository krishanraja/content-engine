-- One idea queue (Krish, 2026-10-19: "mark ideas for a queue instead of selecting them for this week ...
-- it needs to survive everything and be the first thing in chat").
-- A queued idea is a content_ideas row with queued_at set. No second store.
-- Every sweep already spares protected_at (triage, grader, both stale-archive functions); the queue write sets
-- protected_at too, and api/purge/run.ts names queued_at itself. meta.queue holds his triage verdict.
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS queued_at timestamptz;
CREATE INDEX IF NOT EXISTS content_ideas_queued_idx ON public.content_ideas (queued_at) WHERE queued_at IS NOT NULL;
