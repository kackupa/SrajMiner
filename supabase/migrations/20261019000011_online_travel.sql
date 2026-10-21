-- A jump archives only terrain and loose drops per planet. Global inventory,
-- fitted levels, fuel, condition and sequence remain in the active snapshot.
alter table public.online_operation_registry
  drop constraint online_operation_registry_kind_check;
alter table public.online_operation_registry
  add constraint online_operation_registry_kind_check check (kind in
    ('start','game','transfer','structure','civilian_sale','service','upgrade','recovery','travel'));

create table public.online_world_states (
  campaign_id uuid not null,
  owner_id uuid not null,
  planet text not null check (planet in ('cryo-shelf','mars-frontier')),
  world_seed bigint not null check (world_seed between 0 and 4294967295),
  destroyed_cells jsonb not null check (pg_catalog.jsonb_typeof(destroyed_cells)='array'),
  drops jsonb not null check (pg_catalog.jsonb_typeof(drops)='array'),
  primary key (campaign_id,planet),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict
);
alter table public.online_world_states enable row level security;
revoke all on public.online_world_states from public, anon, authenticated;

create table public.online_travel_operations (
  owner_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  campaign_id uuid not null,
  input_hash text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict
);
alter table public.online_travel_operations enable row level security;
revoke all on public.online_travel_operations from public, anon, authenticated;
create trigger online_travel_register_operation
  before insert on public.online_travel_operations for each row
  execute function public.register_online_operation('travel');

create function public.travel_online_campaign(
  p_campaign_id uuid, p_expected_revision bigint,
  p_operation_id uuid, p_session_id uuid, p_destination text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_travel_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_destination public.online_world_states%rowtype;
  v_snapshot jsonb;
  v_fuel bigint;
  v_reserve bigint;
  v_hash text;
  v_receipt jsonb;
  v_now_ms bigint;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null or p_destination is null then
    raise exception 'INVALID_COMMAND' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('campaign_id',p_campaign_id,
      'expected_revision',p_expected_revision,'session_id',p_session_id,
      'destination',p_destination)::text,'UTF8')), 'hex');
  select * into v_prior from public.online_travel_operations
    where owner_id=v_owner and operation_id=p_operation_id;
  if found then
    if v_prior.input_hash <> v_hash then
      raise exception 'OPERATION_CONFLICT' using errcode='23505';
    end if;
    return v_prior.receipt;
  end if;

  select * into v_campaign from public.online_campaigns
    where id=p_campaign_id and owner_id=v_owner for update;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode='42501'; end if;
  if v_campaign.ruleset_version <> 'online-1'
     or v_campaign.active_planet not in ('cryo-shelf','mars-frontier') then
    raise exception 'RULESET_MISMATCH' using errcode='22023';
  end if;
  if p_destination not in ('cryo-shelf','mars-frontier')
     or p_destination=v_campaign.active_planet then
    raise exception 'ROUTE_UNAVAILABLE' using errcode='22023';
  end if;
  if v_campaign.revision <> p_expected_revision then
    raise exception 'STALE_REVISION' using errcode='40001';
  end if;
  if v_campaign.session_id is distinct from p_session_id
     or v_campaign.session_expires_at is null
     or v_campaign.session_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'SESSION_CONFLICT' using errcode='55000';
  end if;
  select snapshot into v_snapshot from public.online_simulation_state
    where campaign_id=p_campaign_id and owner_id=v_owner for update;
  if v_snapshot is null then raise exception 'INVALID_STATE' using errcode='23514'; end if;
  v_fuel := (v_snapshot->>'core_fuel')::bigint;
  if v_fuel is null or v_fuel not between 0 and 24
     or v_snapshot->'core_relics' is null
     or pg_catalog.jsonb_typeof(v_snapshot->'core_relics') <> 'array'
     or not (v_snapshot->'core_relics' ? 'core-cryo')
     or v_snapshot->'pod'->>'docked' <> 'true'
     or pg_catalog.abs((v_snapshot->'pod'->>'x')::numeric - 555) > 190
     or pg_catalog.abs((v_snapshot->'pod'->>'y')::numeric + 22) > 50
     or (v_snapshot->>'fuel_milli')::bigint <= 0
     or (v_snapshot->>'hull_milli')::bigint <= 0 then
    raise exception 'TRAVEL_ACCESS_REQUIRED' using errcode='22023';
  end if;
  -- The Local route keeps one fuel to return until the destination core is recovered.
  v_reserve := case when v_snapshot->'core_relics' ?
    (case p_destination when 'mars-frontier' then 'core-mars' else 'core-cryo' end)
    then 0 else 1 end;
  if v_fuel < 1 + v_reserve then
    raise exception 'INSUFFICIENT_CORE_FUEL' using errcode='22023';
  end if;

  insert into public.online_world_states(campaign_id,owner_id,planet,
    world_seed,destroyed_cells,drops)
    values(p_campaign_id,v_owner,v_campaign.active_planet,
      (v_snapshot->>'world_seed')::bigint,v_snapshot->'destroyed_cells',v_snapshot->'drops')
    on conflict (campaign_id,planet) do update set
      world_seed=excluded.world_seed,
      destroyed_cells=excluded.destroyed_cells,
      drops=excluded.drops;
  select * into v_destination from public.online_world_states
    where campaign_id=p_campaign_id and owner_id=v_owner and planet=p_destination;
  v_now_ms := pg_catalog.floor(pg_catalog.date_part('epoch',
    pg_catalog.clock_timestamp()) * 1000)::bigint;
  update public.online_simulation_state set
    snapshot=v_snapshot || pg_catalog.jsonb_build_object(
      'world_seed',case when v_destination.campaign_id is null then
        pg_catalog.floor(pg_catalog.random()*4294967296)::bigint
        else v_destination.world_seed end,
      'destroyed_cells',case when v_destination.campaign_id is null then '[]'::jsonb
        else v_destination.destroyed_cells end,
      'drops',case when v_destination.campaign_id is null then '[]'::jsonb
        else v_destination.drops end,
      'pod',pg_catalog.jsonb_build_object('x',680,'y',-22,'vx',0,'vy',0,'docked',true),
      'core_fuel',v_fuel-1,'core_extraction_elapsed_ms',0,
      'drill_target',null,'drill_elapsed_ms',0,
      'input_budget_ms',1000,'observed_at_ms',v_now_ms),
    updated_at=pg_catalog.clock_timestamp()
    where campaign_id=p_campaign_id and owner_id=v_owner;
  update public.online_campaigns set active_planet=p_destination,
    revision=revision+1,
    session_expires_at=pg_catalog.clock_timestamp()+interval '30 seconds',
    updated_at=pg_catalog.clock_timestamp() where id=p_campaign_id;
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id',p_operation_id,'campaign_id',p_campaign_id,'kind','travel',
    'revision',p_expected_revision+1,'source',v_campaign.active_planet,
    'destination',p_destination,'core_fuel_after',v_fuel-1,
    'occurred_at',pg_catalog.clock_timestamp());
  insert into public.online_travel_operations(owner_id,operation_id,campaign_id,
    input_hash,receipt) values(v_owner,p_operation_id,p_campaign_id,v_hash,v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.travel_online_campaign(uuid,bigint,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.travel_online_campaign(uuid,bigint,uuid,uuid,text)
  to authenticated;
