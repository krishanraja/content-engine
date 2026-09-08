-- The Drive inspiration lane keeps what it read.
--
-- Until now a screenshot was downloaded, sent to a vision model, turned into an
-- idea, and discarded. The idea carried a Drive file id in meta and nothing
-- else: no thumbnail on the card, no way to re-extract without re-downloading,
-- and no record of what the model actually saw.
--
-- content_inspiration_artifacts already existed, empty, with no reader or
-- writer in either repository: canonical_key, input_kind, status, scope,
-- storage_bucket/storage_path, content_hash, source_meta, analysis. That shape
-- is more general than a Drive-only store and already anticipates the capture
-- route (a pasted URL or an image from the share sheet), so the engine adopts
-- it rather than standing up a second artifact table beside it. The only thing
-- it lacked was the link back to the idea it produced.
--
-- Two faults in the old lane are fixed here rather than in code, because they
-- are properties of the ledger:
--
--   A transient download failure was written as processed, which made it
--   permanent. retry_after and attempts let a file that failed once be tried
--   again, and a file that has failed four times be left alone and said out
--   loud.
--
--   The file was the identity, so one LinkedIn post screenshotted twice was two
--   ideas. content_ideas_inspiration_url_live_uq already exists on source_url;
--   the engine now passes the post's own URL (or the content hash when no URL is
--   visible) instead of the Drive link, so that index finally fires.
--
-- The n8n sweep's Drive branch and this route share inspiration_drive_files by
-- file_key, so while both are running neither reads a file the other has
-- already taken. That is deliberate: the n8n branch can be turned off after the
-- engine lane is proven, not before.

alter table public.inspiration_drive_files
  add column if not exists retry_after timestamptz,
  add column if not exists attempts int not null default 0;

comment on column public.inspiration_drive_files.retry_after is
  'When a transiently failed file may be attempted again. Null means settled: either it read fine or it will never read.';

-- The link the existing table was missing. on delete set null: binning the idea
-- must not destroy the evidence of what was read to produce it.
alter table public.content_inspiration_artifacts
  add column if not exists content_idea_id uuid references public.content_ideas(id) on delete set null;

create index if not exists content_inspiration_artifacts_idea_idx
  on public.content_inspiration_artifacts (content_idea_id)
  where content_idea_id is not null;

comment on column public.content_inspiration_artifacts.canonical_key is
  'The dedupe handle, already unique. The Drive scan writes drive:<sha256 of the file bytes>, so the same screenshot saved twice is one artifact.';

alter table public.content_inspiration_artifacts enable row level security;

-- The Library reads the row to show a card; only the service role writes one.
-- The bytes are NOT reachable through this grant: the bucket below is private
-- and needs a signed URL.
drop policy if exists content_inspiration_artifacts_read on public.content_inspiration_artifacts;
create policy content_inspiration_artifacts_read
  on public.content_inspiration_artifacts for select
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public)
values ('inspiration-artifacts', 'inspiration-artifacts', false)
on conflict (id) do nothing;

-- inspiration_lane_health already answers "is this lane fed, and is it
-- converting". This answers the different question only the ledger can see:
-- what is waiting for a retry and what has been given up on. Two views with
-- distinct names beat one view that means two things.
--
-- security_invoker so it reads with the caller's permissions rather than the
-- creator's, which is what the advisor flagged on the ledger views in the same
-- week. (inspiration_lane_health is still SECURITY DEFINER and predates this
-- change; nothing in either repository reads it yet, so flipping it is a
-- separate change with its own readback rather than a side effect of this one.)
create or replace view public.inspiration_drive_ledger_state as
select
  count(*) filter (where processed_at is not null and skip_reason is null)    as read_ok,
  count(*) filter (where skip_reason is not null and retry_after is not null) as awaiting_retry,
  count(*) filter (where skip_reason is not null and retry_after is null)     as given_up,
  count(*) filter (where first_seen_at > now() - interval '7 days')           as seen_this_week,
  max(first_seen_at)                                                          as last_file_seen_at
from public.inspiration_drive_files;

alter view public.inspiration_drive_ledger_state set (security_invoker = true);
