import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { RIG_MATERIAL_BASE, rigMaterialCost, upgradeValue } from '../src/game/config';

const migration = (name: string) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url),'utf8');
const db = new PGlite();
await db.exec(`
  create role authenticated;
  create role anon;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select current_setting('request.jwt.claim.role',true)
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
  '20261019000009_online_basic_rig_upgrades.sql',
]) await db.exec(migration(name));
const prices = (await db.query<{ upgrade_key: string; ore: string; base_units: number }>(
  'select upgrade_key,ore,base_units from public.online_upgrade_material_prices order by upgrade_key,ore',
)).rows;
const localPrices = (['drill','fuel','cargo','hull','engine'] as const).flatMap(upgrade_key =>
  Object.entries(RIG_MATERIAL_BASE[upgrade_key]).map(([ore,base_units]) =>
    ({ upgrade_key,ore,base_units: base_units! })))
  .sort((a,b) => a.upgrade_key.localeCompare(b.upgrade_key) || a.ore.localeCompare(b.ore));
assert.deepEqual(prices,localPrices);

const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const session='33333333-3333-4333-8333-333333333333';
const op='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.query('insert into auth.users(id) values ($1),($2)',[alice,bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const campaign=(await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)',['online-1','00000000-0000-4000-8000-000000000001'],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',[campaign,session,false]);
const upgrade='select public.install_online_rig_upgrade($1::uuid,$2,$3::uuid,$4::uuid,$5)';
const read=async () => (await db.query<{ read_online_game_state: {
  revision: number; credit_minor: number;
  snapshot: { levels: Record<string,number>; fuel_milli: number; hull_milli: number };
} }>('select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
assert.deepEqual((await read()).snapshot.levels,
  { drill:1,fuel:1,cargo:1,hull:1,engine:1,scanner:1,grapple:1 });
await assert.rejects(db.query(upgrade,[campaign,0,op,session,'drill']),/INSUFFICIENT_ORE/);
await assert.rejects(db.query(upgrade,[campaign,0,op,session,'scanner']),/INVALID_COMMAND/);
await assert.rejects(db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{levels,drill}','5'::jsonb) where campaign_id=$1`,
  [campaign]),/permission denied|row-level security/i);
assert.equal((await read()).revision,0);

// Fixture stock stands in for previously mined receipts. No browser balance is
// used by the upgrade transaction; the SQL fixture is isolated from staging.
await db.exec('reset role');
for (const [location,ore,quantity_half_units] of [
  ['miner','copper',8],['miner','iron',8],['miner','silver',2],
  ['ship','copper',16],['ship','iron',16],
] as const) await db.query(`insert into public.online_inventory
  (campaign_id,owner_id,location_key,ore,quantity_half_units) values ($1,$2,$3,$4,$5)`,
  [campaign,alice,location,ore,quantity_half_units]);
await db.query(`update public.online_simulation_state set snapshot=
  jsonb_set(jsonb_set(snapshot,'{fuel_milli}','130000'::jsonb),
    '{hull_milli}','80000'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(upgrade,[campaign,1,op,session,'drill']),/STALE_REVISION/);
await assert.rejects(db.query(upgrade,[campaign,0,op,
  '44444444-4444-4444-8444-444444444444','drill']),/SESSION_CONFLICT/);
await assert.rejects(db.query(upgrade,[campaign,0,'00000000-0000-4000-8000-000000000001',
  session,'drill']),/OPERATION_CONFLICT/,'start UUID is reserved globally');
assert.equal((await read()).revision,0);

const keys=['drill','fuel','cargo','hull','engine'] as const;
let lastReceipt: { operation_id: string; revision: number; level_before: number;
  level_after: number; material_debits: { ore: string; miner_half_units: number;
    ship_half_units: number }[] } | null=null;
let firstReceipt: typeof lastReceipt=null;
for (const [index,key] of keys.entries()) {
  const id=index===0 ? op : `00000000-0000-4000-8000-${String(index+2).padStart(12,'0')}`;
  const receipt=(await db.query<{ install_online_rig_upgrade: NonNullable<typeof lastReceipt> }>(
    upgrade,[campaign,index,id,session,key],
  )).rows[0]!.install_online_rig_upgrade;
  assert.equal(receipt.revision,index+1);
  assert.equal(receipt.level_before,1);
  assert.equal(receipt.level_after,2);
  const expected=rigMaterialCost(key,1);
  for (const debit of receipt.material_debits)
    assert.equal(debit.miner_half_units+debit.ship_half_units,expected[debit.ore as keyof typeof expected]! * 2);
  assert.deepEqual((await db.query(upgrade,[campaign,index,id,session,key])).rows[0]?.install_online_rig_upgrade,
    receipt,'retry returns exact saved receipt without second material debit');
  if (index===0) firstReceipt=receipt;
  lastReceipt=receipt;
}
await assert.rejects(db.query(upgrade,[campaign,0,op,session,'cargo']),/OPERATION_CONFLICT/);
const state=await read();
assert.equal(state.revision,5);
assert.equal(state.credit_minor,0);
for (const key of keys) assert.equal(state.snapshot.levels[key],2);
assert.equal(state.snapshot.fuel_milli,180000,'battery upgrade adds capacity without healing deficit');
assert.equal(state.snapshot.hull_milli,120000,'hull upgrade adds capacity without healing deficit');
assert.equal(upgradeValue('cargo',state.snapshot.levels.cargo)*2,48);
assert.equal((await db.query<{ total: number }>(`select coalesce(sum(quantity_half_units),0)::bigint as total
  from public.online_inventory where campaign_id=$1`,[campaign])).rows[0]!.total,0,
  'all 25 earned-equivalent ore units are consumed exactly once');
assert.equal((await db.query(`select * from public.online_upgrade_ledger where campaign_id=$1`,
  [campaign])).rows.length,5);
assert.deepEqual((await db.query(upgrade,[campaign,0,op,session,'drill'])).rows[0]?.install_online_rig_upgrade,
  firstReceipt,
  'old operation remains retriable after other upgrades');
await db.exec('reset role');
await db.query(`insert into public.online_inventory
  (campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','copper',8)
  on conflict (campaign_id,location_key,ore) do update
    set quantity_half_units=excluded.quantity_half_units`,[campaign,alice]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(upgrade,[campaign,5,
  '55555555-5555-4555-8555-555555555555',session,'drill']),/INSUFFICIENT_ORE/,
  'later iron shortage rolls back earlier copper debit');
assert.equal((await db.query<{ quantity_half_units: number }>(`select quantity_half_units
  from public.online_inventory where campaign_id=$1 and location_key='miner' and ore='copper'`,
  [campaign])).rows[0]!.quantity_half_units,8);
assert.equal((await read()).revision,5);
await db.exec('reset role');
await db.query(`update public.online_inventory set quantity_half_units=0
  where campaign_id=$1 and location_key='miner' and ore='copper'`,[campaign]);
await db.query('update public.online_wallets set credit_minor=900 where campaign_id=$1',[campaign]);
await db.query(`insert into public.online_inventory
  (campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'ship','copper',40)
  on conflict (campaign_id,location_key,ore) do update
    set quantity_half_units=excluded.quantity_half_units`,[campaign,alice]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const service=(await db.query<{ service_online_pod: { revision: number;
  cost_minor: number; fuel_after_milli: number; hull_after_milli: number } }>(
  'select public.service_online_pod($1::uuid,$2,$3::uuid,$4::uuid,$5)',
  [campaign,5,'77777777-7777-4777-8777-777777777777',session,'both'],
)).rows[0]!.service_online_pod;
assert.equal(service.revision,6);
assert.equal(service.cost_minor,900,'upgraded hull repair uses the expanded maximum');
assert.equal(service.fuel_after_milli,190000);
assert.equal(service.hull_after_milli,140000);
const moved=(await db.query<{ transfer_online_ore: { revision: number;
  target_after_half_units: number } }>(
  'select public.transfer_online_ore($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)',
  [campaign,6,'66666666-6666-4666-8666-666666666666',session,
    'ship','miner','copper',40],
)).rows[0]!.transfer_online_ore;
assert.equal(moved.revision,7);
assert.equal(moved.target_after_half_units,40,
  'upgraded miner hold accepts more than the starter 32 half-units');
assert.equal((await read()).credit_minor,0);
await db.exec(`set request.jwt.claim.sub='${bob}';`);
await assert.rejects(db.query(upgrade,[campaign,7,
  '99999999-9999-4999-8999-999999999999',session,'drill']),/ACCESS_REQUIRED/);
assert.equal((await db.query(`select * from public.online_upgrade_ledger`)).rows.length,0);
await db.exec(`set request.jwt.claim.sub='${alice}';`);
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=
  jsonb_set(snapshot,'{pod,y}','100'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(upgrade,[campaign,7,
  '88888888-8888-4888-8888-888888888888',session,'drill']),/ACCESS_REQUIRED/);
await db.exec('reset role');
console.log('PASS online rig upgrade SQL: five exact material tracks, expanded service/hold caps, retry and isolation');
