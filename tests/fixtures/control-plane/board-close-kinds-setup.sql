-- The board after backfill step 1 of step 4, for the close-kind migrations
-- (20261022090000_board_close_columns.sql, 20261022091000_on_you_closes_itself.sql)
-- on a clean Postgres (CI's control-plane-sql job). The board migrations
-- before them and board-on-you-ready-*.sql have run; content_ideas is the
-- stand-in from keep-newer-making-setup.sql. Synthetic rows only: invented
-- ids, titles and links.

insert into public.work_board_items (id, lane, title, detail, only_you, link, closes_on, close_ref, idea_id, updated_by) values
  ('kinds-share-image', 'in_progress', 'Set the share image', 'Synthetic.', 'login', 'https://example.substack.com/publish/post/1', 'share_image_changed',
     '{"url": "https://example.substack.com/p/a-post", "was": "0a1b2c3d-1111-4222-8333-444455556666_1200x800.png"}', null, 'control_center'),
  ('kinds-key', 'in_progress', 'Replace the key, then press Redeploy', 'Synthetic.', 'credential', 'https://vercel.example/dashboard', 'job_ok',
     '{"job": "build_signals", "after": "2026-10-22T09:30:00Z", "probe": "dry"}', null, 'control_center'),
  ('week-publish-board-2026-10-19', 'in_progress', 'This week''s publish board', 'Synthetic.', 'post', 'https://claude.ai/artifact/synthetic-board', 'week_published', '{}', null, 'control_center'),
  ('kinds-welcome', 'in_progress', 'Swap two days in the welcome email', 'Synthetic.', 'login', 'https://example.substack.com/publish/settings', 'his_word', '{}', null, 'control_center'),
  ('kinds-session', 'in_progress', 'Session work', 'Synthetic.', null, null, 'session', '{}', null, 'control_center'),
  ('post-9001', 'in_progress', 'Which piece is this post?', 'Synthetic.', null, 'https://example.substack.com/p/unmatched', 'post_matched', '{"url": "https://example.substack.com/p/unmatched"}', null, 'engine: publish watcher'),
  ('take-0123456789ab', 'in_progress', 'Which piece and cut is this take?', 'Synthetic.', null, null, 'take_placed', '{}', null, 'runner'),
  ('kinds-closed', 'done', 'Closed by a check', 'Synthetic.', null, null, 'session', '{}', null, 'done_check')
on conflict (id) do nothing;

update public.work_board_items set closed_by = 'check: session', closed_proof = 'No session touched it for 7 days.' where id = 'kinds-closed';
