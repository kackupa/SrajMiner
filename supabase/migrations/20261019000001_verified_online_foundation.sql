-- Empty verified-economy foundation. No browser write grant, import, faucet,
-- balance setter or starting-credit grant is provided by this migration.
-- A later reviewed start_campaign transaction must issue the first rows.
create table public.online_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  ruleset_version text not null check (ruleset_version = 'online-1'),
  revision bigint not null default 0 check (revision >= 0),
  active_planet text not null check (active_planet in
    ('cryo-shelf','mars-frontier','hull-graveyard','prism-fault','cinder-vale','vesper-9')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.online_wallets (
  campaign_id uuid primary key,
  owner_id uuid not null,
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, owner_id)
    references public.online_campaigns(id, owner_id) on delete restrict
);

create table public.online_inventory (
  campaign_id uuid not null,
  owner_id uuid not null,
  location_key text not null check (location_key = 'miner' or location_key = 'ship'
    or location_key in ('planet:cryo-shelf','planet:mars-frontier','planet:hull-graveyard',
      'planet:prism-fault','planet:cinder-vale','planet:vesper-9')),
  ore text not null check (ore in
    ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  quantity_half_units bigint not null check (quantity_half_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, location_key, ore),
  foreign key (campaign_id, owner_id)
    references public.online_campaigns(id, owner_id) on delete restrict
);

alter table public.online_campaigns enable row level security;
alter table public.online_wallets enable row level security;
alter table public.online_inventory enable row level security;
create policy online_campaign_owner_read on public.online_campaigns
  for select to authenticated using (owner_id = (select auth.uid()));
create policy online_wallet_owner_read on public.online_wallets
  for select to authenticated using (owner_id = (select auth.uid()));
create policy online_inventory_owner_read on public.online_inventory
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.online_campaigns, public.online_wallets, public.online_inventory
  from public, anon, authenticated;
grant select on public.online_campaigns, public.online_wallets, public.online_inventory
  to authenticated;
