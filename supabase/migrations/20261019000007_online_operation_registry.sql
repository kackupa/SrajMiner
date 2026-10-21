-- One idempotency namespace for every Verified Online mutation. Earlier
-- operation tables retain their exact receipts; this registry prevents a UUID
-- from naming a second kind of operation for the same authenticated owner.
create table public.online_operation_registry (
  owner_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  kind text not null check (kind in
    ('start','game','transfer','structure','civilian_sale')),
  created_at timestamptz not null default now(),
  primary key (owner_id,operation_id)
);
alter table public.online_operation_registry enable row level security;
revoke all on public.online_operation_registry from public, anon, authenticated;

-- UNIQUE detects any historical cross-kind reuse instead of silently
-- selecting one receipt during a forward migration.
insert into public.online_operation_registry(owner_id,operation_id,kind)
select owner_id,operation_id,kind from (
  select owner_id,operation_id,'start'::text as kind from public.online_start_operations
  union all
  select owner_id,operation_id,'game' from public.online_game_operations
  union all
  select owner_id,operation_id,'transfer' from public.online_inventory_operations
  union all
  select owner_id,operation_id,'structure' from public.online_structure_operations
  union all
  select owner_id,operation_id,'civilian_sale' from public.online_civilian_sale_operations
) previous_operations;

create function public.register_online_operation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.online_operation_registry(owner_id,operation_id,kind)
    values (new.owner_id,new.operation_id,tg_argv[0])
    on conflict (owner_id,operation_id) do nothing;
  if not found then
    raise exception 'OPERATION_CONFLICT' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.register_online_operation() from public, anon, authenticated;

create trigger online_start_register_operation
  before insert on public.online_start_operations for each row
  execute function public.register_online_operation('start');
create trigger online_game_register_operation
  before insert on public.online_game_operations for each row
  execute function public.register_online_operation('game');
create trigger online_transfer_register_operation
  before insert on public.online_inventory_operations for each row
  execute function public.register_online_operation('transfer');
create trigger online_structure_register_operation
  before insert on public.online_structure_operations for each row
  execute function public.register_online_operation('structure');
create trigger online_civilian_sale_register_operation
  before insert on public.online_civilian_sale_operations for each row
  execute function public.register_online_operation('civilian_sale');
