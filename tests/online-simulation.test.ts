import assert from 'node:assert/strict';
import { advanceOnlineSimulation, freshOnlineSimulation } from '../src/game/online/OnlineSimulation';
import { parseGameCommandBatch, type InputSegment } from '../src/game/online/GameProtocol';

const seed = 2223671298;
const blank = freshOnlineSimulation(seed, 0);
assert.deepEqual(blank.cargo_half_units, {});
assert.deepEqual(blank.destroyed_cells, []);

const run = (drillLevel = 1) => {
  let state = freshOnlineSimulation(seed, 0);
  state.levels.drill = drillLevel;
  const destroyed = new Set<string>();
  for (let batch = 0; batch < 22; batch++) {
    const segment: InputSegment = {
      sequence: batch, duration_ms: 200,
      left: false, right: batch < 10, up: false, down: batch >= 10,
      drill: true, aim_cell: null,
    };
    const result = advanceOnlineSimulation(state, [segment], batch * 200);
    for (const cell of result.destroyed_cells) {
      assert.equal(destroyed.has(cell), false, 'a cell can be rewarded once');
      destroyed.add(cell);
    }
    state = JSON.parse(JSON.stringify(result.state)); // database round trip
  }
  return state;
};
const earned = run();
assert.deepEqual(run(), earned, 'canonical controls produce deterministic state');
assert.equal(earned.cargo_half_units.copper, 6, 'three real starter cells yielded three copper');
assert.deepEqual(earned.destroyed_cells, ['23,0', '23,1', '23,2']);
assert.equal(earned.last_sequence, 21);
assert.ok(earned.fuel_milli < blank.fuel_milli);
const upgradedDrill = run(2);
assert.ok(upgradedDrill.pod.y > earned.pod.y,
  'server replay applies the installed drill level to cut and descend sooner');
assert.ok(upgradedDrill.fuel_milli > earned.fuel_milli,
  'faster cutting spends less battery on the same legal controls');
assert.deepEqual(upgradedDrill.cargo_half_units,earned.cargo_half_units,
  'the speed upgrade changes timing without minting another tile reward');

const idle: InputSegment = { sequence: 22, duration_ms: 20, left: false, right: false, up: false, down: false, drill: false, aim_cell: null };
const afterReload = advanceOnlineSimulation(earned, [idle], 4400);
assert.equal(afterReload.state.cargo_half_units.copper, 6, 'reload does not reissue prior rewards');
assert.deepEqual(afterReload.destroyed_cells, []);
assert.throws(() => advanceOnlineSimulation(earned, [idle], 4199), /INVALID_COMMAND/, 'server time cannot go backward');
assert.throws(() => advanceOnlineSimulation(earned, [{ ...idle, sequence: 21 }], 4400), /INVALID_COMMAND/, 'sequence replay denied');
assert.throws(() => advanceOnlineSimulation(earned, [{ ...idle, aim_cell: { column: 23, row: 3 } }], 4400), /INVALID_COMMAND/, 'pointer target remains disabled in first verified slice');
assert.equal(parseGameCommandBatch({
  campaign_id: '11111111-1111-4111-8111-111111111111', ruleset_version: 'online-1',
  expected_revision: 0, operation_id: '22222222-2222-4222-8222-222222222222',
  session_id: '33333333-3333-4333-8333-333333333333', segments: [idle],
  ore: 'diamond',
}), null, 'client-reported ore is rejected at the wire boundary');

const fullBudget: InputSegment[] = Array.from({ length: 5 }, (_, sequence) => ({
  sequence, duration_ms: 200, left: false, right: false, up: false, down: false, drill: false, aim_cell: null,
}));
const spent = advanceOnlineSimulation(blank, fullBudget, 0).state;
assert.equal(spent.input_budget_ms, 0);
assert.throws(() => advanceOnlineSimulation(spent, [{ ...idle, sequence: 5 }], 0), /RATE_LIMITED/, 'fast-forward denied');
assert.equal(advanceOnlineSimulation(spent, [{ ...idle, sequence: 5 }], 20).state.input_budget_ms, 0);

const nearEmpty = { ...blank, fuel_milli: 1, cargo_half_units: { copper: 3 } };
const strandedInput: InputSegment = { ...idle, sequence: 0, duration_ms: 200,
  up: true };
const stranded = advanceOnlineSimulation(nearEmpty, [strandedInput], 0).state;
assert.equal(stranded.fuel_milli, 0, 'the fatal input commits zero fuel instead of rolling back forever');
assert.equal(stranded.last_sequence, 0);
assert.deepEqual(stranded.cargo_half_units,{copper:3},
  'depletion neither duplicates nor silently forfeits earned cargo');
assert.throws(() => advanceOnlineSimulation(stranded,
  [{ ...strandedInput, sequence: 1 }], 200), /INVALID_COMMAND/,
  'further movement waits for server-owned recovery');

let coreRun = freshOnlineSimulation(seed,0);
coreRun.pod = {x:940,y:1440,vx:0,vy:0,docked:false};
coreRun.destroyed_cells = Array.from({length:11},(_,index)=>`24,${29+index}`);
for (let sequence=0; sequence<18 && !coreRun.core_relics.length; sequence++) {
  const segment:InputSegment = { ...strandedInput, sequence, down:true, up:false, drill:true };
  coreRun = advanceOnlineSimulation(coreRun,[segment],sequence*200).state;
}
assert.deepEqual(coreRun.core_relics,['core-cryo']);
assert.equal(coreRun.core_fuel,4);
assert.ok(coreRun.destroyed_cells.includes('24,40'));
const afterCore = advanceOnlineSimulation(coreRun,[{ ...idle,
  sequence:coreRun.last_sequence+1 }],(coreRun.last_sequence+1)*200).state;
assert.equal(afterCore.core_fuel,4,'reload and later controls cannot repeat a core claim');
assert.deepEqual(afterCore.core_relics,['core-cryo']);

let marsCoreRun = freshOnlineSimulation(seed,0);
marsCoreRun.pod = {x:940,y:1440,vx:0,vy:0,docked:false};
marsCoreRun.destroyed_cells = Array.from({length:11},(_,index)=>`24,${29+index}`);
marsCoreRun.core_relics = ['core-cryo'];
marsCoreRun.core_fuel = 3;
for (let sequence=0; sequence<60 && !marsCoreRun.core_relics.includes('core-mars'); sequence++) {
  const segment:InputSegment = { ...strandedInput, sequence, down:true, up:false, drill:true };
  marsCoreRun = advanceOnlineSimulation(marsCoreRun,[segment],sequence*200,'mars-frontier').state;
}
assert.deepEqual(marsCoreRun.core_relics,['core-mars','core-cryo'],
  'the canonical planet selects the core identity');
assert.equal(marsCoreRun.core_fuel,7,'Mars core adds four units to carried jump fuel');
assert.ok(marsCoreRun.destroyed_cells.includes('24,40'));
assert.throws(() => advanceOnlineSimulation(marsCoreRun,[{...idle,
  sequence:marsCoreRun.last_sequence+1}],(marsCoreRun.last_sequence+1)*200,'hull-graveyard'),
  /INVALID_STATE/,'unreleased destinations cannot receive verified controls');

let renewable = freshOnlineSimulation(seed,0);
renewable.pod={x:980,y:1600,vx:0,vy:0,docked:false};
renewable.destroyed_cells=Array.from({length:12},(_,index)=>`24,${29+index}`);
renewable.core_relics=['core-cryo'];
renewable.core_fuel=3;
for(let sequence=0;sequence<20;sequence++)
  renewable=advanceOnlineSimulation(renewable,[{...idle,sequence,duration_ms:200,
    drill:true}],sequence*200).state;
assert.equal(renewable.core_extraction_elapsed_ms,4000);
renewable=advanceOnlineSimulation(renewable,[{...idle,sequence:20,duration_ms:200}],4000).state;
assert.equal(renewable.core_extraction_elapsed_ms,0,'release interrupts renewable extraction');
for(let sequence=21;sequence<71;sequence++)
  renewable=advanceOnlineSimulation(renewable,[{...idle,sequence,duration_ms:200,
    drill:true}],sequence*200).state;
assert.equal(renewable.core_fuel,4,'ten uninterrupted seconds issue one fuel');
assert.equal(renewable.core_extraction_elapsed_ms,0);
for(let sequence=71;sequence<76;sequence++)
  renewable=advanceOnlineSimulation(renewable,[{...idle,sequence,duration_ms:200,
    drill:true}],sequence*200).state;
assert.equal(renewable.core_fuel,4,'renewable reserve has a hard ceiling');

console.log('PASS online simulation: deterministic Cryo/Mars mining, once-only cores, timed renewable fuel, depletion and replay rejection');
