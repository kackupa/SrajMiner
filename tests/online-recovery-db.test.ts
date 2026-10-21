import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = (name: string) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
await db.exec(`
  create role authenticated; create role anon; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true) $$;
  grant usage on schema public, auth to authenticated, anon, service_role;
  grant execute on function auth.uid(), auth.role() to authenticated, anon, service_role;
`);
for (const name of [
  '20261019000001_verified_online_foundation.sql',
  '20261019000002_verified_online_start.sql',
  '20261019000003_verified_game_transactions.sql',
  '20261019000004_online_inventory_transfer.sql',
  '20261019000005_online_market_uplink.sql',
  '20261019000006_online_civilian_sales.sql',
  '20261019000007_online_operation_registry.sql',
  '20261019000008_online_pod_service.sql',
  '20261019000009_online_basic_rig_upgrades.sql',
  '20261019000010_online_stranded_recovery.sql',
]) await db.exec(migration(name));

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const startOp = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const recoveryOp = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = '33333333-3333-4333-8333-333333333333';
const recover = 'select public.recover_online_stranded_pod($1::uuid,$2,$3::uuid,$4::uuid)';
await db.query('insert into auth.users(id) values ($1),($2)', [alice,bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const campaign = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1',startOp],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',
  [campaign,session,false]);
await assert.rejects(db.query(recover,[campaign,0,recoveryOp,session]),/RECOVERY_NOT_NEEDED/);
await assert.rejects(db.query(recover,[campaign,0,recoveryOp,
  '44444444-4444-4444-8444-444444444444']),/RECOVERY_NOT_NEEDED|SESSION_CONFLICT/);
await assert.rejects(db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{fuel_milli}','0'::jsonb) where campaign_id=$1`,
  [campaign]),/permission denied|row-level security/i);
await assert.rejects(db.query(`update public.online_inventory set quantity_half_units=999
  where campaign_id=$1`,[campaign]),/permission denied|row-level security/i);

// Seed only the SQL fixture through the privileged test connection, never API input.
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=
  jsonb_set(jsonb_set(jsonb_set(snapshot,'{fuel_milli}','0'::jsonb),
  '{pod,y}','250'::jsonb),'{destroyed_cells}','["11:8"]'::jsonb)
  where campaign_id=$1`,[campaign]);
await db.query(`insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','copper',5),($1,$2,'miner','iron',2),
    ($1,$2,'ship','silver',7)`,[campaign,alice]);
await db.query('update public.online_wallets set credit_minor=1200 where campaign_id=$1',[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(recover,[campaign,0,startOp,session]),/OPERATION_CONFLICT/);
await assert.rejects(db.query(recover,[campaign,1,recoveryOp,session]),/STALE_REVISION/);
await assert.rejects(db.query(recover,[campaign,0,recoveryOp,
  '44444444-4444-4444-8444-444444444444']),/SESSION_CONFLICT/);
await db.exec(`set request.jwt.claim.sub='${bob}';`);
await assert.rejects(db.query(recover,[campaign,0,recoveryOp,session]),/ACCESS_REQUIRED/);
assert.equal((await db.query('select * from public.online_recovery_ledger')).rows.length,0);
await db.exec(`set request.jwt.claim.sub='${alice}';`);

const receipt = (await db.query<{ recover_online_stranded_pod: {
  revision: number; wallet_after_minor: number; fuel_before_milli: number;
  fuel_after_milli: number; hull_after_milli: number;
  forfeited_cargo_half_units: Record<string,number>;
} }>(recover,[campaign,0,recoveryOp,session])).rows[0]!.recover_online_stranded_pod;
assert.equal(receipt.revision,1);
assert.deepEqual(receipt.forfeited_cargo_half_units,{ copper:5, iron:2 });
assert.equal(receipt.fuel_before_milli,0);
assert.equal(receipt.fuel_after_milli,140000);
assert.equal(receipt.hull_after_milli,100000);
assert.equal(receipt.wallet_after_minor,1200);
assert.deepEqual((await db.query(recover,[campaign,0,recoveryOp,session])).rows[0]?.recover_online_stranded_pod,
  receipt,'retry returns exact original receipt after revision advanced');
await assert.rejects(db.query(recover,[campaign,0,recoveryOp,
  '44444444-4444-4444-8444-444444444444']),/OPERATION_CONFLICT/);
const state = (await db.query<{ read_online_game_state: {
  revision: number; credit_minor: number; ship_cargo_half_units: Record<string,number>;
  snapshot: { pod: {x:number;y:number;docked:boolean}; fuel_milli:number;
    cargo_half_units:Record<string,number>; destroyed_cells:string[]; last_sequence:number };
} }>('select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
assert.equal(state.revision,1);
assert.equal(state.credit_minor,1200);
assert.deepEqual(state.snapshot.cargo_half_units,{});
assert.deepEqual(state.ship_cargo_half_units,{silver:7});
assert.deepEqual(state.snapshot.destroyed_cells,['11:8']);
assert.equal(state.snapshot.last_sequence,-1);
assert.deepEqual(state.snapshot.pod,{x:680,y:-22,vx:0,vy:0,docked:true});
assert.equal(state.snapshot.fuel_milli,140000);
await assert.rejects(db.query(recover,[campaign,1,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',session]),/RECOVERY_NOT_NEEDED/);
const ledger = (await db.query<{forfeited_cargo_half_units: Record<string,number>}>(
  'select forfeited_cargo_half_units from public.online_recovery_ledger where operation_id=$1',
  [recoveryOp])).rows[0]!;
assert.deepEqual(ledger.forfeited_cargo_half_units,{copper:5,iron:2});
await db.exec(`set request.jwt.claim.role='anon'; set role anon;`);
await assert.rejects(db.query(recover,[campaign,1,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',session]),/permission denied|AUTH_REQUIRED/i);
await db.exec('reset role');
console.log('PASS online recovery SQL: forfeiture, conservation, owner/session checks and exact retry');
