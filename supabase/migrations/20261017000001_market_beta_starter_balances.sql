-- Give every newly created beta market account a bounded, non-transferable
-- starting balance so two testers can exercise the order book immediately.
-- These balances are test credits and test ore, not the CREDIT token or
-- campaign inventory. They have no cash value.

alter table public.market_ledger
  drop constraint if exists market_ledger_event_check;
alter table public.market_ledger
  add constraint market_ledger_event_check
  check (event in ('listing_created','listing_cancelled','trade_fill','admin_grant','beta_starter'));

create table public.market_beta_faucet (
  singleton boolean primary key default true check (singleton),
  credits_remaining bigint not null check (credits_remaining >= 0),
  copper_remaining bigint not null check (copper_remaining >= 0),
  iron_remaining bigint not null check (iron_remaining >= 0)
);
insert into public.market_beta_faucet(singleton, credits_remaining, copper_remaining, iron_remaining)
values (true, 1000000, 20000, 20000);
alter table public.market_beta_faucet enable row level security;
revoke all on public.market_beta_faucet from anon, authenticated;

create or replace function public.market_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One database row caps the total faucet supply at 200 starter accounts.
  -- The conditional update serializes concurrent signups without trusting
  -- the caller, a browser field, or a service key.
  update public.market_beta_faucet
    set credits_remaining = credits_remaining - 5000,
        copper_remaining = copper_remaining - 100,
        iron_remaining = iron_remaining - 100
    where singleton = true
      and credits_remaining >= 5000
      and copper_remaining >= 100
      and iron_remaining >= 100;
  if not found then raise exception 'The beta starter supply is full.' using errcode = '54000'; end if;

  insert into public.market_profiles(user_id, handle)
  values (new.id, 'prospector_' || replace(substr(new.id::text, 1, 8), '-', ''));

  insert into public.market_wallets(user_id, available_credits)
  values (new.id, 5000);

  insert into public.market_inventory(user_id, ore, available_units)
  values (new.id, 'copper', 100), (new.id, 'iron', 100);

  insert into public.market_ledger(actor_id, event, ore, units, credits)
  values
    (new.id, 'beta_starter', 'copper', 100, 0),
    (new.id, 'beta_starter', 'iron', 100, 0),
    (new.id, 'beta_starter', null, 0, 5000);

  return new;
end;
$$;

-- If any tester accounts were created before this migration is applied,
-- grant the same starter pack once and charge it against the shared cap.
do $$
declare
  v_user uuid;
begin
  for v_user in
    select p.user_id
    from public.market_profiles p
    where not exists (
      select 1 from public.market_ledger l
      where l.actor_id = p.user_id and l.event = 'beta_starter'
    )
    order by p.created_at, p.user_id
    for update of p
  loop
    update public.market_beta_faucet
      set credits_remaining = credits_remaining - 5000,
          copper_remaining = copper_remaining - 100,
          iron_remaining = iron_remaining - 100
      where singleton = true
        and credits_remaining >= 5000
        and copper_remaining >= 100
        and iron_remaining >= 100;
    if not found then raise exception 'The beta starter supply is full while migrating existing accounts.' using errcode = '54000'; end if;

    update public.market_wallets
      set available_credits = available_credits + 5000, updated_at = now()
      where user_id = v_user;
    if not found then raise exception 'Market wallet missing for existing account %.', v_user using errcode = 'P0001'; end if;

    insert into public.market_inventory(user_id, ore, available_units)
    values (v_user, 'copper', 100), (v_user, 'iron', 100)
    on conflict (user_id, ore) do update
      set available_units = public.market_inventory.available_units + excluded.available_units,
          updated_at = now();

    insert into public.market_ledger(actor_id, event, ore, units, credits)
    values
      (v_user, 'beta_starter', 'copper', 100, 0),
      (v_user, 'beta_starter', 'iron', 100, 0),
      (v_user, 'beta_starter', null, 0, 5000);
  end loop;
end;
$$;
