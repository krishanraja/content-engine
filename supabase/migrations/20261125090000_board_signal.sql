-- The live board's one change signal (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a
-- read-only archive). Control Centre's Publish Board reads GET /api/board/<Monday>/view; until now only a change to
-- content_ideas told it to read again, and everything else waited for its 15-second poll. Every write the view reads
-- now bumps one row per week, board_signal, which Control Centre hears over Supabase realtime and reads the view again
-- at once (the ETag keeps an unchanged read a 304).
--
-- Additive and reversible: a new table, a function, four triggers and a realtime publication entry. Nothing existing
-- changes shape. A signal that cannot be written never blocks the write it signals (every trigger swallows its own
-- error), so a fault here can only make the board slower, never lose a press or a piece.
--
-- Undo: drop trigger board_signal_documents on board_documents; drop trigger board_signal_ticks on board_ticks;
-- drop trigger board_signal_weeks on board_weeks; drop trigger board_signal_pieces on content_ideas;
-- drop function board_signal_row(); drop function board_signal_piece(); drop function board_signal_bump(date, text);
-- alter publication supabase_realtime drop table board_signal; drop table board_signal.

create table if not exists public.board_signal (
  week date primary key,
  revision bigint not null default 1,
  changed_at timestamptz not null default now(),
  -- What changed last, as one word (picks, queue, comments, ticks, build, piece, plan): never a body, a name or a link.
  source text not null default ''
);

alter table public.board_signal enable row level security;
-- The signal says only that a week changed and when: the board's realtime listener reads it on the public key.
drop policy if exists board_signal_read on public.board_signal;
create policy board_signal_read on public.board_signal for select to anon, authenticated using (true);
revoke all on public.board_signal from anon, authenticated;
grant select on public.board_signal to anon, authenticated;
grant select, insert, update on public.board_signal to service_role;

-- One bump for one week. Security definer so a trigger fired by any writer can record it; it writes only this table.
create or replace function public.board_signal_bump(p_week date, p_source text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare next_revision bigint;
begin
  if p_week is null then return null; end if;
  insert into board_signal (week, revision, changed_at, source)
    values (p_week, 1, now(), left(coalesce(p_source, ''), 40))
  on conflict (week) do update set revision = board_signal.revision + 1, changed_at = now(), source = excluded.source
  returning revision into next_revision;
  -- The same signal for a listener on the database itself (delivered at commit; the latency test listens here).
  perform pg_notify('board_signal', p_week::text || ':' || next_revision::text);
  return next_revision;
end $$;
revoke all on function public.board_signal_bump(date, text) from public, anon, authenticated;
grant execute on function public.board_signal_bump(date, text) to service_role;

-- board_documents, board_ticks and board_weeks carry their week.
-- Each table's field is read only in its own branch: a record has no field another table has.
create or replace function public.board_signal_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare src text;
begin
  begin
    if tg_table_name = 'board_documents' then src := coalesce(new.collection, old.collection);
    elsif tg_table_name = 'board_ticks' then src := 'ticks';
    else src := 'build';
    end if;
    perform board_signal_bump(coalesce(new.week, old.week), src);
  exception when others then null;
  end;
  return null;
end $$;

-- A piece is in the week of its scheduled date (the Monday on or before it); a move between weeks signals both.
create or replace function public.board_signal_piece() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare a date; b date;
begin
  begin
    if tg_op <> 'INSERT' and old.scheduled_for is not null then a := old.scheduled_for::date - (extract(isodow from old.scheduled_for::date)::int - 1); end if;
    if tg_op <> 'DELETE' and new.scheduled_for is not null then b := new.scheduled_for::date - (extract(isodow from new.scheduled_for::date)::int - 1); end if;
    if a is not null then perform board_signal_bump(a, 'piece'); end if;
    if b is not null and b is distinct from a then perform board_signal_bump(b, 'piece'); end if;
  exception when others then null;
  end;
  return null;
end $$;

drop trigger if exists board_signal_documents on public.board_documents;
create trigger board_signal_documents after insert or update or delete on public.board_documents
  for each row execute function public.board_signal_row();
drop trigger if exists board_signal_ticks on public.board_ticks;
create trigger board_signal_ticks after insert or update or delete on public.board_ticks
  for each row execute function public.board_signal_row();
drop trigger if exists board_signal_weeks on public.board_weeks;
create trigger board_signal_weeks after insert or update on public.board_weeks
  for each row execute function public.board_signal_row();
drop trigger if exists board_signal_pieces on public.content_ideas;
create trigger board_signal_pieces after insert or update or delete on public.content_ideas
  for each row execute function public.board_signal_piece();

-- Realtime: Control Centre's board listens for this table's changes (src/surfaces/content/board/useBoard.ts).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_signal') then
    alter publication supabase_realtime add table public.board_signal;
  end if;
end $$;
