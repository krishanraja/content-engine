-- The making record is never put back by a stale copy of a piece's meta.
--
-- Most content-engine routes read a piece's row, call a model for 20 to 60
-- seconds, then write the whole of meta back: chat, revise, challenge,
-- dive-deeper, score, materials, the fact check and others. Meanwhile the
-- making route (apps/control-plane/api/content-ideas/[id]/making.ts) may
-- write meta.making, guarded on the row's updated_at: a take the recordings
-- lane placed, a script check, a pack. A route that then wrote its stale
-- meta used to put back the older making record, and the take was gone with
-- no error and no log (docs/CADENCE.md, misread 9; the second reviewer of
-- the video build, 2026-10-12).
--
-- This trigger keeps the newer record, whoever writes meta: an update whose
-- meta.making is not newer than the stored one (its updated_at is not later)
-- keeps the stored one, and an update that drops meta.making keeps it too.
-- The making route and the publish watcher stamp every new record later than
-- the last (apps/control-plane/api/_making.ts, makingStamp), so their writes
-- always land. Every other key of meta is written as sent.
--
-- Idempotent; additive; applied through Supabase MCP apply_migration.

create or replace function public.content_ideas_keep_newer_making()
returns trigger
language plpgsql
as $$
declare
  stored jsonb := case when jsonb_typeof(old.meta) = 'object' then old.meta -> 'making' end;
  incoming jsonb := case when jsonb_typeof(new.meta) = 'object' then new.meta -> 'making' end;
  newer boolean;
begin
  if stored is null or jsonb_typeof(stored) <> 'object' then
    return new;
  end if;
  if incoming is null or jsonb_typeof(incoming) <> 'object' then
    new.meta := (case when jsonb_typeof(new.meta) = 'object' then new.meta else '{}'::jsonb end) || jsonb_build_object('making', stored);
    return new;
  end if;
  if incoming = stored then
    return new;
  end if;
  begin
    newer := (incoming ->> 'updated_at')::timestamptz > (stored ->> 'updated_at')::timestamptz;
  exception when others then
    newer := coalesce(incoming ->> 'updated_at', '') > coalesce(stored ->> 'updated_at', '');
  end;
  if not coalesce(newer, false) then
    new.meta := jsonb_set(new.meta, '{making}', stored);
  end if;
  return new;
end
$$;

drop trigger if exists content_ideas_keep_newer_making on public.content_ideas;
create trigger content_ideas_keep_newer_making
  before update of meta on public.content_ideas
  for each row execute function public.content_ideas_keep_newer_making();
