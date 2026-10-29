-- "Say it" ideas become Inspiration cards (W3.2).
--
-- Krish, 2026-10-29: yes to an inspiration_items migration so that the ideas he says in Control Center's Say it door
-- become cards beside the ones he drops in Drive (docs/plans/2026-11-14-wave-3.md, W3.2: "his inputs become
-- inspirationhouse cards: the Inspiration Drive tree, links pasted in Control Center, and 'Say it' ideas").
--
-- A card now has one source: a Drive file (drive_file_id and folder, as before) or one said part (said_part_id, the
-- said_parts row Control Center's api/_sayRun.ts files). Enforced here, not by convention:
--   1. One card per said idea. said_part_id is unique, and the card is made by a trigger the moment a said part of
--      kind 'idea' is filed, so no route can forget it or file it twice.
--   2. His words stay his. The card keeps the excerpt and its title exactly as said_parts holds them, in
--      facets.said; nothing here rewrites them. The card is kind 'idea', kind_source 'rule' (the door proves it).
--   3. Nothing is deleted. A said part that has a card cannot be deleted (on delete restrict).
--   4. A guess stays a guess. The card arrives unanswered, like a Drive card: silence is not feedback.
-- drive_created_at is when he dropped it; for a said card, when he said it (said_parts.created_at), so the open
-- cards keep one order.
--
-- Applied with a migration batch after Krish's yes; never applied by a session on its own.

begin;

alter table public.inspiration_items
  alter column drive_file_id drop not null,
  alter column folder drop not null,
  add column said_part_id uuid unique references public.said_parts (id) on delete restrict;

alter table public.inspiration_items
  add constraint inspiration_items_one_source check (
    (drive_file_id is not null and folder is not null and said_part_id is null)
    or (said_part_id is not null and drive_file_id is null and folder is null)),
  add constraint inspiration_items_said_is_idea check (
    said_part_id is null or (kind = 'idea' and kind_source = 'rule'));

create function public.inspiration_card_from_said() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.kind = 'idea' then
    insert into public.inspiration_items
      (said_part_id, lane, name, mime, drive_created_at, kind, kind_source, facets)
    values
      (new.id, 'strategy', left(new.title, 300), 'text/plain', new.created_at, 'idea', 'rule',
       jsonb_build_object('said', jsonb_strip_nulls(jsonb_build_object(
         'title', new.title, 'excerpt', new.excerpt, 'about', new.about,
         'landed_table', new.landed_table, 'landed_id', new.landed_id))))
    on conflict (said_part_id) do nothing;
  end if;
  return new;
end $$;

revoke all on function public.inspiration_card_from_said() from public, anon, authenticated;

-- An idea can be filed as one, or re-read into one later (kind is settled after the read).
create trigger said_parts_idea_card
  after insert or update of kind on public.said_parts
  for each row execute function public.inspiration_card_from_said();

-- The ideas he has already said.
insert into public.inspiration_items (said_part_id, lane, name, mime, drive_created_at, kind, kind_source, facets)
select s.id, 'strategy', left(s.title, 300), 'text/plain', s.created_at, 'idea', 'rule',
       jsonb_build_object('said', jsonb_strip_nulls(jsonb_build_object(
         'title', s.title, 'excerpt', s.excerpt, 'about', s.about,
         'landed_table', s.landed_table, 'landed_id', s.landed_id)))
from public.said_parts s
where s.kind = 'idea'
on conflict (said_part_id) do nothing;

commit;
