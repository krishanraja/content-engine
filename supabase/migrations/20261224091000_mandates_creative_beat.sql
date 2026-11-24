-- NOT APPLIED. Applying this migration waits on Krish's yes; until then the
-- mandates are unchanged and the beat lives in config/beat.json and the code
-- that reads it.
--
-- The three mandates name the beat.
--
-- Ruling (Krish, 2026-11-24): the engine brings stories in his focus sectors
-- (media, entertainment, content, arts, music, creator tech, with the economics
-- of AI inside them) and not governance, regulation, security or data
-- breaches. His words, 2026-11-24 20:18Z: "we can still keep a focus on the
-- economics of AI but in these focus sectors". The model piece is "a Reiki
-- master wrote a UK number two" (content_ideas 36886e0b, 11 Nov 2026): a hit
-- traced back to the people and tools behind it, money included.
--
-- Appends one sentence block to each live mandate, once (modelled on
-- 20261002090000_mandates_dated_prediction.sql). The mandates stay in the
-- database only (AGENTS.md, "The mandate is the test"): this file carries the
-- added text and nothing else. Each mandate is a single paragraph, so the
-- addition joins it with a space. Re-running it changes nothing: each update
-- skips a mandate that already says THE BEAT:.
update public.venture_formats
set mandate = mandate || ' THE BEAT: who gets paid when AI helps make creative work, in music, film and TV, games, art and design, theatre, media and creator tech: the money behind the hit, the royalty, the licence and the tool. Not governance, regulation, security or data breaches.',
    updated_at = now()
where slug = 'follow_the_money'
  and position('THE BEAT:' in mandate) = 0;

update public.venture_formats
set mandate = mandate || ' THE BEAT: one creative tool or one finished work taken apart, a song, a film, a game, a design or a creator''s channel, to show how AI was used to make it and what that changed. Not governance, regulation, security or data breaches.',
    updated_at = now()
where slug = 'under_the_hood'
  and position('THE BEAT:' in mandate) = 0;

update public.venture_formats
set mandate = mandate || ' THE BEAT: the gap between what makers, performers and creators are promised about AI and what the record shows, in their earnings, their audiences and their work. Not governance, regulation, security or data breaches.',
    updated_at = now()
where slug = 'mind_the_gap'
  and position('THE BEAT:' in mandate) = 0;
