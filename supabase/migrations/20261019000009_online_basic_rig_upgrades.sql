-- M4 first five basic rig tracks. The online-1 price table mirrors the Local
-- versioned material rule in config.ts: base units times fitted level.
alter table public.online_operation_registry
  drop constraint online_operation_registry_kind_check;
alter table public.online_operation_registry
  add constraint online_operation_registry_kind_check check (kind in
    ('start','game','transfer','structure','civilian_sale','service','upgrade'));

create table public.online_upgrade_material_prices (
  upgrade_key text not null check (upgrade_key in ('drill','fuel','cargo','hull','engine')),
  ore text not null check (ore in ('copper','iron','silver')),
  base_units bigint not null check (base_units > 0),
  primary key (upgrade_key,ore)
);
revoke all on public.online_upgrade_material_prices from public, anon, authenticated;
grant select on public.online_upgrade_material_prices to authenticated;
insert into public.online_upgrade_material_prices(upgrade_key,ore,base_units) values
  ('drill','iron',3),('drill','copper',2),
  ('fuel','copper',3),('fuel','silver',1),
  ('cargo','iron',3),('cargo','copper',3),
  ('hull','iron',4),('hull','copper',1),
  ('engine','copper',3),('engine','iron',2);

create table public.online_upgrade_operations (
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
alter table public.online_upgrade_operations enable row level security;
revoke all on public.online_upgrade_operations from public, anon, authenticated;
create trigger online_upgrade_register_operation
  before insert on public.online_upgrade_operations for each row
  execute function public.register_online_operation('upgrade');

create table public.online_upgrade_ledger (
  owner_id uuid not null,
  operation_id uuid not null,
  campaign_id uuid not null,
  upgrade_key text not null check (upgrade_key in ('drill','fuel','cargo','hull','engine')),
  level_before bigint not null check (level_before between 1 and 4),
  level_after bigint not null check (level_after between 2 and 5),
  material_debits jsonb not null check (pg_catalog.jsonb_typeof(material_debits)='array'),
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict,
  check (level_after=level_before+1)
);
alter table public.online_upgrade_ledger enable row level security;
revoke all on public.online_upgrade_ledger from public, anon, authenticated;
grant select on public.online_upgrade_ledger to authenticated;
create policy online_upgrade_ledger_owner_read on public.online_upgrade_ledger
  for select to authenticated using (owner_id=(select auth.uid()));

create function public.install_online_rig_upgrade(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_session_id uuid,
  p_upgrade_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_upgrade_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_pod jsonb;
  v_level bigint;
  v_ore text;
  v_units bigint;
  v_cost bigint;
  v_miner bigint;
  v_ship bigint;
  v_from_miner bigint;
  v_from_ship bigint;
  v_old_cap bigint;
  v_new_cap bigint;
  v_debits jsonb := '[]'::jsonb;
  v_hash text;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null or p_upgrade_key is null
     or p_upgrade_key not in ('drill','fuel','cargo','hull','engine') then
    raise exception 'INVALID_COMMAND' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('campaign_id',p_campaign_id,
      'expected_revision',p_expected_revision,'session_id',p_session_id,
      'upgrade_key',p_upgrade_key)::text,'UTF8')), 'hex');
  select * into v_prior from public.online_upgrade_operations
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
    where campaign_id=p_campaign_id and owner_id=v_owner;
  v_pod := v_snapshot->'pod';
  if v_pod is null or pg_catalog.jsonb_typeof(v_pod) <> 'object'
     or (v_pod->>'y')::numeric not between -100 and 0
     or ((v_pod->>'x')::numeric - 555) ^ 2
        + ((v_pod->>'y')::numeric + 22) ^ 2 >= 190 ^ 2 then
    raise exception 'ACCESS_REQUIRED' using errcode='42501';
  end if;
  v_level := (v_snapshot->'levels'->>p_upgrade_key)::bigint;
  if v_level is null or v_level not between 1 and 5 then
    raise exception 'INVALID_STATE' using errcode='23514';
  end if;
  if v_level >= 5 then raise exception 'UPGRADE_MAXED' using errcode='22023'; end if;

  for v_ore,v_units in select ore,base_units from public.online_upgrade_material_prices
    where upgrade_key=p_upgrade_key order by ore
  loop
    v_cost := v_units*v_level*2;
    select quantity_half_units into v_miner from public.online_inventory
      where campaign_id=p_campaign_id and owner_id=v_owner
        and location_key='miner' and ore=v_ore;
    v_miner := coalesce(v_miner,0);
    select quantity_half_units into v_ship from public.online_inventory
      where campaign_id=p_campaign_id and owner_id=v_owner
        and location_key='ship' and ore=v_ore;
    v_ship := coalesce(v_ship,0);
    if v_miner+v_ship < v_cost then
      raise exception 'INSUFFICIENT_ORE' using errcode='22023';
    end if;
    v_from_miner := least(v_miner,v_cost);
    v_from_ship := v_cost-v_from_miner;
    if v_from_miner > 0 then
      update public.online_inventory set quantity_half_units=v_miner-v_from_miner,
        updated_at=pg_catalog.clock_timestamp()
        where campaign_id=p_campaign_id and location_key='miner' and ore=v_ore;
    end if;
    if v_from_ship > 0 then
      update public.online_inventory set quantity_half_units=v_ship-v_from_ship,
        updated_at=pg_catalog.clock_timestamp()
        where campaign_id=p_campaign_id and location_key='ship' and ore=v_ore;
    end if;
    v_debits := v_debits || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ore',v_ore,'miner_half_units',v_from_miner,
      'ship_half_units',v_from_ship));
  end loop;

  v_snapshot := pg_catalog.jsonb_set(v_snapshot,
    array['levels',p_upgrade_key],pg_catalog.to_jsonb(v_level+1));
  if p_upgrade_key='fuel' then
    v_old_cap := case v_level when 1 then 140000 when 2 then 190000
      when 3 then 260000 when 4 then 350000 end;
    v_new_cap := case v_level+1 when 2 then 190000 when 3 then 260000
      when 4 then 350000 when 5 then 480000 end;
    v_snapshot := pg_catalog.jsonb_set(v_snapshot,'{fuel_milli}',
      pg_catalog.to_jsonb((v_snapshot->>'fuel_milli')::bigint+v_new_cap-v_old_cap));
  elsif p_upgrade_key='hull' then
    v_old_cap := case v_level when 1 then 100000 when 2 then 140000
      when 3 then 195000 when 4 then 270000 end;
    v_new_cap := case v_level+1 when 2 then 140000 when 3 then 195000
      when 4 then 270000 when 5 then 380000 end;
    v_snapshot := pg_catalog.jsonb_set(v_snapshot,'{hull_milli}',
      pg_catalog.to_jsonb((v_snapshot->>'hull_milli')::bigint+v_new_cap-v_old_cap));
  end if;
  update public.online_simulation_state set snapshot=v_snapshot,
    updated_at=pg_catalog.clock_timestamp() where campaign_id=p_campaign_id;
  update public.online_campaigns set revision=revision+1,
    session_expires_at=pg_catalog.clock_timestamp()+interval '30 seconds',
    updated_at=pg_catalog.clock_timestamp() where id=p_campaign_id;
  insert into public.online_upgrade_ledger(owner_id,operation_id,campaign_id,
    upgrade_key,level_before,level_after,material_debits)
    values (v_owner,p_operation_id,p_campaign_id,p_upgrade_key,
      v_level,v_level+1,v_debits);
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id',p_operation_id,'campaign_id',p_campaign_id,
    'kind','install_rig_upgrade','upgrade_key',p_upgrade_key,
    'level_before',v_level,'level_after',v_level+1,
    'material_debits',v_debits,'revision',p_expected_revision+1,
    'fuel_after_milli',v_snapshot->'fuel_milli',
    'hull_after_milli',v_snapshot->'hull_milli',
    'occurred_at',pg_catalog.clock_timestamp());
  insert into public.online_upgrade_operations(owner_id,operation_id,campaign_id,
    input_hash,receipt) values (v_owner,p_operation_id,p_campaign_id,v_hash,v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.install_online_rig_upgrade(uuid,bigint,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.install_online_rig_upgrade(uuid,bigint,uuid,uuid,text)
  to authenticated;
