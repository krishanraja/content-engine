-- Growth's posting record on each off-day item (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day").
--
-- Growth makes, schedules and posts the off-day posts, and until now could not say so on the board: its write-back
-- (POST /api/board/<Monday>/posted) takes only a day that has a piece, and an off-day post has none, so Tue 10 Nov's
-- carousel went out on six channels and the board still said "With Growth". Growth now writes back to the one place the
-- item's day lives (POST /api/board/<Monday>/offday-posts): made, scheduled with its time, live with its link, from its
-- own posting record, and never anything live it did not post. The column 20261129090000 named `scheduled` holds all of
-- it, so it is named for what it holds: `posts`. Nothing read it under its old name.
--
-- Re-runnable. Undo: alter table offday_items rename column posts to scheduled.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offday_items' and column_name = 'scheduled')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offday_items' and column_name = 'posts') then
    alter table public.offday_items rename column scheduled to posts;
  end if;
end $$;
comment on column public.offday_items.posts is
  'Growth''s posting record for the item, as Growth reports it from its own record: [{state: made|scheduled|live|cancelled, channel, due_at, url, at, buffer_post_id}]. Written only by POST /api/board/<Monday>/offday-posts on Growth''s key.';
