-- Ore Frontier private beta player market.
-- Campaign saves remain local and are never imported into this ledger.

create type public.market_side as enum ('sell', 'buy');
create type public.market_listing_status as enum ('open', 'filled', 'cancelled');

create table public.market_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  created_at timestamptz not null default now()
);

create table public.market_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_credits bigint not null default 0 check (available_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  updated_at timestamptz not null default now()
);

create table public.market_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  ore text not null check (ore in ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  available_units bigint not null default 0 check (available_units >= 0),
  reserved_units bigint not null default 0 check (reserved_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, ore)
);

create table public.market_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  side public.market_side not null,
  ore text not null check (ore in ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  original_units integer not null check (original_units between 1 and 1000),
  remaining_units integer not null check (remaining_units between 0 and original_units),
  unit_price bigint not null check (unit_price between 1 and 100000),
  status public.market_listing_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open' and remaining_units > 0) or (status <> 'open' and remaining_units = 0))
);

create index market_listings_book_idx on public.market_listings (ore, side, unit_price, created_at) where status = 'open';
create index market_listings_owner_idx on public.market_listings (owner_id, created_at desc);

create table public.market_ledger (
  id bigint generated always as identity primary key,
  listing_id uuid references public.market_listings(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  counterparty_id uuid references auth.users(id) on delete restrict,
  event text not null check (event in ('listing_created','listing_cancelled','trade_fill','admin_grant')),
  side public.market_side,
  ore text check (ore is null or ore in ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal')),
  units integer not null default 0 check (units >= 0),
  credits bigint not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

create index market_ledger_actor_idx on public.market_ledger (actor_id, created_at desc);
create index market_ledger_counterparty_idx on public.market_ledger (counterparty_id, created_at desc);

create or replace function public.market_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.market_profiles(user_id, handle)
  values (new.id, 'prospector_' || replace(substr(new.id::text, 1, 8), '-', ''));
  insert into public.market_wallets(user_id) values (new.id);
  return new;
end;
$$;

create trigger market_auth_user_created
after insert on auth.users
for each row execute function public.market_new_account();

create or replace function public.market_create_listing(
  p_side public.market_side,
  p_ore text,
  p_units integer,
  p_unit_price bigint
)
returns public.market_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings;
  v_open_count integer;
  v_total bigint;
begin
  if v_user is null then raise exception 'Sign in to use the market.' using errcode = '28000'; end if;
  -- Serialize each account's order-count check and reservation changes.
  perform 1 from public.market_profiles where user_id = v_user for update;
  if not found then raise exception 'Market account is not initialized.' using errcode = 'P0001'; end if;
  if p_ore not in ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal') then
    raise exception 'Unknown ore.' using errcode = '22023';
  end if;
  if p_units is null or p_units < 1 or p_units > 1000 or p_unit_price is null or p_unit_price < 1 or p_unit_price > 100000 then
    raise exception 'Check the order quantity and unit price.' using errcode = '22023';
  end if;
  v_total := p_units::bigint * p_unit_price;
  if v_total > 10000000 then raise exception 'Order value exceeds the beta limit.' using errcode = '22023'; end if;

  select count(*) into v_open_count from public.market_listings where owner_id = v_user and status = 'open';
  if v_open_count >= 10 then raise exception 'You already have 10 open orders.' using errcode = '54000'; end if;

  if p_side = 'sell' then
    update public.market_inventory
      set available_units = available_units - p_units,
          reserved_units = reserved_units + p_units,
          updated_at = now()
      where user_id = v_user and ore = p_ore and available_units >= p_units;
    if not found then raise exception 'Not enough available ore.' using errcode = 'P0001'; end if;
  else
    update public.market_wallets
      set available_credits = available_credits - v_total,
          reserved_credits = reserved_credits + v_total,
          updated_at = now()
      where user_id = v_user and available_credits >= v_total;
    if not found then raise exception 'Not enough available credits.' using errcode = 'P0001'; end if;
  end if;

  insert into public.market_listings(owner_id, side, ore, original_units, remaining_units, unit_price)
  values (v_user, p_side, p_ore, p_units, p_units, p_unit_price)
  returning * into v_listing;

  insert into public.market_ledger(listing_id, actor_id, event, side, ore, units, credits)
  values (v_listing.id, v_user, 'listing_created', p_side, p_ore, p_units, v_total);
  return v_listing;
end;
$$;

create or replace function public.market_fill_listing(p_listing_id uuid, p_units integer)
returns public.market_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings;
  v_cost bigint;
begin
  if v_user is null then raise exception 'Sign in to use the market.' using errcode = '28000'; end if;
  if p_units is null or p_units < 1 then raise exception 'Choose a positive quantity.' using errcode = '22023'; end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found or v_listing.status <> 'open' then raise exception 'This order is no longer open.' using errcode = 'P0001'; end if;
  if v_listing.owner_id = v_user then raise exception 'You cannot fill your own order.' using errcode = '42501'; end if;
  if p_units > v_listing.remaining_units then raise exception 'Order quantity changed; refresh the market.' using errcode = '22023'; end if;
  v_cost := p_units::bigint * v_listing.unit_price;

  if v_listing.side = 'sell' then
    update public.market_wallets
      set available_credits = available_credits - v_cost, updated_at = now()
      where user_id = v_user and available_credits >= v_cost;
    if not found then raise exception 'Not enough available credits.' using errcode = 'P0001'; end if;
    update public.market_inventory
      set reserved_units = reserved_units - p_units, updated_at = now()
      where user_id = v_listing.owner_id and ore = v_listing.ore and reserved_units >= p_units;
    if not found then raise exception 'Reserved ore is unavailable; contact support.' using errcode = 'P0001'; end if;
    insert into public.market_inventory(user_id, ore, available_units)
      values (v_user, v_listing.ore, p_units)
      on conflict (user_id, ore) do update set available_units = public.market_inventory.available_units + excluded.available_units, updated_at = now();
    update public.market_wallets set available_credits = available_credits + v_cost, updated_at = now() where user_id = v_listing.owner_id;
  else
    update public.market_inventory
      set available_units = available_units - p_units, updated_at = now()
      where user_id = v_user and ore = v_listing.ore and available_units >= p_units;
    if not found then raise exception 'Not enough available ore.' using errcode = 'P0001'; end if;
    update public.market_wallets
      set reserved_credits = reserved_credits - v_cost, updated_at = now()
      where user_id = v_listing.owner_id and reserved_credits >= v_cost;
    if not found then raise exception 'Reserved credits are unavailable; contact support.' using errcode = 'P0001'; end if;
    insert into public.market_inventory(user_id, ore, available_units)
      values (v_listing.owner_id, v_listing.ore, p_units)
      on conflict (user_id, ore) do update set available_units = public.market_inventory.available_units + excluded.available_units, updated_at = now();
    update public.market_wallets set available_credits = available_credits + v_cost, updated_at = now() where user_id = v_user;
  end if;

  update public.market_listings
    set remaining_units = remaining_units - p_units,
        status = case when remaining_units - p_units = 0 then 'filled'::public.market_listing_status else 'open'::public.market_listing_status end,
        updated_at = now()
    where id = v_listing.id returning * into v_listing;

  insert into public.market_ledger(listing_id, actor_id, counterparty_id, event, side, ore, units, credits)
  values (v_listing.id, v_user, v_listing.owner_id, 'trade_fill', v_listing.side, v_listing.ore, p_units, v_cost);
  return v_listing;
end;
$$;

create or replace function public.market_cancel_listing(p_listing_id uuid)
returns public.market_listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings;
  v_release bigint;
  v_cancelled_units integer;
begin
  if v_user is null then raise exception 'Sign in to use the market.' using errcode = '28000'; end if;
  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found or v_listing.status <> 'open' then raise exception 'This order is no longer open.' using errcode = 'P0001'; end if;
  if v_listing.owner_id <> v_user then raise exception 'Only the order owner can cancel it.' using errcode = '42501'; end if;
  v_cancelled_units := v_listing.remaining_units;
  v_release := v_listing.remaining_units::bigint * v_listing.unit_price;

  if v_listing.side = 'sell' then
    update public.market_inventory
      set available_units = available_units + v_listing.remaining_units,
          reserved_units = reserved_units - v_listing.remaining_units,
          updated_at = now()
      where user_id = v_user and ore = v_listing.ore and reserved_units >= v_listing.remaining_units;
    if not found then raise exception 'Reserved ore is unavailable; contact support.' using errcode = 'P0001'; end if;
  else
    update public.market_wallets
      set available_credits = available_credits + v_release,
          reserved_credits = reserved_credits - v_release,
          updated_at = now()
      where user_id = v_user and reserved_credits >= v_release;
    if not found then raise exception 'Reserved credits are unavailable; contact support.' using errcode = 'P0001'; end if;
  end if;

  update public.market_listings set remaining_units = 0, status = 'cancelled', updated_at = now()
  where id = v_listing.id returning * into v_listing;
  insert into public.market_ledger(listing_id, actor_id, event, side, ore, units, credits)
  values (v_listing.id, v_user, 'listing_cancelled', v_listing.side, v_listing.ore, v_cancelled_units, v_release);
  return v_listing;
end;
$$;

-- This function is intentionally callable only with the server-side service-role key.
-- It creates a capped playtest grant and must never be wired to a browser route.
create or replace function public.market_admin_grant(
  p_user_id uuid,
  p_ore text,
  p_units integer,
  p_credits bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden.' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'Player is required.' using errcode = '22023'; end if;
  select user_id into v_wallet_user from public.market_wallets where user_id = p_user_id for update;
  if not found then raise exception 'Market account is not initialized.' using errcode = 'P0001'; end if;
  if p_units < 0 or p_units > 500 or p_credits < 0 or p_credits > 50000 then
    raise exception 'Playtest grant exceeds its cap.' using errcode = '22023';
  end if;
  if p_ore is not null and p_ore not in ('copper','iron','silver','gold','diamond','nickel','titanium','cobalt','cryocrystal') then
    raise exception 'Unknown ore.' using errcode = '22023';
  end if;
  if p_ore is not null and p_units > 0 then
    insert into public.market_inventory(user_id, ore, available_units)
    values (p_user_id, p_ore, p_units)
    on conflict (user_id, ore) do update set available_units = public.market_inventory.available_units + excluded.available_units, updated_at = now();
  end if;
  if p_credits > 0 then
    update public.market_wallets set available_credits = available_credits + p_credits, updated_at = now() where user_id = p_user_id;
  end if;
  insert into public.market_ledger(actor_id, event, ore, units, credits)
  values (p_user_id, 'admin_grant', p_ore, p_units, p_credits);
end;
$$;

create or replace function public.market_ledger_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Market ledger entries are immutable.' using errcode = '42501';
end;
$$;
create trigger market_ledger_no_update before update or delete on public.market_ledger
for each row execute function public.market_ledger_immutable();

alter table public.market_profiles enable row level security;
alter table public.market_wallets enable row level security;
alter table public.market_inventory enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_ledger enable row level security;

create policy "Profiles are visible to signed-in players" on public.market_profiles
for select to authenticated using (true);
create policy "Players read their wallet" on public.market_wallets
for select to authenticated using (user_id = auth.uid());
create policy "Players read their inventory" on public.market_inventory
for select to authenticated using (user_id = auth.uid());
create policy "Players read open orders and their own history" on public.market_listings
for select to authenticated using (status = 'open' or owner_id = auth.uid());
create policy "Players read their own market ledger" on public.market_ledger
for select to authenticated using (actor_id = auth.uid() or counterparty_id = auth.uid());

revoke all on public.market_profiles, public.market_wallets, public.market_inventory, public.market_listings, public.market_ledger from anon, authenticated;
grant select on public.market_profiles, public.market_listings to authenticated;
grant select on public.market_wallets, public.market_inventory, public.market_ledger to authenticated;
grant usage on type public.market_side, public.market_listing_status to authenticated, service_role;
revoke all on function public.market_create_listing(public.market_side, text, integer, bigint) from public, anon;
revoke all on function public.market_fill_listing(uuid, integer) from public, anon;
revoke all on function public.market_cancel_listing(uuid) from public, anon;
revoke all on function public.market_admin_grant(uuid, text, integer, bigint) from public, anon, authenticated;
grant execute on function public.market_create_listing(public.market_side, text, integer, bigint) to authenticated;
grant execute on function public.market_fill_listing(uuid, integer) to authenticated;
grant execute on function public.market_cancel_listing(uuid) to authenticated;
grant execute on function public.market_admin_grant(uuid, text, integer, bigint) to service_role;
