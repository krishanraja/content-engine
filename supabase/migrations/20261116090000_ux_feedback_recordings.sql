-- Feedback videos Krish records himself, and the timeline content-watcher makes of each, apart from Inspiration.
--
-- Krish, 2026-10-28: "It would be good to have somewhere in my control centre where I can specifically add a feedback
-- video that's not inspiration from Instagram or a YouTube reel, but just me recording a video. It would trigger only
-- this one part of the system." And on the result: "I got an email sent to me with the timestamped feedback file and
-- the link to the Google Drive folder where all the still images are stored ... wrapped into a neat and tidy Claude
-- Code prompt."
--
-- The flow:
--   1. Control Center (krishanraja/control-center, api/feedback-videos.ts) writes one row, status 'uploading', and
--      hands the browser a signed upload URL into the private bucket ux-feedback; once the bytes are there it moves
--      the row to 'queued'.
--   2. content-watcher on a home computer claims it (apps/control-plane/api/ux-feedback/claim.ts), downloads it through
--      a signed URL, runs `content-watch timeline --profile ux` on the machine, puts the stills and the feedback file
--      in a Drive folder of their own (drive.ts) and reports (report.ts).
--   3. The report sends Krish one email: a Claude Code prompt with the feedback file's and the folder's links.
--
-- Nothing here touches content_watch_requests, content_reads or the Inspiration folders, so the taste ledger
-- (inspirationhouse) never sees a feedback video. Nothing is ever deleted.

create table public.ux_feedback_recordings (
  id uuid primary key default gen_random_uuid(),
  -- The file's name as he picked it, for the Drive folder's name and the email.
  name text not null check (char_length(name) between 1 and 200),
  -- What the feedback is on, in his words (a product, a repository, a flow). It goes into the Claude Code prompt.
  note text check (note is null or char_length(note) between 1 and 2000),
  object_path text not null unique check (object_path ~ '^recordings/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9 ._()-]{0,199}$'),
  mime text not null check (mime in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska')),
  bytes bigint not null check (bytes between 1 and 2147483648),
  requested_by text not null default 'Krish' check (requested_by = 'Krish'),
  requested_at timestamptz not null default now(),
  status text not null default 'uploading' check (status in ('uploading', 'queued', 'claimed', 'done', 'failed')),
  -- Why it failed, as a class (download_failed, timeline_failed, drive_failed, timeout...), never a message.
  status_class text check (status_class is null or status_class ~ '^[a-z_]{1,40}$'),
  attempts integer not null default 0 check (attempts between 0 and 20),
  claimed_by text check (claimed_by is null or char_length(claimed_by) between 1 and 80),
  claimed_at timestamptz,
  -- The Drive folder made for this recording (stills and the feedback file), and the feedback file in it.
  drive_folder_id text check (drive_folder_id is null or drive_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  feedback_file_id text check (feedback_file_id is null or feedback_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  -- Counts and the UX signals heard: {duration_s, stills, images, signals: [{t, signal, term, said, still}]}.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  emailed_via text check (emailed_via is null or emailed_via in ('send', 'draft', 'failed')),
  emailed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ux_feedback_recordings_claim_pair check ((claimed_by is null) = (claimed_at is null))
);
create index ux_feedback_recordings_queue_idx on public.ux_feedback_recordings (requested_at) where status in ('queued', 'claimed');

alter table public.ux_feedback_recordings enable row level security;
revoke all on public.ux_feedback_recordings from public, anon, authenticated;
grant select, insert, update on public.ux_feedback_recordings to service_role;
create policy ux_feedback_recordings_service_all on public.ux_feedback_recordings for all to service_role using (true) with check (true);

-- The recordings themselves: private, read and written only through signed URLs the server makes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ux-feedback', 'ux-feedback', false, 2147483648, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'])
on conflict (id) do nothing;
