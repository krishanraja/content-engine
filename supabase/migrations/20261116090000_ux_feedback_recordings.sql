-- Feedback videos Krish records on his phone about one of his own products, and what content-watcher makes of each,
-- apart from Inspiration.
--
-- Krish, 2026-10-28: "somewhere in my control centre where I can specifically add a feedback video that's not
-- inspiration from Instagram or a YouTube reel, but just me recording a video. It would trigger only this one part of
-- the system." Then: "specify which venture this feedback is for (because it's usually me providing real-world mobile
-- UX feedback on a particular mobile experience of mine in one of the ventures)", with the outputs "in the right
-- places inside the Ventures folder (not the inspiration folder)", and: "videos I'll take on my phone as MP4 and
-- upload them to Google Drive ... I probably want to send the link to the MP4 or the video file, which is stored in my
-- Google Drive." And for the result: "an email sent to me with the timestamped feedback file and the link to the
-- Google Drive folder where all the still images are stored ... wrapped into a neat and tidy Claude Code prompt."
--
-- The flow:
--   1. Control Center's Bugs & Issues page (krishanraja/control-center, api/feedback-videos.ts) checks the Drive link
--      he pastes or shares, reads the file as its owner (name, size, MD5, length, where it sits) and writes one row
--      with the venture he tapped and that product's repository and domain.
--   2. content-watcher on a home computer claims it (apps/control-plane/api/ux-feedback/claim.ts), reads the copy his
--      Drive has synced to that computer (checked by size and MD5), makes the timeline, and puts the stills and
--      feedback.md in Ventures > Bugs & Issues > <venture> > <day> <name> (drive.ts), then reports (report.ts).
--   3. The report writes "Claude Code prompt.md" into that folder and sends Krish one email with the prompt and the
--      links.
--
-- His recording is never copied, moved or deleted, and nothing here touches content_watch_requests, content_reads or
-- the Inspiration folders, so the taste ledger (inspirationhouse) never sees a feedback video. Nothing is deleted.

create table public.ux_feedback_recordings (
  id uuid primary key default gen_random_uuid(),
  -- The recording in his Drive, as Control Center read it when he added it.
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  -- Where it sits under My Drive, for the copy his Drive syncs to a home computer (Ventures/Bugs & Issues/run.mp4).
  drive_path text not null check (char_length(drive_path) between 1 and 1000),
  name text not null check (char_length(name) between 1 and 300),
  mime text not null check (mime ~ '^video/[a-z0-9.+-]{1,60}$'),
  bytes bigint not null check (bytes between 1 and 10737418240),
  md5 text check (md5 is null or md5 ~ '^[a-f0-9]{32}$'),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  -- The product it is feedback on: a venture_registry slug from Control Center's portfolio, or control_centre.
  venture text not null check (venture ~ '^[a-z][a-z0-9_]{1,40}$'),
  venture_label text not null check (char_length(venture_label) between 1 and 60),
  repo text check (repo is null or repo ~ '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$'),
  domain text check (domain is null or char_length(domain) between 3 and 200),
  -- What it is feedback on, in his words, if he typed any. It goes into the Claude Code prompt.
  note text check (note is null or char_length(note) between 1 and 2000),
  requested_by text not null default 'Krish' check (requested_by = 'Krish'),
  requested_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'done', 'failed')),
  -- Why it failed, as a class (not_synced_yet, not_the_same_file, timeline_failed, no_drive_destination...), never a
  -- message.
  status_class text check (status_class is null or status_class ~ '^[a-z_]{1,40}$'),
  attempts integer not null default 0 check (attempts between 0 and 20),
  claimed_by text check (claimed_by is null or char_length(claimed_by) between 1 and 80),
  claimed_at timestamptz,
  -- Its folder in Ventures > Bugs & Issues > <venture>, the Stills folder inside it, and the two files written there.
  drive_folder_id text check (drive_folder_id is null or drive_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  stills_folder_id text check (stills_folder_id is null or stills_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  feedback_file_id text check (feedback_file_id is null or feedback_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  prompt_file_id text check (prompt_file_id is null or prompt_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  -- Counts, the UX signals heard and the recording's shape: {duration_s, stills, images, signals, width, height, portrait}.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  emailed_via text check (emailed_via is null or emailed_via in ('send', 'draft', 'failed')),
  emailed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ux_feedback_recordings_claim_pair check ((claimed_by is null) = (claimed_at is null))
);
create index ux_feedback_recordings_queue_idx on public.ux_feedback_recordings (requested_at) where status in ('queued', 'claimed');
-- The same recording added twice while it is on its way is one run.
create unique index ux_feedback_recordings_one_run on public.ux_feedback_recordings (drive_file_id) where status in ('queued', 'claimed');

alter table public.ux_feedback_recordings enable row level security;
revoke all on public.ux_feedback_recordings from public, anon, authenticated;
grant select, insert, update on public.ux_feedback_recordings to service_role;
create policy ux_feedback_recordings_service_all on public.ux_feedback_recordings for all to service_role using (true) with check (true);
