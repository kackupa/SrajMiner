import { defaultLoadout } from '../src/game/economy/Loadout';
import assert from 'node:assert/strict';
import { PLANET_CHART } from '../src/game/config';
import { emptyCargo, Progress } from '../src/game/economy/Progress';
import { LOCAL_CAMPAIGN_ID_KEY, LOCAL_RESTORE_SAFETY_PREFIX, prepareLocalBackup, restoreLocalBackup } from '../src/game/online/LocalBackup';
import { SAVE_KEY, validateSave, type SaveData } from '../src/game/save/SaveManager';

const p = new Progress();
p.money = 0;
const original = {
  version: 35 as const, loadout: defaultLoadout(), shipCargo: emptyCargo(), specialistModules: { reinforcedHull: false, efficientCooling: false },
  extraction: {}, deliveries: {}, productionUpdatedAt: 1, solarPosition: null, planetChart: PLANET_CHART,
  campaignSeed: 1, activeMap: 'cryo-shelf' as const,
  maps: { 'cryo-shelf': { seed: 1, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], warehouse: emptyCargo() } },
  money: 0, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull, cargo: emptyCargo(), maxDepth: 0,
  artifact: false, milestones: ['mothership-origin'], shipComponents: [], routeFragments: [], coreFuel: 0,
  mothershipBoarded: false, charges: 0, ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint,
  salvageMagnet: false, ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit,
  ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal, ownedProfiles: [...p.ownedProfiles],
  selectedProfile: p.selectedProfile, specialization: p.specialization, stasisModule: false,
  returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: false,
} satisfies SaveData;
assert.equal(validateSave(original), true);

const map = new Map<string, string>([[SAVE_KEY, JSON.stringify(original)]]);
const storage = {
  getItem: (key: string) => map.get(key) ?? null,
  setItem: (key: string, value: string) => { map.set(key, value); },
  removeItem: (key: string) => { map.delete(key); },
};
const before = map.get(SAVE_KEY);
const backup = prepareLocalBackup(storage);
assert.ok(backup);
assert.equal(backup.save_schema, 32);
assert.equal(backup.payload.money, 0);
assert.equal(map.get(SAVE_KEY), before, 'preparing backup cannot rewrite the Local save');
assert.equal(map.get(LOCAL_CAMPAIGN_ID_KEY), backup.campaign_id);
assert.equal(prepareLocalBackup(storage)?.campaign_id, backup.campaign_id);

const changed = { ...original, money: 24 };
map.set(SAVE_KEY, JSON.stringify(changed));
const restored = restoreLocalBackup(storage, backup.payload);
assert.equal(restored.restored, true);
if (restored.restored) {
  assert.ok(restored.safety_copy_key?.startsWith(LOCAL_RESTORE_SAFETY_PREFIX));
  assert.equal(JSON.parse(map.get(restored.safety_copy_key!)!).money, 24);
}
assert.equal(JSON.parse(map.get(SAVE_KEY)!).money, 0);

const otherCampaign = crypto.randomUUID();
map.set(SAVE_KEY, JSON.stringify(changed));
const crossDevice = restoreLocalBackup(storage, backup.payload, otherCampaign);
assert.equal(crossDevice.restored, true);
assert.equal(map.get(LOCAL_CAMPAIGN_ID_KEY), otherCampaign);
assert.equal(JSON.parse(map.get(SAVE_KEY)!).money, 0);
if (crossDevice.restored && crossDevice.safety_copy_key) {
  assert.equal(map.get(`${crossDevice.safety_copy_key}:campaign-id`), backup.campaign_id);
}

const corrupt = restoreLocalBackup(storage, { ...original, money: -1 });
assert.deepEqual(corrupt, { restored: false, reason: 'invalid' });
assert.equal(JSON.parse(map.get(SAVE_KEY)!).money, 0);

let failDestination = true;
const failingStorage = {
  getItem: storage.getItem,
  setItem: (key: string, value: string) => { if (key === SAVE_KEY && failDestination) throw new Error('quota'); map.set(key, value); },
  removeItem: storage.removeItem,
};
const failure = restoreLocalBackup(failingStorage, changed, backup.campaign_id);
assert.deepEqual(failure, { restored: false, reason: 'storage_unavailable' });
assert.equal(JSON.parse(map.get(SAVE_KEY)!).money, 0);
assert.equal(map.get(LOCAL_CAMPAIGN_ID_KEY), otherCampaign);
failDestination = false;
console.log('PASS Local backup validates full save, preserves existing bytes and makes a safety copy before restore');
