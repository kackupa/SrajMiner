import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { UNDERGROUND_BUILDING } from '../src/game/config';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
assert.deepEqual(UNDERGROUND_BUILDING['trade-post'].materials, { copper: 4, iron: 4, silver: 2 });
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
]) await db.exec(migration(name));
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const session = '33333333-3333-4333-8333-333333333333';
const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice, bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const campaign = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1', '44444444-4444-4444-8444-444444444444'],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)', [campaign, session, false]);
const build = 'select public.build_online_market_uplink($1::uuid,$2,$3::uuid,$4::uuid)';
await assert.rejects(db.query(build, [campaign, 0, operation, session]), /INSUFFICIENT_ORE/);
await assert.rejects(db.query(`insert into public.online_structures(campaign_id,owner_id,planet,kind)
  values ($1,$2,'cryo-shelf','trade-post')`, [campaign, alice]), /permission denied|row-level security/i);
await assert.rejects(db.query(`update public.online_wallets set credit_minor=100000
  where campaign_id=$1`, [campaign]), /permission denied|row-level security/i);
const before = (await db.query<{ read_online_game_state: { market_uplink_online: boolean; credit_minor: number } }>(
  'select public.read_online_game_state($1::uuid)', [campaign])).rows[0]!.read_online_game_state;
assert.equal(before.market_uplink_online, false);
assert.equal(before.credit_minor, 0);

// Trusted fixtures stand in for earlier verified mining receipts. This test
// proves the structure debit transaction, not the mining provenance path.
await db.exec('reset role');
for (const [location, ore, amount] of [
  ['miner', 'copper', 5], ['ship', 'copper', 4],
  ['miner', 'iron', 4], ['ship', 'iron', 5],
  ['miner', 'silver', 1], ['ship', 'silver', 2],
] as const) await db.query(`insert into public.online_inventory
  (campaign_id,owner_id,location_key,ore,quantity_half_units) values ($1,$2,$3,$4,$5)`,
  [campaign, alice, location, ore, amount]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
await assert.rejects(db.query(build, [campaign, 0, '99999999-9999-4999-8999-999999999999', session]),
  /INSUFFICIENT_ORE/);
assert.equal((await db.query(`select quantity_half_units from public.online_inventory
  where campaign_id=$1 and location_key='miner' and ore='copper'`, [campaign])).rows[0]?.quantity_half_units,
5, 'a later shortage rolls back earlier ore debits');
await assert.rejects(db.query(build, [campaign, 0, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '99999999-9999-4999-8999-999999999999']), /SESSION_CONFLICT/);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','100'::jsonb) where campaign_id=$1`, [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
await assert.rejects(db.query(build, [campaign, 0, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', session]), /ACCESS_REQUIRED/);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','-22'::jsonb) where campaign_id=$1`, [campaign]);
await db.query(`update public.online_inventory set quantity_half_units=4
  where campaign_id=$1 and location_key='ship' and ore='silver'`, [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const first = (await db.query<{ build_online_market_uplink: {
  revision: number; kind: string; material_debits: { ore: string; miner_half_units: number; ship_half_units: number }[];
} }>(build, [campaign, 0, operation, session])).rows[0]!.build_online_market_uplink;
assert.equal(first.kind, 'build_market_uplink');
assert.equal(first.revision, 1);
assert.deepEqual(first.material_debits, [
  { ore: 'copper', miner_half_units: 5, ship_half_units: 3 },
  { ore: 'iron', miner_half_units: 4, ship_half_units: 4 },
  { ore: 'silver', miner_half_units: 1, ship_half_units: 3 },
]);
assert.deepEqual((await db.query(build, [campaign, 0, operation, session])).rows[0]?.build_online_market_uplink,
  first, 'same operation returns its original receipt');
await assert.rejects(db.query(build, [campaign, 1, operation, session]), /OPERATION_CONFLICT/);
await assert.rejects(db.query(build, [campaign, 0, '55555555-5555-4555-8555-555555555555', session]), /STALE_REVISION/);
await assert.rejects(db.query(build, [campaign, 1, '66666666-6666-4666-8666-666666666666', session]), /ALREADY_BUILT/);
const stock = (await db.query<{ location_key: string; ore: string; quantity_half_units: number }>(
  'select location_key,ore,quantity_half_units from public.online_inventory where campaign_id=$1 order by location_key,ore',
  [campaign])).rows;
assert.deepEqual(stock, [
  { location_key: 'miner', ore: 'copper', quantity_half_units: 0 },
  { location_key: 'miner', ore: 'iron', quantity_half_units: 0 },
  { location_key: 'miner', ore: 'silver', quantity_half_units: 0 },
  { location_key: 'ship', ore: 'copper', quantity_half_units: 1 },
  { location_key: 'ship', ore: 'iron', quantity_half_units: 1 },
  { location_key: 'ship', ore: 'silver', quantity_half_units: 1 },
]);
const after = (await db.query<{ read_online_game_state: {
  revision: number; market_uplink_online: boolean; credit_minor: number;
} }>('select public.read_online_game_state($1::uuid)', [campaign])).rows[0]!.read_online_game_state;
assert.equal(after.revision, 1);
assert.equal(after.market_uplink_online, true);
assert.equal(after.credit_minor, 0);
assert.equal((await db.query('select count(*)::integer as n from public.online_structures where campaign_id=$1',
  [campaign])).rows[0]?.n, 1);
await db.exec(`set request.jwt.claim.sub = '${bob}';`);
await assert.rejects(db.query(build, [campaign, 1, '77777777-7777-4777-8777-777777777777', session]), /ACCESS_REQUIRED/);
assert.equal((await db.query('select count(*)::integer as n from public.online_structures where campaign_id=$1',
  [campaign])).rows[0]?.n, 0, 'cross-owner structure reads are denied');
await db.exec(`reset role; set role anon; set request.jwt.claim.sub = ''; set request.jwt.claim.role = 'anon';`);
await assert.rejects(db.query(build, [campaign, 1, '88888888-8888-4888-8888-888888888888', session]),
  /permission denied|AUTH_REQUIRED/i);
await db.close();
console.log('PASS online uplink SQL: exact canonical cost, rollback, owner/session/revision, idempotency, no mint');
