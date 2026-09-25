-- Follow the Money becomes The Money Trail.
--
-- Krish renamed the money subchannel follow.the.money on 2026-09-25, and the
-- story shape of the same three words had to move so that a brief naming one
-- cannot be read as the other. He approved the rename the same day (proposed
-- as "The money trail"; his answer: "rename to either or").
--
-- As with 2026-08-29-artifact-format-rename.sql, the seed migration
-- 2026-08-27-slate-rulings.sql is NOT edited: it is the record of the verdicts
-- Krish returned. This maps forward, and scripts/check-slate-calibration.ts
-- applies the same rename when it reads the seed.
--
-- Seven slate rulings and two arc cards. Applied 2026-09-25.

update public.content_slate_rulings
   set format = 'The Money Trail'
 where format = 'Follow the Money';

update public.arc_cards
   set format = 'The Money Trail'
 where format = 'Follow the Money';

insert into public.audit_log (event_type, actor, target, details)
values (
  'format_rename',
  'claude',
  'content_slate_rulings.format, arc_cards.format',
  jsonb_build_object(
    'from', 'Follow the Money',
    'to', 'The Money Trail',
    'rows', jsonb_build_object('content_slate_rulings', 7, 'arc_cards', 2),
    'reason', 'follow.the.money is now a subchannel name (Krish, 2026-09-25); the story shape moved so the two cannot be confused',
    'seed_migration_left_intact', '2026-08-27-slate-rulings.sql'
  )::text
);
