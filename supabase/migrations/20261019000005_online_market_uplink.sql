-- M4 starter surface construction. The server fixes one uplink per released
-- planet to its landed-ship site; arbitrary placement requires later rules.
-- Materials are debited only from canonical miner and ship inventories.
create table public.online_structures (
  campaign_id uuid not null,
  owner_id uuid not null,
  planet text not null,
  kind text not null check (kind = 'trade-post'),
  created_at timestamptz not null default now(),
  primary key (campaign_id, planet, kind),
  foreign key (campaign_id, owner_id)
    references public.online_campaigns(id, owner_id) on delete restrict
);
alter table public.online_structures enable row level security;
revoke all on public.online_structures from public, anon, authenticated;
grant select on public.online_structures to authenticated;
create policy online_structure_owner_read on public.online_structures
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.online_structure_operations (
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
alter table public.online_structure_operations enable row level security;
revoke all on public.online_structure_operations from public, anon, authenticated;

create function public.build_online_market_uplink(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_session_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_structure_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_pod jsonb;
  v_ore text;
  v_cost bigint;
  v_miner bigint;
  v_ship bigint;
  v_from_miner bigint;
  v_from_ship bigint;
  v_debits jsonb := '[]'::jsonb;
  v_hash text;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('campaign_id', p_campaign_id,
      'expected_revision', p_expected_revision, 'session_id', p_session_id,
      'kind', 'trade-post')::text, 'UTF8'
  )), 'hex');
  select * into v_prior from public.online_structure_operations
    where owner_id = v_owner and operation_id = p_operation_id;
  if found then
    if v_prior.input_hash <> v_hash then
      raise exception 'OPERATION_CONFLICT' using errcode = '23505';
    end if;
    return v_prior.receipt;
  end if;

  select * into v_campaign from public.online_campaigns
    where id = p_campaign_id and owner_id = v_owner for update;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode = '42501'; end if;
  if v_campaign.ruleset_version <> 'online-1' or v_campaign.active_planet not in ('cryo-shelf','mars-frontier') then
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
  if exists (select 1 from public.online_structures where campaign_id = p_campaign_id
      and planet = v_campaign.active_planet and kind = 'trade-post') then
    raise exception 'ALREADY_BUILT' using errcode = '23505';
  end if;
  select snapshot into v_snapshot from public.online_simulation_state
    where campaign_id = p_campaign_id and owner_id = v_owner;
  v_pod := v_snapshot->'pod';
  -- Same canonical landed-ship service radius used by the first cargo RPC.
  if v_pod is null or pg_catalog.jsonb_typeof(v_pod) <> 'object'
     or (v_pod->>'y')::numeric not between -100 and 0
     or ((v_pod->>'x')::numeric - 555) ^ 2
        + ((v_pod->>'y')::numeric + 22) ^ 2 >= 190 ^ 2 then
    raise exception 'ACCESS_REQUIRED' using errcode = '42501';
  end if;

  for v_ore, v_cost in
    select cost.ore, cost.half_units from (values
      ('copper'::text, 8::bigint), ('iron'::text, 8::bigint),
      ('silver'::text, 4::bigint)
    ) as cost(ore, half_units)
  loop
    select coalesce(quantity_half_units, 0) into v_miner from public.online_inventory
      where campaign_id = p_campaign_id and owner_id = v_owner
        and location_key = 'miner' and ore = v_ore;
    v_miner := coalesce(v_miner, 0);
    select coalesce(quantity_half_units, 0) into v_ship from public.online_inventory
      where campaign_id = p_campaign_id and owner_id = v_owner
        and location_key = 'ship' and ore = v_ore;
    v_ship := coalesce(v_ship, 0);
    if v_miner + v_ship < v_cost then
      raise exception 'INSUFFICIENT_ORE' using errcode = '22023';
    end if;
    v_from_miner := least(v_miner, v_cost);
    v_from_ship := v_cost - v_from_miner;
    if v_from_miner > 0 then
      update public.online_inventory set quantity_half_units = v_miner - v_from_miner,
        updated_at = pg_catalog.clock_timestamp()
        where campaign_id = p_campaign_id and location_key = 'miner' and ore = v_ore;
    end if;
    if v_from_ship > 0 then
      update public.online_inventory set quantity_half_units = v_ship - v_from_ship,
        updated_at = pg_catalog.clock_timestamp()
        where campaign_id = p_campaign_id and location_key = 'ship' and ore = v_ore;
    end if;
    v_debits := v_debits || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ore', v_ore, 'miner_half_units', v_from_miner,
      'ship_half_units', v_from_ship));
  end loop;

  insert into public.online_structures(campaign_id, owner_id, planet, kind)
    values (p_campaign_id, v_owner, v_campaign.active_planet, 'trade-post');
  update public.online_campaigns set revision = revision + 1,
    session_expires_at = pg_catalog.clock_timestamp() + interval '30 seconds',
    updated_at = pg_catalog.clock_timestamp() where id = p_campaign_id;
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id, 'campaign_id', p_campaign_id,
    'kind', 'build_market_uplink', 'revision', p_expected_revision + 1,
    'planet', v_campaign.active_planet, 'material_debits', v_debits,
    'occurred_at', pg_catalog.clock_timestamp()
  );
  insert into public.online_structure_operations(owner_id, operation_id, campaign_id,
    input_hash, receipt) values (v_owner, p_operation_id, p_campaign_id, v_hash, v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.build_online_market_uplink(uuid,bigint,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.build_online_market_uplink(uuid,bigint,uuid,uuid)
  to authenticated;

-- Canonical campaign read now includes the server-owned Market uplink state.
create or replace function public.read_online_game_state(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_credits bigint;
  v_cargo jsonb;
  v_ship jsonb;
  v_uplink boolean;
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
  select coalesce(pg_catalog.jsonb_object_agg(ore, quantity_half_units), '{}'::jsonb)
    into v_ship from public.online_inventory
    where campaign_id = p_campaign_id and owner_id = v_owner and location_key = 'ship';
  select exists(select 1 from public.online_structures where campaign_id = p_campaign_id
    and owner_id = v_owner and planet = v_campaign.active_planet and kind = 'trade-post')
    into v_uplink;
  if v_snapshot is null or v_credits is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;
  return pg_catalog.jsonb_build_object(
    'campaign_id', p_campaign_id,
    'ruleset_version', v_campaign.ruleset_version,
    'revision', v_campaign.revision,
    'active_planet', v_campaign.active_planet,
    'credit_minor', v_credits,
    'market_uplink_online', v_uplink,
    'ship_cargo_half_units', v_ship,
    'ship_capacity_half_units', 100,
    'snapshot', v_snapshot || pg_catalog.jsonb_build_object('cargo_half_units', v_cargo)
  );
end;
$$;
