-- How Krish wants a saved inspiration file read, and his note to the agent that reads it.
--
-- Krish, 2026-10-24: "I need the link that I can quickly click on and figure out what it is, and perhaps
-- even give instructions to you that it's going to need to be a video that needs to be watched or
-- something like that." The preview frame is one still, so a card can look like nothing; these two
-- columns let him say how it must be read. Both are his words or his tap, set on Control Center's
-- Inspiration page (POST /api/inspiration, action 'instruct'), separate from his answer: saving them
-- does not answer the card, and Undo on an answer leaves them alone. Every reader of a card (the Sunday
-- plan, the style study, the taste ledger) follows them.

alter table public.inspiration_items
  add column read_as text check (read_as is null or read_as in ('watch', 'listen', 'read', 'look')),
  add column note_for_claude text check (note_for_claude is null or char_length(note_for_claude) between 1 and 600),
  add column instructed_at timestamptz;

comment on column public.inspiration_items.read_as is
  'How Krish says the file must be taken in: watch (the whole video, with sound), listen, read, or look (one glance is enough). Set by his tap.';
comment on column public.inspiration_items.note_for_claude is
  'His own note to the agent reading this file, in his words.';
