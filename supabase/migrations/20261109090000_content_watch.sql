-- Links Krish pastes on the Inspiration board, and what content-watcher reads from them.
--
-- Krish, 2026-10-24: "I'm going to need somewhere really quick and easy to put links into ... the control center is
-- going to need a little upgrade on the inspiration board where I can chuck in a link really easily, and it fires the
-- content-watcher too. After that, the inspiration house ingests the content-watchers output". And on cost: "The last
-- thing I want is to burn all my AI Anthropic subscription tokens on watching a video."
--
-- The flow (krishanraja/content-watcher docs/BRIEF.md):
--   1. Control Center's /api/inspiration (action 'link') writes one content_watch_requests row per pasted link.
--   2. content-watcher, on whichever home computer is on, claims queued rows through the content engine's API, fetches
--      the post (video, carousel, image or text), files the media where his drops go, reads it into text on the machine
--      (no model), and writes one content_reads row keyed by the media's sha256.
--   3. The taste ledger (krishanraja/inspirationhouse) tags the card from content_reads.read_md instead of watching
--      frames, and links the request to its card (item_id).
--
-- content_reads is the one text reading of a piece of media, whatever brought it in: a pasted link, a file he dropped,
-- or one of his own recordings. Nothing here holds media bytes. Nothing is ever deleted.

create table public.content_reads (
  id uuid primary key default gen_random_uuid(),
  -- The sha256 of the media file the read is of; for a text-only post, of the post's text as filed.
  sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
  source_url text check (source_url is null or (char_length(source_url) between 8 and 2000 and source_url ~* '^https?://')),
  platform text check (platform is null or platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'facebook', 'web', 'own')),
  shape text not null check (shape in ('video', 'carousel', 'image', 'text', 'document')),
  -- The engine revision that wrote it, so a better reader can read again.
  engine_rev text not null check (char_length(engine_rev) between 1 and 40),
  -- Everything measured: words with timings, shots, on-screen text, faces, hook, pace, loudness, slides, caption,
  -- author, posted date and counts. Shape in content-watcher's docs/READ_FORMAT.md.
  read jsonb not null check (jsonb_typeof(read) = 'object'),
  -- The same read as plain text, what a model or a session reads instead of frames.
  read_md text not null check (char_length(read_md) between 1 and 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_watch_requests (
  id uuid primary key default gen_random_uuid(),
  url text not null check (char_length(url) between 8 and 2000 and url ~* '^https?://'),
  -- The link normalised (host lowercased, tracking parameters dropped), so the same post pasted twice is one request.
  url_key text not null unique check (char_length(url_key) between 8 and 2000),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'facebook', 'web')),
  -- Where its card belongs: production (a video, his "Video Engine > Inspiration") or strategy ("Cold Ideas & Inspo").
  -- Null lets content-watcher choose by shape: a video to production, anything else to strategy.
  lane text check (lane is null or lane in ('production', 'strategy')),
  -- His own words, if he typed any when he pasted it. They are his: the card shows them as his answer's start.
  note text check (note is null or char_length(note) between 1 and 2000),
  requested_by text not null default 'Krish' check (requested_by = 'Krish'),
  requested_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'filed', 'read', 'failed')),
  -- Why it failed or what it waits on, as a class (no_cookies, login_wall, not_found, too_big, blocked, timeout...),
  -- never a message: the run logs that carry it can be public.
  status_class text check (status_class is null or status_class ~ '^[a-z_]{1,40}$'),
  attempts integer not null default 0 check (attempts between 0 and 20),
  claimed_by text check (claimed_by is null or char_length(claimed_by) between 1 and 80),
  claimed_at timestamptz,
  shape text check (shape is null or shape in ('video', 'carousel', 'image', 'text', 'document')),
  -- What was filed: [{name, sha256, mime, bytes, folder}], one entry per file (a carousel has several).
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  read_id uuid references public.content_reads (id) on delete set null,
  -- The Inspiration card it became, once the taste ledger has seen the filed media.
  item_id uuid references public.inspiration_items (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint content_watch_requests_claim_pair check ((claimed_by is null) = (claimed_at is null))
);
create index content_watch_requests_queue_idx on public.content_watch_requests (requested_at) where status in ('queued', 'claimed');

alter table public.content_reads enable row level security;
alter table public.content_watch_requests enable row level security;
revoke all on public.content_reads, public.content_watch_requests from public, anon, authenticated;
grant select, insert, update on public.content_reads to service_role;
grant select, insert, update on public.content_watch_requests to service_role;
create policy content_reads_service_all on public.content_reads for all to service_role using (true) with check (true);
create policy content_watch_requests_service_all on public.content_watch_requests for all to service_role using (true) with check (true);

-- The feed's counts (20261107090000) took the default grants of a new view; only the server reads it.
revoke all on public.inspiration_feed_stats from public, anon, authenticated;
grant select on public.inspiration_feed_stats to service_role;
