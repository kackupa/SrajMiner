-- Private canonical gameplay state. The browser has no direct table or commit
-- grant. Only the authenticated session RPC and a trusted server runtime may
-- move this state; Local backup JSON is never read here.
alter table public.online_campaigns
  add column session_id uuid,
  add column session_expires_at timestamptz;

create table public.online_simulation_state (
  campaign_id uuid primary key,
  owner_id uuid not null,
  snapshot jsonb not null check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, owner_id)
    references public.online_campaigns(id, owner_id) on delete restrict
);
create table public.online_game_operations (
  owner_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  campaign_id uuid not null,
  input_hash text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id),
  foreign key (campaign_id, owner_id)
    references public.online_campaigns(id, owner_id) on delete restrict
);
alter table public.online_simulation_state enable row level security;
alter table public.online_game_operations enable row level security;
revoke all on public.online_simulation_state, public.online_game_operations
  from public, anon, authenticated;
grant select on public.online_simulation_state, public.online_game_operations
  to service_role;
grant select on public.online_campaigns, public.online_inventory to service_role;

create function public.initialize_online_simulation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_seed bigint := pg_catalog.floor(pg_catalog.random() * 4294967296)::bigint;
  v_now_ms bigint := pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  insert into public.online_simulation_state(campaign_id, owner_id, snapshot)
    values (new.id, new.owner_id, pg_catalog.jsonb_build_object(
      'world_seed', v_seed,
      'levels', pg_catalog.jsonb_build_object('drill',1,'fuel',1,'cargo',1,'hull',1,
        'engine',1,'scanner',1,'grapple',1),
      'destroyed_cells', '[]'::jsonb,
      'pod', pg_catalog.jsonb_build_object('x',680,'y',-22,'vx',0,'vy',0,'docked',true),
      'fuel_milli', 140000, 'hull_milli', 100000,
      'core_fuel', 0, 'core_relics', '[]'::jsonb,
      'core_extraction_elapsed_ms', 0,
      'drops', '[]'::jsonb, 'drill_target', null,
      'drill_elapsed_ms', 0, 'last_sequence', -1,
      'input_budget_ms', 1000, 'observed_at_ms', v_now_ms
    ));
  return new;
end;
$$;
revoke all on function public.initialize_online_simulation() from public, anon, authenticated;
create trigger online_campaign_initial_simulation
  after insert on public.online_campaigns for each row
  execute function public.initialize_online_simulation();

-- Forward migration for campaigns created by the preceding zero-asset start
-- migration before this one. Each receives a fresh canonical starter world.
insert into public.online_simulation_state(campaign_id, owner_id, snapshot)
select c.id, c.owner_id, pg_catalog.jsonb_build_object(
  'world_seed', pg_catalog.floor(pg_catalog.random() * 4294967296)::bigint,
  'levels', pg_catalog.jsonb_build_object('drill',1,'fuel',1,'cargo',1,'hull',1,
    'engine',1,'scanner',1,'grapple',1),
  'destroyed_cells', '[]'::jsonb,
  'pod', pg_catalog.jsonb_build_object('x',680,'y',-22,'vx',0,'vy',0,'docked',true),
  'fuel_milli', 140000, 'hull_milli', 100000,
  'core_fuel', 0, 'core_relics', '[]'::jsonb,
  'core_extraction_elapsed_ms', 0,
  'drops', '[]'::jsonb, 'drill_target', null,
  'drill_elapsed_ms', 0, 'last_sequence', -1,
  'input_budget_ms', 1000,
  'observed_at_ms', pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()) * 1000)::bigint
)
from public.online_campaigns c
where not exists (select 1 from public.online_simulation_state s where s.campaign_id = c.id);

create function public.claim_online_session(
  p_campaign_id uuid, p_session_id uuid, p_takeover boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null or p_session_id is null or p_takeover is null then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;
  select * into v_campaign from public.online_campaigns
    where id = p_campaign_id and owner_id = v_owner for update;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode = '42501'; end if;
  if v_campaign.session_id is distinct from p_session_id
     and v_campaign.session_expires_at > pg_catalog.clock_timestamp()
     and not p_takeover then
    raise exception 'SESSION_CONFLICT' using errcode = '55000';
  end if;
  update public.online_campaigns
    set session_id = p_session_id,
        session_expires_at = pg_catalog.clock_timestamp() + interval '30 seconds'
    where id = p_campaign_id;
  return pg_catalog.jsonb_build_object(
    'campaign_id', p_campaign_id,
    'session_id', p_session_id,
    'revision', v_campaign.revision,
    'expires_at', (select session_expires_at from public.online_campaigns where id = p_campaign_id)
  );
end;
$$;
revoke all on function public.claim_online_session(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_online_session(uuid, uuid, boolean)
  to authenticated;

-- Client reloads use this owner-scoped read. The private snapshot table stays
-- inaccessible to browser roles; no caller supplies an asset balance here.
create function public.read_online_game_state(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_credits bigint;
  v_cargo jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null then raise exception 'INVALID_COMMAND' using errcode = '22023'; end if;
  select * into v_campaign from public.online_campaigns
    where id = p_campaign_id and owner_id = v_owner for share;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode = '42501'; end if;
  select snapshot into v_snapshot from public.online_simulation_state
    where campaign_id = p_campaign_id and owner_id = v_owner;
  select credit_minor into v_credits from public.online_wallets
    where campaign_id = p_campaign_id and owner_id = v_owner;
  select coalesce(pg_catalog.jsonb_object_agg(ore, quantity_half_units), '{}'::jsonb)
    into v_cargo from public.online_inventory
    where campaign_id = p_campaign_id and owner_id = v_owner and location_key = 'miner';
  if v_snapshot is null or v_credits is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;
  return pg_catalog.jsonb_build_object(
    'campaign_id', p_campaign_id,
    'ruleset_version', v_campaign.ruleset_version,
    'revision', v_campaign.revision,
    'active_planet', v_campaign.active_planet,
    'credit_minor', v_credits,
    'snapshot', v_snapshot || pg_catalog.jsonb_build_object('cargo_half_units', v_cargo)
  );
end;
$$;
revoke all on function public.read_online_game_state(uuid) from public, anon, authenticated;
grant execute on function public.read_online_game_state(uuid) to authenticated;

-- The trusted game service reads the snapshot and canonical inventory,
-- executes the versioned TypeScript simulation, then submits its result here.
-- The service secret must never be available to browser code. This function
-- locks operation -> campaign -> inventory, and stores result and receipt in
-- one transaction. Any stale simulation is rejected without changing assets.
create function public.commit_online_game_step(
  p_owner_id uuid,
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_session_id uuid,
  p_input jsonb,
  p_new_state jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_campaign public.online_campaigns%rowtype;
  v_old jsonb;
  v_prior public.online_game_operations%rowtype;
  v_hash text;
  v_ore text;
  v_count_text text;
  v_count bigint;
  v_total bigint := 0;
  v_cargo_delta jsonb := '{}'::jsonb;
  v_old_count bigint;
  v_cargo_level bigint;
  v_fuel_level bigint;
  v_hull_level bigint;
  v_cargo_capacity bigint;
  v_fuel_capacity bigint;
  v_hull_capacity bigint;
  v_old_core_fuel bigint;
  v_new_core_fuel bigint;
  v_core_claimed boolean := false;
  v_core_renewed boolean := false;
  v_local_core text;
  v_expected_relics jsonb;
  v_old_core_elapsed bigint;
  v_new_core_elapsed bigint;
  v_input_ms bigint := 0;
  v_receipt jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'ACCESS_REQUIRED' using errcode = '42501';
  end if;
  if p_owner_id is null or p_campaign_id is null or p_expected_revision is null
     or p_expected_revision < 0 or p_operation_id is null or p_session_id is null
     or p_input is null or pg_catalog.jsonb_typeof(p_input) <> 'object'
     or p_new_state is null or pg_catalog.jsonb_typeof(p_new_state) <> 'object'
     or pg_catalog.octet_length(p_new_state::text) > 1048576 then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_operation_id::text, 0)
  );
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'campaign_id', p_campaign_id, 'expected_revision', p_expected_revision,
      'session_id', p_session_id, 'input', p_input
    )::text, 'UTF8'
  )), 'hex');
  select * into v_prior from public.online_game_operations
    where owner_id = p_owner_id and operation_id = p_operation_id;
  if found then
    if v_prior.input_hash <> v_hash then
      raise exception 'OPERATION_CONFLICT' using errcode = '23505';
    end if;
    return v_prior.receipt;
  end if;

  select * into v_campaign from public.online_campaigns
    where id = p_campaign_id and owner_id = p_owner_id for update;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode = '42501'; end if;
  if v_campaign.ruleset_version <> 'online-1' then
    raise exception 'RULESET_MISMATCH' using errcode = '22023';
  end if;
  if v_campaign.revision <> p_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_campaign.session_id is distinct from p_session_id
     or v_campaign.session_expires_at is null
     or v_campaign.session_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'SESSION_CONFLICT' using errcode = '55000';
  end if;
  select snapshot into v_old from public.online_simulation_state
    where campaign_id = p_campaign_id and owner_id = p_owner_id for update;
  if v_old is null or p_new_state->'world_seed' is distinct from v_old->'world_seed'
     or p_new_state->'levels' is distinct from v_old->'levels'
     or pg_catalog.jsonb_typeof(p_new_state->'core_relics') <> 'array'
     or pg_catalog.jsonb_typeof(p_new_state->'cargo_half_units') <> 'object'
     or pg_catalog.jsonb_typeof(p_new_state->'destroyed_cells') <> 'array'
     or pg_catalog.jsonb_typeof(p_new_state->'pod') <> 'object'
     or (p_new_state->>'last_sequence')::bigint <= (v_old->>'last_sequence')::bigint
     or (p_new_state->>'input_budget_ms')::bigint not between 0 and 1000
     or (p_new_state->>'observed_at_ms')::bigint < (v_old->>'observed_at_ms')::bigint then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_new_state->'destroyed_cells')
     < pg_catalog.jsonb_array_length(v_old->'destroyed_cells') then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;
  v_old_core_fuel := (v_old->>'core_fuel')::bigint;
  v_new_core_fuel := (p_new_state->>'core_fuel')::bigint;
  v_old_core_elapsed := (v_old->>'core_extraction_elapsed_ms')::bigint;
  v_new_core_elapsed := (p_new_state->>'core_extraction_elapsed_ms')::bigint;
  if pg_catalog.jsonb_typeof(p_input->'segments') = 'array' then
    select coalesce(pg_catalog.sum((segment->>'duration_ms')::bigint),0)
      into v_input_ms from pg_catalog.jsonb_array_elements(p_input->'segments') segment;
  end if;
  if v_old_core_fuel is null or v_old_core_fuel not between 0 and 24
     or v_new_core_fuel is null or v_new_core_fuel not between 0 and 24
     or v_old_core_elapsed is null or v_old_core_elapsed not between 0 and 9999
     or v_new_core_elapsed is null or v_new_core_elapsed not between 0 and 9999
     or v_input_ms not between 0 and 1000
     or v_new_core_elapsed > v_old_core_elapsed + v_input_ms
     or pg_catalog.jsonb_typeof(v_old->'core_relics') <> 'array'
     or v_old->'core_relics' not in ('[]'::jsonb,'["core-cryo"]'::jsonb,
       '["core-mars","core-cryo"]'::jsonb) then
    raise exception 'INVALID_STATE' using errcode='22023';
  end if;
  v_local_core := case v_campaign.active_planet
    when 'cryo-shelf' then 'core-cryo'
    when 'mars-frontier' then 'core-mars' else null end;
  v_expected_relics := case
    when v_local_core = 'core-cryo' then '["core-cryo"]'::jsonb
    when v_old->'core_relics' = '["core-cryo"]'::jsonb then
      '["core-mars","core-cryo"]'::jsonb else null end;
  v_core_claimed := v_local_core is not null
    and not (v_old->'core_relics' ? v_local_core)
    and p_new_state->'core_relics' = v_expected_relics;
  if v_core_claimed then
    if v_new_core_fuel <> v_old_core_fuel + 4
       or not (p_new_state->'destroyed_cells' ? '24,40')
       or (v_old->'destroyed_cells' ? '24,40') then
      raise exception 'INVALID_STATE' using errcode='22023';
    end if;
  elsif p_new_state->'core_relics' is distinct from v_old->'core_relics' then
    raise exception 'INVALID_STATE' using errcode='22023';
  elsif v_new_core_fuel = v_old_core_fuel + 1 then
    v_core_renewed := true;
    if v_old_core_fuel >= 4 or v_local_core is null
       or not (v_old->'core_relics' ? v_local_core)
       or not (v_old->'destroyed_cells' ? '24,40')
       or v_old_core_elapsed + v_input_ms < 10000
       or v_new_core_elapsed <> 0 then
      raise exception 'INVALID_STATE' using errcode='22023';
    end if;
  elsif v_new_core_fuel <> v_old_core_fuel then
    raise exception 'INVALID_STATE' using errcode='22023';
  end if;
  v_cargo_level := (v_old->'levels'->>'cargo')::bigint;
  v_fuel_level := (v_old->'levels'->>'fuel')::bigint;
  v_hull_level := (v_old->'levels'->>'hull')::bigint;
  if v_cargo_level is null or v_cargo_level not between 1 and 5
     or v_fuel_level is null or v_fuel_level not between 1 and 5
     or v_hull_level is null or v_hull_level not between 1 and 5 then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;
  v_cargo_capacity := case v_cargo_level when 1 then 32 when 2 then 48
    when 3 then 68 when 4 then 96 when 5 then 128 end;
  v_fuel_capacity := case v_fuel_level when 1 then 140000 when 2 then 190000
    when 3 then 260000 when 4 then 350000 when 5 then 480000 end;
  v_hull_capacity := case v_hull_level when 1 then 100000 when 2 then 140000
    when 3 then 195000 when 4 then 270000 when 5 then 380000 end;
  if (p_new_state->>'fuel_milli')::bigint not between 0 and v_fuel_capacity
     or (p_new_state->>'hull_milli')::bigint not between 0 and v_hull_capacity then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;

  for v_ore in select pg_catalog.jsonb_object_keys(p_new_state->'cargo_half_units') loop
    if v_ore <> all(array['copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal']) then
      raise exception 'INVALID_STATE' using errcode = '22023';
    end if;
  end loop;
  for v_ore in select pg_catalog.unnest(array['copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal']) loop
    v_count_text := p_new_state->'cargo_half_units'->>v_ore;
    if v_count_text is not null and v_count_text !~ '^[0-9]{1,4}$' then
      raise exception 'INVALID_STATE' using errcode = '22023';
    end if;
    v_count := coalesce(v_count_text::bigint, 0);
    v_total := v_total + v_count;
    select quantity_half_units into v_old_count from public.online_inventory
      where campaign_id = p_campaign_id and location_key = 'miner' and ore = v_ore;
    v_old_count := coalesce(v_old_count, 0);
    if v_count <> v_old_count then
      v_cargo_delta := v_cargo_delta || pg_catalog.jsonb_build_object(v_ore, v_count - v_old_count);
    end if;
  end loop;
  if v_total > v_cargo_capacity then raise exception 'HOLD_FULL' using errcode = '22023'; end if;

  delete from public.online_inventory
    where campaign_id = p_campaign_id and location_key = 'miner';
  for v_ore in select pg_catalog.unnest(array['copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal']) loop
    v_count := coalesce((p_new_state->'cargo_half_units'->>v_ore)::bigint, 0);
    if v_count > 0 then
      insert into public.online_inventory(campaign_id, owner_id, location_key, ore, quantity_half_units)
        values (p_campaign_id, p_owner_id, 'miner', v_ore, v_count);
    end if;
  end loop;
  update public.online_simulation_state
    set snapshot = p_new_state - 'cargo_half_units', updated_at = pg_catalog.clock_timestamp()
    where campaign_id = p_campaign_id;
  update public.online_campaigns
    set revision = revision + 1,
        session_expires_at = pg_catalog.clock_timestamp() + interval '30 seconds',
        updated_at = pg_catalog.clock_timestamp()
    where id = p_campaign_id;
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id, 'campaign_id', p_campaign_id,
    'revision', p_expected_revision + 1,
    'last_sequence', (p_new_state->>'last_sequence')::bigint,
    'canonical_position', p_new_state->'pod',
    'destroyed_cells', p_new_state->'destroyed_cells',
    'cargo_delta_half_units', v_cargo_delta,
    'core_fuel', v_new_core_fuel,
    'core_claimed', v_core_claimed,
    'core_renewed', v_core_renewed,
    'occurred_at', pg_catalog.clock_timestamp()
  );
  insert into public.online_game_operations(owner_id, operation_id, campaign_id, input_hash, receipt)
    values (p_owner_id, p_operation_id, p_campaign_id, v_hash, v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.commit_online_game_step(uuid, uuid, bigint, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_online_game_step(uuid, uuid, bigint, uuid, uuid, jsonb, jsonb)
  to service_role;
