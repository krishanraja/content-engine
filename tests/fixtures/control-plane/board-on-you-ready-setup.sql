-- The board as it stood on 12 October, for the on_you readiness migration
-- (supabase/migrations/20261013093000_board_on_you_is_ready.sql) on a clean
-- Postgres (CI's control-plane-sql job). The board migrations before it have
-- run; content_ideas is the stand-in from keep-newer-making-setup.sql. The
-- rows that fail are the four live ones, a take with no piece whose detail is
-- already near the column's limit, the week's close on an item that is not the
-- week's (the route took it before this rule), and an item with everything but
-- a reason only he can do it.

insert into public.content_ideas (id) values
  ('f328382d-71b3-41a7-a221-d8615826f12e'),
  ('904658db-4df2-4537-a0ed-ebe93e081db7')
on conflict (id) do nothing;

insert into public.work_board_items (id, lane, title, detail, only_you, link, closes_on, idea_id, updated_by) values
  -- Ready: they stay on him.
  ('monday-record', 'on_you', 'Record both cuts', 'Your picks are in.', 'face', 'https://web.descript.com/monday', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e', 'claude_code'),
  ('friday-record', 'on_you', 'Record both cuts', 'The line is cut here too.', 'face', 'https://web.descript.com/friday', 'record', '904658db-4df2-4537-a0ed-ebe93e081db7', 'claude_code'),
  ('week-2026-10-19', 'on_you', 'What are we writing about this week?', 'Pick on the week page.', 'judgment', 'https://controlcenter.krishraja.com/#/week', 'week_planned', null, 'control_center_slate'),
  -- Not ready: no close (three), no link and no close, a close with no piece,
  -- the week's close on another item, no reason only he can do it.
  ('week-publish-board-2026-10-12', 'on_you', 'This week''s publish board, 12 to 16 October', 'Done when every day on it is at 100%.', 'post', 'https://claude.ai/artifact/publish-board', null, null, 'claude_code'),
  ('you-launch-today', 'on_you', 'Swap the cover', 'Article 1 is done: checked 11 October.', 'login', 'https://claude.ai/artifact/launch', null, null, 'claude_code'),
  ('you-engine-github-key', 'on_you', 'Put a fresh GitHub key in the engine', 'The proof this item waited for came on 10 October and failed.', 'credential', 'https://vercel.com/dashboard', null, null, 'claude_code'),
  ('you-welcome-days', 'on_you', 'Swap two days in the welcome email', '', 'login', null, null, null, 'claude_code'),
  ('take-aaaaaaaaaaaa', 'on_you', 'Which piece and cut is this take?', repeat('x', 1990), null, null, 'record', null, 'runner'),
  ('plan-week-oct-19', 'on_you', 'Plan the week of 19 October', 'Pick on the week page.', 'judgment', 'https://controlcenter.krishraja.com/#/week', 'week_planned', null, 'claude_code'),
  ('take-ffffffffffff', 'on_you', 'Which cut is the take "IMG_1234.mov"?', 'Tied to Monday by a session.', null, 'https://controlcenter.krishraja.com/#/content?idea=f328382d-71b3-41a7-a221-d8615826f12e', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e', 'runner'),
  -- Not on him: nothing is asked of them.
  ('doing-build', 'in_progress', 'Build the Descript return', 'Agent work.', null, null, null, null, 'codex'),
  ('old-note', 'done', 'Sent', '', null, null, null, null, 'Krish')
on conflict (id) do nothing;
