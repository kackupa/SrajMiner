-- Server-issued online campaign identity. This does not enable gameplay or
-- trading: no resource-awarding command exists until the full ruleset lands.
create table public.online_start_operations (
  owner_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  ruleset_version text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id)
);
alter table public.online_start_operations enable row level security;
revoke all on public.online_start_operations from public, anon, authenticated;

create function public.start_online_campaign(
  p_ruleset_version text,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_campaign public.online_campaigns%rowtype;
  v_credits bigint;
  v_prior public.online_start_operations%rowtype;
  v_receipt jsonb;
begin
  if v_owner is null or auth.role() is distinct from 'authenticated' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_operation_id is null then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  select * into v_prior from public.online_start_operations
    where owner_id = v_owner and operation_id = p_operation_id;
  if found then
    if v_prior.ruleset_version <> p_ruleset_version then
      raise exception 'OPERATION_CONFLICT' using errcode = '23505';
    end if;
    return v_prior.receipt;
  end if;
  if p_ruleset_version is distinct from 'online-1' then
    raise exception 'RULESET_MISMATCH' using errcode = '22023';
  end if;

  -- The owner uniqueness constraint makes concurrent requests converge on one
  -- campaign. The operation UUID is part of the envelope, but a new UUID also
  -- returns the same canonical campaign and never reissues starting assets.
  insert into public.online_campaigns(owner_id, ruleset_version, active_planet)
    values (v_owner, 'online-1', 'cryo-shelf')
    on conflict (owner_id) do nothing;
  select * into v_campaign from public.online_campaigns
    where owner_id = v_owner for update;
  if not found or v_campaign.ruleset_version <> 'online-1' then
    raise exception 'RULESET_MISMATCH' using errcode = '22023';
  end if;

  insert into public.online_wallets(campaign_id, owner_id, credit_minor)
    values (v_campaign.id, v_owner, 0)
    on conflict (campaign_id) do nothing;
  select credit_minor into v_credits from public.online_wallets
    where campaign_id = v_campaign.id and owner_id = v_owner;
  if v_credits is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id,
    'campaign_id', v_campaign.id,
    'ruleset_version', v_campaign.ruleset_version,
    'revision', v_campaign.revision,
    'active_planet', v_campaign.active_planet,
    'credit_minor', v_credits
  );
  insert into public.online_start_operations(owner_id, operation_id, ruleset_version, receipt)
    values (v_owner, p_operation_id, p_ruleset_version, v_receipt);
  return v_receipt;
end;
$$;

revoke all on function public.start_online_campaign(text, uuid)
  from public, anon, authenticated;
grant execute on function public.start_online_campaign(text, uuid)
  to authenticated;
