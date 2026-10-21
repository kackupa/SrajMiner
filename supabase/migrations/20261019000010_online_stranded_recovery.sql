-- Server-owned stranded recovery. Unsold miner cargo is forfeited; ship stock,
-- credits, excavation and installed upgrades survive. Only a zero-fuel or
-- zero-hull canonical pod may recover, so this is not a free travel command.
alter table public.online_operation_registry
  drop constraint online_operation_registry_kind_check;
alter table public.online_operation_registry
  add constraint online_operation_registry_kind_check check (kind in
    ('start','game','transfer','structure','civilian_sale','service','upgrade','recovery'));

create table public.online_recovery_operations (
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
alter table public.online_recovery_operations enable row level security;
revoke all on public.online_recovery_operations from public, anon, authenticated;
create trigger online_recovery_register_operation
  before insert on public.online_recovery_operations for each row
  execute function public.register_online_operation('recovery');

create table public.online_recovery_ledger (
  owner_id uuid not null,
  operation_id uuid not null,
  campaign_id uuid not null,
  forfeited_cargo_half_units jsonb not null
    check (pg_catalog.jsonb_typeof(forfeited_cargo_half_units)='object'),
  fuel_before_milli bigint not null check (fuel_before_milli between 0 and 480000),
  fuel_after_milli bigint not null check (fuel_after_milli between 0 and 480000),
  hull_before_milli bigint not null check (hull_before_milli between 0 and 380000),
  hull_after_milli bigint not null check (hull_after_milli between 0 and 380000),
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict
);
alter table public.online_recovery_ledger enable row level security;
revoke all on public.online_recovery_ledger from public, anon, authenticated;
grant select on public.online_recovery_ledger to authenticated;
create policy online_recovery_ledger_owner_read on public.online_recovery_ledger
  for select to authenticated using (owner_id=(select auth.uid()));

create function public.recover_online_stranded_pod(
  p_campaign_id uuid, p_expected_revision bigint,
  p_operation_id uuid, p_session_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_recovery_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_fuel bigint;
  v_hull bigint;
  v_fuel_level bigint;
  v_hull_level bigint;
  v_max_fuel bigint;
  v_max_hull bigint;
  v_wallet bigint;
  v_cargo jsonb;
  v_hash text;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null then
    raise exception 'INVALID_COMMAND' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('campaign_id',p_campaign_id,
      'expected_revision',p_expected_revision,'session_id',p_session_id)::text,
    'UTF8')), 'hex');
  select * into v_prior from public.online_recovery_operations
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
  if v_campaign.ruleset_version <> 'online-1' or v_campaign.active_planet not in ('cryo-shelf','mars-frontier') then
    raise exception 'RULESET_MISMATCH' using errcode='22023';
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
  v_fuel := (v_snapshot->>'fuel_milli')::bigint;
  v_hull := (v_snapshot->>'hull_milli')::bigint;
  v_fuel_level := (v_snapshot->'levels'->>'fuel')::bigint;
  v_hull_level := (v_snapshot->'levels'->>'hull')::bigint;
  if v_fuel_level is null or v_fuel_level not between 1 and 5
     or v_hull_level is null or v_hull_level not between 1 and 5 then
    raise exception 'INVALID_STATE' using errcode='23514';
  end if;
  v_max_fuel := case v_fuel_level when 1 then 140000 when 2 then 190000
    when 3 then 260000 when 4 then 350000 when 5 then 480000 end;
  v_max_hull := case v_hull_level when 1 then 100000 when 2 then 140000
    when 3 then 195000 when 4 then 270000 when 5 then 380000 end;
  if v_fuel is null or v_fuel not between 0 and v_max_fuel
     or v_hull is null or v_hull not between 0 and v_max_hull then
    raise exception 'INVALID_STATE' using errcode='23514';
  end if;
  if v_fuel > 0 and v_hull > 0 then
    raise exception 'RECOVERY_NOT_NEEDED' using errcode='22023';
  end if;
  select credit_minor into v_wallet from public.online_wallets
    where campaign_id=p_campaign_id and owner_id=v_owner;
  if v_wallet is null then raise exception 'INVALID_STATE' using errcode='23514'; end if;
  select coalesce(pg_catalog.jsonb_object_agg(ore,quantity_half_units),'{}'::jsonb)
    into v_cargo from public.online_inventory
    where campaign_id=p_campaign_id and owner_id=v_owner and location_key='miner';

  delete from public.online_inventory where campaign_id=p_campaign_id
    and owner_id=v_owner and location_key='miner';
  update public.online_simulation_state set snapshot=v_snapshot ||
    pg_catalog.jsonb_build_object(
      'pod',pg_catalog.jsonb_build_object('x',680,'y',-22,'vx',0,'vy',0,'docked',true),
      'fuel_milli',v_max_fuel,'hull_milli',v_max_hull,
      'drill_target',null,'drill_elapsed_ms',0,
      'core_extraction_elapsed_ms',0,'input_budget_ms',1000,
      'observed_at_ms',pg_catalog.floor(pg_catalog.date_part('epoch',
        pg_catalog.clock_timestamp()) * 1000)::bigint),
    updated_at=pg_catalog.clock_timestamp() where campaign_id=p_campaign_id;
  update public.online_campaigns set revision=revision+1,
    session_expires_at=pg_catalog.clock_timestamp()+interval '30 seconds',
    updated_at=pg_catalog.clock_timestamp() where id=p_campaign_id;
  insert into public.online_recovery_ledger(owner_id,operation_id,campaign_id,
    forfeited_cargo_half_units,fuel_before_milli,fuel_after_milli,
    hull_before_milli,hull_after_milli)
    values(v_owner,p_operation_id,p_campaign_id,v_cargo,v_fuel,v_max_fuel,
      v_hull,v_max_hull);
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id',p_operation_id,'campaign_id',p_campaign_id,
    'kind','recover_stranded_pod','revision',p_expected_revision+1,
    'forfeited_cargo_half_units',v_cargo,'wallet_after_minor',v_wallet,
    'fuel_before_milli',v_fuel,'fuel_after_milli',v_max_fuel,
    'hull_before_milli',v_hull,'hull_after_milli',v_max_hull,
    'occurred_at',pg_catalog.clock_timestamp());
  insert into public.online_recovery_operations(owner_id,operation_id,campaign_id,
    input_hash,receipt) values(v_owner,p_operation_id,p_campaign_id,v_hash,v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.recover_online_stranded_pod(uuid,bigint,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.recover_online_stranded_pod(uuid,bigint,uuid,uuid)
  to authenticated;
