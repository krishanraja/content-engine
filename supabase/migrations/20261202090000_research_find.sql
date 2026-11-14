-- Research found before it is paid for (I-16, 14 Nov 2026).
--
-- Every piece's research is already in the piece materials store, kept by its sha256 and mirrored to
-- makeyourmindup > 6 Research library (docs/DRIVE.md, "The research library"). Krish, 2026-11-11: "one of the most
-- important prospects that we have over time is connecting the dots on historical data." Until now nothing could ask
-- the store "what do we already hold on this?", so a session paid for a web search, an Apify run or a research call to
-- find what an earlier piece had already found. research_find answers that, read only, from the same materials the
-- library mirrors: the newest version of each text material whose kind is research, corpus, note or paste, or whose
-- role is research, sources, corpus or notes, never an archived one, ranked by English full text over its title and
-- its first 200,000 characters. GET /api/research-library/find calls it (api/research-library/find.ts).
--
-- It writes nothing. A file kept in the bucket (a PDF, a screenshot) is not searched: only its title is, through the
-- text materials beside it.

create index if not exists material_texts_search
  on public.material_texts using gin (to_tsvector('english', left(content, 200000)));

create or replace function public.research_find(p_query text, p_limit integer default 10)
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
  snippet text
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
    ts_headline('english', left(h.content, 200000), (select tsq from q), 'MaxFragments=2, MaxWords=30, MinWords=12, StartSel=«, StopSel=»')
  from ranked h
  left join public.content_ideas c on c.id = h.piece_id
  order by h.rank desc, h.added_at desc;
$$;

revoke all on function public.research_find(text, integer) from public, anon, authenticated;
grant execute on function public.research_find(text, integer) to service_role;

comment on function public.research_find(text, integer) is
  'Read only: the research the piece materials store already holds that matches a query, newest version of each, never archived (I-16; GET /api/research-library/find).';
