-- A research shelf for every venture (I-30, D21; Ruling, Krish, 2026-11-14: "I want wave 3 now").
--
-- Until now every material sat on a Make Your Mind Up piece or a day of its week, so research another venture paid for
-- (a Mindmake market, offer or partner) had nowhere to go and was refused (scripts/recover_research.py). A material may
-- now sit on a venture's own shelf: scope 'venture:<slug>', its venture column naming an active venture_registry slug.
--
--   - 'publication' (Make Your Mind Up) has no venture shelf: its research sits on its pieces and days, as before.
--   - A slug the registry lacks, or one not active, is refused (unknown_venture), never filed loose.
--   - A venture shelf never reaches the Drive research library: the mirror keeps to Make Your Mind Up
--     (api/_researchLibrary.ts inLibrary and the Google source both skip 'venture:' scopes).
--   - Every other rule holds as it did: same bytes once, versions side by side, archived and never deleted.
-- Nothing already filed changes: the new column is null on every existing row.

begin;

alter table public.piece_materials add column if not exists venture text references public.venture_registry (slug)
  on update restrict on delete restrict;

alter table public.piece_materials drop constraint if exists piece_materials_scope_check;
alter table public.piece_materials add constraint piece_materials_scope_check check (scope ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|day:\d{4}-\d{2}-\d{2}/(mon|tue|wed|thu|fri|sat|sun|week)|venture:[a-z][a-z0-9_]{1,40})$');
alter table public.piece_materials drop constraint if exists piece_materials_has_scope;
alter table public.piece_materials add constraint piece_materials_has_scope check (piece_id is not null or week is not null or venture is not null);
alter table public.piece_materials add constraint piece_materials_venture_shelf check (
  (venture is null) = (scope !~ '^venture:')
  and (venture is null or (scope = 'venture:' || venture and piece_id is null and week is null and day is null and venture <> 'publication')));
create index if not exists piece_materials_venture on public.piece_materials (venture, added_at desc) where venture is not null;

-- The scope a write lands on: a piece, a day of a week, or (new) a venture's shelf. The three-argument form stays for
-- every caller that never names a venture.
create or replace function public.board_scope_of(p_piece uuid, p_week date, p_day text, p_venture text,
  out scope text, out piece_id uuid, out week date, out day text, out venture text, out error text)
language plpgsql stable set search_path = public, pg_temp as $$
declare b record;
begin
  if p_venture is not null then
    if p_piece is not null or p_week is not null or p_day is not null then error := 'venture_and_piece'; return; end if;
    if p_venture = 'publication' then error := 'publication_files_on_its_pieces'; return; end if;
    if not exists (select 1 from public.venture_registry r where r.slug = p_venture and r.active) then error := 'unknown_venture'; return; end if;
    scope := 'venture:' || p_venture; venture := p_venture;
    return;
  end if;
  select * into b from public.board_scope_of(p_piece, p_week, p_day);
  scope := b.scope; piece_id := b.piece_id; week := b.week; day := b.day; error := b.error;
end $$;

-- One material added, now also onto a venture shelf (p->>'venture'); otherwise exactly as before.
create or replace function public.board_material_put(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s record; v_storage text := coalesce(p->>'storage', 'text'); v_content text := p->>'content'; v_url text := nullif(p->>'url', '');
  v_sha text; v_bytes bigint; v_key text; v_cur integer; v_row public.piece_materials; v_base integer;
begin
  select * into s from public.board_scope_of(nullif(p->>'piece_id','')::uuid, nullif(p->>'week','')::date, nullif(p->>'day',''),
    nullif(p->>'venture',''));
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
  insert into public.piece_materials (scope, piece_id, week, day, venture, material_key, version, kind, role, title, note, sha256, bytes,
    content_type, storage, text_sha256, object_key, url, source, source_ref, added_by, session_id, added_at)
  values (s.scope, s.piece_id, s.week, s.day, s.venture, v_key, coalesce(v_cur, 0) + 1, coalesce(nullif(p->>'kind', ''), 'other'),
    nullif(p->>'role', ''), left(coalesce(nullif(btrim(p->>'title'), ''), 'Untitled'), 300), nullif(left(p->>'note', 2000), ''),
    v_sha, v_bytes, nullif(p->>'content_type', ''), v_storage, case when v_storage = 'text' then v_sha end,
    case when v_storage = 'bucket' then p->>'object_key' end, v_url, coalesce(nullif(p->>'source', ''), 'session'),
    nullif(left(p->>'source_ref', 500), ''), left(coalesce(nullif(p->>'added_by', ''), 'unknown'), 80), nullif(p->>'session_id', ''),
    coalesce(nullif(p->>'added_at', '')::timestamptz, now()))
  returning * into v_row;
  return jsonb_build_object('ok', true, 'duplicate', false, 'material', to_jsonb(v_row));
end $$;

revoke all on function public.board_scope_of(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.board_scope_of(uuid, date, text, text) to service_role;

commit;
