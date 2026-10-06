-- The makeyourmindup asset library: every file a session sends for Krish's
-- Drive folder, and which of his machines wrote it there.
--
-- Krish, 2026-10-06: "make sure the brand kit is always updated here [the
-- library's Drive folder]", then "I want every single asset in there,
-- permanent and for individual posts, categorized properly, clear what to use
-- them for, and every new post gets its own new folder with all assets
-- including the article HTML I can copy paste, video scripts, etc etc".
--
-- The pieces and their artwork are made in cloud agent sessions, which cannot
-- put a file into Drive. So a session sends each file to the private bucket
-- below (POST /api/library/upload-url, then /api/library/confirm, on the
-- engine key), and the library sync on Krish's always-on Windows machine
-- takes the ready ones (GET /api/library/pending, then POST
-- /api/library/written, on the runner bearer) and writes them into the
-- folder. The architecture doc's rule 0a.5 says agents never write into his
-- Drive; this is his explicit instruction for this one folder, carried out by
-- his own machine, and it covers that folder only.
--
-- One row per version of a file: a path and the sha256 of its bytes. The
-- newest ready version of a path is the one the sync writes. `written` holds,
-- for each machine (the hash the runner routes use), when it wrote that
-- version and under what name. Only the service role touches any of it, as
-- with the work board.
--
-- Idempotent: safe to run twice. Nothing here is applied by a session; the
-- parent session applies it.

create table if not exists public.content_library_files (
  id uuid primary key default gen_random_uuid(),
  -- Relative, forward slashes, inside the brand kit, the channel art or one
  -- post's folder. api/library/_library.ts holds the full rule; this is the
  -- second line behind it.
  path text not null check (
    char_length(path) between 1 and 180
    and path ~ '^(1 Brand kit \(permanent\)|2 Channel art \(permanent\)|3 Posts/[^/]+)/[^/]'
    and path !~ '(^|/)\.'
    and path !~ '[\\:*?"<>|]'
    and path !~ '[[:cntrl:]]'
    and path !~ '//'
    and path !~ '/$'
    and path !~ '[ .](/|$)'
    and path !~ '(^|/) '
  ),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  md5 text not null check (md5 ~ '^[a-f0-9]{32}$'),
  bytes bigint not null check (bytes between 1 and 524288000),
  content_type text not null check (char_length(content_type) between 3 and 80),
  object_key text not null check (object_key ~ '^files/[a-f0-9]{64}\.[a-z0-9]{1,8}$'),
  -- What the file is for, in one line a person reads.
  purpose text not null check (char_length(purpose) between 1 and 200),
  -- Who sent it: the agent client on the engine key, or Krish.
  sent_by text not null check (sent_by ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'),
  sent_at timestamptz not null default now(),
  state text not null default 'reserved' check (state in ('reserved', 'ready')),
  ready_at timestamptz,
  -- { "<machine hash>": { "at": <when it was written>, "as": <the path it went to> } }
  written jsonb not null default '{}'::jsonb check (jsonb_typeof(written) = 'object'),
  constraint content_library_files_ready_check check ((state = 'ready') = (ready_at is not null)),
  constraint content_library_files_path_sha256_key unique (path, sha256)
);

create index if not exists content_library_files_ready_idx
  on public.content_library_files (path, ready_at desc)
  where state = 'ready';

comment on table public.content_library_files is
  'The makeyourmindup asset library (Krish, 2026-10-06): each file sent for his Drive folder, and which machine wrote it there. api/library/.';

alter table public.content_library_files enable row level security;
revoke all on public.content_library_files from anon, authenticated;

-- The bucket: private, 500 MiB a file, and only the types a post, the brand
-- kit or the channel art holds. The routes refuse to work if any of this
-- differs (configuredLibraryStore), so the list here and the one in
-- api/library/_library.ts are tested against each other.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-library',
  'content-library',
  false,
  524288000,
  array[
    'application/json', 'application/pdf', 'application/x-subrip', 'application/zip',
    'audio/mp4', 'audio/mpeg', 'audio/wav',
    'font/otf', 'font/ttf', 'font/woff', 'font/woff2',
    'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
    'text/css', 'text/csv', 'text/html', 'text/javascript', 'text/markdown', 'text/plain', 'text/vtt',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- What one machine has still to write: for each path, the newest ready
-- version, unless the last version this machine wrote at that path is that
-- one. previous_sha256 is the version this machine last wrote there.
create or replace function public.content_library_pending(p_machine_hash text, p_limit integer)
returns table (
  path text,
  sha256 text,
  bytes bigint,
  content_type text,
  object_key text,
  purpose text,
  sent_by text,
  sent_at timestamptz,
  ready_at timestamptz,
  previous_sha256 text
)
language sql
stable
set search_path = ''
as $$
  with newest as (
    select distinct on (f.path)
      f.path, f.sha256, f.bytes, f.content_type, f.object_key, f.purpose, f.sent_by, f.sent_at, f.ready_at
    from public.content_library_files as f
    where f.state = 'ready'
    order by f.path, f.ready_at desc, f.id
  ),
  last_written as (
    select distinct on (f.path) f.path, f.sha256
    from public.content_library_files as f
    where f.state = 'ready'
      and (f.written -> p_machine_hash) is not null
    order by f.path, ((f.written -> p_machine_hash) ->> 'at')::timestamptz desc, f.id
  )
  select n.path, n.sha256, n.bytes, n.content_type, n.object_key, n.purpose, n.sent_by, n.sent_at, n.ready_at, w.sha256
  from newest as n
  left join last_written as w on w.path = n.path
  where p_machine_hash ~ '^[a-f0-9]{64}$'
    and w.sha256 is distinct from n.sha256
  order by n.ready_at, n.path
  limit greatest(1, least(coalesce(p_limit, 25), 101))
$$;

-- Records that a machine wrote these versions. Recording one again moves its
-- time forward, so a version sent again after a newer one is written back
-- and then counts as the last one written.
create or replace function public.content_library_record_written(p_machine_hash text, p_items jsonb)
returns table (item_path text, item_sha256 text, outcome text)
language sql
volatile
set search_path = ''
as $$
  with item as (
    select distinct on (x.path, x.sha256) x.path, x.sha256, x.written_as
    from pg_catalog.jsonb_to_recordset(
      case when pg_catalog.jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
    ) as x(path text, sha256 text, written_as text)
    order by x.path, x.sha256
  ),
  updated as (
    update public.content_library_files as f
    set written = f.written || pg_catalog.jsonb_build_object(
      p_machine_hash,
      pg_catalog.jsonb_build_object('at', pg_catalog.now(), 'as', coalesce(item.written_as, f.path))
    )
    from item
    where f.path = item.path
      and f.sha256 = item.sha256
      and f.state = 'ready'
      and p_machine_hash ~ '^[a-f0-9]{64}$'
    returning f.path, f.sha256
  )
  select item.path, item.sha256, case when updated.path is null then 'unknown' else 'recorded' end
  from item
  left join updated on updated.path = item.path and updated.sha256 = item.sha256
  order by item.path, item.sha256
$$;

revoke all on function public.content_library_pending(text, integer) from public, anon, authenticated;
revoke all on function public.content_library_record_written(text, jsonb) from public, anon, authenticated;
grant execute on function public.content_library_pending(text, integer) to service_role;
grant execute on function public.content_library_record_written(text, jsonb) to service_role;
