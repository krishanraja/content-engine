-- Manual is his words, validated (step 3 of the design entropy session, PR 8).
--
-- 20261021100000_manual_is_his_words.sql added the CHECK NOT VALID on
-- 2026-10-13: from then on every new or changed content_ideas row had to
-- pass it, but rows already stored were not scanned. This validates it, so
-- the rule holds for every row and the planner can rely on it.
--
-- Read before writing this, 2026-10-20: 0 rows break the rule (the one older
-- manual row carries the exempt ref). No idea was filed through Control
-- Center's door in the week, and 75 ideas from the engine's own sources
-- landed. The engine's request log could not be read from the session that
-- wrote this, so "7 quiet days" rests on the database, not the log. That is
-- safe either way: validating scans stored rows only and changes nothing for
-- any writer, because new rows have been held to the rule since 2026-10-13.
--
-- Ruling (Krish, 2026-10-13): "Go On the backfill, close everything out now to 100%. Merge everything to main."
--
-- Run twice, it changes nothing the second time.

alter table public.content_ideas validate constraint content_ideas_manual_is_his_words;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'content_ideas_manual_is_his_words'
       and conrelid = 'public.content_ideas'::regclass
       and convalidated
  ) then
    raise exception 'manual_is_his_words: the check is not validated';
  end if;
end
$$;
