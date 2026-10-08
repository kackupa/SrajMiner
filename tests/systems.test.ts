import assert from 'node:assert/strict';
import { TileWorld, type Tile } from '../src/game/world/TileWorld';
import { RockSwimmer } from '../src/game/world/RockSwimmer';
import { Progress } from '../src/game/economy/Progress';
import { DEFAULT_AUDIO_MIX, LANDMARK_CUE_NOTES, AudioSystem, normalizeAudioVolume, parseAudioMix, startingMusicPhase } from '../src/game/audio/AudioSystem';
import { MiningSystem, aimedDrillTarget, chargeTargets, collectOreDrop, podWithinPickupReach, applySalvageMagnet, hasClearMagnetPath, updateOreDropPhysics, updateChargePhysics } from '../src/game/mining/MiningSystem';
import { PlayerPod, findGrappleAnchor, type Controls } from '../src/game/player/PlayerPod';
import { validateSave, migrateSave, parseSaveFile, SaveManager, type SaveData } from '../src/game/save/SaveManager';
import { ORE_KEYS, ORE_SILHOUETTES, WORLD, CORE, CORE_RELICS, coreSurveyComplete, CORE_WORLD_Y, FAR_SURFACE_ROW, FAR_SURFACE_Y, PHYSICS, DESCENT_WARNING_SPEED, MUSIC_DEPTH, UPGRADES, UPGRADE_KEYS, SHIP_COMPONENTS, ROUTE_FRAGMENTS, ROUTE_SURVEY_REWARDS, NAVIGATION_HASHES, CREW_ARCHIVE_CONCLUSION, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, ESCAPE_SUIT, PILOT_SUITS, POD_DECALS, POD_PROFILES, REGION_FINDS, depthAtWorldY, gravityDirectionAt, estimateVerticalReturnFuel, drillWidth, POD_SIZE, podVisualScale } from '../src/game/config';
import { getDialogFocusables } from '../src/game/ui/focus';
import { drawOreSymbol, flightWarning } from '../src/game/ui/HUD';
import { restoreMapState, snapshotMapState } from '../src/game/campaign/MapState';
import { atSurface, dockedOnSurface, surfaceTownTier, TOWN_TIER_HEIGHTS } from '../src/game/surface/SurfaceStation';
import { campaignMapRecords, collectCoreRelic, coreSurveyProgress, crewArchiveRestored } from '../src/game/campaign/Records';
import { screenToWorld, worldToScreen } from '../src/game/world/Projection';
import { planetChartToCartesian, planetCartesianToChart, planetChartVectorToCartesian, wrapPlanetSeam } from '../src/game/world/PlanetChart';
import { canAffordStructure, crossedStructureDeck, findBuildSite, nearbyServiceStation, type UndergroundStructure } from '../src/game/building/UndergroundStructures';
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}
const idle: Controls = { left: false, right: false, up: false, down: false };
test('audio mix defaults, clamps and parses saved per-channel levels', () => {
  assert.deepEqual(parseAudioMix(null), DEFAULT_AUDIO_MIX);
  assert.deepEqual(parseAudioMix('{"music":45,"effects":95}'), { music: 45, effects: 95 });
  assert.deepEqual(parseAudioMix('{"music":-4,"effects":140}'), { music: 0, effects: 100 });
  assert.deepEqual(parseAudioMix('invalid'), DEFAULT_AUDIO_MIX);
  assert.equal(normalizeAudioVolume(Number.NaN), 0);
});
test('music begins in the right depth band when an expedition is resumed', () => {
  assert.equal(startingMusicPhase(0), 'signal');
  assert.equal(startingMusicPhase(MUSIC_DEPTH.transition - 1), 'signal');
  assert.equal(startingMusicPhase(MUSIC_DEPTH.transition), 'transition');
  assert.equal(startingMusicPhase(MUSIC_DEPTH.deepOnLoad - 1), 'transition');
  assert.equal(startingMusicPhase(MUSIC_DEPTH.deepOnLoad), 'deep');
});
test('mouse projection reverses cleanly in either hemisphere', () => {
  for (const inverted of [false, true]) {
    const screen = worldToScreen(1200, 3400, 700, 3150, 960, 720, inverted);
    assert.deepEqual(screenToWorld(screen.x, screen.y, 700, 3150, 960, 720, inverted), { x: 1200, y: 3400 });
  }
});
test('planet chart projects a round surface and joins both surfaces through a twisted seam', () => {
  const width = 942, radius = 300;
  const samePoint = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    assert.ok(Math.abs(a.x - b.x) < 1e-8);
    assert.ok(Math.abs(a.y - b.y) < 1e-8);
  };
  samePoint(
    planetChartToCartesian({ u: 0, v: 35 }, width, radius),
    planetChartToCartesian({ u: width, v: 2 * radius - 35 }, width, radius),
  );
  samePoint(
    planetChartToCartesian({ u: 0, v: 2 * radius }, width, radius),
    planetChartToCartesian({ u: width, v: 0 }, width, radius),
  );
  for (const u of [0, width * 0.13, width / 2, width * 0.91, width])
    samePoint(planetChartToCartesian({ u, v: radius }, width, radius), { x: 0, y: 0 });
  for (const strip of [{ u: 140, v: 80 }, { u: 140, v: 540 }, { u: width * 0.8, v: 285 }]) {
    const cartesian = planetChartToCartesian(strip, width, radius, 40);
    const roundTrip = planetCartesianToChart(cartesian, width, radius, 40);
    assert.ok(Math.abs(roundTrip.u - strip.u) < 1e-8);
    assert.ok(Math.abs(roundTrip.v - strip.v) < 1e-8);
  }
  assert.deepEqual(planetCartesianToChart({ x: 0, y: 0 }, width, radius), { u: width / 2, v: radius });
  assert.throws(() => planetCartesianToChart({ x: 1, y: 1 }, width, 0), RangeError);

  const roundWidth = Math.PI * radius;
  const tangent = planetChartVectorToCartesian({ u: 0, v: 0 }, { du: 1, dv: 0 }, roundWidth, radius);
  assert.ok(Math.abs(Math.hypot(tangent.dx, tangent.dy) - 1) < 1e-8);
  const coreVector = planetChartVectorToCartesian({ u: width * 0.3, v: radius }, { du: 500, dv: 1 }, width, radius);
  assert.ok(Number.isFinite(coreVector.dx) && Number.isFinite(coreVector.dy));

  const beforeRightSeam = planetChartToCartesian({ u: width + 2.5, v: 40 }, width, radius);
  const right = wrapPlanetSeam({ u: width + 2.5, v: 40 }, 17, -1, width, radius);
  assert.deepEqual(right, { u: 2.5, v: 560, dv: -17, aimV: 1, crossings: 1 });
  samePoint(beforeRightSeam, planetChartToCartesian(right, width, radius));
  const beforeLeftSeam = planetChartToCartesian({ u: -0.25, v: 35 }, width, radius);
  const left = wrapPlanetSeam({ u: -0.25, v: 35 }, -5, 0.75, width, radius);
  assert.deepEqual(left, { u: width - 0.25, v: 565, dv: 5, aimV: -0.75, crossings: -1 });
  samePoint(beforeLeftSeam, planetChartToCartesian(left, width, radius));
  assert.deepEqual(wrapPlanetSeam({ u: width * 2 + 3, v: 120 }, 4, -2, width, radius),
    { u: 3, v: 120, dv: 4, aimV: -2, crossings: 2 });
  assert.throws(() => planetChartToCartesian({ u: 0, v: 0 }, 0, radius), RangeError);
  assert.throws(() => wrapPlanetSeam({ u: Number.NaN, v: 0 }, 0, 0, width, radius), RangeError);
});
test('route and archive discoveries add distinct beat-aligned music cues that respect mute', () => {
  const audio = new AudioSystem();
  audio.context = { currentTime: 8 } as AudioContext;
  audio.nextBeat = 8.25;
  const played: { at: number; frequency: number; bus: string }[] = [];
  audio.note = (at, frequency) => played.push({ at, frequency, bus: 'music' });
  assert.equal(audio.playLandmarkCue('route'), true);
  assert.deepEqual(played.map(({ at, frequency }) => [at, frequency]), LANDMARK_CUE_NOTES.route.map((frequency, index) => [8.25 + index * 0.25, frequency]));
  played.length = 0;
  assert.equal(audio.playLandmarkCue('archive'), true);
  assert.deepEqual(played.map(({ frequency }) => frequency), LANDMARK_CUE_NOTES.archive);
  assert.notDeepEqual(LANDMARK_CUE_NOTES.route, LANDMARK_CUE_NOTES.archive);
  audio.muted = true;
  played.length = 0;
  assert.equal(audio.playLandmarkCue('route'), false);
  assert.equal(played.length, 0);
});
test('modal focusables include visible controls and skip hidden or aria-hidden content', () => {
  const visibleButton = { hidden: false, getAttribute: () => null, getClientRects: () => [1] };
  const slider = { hidden: false, getAttribute: () => null, getClientRects: () => [1] };
  const hidden = { hidden: true, getAttribute: () => null, getClientRects: () => [1] };
  const ariaHidden = { hidden: false, getAttribute: () => 'true', getClientRects: () => [1] };
  const visuallyHidden = { hidden: false, getAttribute: () => null, getClientRects: () => [] };
  let selector = '';
  const dialog = {
    querySelectorAll: (query: string) => {
      selector = query;
      return [visibleButton, slider, hidden, ariaHidden, visuallyHidden];
    },
  } as unknown as ParentNode;
  assert.deepEqual(getDialogFocusables(dialog), [visibleButton, slider]);
  assert.match(selector, /button:not\(:disabled\)/);
  assert.match(selector, /input:not\(:disabled\)/);
  assert.match(selector, /a\[href\]/);
});
test('region snapshots restore excavation, discoveries, ore drops, charges, and best depth', () => {
  const saved: Partial<Record<'cryo-shelf' | 'mars-frontier' | 'hull-graveyard' | 'prism-fault', import('../src/game/save/SaveManager').WorldSave>> = {};
  const first = new TileWorld(501, [], [], 'cryo-shelf');
  first.break(24, 0);
  first.reveal(980, 280);
  const drops = [{ id: `${first.seed}:24,0`, ore: 'copper' as const, units: 1.5, x: 980, y: 280, vx: 6, vy: 0 }];
  const charge = { x: 980, y: 280, vy: 37, fuse: 0.7 };
  const constructed = [{ id: 'service:980:280', kind: 'service' as const, x: 980, y: 280 }];
  saved['cryo-shelf'] = snapshotMapState(undefined, first, 980, 280, 84, drops, charge, constructed);

  const other = restoreMapState(undefined, 'prism-fault', 902);
  other.world.break(24, 1);
  saved['prism-fault'] = snapshotMapState(undefined, other.world, 980, -22, 0, [], undefined);
  const resumed = restoreMapState(saved['cryo-shelf'], 'cryo-shelf', 999);
  resumed.drops[0].vx = -100;

  assert.equal(resumed.world.seed, 501, 'first-visit seed is not reused over a saved map seed');
  assert.equal(resumed.world.get(24, 0).type, 'empty');
  assert.ok(resumed.world.discovered.size > 0);
  assert.deepEqual(saved['cryo-shelf']?.drops[0], drops[0], 'restored drops do not alias durable save data');
  assert.deepEqual(resumed.activeCharge, charge);
  assert.deepEqual(resumed.structures, constructed, 'planet-local refuel beacons survive map restoration');
  assert.notEqual(resumed.structures, constructed, 'restored structures do not alias the caller-owned list');
  const revisited = snapshotMapState(saved['cryo-shelf'], resumed.world, 980, 280, 32, resumed.drops, resumed.activeCharge);
  assert.equal(revisited.maxDepth, 84, 'best depth is retained when returning from a shallower visit');
  assert.equal(revisited.destroyed.includes('24,0'), true);
  assert.equal(saved['prism-fault']?.seed, 902);
});
test('planet core opens into a persistent second hemisphere with symmetric depth and home-fuel estimates', () => {
  const world = new TileWorld(702, [], [], 'cryo-shelf'), centerX = Math.floor(WORLD.width / 2), coreRow = Math.round(CORE_WORLD_Y / WORLD.tile);
  assert.equal(world.get(centerX, coreRow).coreRelicId, 'core-cryo', 'the passage centers a guaranteed map-specific objective');
  assert.equal(world.get(centerX, coreRow).type, 'hard', 'the core lens is a drillable landmark in the crossing route');
  assert.equal(world.get(centerX - 1, coreRow).type, 'empty', 'the center relic opens into a traversable core passage');
  assert.equal(world.get(centerX, FAR_SURFACE_ROW).type, 'empty', 'the opposite crust opens onto its own surface');
  assert.equal(world.gravitySign(CORE_WORLD_Y - 1), 1);
  assert.equal(world.gravitySign(CORE_WORLD_Y + 1), -1, 'gravity changes polarity immediately across the core');
  assert.equal(gravityDirectionAt(CORE_WORLD_Y - 1), 1);
  assert.equal(gravityDirectionAt(CORE_WORLD_Y + 1), -1);
  assert.equal(depthAtWorldY(WORLD.spawnY), 0);
  assert.equal(depthAtWorldY(FAR_SURFACE_Y + 22), 0);
  assert.ok(Math.abs(depthAtWorldY(CORE_WORLD_Y - 1) - depthAtWorldY(CORE_WORLD_Y + 1)) <= 1, 'depth reads continuously on both sides of the core');
  assert.ok(atSurface(WORLD.spawnX, FAR_SURFACE_Y + 22) && dockedOnSurface(WORLD.spawnX, FAR_SURFACE_Y + 22), 'the far crust has a real service-and-sale docking zone');
  const map = snapshotMapState(undefined, world, WORLD.spawnX, FAR_SURFACE_Y + 22, CORE.depthMeters, [], undefined);
  const resumed = restoreMapState(map, 'cryo-shelf', 0);
  assert.equal(resumed.world.seed, world.seed);
  assert.equal(resumed.world.gravitySign(map.y), -1, 'saved position derives the far-side gravity without adding save fields');
  const nearFuel = estimateVerticalReturnFuel(CORE_WORLD_Y - 1200, 3), farFuel = estimateVerticalReturnFuel(CORE_WORLD_Y + 1200, 3);
  assert.equal(nearFuel, farFuel, 'matched expeditions on either hemisphere get the same local-surface return estimate');
});
test('the surface mining town grows by permanent ship and planetary core milestones', () => {
  assert.deepEqual(TOWN_TIER_HEIGHTS, [158, 252, 346, 440, 552]);
  assert.deepEqual(TOWN_TIER_HEIGHTS.slice(1).map((height, index) => height > TOWN_TIER_HEIGHTS[index]!), [true, true, true, true]);
  assert.equal(surfaceTownTier([], []), 0, 'a fresh save begins with the starter camp');
  assert.equal(surfaceTownTier(['frame'], []), 1, 'beginning the launch craft raises the first sky deck');
  assert.equal(surfaceTownTier(['frame', 'propulsion', 'navigation', 'life-support'], []), 2, 'a flight-ready ship opens the upper district');
  assert.equal(surfaceTownTier([], ['core-mars']), 3, 'a recovered planetary core begins the signal skyway');
  assert.equal(surfaceTownTier([], CORE_RELICS.map((relic) => relic.id)), 4, 'the complete core ledger raises the town beacon to its peak');
});
test('sky town decks catch the pod on either hemisphere and allow drop-through', () => {
  const progress = new Progress();
  progress.milestones = CORE_RELICS.map((relic) => relic.id);
  const world = new TileWorld(704, [], [], 'cryo-shelf'), pod = new PlayerPod(world, progress);
  pod.docked = false;
  pod.y = -600;
  pod.vy = 200;
  for (let i = 0; i < 120 && pod.vy !== 0; i++) pod.update(1 / 120, idle, () => {});
  const highestDeck = 132 + 4 * 94;
  assert.equal(pod.y, -highestDeck - 16, 'home-side gravity lands on the highest unlocked one-way deck');
  assert.equal(pod.overlaps(pod.x, pod.y).length, 0);
  for (let i = 0; i < 24; i++) pod.update(1 / 120, { ...idle, down: true }, () => {});
  assert.ok(pod.y > -highestDeck - 16, 'holding down lets the miner drop through the deck');

  pod.y = FAR_SURFACE_Y + 600;
  pod.vy = -200;
  for (let i = 0; i < 120 && pod.vy !== 0; i++) pod.update(1 / 120, idle, () => {});
  assert.equal(pod.y, FAR_SURFACE_Y + highestDeck + 16, 'inverted gravity lands on the matching far-side deck');
  assert.equal(pod.overlaps(pod.x, pod.y).length, 0);
});
test('underground builds require mined space, materials, credits, and persistable planet-local sites', () => {
  const world = new TileWorld(705, [], [], 'cryo-shelf');
  for (let x = 22; x <= 26; x++) for (let y = 25; y <= 27; y++) world.break(x, y);
  for (let x = 21; x <= 27; x++) for (let y = 20; y <= 24; y++) world.break(x, y);
  for (let x = 22; x <= 26; x++) world.get(x, 28).type = 'rock';
  const site = findBuildSite(world, 980, 960, 1, 'platform', []);
  assert.ok(site, 'a cleared 180 m cavern can accept a deck');
  assert.equal(findBuildSite(world, 980, 960, 1, 'service', []), undefined, 'service beacons require a taller cleared chamber');
  for (let x = 22; x <= 26; x++) for (let y = 22; y <= 28; y++) world.break(x, y);
  const emptyCargo = { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 } as const;
  const serviceSite = findBuildSite(world, 980, 960, 1, 'service', []);
  assert.ok(serviceSite);
  const turretSite = findBuildSite(world, 980, 960, 1, 'turret', []);
  assert.ok(turretSite, 'a cleared cavern can host a sentry');
  assert.equal(canAffordStructure('turret', { ...emptyCargo, iron: 2, silver: 2, gold: 1 }, 560), true);
  assert.equal(findBuildSite(world, 980, 960, 1, 'service', [{ id: 'service:1', kind: 'service', ...serviceSite }]), undefined, 'only one service stop can be built per planet');
  assert.equal(findBuildSite(world, 980, 960, 1, 'platform', [{ id: 'nearby', kind: 'platform', x: 990, y: 1000 }]), undefined, 'structures need 240 px of spacing');
  assert.equal(canAffordStructure('platform', emptyCargo, 1000), false);
  assert.equal(canAffordStructure('platform', { ...emptyCargo, copper: 2, iron: 1 }, 140), true);
  assert.equal(canAffordStructure('service', { ...emptyCargo, iron: 3, silver: 2 }, 420), true);
  const deck: UndergroundStructure = { id: `platform:${site.x}:${site.y}`, kind: 'platform', ...site };
  const pod = new PlayerPod(world, new Progress());
  pod.structures = [deck];
  pod.x = site.x;
  pod.y = site.y - 100;
  pod.vy = 200;
  pod.docked = false;
  for (let i = 0; i < 120 && pod.vy !== 0; i++) pod.update(1 / 120, idle, () => {});
  assert.equal(pod.y, site.y - 16, 'the live pod physics catches a constructed platform');
  assert.equal(crossedStructureDeck([deck], site.x, site.y - 100, site.y + 100, 1, 16, false), site.y - 16, 'home-side gravity lands on the deck');
  assert.equal(crossedStructureDeck([deck], site.x, site.y - 100, site.y + 100, 1, 16, true), undefined, 'down drops through a built deck');
  const farDeck = { ...deck, id: 'platform:far', y: FAR_SURFACE_Y + site.y };
  assert.equal(crossedStructureDeck([farDeck], site.x, farDeck.y + 100, farDeck.y - 100, -1, 16, false), farDeck.y + 16, 'the deck catches correctly with inverted gravity');
  assert.ok(nearbyServiceStation([{ id: 'beacon', kind: 'service', ...serviceSite }], serviceSite.x, serviceSite.y));
});
test('W thrust reverses through the core and reaches the far crust dock without collision damage', () => {
  const world = new TileWorld(703, [], [], 'cryo-shelf'), progress = new Progress(), pod = new PlayerPod(world, progress);
  world.break(Math.floor(WORLD.width / 2), Math.round(CORE_WORLD_Y / WORLD.tile));
  pod.x = WORLD.spawnX;
  pod.y = CORE_WORLD_Y + 10;
  pod.vy = -180;
  pod.docked = false;
  sim(pod, 0.1, idle);
  assert.ok(pod.y < CORE_WORLD_Y && world.gravitySign(pod.y) === 1, 'an inward far-side flight crosses back through the core');
  const homewardY = pod.y;
  sim(pod, 0.4, { ...idle, up: true });
  assert.ok(pod.y < homewardY, 'W thrusts away from the core toward the home-side crust after inversion');
  assert.equal(progress.hull, 100, 'the reorientation and flight stay clear of the passage');

  pod.x = WORLD.spawnX;
  pod.y = FAR_SURFACE_Y - 8;
  pod.vy = 185;
  for (let row = FAR_SURFACE_ROW - 6; row < FAR_SURFACE_ROW; row++) world.break(Math.floor(pod.x / WORLD.tile), row);
  assert.equal(world.get(Math.floor(pod.x / WORLD.tile), FAR_SURFACE_ROW - 6).type, 'empty', 'the authored test launch lane is clear');
  for (let i = 0; i < 120 && !pod.docked; i++) pod.update(1 / 120, idle, (damage) => { progress.hull -= damage; });
  assert.equal(pod.docked, true, `the far surface safety field catches a returning miner (y=${pod.y.toFixed(1)}, vy=${pod.vy.toFixed(1)}, overlaps=${pod.overlaps(pod.x, pod.y).length})`);
  assert.equal(pod.y, FAR_SURFACE_Y + 22);
  assert.equal(progress.hull, 100);
});
test('each planetary core has one deterministic, drillable record with a one-time claim', () => {
  const maps = ['mars-frontier', 'cryo-shelf', 'hull-graveyard', 'prism-fault'] as const;
  const x = Math.floor(WORLD.width / 2), row = Math.round(CORE_WORLD_Y / WORLD.tile);
  assert.deepEqual(CORE_RELICS.map((entry) => entry.mapId), maps);
  assert.equal(new Set(CORE_RELICS.map((entry) => entry.name)).size, maps.length);
  for (const relic of CORE_RELICS) {
    const world = new TileWorld(711, [], [], relic.mapId);
    const tile = world.get(x, row);
    assert.equal(tile.coreRelicId, relic.id);
    assert.equal(world.generate(x, row).coreRelicId, relic.id, 'the objective is regenerated from map identity, not cached state');
    assert.equal(tile.tint, relic.tint);
  }
  const world = new TileWorld(712, [], [], 'cryo-shelf'), progress = new Progress(), mining = new MiningSystem(world, progress);
  const relicTile = world.get(x, row);
  let collected = 0;
  for (let i = 0; i < 60 * 30 && !progress.milestones.includes('core-cryo'); i++)
    mining.update(1 / 60, relicTile, (broken) => { if (broken.coreRelicId && collectCoreRelic(progress, broken.coreRelicId)) collected++; });
  assert.equal(collected, 1, 'drilling the passage objective records it once');
  assert.equal(progress.money, 80 + 600, 'a core objective pays its displayed archive claim once');
  assert.equal(world.get(x, row).type, 'empty');
  assert.equal(new TileWorld(world.seed, [...world.destroyed], [], 'cryo-shelf').get(x, row).coreRelicId, undefined, 'excavation prevents the record from respawning after reload');
  for (const relic of CORE_RELICS.filter((entry) => entry.id !== 'core-cryo')) assert.ok(collectCoreRelic(progress, relic.id));
  assert.equal(coreSurveyComplete(progress.milestones), true, 'the four records complete the planetary ledger');
  assert.equal(collectCoreRelic(progress, 'core-mars'), undefined, 'a recorded core cannot pay twice');
});
function sim(pod: PlayerPod, seconds: number, input: Controls, mining?: MiningSystem) {
  let damage = 0;
  for (let i = 0; i < seconds * 120; i++) {
    const tile = pod.update(1 / 120, input, (d) => {
      damage += d;
      pod.progress.hull -= d;
    });
    mining?.update(1 / 120, tile, () => {});
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0, 'pod must not clip terrain');
  }
  return damage;
}
test('same seed generates identical tiles independent of chunk order', () => {
  const a = new TileWorld(422),
    b = new TileWorld(422);
  for (let y = 140; y >= 0; y--)
    for (let x = 0; x < 48; x++) assert.deepEqual(a.get(x, y), b.generate(x, y));
});
test('mouse drill aim finds nearby rock in all directions and respects reach', () => {
  const world = new TileWorld(422);
  let podX = 0, podY = 0, target: Tile | undefined;
  for (let y = 3; y < 20 && !target; y++)
    for (let x = 3; x < WORLD.width - 3 && !target; x++) {
      if (world.get(x, y).type === 'empty' && world.get(x, y + 1).type !== 'empty' && world.get(x, y + 1).type !== 'boundary') {
        podX = x * WORLD.tile + WORLD.tile / 2;
        podY = y * WORLD.tile + WORLD.tile / 2;
        target = world.get(x, y + 1);
      }
    }
  assert.ok(target, 'fixture should contain an open tile above solid rock');
  assert.equal(aimedDrillTarget(world, podX, podY, podX, podY + WORLD.tile * 1.5), target);
  let upwardOrigin: { x: number; y: number; target: Tile } | undefined;
  for (let y = 4; y < 20 && !upwardOrigin; y++) for (let x = 3; x < WORLD.width - 3 && !upwardOrigin; x++) {
    const open = world.get(x, y), above = world.get(x, y - 1);
    if (open.type === 'empty' && above.type !== 'empty' && above.type !== 'boundary')
      upwardOrigin = { x: x * WORLD.tile + WORLD.tile / 2, y: y * WORLD.tile + WORLD.tile / 2, target: above };
  }
  assert.ok(upwardOrigin, 'fixture has intact rock above an open shaft');
  assert.equal(aimedDrillTarget(world, upwardOrigin!.x, upwardOrigin!.y, upwardOrigin!.x, upwardOrigin!.y - WORLD.tile), upwardOrigin!.target);
  const tileX = Math.floor(podX / WORLD.tile), tileY = Math.floor(podY / WORLD.tile);
  world.break(tileX + 1, tileY);
  world.break(tileX + 2, tileY);
  assert.equal(aimedDrillTarget(world, podX, podY, podX + WORLD.tile * 5, podY), undefined, 'mouse aim cannot reach through an empty tunnel to distant rock');
});
test('mouse drilling continues during upward flight and combines thrust and drill fuel use', () => {
  const world = new TileWorld(912), progress = new Progress(), pod = new PlayerPod(world, progress), mining = new MiningSystem(world, progress);
  pod.x = 980;
  pod.y = 180;
  pod.docked = false;
  for (let x = 23; x <= 24; x++) for (let y = 2; y <= 5; y++) world.break(x, y);
  const target = world.get(25, 4);
  target.type = 'rock';
  target.hardness = 0.1;
  target.ore = 'copper';
  target.oreUnits = 1;
  const initialFuel = progress.fuel, initialY = pod.y;
  let thrustObserved = false, targetBreaks = 0;
  const pointerX = target.x * WORLD.tile + WORLD.tile / 2, pointerY = target.y * WORLD.tile + WORLD.tile / 2;
  for (let i = 0; i < 24; i++) {
    const keyboardTarget = pod.update(1 / 120, { ...idle, up: true }, () => {});
    thrustObserved ||= pod.thrusting;
    const aimedTarget = aimedDrillTarget(world, pod.x, pod.y, pointerX, pointerY);
    mining.update(1 / 120, aimedTarget ?? keyboardTarget, (_tile, _collected, _dropped) => targetBreaks++, {
      x: pointerX - pod.x,
      y: pointerY - pod.y,
    });
  }
  assert.equal(thrustObserved, true, 'the pod keeps thrust active during the drilling action');
  assert.ok(pod.y < initialY, 'thrust still moves the pod while the mouse aims at rock');
  assert.ok(targetBreaks > 0 && world.destroyed.has('25,4'), 'aimed rock is mined while the keyboard flight input is held');
  assert.ok(progress.fuel < initialFuel - 1.25 / 120, 'the combined action pays both thrust and drilling fuel costs');
  assert.equal(pod.overlaps(pod.x, pod.y).length, 0, 'flight drilling keeps the pod clear of solid tiles');
});
test('radial multi-block drill cuts perpendicular to mouse aim and protects pod clearance', () => {
  const world = new TileWorld(644), progress = new Progress(), mining = new MiningSystem(world, progress);
  progress.levels.drill = 3;
  const center = world.get(24, 20);
  center.type = 'rock';
  const protectedCell = '23,21';
  mining.update(0.01, center, () => {}, { x: 1, y: 1 }, new Set([protectedCell]));
  assert.equal(mining.affected.length, 1, 'diagonal width-2 swath deduplicates and excludes protected tunnel tile');
  assert.equal(mining.affected[0]?.x, 24);
  assert.equal(mining.affected[0]?.y, 20);
});
test('armed mining charges fall under gravity and settle on solid ground', () => {
  const world = new TileWorld(641), x = 10;
  let floor = 4;
  while (world.get(x, floor).type === 'empty' || world.get(x, floor).type === 'boundary') floor++;
  for (let y = 0; y < floor; y++) world.break(x, y);
  const charge = { x: x * WORLD.tile + WORLD.tile / 2, y: 10, vy: 0 };
  const startingY = charge.y;
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) landed = updateChargePhysics(world, charge, 0.05);
  assert.ok(charge.y > startingY, 'charge accelerates downward through the cleared shaft');
  assert.equal(landed, true, 'charge lands on the intact floor tile');
  assert.equal(charge.y, floor * WORLD.tile - CHARGE.radius);
  assert.equal(charge.vy, 0, 'landed charge stops moving while its fuse continues');
});
test('charges and loose ore respond to inward gravity on the far hemisphere', () => {
  const world = new TileWorld(641), x = 10, floor = FAR_SURFACE_ROW - 8;
  for (let y = floor + 1; y <= floor + 3; y++) world.get(x, y).type = 'rock';
  const charge = { x: x * WORLD.tile + WORLD.tile / 2, y: floor * WORLD.tile + 90, vy: 0 };
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) landed = updateChargePhysics(world, charge, 0.05);
  assert.equal(landed, true);
  assert.ok(charge.y > floor * WORLD.tile, 'far-side charge settles against the core-facing side of rock');
  const drop = { x: charge.x, y: charge.y - 90, vx: 0, vy: 0 };
  updateOreDropPhysics(world, drop, 0.1);
  assert.ok(drop.y > floor * WORLD.tile - 90, 'loose ore falls toward the core on the far hemisphere');
});
test('different seeds create different geology', () => {
  const a = new TileWorld(1),
    b = new TileWorld(2);
  let differences = 0;
  for (let y = 10; y < 90; y++)
    for (let x = 0; x < 48; x++) if (a.get(x, y).ore !== b.get(x, y).ore) differences++;
  assert.ok(differences > 400);
});
test('destination maps have deterministic but distinct geology and resources', () => {
  const ice = new TileWorld(300, [], [], 'cryo-shelf'),
    iceReload = new TileWorld(300, [], [], 'cryo-shelf'),
    wreck = new TileWorld(300, [], [], 'hull-graveyard'),
    wreckReload = new TileWorld(300, [], [], 'hull-graveyard'),
    crystal = new TileWorld(300, [], [], 'prism-fault');
  assert.notEqual(ice.get(4, 10).tint, wreck.get(4, 10).tint);
  assert.notEqual(ice.get(4, 10).tint, crystal.get(4, 10).tint);
  for (let y = 0; y < 200; y += 7)
    for (let x = 0; x < WORLD.width; x += 5) {
      assert.equal(ice.get(x, y).ore, iceReload.generate(x, y).ore);
      assert.equal(wreck.get(x, y).ore, wreckReload.generate(x, y).ore);
    }
  assert.ok(ice.get(24, 0).ore, 'every map keeps the guaranteed starter seam');
});
test('cryo route fragments are guaranteed map-specific tiles and cannot respawn after mining', () => {
  const cryo = new TileWorld(2001, [], [], 'cryo-shelf');
  const mars = new TileWorld(2001, [], [], 'mars-frontier');
  for (const [row, id] of [[8, 'fragment-1'], [27, 'fragment-2'], [52, 'fragment-3'], [90, 'fragment-4']] as const) {
    const tile = cryo.get(24, row);
    assert.equal(tile.fragmentId, id);
    assert.notEqual(tile.type, 'empty');
    assert.equal(tile.ore, undefined);
    assert.equal(mars.get(24, row).fragmentId, undefined);
    cryo.break(24, row);
    assert.equal(cryo.get(24, row).fragmentId, undefined);
  }
});
test('route fragments open deterministic authored chambers with landmarks', () => {
  const world = new TileWorld(5521, [], [], 'cryo-shelf');
  const replay = new TileWorld(5521, [], [], 'cryo-shelf');
  const mars = new TileWorld(5521, [], [], 'mars-frontier');
  for (const fragment of ROUTE_FRAGMENTS) {
    const core = world.get(fragment.x, fragment.row);
    assert.equal(core.fragmentId, fragment.id);
    assert.equal(core.landmarkId, fragment.id);
    const sideRoom = world.get(fragment.x - fragment.chamber.halfWidth, fragment.row);
    assert.equal(sideRoom.type, 'empty');
    assert.equal(sideRoom.landmarkId, fragment.id);
    assert.deepEqual(sideRoom, replay.generate(sideRoom.x, sideRoom.y));
    assert.equal(mars.generate(sideRoom.x, sideRoom.y).landmarkId, undefined);
    const outside = world.get(fragment.x - fragment.chamber.halfWidth - 2, fragment.row);
    assert.equal(outside.landmarkId, undefined);
  }
});
test('mining a route fragment records it once and persists its excavation', () => {
  const w = new TileWorld(77, [], [], 'cryo-shelf'), p = new Progress(), m = new MiningSystem(w, p);
  const fragment = w.get(24, 8);
  let collected = 0;
  for (let i = 0; i < 120; i++) m.update(0.01, fragment, (tile) => {
    if (tile.fragmentId && p.collectRouteFragment(tile.fragmentId)) collected++;
  });
  assert.equal(collected, 1);
  assert.deepEqual(p.routeFragments, ['fragment-1']);
  assert.equal(p.money, 80 + ROUTE_SURVEY_REWARDS['fragment-1']);
  const restored = new TileWorld(77, [...w.destroyed], [], 'cryo-shelf');
  assert.equal(restored.get(24, 8).fragmentId, undefined);
  assert.equal(p.collectRouteFragment('fragment-1'), false);
  assert.equal(p.money, 80 + ROUTE_SURVEY_REWARDS['fragment-1']);
});
test('optional navigation hashes are guaranteed map-specific tiles and survive in existing save milestones', () => {
  const progress = new Progress();
  for (const hash of NAVIGATION_HASHES) {
    assert.ok(hash.crew && hash.role && hash.transcript.length >= 40, `${hash.id} includes a named crew log`);
    const world = new TileWorld(415, [], [], hash.mapId);
    const tile = world.get(hash.x, hash.row);
    assert.equal(tile.signalHashId, hash.id);
    assert.notEqual(tile.type, 'empty');
    assert.equal(new TileWorld(415, [], [], 'cryo-shelf').get(hash.x, hash.row).signalHashId, hash.mapId === 'cryo-shelf' ? hash.id : undefined);
    const mining = new MiningSystem(world, progress);
    let recovered = 0;
    for (let i = 0; i < 600 && !progress.milestones.includes(hash.id); i++) {
      mining.update(1 / 60, tile, (broken) => {
        if (broken.signalHashId && !progress.milestones.includes(broken.signalHashId)) {
          progress.milestones.push(broken.signalHashId);
          recovered++;
        }
      });
    }
    assert.equal(recovered, 1, `${hash.id} is collectable exactly once`);
    assert.equal(world.get(hash.x, hash.row).signalHashId, undefined, 'mined hash cannot respawn from cached chunk data');
  }
  assert.equal(new Set(NAVIGATION_HASHES.map((hash) => hash.crew)).size, NAVIGATION_HASHES.length, 'each region reveals a different crew voice');
  const save = {
    version: 14 as const, campaignSeed: 1, activeMap: 'cryo-shelf' as const,
    maps: { 'cryo-shelf': { seed: 1, x: WORLD.spawnX, y: WORLD.spawnY, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null } },
    money: 80, levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 }, fuel: 140, hull: 100,
    cargo: { copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 }, maxDepth: 0, artifact: false,
    milestones: NAVIGATION_HASHES.map((hash) => hash.id), shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab',
    ownedDecals: ['standard'], selectedDecal: 'standard', ownedProfiles: ['standard'], selectedProfile: 'standard', specialization: 'balanced', stasisModule: false, returnWinch: false,
  } as const;
  const currentSave = { ...save, version: 17 as const, maps: { 'cryo-shelf': { ...save.maps['cryo-shelf'], structures: [] } }, escapeSuit: false, pilotEscaping: false };
  assert.equal(validateSave(currentSave), true);
  assert.equal(validateSave({ ...currentSave, hull: 0, pilotEscaping: true }), true, 'a crashed miner can be saved while its pilot is alive in the escape suit');
  assert.equal(validateSave({ ...currentSave, hull: 0 }), false, 'zero hull without an active escape is rejected');
  assert.equal(validateSave({ ...currentSave, milestones: ['core-cryo'] }), true, 'escape support fits the version-17 save shape');
  assert.equal(validateSave({ ...currentSave, milestones: ['core-unknown'] }), false, 'unrecognized core-record IDs are rejected');
  const migratedV14 = migrateSave(save);
  assert.deepEqual(migratedV14?.maps['cryo-shelf']?.structures, [], 'version-14 campaigns receive an empty construction list');
  assert.equal(migrateSave({ ...currentSave, version: 16, escapeSuit: undefined, pilotEscaping: undefined })?.version, 17, 'version-16 campaigns migrate to the escape-suit schema');
  assert.deepEqual(migrateSave(currentSave)?.milestones, NAVIGATION_HASHES.map((hash) => hash.id));
  assert.equal(migrateSave({ ...currentSave, version: 13, levels: { ...currentSave.levels, grapple: undefined } })?.levels.grapple, 1, 'v13 campaigns gain an unupgraded grapple');
  const { ownedProfiles: _profiles, selectedProfile: _profile, ...version9 } = save;
  assert.deepEqual(migrateSave({ ...version9, version: 9 })?.milestones, NAVIGATION_HASHES.map((hash) => hash.id), 'v9 migration preserves hash records');
});
test('campaign archive reports per-region depth and collectibles without fabricating visits', () => {
  const records = campaignMapRecords(
    { 'cryo-shelf': 327.9, 'hull-graveyard': 0 },
    ['fragment-1', 'fragment-4'],
    ['hash-hull'],
  );
  assert.equal(records.length, 4);
  assert.deepEqual(records.find((record) => record.id === 'cryo-shelf'), {
    id: 'cryo-shelf', name: 'Cryo Shelf', visited: true, deepestMeters: 327,
    routeRecovered: 2, routeTotal: 4, hashesRecovered: 0, hashTotal: 1, coreName: 'Cryo Anchor Lens', coreRecovered: false,
  });
  assert.deepEqual(records.find((record) => record.id === 'hull-graveyard'), {
    id: 'hull-graveyard', name: 'Hull Graveyard', visited: true, deepestMeters: 0,
    routeRecovered: 0, routeTotal: 0, hashesRecovered: 1, hashTotal: 1, coreName: 'Reactor Witness', coreRecovered: false,
  });
  assert.equal(records.find((record) => record.id === 'mars-frontier')?.coreRecovered, false);
  const untouched = records.find((record) => record.id === 'prism-fault')!;
  assert.equal(untouched.visited, false);
  assert.equal(untouched.deepestMeters, 0);
});
test('automatic grapple catches a fast fall on reachable higher rock and W releases it safely', () => {
  const world = new TileWorld(191), progress = new Progress(), pod = new PlayerPod(world, progress);
  for (let y = 1; y <= 7; y++) world.break(24, y);
  world.break(23, 4);
  world.break(25, 4);
  world.chunks.clear();
  pod.docked = false;
  pod.x = 24 * WORLD.tile + 20;
  pod.y = 6 * WORLD.tile + 10;
  pod.vy = 250;
  let damage = 0;
  pod.update(1 / 60, idle, (amount) => { damage += amount; });
  assert.ok(pod.grappleAnchor, 'starter hook fires on a fast fall');
  assert.equal(pod.grappleAnchor?.x, 23 * WORLD.tile + 20);
  assert.equal(pod.vy, 0);
  assert.equal(damage, 0, 'latching prevents the impact');
  pod.update(1 / 60, { ...idle, up: true }, (amount) => { damage += amount; });
  assert.equal(pod.grappleAnchor, undefined, 'thrust breaks the tether');
  assert.ok(pod.vy < 0, 'the miner can thrust clear after release');
});
test('grapple target needs a higher anchor within range and a clear line', () => {
  const world = new TileWorld(192);
  const x = 24 * WORLD.tile + 20, y = 6 * WORLD.tile + 10;
  for (let ty = 1; ty <= 7; ty++) world.break(24, ty);
  world.break(23, 4);
  world.break(25, 4);
  world.chunks.clear();
  assert.ok(findGrappleAnchor(world, x, y, 110), 'a higher block directly above is reachable');
  assert.equal(findGrappleAnchor(world, x, y, 40), undefined, 'distant rock is outside range');
  world.break(23, 3);
  world.break(23, 5);
  world.chunks.clear();
  assert.equal(findGrappleAnchor(world, x, y, 110), undefined, 'intervening solid rock blocks the rope');
});
test('the final crew archive beat unlocks only after every regional hash is recovered', () => {
  const ids = NAVIGATION_HASHES.map((hash) => hash.id);
  assert.equal(crewArchiveRestored([]), false);
  for (let count = 1; count < ids.length; count++) assert.equal(crewArchiveRestored(ids.slice(0, count)), false);
  assert.equal(crewArchiveRestored(ids), true);
  assert.ok(CREW_ARCHIVE_CONCLUSION.transcript.includes('return handshake'));
});
test('planetary core records reveal one by one and gate the complete campaign conclusion', () => {
  const ids = CORE_RELICS.map((relic) => relic.id);
  const empty = coreSurveyProgress([]);
  assert.equal(empty.complete, false);
  assert.equal(empty.conclusion, undefined);
  assert.ok(empty.records.every((entry) => !entry.recovered));
  for (let count = 1; count < ids.length; count++) {
    const progress = coreSurveyProgress(ids.slice(0, count));
    assert.equal(progress.complete, false);
    assert.equal(progress.conclusion, undefined);
    assert.equal(progress.records.filter((entry) => entry.recovered).length, count);
  }
  const complete = coreSurveyProgress(ids);
  assert.equal(complete.complete, true);
  assert.ok(complete.conclusion?.transcript.includes('return key'));
  assert.ok(complete.records.every(({ relic }) => relic.record.length > 30));
});
test('campaign route supports serviced, physical sorties through all four signal chambers', () => {
  for (const seed of [9090, 1, 2026]) {
    const world = new TileWorld(seed, [], [], 'cryo-shelf');
    const progress = new Progress();
    const pod = new PlayerPod(world, progress);
    const mining = new MiningSystem(world, progress);
    const dt = 1 / 120;
    const sorties: { signal: string; depthM: number; simSeconds: number; cargoUnits: number; saleCredits: number; returnFuelL: number; returnHull: number; damage: number; serviceCredits: number }[] = [];
    let damage = 0;
    let excursionDamage = 0;
    let tripFrames = 0;
    const impact = (amount: number) => {
      damage += amount;
      excursionDamage += amount;
      progress.hull -= amount;
    };
    const checkSafe = () => assert.equal(pod.overlaps(pod.x, pod.y).length, 0, `seed ${seed}: pod must not clip terrain`);
    const descendTo = (fragmentId: string) => {
      for (let i = 0; i < 120 * 180 && !progress.routeFragments.includes(fragmentId); i++) {
        const braking = pod.vy > DESCENT_WARNING_SPEED;
        const tile = pod.update(dt, { ...idle, down: !braking, up: braking }, impact);
        if (!braking) mining.update(dt, tile, (cut) => { if (cut.fragmentId) progress.collectRouteFragment(cut.fragmentId); }, 'vertical');
        tripFrames++;
        checkSafe();
        assert.ok(progress.fuel > 0, `seed ${seed}: ${fragmentId} should be reachable with fuel from earlier sorties`);
      }
      assert.ok(progress.routeFragments.includes(fragmentId), `seed ${seed}: ${fragmentId} should be mined before fuel runs out`);
    };
    const returnToDock = () => {
      for (let i = 0; i < 30 * 120 && pod.y > WORLD.spawnY - 30; i++) {
        pod.update(dt, { ...idle, up: true }, impact);
        tripFrames++;
        checkSafe();
        assert.ok(progress.fuel > 0, `seed ${seed}: thrust home must remain fueled`);
      }
      for (let i = 0; i < 30 * 120 && !pod.docked; i++) {
        pod.update(dt, idle, impact);
        tripFrames++;
        checkSafe();
        assert.ok(progress.fuel > 0, `seed ${seed}: the surface approach must remain fueled`);
      }
      assert.equal(pod.docked, true, `seed ${seed}: pod should return to Hab 07 (x=${pod.x}, y=${pod.y}, vx=${pod.vx}, vy=${pod.vy}, fuel=${progress.fuel}, head=${world.get(Math.floor(pod.x / WORLD.tile), Math.floor((pod.y - PHYSICS.halfHeight) / WORLD.tile)).type}, destroyed=${world.destroyed.has(`${Math.floor(pod.x / WORLD.tile)},${Math.floor((pod.y - PHYSICS.halfHeight) / WORLD.tile)}`)})`);
      assert.ok(progress.hull > 0, `seed ${seed}: the pod should survive every route return`);
    };
    for (const [index, fragment] of ROUTE_FRAGMENTS.entries()) {
      tripFrames = 0;
      excursionDamage = 0;
      descendTo(fragment.id);
      assert.ok(progress.hull > 0, `seed ${seed}: route ${index + 1} should remain survivable (damage=${damage}, hull=${progress.hull})`);
      const depthM = Math.floor(pod.y / WORLD.tile * 12);
      returnToDock();
      const cargoUnits = progress.count;
      const saleCredits = progress.sell();
      const returnFuelL = Math.round(progress.fuel * 10) / 10;
      const returnHull = Math.round(progress.hull * 10) / 10;
      const serviceCredits = progress.serviceCost('fuel') + progress.serviceCost('hull');
      assert.ok(progress.money >= serviceCredits, `seed ${seed}: recovered credits should cover the return service`);
      assert.equal(progress.serviceAll(), true, `seed ${seed}: service and prepare the next signal run`);
      sorties.push({
        signal: fragment.id,
        depthM,
        simSeconds: Math.round((tripFrames / 120) * 10) / 10,
        cargoUnits: Math.round(cargoUnits * 10) / 10,
        saleCredits,
        returnFuelL,
        returnHull,
        damage: Math.round(excursionDamage * 10) / 10,
        serviceCredits,
      });
    }
    const shipCost = Object.values(SHIP_COMPONENTS).reduce((sum, component) => sum + component.cost, 0);
    assert.ok(progress.money >= shipCost, `seed ${seed}: ore hauls plus route claims should fund ship (money=$${progress.money}, ship=$${shipCost})`);
    for (const key of Object.keys(SHIP_COMPONENTS) as (keyof typeof SHIP_COMPONENTS)[]) assert.equal(progress.buyShipComponent(key), true);
    assert.equal(progress.shipComplete, true, `seed ${seed}: all guaranteed chambers should unlock region travel`);
    console.log('[campaign-balance-sample]', JSON.stringify({ seed, sorties, shipComplete: progress.shipComplete, postShipCredits: progress.money }));
  }
});
test('campaign return safety under delayed warning response', () => {
  const dt = 1 / 120;
  for (const delayMs of [0, 200, 400, 600, 800, 1000, 1500]) {
    const outcomes: { seed: number; hull: number; survives: boolean; fuel: number; allSignals: boolean; shipReady: boolean }[] = [];
    for (const seed of [9090, 1, 2026]) {
      const world = new TileWorld(seed, [], [], 'cryo-shelf');
      const progress = new Progress(), pod = new PlayerPod(world, progress), mining = new MiningSystem(world, progress);
      let framesSinceCue = 0;
      const impact = (amount: number) => { progress.hull -= amount; };
      for (const fragment of ROUTE_FRAGMENTS) {
        framesSinceCue = 0;
        for (let i = 0; i < 120 * 180 && progress.hull > 0 && !progress.routeFragments.includes(fragment.id); i++) {
          const cueActive = pod.vy >= DESCENT_WARNING_SPEED;
          framesSinceCue = cueActive ? framesSinceCue + 1 : 0;
          const braking = cueActive && framesSinceCue > Math.ceil(delayMs / (dt * 1000));
          const tile = pod.update(dt, { ...idle, down: !braking, up: braking }, impact);
          if (!braking) mining.update(dt, tile, (cut) => { if (cut.fragmentId) progress.collectRouteFragment(cut.fragmentId); }, 'vertical');
        }
        if (!progress.routeFragments.includes(fragment.id) || progress.hull <= 0) break;
        for (let i = 0; i < 120 * 180 && progress.hull > 0 && pod.y > WORLD.spawnY - 30; i++) pod.update(dt, { ...idle, up: true }, impact);
        for (let i = 0; i < 120 * 30 && progress.hull > 0 && !pod.docked; i++) pod.update(dt, idle, impact);
        if (!pod.docked || progress.hull <= 0 || progress.fuel <= 0) break;
        progress.sell();
        if (!progress.serviceAll()) break;
      }
      const allSignals = ROUTE_FRAGMENTS.every((entry) => progress.routeFragments.includes(entry.id));
      if (allSignals) {
        for (const key of Object.keys(SHIP_COMPONENTS) as (keyof typeof SHIP_COMPONENTS)[]) progress.buyShipComponent(key);
      }
      outcomes.push({ seed, hull: Math.round(progress.hull * 10) / 10, survives: progress.hull > 0, fuel: Math.round(progress.fuel * 10) / 10, allSignals, shipReady: progress.shipComplete });
    }
    console.log('[campaign-reaction-sweep]', JSON.stringify({ delayMs, outcomes }));
    if (delayMs <= 400) assert.ok(outcomes.every((outcome) => outcome.survives && outcome.allSignals && outcome.shipReady), `all seeds must finish the campaign with ${delayMs} ms warning response delay`);
  }
});
test('the opening signal can be drilled and returned from across varied campaign seeds', () => {
  const seeds = [1, 17, 2026, 78235];
  for (const seed of seeds) {
    const world = new TileWorld(seed, [], [], 'cryo-shelf');
    const progress = new Progress();
    const pod = new PlayerPod(world, progress);
    const mining = new MiningSystem(world, progress);
    const dt = 1 / 120;
    let frames = 0;
    const impact = (amount: number) => { progress.hull -= amount; };
    const checkSafe = () => assert.equal(pod.overlaps(pod.x, pod.y).length, 0, `seed ${seed}: no terrain overlap`);
    while (!progress.routeFragments.includes('fragment-1') && frames < 120 * 45) {
      const tile = pod.update(dt, { ...idle, down: true }, impact);
      mining.update(dt, tile, (cut) => {
        if (cut.fragmentId) progress.collectRouteFragment(cut.fragmentId);
      }, 'vertical');
      frames++;
      checkSafe();
      assert.ok(progress.fuel > 0, `seed ${seed}: opening signal should be reachable`);
    }
    assert.ok(progress.routeFragments.includes('fragment-1'), `seed ${seed}: first signal was mined`);
    const fuelAtSignal = progress.fuel;
    for (let i = 0; i < 30 * 120 && pod.y > WORLD.spawnY - 30; i++) {
      pod.update(dt, { ...idle, up: true }, impact);
      checkSafe();
      assert.ok(progress.fuel > 0, `seed ${seed}: return thrust remains fueled`);
    }
    for (let i = 0; i < 30 * 120 && !pod.docked; i++) {
      pod.update(dt, idle, impact);
      checkSafe();
      assert.ok(progress.fuel > 0, `seed ${seed}: surface approach remains fueled`);
    }
    assert.equal(pod.docked, true, `seed ${seed}: pod returns to Hab 07`);
    assert.ok(progress.hull > 0, `seed ${seed}: pod survives the opening sortie`);
    assert.equal(progress.money, 80 + ROUTE_SURVEY_REWARDS['fragment-1'], `seed ${seed}: signal claim is paid exactly once`);
    assert.ok(progress.fuel < fuelAtSignal, `seed ${seed}: the trip has a measurable return cost`);
  }
});
test('guaranteed route contracts fund every long-range ship component exactly once', () => {
  const p = new Progress();
  const openingBalance = p.money;
  for (const fragment of ROUTE_FRAGMENTS) {
    const before = p.money;
    assert.equal(p.collectRouteFragment(fragment.id), true);
    assert.equal(p.money - before, ROUTE_SURVEY_REWARDS[fragment.id]);
    assert.equal(p.collectRouteFragment(fragment.id), false);
    assert.equal(p.money - before, ROUTE_SURVEY_REWARDS[fragment.id]);
  }
  const shipCost = Object.values(SHIP_COMPONENTS).reduce((sum, component) => sum + component.cost, 0);
  const contractTotal = Object.values(ROUTE_SURVEY_REWARDS).reduce((sum, amount) => sum + amount, 0);
  assert.equal(contractTotal, shipCost);
  assert.equal(p.money - openingBalance, shipCost);
  for (const key of Object.keys(SHIP_COMPONENTS) as (keyof typeof SHIP_COMPONENTS)[]) {
    assert.equal(p.buyShipComponent(key), true);
  }
  assert.equal(p.shipComplete, true);
});
test('all five ores obey depth bands and form adjacent veins', () => {
  const w = new TileWorld(7),
    found = new Set();
  let neighbors = 0;
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < 48; x++) {
      const t = w.get(x, y);
      if (t.ore) {
        found.add(t.ore);
        if (t.ore === 'diamond') assert.ok(y * 12 >= 612);
        if (t.ore === 'gold') assert.ok(y * 12 >= 312);
        if (w.get(x + 1, y).ore === t.ore) neighbors++;
      }
    }
  assert.equal(found.size, 5);
  assert.ok(neighbors > 200);
  assert.ok(w.get(20, 60).hardness > w.get(20, 1).hardness);
});
test('ore yields vary visibly and remain deterministic for the same tile', () => {
  const a = new TileWorld(8128),
    b = new TileWorld(8128),
    yields = new Set<number>();
  for (let y = 0; y < 500; y++)
    for (let x = 0; x < WORLD.width; x++) {
      const tile = a.get(x, y);
      if (!tile.ore) continue;
      yields.add(tile.oreUnits ?? 1);
      assert.equal(tile.oreUnits, b.generate(x, y).oreUnits);
    }
  for (const amount of [0.5, 1, 2, 3]) assert.ok(yields.has(amount), `missing ${amount}-unit ore`);
});
test('each ore maps to a distinct color-independent silhouette', () => {
  const silhouettes = ORE_KEYS.map((ore) => ORE_SILHOUETTES[ore]);
  assert.equal(silhouettes.length, 5);
  assert.equal(new Set(silhouettes).size, silhouettes.length);
  assert.deepEqual(silhouettes, ['chips', 'bars', 'spires', 'nuggets', 'facets']);
});
test('survey map ore symbols have distinct canvas geometry without relying on color', () => {
  const signatures = ORE_KEYS.map((ore) => {
    const operations: unknown[][] = [];
    const ctx = Object.fromEntries(['beginPath', 'fillRect', 'moveTo', 'lineTo', 'closePath', 'fill', 'arc']
      .map((method) => [method, (...args: unknown[]) => operations.push([method, ...args])]));
    drawOreSymbol(ctx as unknown as CanvasRenderingContext2D, ore, 10, 10, 4.2);
    return JSON.stringify(operations);
  });
  assert.equal(new Set(signatures).size, ORE_KEYS.length);
});
test('Prism Fault has deterministic, visible three-unit geode deposits', () => {
  const prism = new TileWorld(319, [], [], 'prism-fault');
  const replay = new TileWorld(319, [], [], 'prism-fault');
  const otherRegion = new TileWorld(319, [], [], 'hull-graveyard');
  let geodes = 0;
  for (let y = 0; y < 500; y++)
    for (let x = 0; x < WORLD.width; x++) {
      const tile = prism.get(x, y);
      if (tile.geode) {
        geodes++;
        assert.ok(tile.ore);
        assert.equal(tile.oreUnits, 3);
        assert.deepEqual(tile, replay.generate(x, y));
        assert.equal(otherRegion.generate(x, y).geode, undefined);
        prism.break(x, y);
        assert.equal(prism.get(x, y).geode, undefined, 'excavated geodes should not persist as live deposits');
      }
    }
  assert.ok(geodes > 0, 'the region should contain rare geodes');
  assert.ok(geodes < 500, 'geodes should remain a special find');
});
test('Mars thermal seams and Hull Graveyard salvage caches are deterministic regional finds', () => {
  for (const mapId of ['mars-frontier', 'hull-graveyard'] as const) {
    const world = new TileWorld(615, [], [], mapId);
    const replay = new TileWorld(615, [], [], mapId);
    const other = new TileWorld(615, [], [], mapId === 'mars-frontier' ? 'hull-graveyard' : 'mars-frontier');
    const expected = REGION_FINDS[mapId];
    let finds = 0;
    for (let y = 0; y < 500; y++)
      for (let x = 0; x < WORLD.width; x++) {
        const tile = world.get(x, y);
        if (!tile.regionFind) continue;
        finds++;
        assert.equal(tile.regionFind, mapId);
        assert.ok(tile.ore);
        assert.ok((tile.oreUnits ?? 0) >= expected.units);
        assert.deepEqual(tile, replay.generate(x, y), 'find should survive chunk eviction/reload unchanged');
        const otherFind = other.generate(x, y).regionFind;
        assert.ok(!otherFind || otherFind !== mapId, 'regional find identity must match its region');
        world.break(x, y);
        assert.equal(world.get(x, y).regionFind, undefined, 'excavated finds must not respawn');
      }
    assert.ok(finds > 0, `${mapId} should include its signature resource`);
    assert.ok(finds < 500, `${mapId} signature resource should stay special`);
  }
});
test('mining charge blast clears a safe diamond of at most thirteen unique tiles', () => {
  const world = new TileWorld(719, [], [], 'mars-frontier');
  const targets = chargeTargets(world, 24, 10, CHARGE.blastRadius);
  const coordinates = new Set(targets.map((tile) => `${tile.x},${tile.y}`));
  assert.ok(targets.length > 0);
  assert.ok(targets.length <= 13);
  assert.equal(coordinates.size, targets.length);
  for (const tile of targets) assert.ok(Math.abs(tile.x - 24) + Math.abs(tile.y - 10) <= CHARGE.blastRadius);
  for (const tile of targets) world.break(tile.x, tile.y);
  assert.ok(targets.every((tile) => world.get(tile.x, tile.y).type === 'empty'));
});
test('fractional ore collection respects capacity and sells the correct value', () => {
  const p = new Progress();
  p.collectUnits('copper', 0.5);
  assert.equal(p.count, 0.5);
  assert.equal(p.cargoValue, 9);
  p.cargo.copper = p.max('cargo') - 0.5;
  assert.equal(p.collectUnits('silver', 2), 0.5);
  assert.equal(p.count, p.max('cargo'));
  assert.equal(p.sell(), (15.5 * 18) + (0.5 * 55));
});
test('ore drops retain any units that do not fit in cargo', () => {
  const p = new Progress();
  p.cargo.copper = p.max('cargo') - 0.5;
  const drop = { ore: 'silver' as const, units: 2.5 };
  assert.equal(collectOreDrop(p, drop), 0.5);
  assert.equal(drop.units, 2);
  assert.equal(collectOreDrop(p, drop), 0);
  assert.equal(drop.units, 2);
});
test('ore pickups use pod body reach so adjacent blasted tiles can be collected', () => {
  assert.equal(podWithinPickupReach(980, 182, 980, 220), true);
  assert.equal(podWithinPickupReach(980, 182, 1020, 180), true);
  assert.equal(podWithinPickupReach(980, 182, 1060, 220), false);
});
test('charge-freed ore falls, bounces off solid ground, and settles without clipping', () => {
  const world = new TileWorld(318);
  const floorY = Array.from({ length: 20 }, (_, i) => i + 2).find((y) => world.get(24, y).type !== 'empty');
  assert.ok(floorY, 'test world should provide solid ground');
  world.break(24, floorY - 1);
  const drop = { x: 980, y: (floorY - 1) * WORLD.tile + WORLD.tile / 2, vx: 38, vy: -35 };
  let sawImpact = false;
  for (let i = 0; i < 60 * 8; i++) {
    const beforeY = drop.y, beforeVy = drop.vy;
    updateOreDropPhysics(world, drop, 1 / 60);
    if (drop.y === beforeY && beforeVy > 0 && drop.vy < 0) sawImpact = true;
    assert.ok(drop.x >= 0 && drop.x <= WORLD.width * WORLD.tile);
    assert.ok(!world.solid(Math.floor(drop.x / WORLD.tile), Math.floor((drop.y + 5) / WORLD.tile)), 'pickup must remain outside solid ground');
  }
  assert.ok(sawImpact, 'pickup should hit and bounce from the floor');
  assert.ok(Math.abs(drop.vy) < 1, `pickup should settle after repeated bounces (vy=${drop.vy})`);
});
test('chunk eviction preserves excavation and exploration', () => {
  const w = new TileWorld(42);
  w.get(24, 0);
  w.break(24, 0);
  w.reveal(980, 0);
  for (let y = 0; y < 1000; y += 16) {
    w.get(24, y);
    w.prune(y * 40);
  }
  assert.ok(w.chunks.size <= 3);
  assert.equal(w.get(24, 0).type, 'empty');
  const reload = new TileWorld(42, [...w.destroyed], [...w.discovered]);
  assert.equal(reload.get(24, 0).type, 'empty');
  assert.ok(reload.discovered.has('24,0'));
});
test('cargo limit, pricing, and sale clear inventory exactly once', () => {
  const p = new Progress();
  for (let i = 0; i < 16; i++) assert.ok(p.collect('copper'));
  assert.equal(p.collect('diamond'), false);
  assert.equal(p.count, 16);
  assert.equal(p.sell(), 288);
  assert.equal(p.money, 368);
  assert.equal(p.count, 0);
  assert.equal(p.sell(), 0);
});
test('every upgrade track continues past level five with finite diminishing returns', () => {
  const p = new Progress();
  p.money = 1_000_000;
  for (const k of UPGRADE_KEYS) {
    for (let level = 1; level < 9; level++) {
      const before = p.max(k),
        money = p.money,
        cost = p.cost(k);
      assert.ok(p.buy(k));
      assert.ok(p.max(k) > before);
      assert.equal(p.money, money - cost);
    }
    assert.equal(p.levels[k], 9);
    assert.ok(Number.isFinite(p.max(k)));
    assert.ok(p.cost(k) > 0);
  }
  assert.equal(p.fuel, p.max('fuel'));
  assert.equal(p.hull, p.max('hull'));
});
test('pilot specializations trade cutting time, survey range, and cargo capacity without overflow', () => {
  const p = new Progress();
  assert.equal(p.specialization, 'balanced');
  assert.equal(p.drillTime(0.6), 0.6, 'Seam Cutter is a hard-rock path, not an early dirt bonus');
  assert.equal(p.drillTime(1.5), 1.5);
  assert.equal(p.selectSpecialization('seamCutter'), true);
  assert.equal(p.drillTime(0.6), 0.6);
  assert.equal(p.drillTime(1.5), 1.25);

  const standardSurvey = new TileWorld(19), extendedSurvey = new TileWorld(19);
  standardSurvey.reveal(980, 400);
  extendedSurvey.reveal(980, 400, 2);
  assert.equal(standardSurvey.discovered.has('29,10'), false);
  assert.equal(extendedSurvey.discovered.has('29,10'), true, 'Surveyor shows two more tiles without changing geology');

  assert.equal(p.selectSpecialization('hauler'), true);
  assert.equal(p.max('cargo'), 20);
  assert.equal(p.collectUnits('copper', 18), 18);
  assert.equal(p.selectSpecialization('balanced'), false, 'cannot switch to a smaller hold and keep over-capacity ore');
  assert.equal(p.max('cargo'), 20);
  p.cargo.copper = 16;
  assert.equal(p.selectSpecialization('balanced'), true);
  assert.equal(p.max('cargo'), 16);
});
test('scanner upgrades expand fog of war until the full map width is surveyed', () => {
  const p = new Progress();
  assert.equal(p.max('scanner'), 4, 'the opening scanner should reveal a much smaller area');
  const nearby = new TileWorld(78), fullWidth = new TileWorld(78);
  nearby.reveal(980, 400, 0, p.max('scanner'));
  assert.equal(nearby.discovered.has('29,10'), false);
  p.money = 100000;
  while (p.levels.scanner < 5) assert.equal(p.buy('scanner'), true);
  fullWidth.reveal(980, 400, 0, p.max('scanner'));
  for (let x = 0; x < WORLD.width; x++) assert.ok(fullWidth.discovered.has(`${x},10`), `max scanner should reveal column ${x} across the current depth band`);
  assert.equal(p.max('scanner'), WORLD.width);
  const fullWidthAndShallower = new TileWorld(78);
  p.money = 100000;
  assert.equal(p.buy('scanner'), true, 'scanner progression continues after full map width');
  assert.ok(p.max('scanner') > WORLD.width, 'extra scanner levels extend vertical survey depth');
  fullWidthAndShallower.reveal(980, 400, 0, p.max('scanner'));
  assert.ok(fullWidthAndShallower.discovered.has('24,55'), 'post-five scanner tier reveals a deeper vertical band');
});
test('rock swimmers arrive below the opening, phase through terrain, and deal one avoidable hull hit', () => {
  const swimmer = new RockSwimmer(991, 'cryo-shelf');
  for (let i = 0; i < 30; i++) assert.equal(swimmer.update(1, 120, 980, 500), false);
  assert.equal(swimmer.active, undefined, 'no swimmer appears in the opening depth band');
  for (let i = 0; i < 11; i++) assert.equal(swimmer.update(1, 260, 980, 500), false);
  assert.ok(swimmer.active, 'a swimmer crosses the scanner view after descending');
  const startX = swimmer.active!.x;
  swimmer.update(1, 260, 980, 500);
  assert.notEqual(swimmer.active!.x, startX, 'the swimmer glides through solid geology without drilling a tunnel');
  swimmer.active!.x = 980;
  swimmer.active!.y = 500;
  assert.equal(swimmer.update(1 / 60, 260, 980, 500), true, 'contact reports one hit so the scene can apply existing hull damage');
  assert.equal(swimmer.active, undefined, 'the creature withdraws after contact');
  for (let i = 0; i < 3; i++) assert.equal(swimmer.update(1, 260, 980, 500), false, 'the warning/cooldown prevents repeated hits');
  swimmer.active = { x: 1100, y: 500, vx: 0, vy: 0, life: 10, phase: 0 };
  const turret: UndergroundStructure = { id: 'turret:1100:500', kind: 'turret', x: 1100, y: 500 };
  let fired = false;
  assert.equal(swimmer.update(1 / 60, 260, 980, 500, [turret], () => { fired = true; }), false);
  assert.equal(fired, true, 'a sentry intercepts a swimmer in range before it hits the pod');
  assert.equal(swimmer.active, undefined);
  assert.ok((turret.reload ?? 0) > 0, 'turret reload prevents continuous firing');
});
test('stasis module cancels gravity in flight at a fuel cost and releases cleanly', () => {
  const world = new TileWorld(65), p = new Progress(), pod = new PlayerPod(world, p);
  for (let row = 0; row < 20; row++) world.break(24, row);
  pod.docked = false;
  pod.y = 300;
  pod.vy = 120;
  p.stasisModule = true;
  p.fuel = 100;
  const y = pod.y, fuel = p.fuel;
  pod.update(0.5, { ...idle, stasis: true }, () => {});
  assert.equal(pod.stasisActive, true);
  assert.equal(pod.y, y, 'active stasis holds altitude');
  assert.equal(pod.vy, 0, 'active stasis cancels existing fall speed');
  assert.equal(p.fuel, fuel - STASIS_MODULE.fuelPerSecond * 0.5);
  pod.update(1 / 60, idle, () => {});
  assert.equal(pod.stasisActive, false);
  assert.ok(pod.vy > 0, 'gravity resumes when the key is released');
  const locked = new Progress(), lockedPod = new PlayerPod(new TileWorld(65), locked);
  lockedPod.docked = false;
  lockedPod.y = 300;
  lockedPod.update(1 / 60, { ...idle, stasis: true }, () => {});
  assert.equal(lockedPod.stasisActive, false, 'stasis input has no effect before the add-on is installed');
  assert.ok(lockedPod.vy > 0);
});
test('one-use escape suit is purchasable and gives fuel-independent flight without drilling', () => {
  const progress = new Progress();
  progress.money = ESCAPE_SUIT.cost - 1;
  assert.equal(progress.buyEscapeSuit(), false, 'the suit cannot be bought below its listed cost');
  progress.money++;
  assert.equal(progress.buyEscapeSuit(), true);
  assert.equal(progress.money, 0);
  assert.equal(progress.buyEscapeSuit(), false, 'a carried suit cannot be duplicated');
  const world = new TileWorld(811), pod = new PlayerPod(world, progress);
  for (let x = 22; x <= 26; x++) for (let y = 0; y <= 20; y++) world.break(x, y);
  pod.docked = false;
  pod.y = 500;
  progress.fuel = 0;
  const cut = pod.update(0.1, { ...idle, up: true, escapePack: true }, () => {});
  assert.equal(progress.fuel, 0, 'escape pack uses its own propellant');
  assert.ok(pod.vy < 0, 'pack thrusts against gravity');
  assert.equal(cut, undefined, 'escape flight never returns a drill target');
});
test('surface winch boosts an open-shaft return, costs more fuel, and catches the pod at the dock', () => {
  const purchase = new Progress();
  purchase.money = RETURN_WINCH.cost - 1;
  assert.equal(purchase.buyReturnWinch(), false);
  assert.equal(purchase.money, RETURN_WINCH.cost - 1);
  purchase.money++;
  assert.equal(purchase.buyReturnWinch(), true);
  assert.equal(purchase.buyReturnWinch(), false, 'the one-time module cannot be bought twice');
  assert.equal(purchase.money, 0);
  const clearShaft = (world: TileWorld) => { for (let y = 0; y < 22; y++) world.break(24, y); };
  const normalWorld = new TileWorld(907), winchWorld = new TileWorld(907);
  clearShaft(normalWorld);
  clearShaft(winchWorld);
  const normalProgress = new Progress(), winchProgress = new Progress();
  normalProgress.fuel = winchProgress.fuel = 100;
  winchProgress.returnWinch = true;
  const normal = new PlayerPod(normalWorld, normalProgress), winch = new PlayerPod(winchWorld, winchProgress);
  normal.x = winch.x = WORLD.spawnX;
  normal.y = winch.y = 600;
  normal.docked = winch.docked = false;
  for (let i = 0; i < 120; i++) {
    normal.update(1 / 120, { ...idle, up: true }, () => {});
    winch.update(1 / 120, { ...idle, reel: true }, () => {});
  }
  assert.equal(winch.reeling, true);
  assert.ok(winch.y < normal.y - 80, 'reel pulls upward faster than ordinary thrust');
  assert.ok(winchProgress.fuel < normalProgress.fuel, 'the faster pull burns more fuel per second');
  for (let i = 0; i < 600 && !winch.docked; i++) winch.update(1 / 120, { ...idle, reel: true }, () => {});
  assert.equal(winch.docked, true, 'winching back through an open shaft returns the pod to Hab 07');
  assert.equal(winch.y, WORLD.spawnY);

  const locked = new PlayerPod(new TileWorld(908), new Progress());
  locked.y = 500;
  locked.docked = false;
  locked.update(1 / 60, { ...idle, reel: true }, () => {});
  assert.equal(locked.reeling, false, 'R has no effect before buying the module');
});
test('ship components are credit-funded, persistent, and cannot be bought twice', () => {
  const p = new Progress();
  p.money = 10000;
  for (const [key, component] of Object.entries(SHIP_COMPONENTS)) {
    const before = p.money;
    assert.equal(p.buyShipComponent(key as keyof typeof SHIP_COMPONENTS), true);
    assert.equal(p.money, before - component.cost);
    assert.equal(p.buyShipComponent(key as keyof typeof SHIP_COMPONENTS), false);
  }
  assert.equal(p.shipComplete, true);
});
test('charge packs spend credits once and provide three usable charges', () => {
  const p = new Progress();
  p.money = CHARGE.packCost - 1;
  assert.equal(p.buyCharges(), false);
  assert.equal(p.charges, 0);
  p.money++;
  assert.equal(p.buyCharges(), true);
  assert.equal(p.charges, CHARGE.packSize);
  assert.equal(p.money, 0);
  assert.equal(p.useCharge(), true);
  assert.equal(p.charges, CHARGE.packSize - 1);
  assert.equal(p.useCharge(), true);
  assert.equal(p.useCharge(), true);
  assert.equal(p.useCharge(), false);
});
test('salvage magnet is a one-time optional purchase', () => {
  const p = new Progress();
  p.money = SALVAGE_MAGNET.cost - 1;
  assert.equal(p.buySalvageMagnet(), false);
  assert.equal(p.salvageMagnet, false);
  p.money++;
  assert.equal(p.buySalvageMagnet(), true);
  assert.equal(p.money, 0);
  assert.equal(p.salvageMagnet, true);
  assert.equal(p.buySalvageMagnet(), false);
  assert.equal(p.money, 0);
});
test('pilot suit colors are optional visual-only unlocks', () => {
  const p = new Progress();
  p.money = PILOT_SUITS.polar.cost - 1;
  assert.equal(p.buySuit('polar'), false);
  assert.equal(p.selectedSuit, 'hab');
  p.money++;
  const levels = { ...p.levels }, fuel = p.fuel, cargo = { ...p.cargo };
  assert.equal(p.buySuit('polar'), true);
  assert.equal(p.money, 0);
  assert.equal(p.selectedSuit, 'polar');
  assert.equal(p.buySuit('polar'), false);
  assert.deepEqual(p.levels, levels);
  assert.equal(p.fuel, fuel);
  assert.deepEqual(p.cargo, cargo);
  assert.equal(p.selectSuit('hab'), true);
  assert.equal(p.selectSuit('prism'), false);
});
test('pod decals are optional visual-only unlocks and equip only owned marks', () => {
  const p = new Progress();
  p.money = POD_DECALS.arrow.cost - 1;
  assert.equal(p.buyDecal('arrow'), false);
  p.money++;
  const levels = { ...p.levels }, fuel = p.fuel, hull = p.hull;
  assert.equal(p.buyDecal('arrow'), true);
  assert.equal(p.money, 0);
  assert.equal(p.selectedDecal, 'arrow');
  assert.equal(p.buyDecal('arrow'), false);
  assert.equal(p.selectDecal('standard'), true);
  assert.equal(p.selectDecal('prism'), false);
  assert.deepEqual(p.levels, levels);
  assert.equal(p.fuel, fuel);
  assert.equal(p.hull, hull);
});
test('pod silhouette profiles change cosmetics without changing handling stats', () => {
  const p = new Progress();
  p.money = POD_PROFILES.antenna.cost;
  const levels = { ...p.levels }, fuel = p.fuel, hull = p.hull, cargo = { ...p.cargo };
  assert.equal(p.buyProfile('antenna'), true);
  assert.equal(p.money, 0);
  assert.equal(p.selectedProfile, 'antenna');
  assert.equal(p.buyProfile('antenna'), false);
  assert.equal(p.selectProfile('standard'), true);
  assert.equal(p.selectProfile('armor'), false);
  assert.deepEqual(p.levels, levels);
  assert.equal(p.fuel, fuel);
  assert.equal(p.hull, hull);
  assert.deepEqual(p.cargo, cargo);
});
test('magnet reels loose ore through open tunnels, respects range and stops at solid walls', () => {
  const world = new TileWorld(99);
  for (let x = 2; x <= 5; x++) world.break(x, 2);
  const drop = { x: 200, y: 100, vx: 0, vy: 0 };
  assert.ok(hasClearMagnetPath(world, 200, 100, 100, 100));
  assert.equal(applySalvageMagnet(world, drop, 100, 100, 0.1), true);
  assert.ok(drop.vx < 0);
  assert.ok(Math.abs(drop.vy) < 0.001);
  const fastDrop = { x: 200, y: 100, vx: 1000, vy: 0 };
  assert.equal(applySalvageMagnet(world, fastDrop, 100, 100, 0.2), true);
  assert.ok(Math.hypot(fastDrop.vx, fastDrop.vy) <= SALVAGE_MAGNET.maxSpeed);
  const outOfRange = { x: 400, y: 100, vx: 0, vy: 0 };
  assert.equal(applySalvageMagnet(world, outOfRange, 100, 100, 0.1), false);
  assert.deepEqual(outOfRange, { x: 400, y: 100, vx: 0, vy: 0 });
  const blockedWorld = new TileWorld(99);
  blockedWorld.break(2, 2);
  blockedWorld.break(4, 2);
  blockedWorld.break(5, 2);
  const blocked = { x: 200, y: 100, vx: 0, vy: 0 };
  assert.equal(hasClearMagnetPath(blockedWorld, 200, 100, 100, 100), false);
  assert.equal(applySalvageMagnet(blockedWorld, blocked, 100, 100, 0.1), false);
  assert.deepEqual(blocked, { x: 200, y: 100, vx: 0, vy: 0 });
});
test('return fuel estimate is conservative, increases with depth, and improves with engine', () => {
  const near = estimateVerticalReturnFuel(500, 1),
    deep = estimateVerticalReturnFuel(2500, 1),
    upgraded = estimateVerticalReturnFuel(2500, 1.95);
  assert.equal(estimateVerticalReturnFuel(WORLD.spawnY, 1), 0);
  assert.ok(deep > near);
  assert.ok(upgraded < deep);
});
test('unaffordable upgrades and service do not mutate state', () => {
  const p = new Progress();
  p.money = 0;
  p.fuel = 1;
  p.hull = 1;
  assert.equal(p.buy('drill'), false);
  assert.equal(p.service('fuel'), false);
  assert.equal(p.service('hull'), false);
  assert.equal(p.fuel, 1);
  assert.equal(p.levels.drill, 1);
});
test('fuel and hull services use separate costs', () => {
  const p = new Progress();
  p.money = 200;
  p.fuel = 40;
  p.hull = 50;
  assert.equal(p.serviceCost('fuel'), 30);
  assert.equal(p.serviceCost('hull'), 23);
  p.service('fuel');
  p.service('hull');
  assert.equal(p.money, 147);
  assert.equal(p.fuel, 140);
  assert.equal(p.hull, 100);
});
test('recovery loses cargo but keeps credits and upgrades', () => {
  const p = new Progress();
  p.money = 1000;
  p.buy('engine');
  const credits = p.money;
  p.collect('gold');
  p.fuel = 0;
  p.hull = 0;
  p.rescue();
  assert.equal(p.count, 0);
  assert.equal(p.money, credits);
  assert.equal(p.levels.engine, 2);
  assert.equal(p.fuel, 140);
  assert.equal(p.hull, 100);
});
test('down drilling breaks tiles, collects ore, spends fuel, and allows a return', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  sim(pod, 4, { ...idle, down: true }, m);
  assert.ok(w.destroyed.size >= 3);
  assert.ok(p.count >= 3);
  assert.ok(p.fuel < 140);
  assert.ok(pod.y > 0);
  sim(pod, 6, { ...idle, up: true });
  assert.ok(pod.y < 0);
  assert.equal(p.hull, 100);
});
test('sideways drilling and reverse travel cannot wedge the pod', () => {
  const w = new TileWorld(21),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  sim(pod, 2, { ...idle, down: true }, m);
  const start = pod.x;
  sim(pod, 5, { ...idle, right: true }, m);
  assert.ok(pod.x > start + 80);
  sim(pod, 6, { ...idle, left: true }, m);
  assert.ok(pod.x < start);
});
test('upward thrust never drills a ceiling', () => {
  const w = new TileWorld(12),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  w.break(24, 5);
  pod.x = 980;
  pod.y = 220;
  sim(pod, 2, { ...idle, up: true });
  assert.equal(w.destroyed.size, 1);
  assert.ok(pod.y >= 216);
});
test('hard falls damage hull, short falls are safe', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  for (let y = 0; y < 15; y++) w.break(24, y);
  pod.docked = false;
  pod.y = 24;
  assert.ok(sim(pod, 3, idle) > 0);
  assert.ok(p.hull < 100);
  const q = new PlayerPod(new TileWorld(2), new Progress());
  assert.equal(sim(q, 1, idle), 0);
});
test('fast-descent warning gives the player a braking window before damaging speed', () => {
  assert.ok(DESCENT_WARNING_SPEED < PHYSICS.safeImpact);
  assert.ok(DESCENT_WARNING_SPEED < PHYSICS.safeImpact - 80, 'cue should appear with room to brake');
  assert.ok(DESCENT_WARNING_SPEED > 0);
  const state = { surface: false, fuelRatio: 1, hullRatio: 1, cargoFull: false };
  assert.equal(flightWarning({ ...state, descentSpeed: DESCENT_WARNING_SPEED - 1 }), '');
  assert.equal(flightWarning({ ...state, descentSpeed: DESCENT_WARNING_SPEED }), 'FAST DESCENT — HOLD W TO BRAKE BEFORE IMPACT');
  assert.equal(flightWarning({ ...state, descentSpeed: 0 }), '');
  assert.equal(flightWarning({ ...state, descentSpeed: 400, fuelRatio: 0.2 }), 'LOW FUEL — RETURN TO SURFACE');
  assert.equal(flightWarning({ ...state, descentSpeed: 400, hullRatio: 0.2 }), 'LOW HULL — THRUST TO BRAKE. RETURN FOR REPAIRS');
  assert.equal(flightWarning({ ...state, surface: true, descentSpeed: 400 }), '');
});
test('fast-descent cue tolerates a short reaction delay in the guaranteed starter shaft', () => {
  const delaysMs = [0, 200, 400];
  for (const delayMs of delaysMs) {
    const w = new TileWorld(42, [], [], 'cryo-shelf');
    for (let x = 23; x <= 25; x++) w.break(x, 0);
    const p = new Progress(), pod = new PlayerPod(w, p);
    const dt = 1 / 120;
    let cueFrames = 0, damage = 0;
    for (let frame = 0; frame < 120 * 8 && !pod.docked; frame++) {
      const cueActive = pod.vy >= DESCENT_WARNING_SPEED;
      if (cueActive) cueFrames++;
      const braking = cueActive && cueFrames > Math.ceil(delayMs / (dt * 1000));
      pod.update(dt, { ...idle, down: !braking, up: braking }, (amount) => {
        damage += amount;
        p.hull -= amount;
      });
      assert.equal(pod.overlaps(pod.x, pod.y).length, 0, `reaction delay ${delayMs}ms: pod must not clip terrain`);
    }
    assert.equal(pod.docked, true, `reaction delay ${delayMs}ms: starter return should dock`);
    assert.equal(damage, 0, `reaction delay ${delayMs}ms: braking should avoid hull damage`);
  }
});
test('collision remains solid at maximum engine speed and 50 ms frames', () => {
  const w = new TileWorld(13),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  p.levels.engine = 5;
  for (let i = 0; i < 1000; i++) {
    pod.update(
      0.05,
      { ...idle, right: i % 200 < 100, left: i % 200 >= 100, up: i % 60 < 30 },
      () => {},
    );
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0);
  }
  assert.ok(pod.x >= 13 && pod.x <= WORLD.width * 40 - 13);
});
test('drill upgrade measurably shortens rock break time', () => {
  function duration(level: number) {
    const w = new TileWorld(7),
      p = new Progress(),
      m = new MiningSystem(w, p);
    p.levels.drill = level;
    let row = 40;
    while (w.get(24, row).type === 'empty') row++;
    const tile = w.get(24, row);
    let seconds = 0;
    while (w.get(24, row).type !== 'empty') {
      m.update(0.01, tile, () => {});
      seconds += 0.01;
    }
    return seconds;
  }
  assert.ok(duration(2) < duration(1) * 0.72);
});
test('higher drill tiers cut wider while honoring cargo capacity', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(drillWidth), [1, 1, 2, 3, 4]);
  assert.ok(drillWidth(6) > drillWidth(5) && drillWidth(100) < WORLD.width, 'post-five drill tiers keep widening at a controlled rate');
  for (const level of [3, 4, 5]) {
    const w = new TileWorld(91), p = new Progress(), m = new MiningSystem(w, p);
    p.levels.drill = level;
    const center = w.get(24, 0);
    for (let i = 0; i < 200; i++) m.update(0.01, center, () => {});
    const expected = drillWidth(level);
    assert.equal(m.affected.length, 0);
    assert.equal(w.destroyed.size, expected);
    assert.ok(p.count <= p.max('cargo'));
  }
});
test('drill and cargo upgrades grow pod artwork without enlarging tunnel collision', () => {
  const sizes = [1, 2, 3, 4, 5].map((level) => podVisualScale(level, level));
  assert.equal(sizes[0], 1);
  assert.ok(sizes.every((size, i) => i === 0 || size > sizes[i - 1]));
  assert.equal(sizes.at(-1), POD_SIZE.maxScale);
  assert.equal(PHYSICS.halfWidth, 13);
  assert.equal(PHYSICS.halfHeight, 16);
  assert.ok(PHYSICS.halfWidth * 2 * POD_SIZE.maxScale < WORLD.tile);
});
test('cosmetic progression stays visual-only and persists in versioned saves', () => {
  const p = new Progress();
  p.money = 400;
  assert.equal(p.buyPaint('polar'), true);
  assert.equal(p.money, 220);
  assert.equal(p.selectedPaint, 'polar');
  assert.equal(p.buyPaint('polar'), false);
  assert.equal(p.selectPaint('hab'), true);
  assert.equal(p.selectPaint('prism'), false);
  const save = {
    version: 17 as const, campaignSeed: 1, activeMap: 'cryo-shelf' as const,
    maps: { 'cryo-shelf': { seed: 1, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [] } },
    money: p.money, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull, cargo: { ...p.cargo }, maxDepth: 0,
    artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint, salvageMagnet: false, ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit,
    ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal, ownedProfiles: [...p.ownedProfiles], selectedProfile: p.selectedProfile, specialization: p.specialization, stasisModule: p.stasisModule, returnWinch: p.returnWinch, escapeSuit: p.escapeSuit, pilotEscaping: p.pilotEscaping,
  } satisfies SaveData;
  assert.ok(validateSave(save));
  assert.equal(validateSave({ ...save, selectedPaint: 'prism' }), false);
  assert.equal(validateSave({ ...save, ownedPaints: ['hab', 'polar', 'polar'] }), false);
  assert.equal(validateSave({ ...save, ownedProfiles: ['standard', 'antenna', 'antenna'] }), false);
  const restored = new Progress();
  new SaveManager().restore(restored, save);
  assert.deepEqual(restored.ownedPaints, ['hab', 'polar']);
  assert.equal(restored.selectedPaint, 'hab');
});

test('large excavation and physical drops survive serialized save import', () => {
  const p = new Progress();
  const destroyed = Array.from({ length: 10000 }, (_, i) => `${i % WORLD.width},${i}`);
  const drops = Array.from({ length: 1000 }, (_, i) => ({
    id: `123:${i % WORLD.width},${i}`,
    ore: 'gold' as const,
    units: 1.5,
    x: 920 + (i % WORLD.width),
    y: i * WORLD.tile,
    vx: 0,
    vy: 0,
  }));
  const data: SaveData = {
    version: 17, campaignSeed: 123, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': {
      seed: 123, x: WORLD.spawnX, y: WORLD.spawnY, maxDepth: 120000,
      destroyed, discovered: [...destroyed], drops, activeCharge: null, structures: [{ id: 'service:980:12000', kind: 'service', x: 980, y: 12000 }],
    } },
    money: 80, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull,
    cargo: { ...p.cargo }, maxDepth: 120000, artifact: false, milestones: [],
    shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint, salvageMagnet: false,
    ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit,
    ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal,
    ownedProfiles: [...p.ownedProfiles], selectedProfile: p.selectedProfile, specialization: p.specialization, stasisModule: p.stasisModule, returnWinch: p.returnWinch, escapeSuit: p.escapeSuit, pilotEscaping: p.pilotEscaping,
  };
  assert.ok(validateSave(data));
  const serialized = JSON.stringify(data);
  const imported = parseSaveFile(serialized);
  assert.ok(imported);
  assert.equal(imported.maps['cryo-shelf']?.destroyed.length, 10000);
  assert.equal(imported.maps['cryo-shelf']?.discovered.length, 10000);
  assert.equal(imported.maps['cryo-shelf']?.drops.length, 1000);
  assert.deepEqual(imported.maps['cryo-shelf']?.structures, [{ id: 'service:980:12000', kind: 'service', x: 980, y: 12000 }]);
  const restored = new Progress();
  new SaveManager().restore(restored, imported);
  assert.equal(restored.money, data.money);
  assert.deepEqual(restored.selectedProfile, data.selectedProfile);
  assert.equal(restored.specialization, 'balanced');
});

test('versioned save validation and reconstruction', () => {
  const p = new Progress(),
    w = new TileWorld(2);
  w.break(24, 0);
  w.reveal(980, 0);
  const d: SaveData = {
    version: 17,
    campaignSeed: 2,
    activeMap: 'mars-frontier',
    maps: { 'mars-frontier': {
      seed: 2, x: 980, y: 24, maxDepth: 120,
      destroyed: [...w.destroyed], discovered: [...w.discovered], drops: [], activeCharge: null, structures: [],
    } },
    money: 500,
    levels: { ...p.levels },
    fuel: 110,
    hull: 80,
    cargo: { ...p.cargo },
    maxDepth: 120,
    artifact: false,
    milestones: [],
    shipComponents: [],
    routeFragments: ['fragment-1'],
    charges: 2,
    ownedPaints: ['hab', 'polar'],
    selectedPaint: 'polar',
    salvageMagnet: true,
    ownedSuits: ['hab', 'polar'],
    selectedSuit: 'polar',
    ownedDecals: ['standard', 'arrow'],
    selectedDecal: 'arrow',
    ownedProfiles: ['standard', 'antenna'],
    selectedProfile: 'antenna',
    specialization: 'hauler',
    stasisModule: true, returnWinch: false, escapeSuit: false, pilotEscaping: true,
  };
  d.cargo.copper = 0.5;
  assert.ok(validateSave(d));
  const migratedV12 = migrateSave({ ...d, version: 12, returnWinch: undefined });
  assert.ok(migratedV12);
  assert.equal(migratedV12.version, 17);
  assert.equal(migratedV12.returnWinch, false, 'older campaigns receive the new optional module as unowned');
  const oldChargeSave = { ...d, maps: { ...d.maps, 'mars-frontier': { ...d.maps['mars-frontier']!, activeCharge: { x: 980, y: 280, fuse: 0.7 } } } };
  assert.ok(validateSave(oldChargeSave), 'existing active charges remain valid without a velocity field');
  assert.ok(validateSave({ ...oldChargeSave, maps: { ...oldChargeSave.maps, 'mars-frontier': { ...oldChargeSave.maps['mars-frontier']!, activeCharge: { ...oldChargeSave.maps['mars-frontier']!.activeCharge!, vy: 120 } } } }));
  assert.equal(validateSave({ ...oldChargeSave, maps: { ...oldChargeSave.maps, 'mars-frontier': { ...oldChargeSave.maps['mars-frontier']!, activeCharge: { ...oldChargeSave.maps['mars-frontier']!.activeCharge!, vy: CHARGE.maxFallSpeed + 1 } } } }), false);
  assert.equal(validateSave({ ...d, version: 3 }), false);
  const migratedV3 = migrateSave({ ...d, version: 3, routeFragments: undefined } as unknown as SaveData);
  assert.ok(migratedV3);
  assert.equal(migratedV3.version, 17);
  assert.deepEqual(migratedV3.routeFragments, []);
  assert.deepEqual(migratedV3.maps['mars-frontier']?.drops, []);
  assert.equal(migratedV3.charges, 0);
  assert.deepEqual(parseSaveFile(JSON.stringify({ ...d, version: 3, routeFragments: undefined }))?.routeFragments, []);
  const legacyV4 = { ...d, version: 4, charges: undefined, maps: { 'mars-frontier': { ...d.maps['mars-frontier']!, drops: undefined, activeCharge: undefined } } };
  const migratedV4 = migrateSave(legacyV4);
  assert.ok(migratedV4);
  assert.equal(migratedV4.version, 17);
  assert.deepEqual(migratedV4.maps['mars-frontier']?.drops, []);
  const legacyV7 = { ...d, version: 7, ownedSuits: undefined, selectedSuit: undefined };
  const migratedV7 = migrateSave(legacyV7);
  assert.ok(migratedV7);
  assert.equal(migratedV7.version, 17);
  assert.equal(migratedV7.selectedSuit, 'hab');
  assert.deepEqual(migratedV7.ownedSuits, ['hab']);
  const legacyV6 = { ...d, version: 6, salvageMagnet: undefined, ownedSuits: undefined, selectedSuit: undefined };
  const migratedV6 = migrateSave(legacyV6);
  assert.ok(migratedV6);
  assert.equal(migratedV6.version, 17);
  assert.equal(migratedV6.salvageMagnet, false);
  assert.equal(migratedV6.selectedSuit, 'hab');
  assert.deepEqual(migratedV6.ownedPaints, ['hab', 'polar']);
  const legacyV5 = { ...d, version: 5, ownedPaints: undefined, selectedPaint: undefined, salvageMagnet: undefined };
  const migratedV5 = migrateSave(legacyV5);
  assert.ok(migratedV5);
  assert.equal(migratedV5.version, 17);
  assert.equal(migratedV5.salvageMagnet, false);
  assert.deepEqual(migratedV5.ownedPaints, ['hab']);
  const withDrop = { ...d, maps: { 'mars-frontier': { ...d.maps['mars-frontier']!, destroyed: [...d.maps['mars-frontier']!.destroyed, '24,3'], drops: [{ id: '2:24,3', ore: 'gold', units: 1.5, x: 980, y: 130, vx: 24, vy: -40 }] } } };
  assert.ok(validateSave(withDrop));
  assert.equal(validateSave({ ...withDrop, maps: { 'mars-frontier': { ...withDrop.maps['mars-frontier']!, drops: [{ ...withDrop.maps['mars-frontier']!.drops[0], id: '3:24,3' }] } } }), false);
  assert.equal(validateSave({ ...withDrop, maps: { 'mars-frontier': { ...withDrop.maps['mars-frontier']!, drops: [{ ...withDrop.maps['mars-frontier']!.drops[0], units: -1 }] } } }), false);
  assert.equal(validateSave({ ...withDrop, maps: { 'mars-frontier': { ...withDrop.maps['mars-frontier']!, drops: [withDrop.maps['mars-frontier']!.drops[0], withDrop.maps['mars-frontier']!.drops[0]] } } }), false);
  assert.equal(parseSaveFile('{ broken json'), null);
  assert.equal(parseSaveFile(JSON.stringify({ ...d, fuel: -1 })), null);
  const legacy = {
    version: 1, seed: 2, money: 500, levels: d.levels, fuel: 110, hull: 80,
    cargo: d.cargo, maxDepth: 120, artifact: false, x: 980, y: 24,
    destroyed: [...w.destroyed], discovered: [...w.discovered],
  };
  const migrated = migrateSave(legacy);
  assert.ok(migrated);
  assert.equal(migrated.version, 17);
  assert.equal(migrated.activeMap, 'mars-frontier');
  assert.equal(migrated.maps['mars-frontier']?.x, 980);
  assert.deepEqual(migrated.shipComponents, []);
  assert.equal(validateSave({ ...d, fuel: NaN }), false);
  assert.equal(validateSave({ ...d, levels: { ...d.levels, drill: 7 } }), true, 'post-five upgrade levels remain save-compatible');
  assert.equal(validateSave({ ...d, levels: { ...d.levels, drill: Number.MAX_SAFE_INTEGER + 1 } }), false, 'unsafe integer levels are rejected');
  assert.equal(validateSave({ ...d, maps: { 'mars-frontier': { ...d.maps['mars-frontier']!, destroyed: ['oops'] } } }), false);
  new SaveManager().restore(p, d);
  assert.equal(p.money, 500);
  assert.equal(p.fuel, 110);
  assert.equal(p.count, 0.5);
  assert.deepEqual(p.routeFragments, ['fragment-1']);
  assert.equal(p.charges, 2);
  assert.deepEqual(p.ownedPaints, ['hab', 'polar']);
  assert.equal(p.selectedPaint, 'polar');
  assert.equal(p.collectRouteFragment('fragment-1'), false);
  assert.equal(p.money, 500);
  assert.equal(p.salvageMagnet, true);
  assert.deepEqual(p.ownedSuits, ['hab', 'polar']);
  assert.equal(p.selectedSuit, 'polar');
  assert.deepEqual(p.ownedDecals, ['standard', 'arrow']);
  assert.equal(p.selectedDecal, 'arrow');
  assert.deepEqual(p.ownedProfiles, ['standard', 'antenna']);
  assert.equal(p.selectedProfile, 'antenna');
  assert.equal(p.specialization, 'hauler');
  assert.equal(p.stasisModule, true);
  assert.equal(p.returnWinch, false);
  assert.equal(p.max('cargo'), 20);
  const legacyV8 = { ...d, version: 8, ownedDecals: undefined, selectedDecal: undefined };
  const migratedV8 = migrateSave(legacyV8);
  assert.ok(migratedV8);
  assert.equal(migratedV8.version, 17);
  assert.deepEqual(migratedV8.ownedDecals, ['standard']);
  assert.equal(migratedV8.selectedDecal, 'standard');
  assert.deepEqual(migratedV8.ownedProfiles, ['standard']);
  assert.equal(migratedV8.selectedProfile, 'standard');
  const legacyV9 = { ...d, version: 9, ownedProfiles: undefined, selectedProfile: undefined };
  const migratedV9 = migrateSave(legacyV9);
  assert.ok(migratedV9);
  assert.equal(migratedV9.version, 17);
  assert.deepEqual(migratedV9.ownedProfiles, ['standard']);
  assert.equal(migratedV9.specialization, 'balanced');
  const migratedV10 = migrateSave({ ...d, version: 10, specialization: undefined });
  assert.ok(migratedV10);
  assert.equal(migratedV10.version, 17);
  assert.equal(migratedV10.specialization, 'balanced');
  assert.deepEqual(migratedV10.maps, d.maps, 'v10 migration preserves every region record');
  assert.equal(validateSave({ ...d, specialization: 'unknown' }), false);
});

test('off-center downward drilling aligns into one clean shaft', () => {
  const w = new TileWorld(42),
    p = new Progress(),
    pod = new PlayerPod(w, p),
    m = new MiningSystem(w, p);
  pod.x = 916;
  sim(pod, 3, { ...idle, down: true }, m);
  assert.ok(Math.abs(pod.x - 900) < 0.01);
  assert.ok([...w.destroyed].every((k) => k.startsWith('22,')));
});

test('storage failures are reported without crashing the game', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw Error('denied');
        },
        setItem: () => {
          throw Error('quota');
        },
      },
    });
    const m = new SaveManager();
    assert.equal(m.load(), null);
    assert.match(m.warning, /unavailable/);
    assert.equal(m.write({} as SaveData), false);
    assert.match(m.warning, /Save failed/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as any).localStorage;
  }
});

test('recovered pod stays docked above a fully excavated outpost', () => {
  const w = new TileWorld(3),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) w.break(x, y);
  pod.reset();
  const count = w.destroyed.size;
  sim(pod, 10, idle);
  assert.equal(pod.y, WORLD.spawnY);
  assert.equal(p.hull, 100);
  assert.equal(p.fuel, 140);
  assert.equal(w.destroyed.size, count);
  sim(pod, 1, { ...idle, down: true });
  assert.ok(pod.y > 0);
  assert.equal(pod.docked, false);
});
test('surface dock catches a returning pod without refilling terrain', () => {
  const w = new TileWorld(3),
    p = new Progress(),
    pod = new PlayerPod(w, p);
  w.break(24, 0);
  pod.docked = false;
  pod.y = -140;
  sim(pod, 3, idle);
  assert.equal(pod.docked, true);
  assert.equal(pod.y, WORLD.spawnY);
  assert.equal(p.hull, 100);
  assert.equal(w.get(24, 0).type, 'empty');
  const oldX = pod.x;
  sim(pod, 0.3, { ...idle, right: true });
  assert.ok(pod.x > oldX + 10);
});
test('combined service is atomic and uses the same itemized prices', () => {
  const p = new Progress();
  p.fuel = 40;
  p.hull = 50;
  p.money = 52;
  assert.equal(p.serviceAll(), false);
  assert.equal(p.fuel, 40);
  assert.equal(p.hull, 50);
  assert.equal(p.money, 52);
  p.money = 53;
  assert.equal(p.serviceAll(), true);
  assert.equal(p.money, 0);
  assert.equal(p.fuel, 140);
  assert.equal(p.hull, 100);
});
test('full cargo keeps drilling and reports recoverable ore spill for a return trip', () => {
  const w = new TileWorld(3),
    p = new Progress(),
    m = new MiningSystem(w, p);
  for (let i = 0; i < 16; i++) p.collect('copper');
  const tile = w.get(24, 0);
  let collected = 0, dropped = 0, breaks = 0;
  const onBreak = (_tile: Tile, pickedUp: number, spilled: number) => {
    breaks++;
    collected += pickedUp;
    dropped += spilled;
  };
  m.update(0.1, tile, onBreak);
  assert.equal(m.cargoOverflow, true);
  assert.equal(m.warningUnits, 1);
  assert.equal(m.warningSpace, 0);
  assert.equal(w.get(24, 0).type, 'dirt');
  assert.equal(m.warningRemaining, 0, 'a full hold never stalls drilling behind a warning timer');
  for (let i = 0; i < 30 && breaks === 0; i++) m.update(0.01, tile, onBreak);
  assert.equal(w.get(24, 0).type, 'empty');
  assert.equal(p.count, 16);
  assert.equal(collected, 0);
  assert.equal(dropped, 1, 'the uncollected unit is surfaced as a recoverable physical drop');
  assert.equal(breaks, 1);
  p.sell();
  const returnedSpill = { ore: 'copper' as const, units: dropped };
  assert.equal(collectOreDrop(p, returnedSpill), 1, 'after selling at the surface, the player can collect the saved spill');
  assert.equal(returnedSpill.units, 0);
  assert.equal(p.count, 1);
});
test('cargo overflow accounts for partial space and every tile in a multi-cut swath', () => {
  const partial = new Progress(), partialWorld = new TileWorld(4, [], [], 'cryo-shelf');
  partial.collectUnits('copper', 15.5);
  const partialMining = new MiningSystem(partialWorld, partial);
  let partialCollected = 0, partialDropped = 0;
  partialMining.update(0.01, partialWorld.get(24, 0), () => {}, 'vertical');
  assert.equal(partialMining.cargoOverflow, true);
  assert.equal(partialMining.warningUnits, 1);
  assert.equal(partialMining.warningSpace, 0.5);
  for (let i = 0; i < 40 && partialDropped === 0; i++) partialMining.update(0.01, partialWorld.get(24, 0), (_tile, collected, dropped) => {
    partialCollected += collected;
    partialDropped += dropped;
  }, 'vertical');
  assert.equal(partialCollected, 0.5, 'remaining cargo space is filled first');
  assert.equal(partialDropped, 0.5, 'the rest is left as a loose pickup');

  const wide = new Progress(), wideWorld = new TileWorld(4, [], [], 'cryo-shelf');
  wide.levels.drill = 3;
  for (let i = 0; i < wide.max('cargo'); i++) wide.collect('copper');
  const wideMining = new MiningSystem(wideWorld, wide);
  wideMining.update(0.01, wideWorld.get(24, 0), () => {}, 'vertical');
  assert.equal(wideMining.affected.length, 2);
  assert.equal(wideMining.warningUnits, 2, 'warning includes both ore tiles in the wide cut');
  assert.equal(wideMining.warningSpace, 0);
  assert.equal(wideMining.cargoOverflow, true);
  let wideDropped = 0;
  for (let i = 0; i < 40 && wideDropped === 0; i++) wideMining.update(0.01, wideWorld.get(24, 0), (_tile, _collected, dropped) => { wideDropped += dropped; }, 'vertical');
  assert.equal(wideDropped, 2, 'both over-capacity units from the wide cut become recoverable drops');
});
console.log(`\n${passed} system tests passed.`);
