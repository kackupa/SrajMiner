import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Progress } from '../src/game/economy/Progress';

const migration = (name: string) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role', true)
  $$;
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
]) await db.exec(migration(name));

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const startOp = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fuelOp = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const hullOp = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const session = '33333333-3333-4333-8333-333333333333';
await db.query('insert into auth.users(id) values ($1),($2)',[alice,bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const campaign = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1',startOp],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',
  [campaign,session,false]);
const service = 'select public.service_online_pod($1::uuid,$2,$3::uuid,$4::uuid,$5)';
const read = async () => (await db.query<{ read_online_game_state: {
  revision: number; credit_minor: number;
  snapshot: { fuel_milli: number; hull_milli: number };
} }>('select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
await assert.rejects(db.query(service,[campaign,0,fuelOp,session,'fuel']),/NO_SERVICE_NEEDED/);
await assert.rejects(db.query(service,[campaign,0,fuelOp,session,'bogus']),/INVALID_COMMAND/);
await assert.rejects(db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{fuel_milli}','120000'::jsonb) where campaign_id=$1`,
  [campaign]),/permission denied|row-level security/i);
await assert.rejects(db.query(`update public.online_wallets set credit_minor=99999
  where campaign_id=$1`,[campaign]),/permission denied|row-level security/i);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{fuel_milli}','120000'::jsonb) where campaign_id=$1`,
  [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(service,[campaign,0,startOp,session,'fuel']),/OPERATION_CONFLICT/,
  'start UUID cannot also recharge the pod');
assert.deepEqual((await read()).snapshot.fuel_milli,120000);
await assert.rejects(db.query(service,[campaign,0,fuelOp,
  '44444444-4444-4444-8444-444444444444','fuel']),/SESSION_CONFLICT/);
await assert.rejects(db.query(service,[campaign,1,fuelOp,session,'fuel']),/STALE_REVISION/);
const charged = (await db.query<{ service_online_pod: {
  revision: number; cost_minor: number; fuel_before_milli: number;
  fuel_after_milli: number; wallet_after_minor: number;
} }>(service,[campaign,0,fuelOp,session,'fuel'])).rows[0]!.service_online_pod;
assert.equal(charged.revision,1);
assert.equal(charged.cost_minor,0);
assert.equal(charged.fuel_before_milli,120000);
assert.equal(charged.fuel_after_milli,140000);
assert.equal(charged.wallet_after_minor,0);
assert.deepEqual((await db.query(service,[campaign,0,fuelOp,session,'fuel'])).rows[0]?.service_online_pod,
  charged,'retry returns original free recharge receipt');
await assert.rejects(db.query(service,[campaign,0,fuelOp,session,'both']),/OPERATION_CONFLICT/);
assert.equal((await read()).revision,1);

await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{hull_milli}','79500'::jsonb) where campaign_id=$1`,
  [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(service,[campaign,1,hullOp,session,'hull']),/INSUFFICIENT_CREDITS/);
assert.equal((await read()).snapshot.hull_milli,79500);
await db.exec('reset role');
await db.query(`update public.online_wallets set credit_minor=1500 where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const local = new Progress();
local.hull = 79.5;
assert.equal(local.serviceCost('hull'),10);
const repaired = (await db.query<{ service_online_pod: {
  revision: number; cost_minor: number; hull_before_milli: number;
  hull_after_milli: number; wallet_after_minor: number;
} }>(service,[campaign,1,hullOp,session,'hull'])).rows[0]!.service_online_pod;
assert.equal(repaired.revision,2);
assert.equal(repaired.cost_minor,local.serviceCost('hull')*100);
assert.equal(repaired.hull_before_milli,79500);
assert.equal(repaired.hull_after_milli,100000);
assert.equal(repaired.wallet_after_minor,500);
assert.deepEqual((await db.query(service,[campaign,1,hullOp,session,'hull'])).rows[0]?.service_online_pod,
  repaired);
const afterRepair = await read();
assert.equal(afterRepair.revision,2);
assert.equal(afterRepair.credit_minor,500);
assert.equal(afterRepair.snapshot.hull_milli,100000);
const ledger = (await db.query<{ cost_minor: number; hull_before_milli: number;
  hull_after_milli: number }>(`select cost_minor,hull_before_milli,hull_after_milli
  from public.online_service_ledger where operation_id=$1`,[hullOp])).rows[0]!;
assert.equal(ledger.cost_minor,1000);
assert.equal(ledger.hull_before_milli,79500);
assert.equal(ledger.hull_after_milli,100000);
await assert.rejects(db.query(service,[campaign,2,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',session,'both']),/NO_SERVICE_NEEDED/);
await db.exec(`set request.jwt.claim.sub='${bob}';`);
await assert.rejects(db.query(service,[campaign,2,
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',session,'fuel']),/ACCESS_REQUIRED/);
assert.equal((await db.query('select * from public.online_service_ledger')).rows.length,0);
await db.exec(`set request.jwt.claim.sub='${alice}';`);
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=
  jsonb_set(jsonb_set(snapshot,'{fuel_milli}','100000'::jsonb),'{pod,y}','100'::jsonb)
  where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(service,[campaign,2,
  'ffffffff-ffff-4fff-8fff-ffffffffffff',session,'fuel']),/ACCESS_REQUIRED/);
assert.equal((await read()).snapshot.fuel_milli,100000);
await db.exec('reset role');
console.log('PASS online pod service SQL: canonical free recharge, priced repair, rollback, retry and owner isolation');
