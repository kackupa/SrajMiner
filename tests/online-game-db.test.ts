import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { advanceOnlineSimulation, type OnlineSimulationState } from '../src/game/online/OnlineSimulation';
import type { InputSegment } from '../src/game/online/GameProtocol';
import { executeVerifiedGameBatch, type OnlineGameRepository } from '../src/game/online/VerifiedGameService';

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
]) await db.exec(migration(name));

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const session = '33333333-3333-4333-8333-333333333333';
const otherSession = '44444444-4444-4444-8444-444444444444';
const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.query('insert into auth.users(id) values ($1), ($2)', [alice, bob]);
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const start = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)', ['online-1', '55555555-5555-4555-8555-555555555555'],
)).rows[0]!.start_online_campaign;
const campaign = start.campaign_id;
await assert.rejects(db.query('select count(*)::integer as n from public.online_simulation_state'),
  /permission denied/i, 'browser cannot read private simulation state');
const claimed = (await db.query<{ claim_online_session: { revision: number } }>(
  'select public.claim_online_session($1::uuid,$2::uuid,$3)', [campaign, session, false],
)).rows[0]!.claim_online_session;
assert.equal(claimed.revision, 0);
const initialRead = (await db.query<{ read_online_game_state: { revision: number; credit_minor: number; snapshot: OnlineSimulationState } }>(
  'select public.read_online_game_state($1::uuid)', [campaign],
)).rows[0]!.read_online_game_state;
assert.equal(initialRead.revision, 0);
assert.equal(initialRead.credit_minor, 0);
assert.deepEqual(initialRead.snapshot.cargo_half_units, {});
await assert.rejects(db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',
  [campaign, otherSession, false]), /SESSION_CONFLICT/);
await assert.rejects(db.query('select public.commit_online_game_step($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6::jsonb,$7::jsonb)',
  [alice, campaign, 0, operation, session, '{}', '{}']), /permission denied|ACCESS_REQUIRED/i);
await db.exec(`set request.jwt.claim.sub = '${bob}';`);
await assert.rejects(db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',
  [campaign, otherSession, true]), /ACCESS_REQUIRED/);
await assert.rejects(db.query('select public.read_online_game_state($1::uuid)', [campaign]), /ACCESS_REQUIRED/);

await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
const stored = (await db.query<{ snapshot: Omit<OnlineSimulationState, 'cargo_half_units'> }>(
  'select snapshot from public.online_simulation_state where campaign_id = $1', [campaign],
)).rows[0]!.snapshot;
assert.equal(typeof stored.world_seed, 'number');
assert.equal(stored.last_sequence, -1);
let state: OnlineSimulationState = { ...stored, cargo_half_units: {} };
const commitSql = 'select public.commit_online_game_step($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6::jsonb,$7::jsonb)';
const invalidOperation = '77777777-7777-4777-8777-777777777777';
const firstControl: InputSegment = { sequence: 0, duration_ms: 200, left: false, right: false,
  up: false, down: true, drill: true, aim_cell: null };
const validFirstState = advanceOnlineSimulation(state, [firstControl], state.observed_at_ms + 200).state;
await assert.rejects(db.query(commitSql, [alice, campaign, 0, invalidOperation, session, '{}',
  JSON.stringify({ ...validFirstState, cargo_half_units: { copper: 100 } })]), /HOLD_FULL/);
assert.equal((await db.query('select count(*)::integer as n from public.online_inventory')).rows[0]?.n, 0,
  'rejected forged cargo cannot create inventory');
assert.equal((await db.query('select revision from public.online_campaigns where id = $1', [campaign])).rows[0]?.revision, 0);
const segments: InputSegment[] = [];
for (let sequence = 0; sequence < 22; sequence++) segments.push({
  sequence, duration_ms: 200, left: false, right: false, up: false, down: true,
  drill: true, aim_cell: null,
});
let receipt: unknown;
const repository: OnlineGameRepository = {
  async hasOperation(ownerId, operationId) {
    return (await db.query('select 1 from public.online_game_operations where owner_id = $1 and operation_id = $2',
      [ownerId, operationId])).rows.length > 0;
  },
  async campaign(campaignId) {
    return (await db.query<{ id: string; owner_id: string; ruleset_version: string; revision: number; active_planet: string }>(
      'select id,owner_id,ruleset_version,revision,active_planet from public.online_campaigns where id = $1', [campaignId],
    )).rows[0] ?? null;
  },
  async simulation(campaignId) {
    return (await db.query<{ snapshot: unknown }>(
      'select snapshot from public.online_simulation_state where campaign_id = $1', [campaignId],
    )).rows[0]?.snapshot;
  },
  async minerInventory(campaignId) {
    return (await db.query<{ ore: string; quantity_half_units: number }>(
      "select ore,quantity_half_units from public.online_inventory where campaign_id = $1 and location_key = 'miner'",
      [campaignId],
    )).rows;
  },
  async commit(args) {
    return (await db.query<{ commit_online_game_step: unknown }>(commitSql, [args.owner_id,
      args.campaign_id, args.expected_revision, args.operation_id, args.session_id,
      JSON.stringify(args.input), JSON.stringify(args.new_state),
    ])).rows[0]!.commit_online_game_step;
  },
};
const firstEnvelope = { campaign_id: campaign, ruleset_version: 'online-1', expected_revision: 0,
  operation_id: operation, session_id: session, segments: [firstControl] };
await assert.rejects(executeVerifiedGameBatch({ ...firstEnvelope, position: { x: 1, y: 500 } },
  alice, repository, state.observed_at_ms + 200), /INVALID_COMMAND/);
await assert.rejects(executeVerifiedGameBatch({ ...firstEnvelope, cargo_half_units: { copper: 20 } },
  alice, repository, state.observed_at_ms + 200), /INVALID_COMMAND/);
await assert.rejects(executeVerifiedGameBatch(firstEnvelope, bob, repository, state.observed_at_ms + 200),
  /ACCESS_REQUIRED/);
for (const segment of segments) {
  const next = advanceOnlineSimulation(state, [segment], state.observed_at_ms + 200).state;
  const key = segment.sequence === 0 ? operation : `${String(segment.sequence).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
  const input = { campaign_id: campaign, ruleset_version: 'online-1',
    expected_revision: segment.sequence, operation_id: key, session_id: session, segments: [segment] };
  receipt = await executeVerifiedGameBatch(input, alice, repository, state.observed_at_ms + 200);
  if (segment.sequence === 0) {
    const retry = await executeVerifiedGameBatch(input, alice, repository, state.observed_at_ms + 999);
    assert.deepEqual(retry, receipt, 'operation replay keeps the first receipt');
    await assert.rejects(db.query(
      commitSql,
      [alice, campaign, 0, key, session, JSON.stringify({ ...input, segments: [] }), JSON.stringify(next)],
    ), /OPERATION_CONFLICT/);
  }
  state = next;
}
assert.equal(state.cargo_half_units.copper, 6);
assert.equal((await db.query('select quantity_half_units from public.online_inventory where campaign_id = $1 and ore = $2',
  [campaign, 'copper'])).rows[0]?.quantity_half_units, 6);
assert.equal((await db.query('select revision from public.online_campaigns where id = $1', [campaign])).rows[0]?.revision, 22);
assert.deepEqual((await db.query('select snapshot from public.online_simulation_state where campaign_id = $1',
  [campaign])).rows[0]?.snapshot, (({ cargo_half_units: _cargo, ...snapshot }) => snapshot)(state));
assert.ok(receipt);
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
const reloaded = (await db.query<{ read_online_game_state: { revision: number; credit_minor: number; snapshot: OnlineSimulationState } }>(
  'select public.read_online_game_state($1::uuid)', [campaign],
)).rows[0]!.read_online_game_state;
assert.equal(reloaded.revision, 22);
assert.equal(reloaded.credit_minor, 0);
assert.deepEqual(reloaded.snapshot, state, 'authenticated reload returns server state and canonical cargo');
await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
await assert.rejects(db.query(
  commitSql,
  [alice, campaign, 0, '66666666-6666-4666-8666-666666666666', session, '{}', JSON.stringify(state)],
), /STALE_REVISION/);
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${alice}'; set request.jwt.claim.role = 'authenticated';`);
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)', [campaign, otherSession, true]);
await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
await assert.rejects(db.query(commitSql,
  [alice, campaign, 22, '88888888-8888-4888-8888-888888888888', session, '{}', JSON.stringify(state)]),
  /SESSION_CONFLICT/);
assert.equal((await db.query('select revision from public.online_campaigns where id = $1', [campaign])).rows[0]?.revision, 22);

// A second isolated campaign begins at zero and earns one core through the
// server replay. The service-role SQL commit still checks the core tile edge.
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${bob}'; set request.jwt.claim.role = 'authenticated';`);
const coreCampaign = (await db.query<{ start_online_campaign: { campaign_id: string } }>(
  'select public.start_online_campaign($1,$2::uuid)',
  ['online-1','99999999-9999-4999-8999-999999999999'],
)).rows[0]!.start_online_campaign.campaign_id;
await db.query('select public.claim_online_session($1::uuid,$2::uuid,$3)',[coreCampaign,otherSession,false]);
await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
const coreStored = (await db.query<{snapshot:OnlineSimulationState}>(
  'select snapshot from public.online_simulation_state where campaign_id=$1',[coreCampaign],
)).rows[0]!.snapshot;
const coreFixture = { ...coreStored, world_seed:2223671298,
  pod:{x:940,y:1440,vx:0,vy:0,docked:false},
  destroyed_cells:Array.from({length:11},(_,index)=>`24,${29+index}`) };
await db.exec('reset role');
await db.query('update public.online_simulation_state set snapshot=$2::jsonb where campaign_id=$1',
  [coreCampaign,JSON.stringify(coreFixture)]);
await db.exec(`set role service_role; set request.jwt.claim.role = 'service_role';`);
const forgedCore = { ...coreFixture, core_fuel:5, core_relics:['core-cryo'],
  destroyed_cells:[...coreFixture.destroyed_cells,'24,40'], last_sequence:0 };
await assert.rejects(db.query(commitSql,[bob,coreCampaign,0,
  'aaaaaaaa-0000-4000-8000-000000000000',otherSession,'{}',JSON.stringify(forgedCore)]),
  /INVALID_STATE/,'a service commit cannot overissue core fuel');
await assert.rejects(db.query(commitSql,[bob,coreCampaign,0,
  'aaaaaaab-0000-4000-8000-000000000000',otherSession,'{}',
  JSON.stringify({ ...forgedCore,core_fuel:4,destroyed_cells:coreFixture.destroyed_cells })]),
  /INVALID_STATE/,'a core claim requires the canonical core tile to be newly destroyed');
let coreState:OnlineSimulationState = {...coreFixture,cargo_half_units:{}};
let coreReceipt:unknown;
for (let sequence=0;sequence<18 && !coreState.core_relics.length;sequence++) {
  const segment:InputSegment={sequence,duration_ms:200,left:false,right:false,
    up:false,down:true,drill:true,aim_cell:null};
  const input={campaign_id:coreCampaign,ruleset_version:'online-1' as const,
    expected_revision:sequence,
    operation_id:`${String(sequence).padStart(8,'0')}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
    session_id:otherSession,segments:[segment]};
  coreReceipt=await executeVerifiedGameBatch(input,bob,repository,coreState.observed_at_ms+200);
  coreState=(await db.query<{snapshot:OnlineSimulationState}>(
    'select snapshot from public.online_simulation_state where campaign_id=$1',
    [coreCampaign])).rows[0]!.snapshot;
  coreState.cargo_half_units={};
  if (coreState.core_relics.length) {
    assert.equal((coreReceipt as {core_claimed:boolean}).core_claimed,true);
    assert.deepEqual(await executeVerifiedGameBatch(input,bob,repository,coreState.observed_at_ms+999),
      coreReceipt,'core claim retry cannot issue another four fuel');
  }
}
assert.deepEqual(coreState.core_relics,['core-cryo']);
assert.equal(coreState.core_fuel,4);
const coreClaimRows=(await db.query<{n:number}>(
  `select count(*)::integer as n from public.online_game_operations
    where campaign_id=$1 and receipt->>'core_claimed'='true'`,[coreCampaign])).rows[0]!.n;
assert.equal(coreClaimRows,1);
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${bob}'; set request.jwt.claim.role = 'authenticated';`);
const coreRead=(await db.query<{read_online_game_state:{revision:number;credit_minor:number;
  snapshot:OnlineSimulationState}}>('select public.read_online_game_state($1::uuid)',
  [coreCampaign])).rows[0]!.read_online_game_state;
assert.equal(coreRead.snapshot.core_fuel,4);
assert.equal(coreRead.credit_minor,0);
assert.deepEqual(coreRead.snapshot.core_relics,['core-cryo']);
await db.exec(`reset role; set role service_role; set request.jwt.claim.role = 'service_role';`);
// A privileged fixture simulates one future travel-fuel spend; gameplay must
// earn the replacement through ten seconds of legal server-timed controls.
await db.exec('reset role');
await db.query(`update public.online_simulation_state set snapshot=
  jsonb_set(jsonb_set(snapshot,'{core_fuel}','3'::jsonb),'{pod}',
    '{"x":980,"y":1600,"vx":0,"vy":0,"docked":false}'::jsonb)
  where campaign_id=$1`,[coreCampaign]);
await db.exec(`set role service_role; set request.jwt.claim.role='service_role';`);
const preRenew=(await db.query<{snapshot:OnlineSimulationState}>(
  'select snapshot from public.online_simulation_state where campaign_id=$1',
  [coreCampaign])).rows[0]!.snapshot;
const earlyRenew={...preRenew,core_fuel:4,last_sequence:preRenew.last_sequence+1,
  core_extraction_elapsed_ms:0,cargo_half_units:{}};
await assert.rejects(db.query(commitSql,[bob,coreCampaign,coreRead.revision,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',otherSession,
  JSON.stringify({segments:[{duration_ms:200}]}),JSON.stringify(earlyRenew)]),
  /INVALID_STATE/,'SQL rejects an early renewable fuel award');
let renewalReceipt:unknown;
for(let index=0;index<50;index++){
  const revision=coreRead.revision+index;
  const sequence=preRenew.last_sequence+1+index;
  const segment:InputSegment={sequence,duration_ms:200,left:false,right:false,
    up:false,down:false,drill:true,aim_cell:null};
  const input={campaign_id:coreCampaign,ruleset_version:'online-1' as const,
    expected_revision:revision,
    operation_id:`${String(index).padStart(8,'0')}-cccc-4ccc-8ccc-cccccccccccc`,
    session_id:otherSession,segments:[segment]};
  renewalReceipt=await executeVerifiedGameBatch(input,bob,repository,
    preRenew.observed_at_ms+(index+1)*200);
  if(index===49){
    assert.equal((renewalReceipt as {core_renewed:boolean}).core_renewed,true);
    assert.deepEqual(await executeVerifiedGameBatch(input,bob,repository,
      preRenew.observed_at_ms+20000),renewalReceipt,
    'renewable claim retry cannot issue a second fuel unit');
  }
}
const renewed=(await db.query<{snapshot:OnlineSimulationState}>(
  'select snapshot from public.online_simulation_state where campaign_id=$1',
  [coreCampaign])).rows[0]!.snapshot;
assert.equal(renewed.core_fuel,4);
assert.equal(renewed.core_extraction_elapsed_ms,0);
assert.deepEqual(renewed.core_relics,['core-cryo']);
assert.equal((await db.query<{n:number}>(`select count(*)::integer as n
  from public.online_game_operations where campaign_id=$1
  and receipt->>'core_renewed'='true'`,[coreCampaign])).rows[0]!.n,1);
await db.close();
console.log('PASS online game db: private state, canonical ore, once-only core and timed renewable fuel');
