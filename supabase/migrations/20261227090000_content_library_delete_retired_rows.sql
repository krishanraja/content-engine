-- Delete, for good, the rows 20261226090000_content_library_retire_loop_rows.sql
-- took out of ready, and close the retired channel-art folder to every row.
-- Krish said yes to this permanent deletion in chat on 27 Nov 2026 ("yes to
-- that", then "I'll allow it"): 29,437 rows and the 14,710 stored files only
-- they used (39,266,945 bytes).
--
-- The stored files went first, through the Storage API with the service role,
-- in batches of 500: every object of the content-library bucket that one of
-- these rows named and no other row of any state named. The 25 objects these
-- rows shared with a row that stays were kept. Counts on 27 Nov 2026:
--
--   rows                 31,305 before, 1,868 after (all ready rows kept)
--   bucket objects       17,154 before, 2,444 after
--   bucket bytes 33,883,303,906 before, 33,844,036,961 after
--
-- 1. Every row still listed in content_library_files_unready and still not
--    ready: 29,434 old copies of the working-files lists under
--    "3 Posts/2026-11-06 Fri mind.the.gap - Two passports/3 Video/" and the
--    three rows under the retired "2 Channel art (permanent)/". A listed row
--    that was made ready again since is left alone.
-- 2. content_library_files_unready is dropped: there is nothing left to put
--    back.
-- 3. No row of any state is under "2 Channel art (permanent)/" now, and the
--    path rule refuses that folder for every row. api/library/_library.ts and
--    scripts/post-pack/library.py hold the full rule
--    (config/library-paths.cases.json).
--
-- Applied through the Supabase MCP apply_migration (supabase/migrations/ORIGIN.md).
-- Safe to run twice: once the list is gone there is nothing to delete.

do $$
begin
  if to_regclass('public.content_library_files_unready') is not null then
    execute $sql$
      delete from public.content_library_files as f
       using public.content_library_files_unready as u
       where u.id = f.id and f.state = 'reserved'
    $sql$;
  end if;
end
$$;

drop table if exists public.content_library_files_unready;

do $$
begin
  if exists (
    select 1 from public.content_library_files
    where path like '2 Channel art (permanent)/%'
  ) then
    raise exception 'a row is still under 2 Channel art (permanent)/';
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
