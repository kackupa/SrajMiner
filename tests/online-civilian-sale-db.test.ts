import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { CIVILIAN_DEMAND, CIVILISATIONS, ORES } from '../src/game/config';
import { quoteCivilianShipment } from '../src/game/economy/Civilisations';
import { emptyCargo } from '../src/game/economy/Progress';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
assert.equal(CIVILIAN_DEMAND.premium, 0.35);
assert.equal(ORES.copper.value, 18);
assert.equal(CIVILISATIONS.helion.projects[0].ore, 'copper');
assert.equal(CIVILISATIONS.helion.projects[0].units, 24);
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
]) await db.exec(migration(name));
const onlineProjects = (await db.query<{ buyer: string; sequence: number; name: string;
  ore: string; target_half_units: number }>(
  'select buyer,sequence,name,ore,target_half_units from public.online_civilian_projects order by buyer,sequence',
)).rows;
const localProjects = Object.entries(CIVILISATIONS).flatMap(([buyer,civ]) =>
  civ.projects.map((project, index) => ({ buyer, sequence: index + 1,
    name: project.name, ore: project.ore, target_half_units: project.units * 2 })))
  .sort((a,b) => a.buyer.localeCompare(b.buyer) || a.sequence - b.sequence);
assert.deepEqual(onlineProjects,localProjects,'versioned online projects mirror current Local project rules');
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const session = '33333333-3333-4333-8333-333333333333';
const saleOp = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice,bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const campaign = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1','44444444-4444-4444-8444-444444444444'],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)', [campaign,session,false]);
const sale = 'select public.sell_online_ore_to_civilian($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)';
const quote = 'select public.quote_online_civilian_sale($1::uuid,$2,$3,$4,$5)';
await assert.rejects(db.query(sale,[campaign,0,saleOp,session,'miner','helion','copper',1]), /ACCESS_REQUIRED/,
  'civilian credit issuance requires a built uplink');
await assert.rejects(db.query(quote,[campaign,'miner','helion','copper',1]), /ACCESS_REQUIRED/);
await assert.rejects(db.query(`update public.online_wallets set credit_minor=10000 where campaign_id=$1`,
  [campaign]), /permission denied|row-level security/i);
await assert.rejects(db.query(`insert into public.online_civilian_deliveries
  (campaign_id,owner_id,buyer,ore,delivered_half_units)
  values ($1,$2,'helion','copper',48)`, [campaign,alice]), /permission denied|row-level security/i);

// Trusted fixtures stand in for previously earned mining receipts. The build
// itself still runs through its authenticated SQL transaction.
await db.exec('reset role');
for (const [location,ore,amount] of [
  ['miner','copper',8], ['miner','iron',8], ['miner','silver',4],
  ['ship','copper',6], ['ship','iron',4],
] as const) await db.query(`insert into public.online_inventory
  (campaign_id,owner_id,location_key,ore,quantity_half_units) values ($1,$2,$3,$4,$5)`,
  [campaign,alice,location,ore,amount]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await db.query('select public.build_online_market_uplink($1::uuid,$2,$3::uuid,$4::uuid)',
  [campaign,0,'55555555-5555-4555-8555-555555555555',session]);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','100'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(sale,[campaign,1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',session,
  'ship','helion','copper',1]),/ACCESS_REQUIRED/);
await db.exec('reset role');
await db.query(`update public.online_simulation_state
  set snapshot=jsonb_set(snapshot,'{pod,y}','-22'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(sale,[campaign,1,saleOp,session,'ship','helion','copper',7]), /INSUFFICIENT_ORE/);
await assert.rejects(db.query(sale,[campaign,0,saleOp,session,'ship','helion','copper',1]), /STALE_REVISION/);
await assert.rejects(db.query(sale,[campaign,1,saleOp,
  '66666666-6666-4666-8666-666666666666','ship','helion','copper',1]), /SESSION_CONFLICT/);
const offer = (await db.query<{ quote_online_civilian_sale: {
  revision: number; source_available_half_units: number; gross_credit_minor: number;
  bonus_credit_minor: number; total_credit_minor: number;
} }>(quote,[campaign,'ship','helion','copper',1])).rows[0]!.quote_online_civilian_sale;
assert.equal(offer.revision,1);
assert.equal(offer.source_available_half_units,6);
assert.equal(offer.total_credit_minor,1200);
await assert.rejects(db.query(sale,[campaign,1,'55555555-5555-4555-8555-555555555555',
  session,'ship','helion','copper',1]),/OPERATION_CONFLICT/,
  'a build operation UUID cannot also issue civilian credits');
const afterCrossKindConflict = (await db.query<{ read_online_game_state: {
  revision: number; credit_minor: number; ship_cargo_half_units: { copper: number };
} }>('select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
assert.equal(afterCrossKindConflict.revision,1);
assert.equal(afterCrossKindConflict.credit_minor,0);
assert.equal(afterCrossKindConflict.ship_cargo_half_units.copper,6);
const args = [campaign,1,saleOp,session,'ship','helion','copper',1] as const;
const first = (await db.query<{ sell_online_ore_to_civilian: {
  revision: number; gross_credit_minor: number; bonus_credit_minor: number;
  total_credit_minor: number; wallet_after_minor: number; project: string;
} }>(sale,[...args])).rows[0]!.sell_online_ore_to_civilian;
assert.equal(first.revision,2);
assert.equal(first.gross_credit_minor,900);
assert.equal(first.bonus_credit_minor,300);
assert.equal(first.total_credit_minor,1200);
assert.equal(first.wallet_after_minor,1200);
assert.equal(first.project,'Eastern power grid');
assert.equal(first.gross_credit_minor,offer.gross_credit_minor);
assert.equal(first.bonus_credit_minor,offer.bonus_credit_minor);
const localShipment = emptyCargo();
localShipment.copper = 0.5;
const localOffer = quoteCivilianShipment(localShipment,localShipment,'helion',{});
assert.equal(first.gross_credit_minor,localOffer.gross * 100);
assert.equal(first.bonus_credit_minor,localOffer.bonus * 100);
assert.deepEqual((await db.query(sale,[...args])).rows[0]?.sell_online_ore_to_civilian,first,
  'repeated operation returns original sale without a second credit grant');
await assert.rejects(db.query(sale,[campaign,1,saleOp,session,'ship','helion','copper',2]), /OPERATION_CONFLICT/);
const state = (await db.query<{ read_online_game_state: {
  revision: number; credit_minor: number; ship_cargo_half_units: { copper: number };
} }>('select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
assert.equal(state.revision,2);
assert.equal(state.credit_minor,1200);
assert.equal(state.ship_cargo_half_units.copper,5);
assert.equal((await db.query(`select delivered_half_units from public.online_civilian_deliveries
  where campaign_id=$1 and buyer='helion' and ore='copper'`,[campaign])).rows[0]?.delivered_half_units,1);
const ledger = (await db.query<{ gross_credit_minor: number; bonus_credit_minor: number;
  total_credit_minor: number; quantity_half_units: number }>(
  'select gross_credit_minor,bonus_credit_minor,total_credit_minor,quantity_half_units from public.online_civilian_sale_ledger where operation_id=$1',
  [saleOp])).rows[0]!;
assert.deepEqual(ledger,{ gross_credit_minor:900,bonus_credit_minor:300,total_credit_minor:1200,quantity_half_units:1 });
await assert.rejects(db.query(`update public.online_civilian_sale_ledger set total_credit_minor=999999
  where operation_id=$1`,[saleOp]), /permission denied|row-level security/i);

// A later project is counted even if its ore arrived before becoming current.
await db.exec('reset role');
await db.query(`update public.online_civilian_deliveries set delivered_half_units=48
  where campaign_id=$1 and buyer='helion' and ore='copper'`,[campaign]);
await db.query(`insert into public.online_civilian_deliveries
  (campaign_id,owner_id,buyer,ore,delivered_half_units)
  values ($1,$2,'helion','iron',1)`,[campaign,alice]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const iron = (await db.query<{ sell_online_ore_to_civilian: {
  gross_credit_minor: number; bonus_credit_minor: number; total_credit_minor: number; project: string;
} }>(sale,[campaign,2,'77777777-7777-4777-8777-777777777777',session,
  'ship','helion','iron',1])).rows[0]!.sell_online_ore_to_civilian;
assert.equal(iron.project,'Harbour rail extension');
assert.equal(iron.gross_credit_minor,1400);
assert.equal(iron.bonus_credit_minor,400);
assert.equal(iron.total_credit_minor,1800);

await db.exec('reset role');
await db.query('update public.online_wallets set credit_minor=9007199254740990 where campaign_id=$1',[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(sale,[campaign,3,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',session,
  'ship','helion','copper',1]), /CREDIT_LIMIT/);
assert.equal((await db.query(`select quantity_half_units from public.online_inventory
  where campaign_id=$1 and location_key='ship' and ore='copper'`,[campaign])).rows[0]?.quantity_half_units,5,
  'credit overflow rejects before ore debit');

await db.exec(`set request.jwt.claim.sub='${bob}';`);
await assert.rejects(db.query(sale,[campaign,3,'88888888-8888-4888-8888-888888888888',session,
  'ship','helion','copper',1]), /ACCESS_REQUIRED/);
await assert.rejects(db.query(quote,[campaign,'ship','helion','copper',1]), /ACCESS_REQUIRED/);
assert.equal((await db.query('select count(*)::integer as n from public.online_civilian_sale_ledger where campaign_id=$1',
  [campaign])).rows[0]?.n,0,'another owner cannot read this sale ledger');
await db.exec(`reset role; set role anon; set request.jwt.claim.sub=''; set request.jwt.claim.role='anon';`);
await assert.rejects(db.query(sale,[campaign,3,'99999999-9999-4999-8999-999999999999',session,
  'ship','helion','copper',1]), /permission denied|AUTH_REQUIRED/i);
await db.close();
console.log('PASS online civilian sale SQL: canonical ore debit, priced credit/bonus issuance, ledger, retry and owner isolation');
