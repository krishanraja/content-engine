-- The board after both backfill steps of step 4, for the one-closer
-- migration (supabase/migrations/20261023090000_one_closer.sql) on a clean
-- Postgres (CI's control-plane-sql job). The board migrations before it and
-- board-close-kinds-*.sql have run; content_ideas is the stand-in from
-- keep-newer-making-setup.sql. Synthetic rows only: invented ids, titles and
-- links.

-- The backfill: every open item says how it ends. One that said nothing, or
-- whose kind lacked what it needs, became session work.
update public.work_board_items set closes_on = 'session', close_ref = '{}'
  where lane in ('on_you', 'in_progress')
    and (closes_on is null or not public.board_close_ref_ok(closes_on, close_ref, idea_id, id));

insert into public.content_ideas (id) values ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c11') on conflict (id) do nothing;

insert into public.work_board_items (id, lane, title, detail, only_you, link, closes_on, close_ref, idea_id, updated_by) values
  ('closer-record', 'on_you', 'Record both cuts', 'Synthetic.', 'face', 'https://example.com/scripts', 'record', '{}', '6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c11', 'claude_code'),
  ('closer-publish', 'in_progress', 'Repost the piece', 'Synthetic.', null, null, 'publish', '{}', '6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c11', 'claude_code'),
  ('closer-session-a', 'in_progress', 'A session''s own work', 'Synthetic.', null, null, 'session', '{}', null, 'codex'),
  ('closer-session-b', 'in_progress', 'Another session''s own work', 'Synthetic.', null, null, 'session', '{}', null, 'claude_ai'),
  ('closer-image', 'in_progress', 'Set the share image', 'Synthetic.', 'login', 'https://example.com/settings', 'share_image_changed',
     '{"url": "https://example.com/p/a-post", "was": "0a1b2c3d-1111-4222-8333-444455556666_1200x800.png"}', null, 'control_center'),
  ('closer-word', 'in_progress', 'Swap two days in the welcome email', 'Synthetic.', 'login', 'https://example.com/welcome', 'his_word', '{}', null, 'control_center')
on conflict (id) do nothing;

-- What the re-created stale archive reads, beside the stand-in's columns.
alter table public.content_ideas
  add column if not exists idea text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists state_changed_at timestamptz,
  add column if not exists buried_at timestamptz,
  add column if not exists buried_reason text,
  add column if not exists shift_id uuid,
  add column if not exists library_at timestamptz,
  add column if not exists protected_at timestamptz,
  add column if not exists scheduled_for date;
create table if not exists public.system_config (key text primary key, value text);

insert into public.content_ideas (id, idea, state, state_changed_at) values
  ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c21', 'A piece in its draft, idle a month', 'drafting', now() - interval '30 days'),
  ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c22', 'A piece in review, idle a month', 'review', now() - interval '30 days'),
  ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c23', 'An approved piece, idle a month', 'approved', now() - interval '30 days'),
  ('6b3c0a51-2f0e-4d8a-9c41-7e2d5b9a0c24', 'A seed, idle a month', 'seeded', now() - interval '30 days')
on conflict (id) do nothing;
