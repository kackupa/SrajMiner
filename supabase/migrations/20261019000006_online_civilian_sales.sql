-- M4 civilian credit issuance. Ore and payout come from canonical campaign
-- rows and these versioned online-1 prices/projects, never browser balances.
create table public.online_civilian_projects (
  buyer text not null check (buyer in ('helion','kepler','verdant','lyra')),
  sequence integer not null check (sequence between 1 and 3),
  name text not null,
  ore text not null check (ore in
    ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  target_half_units bigint not null check (target_half_units > 0),
  primary key (buyer, sequence)
);
revoke all on public.online_civilian_projects from public, anon, authenticated;
grant select on public.online_civilian_projects to authenticated;
insert into public.online_civilian_projects(buyer,sequence,name,ore,target_half_units) values
  ('helion',1,'Eastern power grid','copper',48),
  ('helion',2,'Harbour rail extension','iron',64),
  ('helion',3,'Stormproof substations','cobalt',24),
  ('kepler',1,'Freighter repair berths','nickel',36),
  ('kepler',2,'Long-haul hull programme','titanium',32),
  ('kepler',3,'Navigation contacts','gold',20),
  ('verdant',1,'Northern irrigation ring','iron',40),
  ('verdant',2,'Greenhouse distribution','copper',56),
  ('verdant',3,'Cold-store controls','silver',24),
  ('lyra',1,'Precision instrument array','silver',36),
  ('lyra',2,'Deep-pressure laboratory','diamond',16),
  ('lyra',3,'Cryogenic resonator study','cryocrystal',24);

create table public.online_civilian_deliveries (
  campaign_id uuid not null,
  owner_id uuid not null,
  buyer text not null check (buyer in ('helion','kepler','verdant','lyra')),
  ore text not null check (ore in
    ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  delivered_half_units bigint not null check (delivered_half_units >= 0),
  primary key (campaign_id,buyer,ore),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict
);
alter table public.online_civilian_deliveries enable row level security;
revoke all on public.online_civilian_deliveries from public, anon, authenticated;
grant select on public.online_civilian_deliveries to authenticated;
create policy online_civilian_deliveries_owner_read on public.online_civilian_deliveries
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.online_civilian_sale_operations (
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
alter table public.online_civilian_sale_operations enable row level security;
revoke all on public.online_civilian_sale_operations from public, anon, authenticated;

create table public.online_civilian_sale_ledger (
  operation_id uuid not null,
  owner_id uuid not null,
  campaign_id uuid not null,
  buyer text not null,
  source text not null,
  ore text not null,
  quantity_half_units bigint not null check (quantity_half_units > 0),
  gross_credit_minor bigint not null check (gross_credit_minor >= 0),
  bonus_credit_minor bigint not null check (bonus_credit_minor >= 0),
  total_credit_minor bigint not null check (total_credit_minor > 0),
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id),
  foreign key (campaign_id,owner_id)
    references public.online_campaigns(id,owner_id) on delete restrict,
  check (total_credit_minor = gross_credit_minor + bonus_credit_minor)
);
alter table public.online_civilian_sale_ledger enable row level security;
revoke all on public.online_civilian_sale_ledger from public, anon, authenticated;
grant select on public.online_civilian_sale_ledger to authenticated;
create policy online_civilian_sale_ledger_owner_read on public.online_civilian_sale_ledger
  for select to authenticated using (owner_id = (select auth.uid()));

create function public.sell_online_ore_to_civilian(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_session_id uuid,
  p_source text,
  p_buyer text,
  p_ore text,
  p_quantity_half_units bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_prior public.online_civilian_sale_operations%rowtype;
  v_campaign public.online_campaigns%rowtype;
  v_snapshot jsonb;
  v_pod jsonb;
  v_stock bigint;
  v_wallet bigint;
  v_unit_value bigint;
  v_project text;
  v_project_ore text;
  v_project_target bigint;
  v_project_delivered bigint;
  v_qualifying bigint := 0;
  v_gross bigint;
  v_bonus bigint;
  v_total bigint;
  v_hash text;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_session_id is null
     or p_source is null or p_source not in ('miner','ship')
     or p_buyer is null or p_buyer not in ('helion','kepler','verdant','lyra')
     or p_ore is null or p_ore not in
       ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')
     or p_quantity_half_units is null or p_quantity_half_units not between 1 and 100 then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('campaign_id',p_campaign_id,
      'expected_revision',p_expected_revision,'session_id',p_session_id,
      'source',p_source,'buyer',p_buyer,'ore',p_ore,
      'quantity_half_units',p_quantity_half_units)::text, 'UTF8'
  )), 'hex');
  select * into v_prior from public.online_civilian_sale_operations
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
  if not exists (select 1 from public.online_structures where campaign_id=p_campaign_id
      and owner_id=v_owner and planet=v_campaign.active_planet and kind='trade-post') then
    raise exception 'ACCESS_REQUIRED' using errcode = '42501';
  end if;
  select snapshot into v_snapshot from public.online_simulation_state
    where campaign_id=p_campaign_id and owner_id=v_owner;
  v_pod := v_snapshot->'pod';
  if v_pod is null or pg_catalog.jsonb_typeof(v_pod) <> 'object'
     or (v_pod->>'y')::numeric not between -100 and 0
     or ((v_pod->>'x')::numeric - 555) ^ 2
        + ((v_pod->>'y')::numeric + 22) ^ 2 >= 190 ^ 2 then
    raise exception 'ACCESS_REQUIRED' using errcode = '42501';
  end if;

  select quantity_half_units into v_stock from public.online_inventory
    where campaign_id=p_campaign_id and owner_id=v_owner
      and location_key=p_source and ore=p_ore;
  v_stock := coalesce(v_stock,0);
  if v_stock < p_quantity_half_units then
    raise exception 'INSUFFICIENT_ORE' using errcode = '22023';
  end if;
  select credit_minor into v_wallet from public.online_wallets
    where campaign_id=p_campaign_id and owner_id=v_owner;
  if v_wallet is null then raise exception 'INVALID_STATE' using errcode = '23514'; end if;
  v_unit_value := case p_ore
    when 'copper' then 18 when 'iron' then 28 when 'silver' then 55
    when 'gold' then 105 when 'diamond' then 260 when 'nickel' then 72
    when 'titanium' then 155 when 'cobalt' then 125 when 'cryocrystal' then 210
  end;
  v_gross := p_quantity_half_units * v_unit_value * 50;
  select project.name, project.ore, project.target_half_units,
      coalesce(delivery.delivered_half_units,0)
    into v_project,v_project_ore,v_project_target,v_project_delivered
    from public.online_civilian_projects project
    left join public.online_civilian_deliveries delivery
      on delivery.campaign_id=p_campaign_id and delivery.owner_id=v_owner
        and delivery.buyer=project.buyer and delivery.ore=project.ore
    where project.buyer=p_buyer
      and coalesce(delivery.delivered_half_units,0) < project.target_half_units
    order by project.sequence limit 1;
  if v_project_ore = p_ore then
    v_qualifying := least(p_quantity_half_units,v_project_target-v_project_delivered);
  end if;
  -- Local rule: floor(qualifying ore units * ore value * 0.35) credits.
  v_bonus := pg_catalog.floor(v_qualifying::numeric * v_unit_value * 35 / 200)::bigint * 100;
  v_total := v_gross + v_bonus;
  if v_wallet > 9007199254740991 - v_total then
    raise exception 'CREDIT_LIMIT' using errcode = '22003';
  end if;

  update public.online_inventory set quantity_half_units=v_stock-p_quantity_half_units,
    updated_at=pg_catalog.clock_timestamp()
    where campaign_id=p_campaign_id and location_key=p_source and ore=p_ore;
  update public.online_wallets set credit_minor=v_wallet+v_total,
    updated_at=pg_catalog.clock_timestamp() where campaign_id=p_campaign_id;
  insert into public.online_civilian_deliveries(campaign_id,owner_id,buyer,ore,delivered_half_units)
    values (p_campaign_id,v_owner,p_buyer,p_ore,p_quantity_half_units)
    on conflict (campaign_id,buyer,ore) do update
      set delivered_half_units=public.online_civilian_deliveries.delivered_half_units
        + excluded.delivered_half_units;
  update public.online_campaigns set revision=revision+1,
    session_expires_at=pg_catalog.clock_timestamp()+interval '30 seconds',
    updated_at=pg_catalog.clock_timestamp() where id=p_campaign_id;
  insert into public.online_civilian_sale_ledger(operation_id,owner_id,campaign_id,buyer,
    source,ore,quantity_half_units,gross_credit_minor,bonus_credit_minor,total_credit_minor)
    values (p_operation_id,v_owner,p_campaign_id,p_buyer,p_source,p_ore,
      p_quantity_half_units,v_gross,v_bonus,v_total);
  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id',p_operation_id,'campaign_id',p_campaign_id,
    'kind','sell_to_civilian','revision',p_expected_revision+1,
    'source',p_source,'buyer',p_buyer,'ore',p_ore,
    'quantity_half_units',p_quantity_half_units,
    'gross_credit_minor',v_gross,'bonus_credit_minor',v_bonus,
    'total_credit_minor',v_total,'wallet_after_minor',v_wallet+v_total,
    'project',v_project,'occurred_at',pg_catalog.clock_timestamp()
  );
  insert into public.online_civilian_sale_operations(owner_id,operation_id,campaign_id,
    input_hash,receipt) values (v_owner,p_operation_id,p_campaign_id,v_hash,v_receipt);
  return v_receipt;
end;
$$;
revoke all on function public.sell_online_ore_to_civilian(uuid,bigint,uuid,uuid,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.sell_online_ore_to_civilian(uuid,bigint,uuid,uuid,text,text,text,bigint)
  to authenticated;

-- Read-only offer from current server stock and project progress. A sale still
-- checks revision and recomputes the payout in its own locked transaction.
create function public.quote_online_civilian_sale(
  p_campaign_id uuid,
  p_source text,
  p_buyer text,
  p_ore text,
  p_quantity_half_units bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
  v_pod jsonb;
  v_stock bigint;
  v_unit_value bigint;
  v_project text;
  v_project_ore text;
  v_project_target bigint;
  v_project_delivered bigint;
  v_qualifying bigint := 0;
  v_gross bigint;
  v_bonus bigint;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_campaign_id is null or p_source is null or p_source not in ('miner','ship')
     or p_buyer is null or p_buyer not in ('helion','kepler','verdant','lyra')
     or p_ore is null or p_ore not in
       ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')
     or p_quantity_half_units is null or p_quantity_half_units not between 1 and 100 then
    raise exception 'INVALID_COMMAND' using errcode='22023';
  end if;
  select * into v_campaign from public.online_campaigns
    where id=p_campaign_id and owner_id=v_owner for share;
  if not found then raise exception 'ACCESS_REQUIRED' using errcode='42501'; end if;
  if v_campaign.ruleset_version <> 'online-1' or v_campaign.active_planet not in ('cryo-shelf','mars-frontier') then
    raise exception 'RULESET_MISMATCH' using errcode='22023';
  end if;
  if not exists (select 1 from public.online_structures where campaign_id=p_campaign_id
      and owner_id=v_owner and planet=v_campaign.active_planet and kind='trade-post') then
    raise exception 'ACCESS_REQUIRED' using errcode='42501';
  end if;
  select snapshot->'pod' into v_pod from public.online_simulation_state
    where campaign_id=p_campaign_id and owner_id=v_owner;
  if v_pod is null or pg_catalog.jsonb_typeof(v_pod) <> 'object'
     or (v_pod->>'y')::numeric not between -100 and 0
     or ((v_pod->>'x')::numeric - 555) ^ 2
        + ((v_pod->>'y')::numeric + 22) ^ 2 >= 190 ^ 2 then
    raise exception 'ACCESS_REQUIRED' using errcode='42501';
  end if;
  select quantity_half_units into v_stock from public.online_inventory
    where campaign_id=p_campaign_id and owner_id=v_owner
      and location_key=p_source and ore=p_ore;
  v_stock := coalesce(v_stock,0);
  if v_stock < p_quantity_half_units then
    raise exception 'INSUFFICIENT_ORE' using errcode='22023';
  end if;
  v_unit_value := case p_ore
    when 'copper' then 18 when 'iron' then 28 when 'silver' then 55
    when 'gold' then 105 when 'diamond' then 260 when 'nickel' then 72
    when 'titanium' then 155 when 'cobalt' then 125 when 'cryocrystal' then 210
  end;
  v_gross := p_quantity_half_units * v_unit_value * 50;
  select project.name,project.ore,project.target_half_units,
      coalesce(delivery.delivered_half_units,0)
    into v_project,v_project_ore,v_project_target,v_project_delivered
    from public.online_civilian_projects project
    left join public.online_civilian_deliveries delivery
      on delivery.campaign_id=p_campaign_id and delivery.owner_id=v_owner
        and delivery.buyer=project.buyer and delivery.ore=project.ore
    where project.buyer=p_buyer
      and coalesce(delivery.delivered_half_units,0) < project.target_half_units
    order by project.sequence limit 1;
  if v_project_ore=p_ore then
    v_qualifying := least(p_quantity_half_units,v_project_target-v_project_delivered);
  end if;
  v_bonus := pg_catalog.floor(v_qualifying::numeric * v_unit_value * 35 / 200)::bigint * 100;
  return pg_catalog.jsonb_build_object(
    'campaign_id',p_campaign_id,'revision',v_campaign.revision,
    'source',p_source,'buyer',p_buyer,'ore',p_ore,
    'quantity_half_units',p_quantity_half_units,
    'gross_credit_minor',v_gross,'bonus_credit_minor',v_bonus,
    'total_credit_minor',v_gross+v_bonus,'project',v_project,
    'source_available_half_units',v_stock
  );
end;
$$;
revoke all on function public.quote_online_civilian_sale(uuid,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.quote_online_civilian_sale(uuid,text,text,text,bigint)
  to authenticated;
