-- The research search's filters and other ventures' shelves (OPEN-ITEMS D3, I-30; Ruling, Krish, 2026-11-14).
--
-- research_find (20261202090000) searched Make Your Mind Up only, with no filters, so Control Center's find_research
-- dropped since, kinds and fresh (control-center #862). It now takes them, and a venture:
--   p_since   only what was added on or after this day;
--   p_kinds   only these kinds (research, corpus, note, paste);
--   p_fresh   true: only research added in the last 90 days; false: only older; null: both. Each hit says which.
--             90 days is this search's window until a material carries its own fresh_days (I-16's manifest columns).
--   p_venture null or 'publication': Make Your Mind Up's pieces and days, as before; another slug: that venture's own
--             shelf (venture:<slug>, migration 20261203090000) and nothing else. No venture borrows another's research.
-- research_shelf_size says how many research items a shelf holds, so "0 of 0" (an empty shelf) reads differently from
-- "0 of 412" (nothing relevant). Both read only; they write nothing.

begin;

-- The two-argument form stays as it was, so the route works whichever lands first, the deploy or this migration; this
-- six-argument form takes no defaults, so a call by name always resolves to exactly one of the two.
create or replace function public.research_find(p_query text, p_limit integer, p_since date,
  p_kinds text[], p_fresh boolean, p_venture text)
returns table (
  material_id uuid,
  scope text,
  piece_id uuid,
  piece_title text,
  week date,
  day text,
  kind text,
  role text,
  title text,
  version integer,
  sha256 text,
  bytes bigint,
  added_at timestamptz,
  rank real,
  snippet text,
  venture text,
  fresh boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq
  ),
  latest as (
    select distinct on (m.scope, m.material_key) m.*
    from public.piece_materials m
    where m.storage = 'text'
    order by m.scope, m.material_key, m.version desc
  ),
  research as (
    select l.*
    from latest l
    where l.archived_at is null
      and (l.kind in ('research', 'corpus', 'note', 'paste') or l.role in ('research', 'sources', 'corpus', 'notes'))
      -- One shelf at a time: Make Your Mind Up's pieces and days, or one other venture's own shelf, never both.
      and (case when coalesce(p_venture, 'publication') = 'publication' then l.scope !~ '^venture:' else l.scope = 'venture:' || p_venture end)
      and (p_since is null or l.added_at >= p_since)
      and (p_kinds is null or l.kind = any (p_kinds))
      and (p_fresh is null or (l.added_at >= now() - interval '90 days') = p_fresh)
  ),
  -- The text index finds the matching texts first (material_texts_search); ranking and snippets run on those only.
  matched as (
    select t.sha256
    from public.material_texts t, q
    where numnode(q.tsq) > 0 and to_tsvector('english', left(t.content, 200000)) @@ q.tsq
  ),
  hits as (
    select r.*,
      2 * ts_rank(to_tsvector('english', r.title), q.tsq) as title_rank
    from research r
    cross join q
    where numnode(q.tsq) > 0
      and (r.text_sha256 in (select sha256 from matched) or to_tsvector('english', r.title) @@ q.tsq)
  ),
  ranked as (
    select h.*, t.content,
      h.title_rank + ts_rank(to_tsvector('english', left(t.content, 200000)), (select tsq from q)) as rank
    from hits h
    join public.material_texts t on t.sha256 = h.text_sha256
    order by rank desc, h.added_at desc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  select h.id, h.scope, h.piece_id, c.title, h.week, h.day, h.kind, h.role, h.title, h.version, h.sha256, h.bytes,
    h.added_at, h.rank::real,
    ts_headline('english', left(h.content, 200000), (select tsq from q), 'MaxFragments=2, MaxWords=30, MinWords=12, StartSel=«, StopSel=»'),
    case when h.scope ~ '^venture:' then substr(h.scope, 9) end, h.added_at >= now() - interval '90 days'
  from ranked h
  left join public.content_ideas c on c.id = h.piece_id
  order by h.rank desc, h.added_at desc;
$$;

revoke all on function public.research_find(text, integer, date, text[], boolean, text) from public, anon, authenticated;
grant execute on function public.research_find(text, integer, date, text[], boolean, text) to service_role;

create or replace function public.research_shelf_size(p_venture text) returns bigint
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*) from (
    select distinct on (m.scope, m.material_key) m.*
    from public.piece_materials m
    where m.storage = 'text'
      and (case when coalesce(p_venture, 'publication') = 'publication' then m.scope !~ '^venture:' else m.scope = 'venture:' || p_venture end)
    order by m.scope, m.material_key, m.version desc
  ) l
  where l.archived_at is null
    and (l.kind in ('research', 'corpus', 'note', 'paste') or l.role in ('research', 'sources', 'corpus', 'notes'));
$$;
revoke all on function public.research_shelf_size(text) from public, anon, authenticated;
grant execute on function public.research_shelf_size(text) to service_role;

comment on function public.research_find(text, integer, date, text[], boolean, text) is
  'Read only: research on one shelf matching a query, newest version of each, never archived, with since, kinds and fresh filters (I-16, D3, I-30; GET /api/research-library/find).';

commit;
