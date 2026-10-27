-- First M4 inventory move. The owner can request a quantity, never a balance.
-- This is restricted to miner <-> landed mothership until canonical warehouse
-- placement, travel, and production state exist. No browser table write grant.
create table public.online_inventory_operations (
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
alter table public.online_inventory_operations enable row level security;
revoke all on public.online_inventory_operations from public, anon, authenticated;

create function public.transfer_online_ore(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_session_id uuid,
  p_source text,
  p_target text,
  p_ore text,
  p_quantity_half_units bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_inventory_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_pod jsonb;
  v_source_count bigint;
  v_target_count bigint;
  v_target_total bigint;
  v_target_capacity bigint;
  v_cargo_level bigint;
  v_hash text;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null
     or p_source is null or p_target is null or p_source = p_target
     or p_source not in ('miner','ship') or p_target not in ('miner','ship')
     or p_ore is null or p_ore not in
       ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')
     or p_quantity_half_units is null or p_quantity_half_units not between 1 and 100 then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'campaign_id', p_campaign_id, 'expected_revision', p_expected_revision,
      'session_id', p_session_id, 'source', p_source, 'target', p_target,
      'ore', p_ore, 'quantity_half_units', p_quantity_half_units
    )::text, 'UTF8'
  )), 'hex');
  select * into v_prior from public.online_inventory_operations
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
  select snapshot into v_snapshot from public.online_simulation_state
    where campaign_id = p_campaign_id and owner_id = v_owner;
  v_pod := v_snapshot->'pod';
  -- The current Online mining slice has the landed ship at x=555, y=-22.
  -- Far-side/travel access will require a versioned rule and migration.
  if v_pod is null or pg_catalog.jsonb_typeof(v_pod) <> 'object'
     or (v_pod->>'y')::numeric not between -100 and 0
     or ((v_pod->>'x')::numeric - 555) ^ 2
        + ((v_pod->>'y')::numeric + 22) ^ 2 >= 190 ^ 2 then
    raise exception 'ACCESS_REQUIRED' using errcode = '42501';
  end if;

  select quantity_half_units into v_source_count from public.online_inventory
    where campaign_id = p_campaign_id and owner_id = v_owner
      and location_key = p_source and ore = p_ore;
  v_source_count := coalesce(v_source_count, 0);
  if v_source_count < p_quantity_half_units then
    raise exception 'INSUFFICIENT_ORE' using errcode = '22023';
  end if;
  select coalesce(sum(quantity_half_units), 0)::bigint into v_target_total
    from public.online_inventory
    where campaign_id = p_campaign_id and owner_id = v_owner and location_key = p_target;
  v_cargo_level := (v_snapshot->'levels'->>'cargo')::bigint;
  if v_cargo_level is null or v_cargo_level not between 1 and 5 then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;
  v_target_capacity := case when p_target = 'ship' then 100
    else case v_cargo_level when 1 then 32 when 2 then 48 when 3 then 68
      when 4 then 96 when 5 then 128 end end;
  if v_target_total + p_quantity_half_units > v_target_capacity then
    raise exception 'HOLD_FULL' using errcode = '22023';
  end if;
  select quantity_half_units into v_target_count from public.online_inventory
    where campaign_id = p_campaign_id and owner_id = v_owner
      and location_key = p_target and ore = p_ore;
  v_target_count := coalesce(v_target_count, 0);

  update public.online_inventory
    set quantity_half_units = v_source_count - p_quantity_half_units,
        updated_at = pg_catalog.clock_timestamp()
    where campaign_id = p_campaign_id and location_key = p_source and ore = p_ore;
  insert into public.online_inventory(campaign_id, owner_id, location_key, ore, quantity_half_units)
    values (p_campaign_id, v_owner, p_target, p_ore, v_target_count + p_quantity_half_units)
    on conflict (campaign_id, location_key, ore) do update
      set quantity_half_units = excluded.quantity_half_units,
          updated_at = pg_catalog.clock_timestamp();
  update public.online_campaigns
    set revision = revision + 1,
        session_expires_at = pg_catalog.clock_timestamp() + interval '30 seconds',
        updated_at = pg_catalog.clock_timestamp()
    where id = p_campaign_id;
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id, 'campaign_id', p_campaign_id,
    'kind', 'transfer_ore', 'revision', p_expected_revision + 1,
    'source', p_source, 'target', p_target, 'ore', p_ore,
    'quantity_half_units', p_quantity_half_units,
    'source_after_half_units', v_source_count - p_quantity_half_units,
    'target_after_half_units', v_target_count + p_quantity_half_units,
    'occurred_at', pg_catalog.clock_timestamp()
  );
  insert into public.online_inventory_operations(owner_id, operation_id, campaign_id, input_hash, receipt)
    values (v_owner, p_operation_id, p_campaign_id, v_hash, v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.transfer_online_ore(uuid,bigint,uuid,uuid,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.transfer_online_ore(uuid,bigint,uuid,uuid,text,text,text,bigint)
  to authenticated;

-- Keep the existing owner-scoped reload result, adding canonical ship stock.
create or replace function public.read_online_game_state(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_credits bigint;
  v_cargo jsonb;
  v_ship jsonb;
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
  if v_snapshot is null or v_credits is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;
  return pg_catalog.jsonb_build_object(
    'campaign_id', p_campaign_id,
    'ruleset_version', v_campaign.ruleset_version,
    'revision', v_campaign.revision,
    'active_planet', v_campaign.active_planet,
    'credit_minor', v_credits,
    'ship_cargo_half_units', v_ship,
    'ship_capacity_half_units', 100,
    'snapshot', v_snapshot || pg_catalog.jsonb_build_object('cargo_half_units', v_cargo)
  );
end;
$$;
