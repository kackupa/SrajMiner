import assert from 'node:assert/strict';
import { VerifiedGameController, type VerifiedGameTransport } from '../src/game/online/VerifiedGameController';
import { freshOnlineSimulation } from '../src/game/online/OnlineSimulation';
import type { SubmitGameCommands } from '../src/game/online/GameProtocol';
import type { OnlineGameState } from '../src/game/online/VerifiedGameApi';

const campaign = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let state: OnlineGameState = { campaign_id: campaign, ruleset_version: 'online-1', revision: 0,
  active_planet: 'cryo-shelf', credit_minor: 0, snapshot: freshOnlineSimulation(7, 1000) };
const seen: SubmitGameCommands[] = [];
let dropFirstResponse = true;
const transport: VerifiedGameTransport = {
  async claim(id, sessionId) {
    assert.equal(id, campaign);
    return { campaign_id: id, session_id: sessionId, revision: state.revision, expires_at: '' };
  },
  async read() { return structuredClone(state); },
  async submit(raw) {
    const command = raw as SubmitGameCommands;
    seen.push(structuredClone(command));
    if (state.revision === 0) {
      state = { ...state, revision: 1, snapshot: { ...state.snapshot, last_sequence: 0 } };
      if (dropFirstResponse) { dropFirstResponse = false; throw new Error('NETWORK_LOST'); }
    }
    return { revision: 1, last_sequence: 0 };
  },
  async transfer() { throw new Error('UNUSED'); },
  async buildUplink() { throw new Error('UNUSED'); },
  async quoteCivilian() { throw new Error('UNUSED'); },
  async sellCivilian() { throw new Error('UNUSED'); },
  async servicePod() { throw new Error('UNUSED'); },
  async installUpgrade() { throw new Error('UNUSED'); },
  async recoverPod() { throw new Error('UNUSED'); },
};
const controller = new VerifiedGameController(transport);
await controller.open(campaign);
const controls = { left: false, right: false, up: false, down: true, drill: true };
await assert.rejects(controller.submit(controls), /NETWORK_LOST/);
assert.equal(controller.state?.revision, 0, 'unconfirmed ore/state is not shown');
assert.equal(controller.pending?.expected_revision, 0);
assert.equal(controller.pending?.segments[0].sequence, 0);
await assert.rejects(controller.refreshAfterStale(), /INVALID_STATE/,
  'an uncertain network result cannot discard the operation');
const recovered = await controller.submit({ ...controls, left: true });
assert.equal(recovered.revision, 1);
assert.equal(recovered.snapshot.last_sequence, 0);
assert.deepEqual(seen[0], seen[1], 'retry keeps the same operation and controls');
assert.equal(controller.pending, null);
let advanced = { ...state, revision: 0, snapshot: freshOnlineSimulation(7, 1000) };
let rejected = 0;
const staleTransport: VerifiedGameTransport = {
  async claim(id, sessionId) { return { campaign_id: id, session_id: sessionId, revision: advanced.revision, expires_at: '' }; },
  async read() { return structuredClone(advanced); },
  async submit() {
    rejected++;
    advanced = { ...advanced, revision: 1, snapshot: { ...advanced.snapshot, last_sequence: 0 } };
    throw new Error('STALE_REVISION');
  },
  async transfer() { throw new Error('UNUSED'); },
  async buildUplink() { throw new Error('UNUSED'); },
  async quoteCivilian() { throw new Error('UNUSED'); },
  async sellCivilian() { throw new Error('UNUSED'); },
  async servicePod() { throw new Error('UNUSED'); },
  async installUpgrade() { throw new Error('UNUSED'); },
  async recoverPod() { throw new Error('UNUSED'); },
};
const staleController = new VerifiedGameController(staleTransport);
await staleController.open(campaign);
await assert.rejects(staleController.submit(controls), /STALE_REVISION/);
assert.equal(staleController.stale, true);
assert.ok(staleController.pending);
await assert.rejects(staleController.retry(), /STALE_REVISION/);
assert.equal(rejected, 1, 'a definitive stale result is not retried forever');
const refreshed = await staleController.refreshAfterStale();
assert.equal(refreshed.revision, 1);
assert.equal(staleController.pending, null);
assert.equal(staleController.stale, false);

let transferred = false;
let loseTransferReply = true;
const transfers: unknown[] = [];
const transferTransport: VerifiedGameTransport = {
  async claim(id, sessionId) { return { campaign_id: id, session_id: sessionId, revision: state.revision, expires_at: '' }; },
  async read() { return structuredClone(state); },
  async submit() { throw new Error('UNUSED'); },
  async buildUplink() { throw new Error('UNUSED'); },
  async quoteCivilian() { throw new Error('UNUSED'); },
  async sellCivilian() { throw new Error('UNUSED'); },
  async servicePod() { throw new Error('UNUSED'); },
  async installUpgrade() { throw new Error('UNUSED'); },
  async recoverPod() { throw new Error('UNUSED'); },
  async transfer(command) {
    transfers.push(structuredClone(command));
    if (!transferred) {
      transferred = true;
      state = { ...state, revision: 2, ship_cargo_half_units: { copper: 1 },
        snapshot: { ...state.snapshot, cargo_half_units: { copper: 1 } } };
    }
    if (loseTransferReply) { loseTransferReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign,
      kind: 'transfer_ore', revision: 2, source: 'miner', target: 'ship', ore: 'copper',
      quantity_half_units: 1, source_after_half_units: 1, target_after_half_units: 1,
      occurred_at: '' };
  },
};
const transferController = new VerifiedGameController(transferTransport);
await transferController.open(campaign);
await assert.rejects(transferController.transfer('miner', 'copper', 1), /NETWORK_LOST/);
assert.equal(transferController.state?.revision, 1, 'unconfirmed transfer stays hidden');
await assert.rejects(transferController.submit(controls), /OPERATION_PENDING/);
assert.ok(transferController.pendingTransfer);
const transferRecovered = await transferController.retryTransfer();
assert.equal(transferRecovered.revision, 2);
assert.deepEqual(transfers[0], transfers[1], 'uncertain transfer retries the identical request');
assert.equal(transferController.pendingTransfer, null);

let loseBuildReply = true;
const builds: unknown[] = [];
const buildTransport: VerifiedGameTransport = {
  async claim(id, sessionId) { return { campaign_id: id, session_id: sessionId, revision: state.revision, expires_at: '' }; },
  async read() { return structuredClone(state); },
  async submit() { throw new Error('UNUSED'); },
  async transfer() { throw new Error('UNUSED'); },
  async buildUplink(command) {
    builds.push(structuredClone(command));
    if (!state.market_uplink_online) state = { ...state, revision: 3, market_uplink_online: true };
    if (loseBuildReply) { loseBuildReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign,
      kind: 'build_market_uplink', revision: 3, planet: 'cryo-shelf',
      material_debits: [], occurred_at: '' };
  },
  async quoteCivilian() { throw new Error('UNUSED'); },
  async sellCivilian() { throw new Error('UNUSED'); },
  async servicePod() { throw new Error('UNUSED'); },
  async installUpgrade() { throw new Error('UNUSED'); },
  async recoverPod() { throw new Error('UNUSED'); },
};
const buildController = new VerifiedGameController(buildTransport);
await buildController.open(campaign);
await assert.rejects(buildController.buildUplink(), /NETWORK_LOST/);
assert.equal(buildController.state?.market_uplink_online, undefined, 'unconfirmed building stays hidden');
await assert.rejects(buildController.submit(controls), /OPERATION_PENDING/);
await assert.rejects(buildController.transfer('miner', 'copper', 1), /OPERATION_PENDING/);
const built = await buildController.retryBuildUplink();
assert.equal(built.market_uplink_online, true);
assert.deepEqual(builds[0], builds[1], 'uncertain construction retries the identical request');
assert.equal(buildController.pendingBuild, null);
const rejectedTransport: VerifiedGameTransport = {
  ...buildTransport,
  async transfer() { throw new Error('INSUFFICIENT_ORE'); },
  async buildUplink() { throw new Error('ACCESS_REQUIRED'); },
};
const rejectedController = new VerifiedGameController(rejectedTransport);
await rejectedController.open(campaign);
await assert.rejects(rejectedController.transfer('miner', 'copper', 1), /INSUFFICIENT_ORE/);
assert.equal(rejectedController.pendingTransfer, null, 'definite SQL rejection cannot be retried as an uncertain commit');
await assert.rejects(rejectedController.buildUplink(), /ACCESS_REQUIRED/);
assert.equal(rejectedController.pendingBuild, null);

let loseSaleReply = true;
const sales: unknown[] = [];
const saleTransport: VerifiedGameTransport = {
  ...buildTransport,
  async quoteCivilian(command) {
    return { ...command, revision: state.revision, gross_credit_minor: 900,
      bonus_credit_minor: 300, total_credit_minor: 1200,
      project: 'Eastern power grid', source_available_half_units: 2 };
  },
  async sellCivilian(command) {
    sales.push(structuredClone(command));
    if (state.revision === 3) state = { ...state, revision: 4, credit_minor: 1200,
      ship_cargo_half_units: { copper: 0 } };
    if (loseSaleReply) { loseSaleReply = false; throw new Error('NETWORK_LOST'); }
    return { ...command, kind: 'sell_to_civilian', revision: 4,
      gross_credit_minor: 900, bonus_credit_minor: 300, total_credit_minor: 1200,
      wallet_after_minor: 1200, project: 'Eastern power grid', occurred_at: '' };
  },
};
const saleController = new VerifiedGameController(saleTransport);
await saleController.open(campaign);
const quoted = await saleController.quoteCivilian('ship','helion','copper',1);
assert.equal(quoted.total_credit_minor,1200);
await assert.rejects(saleController.sellCivilian('ship','helion','copper',1),/NETWORK_LOST/);
assert.equal(saleController.state?.credit_minor,0,'unconfirmed credits stay hidden');
await assert.rejects(saleController.submit(controls),/OPERATION_PENDING/);
assert.ok(saleController.pendingSale);
const sold = await saleController.retrySale();
assert.equal(sold.credit_minor,1200);
assert.deepEqual(sales[0],sales[1],'uncertain civilian sale retries identical request');
assert.equal(saleController.pendingSale,null);
state = { ...state, snapshot: { ...state.snapshot, fuel_milli: 120000, hull_milli: 79500 } };
let loseServiceReply = true;
const services: unknown[] = [];
const serviceTransport: VerifiedGameTransport = {
  ...saleTransport,
  async servicePod(command) {
    services.push(structuredClone(command));
    if (state.revision === 4) state = { ...state, revision: 5, credit_minor: 200,
      snapshot: { ...state.snapshot, fuel_milli: 140000, hull_milli: 100000 } };
    if (loseServiceReply) { loseServiceReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign,
      kind: 'service_pod', service_kind: 'both', revision: 5, cost_minor: 1000,
      wallet_after_minor: 200, fuel_before_milli: 120000, fuel_after_milli: 140000,
      hull_before_milli: 79500, hull_after_milli: 100000, occurred_at: '' };
  },
};
const serviceController = new VerifiedGameController(serviceTransport);
await serviceController.open(campaign);
await assert.rejects(serviceController.servicePod('both'),/NETWORK_LOST/);
assert.equal(serviceController.state?.revision,4,'unconfirmed service stays hidden');
await assert.rejects(serviceController.submit(controls),/OPERATION_PENDING/);
const serviced = await serviceController.retryService();
assert.equal(serviced.revision,5);
assert.equal(serviced.snapshot.fuel_milli,140000);
assert.equal(serviced.credit_minor,200);
assert.deepEqual(services[0],services[1],'uncertain service retries identical request');
assert.equal(serviceController.pendingService,null);
let loseUpgradeReply = true;
const upgrades: unknown[] = [];
const upgradeTransport: VerifiedGameTransport = {
  ...serviceTransport,
  async installUpgrade(command) {
    upgrades.push(structuredClone(command));
    if (state.revision === 5) state = { ...state, revision: 6,
      snapshot: { ...state.snapshot, levels: { ...state.snapshot.levels, cargo: 2 } } };
    if (loseUpgradeReply) { loseUpgradeReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign,
      kind: 'install_rig_upgrade', upgrade_key: 'cargo', revision: 6,
      level_before: 1, level_after: 2, material_debits: [],
      fuel_after_milli: 140000, hull_after_milli: 100000, occurred_at: '' };
  },
};
const upgradeController = new VerifiedGameController(upgradeTransport);
await upgradeController.open(campaign);
await assert.rejects(upgradeController.installUpgrade('cargo'),/NETWORK_LOST/);
assert.equal(upgradeController.state?.snapshot.levels.cargo,1,'unconfirmed upgrade stays hidden');
await assert.rejects(upgradeController.submit(controls),/OPERATION_PENDING/);
const upgraded = await upgradeController.retryUpgrade();
assert.equal(upgraded.snapshot.levels.cargo,2);
assert.deepEqual(upgrades[0],upgrades[1],'uncertain upgrade retries identical request');
assert.equal(upgradeController.pendingUpgrade,null);

state = { ...state, snapshot: { ...state.snapshot, fuel_milli: 0,
  cargo_half_units: { copper: 5 }, pod: { x: 680, y: 250, vx: 0, vy: 0, docked: false } } };
let loseRecoveryReply = true;
const recoveries: unknown[] = [];
const recoveryTransport: VerifiedGameTransport = {
  ...upgradeTransport,
  async recoverPod(command) {
    recoveries.push(structuredClone(command));
    if (state.revision === 6) state = { ...state, revision: 7,
      snapshot: { ...state.snapshot, fuel_milli: 140000, hull_milli: 100000,
        cargo_half_units: {}, pod: {x:680,y:-22,vx:0,vy:0,docked:true} } };
    if (loseRecoveryReply) { loseRecoveryReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign,
      kind: 'recover_stranded_pod', revision: 7, wallet_after_minor: 200,
      forfeited_cargo_half_units: { copper:5 }, fuel_before_milli: 0,
      fuel_after_milli: 140000, hull_before_milli: 100000,
      hull_after_milli: 100000, occurred_at: '' };
  },
};
const recoveryController = new VerifiedGameController(recoveryTransport);
await recoveryController.open(campaign);
await assert.rejects(recoveryController.recoverStrandedPod(),/NETWORK_LOST/);
assert.equal(recoveryController.state?.snapshot.cargo_half_units.copper,5,
  'unconfirmed recovery cannot display ore forfeiture or restored battery');
await assert.rejects(recoveryController.submit(controls),/OPERATION_PENDING/);
const rescued = await recoveryController.retryRecovery();
assert.equal(rescued.revision,7);
assert.deepEqual(rescued.snapshot.cargo_half_units,{});
assert.deepEqual(recoveries[0],recoveries[1], 'uncertain recovery retries identical request');
assert.equal(recoveryController.pendingRecovery,null);
state = { ...state, snapshot: { ...state.snapshot, core_fuel: 4,
  core_relics: ['core-cryo'] } };
let loseTravelReply = true;
const travels: unknown[] = [];
const travelTransport: VerifiedGameTransport = {
  ...recoveryTransport,
  async travel(command) {
    travels.push(structuredClone(command));
    if (state.revision === 7) state = { ...state, revision: 8,
      active_planet: 'mars-frontier', snapshot: { ...state.snapshot,
        core_fuel: 3, destroyed_cells: [], drops: [] } };
    if (loseTravelReply) { loseTravelReply = false; throw new Error('NETWORK_LOST'); }
    return { operation_id: command.operation_id, campaign_id: campaign, kind: 'travel',
      revision: 8, source: 'cryo-shelf', destination: 'mars-frontier',
      core_fuel_after: 3, occurred_at: '' };
  },
};
const travelController = new VerifiedGameController(travelTransport);
await travelController.open(campaign);
await assert.rejects(travelController.travel('mars-frontier'),/NETWORK_LOST/);
assert.equal(travelController.state?.active_planet,'cryo-shelf',
  'uncertain jump leaves the old planet visible');
await assert.rejects(travelController.submit(controls),/OPERATION_PENDING/);
const arrived = await travelController.retryTravel();
assert.equal(arrived.active_planet,'mars-frontier');
assert.equal(arrived.snapshot.core_fuel,3);
assert.deepEqual(travels[0],travels[1],'uncertain jump retries the identical request');
assert.equal(travelController.pendingTravel,null);
console.log('PASS verified controller: serialized gameplay/economy/travel, stable retries and canonical reload');
