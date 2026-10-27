import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
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
await assert.rejects(db.query(`insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','copper',6)`, [campaign, alice]), /permission denied|row-level security/i);

// Fixture ore models a prior verified mining receipt. This test is about transfer,
// not a mint path; the earned browser test covers mine -> canonical inventory.
await db.exec('reset role');
await db.query(`insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','copper',6)`, [campaign, alice]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const sql = 'select public.transfer_online_ore($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)';
const args = [campaign, 0, operation, session, 'miner', 'ship', 'copper', 4] as const;
const first = (await db.query<{ transfer_online_ore: { revision: number; quantity_half_units: number } }>(sql, [...args])).rows[0]!.transfer_online_ore;
assert.equal(first.revision, 1);
assert.equal(first.quantity_half_units, 4);
assert.deepEqual((await db.query('select public.transfer_online_ore($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)', [...args])).rows[0]?.transfer_online_ore,
  first, 'same operation returns original receipt');
await assert.rejects(db.query(sql, [campaign, 0, operation, session, 'miner', 'ship', 'copper', 2]), /OPERATION_CONFLICT/);
await assert.rejects(db.query(sql, [campaign, 0, '55555555-5555-4555-8555-555555555555', session,
  'miner', 'ship', 'copper', 1]), /STALE_REVISION/);
assert.equal((await db.query('select quantity_half_units from public.online_inventory where campaign_id=$1 and location_key=$2 and ore=$3',
  [campaign, 'miner', 'copper'])).rows[0]?.quantity_half_units, 2);
assert.equal((await db.query('select quantity_half_units from public.online_inventory where campaign_id=$1 and location_key=$2 and ore=$3',
  [campaign, 'ship', 'copper'])).rows[0]?.quantity_half_units, 4);
const reload = (await db.query<{ read_online_game_state: {
  revision: number; ship_cargo_half_units: { copper: number }; ship_capacity_half_units: number;
  snapshot: { cargo_half_units: { copper: number } };
} }>('select public.read_online_game_state($1::uuid)', [campaign])).rows[0]!.read_online_game_state;
assert.equal(reload.revision, 1);
assert.equal(reload.snapshot.cargo_half_units.copper, 2);
assert.equal(reload.ship_cargo_half_units.copper, 4);
assert.equal(reload.ship_capacity_half_units, 100);
await assert.rejects(db.query(sql, [campaign, 1, '66666666-6666-4666-8666-666666666666', session,
  'miner', 'ship', 'copper', 3]), /INSUFFICIENT_ORE/);

const reverse = (await db.query<{ transfer_online_ore: { revision: number } }>(sql,
  [campaign, 1, '77777777-7777-4777-8777-777777777777', session, 'ship', 'miner', 'copper', 2])).rows[0]!.transfer_online_ore;
assert.equal(reverse.revision, 2);
assert.equal((await db.query("select sum(quantity_half_units)::integer as total from public.online_inventory where campaign_id=$1", [campaign])).rows[0]?.total, 6);

await db.exec(`set request.jwt.claim.sub = '${bob}';`);
await assert.rejects(db.query(sql, [campaign, 2, '88888888-8888-4888-8888-888888888888', session,
  'miner', 'ship', 'copper', 1]), /ACCESS_REQUIRED/);
await db.exec(`reset role; set role anon; set request.jwt.claim.sub = ''; set request.jwt.claim.role = 'anon';`);
await assert.rejects(db.query(sql, [campaign, 2, '99999999-9999-4999-8999-999999999999', session,
  'miner', 'ship', 'copper', 1]), /permission denied|AUTH_REQUIRED/i);

await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','100'::jsonb) where campaign_id=$1`, [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
await assert.rejects(db.query(sql, [campaign, 2, 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbbbbb', session,
  'miner', 'ship', 'copper', 1]), /ACCESS_REQUIRED/);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','-22'::jsonb) where campaign_id=$1`, [campaign]);
await db.query(`update public.online_inventory set quantity_half_units=100
  where campaign_id=$1 and location_key='ship' and ore='copper'`, [campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
await assert.rejects(db.query(sql, [campaign, 2, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', session,
  'miner', 'ship', 'copper', 1]), /HOLD_FULL/);
assert.equal((await db.query('select revision from public.online_campaigns where id=$1', [campaign])).rows[0]?.revision, 2);
assert.equal((await db.query("select quantity_half_units from public.online_inventory where campaign_id=$1 and location_key='miner' and ore='copper'", [campaign])).rows[0]?.quantity_half_units, 4);
await db.close();
console.log('PASS online transfer SQL: owner/session/revision/idempotency, source/access/capacity, ore conservation');
