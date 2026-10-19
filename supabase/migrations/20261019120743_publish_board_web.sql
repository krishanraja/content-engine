-- Private publish-board state. Only guarded server routes use service_role.
create table public.board_documents (
  week date not null check (extract(isodow from week) = 1),
  collection text not null check (collection in ('links','edits','picks','queue','comments')),
  doc_id text not null,
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (week, collection, doc_id)
);
create table public.board_ticks (
  week date not null check (extract(isodow from week) = 1),
  tick_id text not null,
  body jsonb not null check (jsonb_typeof(body->'done') = 'boolean'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (week, tick_id)
);
create table public.board_history (
  week date not null,
  collection text not null,
  doc_id text not null,
  revision bigint not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (week, collection, doc_id, revision)
);
create table public.board_imports (
  source_sha256 text primary key check (source_sha256 ~ '^[a-f0-9]{64}$'),
  week date not null,
  source text not null,
  collection text not null,
  doc_id text not null,
  body jsonb not null,
  imported_at timestamptz not null default now()
);
create table public.board_builds (
  week date not null check (extract(isodow from week) = 1),
  build_id text not null check (build_id ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  primary key (week, build_id)
);
create table public.board_sources (
  export_sha256 text primary key check (export_sha256 ~ '^[a-f0-9]{64}$'),
  week date not null,
  source text not null,
  files jsonb not null,
  recorded_at timestamptz not null default now()
);
create table public.board_weeks (
  week date primary key,
  build_id text not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  foreign key (week, build_id) references public.board_builds (week, build_id)
);
do $$ declare t text; begin
  foreach t in array array['board_documents','board_ticks','board_history','board_imports','board_sources','board_builds','board_weeks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
  end loop;
end $$;

-- Transactional CAS, including absent rows. One key lock makes create/create safe.
create function public.board_save(p_week date, p_collection text, p_id text,
  p_body jsonb, p_revision bigint, p_actor text) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare old_body jsonb; old_revision bigint; result jsonb; next_revision bigint;
begin
  if p_collection not in ('ticks','links','edits','picks','queue','comments') or p_revision < 0 then
    raise exception 'invalid_board_write';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_week::text || '/' || p_collection || '/' || p_id, 0));
  if p_collection = 'ticks' then
    select body, revision into old_body, old_revision from board_ticks where week=p_week and tick_id=p_id;
  else
    select body, revision into old_body, old_revision from board_documents where week=p_week and collection=p_collection and doc_id=p_id;
  end if;
  if old_body = p_body then
    return jsonb_build_object('ok',true,'revision',old_revision,'body',old_body);
  end if;
  if coalesce(old_revision,0) <> p_revision or (p_collection='comments' and old_revision is not null) then
    return jsonb_build_object('ok',false,'error','revision_conflict','revision',coalesce(old_revision,0),'body',old_body);
  end if;
  next_revision := coalesce(old_revision,0)+1;
  if p_collection = 'ticks' then
    insert into board_ticks (week,tick_id,body,revision,updated_by) values (p_week,p_id,p_body,next_revision,p_actor)
    on conflict (week,tick_id) do update set body=excluded.body,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
  else
    insert into board_documents (week,collection,doc_id,body,revision,updated_by) values (p_week,p_collection,p_id,p_body,next_revision,p_actor)
    on conflict (week,collection,doc_id) do update set body=excluded.body,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
  end if;
  insert into board_history (week,collection,doc_id,revision,body,updated_by)
    values (p_week,p_collection,p_id,next_revision,p_body,p_actor);
  return jsonb_build_object('ok',true,'revision',next_revision,'body',p_body);
end $$;
revoke all on function public.board_save(date,text,text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.board_save(date,text,text,jsonb,bigint,text) to service_role;

create function public.board_activate(p_week date,p_build text,p_manifest jsonb,p_revision bigint,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_build text; current_revision bigint; stored jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('board-build/' || p_week::text,0));
  select build_id,revision into current_build,current_revision from board_weeks where week=p_week;
  select manifest into stored from board_builds where week=p_week and build_id=p_build;
  if stored is not null and stored <> p_manifest then
    return jsonb_build_object('ok',false,'error','immutable_build_conflict');
  end if;
  if current_build=p_build then return jsonb_build_object('ok',true,'revision',current_revision,'build_id',p_build); end if;
  if coalesce(current_revision,0) <> p_revision then
    return jsonb_build_object('ok',false,'error','revision_conflict','revision',coalesce(current_revision,0));
  end if;
  insert into board_builds (week,build_id,manifest,created_by) values (p_week,p_build,p_manifest,p_actor) on conflict do nothing;
  insert into board_weeks (week,build_id,revision) values (p_week,p_build,coalesce(current_revision,0)+1)
    on conflict (week) do update set build_id=excluded.build_id,revision=excluded.revision,updated_at=now();
  return jsonb_build_object('ok',true,'revision',coalesce(current_revision,0)+1,'build_id',p_build);
end $$;
revoke all on function public.board_activate(date,text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.board_activate(date,text,jsonb,bigint,text) to service_role;
