-- Board sessions and the piece materials store (2026-11-11).
--
-- Krish, 2026-11-11: "If I copy a Claude prompt out of the content publish board ... that session should automatically
-- update the board once it's done or as it's going. This system should be immune from multiple sessions working on
-- stuff simultaneously and should have a rock-hard repository for everything it's drawing on. ... if I put a screenshot
-- in as inspiration for that day or if I put a research corpus in as supporting material, that should never be lost
-- again. Even if I ran four separate sessions on one piece of content, it would know where everything was."
--
-- Additive only: four new tables, their guards, five functions and one AFTER trigger on content_ideas. Nothing existing
-- changes shape. Reversible: drop the trigger content_ideas_capture_materials, the functions and the tables.
--
--   material_texts        text bytes by their sha256 (content addressed; the hash is checked by the database)
--   piece_materials       one row per version of one material of a piece (or of a day with no piece yet): a text in
--                         material_texts, a file in the content-library bucket at files/<sha256>.<ext>, or a link.
--                         Never deleted: archive only. Versions of one material_key are kept side by side.
--   board_session_events  what each session reported, append only, idempotent on event_key. A session's presence is
--                         read from its events (its latest lease_until), so nothing is ever updated in place.
--   board_piece_fields    a value a session sets on a piece, one row per revision: a write names the revision it read
--                         and is refused when another landed first (mode set), or merged onto it (mode append).
--
-- And content_ideas.meta.materials (the drafting working set every writer already uses) is captured into the store by
-- a trigger whenever it changes, so a material trimmed from the working set, a DELETE on the old route, or a lost
-- read-modify-write race never loses it. docs/PUBLISH_BOARDS.md, "Sessions and materials".

create table if not exists public.material_texts (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  content text not null,
  bytes integer not null,
  created_at timestamptz not null default now(),
  constraint material_texts_addressed check (sha256 = encode(sha256(convert_to(content, 'UTF8')), 'hex')),
  constraint material_texts_size check (bytes = octet_length(convert_to(content, 'UTF8')) and bytes <= 2000000)
);

create table if not exists public.piece_materials (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|day:\d{4}-\d{2}-\d{2}/(mon|tue|wed|thu|fri|sat|sun|week))$'),
  piece_id uuid,
  week date,
  day text check (day is null or day in ('mon','tue','wed','thu','fri','sat','sun')),
  material_key text not null check (char_length(material_key) between 1 and 200),
  version integer not null check (version >= 1),
  kind text not null check (kind in ('screenshot','image','pdf','corpus','research','paste','link','file','output','storyboard','note','video','audio','other')),
  role text check (role is null or role ~ '^[a-z][a-z_]{0,40}$'),
  title text not null check (char_length(title) between 1 and 300),
  note text check (note is null or char_length(note) <= 2000),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bigint not null check (bytes >= 0),
  content_type text check (content_type is null or char_length(content_type) <= 120),
  storage text not null check (storage in ('text','bucket','link')),
  text_sha256 text references public.material_texts(sha256),
  object_key text check (object_key is null or object_key ~ '^files/[a-f0-9]{64}\.[a-z0-9]{1,8}$'),
  url text check (url is null or (url ~ '^https?://' and char_length(url) <= 2000)),
  source text not null check (source in ('meta.materials','upload','session','board','control_center','backfill','repo')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 500),
  added_by text not null check (char_length(added_by) between 1 and 80),
  session_id text,
  added_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by text,
  archive_reason text check (archive_reason is null or char_length(archive_reason) <= 500),
  constraint piece_materials_has_scope check (piece_id is not null or week is not null),
  constraint piece_materials_text check ((storage = 'text') = (text_sha256 is not null) and (text_sha256 is null or text_sha256 = sha256)),
  constraint piece_materials_bucket check ((storage = 'bucket') = (object_key is not null)),
  constraint piece_materials_link check (storage <> 'link' or url is not null),
  constraint piece_materials_version unique (scope, material_key, version),
  constraint piece_materials_same_bytes unique (scope, material_key, sha256)
);
create index if not exists piece_materials_piece on public.piece_materials (piece_id, added_at desc);
create index if not exists piece_materials_week on public.piece_materials (week, day);

create table if not exists public.board_session_events (
  id bigint generated always as identity primary key,
  event_key text not null unique check (event_key ~ '^[a-f0-9]{64}$'),
  scope text not null,
  piece_id uuid,
  week date not null,
  day text check (day is null or day in ('mon','tue','wed','thu','fri','sat','sun')),
  session_id text not null check (session_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{3,79}$'),
  surface text check (surface is null or char_length(surface) <= 40),
  label text check (label is null or char_length(label) <= 120),
  kind text not null check (kind in ('start','progress','heartbeat','done','end','blocked')),
  step text check (step is null or char_length(step) <= 60),
  summary text check (summary is null or char_length(summary) <= 600),
  detail jsonb check (detail is null or octet_length(detail::text) <= 16000),
  fields jsonb,
  lease_until timestamptz not null,
  actor text not null check (char_length(actor) between 1 and 80),
  at timestamptz not null default now()
);
create index if not exists board_session_events_scope on public.board_session_events (scope, at desc);
create index if not exists board_session_events_piece on public.board_session_events (piece_id, at desc);
create index if not exists board_session_events_week on public.board_session_events (week, at desc);

create table if not exists public.board_piece_fields (
  id bigint generated always as identity primary key,
  scope text not null,
  piece_id uuid,
  week date not null,
  day text,
  name text not null check (name ~ '^[a-z][a-z0-9_.-]{0,59}$'),
  revision integer not null check (revision >= 1),
  value jsonb not null check (octet_length(value::text) <= 16000),
  session_id text,
  actor text not null,
  at timestamptz not null default now(),
  constraint board_piece_fields_revision unique (scope, name, revision)
);

-- ── nothing is removed ────────────────────────────────────────────────────────────────────────────────────────────

create or replace function public.board_store_refuse() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception '% is append only: nothing in it is changed or removed (docs/PUBLISH_BOARDS.md, Sessions and materials)', tg_table_name
    using errcode = 'P0001';
end $$;

create or replace function public.piece_materials_archive_only() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - array['archived_at','archived_by','archive_reason']) is distinct from (to_jsonb(old) - array['archived_at','archived_by','archive_reason']) then
    raise exception 'piece_materials keeps every version: only archived_at, archived_by and archive_reason change' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['material_texts','board_session_events','board_piece_fields'] loop
    execute format('drop trigger if exists %1$s_no_update on public.%1$s', t);
    execute format('create trigger %1$s_no_update before update or delete on public.%1$s for each row execute function public.board_store_refuse()', t);
  end loop;
  foreach t in array array['material_texts','piece_materials','board_session_events','board_piece_fields'] loop
    execute format('drop trigger if exists %1$s_no_truncate on public.%1$s', t);
    execute format('create trigger %1$s_no_truncate before truncate on public.%1$s for each statement execute function public.board_store_refuse()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert on public.%I to service_role', t);
  end loop;
end $$;
drop trigger if exists piece_materials_no_delete on public.piece_materials;
create trigger piece_materials_no_delete before delete on public.piece_materials for each row execute function public.board_store_refuse();
drop trigger if exists piece_materials_archive_only on public.piece_materials;
create trigger piece_materials_archive_only before update on public.piece_materials for each row execute function public.piece_materials_archive_only();
grant update (archived_at, archived_by, archive_reason) on public.piece_materials to service_role;
grant usage on sequence public.board_session_events_id_seq, public.board_piece_fields_id_seq to service_role;

-- ── where a write lands ───────────────────────────────────────────────────────────────────────────────────────────

-- The scope of a write: a piece (its week and day from scheduled_for), or a day of a week with no piece yet.
create or replace function public.board_scope_of(p_piece uuid, p_week date, p_day text,
  out scope text, out piece_id uuid, out week date, out day text, out error text)
language plpgsql stable set search_path = public, pg_temp as $$
declare v_date date; v_found boolean;
begin
  if p_piece is not null then
    select c.scheduled_for, true into v_date, v_found from public.content_ideas c where c.id = p_piece;
    if not coalesce(v_found, false) then error := 'piece_not_found'; return; end if;
    scope := p_piece::text; piece_id := p_piece;
    week := coalesce(date_trunc('week', v_date)::date, p_week);
    day := case when v_date is null then p_day else (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from v_date)::int] end;
    return;
  end if;
  if p_week is null or extract(isodow from p_week) <> 1 then error := 'invalid_week'; return; end if;
  if p_day is not null and p_day not in ('mon','tue','wed','thu','fri','sat','sun') then error := 'invalid_day'; return; end if;
  scope := 'day:' || to_char(p_week, 'YYYY-MM-DD') || '/' || coalesce(p_day, 'week');
  week := p_week; day := p_day;
end $$;

-- ── materials ─────────────────────────────────────────────────────────────────────────────────────────────────────

-- One material added: idempotent on the same bytes under the same key, a new version otherwise. p_base_version, when
-- given, is the version the writer read: another version landing first refuses the write (version_conflict).
create or replace function public.board_material_put(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s record; v_storage text := coalesce(p->>'storage', 'text'); v_content text := p->>'content'; v_url text := nullif(p->>'url', '');
  v_sha text; v_bytes bigint; v_key text; v_cur integer; v_row public.piece_materials; v_base integer;
begin
  select * into s from public.board_scope_of(nullif(p->>'piece_id','')::uuid, nullif(p->>'week','')::date, nullif(p->>'day',''));
  if s.error is not null then return jsonb_build_object('ok', false, 'error', s.error); end if;
  if v_storage = 'text' then
    if v_content is null or btrim(v_content) = '' then return jsonb_build_object('ok', false, 'error', 'empty_material'); end if;
    v_sha := encode(sha256(convert_to(v_content, 'UTF8')), 'hex');
    v_bytes := octet_length(convert_to(v_content, 'UTF8'));
    if v_bytes > 2000000 then return jsonb_build_object('ok', false, 'error', 'material_too_large'); end if;
    insert into public.material_texts (sha256, content, bytes) values (v_sha, v_content, v_bytes) on conflict (sha256) do nothing;
  elsif v_storage = 'link' then
    if v_url is null or v_url !~ '^https?://' then return jsonb_build_object('ok', false, 'error', 'invalid_url'); end if;
    v_sha := encode(sha256(convert_to(v_url, 'UTF8')), 'hex'); v_bytes := octet_length(v_url);
  elsif v_storage = 'bucket' then
    v_sha := p->>'sha256'; v_bytes := (p->>'bytes')::bigint;
    if v_sha is null or v_sha !~ '^[a-f0-9]{64}$' or coalesce(p->>'object_key', '') !~ ('^files/' || v_sha || '\.[a-z0-9]{1,8}$') then
      return jsonb_build_object('ok', false, 'error', 'invalid_file');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_storage');
  end if;
  if p ? 'sha256' and v_storage <> 'bucket' and p->>'sha256' is distinct from v_sha then return jsonb_build_object('ok', false, 'error', 'sha256_mismatch'); end if;
  v_key := coalesce(nullif(p->>'material_key', ''), 'sha:' || v_sha);
  -- One writer at a time per material key, so versions are numbered in order; other keys never wait.
  perform pg_advisory_xact_lock(hashtextextended('piece_materials/' || s.scope || '/' || v_key, 0));
  select * into v_row from public.piece_materials m where m.scope = s.scope and m.material_key = v_key and m.sha256 = v_sha;
  if found then return jsonb_build_object('ok', true, 'duplicate', true, 'material', to_jsonb(v_row)); end if;
  select max(m.version) into v_cur from public.piece_materials m where m.scope = s.scope and m.material_key = v_key;
  v_base := coalesce(nullif(p->>'base_version', '')::integer, 0);
  if p ? 'base_version' and v_base is distinct from coalesce(v_cur, 0) then
    select * into v_row from public.piece_materials m where m.scope = s.scope and m.material_key = v_key order by m.version desc limit 1;
    return jsonb_build_object('ok', false, 'error', 'version_conflict', 'current', to_jsonb(v_row));
  end if;
  insert into public.piece_materials (scope, piece_id, week, day, material_key, version, kind, role, title, note, sha256, bytes,
    content_type, storage, text_sha256, object_key, url, source, source_ref, added_by, session_id, added_at)
  values (s.scope, s.piece_id, s.week, s.day, v_key, coalesce(v_cur, 0) + 1, coalesce(nullif(p->>'kind', ''), 'other'),
    nullif(p->>'role', ''), left(coalesce(nullif(btrim(p->>'title'), ''), 'Untitled'), 300), nullif(left(p->>'note', 2000), ''),
    v_sha, v_bytes, nullif(p->>'content_type', ''), v_storage, case when v_storage = 'text' then v_sha end,
    case when v_storage = 'bucket' then p->>'object_key' end, v_url, coalesce(nullif(p->>'source', ''), 'session'),
    nullif(left(p->>'source_ref', 500), ''), left(coalesce(nullif(p->>'added_by', ''), 'unknown'), 80), nullif(p->>'session_id', ''),
    coalesce(nullif(p->>'added_at', '')::timestamptz, now()))
  returning * into v_row;
  return jsonb_build_object('ok', true, 'duplicate', false, 'material', to_jsonb(v_row));
end $$;

-- Archive one material (it stays readable; listings leave it out unless asked). Nothing is ever deleted.
create or replace function public.board_material_archive(p_id uuid, p_by text, p_reason text) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_row public.piece_materials;
begin
  update public.piece_materials set archived_at = now(), archived_by = left(coalesce(p_by, 'unknown'), 80), archive_reason = left(p_reason, 500)
    where id = p_id and archived_at is null returning * into v_row;
  if not found then
    select * into v_row from public.piece_materials where id = p_id;
    if not found then return jsonb_build_object('ok', false, 'error', 'material_not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'material', to_jsonb(v_row));
end $$;

-- Every material on a piece's working set (content_ideas.meta.materials) into the store, keyed meta:<its id>.
-- Idempotent: what is already there is a duplicate, a changed text is a new version.
create or replace function public.board_capture_materials(p_piece uuid, p_materials jsonb, p_source text default 'meta.materials') returns integer
language plpgsql security invoker set search_path = public, pg_temp as $$
declare m jsonb; v_url text; v_text text; v_n integer := 0; r jsonb; v_at timestamptz;
begin
  if p_materials is null or jsonb_typeof(p_materials) <> 'array' then return 0; end if;
  for m in select x from jsonb_array_elements(p_materials) x where jsonb_typeof(x) = 'object' loop
    v_url := nullif(m->>'url', ''); v_text := m->>'content';
    begin v_at := (m->>'at')::timestamptz; exception when others then v_at := null; end;
    r := public.board_material_put(jsonb_build_object(
      'piece_id', p_piece,
      'material_key', 'meta:' || coalesce(nullif(m->>'id', ''), md5(m::text)),
      'storage', case when coalesce(btrim(v_text), '') <> '' then 'text' else 'link' end,
      'content', case when coalesce(btrim(v_text), '') <> '' then v_text end,
      'url', case when v_url ~ '^https?://' then v_url end,
      'kind', case when m->>'store_kind' in ('screenshot','image','pdf','corpus','research','paste','link','file','output','storyboard','note','video','audio','other') then m->>'store_kind'
        when m->>'kind' in ('paste','link','file','research') then m->>'kind' else 'note' end,
      -- What a store route put on the working set beside the material (its role, note, session and door) is kept.
      'role', coalesce(case when m->>'role' ~ '^[a-z][a-z_]{0,40}$' then m->>'role' end, case when m->>'kind' = 'research' then 'research' end),
      'note', m->>'note',
      'session_id', m->>'session_id',
      'title', coalesce(nullif(m->>'title', ''), left(v_text, 80), v_url, 'Untitled'),
      'source', case when m->>'source' in ('session','board','control_center','backfill','repo') then m->>'source' else p_source end,
      'source_ref', 'meta.materials:' || coalesce(m->>'id', ''),
      'added_by', coalesce(nullif(m->>'by', ''), 'Krish'),
      'added_at', v_at));
    if (r->>'ok')::boolean and not (r->>'duplicate')::boolean then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

-- The trigger: a write that changes meta.materials is captured in the same transaction. A capture that fails never
-- costs the engine its write (it raises a warning); the next listing of the piece captures it again.
create or replace function public.content_ideas_capture_materials() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.meta is null or jsonb_typeof(new.meta->'materials') is distinct from 'array' then return null; end if;
  if tg_op = 'UPDATE' and (old.meta->'materials') is not distinct from (new.meta->'materials') then return null; end if;
  begin
    perform public.board_capture_materials(new.id, new.meta->'materials');
  exception when others then
    raise warning 'piece materials capture failed for %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists content_ideas_capture_materials on public.content_ideas;
create trigger content_ideas_capture_materials after insert or update of meta on public.content_ideas
  for each row execute function public.content_ideas_capture_materials();

-- ── sessions ──────────────────────────────────────────────────────────────────────────────────────────────────────

-- One field write, at the revision the writer read. set: refused when another revision landed first. append: the value
-- is appended to the list as it stands now, so two sessions appending at once both land.
create or replace function public.board_field_write(p_scope text, p_piece uuid, p_week date, p_day text, f jsonb, p_session text, p_by text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_cur public.board_piece_fields; v_rev integer; v_value jsonb; v_mode text := coalesce(f->>'mode', 'set'); v_tries integer := 0;
begin
  if coalesce(f->>'name', '') !~ '^[a-z][a-z0-9_.-]{0,59}$' or not (f ? 'value') or v_mode not in ('set','append') then
    return jsonb_build_object('name', f->>'name', 'ok', false, 'error', 'invalid_field');
  end if;
  loop
    select * into v_cur from public.board_piece_fields x where x.scope = p_scope and x.name = f->>'name' order by x.revision desc limit 1;
    v_rev := coalesce(v_cur.revision, 0);
    if v_mode = 'set' then
      if (f->>'base_revision') is null or (f->>'base_revision')::integer <> v_rev then
        return jsonb_build_object('name', f->>'name', 'ok', false, 'error', 'revision_conflict', 'revision', v_rev, 'value', v_cur.value, 'by', v_cur.actor, 'at', v_cur.at);
      end if;
      v_value := f->'value';
    else
      v_value := case when v_cur.value is null then jsonb_build_array(f->'value')
        when jsonb_typeof(v_cur.value) = 'array' then v_cur.value || jsonb_build_array(f->'value')
        else jsonb_build_array(v_cur.value, f->'value') end;
    end if;
    begin
      insert into public.board_piece_fields (scope, piece_id, week, day, name, revision, value, session_id, actor)
        values (p_scope, p_piece, p_week, p_day, f->>'name', v_rev + 1, v_value, p_session, p_by);
      return jsonb_build_object('name', f->>'name', 'ok', true, 'revision', v_rev + 1, 'value', v_value);
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_mode = 'set' or v_tries > 25 then
        select * into v_cur from public.board_piece_fields x where x.scope = p_scope and x.name = f->>'name' order by x.revision desc limit 1;
        return jsonb_build_object('name', f->>'name', 'ok', false, 'error', 'revision_conflict', 'revision', v_cur.revision, 'value', v_cur.value, 'by', v_cur.actor, 'at', v_cur.at);
      end if;
    end;
  end loop;
end $$;

-- One report from a session: start, progress, heartbeat, blocked, done or end, with any field writes. Idempotent on the
-- session's own key for the report: a retry returns the first answer and writes nothing again.
create or replace function public.board_session_report(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s record; v_key text; v_old public.board_session_events; v_fields jsonb := '[]'::jsonb; f jsonb; v_id bigint; v_at timestamptz;
  v_lease integer := least(greatest(coalesce(nullif(p->>'lease_seconds', '')::integer, 1800), 60), 14400); v_recent integer;
begin
  select * into s from public.board_scope_of(nullif(p->>'piece_id','')::uuid, nullif(p->>'week','')::date, nullif(p->>'day',''));
  if s.error is not null then return jsonb_build_object('ok', false, 'error', s.error); end if;
  if s.week is null then return jsonb_build_object('ok', false, 'error', 'piece_not_scheduled'); end if;
  if coalesce(p->>'session_id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{3,79}$' then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if coalesce(p->>'kind', '') not in ('start','progress','heartbeat','done','end','blocked') then return jsonb_build_object('ok', false, 'error', 'invalid_kind'); end if;
  if coalesce(p->>'client_key', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$' then return jsonb_build_object('ok', false, 'error', 'invalid_client_key'); end if;
  v_key := encode(sha256(convert_to(s.scope || chr(31) || (p->>'session_id') || chr(31) || (p->>'client_key'), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('board_session_events/' || v_key, 0));
  select * into v_old from public.board_session_events e where e.event_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_old.id, 'at', v_old.at, 'fields', coalesce(v_old.fields, '[]'::jsonb));
  end if;
  select count(*) into v_recent from public.board_session_events e where e.scope = s.scope and e.at > now() - interval '1 hour';
  if v_recent >= 1200 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if jsonb_typeof(p->'fields') = 'array' then
    if jsonb_array_length(p->'fields') > 10 then return jsonb_build_object('ok', false, 'error', 'too_many_fields'); end if;
    for f in select x from jsonb_array_elements(p->'fields') x loop
      v_fields := v_fields || public.board_field_write(s.scope, s.piece_id, s.week, s.day, f, p->>'session_id', left(coalesce(nullif(p->>'by', ''), 'unknown'), 80));
    end loop;
  end if;
  insert into public.board_session_events (event_key, scope, piece_id, week, day, session_id, surface, label, kind, step, summary, detail, fields, lease_until, actor)
  values (v_key, s.scope, s.piece_id, s.week, s.day, p->>'session_id', nullif(left(p->>'surface', 40), ''), nullif(left(p->>'label', 120), ''),
    p->>'kind', nullif(left(p->>'step', 60), ''), nullif(left(p->>'summary', 600), ''),
    case when jsonb_typeof(p->'detail') = 'object' then p->'detail' end, v_fields,
    now() + make_interval(secs => case when p->>'kind' in ('done','end') then 0 else v_lease end),
    left(coalesce(nullif(p->>'by', ''), 'unknown'), 80))
  returning id, at into v_id, v_at;
  return jsonb_build_object('ok', true, 'duplicate', false, 'event_id', v_id, 'at', v_at, 'scope', s.scope, 'fields', v_fields);
end $$;

-- ── reads ─────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Everything for some pieces and for a week's days with no piece: the materials (latest version of each key, or every
-- version), each session's presence from its events, the latest value of each field, and the newest events.
create or replace function public.board_overlay(p_pieces uuid[], p_week date, p_all_versions boolean default false, p_archived boolean default false)
returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  with scopes as (
    select unnest(coalesce(p_pieces, '{}'::uuid[]))::text as scope
    union select 'day:' || to_char(p_week, 'YYYY-MM-DD') || '/' || d from unnest(array['mon','tue','wed','thu','fri','sat','sun','week']) d where p_week is not null
  ), mats as (
    select m.*, (m.version = max(m.version) over (partition by m.scope, m.material_key)) as latest,
      count(*) over (partition by m.scope, m.material_key) as versions
    from public.piece_materials m where m.scope in (select scope from scopes)
  ), ev as (
    select e.*, row_number() over (partition by e.scope, e.session_id order by e.at desc, e.id desc) as rn,
      min(e.at) over (partition by e.scope, e.session_id) as first_at,
      count(*) over (partition by e.scope, e.session_id) as n,
      bool_or(e.kind in ('done','end')) over (partition by e.scope, e.session_id) as finished
    from public.board_session_events e where e.scope in (select scope from scopes)
  ), fl as (
    select distinct on (x.scope, x.name) x.* from public.board_piece_fields x where x.scope in (select scope from scopes) order by x.scope, x.name, x.revision desc
  )
  select jsonb_build_object(
    'as_of', now(),
    'materials', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'scope', m.scope, 'piece_id', m.piece_id, 'week', m.week, 'day', m.day,
        'key', m.material_key, 'version', m.version, 'versions', m.versions, 'latest', m.latest, 'kind', m.kind, 'role', m.role, 'title', m.title, 'note', m.note,
        'sha256', m.sha256, 'bytes', m.bytes, 'content_type', m.content_type, 'storage', m.storage, 'url', m.url, 'source', m.source,
        'added_by', m.added_by, 'session_id', m.session_id, 'at', m.added_at, 'archived_at', m.archived_at) order by m.added_at desc, m.version desc)
      from mats m where (p_all_versions or m.latest) and (p_archived or m.archived_at is null)), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('session_id', e.session_id, 'scope', e.scope, 'piece_id', e.piece_id, 'day', e.day,
        'surface', e.surface, 'label', e.label, 'by', e.actor, 'step', e.step, 'doing', e.summary, 'last_kind', e.kind,
        'state', case when e.kind = 'done' then 'done' when e.kind = 'end' then 'ended' when e.kind = 'blocked' and e.lease_until > now() then 'blocked'
          when e.lease_until > now() then 'working' else 'quiet' end,
        'started_at', e.first_at, 'last_at', e.at, 'lease_until', e.lease_until, 'events', e.n) order by e.at desc)
      from ev e where e.rn = 1), '[]'::jsonb),
    'fields', coalesce((select jsonb_agg(jsonb_build_object('scope', x.scope, 'name', x.name, 'revision', x.revision, 'value', x.value, 'by', x.actor, 'session_id', x.session_id, 'at', x.at) order by x.name)
      from fl x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(z) from (select jsonb_build_object('id', e.id, 'scope', e.scope, 'session_id', e.session_id, 'kind', e.kind, 'step', e.step,
        'summary', e.summary, 'detail', e.detail, 'by', e.actor, 'at', e.at) z from ev e order by e.at desc, e.id desc limit 60) q), '[]'::jsonb)
  )
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'board_scope_of(uuid,date,text)', 'board_material_put(jsonb)', 'board_material_archive(uuid,text,text)',
    'board_capture_materials(uuid,jsonb,text)', 'board_field_write(text,uuid,date,text,jsonb,text,text)',
    'board_session_report(jsonb)', 'board_overlay(uuid[],date,boolean,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke all on function public.content_ideas_capture_materials() from public, anon, authenticated;
