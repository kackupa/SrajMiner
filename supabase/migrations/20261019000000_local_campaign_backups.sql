-- Local campaign backups are storage only. Nothing in the verified economy reads
-- this payload or grants market inventory/credits from it.
create table public.local_campaign_heads (
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, campaign_id)
);

create table public.local_campaign_backups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  campaign_id uuid not null,
  revision bigint not null check (revision > 0),
  save_schema integer not null check (save_schema = 32),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (owner_id, campaign_id, revision),
  foreign key (owner_id, campaign_id)
    references public.local_campaign_heads(owner_id, campaign_id) on delete cascade
);
create index local_campaign_backups_recent_idx
  on public.local_campaign_backups(owner_id, campaign_id, revision desc);

create table public.local_backup_operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  input_hash text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id)
);

alter table public.local_campaign_heads enable row level security;
alter table public.local_campaign_backups enable row level security;
alter table public.local_backup_operations enable row level security;
create policy local_campaign_heads_owner_read on public.local_campaign_heads
  for select to authenticated using (owner_id = (select auth.uid()));
create policy local_campaign_backups_owner_read on public.local_campaign_backups
  for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.local_campaign_heads, public.local_campaign_backups,
  public.local_backup_operations from public, anon, authenticated;
grant select on public.local_campaign_heads, public.local_campaign_backups to authenticated;

create function public.backup_local_campaign(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_save_schema integer,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_hash text;
  v_prior public.local_backup_operations%rowtype;
  v_revision bigint;
  v_backup_id uuid;
  v_receipt jsonb;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_campaign_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_operation_id is null or p_save_schema is distinct from 32
     or p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'version' is distinct from '32'
     or pg_catalog.octet_length(p_payload::text) > 8388608 then
    raise exception 'INVALID_COMMAND' using errcode = '22023';
  end if;

  -- Reserve the operation key before the campaign row. A retry waits here and
  -- observes the committed result, including after a lost HTTP response.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_operation_id::text, 0)
  );
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'campaign_id', p_campaign_id,
    'expected_revision', p_expected_revision,
    'save_schema', p_save_schema,
    'payload', p_payload
  )::text, 'UTF8')), 'hex');
  select * into v_prior from public.local_backup_operations
    where owner_id = v_owner and operation_id = p_operation_id;
  if found then
    if v_prior.input_hash <> v_hash then
      raise exception 'OPERATION_CONFLICT' using errcode = '23505';
    end if;
    return v_prior.receipt;
  end if;

  insert into public.local_campaign_heads(owner_id, campaign_id)
    values (v_owner, p_campaign_id) on conflict do nothing;
  select revision into v_revision from public.local_campaign_heads
    where owner_id = v_owner and campaign_id = p_campaign_id for update;
  if v_revision <> p_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  v_revision := v_revision + 1;
  update public.local_campaign_heads
    set revision = v_revision, updated_at = now()
    where owner_id = v_owner and campaign_id = p_campaign_id;
  insert into public.local_campaign_backups(owner_id, campaign_id, revision, save_schema, payload)
    values (v_owner, p_campaign_id, v_revision, p_save_schema, p_payload)
    returning id into v_backup_id;

  -- Retain the latest five full snapshots. Receipts survive pruning.
  delete from public.local_campaign_backups
    where owner_id = v_owner and campaign_id = p_campaign_id
      and revision <= v_revision - 5;

  v_receipt := pg_catalog.jsonb_build_object(
    'operation_id', p_operation_id,
    'campaign_id', p_campaign_id,
    'backup_id', v_backup_id,
    'revision', v_revision,
    'saved_at', now()
  );
  insert into public.local_backup_operations(owner_id, operation_id, input_hash, receipt)
    values (v_owner, p_operation_id, v_hash, v_receipt);
  return v_receipt;
end;
$$;

revoke all on function public.backup_local_campaign(uuid, bigint, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.backup_local_campaign(uuid, bigint, uuid, integer, jsonb)
  to authenticated;
