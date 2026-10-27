import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { advanceOnlineSimulation, type OnlineSimulationState } from '../src/game/online/OnlineSimulation';
import type { InputSegment } from '../src/game/online/GameProtocol';

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
for (let number=1;number<=11;number++) {
  const names = [
    'verified_online_foundation','verified_online_start','verified_game_transactions',
    'online_inventory_transfer','online_market_uplink','online_civilian_sales',
    'online_operation_registry','online_pod_service','online_basic_rig_upgrades',
    'online_stranded_recovery','online_travel',
  ];
  await db.exec(migration(`202610190000${String(number).padStart(2,'0')}_${names[number-1]}.sql`));
}
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const session='33333333-3333-4333-8333-333333333333';
const startOp='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstOp='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const returnOp='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const jump='select public.travel_online_campaign($1::uuid,$2,$3::uuid,$4::uuid,$5)';
await db.query('insert into auth.users(id) values ($1),($2)',[alice,bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const campaign=(await db.query<{start_online_campaign:{campaign_id:string}}>(
  'select public.start_online_campaign($1,$2::uuid)',['online-1',startOp])).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',[campaign,session,false]);
await assert.rejects(db.query(jump,[campaign,0,firstOp,session,'mars-frontier']),/TRAVEL_ACCESS_REQUIRED/);
await assert.rejects(db.query('update public.online_world_states set world_seed=0'),/permission denied|row-level security/i);

// Privileged fixture represents a recovered Cryo core and earned stock; browser
// requests contain no balance, position, seed or cargo fields.
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=
  snapshot || '{"core_fuel":4,"core_relics":["core-cryo"],"destroyed_cells":["24,40"],
    "drops":[{"id":"24,39","x":24,"y":39,"ore":"copper","quantity_half_units":1}]}'::jsonb
  where campaign_id=$1`,[campaign]);
await db.query(`insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','copper',3),($1,$2,'ship','silver',5)`,[campaign,alice]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await assert.rejects(db.query(jump,[campaign,0,startOp,session,'mars-frontier']),/OPERATION_CONFLICT/);
await assert.rejects(db.query(jump,[campaign,1,firstOp,session,'mars-frontier']),/STALE_REVISION/);
await assert.rejects(db.query(jump,[campaign,0,firstOp,session,'cryo-shelf']),/ROUTE_UNAVAILABLE/);
await db.exec(`set request.jwt.claim.sub='${bob}'`);
await assert.rejects(db.query(jump,[campaign,0,firstOp,session,'mars-frontier']),/ACCESS_REQUIRED/);
await db.exec(`set request.jwt.claim.sub='${alice}'`);
const first=(await db.query<{travel_online_campaign:{revision:number;core_fuel_after:number;destination:string}}>(
  jump,[campaign,0,firstOp,session,'mars-frontier'])).rows[0]!.travel_online_campaign;
assert.equal(first.revision,1);
assert.equal(first.core_fuel_after,3);
assert.equal(first.destination,'mars-frontier');
assert.deepEqual((await db.query(jump,[campaign,0,firstOp,session,'mars-frontier'])).rows[0]?.travel_online_campaign,
  first,'lost response returns the exact first receipt');
await assert.rejects(db.query(jump,[campaign,0,firstOp,session,'cryo-shelf']),/OPERATION_CONFLICT/);
const read=async()=> (await db.query<{read_online_game_state:{active_planet:string;revision:number;
  market_uplink_online:boolean;
  credit_minor:number;ship_cargo_half_units:Record<string,number>;
  snapshot:{world_seed:number;destroyed_cells:string[];drops:unknown[];core_fuel:number;
    cargo_half_units:Record<string,number>;last_sequence:number}}}>(
  'select public.read_online_game_state($1::uuid)',[campaign])).rows[0]!.read_online_game_state;
const mars=await read();
assert.equal(mars.active_planet,'mars-frontier');
assert.deepEqual(mars.snapshot.destroyed_cells,[]);
assert.deepEqual(mars.snapshot.drops,[]);
assert.equal(mars.snapshot.core_fuel,3);
assert.deepEqual(mars.snapshot.cargo_half_units,{copper:3});
assert.deepEqual(mars.ship_cargo_half_units,{silver:5});
assert.equal(mars.credit_minor,0);
await assert.rejects(db.query(jump,[campaign,1,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',session,'hull-graveyard']),/ROUTE_UNAVAILABLE/);
const returned=(await db.query<{travel_online_campaign:{revision:number;core_fuel_after:number}}>(
  jump,[campaign,1,returnOp,session,'cryo-shelf'])).rows[0]!.travel_online_campaign;
assert.equal(returned.core_fuel_after,2);
const cryo=await read();
assert.equal(cryo.active_planet,'cryo-shelf');
assert.deepEqual(cryo.snapshot.destroyed_cells,['24,40']);
assert.equal(cryo.snapshot.drops.length,1);
assert.equal(cryo.snapshot.core_fuel,2);
assert.deepEqual(cryo.snapshot.cargo_half_units,{copper:3});
assert.deepEqual(cryo.ship_cargo_half_units,{silver:5});
assert.equal(cryo.snapshot.last_sequence,-1);
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as n from public.online_world_states')).rows[0]?.n,2);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
await db.query(jump,[campaign,2,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',session,'mars-frontier']);
const transfer=(await db.query<{transfer_online_ore:{revision:number} }>(
  'select public.transfer_online_ore($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)',
  [campaign,3,'ffffffff-ffff-4fff-8fff-ffffffffffff',session,'miner','ship','copper',1]
)).rows[0]!.transfer_online_ore;
assert.equal(transfer.revision,4,'cargo transfer also works after arrival on Mars');
await db.exec('reset role');
await db.query(`insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner','iron',8),($1,$2,'miner','silver',4),($1,$2,'miner','nickel',1)
  on conflict (campaign_id,location_key,ore) do update
    set quantity_half_units=public.online_inventory.quantity_half_units+excluded.quantity_half_units`,
  [campaign,alice]);
await db.query(`update public.online_inventory set quantity_half_units=quantity_half_units+6
  where campaign_id=$1 and location_key='miner' and ore='copper'`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const built=(await db.query<{build_online_market_uplink:{revision:number;planet:string}}>(
  'select public.build_online_market_uplink($1::uuid,$2,$3::uuid,$4::uuid)',
  [campaign,4,'11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session]
)).rows[0]!.build_online_market_uplink;
assert.equal(built.planet,'mars-frontier');
assert.equal((await read()).market_uplink_online,true);
const offer=(await db.query<{quote_online_civilian_sale:{total_credit_minor:number}}>(
  'select public.quote_online_civilian_sale($1::uuid,$2,$3,$4,$5)',
  [campaign,'miner','helion','nickel',1]
)).rows[0]!.quote_online_civilian_sale;
assert.ok(offer.total_credit_minor>0);
const sold=(await db.query<{sell_online_ore_to_civilian:{revision:number;wallet_after_minor:number}}>(
  'select public.sell_online_ore_to_civilian($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,$7,$8)',
  [campaign,5,'22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session,'miner','helion','nickel',1]
)).rows[0]!.sell_online_ore_to_civilian;
assert.equal(sold.wallet_after_minor,offer.total_credit_minor);
assert.equal((await read()).snapshot.cargo_half_units.nickel,0);
await db.exec('reset role');
for (const ore of ['copper','iron','silver']) await db.query(`
  insert into public.online_inventory(campaign_id,owner_id,location_key,ore,quantity_half_units)
  values ($1,$2,'miner',$3,20) on conflict (campaign_id,location_key,ore) do update
  set quantity_half_units=public.online_inventory.quantity_half_units+20`,[campaign,alice,ore]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const upgraded=(await db.query<{install_online_rig_upgrade:{revision:number;level_after:number}}>(
  'select public.install_online_rig_upgrade($1::uuid,$2,$3::uuid,$4::uuid,$5)',
  [campaign,6,'33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session,'drill']
)).rows[0]!.install_online_rig_upgrade;
assert.equal(upgraded.level_after,2);
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=jsonb_set(snapshot,
  '{fuel_milli}','100000'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const serviced=(await db.query<{service_online_pod:{revision:number;fuel_after_milli:number}}>(
  'select public.service_online_pod($1::uuid,$2,$3::uuid,$4::uuid,$5)',
  [campaign,7,'44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session,'fuel']
)).rows[0]!.service_online_pod;
assert.equal(serviced.fuel_after_milli,140000);
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=jsonb_set(snapshot,
  '{fuel_milli}','0'::jsonb) where campaign_id=$1`,[campaign]);
await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}'; set request.jwt.claim.role='authenticated';`);
const recovered=(await db.query<{recover_online_stranded_pod:{revision:number;fuel_after_milli:number}}>(
  'select public.recover_online_stranded_pod($1::uuid,$2,$3::uuid,$4::uuid)',
  [campaign,8,'55555555-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session]
)).rows[0]!.recover_online_stranded_pod;
assert.equal(recovered.fuel_after_milli,140000);
assert.equal((await read()).active_planet,'mars-frontier');
// A second isolated campaign uses an authorized service commit for the first
// Mars core. The fixture starts immediately before the real mined tile edge.
await db.exec(`set request.jwt.claim.sub='${bob}'`);
const marsCampaign=(await db.query<{start_online_campaign:{campaign_id:string}}>(
  'select public.start_online_campaign($1,$2::uuid)',
  ['online-1','66666666-aaaa-4aaa-8aaa-aaaaaaaaaaaa']
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',
  [marsCampaign,session,false]);
await db.exec('reset role');
const starter=(await db.query<{snapshot:OnlineSimulationState}>(
  'select snapshot from public.online_simulation_state where campaign_id=$1',
  [marsCampaign])).rows[0]!.snapshot;
await db.query(`update public.online_campaigns set active_planet='mars-frontier'
  where id=$1`,[marsCampaign]);
let before:OnlineSimulationState={...starter,world_seed:2223671298,
  core_fuel:3,core_relics:['core-cryo'],
  pod:{x:940,y:1440,vx:0,vy:0,docked:false},
  destroyed_cells:Array.from({length:11},(_,index)=>`24,${29+index}`),
  cargo_half_units:{}};
let claimed:OnlineSimulationState|undefined;
let claimSegment:InputSegment|undefined;
for(let sequence=0;sequence<60;sequence++) {
  const segment:InputSegment={sequence,duration_ms:200,left:false,right:false,
    up:false,down:true,drill:true,aim_cell:null};
  const next=advanceOnlineSimulation(before,[segment],before.observed_at_ms+200,'mars-frontier').state;
  if(next.core_relics.includes('core-mars')) {claimed=next;claimSegment=segment;break;}
  before=next;
}
assert.ok(claimed && claimSegment,'Mars core is reached through trusted simulation');
const {cargo_half_units:_fixtureCargo,...storedBefore}=before;
await db.query('update public.online_simulation_state set snapshot=$2::jsonb where campaign_id=$1',
  [marsCampaign,JSON.stringify(storedBefore)]);
await db.exec(`set role service_role; set request.jwt.claim.role='service_role'`);
const claimInput={campaign_id:marsCampaign,ruleset_version:'online-1',expected_revision:0,
  operation_id:'77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session_id:session,
  segments:[claimSegment]};
const claimReceipt=(await db.query<{commit_online_game_step:{core_claimed:boolean;revision:number}}>(
  'select public.commit_online_game_step($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6::jsonb,$7::jsonb)',
  [bob,marsCampaign,0,claimInput.operation_id,session,JSON.stringify(claimInput),JSON.stringify(claimed)]
)).rows[0]!.commit_online_game_step;
assert.equal(claimReceipt.core_claimed,true);
assert.equal(claimed.core_fuel,7);
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${bob}'; set request.jwt.claim.role='authenticated';`);
const marsClaimRead=(await db.query<{read_online_game_state:{snapshot:{core_fuel:number;core_relics:string[]}}}>(
  'select public.read_online_game_state($1::uuid)',[marsCampaign])).rows[0]!.read_online_game_state;
assert.equal(marsClaimRead.snapshot.core_fuel,7);
assert.deepEqual(marsClaimRead.snapshot.core_relics,['core-mars','core-cryo']);
console.log('PASS online travel SQL: exact fuel/world conservation and Mars cargo, uplink, sale, upgrade, service, recovery');
