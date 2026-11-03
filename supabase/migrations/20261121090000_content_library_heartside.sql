-- A second library in the same lane: Heartside's social library.
--
-- Krish, 2026-11-03: "Why don't you duplicate that Python script for
-- Heartside then? We're going to need to do a lot more of this type of stuff
-- moving forward." He chose to add Heartside to this lane rather than build a
-- copy of it.
--
-- The Heartside growth engine (krishanraja/growth-heartside) files each
-- post's media here as Posts/<post id>/<file>. Krish's always-on machine writes
-- it into his Drive folder Heartside/05_Social-Library, where Codex posts what
-- he approves. Like the makeyourmindup folder, this is his explicit
-- instruction for that one folder, carried out by his own machine.
--
-- Every row names its library. Existing rows, and every request that names
-- none, are makeyourmindup, so nothing that already works changes. Paths,
-- uniqueness, the pending list and the written record are all kept per
-- library. The bucket and its content-addressed object keys are shared: the
-- same bytes are one object whichever library holds them.
--
-- Idempotent: safe to run twice. Nothing here is applied by a session; the
-- parent session applies it.

alter table public.content_library_files
  add column if not exists library text not null default 'makeyourmindup';

alter table public.content_library_files
  drop constraint if exists content_library_files_library_check;
alter table public.content_library_files
  add constraint content_library_files_library_check check (library in ('makeyourmindup', 'heartside'));

-- The path rule's second line, now per library. api/library/_library.ts and
-- scripts/post-pack/library.py hold the full rule
-- (config/library-paths.cases.json).
alter table public.content_library_files
  drop constraint if exists content_library_files_path_check;
alter table public.content_library_files
  add constraint content_library_files_path_check check (
    char_length(path) between 1 and 180
    and (
      (library = 'makeyourmindup' and path ~ '^(1 Brand kit \(permanent\)|2 Channel art \(permanent\)|3 Posts/[^/]+)/[^/]')
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

-- The old (path, sha256) key stays: the two libraries' paths can never be the
-- same (makeyourmindup's start with a numbered folder, Heartside's with
-- Posts), so it costs nothing, and the code deployed before this one keeps
-- working until the new code lands. The new key is what the routes use.
alter table public.content_library_files
  drop constraint if exists content_library_files_library_path_sha256_key;
alter table public.content_library_files
  add constraint content_library_files_library_path_sha256_key unique (library, path, sha256);

drop index if exists public.content_library_files_ready_idx;
create index if not exists content_library_files_ready_idx
  on public.content_library_files (library, path, ready_at desc)
  where state = 'ready';

comment on table public.content_library_files is
  'The asset libraries Krish''s machine writes into Drive: makeyourmindup (Krish, 2026-10-06) and Heartside''s social library (Krish, 2026-11-03). Each file sent, its library, and which machine wrote it there. api/library/.';

-- The functions take the library, makeyourmindup when none is given. The old
-- two-argument forms are dropped so a call can never be ambiguous.
drop function if exists public.content_library_pending(text, integer);
drop function if exists public.content_library_record_written(text, jsonb);

create or replace function public.content_library_pending(p_machine_hash text, p_limit integer, p_library text default 'makeyourmindup')
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
      and f.library = coalesce(p_library, 'makeyourmindup')
    order by f.path, f.ready_at desc, f.id
  ),
  last_written as (
    select distinct on (f.path) f.path, f.sha256
    from public.content_library_files as f
    where f.state = 'ready'
      and f.library = coalesce(p_library, 'makeyourmindup')
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

create or replace function public.content_library_record_written(p_machine_hash text, p_items jsonb, p_library text default 'makeyourmindup')
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
    where f.library = coalesce(p_library, 'makeyourmindup')
      and f.path = item.path
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

revoke all on function public.content_library_pending(text, integer, text) from public, anon, authenticated;
revoke all on function public.content_library_record_written(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.content_library_pending(text, integer, text) to service_role;
grant execute on function public.content_library_record_written(text, jsonb, text) to service_role;
