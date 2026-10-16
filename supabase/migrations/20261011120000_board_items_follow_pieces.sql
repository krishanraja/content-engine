-- Board items follow the piece they are about.
--
-- Krish, 2026-10-11: "we still have things on my control center board from
-- Wednesday that should really be chalked off automatically when we are done
-- with a publish flow". Until now a board item was free text: nothing tied it
-- to a piece, so nothing could close it when the piece went out.
--
-- idea_id    the content_ideas row the item is about, when it is about one.
-- closes_on  the making step whose completion closes the item (the step keys
--            in apps/control-plane/api/_making.ts), or 'published'. Every item
--            tied to a piece closes when the piece is published, and is
--            archived when the piece is dropped, whatever closes_on says.
--
-- The engine closes them (apps/control-plane/api/_boardClose.ts): on every
-- making record write, and on the publish watcher's hourly pass.
-- Idempotent; additive; applied through Supabase MCP apply_migration.

alter table public.work_board_items
  add column if not exists idea_id uuid references public.content_ideas(id) on delete set null,
  add column if not exists closes_on text;

do $$ begin
  alter table public.work_board_items
    add constraint work_board_items_closes_on_check
    check (closes_on is null or closes_on in ('workroom','draft','visual_gate','scripts','pack','record','video','publish','published'));
exception when duplicate_object then null; end $$;

create index if not exists work_board_items_open_idea_idx
  on public.work_board_items (idea_id) where lane in ('on_you', 'in_progress') and idea_id is not null;
