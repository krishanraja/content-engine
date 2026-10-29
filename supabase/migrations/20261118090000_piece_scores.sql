-- His scores: narrative and production quality out of 10 for every piece (W2.1).
--
-- Krish, 2026-10-29: "backfill every piece we've done historically, and allow me to add a score out of 10 for narrative
-- quality and production quality". Written by the publish board's Scores press (apps/control-plane/api/board/_presses.ts),
-- on each day tab and in the Archive; read by the board's Archive, Control Center's #/week and the retrospective (W3.6).
--
-- Enforced here, not by convention:
--   1. History is kept. A score is never changed or deleted; a new score is a new row, and the latest row for a piece
--      and a basis is its score.
--   2. Only Krish's scores count. scored_by is 'krish' when the board's access-cookie actor pressed it; anything else (a
--      model's guess, labelled 'model:<name>') may be stored for comparison and never counts (counts is computed here).
--   3. A press saved twice files once: client_report_id is the hash of the board week, the document, its revision and
--      the body, so a retried save adds nothing.
--
-- Applied with the Wave 2 migration batch after Krish's yes; never applied by a session on its own.

begin;

create table public.piece_scores (
  id bigint generated always as identity primary key,
  piece_id uuid not null references public.content_ideas (id),
  narrative smallint not null check (narrative between 1 and 10),
  production smallint not null check (production between 1 and 10),
  -- at_publish: scored when it went out; hindsight: scored later, looking back (the backfill).
  basis text not null check (basis in ('at_publish', 'hindsight')),
  scored_by text not null check (scored_by = 'krish' or scored_by ~ '^model:[a-z0-9][a-z0-9._-]{0,59}$'),
  counts boolean generated always as (scored_by = 'krish') stored,
  -- His note, in his words, as he typed it.
  note text check (note is null or char_length(note) <= 4000),
  scored_at timestamptz not null default now(),
  -- Where it was pressed: 'publish board, <week> <document>'.
  said_where text not null check (char_length(btrim(said_where)) between 1 and 300),
  client_report_id text not null unique check (client_report_id ~ '^[a-f0-9]{64}$')
);

create index piece_scores_piece_idx on public.piece_scores (piece_id, basis, scored_at desc);

-- History is kept: no row changes, none goes.
create or replace function public.piece_scores_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'piece_scores: a score is kept as he gave it; a new score is a new row';
end;
$$;

create trigger piece_scores_hold
  before update or delete on public.piece_scores
  for each row execute function public.piece_scores_hold();

-- A piece's score: his latest for each basis. A model's guess never appears here.
create view public.piece_scores_current
with (security_invoker = true)
as
select distinct on (piece_id, basis)
  piece_id, basis, narrative, production, note, scored_at
from public.piece_scores
where counts
order by piece_id, basis, scored_at desc, id desc;

alter table public.piece_scores enable row level security;
revoke all on public.piece_scores, public.piece_scores_current from public, anon, authenticated;
grant select, insert on public.piece_scores to service_role;
grant select on public.piece_scores_current to service_role;

commit;
