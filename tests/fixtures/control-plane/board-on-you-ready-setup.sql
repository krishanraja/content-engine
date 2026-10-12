-- The board as it stood on 12 October, for the on_you readiness migration
-- (supabase/migrations/20261013090000_board_on_you_is_ready.sql) on a clean
-- Postgres (CI's control-plane-sql job). The board migrations before it have
-- run; content_ideas is the stand-in from keep-newer-making-setup.sql. The
-- rows that fail are the three live ones, and a take with no piece whose
-- detail is already near the column's limit.

insert into public.content_ideas (id) values
  ('f328382d-71b3-41a7-a221-d8615826f12e'),
  ('904658db-4df2-4537-a0ed-ebe93e081db7')
on conflict (id) do nothing;

insert into public.work_board_items (id, lane, title, detail, only_you, link, closes_on, idea_id, updated_by) values
  -- Ready: they stay on him.
  ('monday-record', 'on_you', 'Record both cuts', 'Your picks are in.', 'face', 'https://web.descript.com/monday', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e', 'claude_code'),
  ('friday-record', 'on_you', 'Record both cuts', 'The line is cut here too.', 'face', 'https://web.descript.com/friday', 'record', '904658db-4df2-4537-a0ed-ebe93e081db7', 'claude_code'),
  ('week-2026-10-19', 'on_you', 'What are we writing about this week?', 'Pick on the week page.', 'judgment', 'https://controlcenter.krishraja.com/#/week', 'week_planned', null, 'control_center_slate'),
  -- Not ready: no close (two), no link and no close, a close with no piece.
  ('you-launch-today', 'on_you', 'Swap the cover', 'Article 1 is done: checked 11 October.', 'login', 'https://claude.ai/artifact/launch', null, null, 'claude_code'),
  ('you-engine-github-key', 'on_you', 'Put a fresh GitHub key in the engine', 'The proof this item waited for came on 10 October and failed.', 'credential', 'https://vercel.com/dashboard', null, null, 'claude_code'),
  ('you-welcome-days', 'on_you', 'Swap two days in the welcome email', '', 'login', null, null, null, 'claude_code'),
  ('take-aaaaaaaaaaaa', 'on_you', 'Which piece and cut is this take?', repeat('x', 1990), null, null, 'record', null, 'runner'),
  -- Not on him: nothing is asked of them.
  ('doing-build', 'in_progress', 'Build the Descript return', 'Agent work.', null, null, null, null, 'codex'),
  ('old-note', 'done', 'Sent', '', null, null, null, null, 'Krish')
on conflict (id) do nothing;
