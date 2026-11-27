-- Retire, reversibly, two sets of rows in the makeyourmindup asset library, and
-- take the retired channel-art folder out of the database's own path rule.
-- Krish said yes to this cleanup on 27 Nov 2026.
--
-- 1. The working-files loop. From 30 Oct to 27 Nov 2026 the working-files lane
--    (scripts/post-pack/working.py publish, every pass of recordings-upload.ps1
--    on Krish's PC) read back the copy of its own list that the library sync
--    had kept beside an older one ("working-files (5).json"), put it in the
--    next list, and sent both again on every pass. Five folders of
--    "3 Posts/2026-11-06 Fri mind.the.gap - Two passports/3 Video/" collected
--    about 29,400 ready rows across 25 paths, and the sync rewrote the same
--    five files in Drive every ten minutes. working.py no longer reads its own
--    list or a kept copy of it. Here every older version of those paths stops
--    being ready; the newest of each path stays ready, so the library sync,
--    whose last write of each path is on that newest row, has nothing to write.
--
-- 2. The retired channel-art folder. Channel art lives in
--    "1 Brand kit (permanent)/Channel art" since 26 Nov 2026, and the API
--    refuses "2 Channel art (permanent)/". Its three rows stop being ready.
--
-- "Not ready" is the one other state the table has: 'reserved', with no
-- ready_at (content_library_files_ready_check). Nothing is deleted: no row, no
-- storage object, no Drive file. Each row's ready_at is kept in
-- content_library_files_unready first, so it can be put back:
--
--   update public.content_library_files as f
--      set state = 'ready', ready_at = u.ready_at
--     from public.content_library_files_unready as u
--    where u.id = f.id and f.state = 'reserved' and u.reason = '<reason>';
--
-- (A retired channel-art row cannot be put back while the path rule below
-- stands: the database refuses that folder for a ready row.)
--
-- Applied through the Supabase MCP apply_migration (supabase/migrations/ORIGIN.md),
-- after the working.py fix reached Krish's PC. Safe to run twice: a second run
-- retires only versions that became older since, under the same paths.

create table if not exists public.content_library_files_unready (
  id uuid primary key,
  ready_at timestamptz not null,
  reason text not null check (reason in ('working_files_loop', 'retired_channel_art_folder')),
  unready_at timestamptz not null default now()
);

alter table public.content_library_files_unready enable row level security;
revoke all on public.content_library_files_unready from anon, authenticated;

comment on table public.content_library_files_unready is
  'Rows of content_library_files taken out of ready on 27 Nov 2026 (Krish''s yes), with the ready_at each had, so each can be made ready again. 20261226090000_content_library_retire_loop_rows.sql.';

-- 1. Every version but the newest of each working-files list path in the five
-- looping folders. "Newest" is what content_library_pending reads: ready_at
-- descending, then id.
with ranked as (
  select f.id, f.ready_at,
    row_number() over (partition by f.path order by f.ready_at desc, f.id) as n
  from public.content_library_files as f
  where f.library = 'makeyourmindup'
    and f.state = 'ready'
    and f.path like '3 Posts/2026-11-06 Fri mind.the.gap - Two passports/3 Video/%'
    and f.path ~ '/working-files( \([0-9]{1,2}\))?\.json$'
),
logged as (
  insert into public.content_library_files_unready (id, ready_at, reason)
  select id, ready_at, 'working_files_loop' from ranked where n > 1
  on conflict (id) do nothing
  returning id
)
update public.content_library_files as f
   set state = 'reserved', ready_at = null
  from ranked
 where ranked.id = f.id and ranked.n > 1 and f.state = 'ready';

-- 2. The retired channel-art folder.
with stale as (
  select f.id, f.ready_at
  from public.content_library_files as f
  where f.library = 'makeyourmindup'
    and f.state = 'ready'
    and f.path like '2 Channel art (permanent)/%'
),
logged as (
  insert into public.content_library_files_unready (id, ready_at, reason)
  select id, ready_at, 'retired_channel_art_folder' from stale
  on conflict (id) do nothing
  returning id
)
update public.content_library_files as f
   set state = 'reserved', ready_at = null
  from stale
 where stale.id = f.id and f.state = 'ready';

-- 3. No ready row is under the retired folder now; the path rule says so for
-- good. A row already taken out of ready keeps its old path as a record, and
-- can never be ready again there. api/library/_library.ts and
-- scripts/post-pack/library.py hold the full rule (config/library-paths.cases.json).
do $$
begin
  if exists (
    select 1 from public.content_library_files
    where library = 'makeyourmindup' and state = 'ready' and path like '2 Channel art (permanent)/%'
  ) then
    raise exception 'a ready row is still under 2 Channel art (permanent)/';
  end if;
end
$$;

alter table public.content_library_files
  drop constraint if exists content_library_files_path_check;
alter table public.content_library_files
  add constraint content_library_files_path_check check (
    char_length(path) between 1 and 180
    and (
      (library = 'makeyourmindup' and path ~ '^(1 Brand kit \(permanent\)|3 Posts/[^/]+)/[^/]')
      or (library = 'makeyourmindup' and state <> 'ready' and path ~ '^2 Channel art \(permanent\)/[^/]')
      or (library = 'heartside' and path ~ '^Posts/[A-Z][0-9]{2,3}(-[a-z0-9]+)*/[^/]+$')
    )
    and path !~ '(^|/)\.'
    and path !~ '[\\:*?"<>|]'
    and path !~ '[[:cntrl:]]'
    and path !~ '//'
    and path !~ '/$'
    and path !~ '[ .](/|$)'
    and path !~ '(^|/) '
  );
