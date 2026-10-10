import assert from 'node:assert/strict';
import { TileWorld, keyOf, type Tile } from '../src/game/world/TileWorld';
import { RockSwimmer, swimmerKindForEncounter } from '../src/game/world/RockSwimmer';
import { SurfaceRaid } from '../src/game/world/SurfaceRaid';
import { tradeNetworkPremium, UNDERGROUND_BUILDING } from '../src/game/config';
import { canAffordStructure, findSurfaceBarrierSite, findSurfaceHabitatSite, findSurfaceTurretSite, findSurfaceWarehouseSite, globeSurfaceDistance, nearbyGlobeSurfaceStructure, nearbySurfaceHabitat, repairSurfaceStructure, surfaceArcCoordinate, surfaceArcPoint, validateSurfaceStructureSite } from '../src/game/building/UndergroundStructures';
import { Progress } from '../src/game/economy/Progress';
import { emptyCargo } from '../src/game/economy/Progress';
import { transferWarehouseOre } from '../src/game/economy/Warehouse';
import { buildSaleReceipt } from '../src/game/economy/Sale';
import { PLANET_SURFACE_LANDMARKS, surfaceLandmarks } from '../src/game/surface/PlanetScenery';
import { cargoTugProgress, contributeCargoTug, contributeVesperRelay, remoteWarehouseAccess, vesperRelayProgress, CARGO_TUG_PROJECT, VESPER_RELAY_PROJECT, SYSTEM_PROJECT_MILESTONES } from '../src/game/economy/SystemProjects';
import { DEFAULT_AUDIO_MIX, LANDMARK_CUE_NOTES, AudioSystem, normalizeAudioVolume, parseAudioMix, startingMusicPhase } from '../src/game/audio/AudioSystem';
import { MiningSystem, aimedDrillTarget, pointerDrillDirection, drillProtection, directionalDrillOrientation, chargeTargets, collectOreDrop, podWithinPickupReach, applySalvageMagnet, hasClearMagnetPath, updateOreDropPhysics, updateChargePhysics } from '../src/game/mining/MiningSystem';
import { advanceLaserThermal, drillImpactProfile } from '../src/game/mining/DrillEffects';
import { PlayerPod, findGrappleAnchor, type Controls } from '../src/game/player/PlayerPod';
import { validateSave, migrateSave, parseSaveFile, SaveManager, type SaveData } from '../src/game/save/SaveManager';
import { ORE_KEYS, ORES, ORE_SILHOUETTES, WORLD, CORE, CORE_RELICS, coreSurveyComplete, vesperChapterUnlocked, VESPER_CHAPTER_CORE_IDS, CORE_WORLD_Y, CORE_CROSSING_CLEARANCE, FAR_SURFACE_ROW, FAR_SURFACE_Y, PLANET_CHART, STARTER_PLANET_CHART, PREVIOUS_STARTER_PLANET_CHART, LEGACY_PLANET_CHART, ROCK_SWIMMER, SHARD_MANTA, SURFACE_RAID, PHYSICS, FUEL, DESCENT_WARNING_SPEED, fallCameraLookAhead, fallMotionCueIntensity, MUSIC_DEPTH, UPGRADES, UPGRADE_KEYS, upgradeGateForLevel, upgradeGateMet, SHIP_COMPONENTS, ROUTE_FRAGMENTS, ROUTE_SURVEY_REWARDS, ROUTE_SHIP_COMPONENTS, NAVIGATION_HASHES, CREW_ARCHIVE_CONCLUSION, CHARGE, SALVAGE_MAGNET, STASIS_MODULE, RETURN_WINCH, ESCAPE_SUIT, PILOT_SUITS, POD_DECALS, POD_PROFILES, REGION_FINDS, depthAtWorldY, gravityDirectionAt, farHemisphereAfterCoreExit, estimateVerticalReturnFuel, estimateWinchReturnFuel, drillReachTiles, drillPreviewDimensions, drillVisualTier, drillWidth, DRILL_TIERS, POD_SIZE, podVisualScale } from '../src/game/config';
import { getDialogFocusables } from '../src/game/ui/focus';
import { tradeRouteEdges, VESPER_SYSTEM_POSITIONS } from '../src/game/economy/TradeNetwork';
import { MARKET_CONTRACTS, advanceMarketDemand, contractReady, marketDemand, marketDemandBonus } from '../src/game/economy/MarketContracts';
import { campaignObjective, drawOreSymbol, flightWarning } from '../src/game/ui/HUD';
import { restoreMapState, snapshotMapState } from '../src/game/campaign/MapState';
import { atSurface, dockedOnSurface, onPlanetSurface, surfaceTownTier, TOWN_TIER_HEIGHTS, MAX_TOWN_ALTITUDE } from '../src/game/surface/SurfaceStation';
import { campaignMapRecords, collectCoreRelic, coreSurveyProgress, crewArchiveRestored } from '../src/game/campaign/Records';
import { advanceOrbitalTransition, cameraAngleDelta, cameraFocusY, cameraUnzoomPoint, cameraZoomPoint, crossedPlanetCore, GLOBE_HANDOFF_ZOOM, orbitalOverviewMinZoom, planetCameraFrameAngle, screenDirectionToWorld, screenToWorld, worldDirectionToScreen, worldToScreen } from '../src/game/world/Projection';
import { planetCartesianVectorToWorld, planetChartCellCorners, planetChartToCartesian, planetCartesianToChart, planetChartCellIntersectsCoreRadius, planetChartLocalOffset, planetChartVectorToCartesian, wrapPlanetSeam, wrapPlanetTile, wrapPlanetWorldX } from '../src/game/world/PlanetChart';
import { crossedStructureDeck, findBuildSite, findSurfaceTradePostSite, nearbyGlobeSurfaceStructure, nearbyServiceStation, type UndergroundStructure } from '../src/game/building/UndergroundStructures';
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}
const idle: Controls = { left: false, right: false, up: false, down: false };
test('directional drilling maps Down to radial cuts and A/D to tangent cuts', () => {
  assert.equal(directionalDrillOrientation({ down: true, left: false, right: false }), 'vertical', 'Down selects a radial cut');
  assert.equal(directionalDrillOrientation({ down: false, left: true, right: false }), 'horizontal', 'A selects a tangent cut');
  assert.equal(directionalDrillOrientation({ down: false, left: false, right: true }), 'horizontal', 'D selects a tangent cut');
});
function clearPlanetBore(world: TileWorld) {
  const chart = world.planetChart!;
  for (let y = 0; y <= world.farSurfaceRow; y++) {
    const radiusRows = Math.abs(chart.radiusRows - (y + 0.5)),
      tangentCellWidth = WORLD.tile * radiusRows * Math.PI / chart.columns,
      width = radiusRows * WORLD.tile > CORE.physicalPassageRadius
        ? Math.ceil((2 * PHYSICS.halfWidth + 4) / Math.max(0.1, tangentCellWidth))
        : 1,
      half = Math.ceil(width / 2);
    for (let x = WORLD.homeColumn - half; x <= WORLD.homeColumn + half; x++) world.break(x, y);
  }
}
test('drill impact feedback matches materials and valuables', () => {
  const base: Tile = { x: 0, y: 0, type: 'dirt', tint: 0x987654 } as Tile;
  assert.equal(drillImpactProfile(base, 'cryo-shelf').kind, 'frost');
  assert.equal(drillImpactProfile({ ...base, type: 'rock' }, 'rust-basin').kind, 'chip');
  assert.equal(drillImpactProfile({ ...base, type: 'hard' }, 'rust-basin').kind, 'spark');
  assert.equal(drillImpactProfile({ ...base, type: 'dirt' }, 'rust-basin').kind, 'dust');
  const ore = drillImpactProfile({ ...base, ore: 'gold', oreUnits: 2 }, 'rust-basin');
  assert.equal(ore.kind, 'shard');
  assert.equal(ore.valuable, true);
  assert.equal(drillImpactProfile({ ...base, geode: true }, 'rust-basin').kind, 'shard');
  assert.equal(drillImpactProfile({ ...base, signalHashId: 'hash-1' }, 'rust-basin').kind, 'glint');
});

test('Laser Miner heats during sustained cutting, cools on release, and vents briefly at full heat', () => {
  let thermal = { heat: 0, vent: 0 };
  thermal = advanceLaserThermal(thermal, 2, true);
  assert.ok(Math.abs(thermal.heat - 2 / 4.5) < 1e-9);
  const cooled = advanceLaserThermal(thermal, 1, false);
  assert.ok(cooled.heat < thermal.heat, 'releasing the drill should cool the emitter');
  const betweenBlocks = advanceLaserThermal(thermal, 1, false, true);
  assert.equal(betweenBlocks.heat, thermal.heat, 'a held drill should retain heat while moving between blocks');
  thermal = advanceLaserThermal(thermal, 3, true);
  assert.equal(thermal.heat, 0);
  assert.ok(thermal.vent > 1, 'full heat should pause cutting for a readable vent interval');
  const venting = advanceLaserThermal(thermal, 0.5, true);
  assert.ok(venting.vent < thermal.vent && venting.heat === 0, 'the beam cannot build heat or cut while venting');
  thermal = advanceLaserThermal(venting, 1, true);
  assert.equal(thermal.vent, 0, 'vent should clear after its short cooldown');
  thermal = advanceLaserThermal(thermal, 1 / 60, true);
  assert.ok(thermal.heat > 0, 'held drill resumes heating after the vent clears');
});
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
test('linked trade posts award capped sale premiums only at member exchanges', () => {
  assert.equal(tradeNetworkPremium(1000, 0, true), 0, 'one post has no remote market');
  assert.equal(tradeNetworkPremium(1000, 2, false), 0, 'sales away from a local exchange receive no premium');
  assert.equal(tradeNetworkPremium(1000, 2, true), 100);
  assert.equal(tradeNetworkPremium(999, 3, true), 199, 'the fractional premium is floored to whole credits');
  assert.equal(tradeNetworkPremium(1000, 5, true), 400, 'the route premium caps at 40 percent');
  assert.equal(tradeNetworkPremium(1000, 5, true, true), 450, 'the restored relay raises the transparent cap by five percent');
  assert.equal(tradeNetworkPremium(-10, 5, true), 0);
});
test('sale receipt freezes ore, destination, and every settlement bonus before committing cargo', () => {
  const cargo = { ...emptyCargo(), copper: 3, iron: 2 }, before = { ...cargo },
    receipt = buildSaleReceipt(cargo, 'cryo-shelf', 'cryo-shelf', [], 2, true, true, false), gross = 3 * ORES.copper.value + 2 * ORES.iron.value;
  assert.deepEqual(receipt.cargo, before);
  assert.equal(receipt.destination, 'cryo-shelf');
  assert.equal(receipt.gross, gross);
  assert.equal(receipt.networkPremium, Math.floor(gross * 0.1));
  assert.equal(receipt.localDemandBonus, Math.floor(3 * ORES.copper.value * 0.2));
  assert.equal(receipt.contractReward, 120);
  assert.equal(receipt.contractStage, 1);
  assert.equal(receipt.total, receipt.gross + receipt.networkPremium + receipt.localDemandBonus + receipt.contractReward);
  assert.deepEqual(cargo, before, 'previewing a receipt never mutates carried cargo');
});
test('connected remote buyers use their own demand and do not claim the local order', () => {
  const cargo = { ...emptyCargo(), copper: 3, iron: 2, silver: 1 },
    receipt = buildSaleReceipt(cargo, 'cryo-shelf', 'prism-fault', [], 3, true, true, false);
  assert.equal(receipt.soldAt, 'cryo-shelf');
  assert.equal(receipt.destination, 'prism-fault');
  assert.equal(receipt.localDemandBonus, Math.floor(ORES.silver.value * 0.2), 'Prism Fault starts by seeking silver');
  assert.equal(receipt.contractReward, 0, 'the Cryo local order is skipped when the remote buyer is chosen');
  const offlineBuyer = buildSaleReceipt(cargo, 'cryo-shelf', 'prism-fault', [], 3, true, false, false);
  assert.equal(offlineBuyer.localDemandBonus, 0, 'unlinked markets cannot be selected as remote buyers');
});
test('Vesper Relay project accepts only ordered planet-warehouse donations and pays once', () => {
  const milestones: string[] = [], cryoStock = { ...emptyCargo(), iron: 2 };
  assert.deepEqual(vesperRelayProgress(milestones), { completedStages: 0, totalStages: 3, complete: false, next: VESPER_RELAY_PROJECT.stages[0] });
  assert.equal(contributeVesperRelay(milestones, 'hull-graveyard', { ...emptyCargo(), iron: 3 }).contributed, false,
    'a later colony cannot skip the active contribution stage');
  assert.equal(cryoStock.iron, 2, 'a rejected contribution does not consume stock');
  assert.equal(contributeVesperRelay(milestones, 'cryo-shelf', { ...emptyCargo(), iron: 1 }).contributed, false,
    'the stage requires its exact requested amount in secure storage');
  const cryo = contributeVesperRelay(milestones, 'cryo-shelf', cryoStock);
  assert.equal(cryo.contributed, true);
  assert.equal(cryoStock.iron, 0);
  const hullStock = { ...emptyCargo(), iron: 3 }, hull = contributeVesperRelay(milestones, 'hull-graveyard', hullStock);
  assert.equal(hull.contributed, true);
  assert.equal(hullStock.iron, 0);
  const prismStock = { ...emptyCargo(), silver: 2 }, prism = contributeVesperRelay(milestones, 'prism-fault', prismStock);
  assert.equal(prism.completed, true);
  assert.equal(prismStock.silver, 0);
  assert.equal(milestones.includes(VESPER_RELAY_PROJECT.completionMilestone), true);
  assert.equal(contributeVesperRelay(milestones, 'prism-fault', prismStock).contributed, false,
    'a completed project cannot be paid twice');
});
test('Cargo Tug project funds remote warehouse access through ordered local donations', () => {
  const milestones: string[] = [], cryoStock = { ...emptyCargo(), copper: 3 };
  assert.equal(contributeCargoTug(milestones, 'hull-graveyard', { ...emptyCargo(), iron: 3 }).contributed, false,
    'the project cannot skip its Cryo Shelf stage');
  assert.equal(contributeCargoTug(milestones, 'cryo-shelf', { ...emptyCargo(), copper: 2 }).contributed, false,
    'the stage needs all three copper from secure storage');
  assert.equal(contributeCargoTug(milestones, 'cryo-shelf', cryoStock).contributed, true);
  assert.equal(cryoStock.copper, 0);
  const hullStock = { ...emptyCargo(), iron: 3 };
  assert.equal(contributeCargoTug(milestones, 'hull-graveyard', hullStock).contributed, true);
  const vesperStock = { ...emptyCargo(), diamond: 2 };
  assert.equal(contributeCargoTug(milestones, 'vesper-9', vesperStock).completed, true);
  assert.equal(vesperStock.diamond, 0);
  assert.equal(cargoTugProgress(milestones).complete, true);
  assert.equal(contributeCargoTug(milestones, 'vesper-9', vesperStock).contributed, false,
    'the completed cargo tug cannot consume ore or pay twice');
  assert.equal(remoteWarehouseAccess([], 'cryo-shelf', 'hull-graveyard', ['cryo-shelf', 'hull-graveyard']), false);
  assert.equal(remoteWarehouseAccess(milestones, 'cryo-shelf', 'hull-graveyard', ['cryo-shelf', 'hull-graveyard']), true);
  assert.equal(remoteWarehouseAccess(milestones, 'cryo-shelf', 'prism-fault', ['cryo-shelf']), false,
    'remote access requires a built warehouse at that destination');
  assert.ok(SYSTEM_PROJECT_MILESTONES.includes(CARGO_TUG_PROJECT.completionMilestone), 'the version-24 milestone list persists completion');
});
test('planet warehouses transfer selected half-unit ore without exceeding miner capacity', () => {
  const cargo = { ...emptyCargo(), copper: 2.5, iron: 1 }, warehouse = { ...emptyCargo(), copper: 4.5 };
  const stored = transferWarehouseOre(cargo, warehouse, 'copper', 'store', 1.5, 6);
  assert.equal(stored.moved, 1.5);
  assert.equal(stored.cargo.copper, 1);
  assert.equal(stored.warehouse.copper, 6);
  const withdrawn = transferWarehouseOre(stored.cargo, stored.warehouse, 'copper', 'withdraw', 20, 4);
  assert.equal(withdrawn.moved, 2, 'withdrawal respects the remaining two-unit cargo capacity');
  assert.equal(withdrawn.cargo.copper, 3);
  assert.equal(withdrawn.warehouse.copper, 4);
  assert.equal(transferWarehouseOre(cargo, warehouse, 'copper', 'store', 1, 6).moved, 1,
    'transfers round down to half-unit increments');
  assert.equal(transferWarehouseOre(cargo, warehouse, 'copper', 'store', Number.NaN, 6).moved, 0);
});
test('planetary Trading Post demand rotates after local sales and pays only matching ore', () => {
  const milestones: string[] = [], mixedHaul = { copper: 2, iron: 3, silver: 1.5, gold: 0, diamond: 0 };
  assert.deepEqual(marketDemand('cryo-shelf', milestones), { ore: 'copper', stage: 1, total: 4 });
  assert.equal(marketDemandBonus(mixedHaul, 'cryo-shelf', milestones, true), 7,
    'the initial copper demand gives a 20 percent bonus on copper only');
  assert.equal(marketDemandBonus(mixedHaul, 'cryo-shelf', milestones, false), 0,
    'Hab 07 and non-member surfaces do not receive local market premiums');
  assert.equal(advanceMarketDemand(milestones, 'cryo-shelf', false, 100), false);
  assert.deepEqual(marketDemand('cryo-shelf', milestones), { ore: 'copper', stage: 1, total: 4 });
  assert.equal(advanceMarketDemand(milestones, 'cryo-shelf', true, 100), true);
  assert.deepEqual(marketDemand('cryo-shelf', milestones), { ore: 'silver', stage: 2, total: 4 });
  assert.equal(marketDemandBonus(mixedHaul, 'cryo-shelf', milestones, true), 16,
    'the next cycle rewards silver carried to this planet');
  advanceMarketDemand(milestones, 'cryo-shelf', true, 100);
  advanceMarketDemand(milestones, 'cryo-shelf', true, 100);
  advanceMarketDemand(milestones, 'cryo-shelf', true, 100);
  assert.deepEqual(marketDemand('cryo-shelf', milestones), { ore: 'copper', stage: 1, total: 4 },
    'the four-step demand cycle returns to its first offer without unbounded save growth');
  assert.equal(milestones.length, 0);
});
test('interplanetary trade routes connect each online colony once through the nearest existing node', () => {
  assert.deepEqual(tradeRouteEdges([]), []);
  assert.deepEqual(tradeRouteEdges(['cryo-shelf']), []);
  const posts = ['cryo-shelf', 'mars-frontier', 'hull-graveyard', 'prism-fault', 'cinder-vale', 'vesper-9'] as const,
    edges = tradeRouteEdges([...posts, 'cryo-shelf']);
  assert.equal(edges.length, posts.length - 1, 'a connected tree needs one route per colony beyond its root');
  assert.ok(edges.every(({ from, to }) => posts.includes(from as typeof posts[number]) && posts.includes(to as typeof posts[number])));
  const reached = new Set(['cryo-shelf']);
  while (true) {
    const next = edges.find(({ from, to }) => reached.has(from) && !reached.has(to));
    if (!next) break;
    reached.add(next.to);
  }
  assert.equal(reached.size, posts.length, 'every post belongs to the Vesper network');
  assert.deepEqual(tradeRouteEdges([...posts, 'cryo-shelf']), edges, 'route topology is stable across reloads and repeated builds');
  assert.ok(Object.values(VESPER_SYSTEM_POSITIONS).every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100));
});

test('planetary buy orders pay once only at their local Trading Post and persist in compatible milestones', () => {
  const p = new Progress();
  p.cargo.copper = MARKET_CONTRACTS['cryo-shelf'].units;
  assert.equal(contractReady(p.cargo, p.milestones, 'cryo-shelf', false), false, 'Hab 07 cannot fulfill a remote colony order');
  assert.equal(contractReady(p.cargo, p.milestones, 'cryo-shelf', true), true);
  assert.equal(p.claimMarketContract('cryo-shelf', true), MARKET_CONTRACTS['cryo-shelf'].reward);
  assert.equal(p.claimMarketContract('cryo-shelf', true), 0, 'the next order needs its own requested ore');
  assert.equal(p.milestones.includes('contract-cryo'), true);
  p.cargo.iron = 2;
  assert.equal(contractReady(p.cargo, p.milestones, 'cryo-shelf', true), true, 'the next local contract opens after the first delivery');
  assert.equal(p.claimMarketContract('cryo-shelf', true), 180);
  assert.equal(p.milestones.includes('contract-cryo-2'), true);
  assert.equal(p.claimMarketContract('cryo-shelf', true), 0, 'a claimed stage cannot pay again');
  assert.equal(p.claimMarketContract('prism-fault', true), 0, 'contracts remain planet-specific');
});
test('campaign objective tracks route signals, ship assembly, core records and emergency rescue', () => {
  const p = new Progress();
  let objective = campaignObjective(p, 'cryo-shelf');
  assert.match(objective.title, /0\/4/);
  assert.match(objective.body, /THERMAL OBSERVATORY · 96 M/);
  p.routeFragments = ROUTE_FRAGMENTS.map((fragment) => fragment.id);
  objective = campaignObjective(p, 'cryo-shelf');
  assert.match(objective.title, /ASSEMBLE THE FARADAY · 0\/4 SYSTEMS/);
  p.shipComponents = Object.keys(SHIP_COMPONENTS);
  objective = campaignObjective(p, 'cryo-shelf');
  assert.match(objective.title, /PLANET CORE RECORD · CRYO SHELF/);
  p.milestones.push(CORE_RELICS.find((relic) => relic.mapId === 'cryo-shelf')!.id);
  objective = campaignObjective(p, 'cryo-shelf');
  assert.match(objective.title, /FARADAY CORE LEDGER · 1\/6/);
  p.pilotEscaping = true;
  assert.match(campaignObjective(p, 'cryo-shelf').title, /EMERGENCY RETURN/);
});
test('mouse projection reverses cleanly in either hemisphere', () => {
  for (const inverted of [false, true]) {
    const screen = worldToScreen(1200, 3400, 700, 3150, 960, 720, inverted);
    assert.deepEqual(screenToWorld(screen.x, screen.y, 700, 3150, 960, 720, inverted), { x: 1200, y: 3400 });
  }
});
test('general camera zoom keeps pointer-to-world coordinates reversible', () => {
  for (const zoom of [0.45, 0.72, 1, 1.35, 1.8]) {
    const pointer = { x: 711, y: 238 }, width = 1280, height = 800;
    const zoomed = cameraZoomPoint(pointer, width, height, zoom);
    const restored = cameraUnzoomPoint(zoomed, width, height, zoom);
    assert.ok(Math.abs(restored.x - pointer.x) < 1e-8 && Math.abs(restored.y - pointer.y) < 1e-8);
  }
});
test('orbital zoom fits compact and legacy planets within desktop and small viewports', () => {
  for (const [width, height] of [[1280, 610], [640, 300], [390, 260]]) {
    for (const chart of [PLANET_CHART, LEGACY_PLANET_CHART]) {
      const radius = chart.radiusRows * WORLD.tile, zoom = orbitalOverviewMinZoom(width, height, radius), diameter = radius * 2 * zoom;
      assert.ok(diameter <= width * 0.28 + 1e-8, 'the cutaway stays within its HUD-safe width');
      assert.ok(diameter <= height * 0.6 + 1e-8, 'the cutaway stays within its HUD-safe height');
      assert.ok(zoom > 0 && zoom < 0.1, 'the zoom is positive and scales older, larger planets down further');
    }
  }
});
test('globe view switches only after local zoom finishes, then uses a short reversible transition', () => {
  assert.equal(GLOBE_HANDOFF_ZOOM, 0.62);
  assert.equal(advanceOrbitalTransition(0, 0.19, true), 0.5);
  assert.equal(advanceOrbitalTransition(0.5, 0.19, true), 1);
  assert.equal(advanceOrbitalTransition(1, 0.19, false), 0.5);
  assert.equal(advanceOrbitalTransition(0.5, 0.19, false), 0);
  assert.equal(advanceOrbitalTransition(0.2, 0.01, true, true), 1, 'reduced motion skips the animation');
});
test('planet camera follows local up smoothly around the surface and turns at the core', () => {
  const chart = PLANET_CHART, columns = chart.columns, radius = chart.radiusRows;
  for (const point of [{ u: 0.5, v: 0 }, { u: columns * 0.3, v: 0 }, { u: columns * 0.7, v: 2 * radius }]) {
    const rotation = planetCameraFrameAngle(point.u, point.v, chart)!;
    const position = planetChartToCartesian(point, columns, radius);
    const screenUp = worldDirectionToScreen(position.x, position.y, rotation);
    assert.ok(Math.abs(screenUp.x) < 1e-8 && screenUp.y < 0, 'local outward always maps to screen-up');
  }
  const aroundNear = cameraAngleDelta(planetCameraFrameAngle(100, 0, chart)!, planetCameraFrameAngle(101, 0, chart)!);
  assert.ok(Math.abs(aroundNear) < 0.01, 'walking one tile along the surface adjusts the camera gradually');
  const beforeSeam = planetCameraFrameAngle(columns - 0.25, 0, chart)!;
  const afterSeam = planetCameraFrameAngle(0.25, 2 * radius, chart)!;
  assert.ok(Math.abs(cameraAngleDelta(beforeSeam, afterSeam)) < 0.01, 'the twisted surface seam does not create an abrupt camera turn');
  const nearCore = planetCameraFrameAngle(columns / 2, radius - 0.5, chart)!;
  const farCore = planetCameraFrameAngle(columns / 2, radius + 0.5, chart)!;
  assert.ok(Math.abs(Math.abs(cameraAngleDelta(nearCore, farCore)) - Math.PI) < 1e-8,
    'crossing through the center produces the deliberate 180-degree camera turn');
  assert.equal(planetCameraFrameAngle(columns / 2, radius, chart), undefined, 'camera holds its last stable frame at the gravity center');
  assert.equal(crossedPlanetCore(CORE_WORLD_Y - 8, CORE_WORLD_Y + 8, CORE_WORLD_Y), true, 'passing the center triggers the dramatic turn');
  assert.equal(crossedPlanetCore(CORE_WORLD_Y + 8, CORE_WORLD_Y - 8, CORE_WORLD_Y), true, 'returning through the center turns back');
  assert.equal(crossedPlanetCore(0, FAR_SURFACE_Y, CORE_WORLD_Y, 1), false, 'wrapping around the surface never triggers the core turn');
});
test('fall camera lookahead is speed-driven and symmetric with gravity', () => {
  assert.equal(fallCameraLookAhead(0, 1), 0);
  assert.equal(fallCameraLookAhead(DESCENT_WARNING_SPEED, 1), 0);
  assert.ok(fallCameraLookAhead(230, 1) > 0 && fallCameraLookAhead(230, 1) < 96);
  assert.equal(fallCameraLookAhead(PHYSICS.fall, 1), 96);
  assert.equal(fallCameraLookAhead(-PHYSICS.fall, -1), 96, 'far-side falls use the same camera lead');
  assert.equal(fallCameraLookAhead(-100, 1), 0, 'climbing never moves the camera ahead of the fall');
  assert.equal(fallMotionCueIntensity(DESCENT_WARNING_SPEED, 1), 0);
  assert.ok(fallMotionCueIntensity(230, 1) > 0 && fallMotionCueIntensity(230, 1) < 1);
  assert.equal(fallMotionCueIntensity(-PHYSICS.fall, -1), 1, 'far-side inward motion gets the same cue');
  assert.equal(fallMotionCueIntensity(-100, 1), 0, 'outward thrust never produces rushing-fall lines');
  assert.equal(cameraFocusY(1000, 96, 0), 1096);
  assert.equal(cameraFocusY(1000, 96, Math.PI), 904);
  assert.ok(Math.abs(cameraFocusY(1000, 96, Math.PI / 2) - 1000) < 1e-8, 'camera lead passes smoothly through the sideways view');
});
test('camera flip keeps horizontal and upward inputs aligned to screen throughout the turn', () => {
  for (const rotation of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.8, Math.PI]) {
    const right = screenDirectionToWorld(1, 0, rotation), up = screenDirectionToWorld(0, -1, rotation);
    const projectedRight = worldDirectionToScreen(right.x, right.y, rotation);
    const projectedUp = worldDirectionToScreen(up.x, up.y, rotation);
    assert.ok(Math.abs(projectedRight.x - 1) < 1e-8 && Math.abs(projectedRight.y) < 1e-8,
      'right remains right; left is its opposite at every camera angle');
    assert.ok(Math.abs(projectedUp.x) < 1e-8 && Math.abs(projectedUp.y + 1) < 1e-8,
      'upward thrust remains upward on screen while the camera turns');
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
test('polar tile cells share exact angular edges and narrow toward the core', () => {
  const columns = Math.round(Math.PI * 300), radius = 300;
  const left = planetChartCellCorners({ x: 410, y: 12 }, columns, radius, 40);
  const right = planetChartCellCorners({ x: 411, y: 12 }, columns, radius, 40);
  assert.deepEqual(left.topRight, right.topLeft);
  assert.deepEqual(left.bottomRight, right.bottomLeft);
  const surface = planetChartCellCorners({ x: 410, y: 0 }, columns, radius, 40);
  const coreEdge = planetChartCellCorners({ x: 410, y: radius - 1 }, columns, radius, 40);
  const surfaceSpan = Math.hypot(surface.topRight.x - surface.topLeft.x, surface.topRight.y - surface.topLeft.y);
  const innerSpan = Math.hypot(coreEdge.topRight.x - coreEdge.topLeft.x, coreEdge.topRight.y - coreEdge.topLeft.y);
  assert.ok(surfaceSpan > innerSpan * 100, 'angular cells narrow as they approach the core');
});
test('polar core chamber has physical clearance and the miner collides with curved tile edges', () => {
  assert.equal(planetChartCellIntersectsCoreRadius(
    { x: WORLD.homeColumn + 100, y: PLANET_CHART.radiusRows - 1 },
    PLANET_CHART.columns, PLANET_CHART.radiusRows, CORE.physicalPassageRadius, WORLD.tile,
  ), true, 'cells meeting the central physical chamber are included in its clearance');
  const world = new TileWorld(733, [], [], 'cryo-shelf', PLANET_CHART), pod = new PlayerPod(world, new Progress()),
    row = 75, column = WORLD.homeColumn + 1;
  world.get(column, row).type = 'hard';
  for (const x of [WORLD.homeColumn, column]) world.break(x, row);
  pod.x = (WORLD.homeColumn + 0.5) * WORLD.tile;
  pod.y = (row + 0.5) * WORLD.tile;
  assert.equal(pod.overlaps(pod.x, pod.y).some((tile) => tile.x === column && tile.y === row), false,
    'a cleared cell leaves enough curved tangent clearance at this radius');
  world.destroyed.delete(`${column},${row}`);
  assert.equal(pod.overlaps(pod.x, pod.y).some((tile) => tile.x === column && tile.y === row), true,
    'an intact neighboring polar cell blocks the physical pod hull even when chart rectangles would not');
  const mining = new MiningSystem(new TileWorld(734, [], [], 'cryo-shelf', PLANET_CHART), new Progress()),
    target = mining.world.get(WORLD.homeColumn, Math.round(PLANET_CHART.radiusRows) - 7);
  mining.update(0.001, target, () => {}, 'vertical');
  const requiredSpan = 2 * PHYSICS.halfWidth + 4,
    tangentSpan = mining.effectiveWidth * WORLD.tile * Math.abs(PLANET_CHART.radiusRows - (target.y + 0.5)) * Math.PI / PLANET_CHART.columns;
  assert.ok(tangentSpan >= requiredSpan, `radial core cuts widen to ${mining.effectiveWidth} tiles for physical hull clearance`);
  assert.ok(Math.abs(140 - mining.progress.fuel - FUEL.drilling * 0.001) < 1e-9,
    'mandatory angular clearance does not multiply the starter drill fuel cost');
});
test('horizontal collision inset lets the miner clear small block lips while preserving full block collisions', () => {
  const world = new TileWorld(734, [], [], 'cryo-shelf'), pod = new PlayerPod(world, new Progress()),
    tileX = 8, tileY = 20, edgeX = tileX * WORLD.tile;
  for (let x = tileX - 1; x <= tileX; x++) world.get(x, tileY).type = 'empty';
  world.get(tileX, tileY).type = 'hard';
  const centerY = (tileY + 0.5) * WORLD.tile, startX = edgeX - PHYSICS.halfWidth - 1;
  pod.x = startX;
  pod.y = centerY;
  pod.docked = false;
  pod.update(0.05, { ...idle, right: true }, () => {});
  assert.ok(pod.x > startX + 1, 'horizontal steering advances past a barely protruding block edge');
  assert.equal(pod.overlaps(pod.x, pod.y).length, 0, 'the relaxed side clearance still prevents a collision state');
  assert.equal(pod.overlaps(edgeX - PHYSICS.halfWidth + PHYSICS.horizontalCollisionInset - 1, centerY).length, 0,
    'the three-pixel inset clears a shallow visual overlap at a block corner');
  assert.ok(pod.overlaps(edgeX - PHYSICS.halfWidth + PHYSICS.horizontalCollisionInset + 2, centerY).length,
    'deeper overlap still blocks the miner');
});
test('polar wall contact stops at the last clear position instead of snapping to chart tile indices', () => {
  const world = new TileWorld(719, [], [], 'cryo-shelf', STARTER_PLANET_CHART), progress = new Progress(), pod = new PlayerPod(world, progress);
  const frame = planetCameraFrameAngle(pod.x / WORLD.tile, 10.5, STARTER_PLANET_CHART) ?? 0;
  let fixture: { x: number; y: number; rock: Tile; snapX: number } | undefined;
  for (let ty = 3; ty < 18; ty++) for (let tx = 15; tx < 35; tx++) {
    const rock = world.get(tx, ty);
    if (rock.type === 'boundary') continue;
    rock.type = 'rock';
    for (let y = 340; y <= 500 && !fixture; y += 4) for (let x = 900; x <= 1060 && !fixture; x += 4) {
      if (pod.overlaps(x, y, frame).length) continue;
      const hit = pod.overlaps(x + 5, y, frame);
      if (!hit.length) continue;
      const oldRectangularSnap = Math.min(...hit.map((tile) => tile.x * WORLD.tile)) - PHYSICS.halfWidth;
      if (Math.abs(oldRectangularSnap - x) > 20) fixture = { x, y, rock, snapX: oldRectangularSnap };
    }
    if (fixture) break;
    rock.type = 'empty';
  }
  assert.ok(fixture, 'fixture should expose a curved cell whose chart-index snap is far from the miner');
  pod.x = fixture!.x;
  pod.y = fixture!.y;
  pod.vx = 165;
  pod.vy = 0;
  pod.docked = false;
  pod.update(0.05, idle, () => {}, frame);
  assert.ok(Math.abs(pod.x - fixture!.x) < 7, 'the swept collision keeps the miner beside its last clear position');
  assert.ok(Math.abs(pod.x - fixture!.snapX) > 20, 'the response never snaps to a false rectangular chart bound');
  assert.equal(pod.overlaps(pod.x, pod.y, frame).length, 0, 'the miner remains outside the curved wall');
});
test('local structure offsets follow planetary tangent and outward normals on both hemispheres', () => {
  const columns = PLANET_CHART.columns, radius = PLANET_CHART.radiusRows, u = columns / 2, tile = WORLD.tile;
  for (const v of [90, radius * 2 - 90]) {
    const origin = planetChartToCartesian({ u, v }, columns, radius, tile);
    const tangent = planetChartToCartesian(planetChartLocalOffset({ u, v }, 40, 0, columns, radius, tile), columns, radius, tile);
    const outward = planetChartToCartesian(planetChartLocalOffset({ u, v }, 0, 25, columns, radius, tile), columns, radius, tile);
    const hemisphere = v < radius ? 1 : -1;
    assert.ok(Math.abs(tangent.x - origin.x) < 0.1 && Math.abs((tangent.y - origin.y) - hemisphere * 40) < 0.1,
      'tangent offsets preserve a physical 40 px distance and reverse along the far-side surface');
    assert.ok(Math.abs((outward.x - origin.x) - hemisphere * 25) < 0.1 && Math.abs(outward.y - origin.y) < 0.1,
      'outward offsets remain surface-normal on both crusts');
  }
});
test('charted flight maps screen-relative steering onto local planetary tangent and radial axes', () => {
  const columns = Math.round(Math.PI * 300), radiusRows = 300, tileSize = WORLD.tile;
  for (const u of [0, columns * 0.12, columns * 0.47, columns * 0.88])
    for (const v of [0, 90, 510, 600])
      for (const rotation of [0, Math.PI / 3, Math.PI])
        for (const [screenX, screenY] of [[1, 0], [0, -1]] as const) {
          const point = { u, v };
          const cartesianDirection = screenDirectionToWorld(screenX, screenY, rotation);
          const chartDirection = planetCartesianVectorToWorld(point, cartesianDirection, columns, radiusRows, tileSize);
          const cartesianResult = planetChartVectorToCartesian(point, {
            du: chartDirection.x / tileSize,
            dv: chartDirection.y / tileSize,
          }, columns, radiusRows, tileSize);
          const screenResult = worldDirectionToScreen(cartesianResult.dx, cartesianResult.dy, rotation);
          assert.ok(Math.abs(screenResult.x - screenX) < 1e-7 && Math.abs(screenResult.y - screenY) < 1e-7,
            'local chart steering projects back to the requested screen direction');
        }
});
test('planet world seam wraps between surfaces and mirrors radial motion and aim', () => {
  const one = wrapPlanetWorldX(-1, 120, 30, 9, 0.6, -0.8, WORLD.width * WORLD.tile, FAR_SURFACE_Y);
  assert.deepEqual(one, {
    x: WORLD.width * WORLD.tile - 1, y: FAR_SURFACE_Y - 120,
    vx: 30, vy: -9, aimX: 0.6, aimY: 0.8, crossings: -1,
  });
  const two = wrapPlanetWorldX(WORLD.width * WORLD.tile * 2 + 4, 120, -3, 9, -0.4, 0.8, WORLD.width * WORLD.tile, FAR_SURFACE_Y);
  assert.deepEqual(two, { x: 4, y: 120, vx: -3, vy: 9, aimX: -0.4, aimY: 0.8, crossings: 2 });
  assert.throws(() => wrapPlanetWorldX(0, 0, 0, 0, 0, 0, 0, FAR_SURFACE_Y), RangeError);
});
test('charted tile worlds share terrain and excavation across their twisted seam', () => {
  const chart = PLANET_CHART, world = new TileWorld(801, [], [], 'mars-frontier', chart);
  assert.equal(world.widthTiles, chart.columns);
  for (const y of [0, 27, 299, 599]) {
    const wrapped = wrapPlanetTile({ x: -1, y }, chart.columns, chart.radiusRows);
    assert.deepEqual(wrapped, { x: chart.columns - 1, y: chart.radiusRows * 2 - y - 1 });
    assert.deepEqual(world.get(-1, y), world.get(wrapped.x, wrapped.y));
  }
  world.break(-1, 30);
  const excavated = wrapPlanetTile({ x: -1, y: 30 }, chart.columns, chart.radiusRows);
  assert.ok(world.destroyed.has(keyOf(excavated.x, excavated.y)));
  assert.equal(world.get(excavated.x, excavated.y).type, 'empty', 'seam mining persists at one canonical tile key');
  const legacy = new TileWorld(801);
  assert.equal(legacy.widthTiles, WORLD.width);
  assert.equal(legacy.get(-1, 30).type, 'boundary', 'chartless worlds retain rectangular edges');
});
test('charted pod crosses a surface seam with mirrored depth and velocity', () => {
  const world = new TileWorld(802, [], [], 'mars-frontier', PLANET_CHART), pod = new PlayerPod(world, new Progress());
  for (const x of [-1, 0, PLANET_CHART.columns - 1, PLANET_CHART.columns])
    for (const y of [29, 30, 31]) world.break(x, y);
  pod.docked = false;
  pod.x = 2;
  pod.y = 30 * WORLD.tile + WORLD.tile / 2;
  pod.vx = -145;
  pod.vy = 50;
  pod.update(0.05, idle, () => {});
  assert.equal(pod.planetSeamCrossings, -1);
  assert.ok(pod.x > (PLANET_CHART.columns - 1) * WORLD.tile, 'pod emerges at the far horizontal edge');
  assert.ok(Math.abs(pod.y - (PLANET_CHART.radiusRows * 2 * WORLD.tile - (30 * WORLD.tile + WORLD.tile / 2))) < 50, 'radial position mirrors across the compact planet');
  assert.ok(pod.vy < 0, 'radial velocity changes direction at the seam');
});
test('loose ore drops cross a chart seam without being lost at the edge', () => {
  const world = new TileWorld(803, [], [], 'mars-frontier', PLANET_CHART);
  for (const x of [-1, 0, PLANET_CHART.columns - 1, PLANET_CHART.columns])
    for (const y of [29, 30, 31]) world.break(x, y);
  const drop = { x: 2, y: 30 * WORLD.tile + WORLD.tile / 2, vx: -145, vy: 50 };
  updateOreDropPhysics(world, drop, 0.05, 1);
  assert.ok(drop.x > (PLANET_CHART.columns - 1) * WORLD.tile, 'pickup is carried across the horizontal seam');
  assert.ok(Math.abs(drop.y - (PLANET_CHART.radiusRows * 2 * WORLD.tile - (30 * WORLD.tile + WORLD.tile / 2))) < 50);
  assert.ok(drop.vy < 0, 'gravity velocity mirrors so the pickup continues with the far-side surface');
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
  const world = new TileWorld(702, [], [], 'cryo-shelf'), centerX = WORLD.homeColumn, coreRow = Math.round(CORE_WORLD_Y / WORLD.tile);
  assert.equal(world.get(centerX, coreRow).coreRelicId, 'core-cryo', 'the passage centers a guaranteed map-specific objective');
  assert.equal(world.get(centerX, coreRow).type, 'hard', 'the core lens is a drillable landmark in the crossing route');
  assert.equal(world.get(centerX - 1, coreRow).type, 'empty', 'the physical center chamber remains open beside the relic');
  const polarWorld = new TileWorld(702, [], [], 'cryo-shelf', PLANET_CHART),
    outerCoreApproach = polarWorld.get(centerX + 100, PLANET_CHART.radiusRows - 3);
  assert.notEqual(outerCoreApproach.type, 'empty', 'the physical chamber remains surrounded by mineable core rock');
  polarWorld.break(outerCoreApproach.x, outerCoreApproach.y);
  assert.equal(polarWorld.get(outerCoreApproach.x, outerCoreApproach.y).type, 'empty', 'the surrounding core rock can be drilled');
  assert.equal(world.get(centerX, FAR_SURFACE_ROW).type, 'empty', 'the opposite crust opens onto its own surface');
  assert.equal(world.gravitySign(CORE_WORLD_Y - 1), 1);
  assert.equal(world.gravitySign(CORE_WORLD_Y + 1), -1, 'gravity changes polarity immediately across the core');
  assert.equal(gravityDirectionAt(CORE_WORLD_Y - 1), 1);
  assert.equal(gravityDirectionAt(CORE_WORLD_Y + 1), -1);
  assert.equal(depthAtWorldY(WORLD.spawnY), 0);
  assert.equal(depthAtWorldY(FAR_SURFACE_Y + 22), 0);
  assert.ok(Math.abs(depthAtWorldY(CORE_WORLD_Y - 1) - depthAtWorldY(CORE_WORLD_Y + 1)) <= 1, 'depth reads continuously on both sides of the core');
  assert.ok(atSurface(WORLD.spawnX, FAR_SURFACE_Y + 22) && dockedOnSurface(WORLD.spawnX, FAR_SURFACE_Y + 22), 'the far crust has a real service-and-sale docking zone');
  assert.equal(onPlanetSurface(3200, WORLD.spawnY, STARTER_PLANET_CHART), true,
    'charted planets expose the entire outer crust for exploration and building');
  assert.equal(atSurface(3200, WORLD.spawnY, STARTER_PLANET_CHART), false,
    'Hab 07’s sale and upgrade yard stays local while the player explores elsewhere');
  assert.equal(onPlanetSurface(3200, 100 * WORLD.tile, STARTER_PLANET_CHART), false,
    'planet-wide construction access does not include underground positions');
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
test('surface trading posts place on either crust, one per planet, within the saved chart bounds', () => {
  const world = new TileWorld(813, [], [], 'cryo-shelf', STARTER_PLANET_CHART), centerX = WORLD.spawnX;
  const home = findSurfaceTradePostSite(world, centerX, WORLD.spawnY, []);
  assert.deepEqual(home, { x: centerX + 430, y: 0 });
  assert.equal(home!.x < world.widthTiles * WORLD.tile, true);
  assert.equal(findSurfaceTradePostSite(world, centerX, WORLD.spawnY, [{ id: 'trade-post:1410:0', kind: 'trade-post', ...home! }]), undefined,
    'a second trading post cannot be placed on the same planet');
  const far = findSurfaceTradePostSite(world, centerX, world.farSurfaceY + 22, []);
  assert.deepEqual(far, { x: centerX + 430, y: world.farSurfaceY });
  assert.equal(findSurfaceTradePostSite(world, centerX, WORLD.spawnY, Array.from({ length: UNDERGROUND_BUILDING.maxStructuresPerMap }, (_, i) => ({
    id: `platform:${i}`, kind: 'platform' as const, x: 300 + i * 250, y: 2000 + i * 300,
  }))), undefined, 'the per-planet structure capacity applies to surface builds too');
});
test('surface habitats form spaced waystations on either crust and resolve local service range across the chart seam', () => {
  const world = new TileWorld(814, [], [], 'cryo-shelf', STARTER_PLANET_CHART), circumference = world.widthTiles * WORLD.tile;
  assert.equal(canAffordStructure('habitat', { copper: 4, iron: 2, silver: 1, gold: 0, diamond: 0 }, 900), true);
  assert.equal(canAffordStructure('habitat', { copper: 4, iron: 2, silver: 0, gold: 0, diamond: 0 }, 900), false,
    'habitats require their stated rare construction material as well as credits');
  const first = findSurfaceHabitatSite(world, WORLD.spawnX, WORLD.spawnY, []);
  assert.deepEqual(first, { x: WORLD.spawnX + 140, y: 0 });
  const built: UndergroundStructure[] = [{ id: `habitat:${first!.x}:0`, kind: 'habitat', ...first! }];
  const second = findSurfaceHabitatSite(world, WORLD.spawnX, WORLD.spawnY, built);
  assert.ok(second && Math.abs(second.x - first!.x) >= Math.ceil(UNDERGROUND_BUILDING.habitat.widthTiles * WORLD.tile / 2) + 80,
    'a second habitat is automatically placed beyond the first module footprint');
  built.push({ id: `habitat:${second!.x}:0`, kind: 'habitat', ...second! });
  const third = findSurfaceHabitatSite(world, WORLD.spawnX, WORLD.spawnY, built);
  assert.equal(third?.y, 0, 'the remaining habitat site stays on the home crust');
  built.push({ id: `habitat:${third!.x}:0`, kind: 'habitat', ...third! });
  assert.equal(findSurfaceHabitatSite(world, WORLD.spawnX, WORLD.spawnY, built), undefined, 'a fourth habitat is not allowed on one planet');
  const far = findSurfaceHabitatSite(world, WORLD.spawnX, world.farSurfaceY + 22, []);
  assert.deepEqual(far, { x: WORLD.spawnX + 140, y: world.farSurfaceY });
  const seamSite = { id: `habitat:${circumference - 50}:0`, kind: 'habitat' as const, x: circumference - 50, y: 0 };
  assert.equal(nearbySurfaceHabitat([seamSite], 50, 0, circumference), seamSite,
    'a nearby habitat remains interactable across the wrapped longitude seam');
  assert.equal(nearbySurfaceHabitat([seamSite], 500, 0, circumference), undefined,
    'the service prompt is limited to the building vicinity');
  const oppositeSeamHabitat = { id: 'habitat:far-seam', kind: 'habitat' as const, x: circumference - 50, y: world.farSurfaceY };
  assert.equal(nearbyGlobeSurfaceStructure([oppositeSeamHabitat], 50, 0, world, 'habitat'), oppositeSeamHabitat,
    'a habitat remains interactable across the globe’s twisted pole seam');
  const remotePost = { id: 'trade-post:2700:0', kind: 'trade-post' as const, x: 2700, y: 0 };
  assert.equal(nearbyGlobeSurfaceStructure([remotePost], 2700, 0, world, 'trade-post'), remotePost,
    'a Trading Post exposes its local market at any surface longitude');
  assert.equal(globeSurfaceDistance(world, 50, 0, circumference - 50, world.farSurfaceY), 100,
    'surface interaction distance remains continuous when crossing the twisted globe seam');
});
test('surface defense pylons place safely on both crusts and share the planetary turret cap', () => {
  const world = new TileWorld(815, [], [], 'cryo-shelf', STARTER_PLANET_CHART);
  const first = findSurfaceTurretSite(world, WORLD.spawnX, WORLD.spawnY, []);
  assert.deepEqual(first, { x: WORLD.spawnX + 140, y: 0 });
  const existing: UndergroundStructure[] = [{ id: 'turret:1120:0', kind: 'turret', ...first! }];
  const second = findSurfaceTurretSite(world, WORLD.spawnX, WORLD.spawnY, existing);
  assert.ok(second && second.y === 0 && second.x !== first!.x, 'a second pylon finds a separate surface site');
  existing.push({ id: `turret:${second!.x}:0`, kind: 'turret', ...second! });
  assert.ok(findSurfaceTurretSite(world, WORLD.spawnX, WORLD.spawnY, existing), 'the third planetary pylon can be placed');
  existing.push({ id: 'turret:700:0', kind: 'turret', x: 700, y: 0 });
  assert.equal(findSurfaceTurretSite(world, WORLD.spawnX, WORLD.spawnY, existing), undefined,
    'surface and underground sentries share the three-turret world limit');
  assert.deepEqual(findSurfaceTurretSite(world, WORLD.spawnX, world.farSurfaceY + 22, []), { x: WORLD.spawnX + 140, y: world.farSurfaceY });
});
test('a planet warehouse places once, respects surface spacing, and persists in map snapshots', () => {
  const world = new TileWorld(818, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    first = findSurfaceWarehouseSite(world, WORLD.spawnX, WORLD.spawnY, []);
  assert.deepEqual(first, { x: WORLD.spawnX + 140, y: 0 });
  const built: UndergroundStructure[] = [{ id: `warehouse:${first!.x}:0`, kind: 'warehouse', ...first! }];
  assert.equal(findSurfaceWarehouseSite(world, WORLD.spawnX, WORLD.spawnY, built), undefined, 'only one warehouse is allowed per world');
  const blocked = validateSurfaceStructureSite(world, 'warehouse', { x: first!.x, y: first!.y }, built, { ...emptyCargo(), iron: 3, silver: 1 }, 1000);
  assert.deepEqual(blocked, { valid: false, reason: 'LIMIT' });
  const stock = { ...emptyCargo(), gold: 2.5 };
  const snapshot = snapshotMapState(undefined, world, WORLD.spawnX, WORLD.spawnY, 0, [], undefined, built, stock);
  assert.deepEqual(snapshot.warehouse, stock);
  assert.deepEqual(restoreMapState(snapshot, 'cryo-shelf', world.seed).warehouse, stock);
});
test('globe surface build placement wraps across the seam and validates cost, footprint, and limits', () => {
  const world = new TileWorld(816, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    cargo = { copper: 12, iron: 8, silver: 3, gold: 3, diamond: 0 }, credits = 5000,
    halfLoop = world.widthTiles * WORLD.tile,
    seamPoint = surfaceArcPoint(world, -WORLD.tile / 2),
    seamArc = surfaceArcCoordinate(world, seamPoint.x, seamPoint.y);
  assert.ok(seamPoint.y === 0 || seamPoint.y === world.farSurfaceY, 'a snapped anchor always resolves to one of the two globe crusts');
  assert.ok(Math.min(seamArc, 2 * halfLoop - seamArc) <= WORLD.tile, 'longitude snaps within one tile of the seam');
  const nearSeam: UndergroundStructure = { id: 'habitat:seam', kind: 'habitat', x: WORLD.tile / 2, y: 0 };
  assert.deepEqual(validateSurfaceStructureSite(world, 'habitat', { x: halfLoop - WORLD.tile / 2, y: world.farSurfaceY }, [nearSeam], cargo, credits),
    { valid: false, reason: 'OCCUPIED' }, 'footprints overlap across the wrapped longitude seam');
  assert.deepEqual(validateSurfaceStructureSite(world, 'habitat', { x: halfLoop / 2, y: 0 }, [nearSeam], cargo, credits), { valid: true });
  assert.deepEqual(validateSurfaceStructureSite(world, 'habitat', { x: 980, y: 0 }, [
    { id: 'station:service', kind: 'platform', x: 980, y: 0 },
  ], cargo, credits), { valid: false, reason: 'OCCUPIED' }, 'built-in station footprints block a colony building without consuming a player structure slot');
  assert.deepEqual(validateSurfaceStructureSite(world, 'trade-post', { x: 1500, y: 0 }, [], cargo, 0),
    { valid: false, reason: 'NEED MATERIALS / CREDITS' }, 'a preview can explain unaffordable credits before purchase');
  const threeHabitats: UndergroundStructure[] = [0, 1, 2].map((i) => ({ id: `habitat:${i}`, kind: 'habitat', x: 800 + i * 500, y: 0 }));
  assert.deepEqual(validateSurfaceStructureSite(world, 'habitat', { x: 2600, y: 0 }, threeHabitats, cargo, credits),
    { valid: false, reason: 'LIMIT' }, 'surface placement repeats the per-planet habitat cap at confirmation');
});
test('surface walls and gates can form modular barrier runs and stay within per-planet limits', () => {
  const world = new TileWorld(817, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    cargo = { ...emptyCargo(), copper: 12, iron: 8, silver: 3, gold: 3 }, credits = 5000,
    first = findSurfaceBarrierSite(world, WORLD.spawnX, WORLD.spawnY, [], 'wall');
  assert.ok(first, 'a clear crust segment can be found near the miner');
  const wall: UndergroundStructure = { id: `wall:${first!.x}:0`, kind: 'wall', ...first!, integrity: 2 },
    nextSite = surfaceArcPoint(world, surfaceArcCoordinate(world, wall.x, wall.y) + WORLD.tile);
  assert.deepEqual(validateSurfaceStructureSite(world, 'wall', nextSite, [wall], cargo, credits), { valid: true },
    'wall segments can touch to form a continuous barrier');
  assert.deepEqual(validateSurfaceStructureSite(world, 'habitat', first!, [wall], cargo, credits), { valid: false, reason: 'OCCUPIED' },
    'normal buildings cannot overlap a barrier');
  const fullWalls: UndergroundStructure[] = Array.from({ length: UNDERGROUND_BUILDING.wall.maxPerMap }, (_, i) => ({
    id: `wall:${i}`, kind: 'wall', x: 300 + i * 60, y: 0,
  }));
  assert.deepEqual(validateSurfaceStructureSite(world, 'wall', { x: 2000, y: 0 }, fullWalls, cargo, credits), { valid: false, reason: 'LIMIT' });
  assert.ok(findSurfaceBarrierSite(world, WORLD.spawnX, WORLD.spawnY, [], 'gate'), 'a gate can be placed as a wider barrier segment');
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
  world.break(WORLD.homeColumn, Math.round(CORE_WORLD_Y / WORLD.tile));
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
test('charted planet supports an uninterrupted core crossing and far-side docking with local-up controls', () => {
  const world = new TileWorld(7300, [], [], 'cryo-shelf', PLANET_CHART), progress = new Progress(), pod = new PlayerPod(world, progress),
    coreY = world.coreWorldY, farY = world.farSurfaceY, dt = 1 / 120;
  clearPlanetBore(world);
  pod.x = WORLD.spawnX;
  pod.y = WORLD.spawnY;
  pod.docked = false;
  let crossedCore = false, droppingDeck = false, frames = 0;
  while (!pod.docked && frames < 10000) {
    if (crossedCore && pod.vy === 0 && pod.y > farY + 100 && pod.y < farY + 200) droppingDeck = true;
    const rotation = planetCameraFrameAngle(pod.x / WORLD.tile, pod.y / WORLD.tile, PLANET_CHART) ?? 0,
      input = !crossedCore
        ? pod.y < coreY ? { ...idle, down: true } : { ...idle, up: true }
        : droppingDeck && pod.y > farY + 100 ? { ...idle, down: true }
          : pod.y < farY + 120 && !droppingDeck ? { ...idle, up: true } : idle;
    pod.update(dt, input, (damage) => { progress.hull -= damage; }, rotation);
    crossedCore ||= pod.y > coreY;
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0, `no terrain overlap at ${pod.y.toFixed(1)} px`);
    frames++;
  }
  assert.equal(crossedCore, true, 'the miner passes through the planet center');
  assert.equal(pod.docked, true, `far surface catches the miner within ${frames} frames (y=${pod.y.toFixed(1)}, vy=${pod.vy.toFixed(1)}, far=${farY}, hull=${progress.hull})`);
  assert.ok(pod.y > coreY && atSurface(pod.x, pod.y, PLANET_CHART), 'the miner docks on the opposite crust');
  assert.equal(progress.hull, 100, 'the globe traversal does not cause collision damage');
});
test('core crossing requires a clear passage through the center of gravity', () => {
  const centerX = WORLD.homeColumn, coreRow = Math.round(CORE_WORLD_Y / WORLD.tile);
  const blockedWorld = new TileWorld(7301, [], [], 'cryo-shelf'), blocked = new PlayerPod(blockedWorld, new Progress());
  blockedWorld.get(centerX, coreRow).type = 'hard';
  blocked.x = centerX * WORLD.tile + WORLD.tile / 2;
  blocked.y = CORE_WORLD_Y - 52;
  blocked.vy = 230;
  blocked.docked = false;
  sim(blocked, 0.4, idle);
  assert.ok(blocked.y < CORE_WORLD_Y, 'the blocked approach remains on the original hemisphere');
  assert.equal(blockedWorld.gravitySign(blocked.y), 1, 'gravity does not reverse before the miner passes through the core');

  const openWorld = new TileWorld(7302, [], [], 'cryo-shelf'), open = new PlayerPod(openWorld, new Progress());
  for (let y = coreRow - CORE.passageRadius; y <= coreRow + CORE.passageRadius; y++) {
    const halfWidth = Math.floor(Math.sqrt(CORE.passageRadius ** 2 - (y - coreRow) ** 2));
    for (let x = centerX - halfWidth; x <= centerX + halfWidth; x++) openWorld.break(x, y);
  }
  open.x = centerX * WORLD.tile + WORLD.tile / 2;
  open.y = CORE_WORLD_Y - 52;
  open.vy = 230;
  open.docked = false;
  sim(open, 0.5, idle);
  assert.ok(open.y > CORE_WORLD_Y, 'an unobstructed route lets the miner pass the center');
  assert.equal(openWorld.gravitySign(open.y), -1, 'gravity reverses after the core crossing');
});
test('core hemisphere state commits only after the miner clears the passage', () => {
  const clearance = CORE_CROSSING_CLEARANCE;
  assert.equal(farHemisphereAfterCoreExit(false, CORE_WORLD_Y + clearance - 1), false, 'a partial crossing does not fire the hemisphere event');
  assert.equal(farHemisphereAfterCoreExit(false, CORE_WORLD_Y + clearance), true, 'the far-side event fires after clearing the core');
  assert.equal(farHemisphereAfterCoreExit(true, CORE_WORLD_Y - clearance + 1), true, 'a return that hovers inside the center band does not reverse repeatedly');
  assert.equal(farHemisphereAfterCoreExit(true, CORE_WORLD_Y - clearance), false, 'the home-side event fires after clearing the core in reverse');
});
test('eased planet camera preserves momentum through the core before outward thrust', () => {
  const world = new TileWorld(7304, [], [], 'cryo-shelf', PLANET_CHART), progress = new Progress(), pod = new PlayerPod(world, progress),
    dt = 1 / 120, maxCameraStep = Math.PI * dt / 1.15;
  clearPlanetBore(world);
  pod.x = WORLD.spawnX;
  pod.y = WORLD.spawnY;
  pod.docked = false;
  let rotation = planetCameraFrameAngle(pod.x / WORLD.tile, pod.y / WORLD.tile, PLANET_CHART) ?? 0,
    crossed = false, cleared = false;
  for (let frame = 0; frame < 4000 && !cleared; frame++) {
    const target = planetCameraFrameAngle(pod.x / WORLD.tile, pod.y / WORLD.tile, PLANET_CHART);
    if (target !== undefined) {
      const delta = cameraAngleDelta(rotation, target);
      rotation += Math.max(-maxCameraStep, Math.min(maxCameraStep, delta));
    }
    const input = !crossed
      ? { ...idle, down: true }
      : { ...idle };
    pod.update(dt, input, (damage) => { progress.hull -= damage; }, rotation);
    crossed ||= pod.y >= world.coreWorldY;
    cleared = farHemisphereAfterCoreExit(false, pod.y, PLANET_CHART);
    assert.equal(pod.overlaps(pod.x, pod.y).length, 0, `no terrain overlap during core transit at ${pod.y.toFixed(1)} px`);
  }
  assert.equal(crossed, true, 'the miner passes through the core center');
  assert.equal(cleared, true, 'preserved momentum carries it beyond the core passage');
  assert.ok(pod.vy > 0, 'the miner exits with outward momentum before the player begins climbing');
  const beforeThrust = pod.y;
  pod.update(0.5, { ...idle, up: true }, () => {}, rotation);
  assert.ok(pod.y > beforeThrust, 'W-style outward thrust climbs once the core turn has cleared');
  assert.equal(progress.hull, 100, 'the eased core turn does not cause collision damage');
});
test('left and right remain screen-relative while the camera flips around the miner', () => {
  const world = new TileWorld(7303, [], [], 'cryo-shelf'), pod = new PlayerPod(world, new Progress());
  pod.x = WORLD.spawnX;
  pod.y = CORE_WORLD_Y + 200;
  pod.docked = false;
  const before = pod.x;
  pod.update(0.05, { ...idle, right: true }, () => {}, Math.PI);
  assert.ok(pod.x < before, 'screen-right maps to world-left after a half-turn camera flip');
  const cameraSpaceDeltaX = Math.cos(Math.PI) * (pod.x - before);
  assert.ok(cameraSpaceDeltaX > 0, 'the miner still travels right on screen when right is pressed');
});
test('each planetary core has one deterministic, drillable record with a one-time claim', () => {
  const maps = ['mars-frontier', 'cryo-shelf', 'hull-graveyard', 'prism-fault', 'cinder-vale', 'vesper-9'] as const;
  const x = WORLD.homeColumn, row = Math.round(CORE_WORLD_Y / WORLD.tile);
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
  assert.equal(coreSurveyComplete(progress.milestones), true, 'all records complete the planetary ledger');
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
test('mouse aim remains directional through empty tunnels so the drill can hit swimmers', () => {
  const world = new TileWorld(992), swimmer = new RockSwimmer(992, 'cryo-shelf');
  for (let x = 24; x <= 27; x++) world.break(x, 12);
  swimmer.active = { x: 1040, y: 500, vx: 0, vy: 0, life: 10, phase: 0, health: 3, drillCooldown: 0, hitFlash: 0 };
  const aim = pointerDrillDirection(world, 980, 500, 1060, 500);
  assert.ok(aim && aim.x > 0.99 && Math.abs(aim.y) < 0.01, 'pointer direction should not depend on a rock target');
  assert.equal(aim && swimmer.hitByDrill(world, 980, 500, aim.x, aim.y, 80), false, 'a clear mouse-directed strike damages the swimmer');
  assert.equal(swimmer.active?.health, 2);
});
test('drill can clear the blocking tile under the miner while protecting its other overlap cells', () => {
  const world = new TileWorld(1092), progress = new Progress(), mining = new MiningSystem(world, progress);
  const target = world.get(24, 20), neighboringHullTile = world.get(25, 20);
  target.type = 'rock';
  neighboringHullTile.type = 'rock';
  const protectedTiles = drillProtection([target, neighboringHullTile], target);
  mining.update(1, target, () => {}, 'vertical', protectedTiles);
  assert.equal(world.get(target.x, target.y).type, 'empty', 'the explicitly aimed obstruction clears');
  assert.equal(world.get(neighboringHullTile.x, neighboringHullTile.y).type, 'rock', 'un-aimed cells under the hull remain protected');
});
test('drill upgrades extend mouse mining reach beyond the adjacent starter bit', () => {
  const world = new TileWorld(423), x = WORLD.homeColumn * WORLD.tile + WORLD.tile / 2, y = 10 * WORLD.tile + WORLD.tile / 2;
  world.break(WORLD.homeColumn, 10);
  world.break(WORLD.homeColumn + 1, 10);
  const target = world.get(WORLD.homeColumn + 2, 10);
  assert.notEqual(target.type, 'empty');
  assert.equal(aimedDrillTarget(world, x, y, x + WORLD.tile * 2, y, WORLD.tile * drillReachTiles(1)), undefined,
    'the stock drill cannot reach through a full empty tile');
  assert.equal(aimedDrillTarget(world, x, y, x + WORLD.tile * 2, y, WORLD.tile * drillReachTiles(2)), target,
    'the first upgraded reach tier can cut the next tile along a clear tunnel');
  const reach = [1, 2, 3, 4, 5, 6, 10, 100].map((level) => drillReachTiles(level));
  assert.ok(reach.every((value, index) => index === 0 || value > reach[index - 1]));
  assert.ok(reach[5] - reach[4] < reach[4] - reach[3], 'reach growth tapers after the first five tiers');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 12].map(drillVisualTier), [1, 2, 3, 4, 5, 5, 5],
    'earned drill modules progress through five distinct visual stages and keep the laser head at higher levels');
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
test('planet scenery has deterministic world-anchored landmarks with distinct silhouette families', () => {
  const cryo = new TileWorld(552, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    cryoAgain = new TileWorld(552, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    cryoFeatures = surfaceLandmarks(cryo, 'cryo-shelf');
  assert.equal(cryoFeatures.length, 12);
  assert.deepEqual(surfaceLandmarks(cryoAgain, 'cryo-shelf'), cryoFeatures, 'the same world seed keeps every surface landmark fixed');
  assert.ok(cryoFeatures.every(({ x, y }) => x >= 0 && x < cryo.widthTiles * WORLD.tile && (y === 0 || y === cryo.farSurfaceY)),
    'landmarks stay on one of the two globe surfaces and inside saved world bounds');
  assert.ok(PLANET_SURFACE_LANDMARKS['cryo-shelf'].includes('ice-ridge'));
  assert.ok(PLANET_SURFACE_LANDMARKS['hull-graveyard'].includes('wreck-arc'));
  assert.ok(PLANET_SURFACE_LANDMARKS['prism-fault'].includes('crystal-spires'));
  assert.ok(PLANET_SURFACE_LANDMARKS['cinder-vale'].includes('caldera'));
  assert.ok(PLANET_SURFACE_LANDMARKS['vesper-9'].includes('lantern-grove'));
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
test('compact starter globe scales the whole ship route across both hemispheres', () => {
  const compact = new TileWorld(2002, [], [], 'cryo-shelf', STARTER_PLANET_CHART), coreRow = STARTER_PLANET_CHART.radiusRows;
  const expectedRows = [5, 17, 33, 56];
  for (const [index, fragment] of ROUTE_FRAGMENTS.entries()) {
    const row = expectedRows[index]!;
    assert.equal(compact.get(fragment.x, row).fragmentId, fragment.id, `${fragment.id} remains a guaranteed cuttable signal`);
    assert.equal(compact.get(fragment.x - fragment.chamber.halfWidth, row).landmarkId, fragment.id,
      `${fragment.id} keeps its authored chamber around the scaled signal`);
    assert.ok(row < coreRow || row > coreRow, 'each signal is placed on one of the two mineable hemispheres');
  }
  assert.ok(expectedRows[0]! < expectedRows[1]! && expectedRows[1]! < expectedRows[2]! && expectedRows[2]! < coreRow && coreRow < expectedRows[3]!,
    'the shorter journey still teaches deeper mining, core crossing, and the far-side beacon');
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
  const version19Save = { ...save, version: 19 as const, planetChart: PLANET_CHART, maps: { 'cryo-shelf': { ...save.maps['cryo-shelf'], structures: [] } }, escapeSuit: false, pilotEscaping: false };
  const currentSave = { ...version19Save, version: 24 as const, grappleOwned: false, maps: { 'cryo-shelf': { ...version19Save.maps['cryo-shelf'], warehouse: emptyCargo() } } };
  assert.equal(validateSave(currentSave), true);
  assert.equal(migrateSave({ ...version19Save, version: 18, planetChart: undefined })?.version, 24, 'version-18 campaigns migrate with preserved planet geometry');
  assert.equal(validateSave({ ...currentSave, hull: 0, pilotEscaping: true }), true, 'a crashed miner can be saved while its pilot is alive in the escape suit');
  assert.equal(validateSave({ ...currentSave, hull: 0 }), false, 'zero hull without an active escape is rejected');
  assert.equal(validateSave({ ...currentSave, milestones: ['core-cryo'] }), true, 'escape support fits the version-20 save shape');
  assert.equal(validateSave({ ...currentSave, milestones: ['core-unknown'] }), false, 'unrecognized core-record IDs are rejected');
  const migratedV14 = migrateSave(save);
  assert.deepEqual(migratedV14?.maps['cryo-shelf']?.structures, [], 'version-14 campaigns receive an empty construction list');
  assert.equal(migrateSave({ ...version19Save, version: 16, escapeSuit: undefined, pilotEscaping: undefined })?.version, 24, 'version-16 campaigns migrate through the chart schema');
  assert.deepEqual(migrateSave(currentSave)?.milestones, NAVIGATION_HASHES.map((hash) => hash.id));
  const oldUnupgraded = migrateSave({ ...version19Save, version: 13, levels: { ...version19Save.levels, grapple: undefined } });
  assert.equal(oldUnupgraded?.levels.grapple, 1, 'v13 campaigns gain the baseline grapple level');
  assert.equal(oldUnupgraded?.grappleOwned, false, 'legacy free starter grapple is locked after migration');
  assert.equal(migrateSave({ ...version19Save, levels: { ...version19Save.levels, grapple: 2 } })?.grappleOwned, true,
    'a grapple purchased in the old upgrade track remains installed');
  const purchasedSave = migrateSave({ ...version19Save, levels: { ...version19Save.levels, grapple: 2 } });
  assert.ok(purchasedSave);
  const restoredPurchase = new Progress();
  new SaveManager().restore(restoredPurchase, purchasedSave);
  assert.equal(restoredPurchase.grappleOwned, true, 'migrated paid ownership is restored into progression state');
  const { ownedProfiles: _profiles, selectedProfile: _profile, ...version9 } = save;
  assert.deepEqual(migrateSave({ ...version9, version: 9 })?.milestones, NAVIGATION_HASHES.map((hash) => hash.id), 'v9 migration preserves hash records');
});
test('campaign archive reports per-region depth and collectibles without fabricating visits', () => {
  const records = campaignMapRecords(
    { 'cryo-shelf': 327.9, 'hull-graveyard': 0 },
    ['fragment-1', 'fragment-4'],
    ['hash-hull'],
  );
  assert.equal(records.length, 6);
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
  const cinder = records.find((record) => record.id === 'cinder-vale')!;
  assert.equal(cinder.visited, false);
  assert.equal(cinder.coreName, 'Ember Heart');
  const vesper = records.find((record) => record.id === 'vesper-9')!;
  assert.equal(vesper.visited, false);
  assert.equal(vesper.coreName, 'Return Bloom');
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
  pod.update(1 / 60, idle, () => {});
  assert.equal(pod.grappleAnchor, undefined, 'a new miner has not bought the safety grapple');
  progress.money = 170;
  assert.equal(progress.buy('grapple'), true, 'the first upgrade installs the hook');
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
test('automatic grapple waits for a damaging landing inside its short lookahead', () => {
  const world = new TileWorld(193), pod = new PlayerPod(world, new Progress());
  for (let y = 1; y <= 80; y++) world.break(WORLD.homeColumn, y);
  world.break(WORLD.homeColumn - 1, 4);
  world.chunks.clear();
  pod.docked = false;
  pod.x = WORLD.homeColumn * WORLD.tile + WORLD.tile / 2;
  pod.y = 6 * WORLD.tile + 10;
  pod.vy = 250;
  assert.ok(findGrappleAnchor(world, pod.x, pod.y, 100), 'an anchor is available beside the open shaft');
  pod.update(1 / 60, idle, () => {});
  assert.equal(pod.grappleAnchor, undefined, 'an open shaft has no predicted impact within 1.5 seconds');

  const nearFloor = new TileWorld(194), nearFloorPod = new PlayerPod(nearFloor, new Progress());
  for (let y = 1; y < 34; y++) nearFloor.break(WORLD.homeColumn, y);
  nearFloor.break(WORLD.homeColumn - 1, 4);
  nearFloor.chunks.clear();
  nearFloorPod.docked = false;
  nearFloorPod.x = WORLD.homeColumn * WORLD.tile + WORLD.tile / 2;
  nearFloorPod.y = 6 * WORLD.tile + 10;
  nearFloorPod.vy = 250;
  nearFloorPod.update(1 / 60, idle, () => {});
  assert.equal(nearFloorPod.grappleAnchor, undefined, 'a damaging landing beyond the 1.5-second window does not trigger');
});
test('automatic grapple ignores safe landings and mirrors its hook under reversed gravity', () => {
  const safeWorld = new TileWorld(195), safePod = new PlayerPod(safeWorld, new Progress());
  for (let y = 1; y <= 6; y++) safeWorld.break(WORLD.homeColumn, y);
  safeWorld.break(WORLD.homeColumn - 1, 4);
  safeWorld.chunks.clear();
  safePod.docked = false;
  safePod.x = WORLD.homeColumn * WORLD.tile + WORLD.tile / 2;
  safePod.y = 6 * WORLD.tile + 10;
  safePod.vy = 205;
  let safeDamage = 0;
  for (let i = 0; i < 20; i++) safePod.update(1 / 60, idle, (amount) => { safeDamage += amount; });
  assert.equal(safePod.grappleAnchor, undefined);
  assert.equal(safeDamage, 0);

  const farWorld = new TileWorld(196), farPod = new PlayerPod(farWorld, new Progress());
  const xTile = WORLD.homeColumn, startRow = FAR_SURFACE_ROW - 6, floorRow = startRow - 5;
  for (let row = floorRow + 1; row < FAR_SURFACE_ROW; row++) farWorld.break(xTile, row);
  farWorld.break(xTile - 1, startRow + 1);
  farWorld.break(xTile, startRow + 2);
  farWorld.chunks.clear();
  farPod.docked = false;
  farPod.x = xTile * WORLD.tile + WORLD.tile / 2;
  farPod.y = startRow * WORLD.tile + WORLD.tile / 2;
  farPod.vy = -250;
  farPod.progress.money = 170;
  assert.equal(farPod.progress.buy('grapple'), true);
  assert.equal(farWorld.gravitySign(farPod.y), -1);
  assert.ok(findGrappleAnchor(farWorld, farPod.x, farPod.y, 120, -1));
  farPod.update(1 / 60, idle, () => {});
  assert.ok(farPod.grappleAnchor, 'predicted outward impact triggers the safety hook');
  assert.ok(farPod.grappleAnchor!.y > farPod.y, 'the far-side hook anchor attaches outward from the core');
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
test('the hidden Vesper-9 chapter opens after the five-world ledger and completes the new six-world core progression', () => {
  const previousWorlds = VESPER_CHAPTER_CORE_IDS;
  assert.equal(previousWorlds.length, 5);
  assert.equal(vesperChapterUnlocked([]), false);
  assert.equal(vesperChapterUnlocked(previousWorlds.slice(0, -1)), false);
  assert.equal(vesperChapterUnlocked(previousWorlds), true);
  assert.equal(coreSurveyComplete(previousWorlds), false, 'the new chapter still has its own core record');
  assert.equal(coreSurveyComplete([...previousWorlds, 'core-vesper']), true);
  const p = new Progress();
  p.shipComponents = Object.keys(SHIP_COMPONENTS);
  p.milestones = [...previousWorlds];
  const next = campaignObjective(p, 'cinder-vale');
  assert.match(next.title, /NEW CHAPTER CHARTED · VESPER-9/);
  assert.equal(upgradeGateMet(16, { shipComplete: true, coreRelics: p.milestones }), false,
    'the highest upgrade band awaits the new chapter core');
  p.milestones.push('core-vesper');
  assert.equal(upgradeGateMet(16, { shipComplete: true, coreRelics: p.milestones }), true);
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
    assert.equal(ROUTE_SURVEY_REWARDS[fragment.id], SHIP_COMPONENTS[ROUTE_SHIP_COMPONENTS[fragment.id]].cost,
      `${fragment.landmark} claim matches its corresponding ship component`);
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
test('Mars thermal seams, Hull salvage, and Cinder ember geodes are deterministic regional finds', () => {
  for (const mapId of ['mars-frontier', 'hull-graveyard', 'cinder-vale'] as const) {
    const world = new TileWorld(615, [], [], mapId);
    const replay = new TileWorld(615, [], [], mapId);
    const otherMap = mapId === 'mars-frontier' ? 'hull-graveyard' : 'mars-frontier';
    const other = new TileWorld(615, [], [], otherMap);
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
test('planet ore pickup uses visible curved distance near the core and surface', () => {
  const world = new TileWorld(15, [], [], 'cryo-shelf', PLANET_CHART), tile = WORLD.tile,
    nearCoreY = (PLANET_CHART.radiusRows - 0.5) * tile,
    surfaceY = 0.5 * tile;
  assert.equal(podWithinPickupReach(234.5 * tile, nearCoreY, 236.5 * tile, nearCoreY, world), true,
    'many chart columns collapse to a close physical distance near the center');
  assert.equal(podWithinPickupReach(234.5 * tile, surfaceY, 236.5 * tile, surfaceY, world), false,
    'the same chart span remains far apart at the surface');
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
test('milestone gates unlock successive upgrade tiers, with unlimited levels after the final core ledger', () => {
  const p = new Progress();
  p.money = 1_000_000;
  assert.equal(upgradeGateForLevel(5), undefined);
  assert.equal(upgradeGateMet(5, { shipComplete: false, coreRelics: [] }), true);
  assert.equal(upgradeGateMet(6, { shipComplete: false, coreRelics: [] }), false);
  assert.equal(upgradeGateMet(6, { shipComplete: true, coreRelics: [] }), true);
  assert.equal(upgradeGateMet(11, { shipComplete: true, coreRelics: ['core-mars'] }), false);
  assert.equal(upgradeGateMet(11, { shipComplete: true, coreRelics: ['core-mars', 'core-cryo'] }), true);
  assert.equal(upgradeGateMet(16, { shipComplete: true, coreRelics: CORE_RELICS.map((r) => r.id).slice(0, -1) }), false);
  assert.equal(upgradeGateMet(16, { shipComplete: true, coreRelics: CORE_RELICS.map((r) => r.id) }), true);
  assert.equal(upgradeGateMet(200, { shipComplete: true, coreRelics: CORE_RELICS.map((r) => r.id) }), true, 'final milestone unlock keeps the tracks uncapped');
  for (const k of UPGRADE_KEYS) for (let level = 1; level < 5; level++) assert.ok(p.buy(k));
  assert.equal(p.buy('drill'), false, 'the sixth level requires the Faraday');
  for (const key of Object.keys(SHIP_COMPONENTS) as Array<keyof typeof SHIP_COMPONENTS>) p.shipComponents.push(key);
  for (const k of UPGRADE_KEYS) {
    for (let level = 5; level < 10; level++) {
      const before = p.max(k),
        money = p.money,
        cost = p.cost(k);
      assert.ok(p.buy(k));
      assert.ok(p.max(k) > before);
      assert.equal(p.money, money - cost);
    }
    assert.equal(p.levels[k], 10);
    assert.ok(Number.isFinite(p.max(k)));
    assert.ok(p.cost(k) > 0);
  }
  assert.equal(p.fuel, p.max('fuel'));
  assert.equal(p.hull, p.max('hull'));
  p.milestones.push('first-core-sample', 'basalt-vein', 'hash-cryo', 'core-mars');
  assert.equal(p.buy('drill'), false, 'level eleven also requires two recovered planet cores');
  p.milestones.push('core-mars', 'core-cryo');
  assert.equal(p.buy('drill'), true);
  while (p.levels.drill < 15) assert.equal(p.buy('drill'), true);
  assert.equal(p.buy('drill'), false, 'level sixteen requires the complete core ledger');
  p.milestones.push(...CORE_RELICS.map((r) => r.id));
  for (let level = 16; level < 22; level++) assert.equal(p.buy('drill'), true, `unlimited drill progression at level ${level + 1}`);
  assert.equal(p.levels.drill, 21);
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
  p.shipComponents = Object.keys(SHIP_COMPONENTS);
  assert.equal(p.buy('scanner'), true, 'scanner progression continues after full map width');
  assert.ok(p.max('scanner') > WORLD.width, 'extra scanner levels extend vertical survey depth');
  fullWidthAndShallower.reveal(980, 400, 0, p.max('scanner'));
  assert.ok(fullWidthAndShallower.discovered.has('24,55'), 'post-five scanner tier reveals a deeper vertical band');
});
test('rock swimmers arrive below the opening, phase through terrain, and deal one avoidable hull hit', () => {
  const swimmer = new RockSwimmer(991, 'cryo-shelf');
  for (let i = 0; i < 30; i++) assert.equal(swimmer.update(1, 120, 980, 500), false);
  assert.equal(swimmer.active, undefined, 'no swimmer appears in the opening depth band');
  for (let i = 0; i < 40; i++) assert.equal(swimmer.update(1, 260, 980, 500), false);
  assert.equal(swimmer.active, undefined, 'new pilots get a deeper calm stretch before the first encounter');
  for (let i = 0; i < 18; i++) assert.equal(swimmer.update(1, 420, 980, 500), false);
  assert.ok(swimmer.active, 'a swimmer crosses the scanner view after descending');
  const startX = swimmer.active!.x;
  swimmer.update(1, 420, 980, 500);
  assert.notEqual(swimmer.active!.x, startX, 'the swimmer glides through solid geology without drilling a tunnel');
  swimmer.active!.x = 980;
  swimmer.active!.y = 500;
  assert.equal(swimmer.update(1 / 60, 420, 980, 500), true, 'contact reports one hit so the scene can apply existing hull damage');
  assert.equal(swimmer.active, undefined, 'the creature withdraws after contact');
  for (let i = 0; i < 3; i++) assert.equal(swimmer.update(1, 420, 980, 500), false, 'the warning/cooldown prevents repeated hits');
  swimmer.active = { x: 1040, y: 500, vx: 0, vy: 0, life: 10, phase: 0, health: ROCK_SWIMMER.drillHitsToDefeat, drillCooldown: 0, hitFlash: 0 };
  const turret: UndergroundStructure = { id: 'turret:1100:500', kind: 'turret', x: 1100, y: 500 };
  let fired = false;
  assert.equal(swimmer.update(1 / 60, 420, 980, 500, [turret], () => { fired = true; }), false);
  assert.equal(fired, true, 'a sentry intercepts a swimmer in range before it hits the pod');
  assert.equal(swimmer.active, undefined);
  assert.ok((turret.reload ?? 0) > 0, 'turret reload prevents continuous firing');

  const surfaceSwimmer = new RockSwimmer(404, 'cryo-shelf');
  surfaceSwimmer.active = { x: 1040, y: 350, vx: 0, vy: 0, life: 10, phase: 0, health: ROCK_SWIMMER.drillHitsToDefeat, drillCooldown: 0, hitFlash: 0 };
  const surfaceTurret: UndergroundStructure = { id: 'turret:1120:0', kind: 'turret', x: 1120, y: 0 };
  let surfaceShot = false;
  surfaceSwimmer.update(1 / 60, 420, 980, 350, [surfaceTurret], () => { surfaceShot = true; });
  assert.equal(surfaceShot, true, 'a colony defense pylon protects the nearby surface approach from swimmers');
  assert.equal(surfaceSwimmer.active, undefined);
});
test('surface raids telegraph, can be drilled or intercepted, damage only optional colony pieces, and can be rebuilt', () => {
  const world = new TileWorld(8801, [], [], 'cryo-shelf', STARTER_PLANET_CHART);
  const habitat: UndergroundStructure = { id: 'habitat:1120:0', kind: 'habitat', x: 1120, y: 0, integrity: 2 };
  const structures = [habitat], raid = new SurfaceRaid(8801, 'cryo-shelf');
  assert.equal(raid.update(70, false, world, structures), undefined, 'raids pause while the miner is below the surface');
  let warning: ReturnType<SurfaceRaid['update']> = undefined;
  for (let i = 0; i < SURFACE_RAID.firstWarningSeconds + 1; i++) {
    const event = raid.update(1, true, world, structures);
    if (event?.type === 'warning') warning = event;
  }
  assert.equal(warning?.type, 'warning', 'the attack begins with a visible target telegraph');
  assert.equal(habitat.integrity, 2, 'the target remains undamaged throughout its warning');
  let result: ReturnType<SurfaceRaid['update']> = undefined;
  for (let i = 0; i < SURFACE_RAID.telegraphSeconds + 1; i++) {
    const event = raid.update(1, true, world, structures);
    if (event) result = event;
  }
  assert.equal(result?.type, 'damaged');
  assert.equal(habitat.integrity, 1, 'a missed defense leaves a repairable damaged state');
  assert.equal(repairSurfaceStructure(habitat, SURFACE_RAID.repairCredits - 1), undefined, 'repairs cannot spend beyond available credits');
  assert.deepEqual(repairSurfaceStructure(habitat, SURFACE_RAID.repairCredits), { credits: 0, integrity: 2 }, 'a damaged habitat can be restored for the posted credit cost');
  assert.equal(repairSurfaceStructure({ ...habitat, integrity: 2 }, 1000), undefined, 'a full-integrity module cannot be charged for a repair');
  for (let i = 0; i < SURFACE_RAID.repeatWarningSeconds + SURFACE_RAID.telegraphSeconds; i++) {
    const event = raid.update(1, true, world, structures);
    if (event) result = event;
  }
  assert.equal(result?.type, 'destroyed', 'a second unopposed strike removes the optional habitat');
  assert.deepEqual(structures, [], 'a destroyed structure is removed once and its site can be rebuilt');

  const drillRaid = new SurfaceRaid(8802, 'cryo-shelf');
  drillRaid.active = { x: 1010, y: -26, targetId: 'habitat:1120:0', health: 2, timer: 5, phase: 0, hitFlash: 0, drillCooldown: 0 };
  assert.equal(drillRaid.hitByDrill(new TileWorld(3), 980, 0, 30, -26, 60), false, 'one drill hit wounds but does not yet repel the raider');
  drillRaid.active!.drillCooldown = 0;
  assert.equal(drillRaid.hitByDrill(new TileWorld(3), 980, 0, 30, -26, 60), true, 'a second clear drill hit drives it off before it damages the habitat');

  const defended = new SurfaceRaid(8803, 'cryo-shelf');
  habitat.integrity = 2;
  defended.active = { x: 1050, y: -26, targetId: habitat.id, health: 2, timer: 5, phase: 0, hitFlash: 0, drillCooldown: 0 };
  const pylon: UndergroundStructure = { id: 'turret:1000:0', kind: 'turret', x: 1000, y: 0, integrity: 2 };
  let intercepted = false;
  assert.equal(defended.update(1 / 60, true, world, [habitat, pylon], () => { intercepted = true; })?.type, 'intercepted');
  assert.equal(intercepted, true, 'a nearby defense pylon shoots a raider attacking a neighboring habitat');
  assert.equal(habitat.integrity, 2, 'an intercept keeps the targeted module safe');

  const tradePost: UndergroundStructure = { id: 'trade-post:1410:0', kind: 'trade-post', x: 1410, y: 0, integrity: 2 };
  const protectedRaid = new SurfaceRaid(8804, 'cryo-shelf');
  assert.equal(protectedRaid.update(100, true, world, [tradePost]), undefined,
    'the exchange is a progression anchor and is not selected for raids');
  assert.equal(tradePost.integrity, 2);
});
test('surface walls hold raiders and an approached gate opens a route for the miner', () => {
  const world = new TileWorld(8810, [], [], 'cryo-shelf', STARTER_PLANET_CHART),
    habitat: UndergroundStructure = { id: 'habitat:1120:0', kind: 'habitat', x: 1120, y: 0, integrity: 2 },
    wall: UndergroundStructure = { id: 'wall:1050:0', kind: 'wall', x: 1050, y: 0, integrity: 2 },
    raid = new SurfaceRaid(8810, 'cryo-shelf');
  raid.active = { x: 1010, y: -26, targetId: habitat.id, health: 2, timer: 1, phase: 0, hitFlash: 0, drillCooldown: 0 };
  let event: ReturnType<SurfaceRaid['update']>;
  for (let i = 0; i < 30 && !event; i++) event = raid.update(0.2, true, world, [habitat, wall]);
  assert.equal(event?.type, 'damaged', 'a raider eventually attacks the wall it reaches');
  assert.equal(wall.integrity, 1, 'the wall loses integrity before the colony behind it is struck');
  assert.equal(habitat.integrity, 2, 'the wall keeps its target safe during the breach');

  const gate: UndergroundStructure = { id: 'gate:1050:0', kind: 'gate', x: 1050, y: 0, integrity: 2 },
    passingRaid = new SurfaceRaid(8811, 'cryo-shelf');
  passingRaid.active = { x: 1010, y: -26, targetId: habitat.id, health: 2, timer: 5, phase: 0, hitFlash: 0, drillCooldown: 0 };
  passingRaid.update(0.8, true, world, [habitat, gate], () => {}, { x: 1050, y: 0 });
  assert.ok(passingRaid.active && passingRaid.active.x > 1010, 'a nearby player opens the gate, allowing the raider to pass through');
});
test('drill can drive off a rock swimmer with three clear beam hits', () => {
  const world = new TileWorld(992), swimmer = new RockSwimmer(992, 'cryo-shelf');
  for (let x = 24; x <= 27; x++) world.break(x, 12);
  swimmer.active = { x: 1040, y: 500, vx: 0, vy: 0, life: 10, phase: 0, health: ROCK_SWIMMER.drillHitsToDefeat, drillCooldown: 0, hitFlash: 0 };
  assert.equal(swimmer.hitByDrill(world, 980, 500, 1, 0, 80), false, 'first contact wounds the swimmer');
  assert.equal(swimmer.active?.health, 2);
  assert.equal(swimmer.hitByDrill(world, 980, 500, 1, 0, 80), false, 'cooldown prevents repeat damage in one held instant');
  swimmer.active!.drillCooldown = 0;
  assert.equal(swimmer.hitByDrill(world, 980, 500, 1, 0, 80), false);
  swimmer.active!.drillCooldown = 0;
  assert.equal(swimmer.hitByDrill(world, 980, 500, 1, 0, 80), true, 'third hit defeats the enemy');
  assert.equal(swimmer.active, undefined);
  const blockedWorld = new TileWorld(992);
  blockedWorld.break(24, 16);
  swimmer.active = { x: 1040, y: 660, vx: 0, vy: 0, life: 10, phase: 0, health: 3, drillCooldown: 0, hitFlash: 0 };
  assert.equal(swimmer.hitByDrill(blockedWorld, 980, 660, 1, 0, 80), false, 'solid rock blocks the beam until mined away');
  assert.equal(swimmer.active?.health, 3);
});
test('shard manta announces a straight charge, can be dodged, and yields a recovery window to the drill', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(swimmerKindForEncounter), [
    'rock-swimmer', 'rock-swimmer', 'shard-manta', 'rock-swimmer', 'rock-swimmer', 'shard-manta',
  ], 'the first encounters teach the existing hunter before introducing the charger');
  const world = new TileWorld(943), manta = new RockSwimmer(943, 'cryo-shelf');
  manta.active = { kind: 'shard-manta', mode: 'hunt', modeTimer: 0, x: 1000, y: 500, vx: 0, vy: 0, life: 10, phase: 0,
    health: SHARD_MANTA.drillHitsToDefeat, drillCooldown: 0, hitFlash: 0 };
  assert.equal(manta.update(0.05, 500, 1100, 500), false);
  assert.equal(manta.active?.mode, 'windup', 'the manta stops and telegraphs before committing to its charge line');
  assert.equal(manta.active?.vx, 0, 'it does not drift into the pod during its warning');
  manta.update(0.96, 500, 1800, 500);
  assert.equal(manta.active?.mode, 'charge');
  assert.equal(manta.active?.vx, SHARD_MANTA.chargeSpeed, 'the committed dash is visibly faster than a swimmer');
  const initialX = manta.active!.x;
  assert.equal(manta.update(0.1, 500, 1800, 600), false, 'moving out of the announced line avoids damage');
  assert.ok(manta.active!.x > initialX, 'the committed charge advances along its telegraphed direction');

  const charging = new RockSwimmer(944, 'cryo-shelf');
  charging.active = { kind: 'shard-manta', mode: 'charge', modeTimer: SHARD_MANTA.chargeSeconds, x: 1000, y: 500,
    vx: SHARD_MANTA.chargeSpeed, vy: 0, life: 10, phase: 0, health: 2, drillCooldown: 0, hitFlash: 0 };
  assert.equal(charging.update(0.1, 500, 1010, 500), true, 'a charge that intersects the pod remains dangerous');

  const interrupt = new RockSwimmer(945, 'cryo-shelf'), drillWorld = new TileWorld(945);
  for (let x = 24; x <= 27; x++) drillWorld.break(x, 12);
  interrupt.active = { kind: 'shard-manta', mode: 'charge', modeTimer: 0.5, x: 1020, y: 500,
    vx: 100, vy: 0, life: 10, phase: 0, health: 2, drillCooldown: 0, hitFlash: 0 };
  assert.equal(interrupt.hitByDrill(drillWorld, 980, 500, 1, 0, 80), false, 'the first drill hit interrupts and stuns it');
  assert.equal(interrupt.active?.mode, 'recover');
  interrupt.update(0.31, 500, 980, 500);
  assert.equal(interrupt.hitByDrill(drillWorld, 980, 500, 1, 0, 80), true, 'a follow-up hit during recovery repels it');
});
test('shard manta finishes its charge when the telegraph timer expires inside a long frame', () => {
  const manta = new RockSwimmer(946, 'cryo-shelf');
  manta.active = { kind: 'shard-manta', mode: 'windup', modeTimer: 0.03, chargeX: 1, chargeY: 0,
    x: 800, y: 500, vx: 0, vy: 0, life: 10, phase: 0, health: 2, drillCooldown: 0, hitFlash: 0 };
  assert.equal(manta.update(0.08, 500, 1100, 500), false);
  assert.ok(manta.active!.x > 800, 'the remaining frame time moves the manta immediately after the warning ends');
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
test('planet salvage magnet measures range and blocked paths along the globe', () => {
  const world = new TileWorld(42, [], [], 'cryo-shelf', PLANET_CHART), tile = WORLD.tile,
    coreY = (PLANET_CHART.radiusRows - 0.5) * tile,
    drop = { x: 234.5 * tile, y: coreY, vx: 0, vy: 0 },
    podX = 238.5 * tile;
  world.break(WORLD.homeColumn, PLANET_CHART.radiusRows);
  assert.ok(hasClearMagnetPath(world, drop.x, drop.y, podX, coreY), 'open core passage has an unobstructed physical path');
  assert.equal(applySalvageMagnet(world, drop, podX, coreY, 0.2), true,
    'near-core magnet range is based on actual world separation, not chart columns');
  const chart = world.planetChart!, velocity = planetChartVectorToCartesian(
    { u: drop.x / tile, v: drop.y / tile }, { du: drop.vx / tile, dv: drop.vy / tile },
    chart.columns, chart.radiusRows, tile,
  );
  assert.ok(Math.hypot(velocity.dx, velocity.dy) <= SALVAGE_MAGNET.maxSpeed + 1e-6,
    'the magnet speed cap remains physical even where chart coordinates stretch');
});
test('return fuel estimate is conservative, increases with depth, and improves with engine', () => {
  const near = estimateVerticalReturnFuel(500, 1),
    deep = estimateVerticalReturnFuel(2500, 1),
    upgraded = estimateVerticalReturnFuel(2500, 1.95);
  assert.equal(estimateVerticalReturnFuel(WORLD.spawnY, 1), 0);
  assert.ok(deep > near);
  assert.ok(upgraded < deep);
});
test('winch fuel estimate reflects its faster pull and higher thrust cost', () => {
  const shallow = estimateWinchReturnFuel(estimateVerticalReturnFuel(500, 1)),
    deep = estimateWinchReturnFuel(estimateVerticalReturnFuel(1200, 1));
  assert.equal(estimateWinchReturnFuel(12), Math.ceil(12 * RETURN_WINCH.fuelMultiplier / RETURN_WINCH.pullMultiplier));
  assert.equal(estimateWinchReturnFuel(0), 0);
  assert.ok(deep > shallow, 'a deeper return keeps a higher estimated winch cost');
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
  assert.deepEqual(DRILL_TIERS.map((tier) => tier.name), ['Field Bit', 'Extended Auger', 'Resonance Lance', 'Survey Bore', 'Laser Miner']);
  const starterPreview = drillPreviewDimensions(1), augerPreview = drillPreviewDimensions(2), lancePreview = drillPreviewDimensions(3);
  assert.ok(Math.abs(starterPreview.length - (WORLD.tile * drillReachTiles(1) - 10)) < 1e-8);
  assert.equal(starterPreview.halfWidth, WORLD.tile / 2, 'starter preview matches a single tile');
  assert.ok(augerPreview.length > starterPreview.length, 'buying the auger extends the visible cut preview');
  assert.equal(lancePreview.halfWidth, WORLD.tile, 'the resonance lance preview matches a two-tile swath');
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
test('every purchased upgrade grows pod artwork without enlarging tunnel collision', () => {
  const levels = [1, 2, 3, 4, 5].map((level) => ({
    drill: level, cargo: level, fuel: level, hull: level, engine: level, scanner: level, grapple: level,
  }));
  const sizes = levels.map(podVisualScale);
  assert.equal(sizes[0], 1);
  assert.ok(sizes.every((size, i) => i === 0 || size > sizes[i - 1]));
  assert.equal(sizes.at(-1), POD_SIZE.maxScale);
  assert.ok(podVisualScale({ ...levels[0]!, cargo: 5 }) > 1.2, 'cargo alone makes the machine visibly larger');
  assert.ok(podVisualScale({ ...levels[0]!, fuel: 5, hull: 5, engine: 5, scanner: 5, grapple: 5 }) > 1.25,
    'the other upgrade tracks contribute to overall machine scale');
  assert.equal(PHYSICS.halfWidth, 13);
  assert.equal(PHYSICS.halfHeight, 16);
  assert.ok(PHYSICS.halfWidth * 2 < WORLD.tile, 'the unscaled collider remains narrower than one terrain tile');
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
    version: 24 as const, planetChart: PLANET_CHART, campaignSeed: 1, activeMap: 'cryo-shelf' as const,
    maps: { 'cryo-shelf': { seed: 1, x: 980, y: -22, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], warehouse: emptyCargo() } },
    money: p.money, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull, cargo: { ...p.cargo }, maxDepth: 0,
    artifact: false, milestones: ['contract-cryo'], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint, salvageMagnet: false, ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit,
    ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal, ownedProfiles: [...p.ownedProfiles], selectedProfile: p.selectedProfile, specialization: p.specialization, stasisModule: p.stasisModule, returnWinch: p.returnWinch, escapeSuit: p.escapeSuit, pilotEscaping: p.pilotEscaping, grappleOwned: p.grappleOwned,
  } satisfies SaveData;
  assert.ok(validateSave(save));
  assert.equal(validateSave({ ...save, selectedPaint: 'prism' }), false);
  assert.equal(validateSave({ ...save, ownedPaints: ['hab', 'polar', 'polar'] }), false);
  assert.equal(validateSave({ ...save, ownedProfiles: ['standard', 'antenna', 'antenna'] }), false);
  const restored = new Progress();
  new SaveManager().restore(restored, save);
  assert.deepEqual(restored.ownedPaints, ['hab', 'polar']);
  assert.equal(restored.selectedPaint, 'hab');
  assert.deepEqual(restored.milestones, ['contract-cryo'], 'contract chain progress survives reload in the existing milestone field');
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
    version: 24, planetChart: LEGACY_PLANET_CHART, campaignSeed: 123, activeMap: 'cryo-shelf',
    maps: { 'cryo-shelf': {
      seed: 123, x: WORLD.spawnX, y: WORLD.spawnY, maxDepth: 120000,
      destroyed, discovered: [...destroyed], drops, activeCharge: null, structures: [{ id: 'service:980:12000', kind: 'service', x: 980, y: 12000 }], warehouse: emptyCargo(),
    } },
    money: 80, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull,
    cargo: { ...p.cargo }, maxDepth: 120000, artifact: false, milestones: [],
    shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint, salvageMagnet: false,
    ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit,
    ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal,
    ownedProfiles: [...p.ownedProfiles], selectedProfile: p.selectedProfile, specialization: p.specialization, stasisModule: p.stasisModule, returnWinch: p.returnWinch, escapeSuit: p.escapeSuit, pilotEscaping: p.pilotEscaping, grappleOwned: p.grappleOwned,
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

test('version-24 per-planet chart metadata accepts mixed geometry, warehouses, and legacy migrations', () => {
  const p = new Progress(), tileX = 400, row = 12, tileKey = `${tileX},${row}`;
  const chartMap = {
    seed: 123, x: (tileX + 2) * WORLD.tile, y: row * WORLD.tile, maxDepth: 144,
    destroyed: [tileKey], discovered: [tileKey],
    drops: [{ id: `123:${tileKey}`, ore: 'gold' as const, units: 1.5, x: (tileX + 0.5) * WORLD.tile, y: row * WORLD.tile, vx: 0, vy: 0 }],
    activeCharge: { x: (tileX + 0.5) * WORLD.tile, y: row * WORLD.tile, fuse: 0.5 },
    structures: [{ id: 'service:16000:480', kind: 'service' as const, x: 16000, y: 480 }],
    planetChart: PLANET_CHART,
  };
  const chartSave = {
    version: 24 as const, planetChart: PLANET_CHART, campaignSeed: 123, activeMap: 'mars-frontier' as const,
    maps: { 'mars-frontier': { ...chartMap, warehouse: emptyCargo() } }, money: 80, levels: { ...p.levels }, fuel: p.fuel, hull: p.hull,
    cargo: { ...p.cargo }, maxDepth: 144, artifact: false, milestones: [], shipComponents: [], routeFragments: [], charges: 0,
    ownedPaints: [...p.ownedPaints], selectedPaint: p.selectedPaint, salvageMagnet: false,
    ownedSuits: [...p.ownedSuits], selectedSuit: p.selectedSuit, ownedDecals: [...p.ownedDecals], selectedDecal: p.selectedDecal,
    ownedProfiles: [...p.ownedProfiles], selectedProfile: p.selectedProfile, specialization: p.specialization,
    stasisModule: false, returnWinch: false, escapeSuit: false, pilotEscaping: false, grappleOwned: p.grappleOwned,
  } satisfies SaveData;
  assert.equal(validateSave(chartSave), true, 'three-digit tile columns and associated drops/charges/builds fit the compact chart');
  assert.equal(validateSave({ ...chartSave, milestones: ['demand-cryo-shelf-1'] }), true,
    'rotating market demand persists in the existing milestone field');
  assert.equal(validateSave({ ...chartSave, milestones: ['demand-unknown-1'] }), false,
    'unrecognized market demand state is rejected');
  assert.equal(validateSave({ ...chartSave, milestones: SYSTEM_PROJECT_MILESTONES }), true,
    'all system project stages persist in the existing version-24 milestone field');
  const vesperSave = { ...chartSave, activeMap: 'vesper-9' as const,
    maps: { 'vesper-9': { ...chartMap, warehouse: emptyCargo() } }, milestones: [...VESPER_CHAPTER_CORE_IDS, 'core-vesper'] };
  assert.equal(validateSave(vesperSave), true, 'the sixth world and its story milestone fit the existing save schema');
  assert.equal(restoreMapState(vesperSave.maps['vesper-9'], 'vesper-9', 124).world.mapId, 'vesper-9',
    'the final chapter restores as its own persistent world');
  const chartSnapshot = snapshotMapState(chartMap, new TileWorld(123, chartMap.destroyed, chartMap.discovered, 'mars-frontier'),
    chartMap.x, chartMap.y, chartMap.maxDepth, chartMap.drops, chartMap.activeCharge, chartMap.structures);
  assert.deepEqual(chartSnapshot.planetChart, PLANET_CHART, 'chart dimensions survive a per-map save snapshot');
  assert.deepEqual(restoreMapState(chartSnapshot, 'mars-frontier', 0).world.planetChart, PLANET_CHART,
    'restored map worlds receive their saved chart geometry');
  assert.equal(PLANET_CHART.radiusRows, 150, 'new expeditions have a compact 1,800 m core radius');
  assert.equal(PLANET_CHART.columns, Math.round(Math.PI * 150), 'circumference scales with radius to preserve a round globe');
  assert.deepEqual(restoreMapState(undefined, 'cryo-shelf', 0, STARTER_PLANET_CHART).world.planetChart, STARTER_PLANET_CHART,
    'the recommended first world uses its shorter core route');
  assert.deepEqual(restoreMapState(undefined, 'mars-frontier', 0, PLANET_CHART).world.planetChart, PLANET_CHART,
    'later planets keep their full campaign depth');
  assert.equal(STARTER_PLANET_CHART.radiusRows * WORLD.meters, 480, 'the opening planet is compact enough to reach its core in a first campaign loop');
  assert.equal(STARTER_PLANET_CHART.columns, Math.round(Math.PI * 40), 'the smaller starter remains round instead of becoming a short rectangular map');
  assert.equal(PREVIOUS_STARTER_PLANET_CHART.radiusRows * WORLD.meters, 768, 'the previous starter geometry remains recognized for existing saves');
  const shortStarter = new TileWorld(81, [], [], 'cryo-shelf', STARTER_PLANET_CHART);
  for (const [index, fragment] of ROUTE_FRAGMENTS.entries())
    assert.equal(shortStarter.get(fragment.x, [5, 17, 33, 56][index]!).fragmentId, fragment.id, `short starter keeps ${fragment.id} reachable on its globe`);
  assert.equal(validateSave({ ...chartSave, maps: { ...chartSave.maps, 'cryo-shelf': {
    seed: 123, x: WORLD.spawnX, y: WORLD.spawnY, maxDepth: 0, destroyed: [], discovered: [], drops: [], activeCharge: null, structures: [], warehouse: emptyCargo(), planetChart: STARTER_PLANET_CHART,
  } } }), true, 'mixed per-planet chart sizes remain save-compatible');
  assert.equal(validateSave({ ...chartSave, planetChart: PREVIOUS_STARTER_PLANET_CHART }), true,
    'existing saves using the previous 768 m starter geometry remain compatible');
  const withTradePost = { ...chartMap, warehouse: emptyCargo(), structures: [...chartMap.structures, { id: 'trade-post:16000:0', kind: 'trade-post' as const, x: 16000, y: 0 }] };
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': withTradePost } }), true, 'the new surface exchange persists in a planet-local structure record');
  const withHabitat = { ...chartMap, warehouse: emptyCargo(), structures: [...chartMap.structures, { id: 'habitat:16000:0', kind: 'habitat' as const, x: 16000, y: 0 }] };
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': withHabitat } }), true, 'surface habitats persist alongside underground structures');
  const withWarehouse = { ...chartMap, warehouse: { ...emptyCargo(), gold: 2.5 }, structures: [...chartMap.structures, { id: 'warehouse:16000:0', kind: 'warehouse' as const, x: 16000, y: 0 }] };
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': withWarehouse } }), true, 'selected ore inventory and its surface warehouse persist per planet');
  const migratedV22 = migrateSave({ ...chartSave, version: 22, maps: { 'mars-frontier': { ...chartMap } } });
  assert.equal(migratedV22?.version, 24, 'version-22 maps migrate through integrity and local warehouse state');
  assert.ok(migratedV22?.maps['mars-frontier']?.structures.every((structure) => structure.integrity === SURFACE_RAID.integrity),
    'existing buildings enter the raid system at full integrity');
  assert.deepEqual(migratedV22?.maps['mars-frontier']?.warehouse, emptyCargo(), 'v22 storage migrates to an empty planet warehouse');
  const migratedV23 = migrateSave({ ...chartSave, version: 23, maps: { 'mars-frontier': { ...chartMap } } });
  assert.equal(migratedV23?.version, 24, 'v23 campaigns migrate to the new warehouse schema');
  assert.deepEqual(migratedV23?.maps['mars-frontier']?.warehouse, emptyCargo(), 'v23 planets begin with empty warehouse stock');
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': { ...chartMap, structures: [{ id: 'habitat:16000:0', kind: 'habitat' as const, x: 16000, y: 0, integrity: 0 }] } } }), false,
    'save validation rejects a structure with no remaining integrity instead of keeping a broken ghost');
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': { ...chartMap, structures: Array.from({ length: 4 }, (_, i) => ({ id: `habitat:${15000 + i * 400}:0`, kind: 'habitat' as const, x: 15000 + i * 400, y: 0 })) } } }), false,
    'save validation rejects more than three habitats on one planet');
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': { ...withTradePost, structures: [...withTradePost.structures, { id: 'trade-post:16100:0', kind: 'trade-post' as const, x: 16100, y: 0 }] } } }), false,
    'each planet can have only one trading post');
  assert.equal(migrateSave({ ...chartSave, version: 22, maps: { 'mars-frontier': { ...chartMap } } })?.version, 24, 'version-22 campaigns migrate without losing their existing planet data');
  assert.equal(validateSave({ ...chartSave, maps: { 'mars-frontier': { ...chartMap, planetChart: { ...PLANET_CHART, columns: PLANET_CHART.columns - 1 } } } }), false,
    'unknown chart geometry cannot silently reinterpret saved coordinates');
  const legacySave = { ...chartSave, version: 18, maps: { 'mars-frontier': {
    seed: 123, x: 21000, y: WORLD.spawnY, maxDepth: 144, destroyed: ['500,12'], discovered: ['500,12'],
    drops: [{ id: '123:500,12', ore: 'gold' as const, units: 1, x: 20020, y: 480, vx: 0, vy: 0 }], activeCharge: null, structures: [],
  } } };
  const migrated = migrateSave(legacySave);
  assert.equal(migrated?.version, 24);
  assert.deepEqual(migrated?.planetChart, LEGACY_PLANET_CHART, 'v18 saves preserve their original 3,600 m radius');
  assert.equal(migrated?.maps['mars-frontier']?.planetChart, undefined, 'old map coordinates stay intact under the legacy campaign chart');
  assert.deepEqual(migrated?.maps['mars-frontier']?.destroyed, ['500,12']);
  assert.equal(migrated?.maps['mars-frontier']?.x, 21000, 'wide existing coordinates and physical ore remain valid without per-map chart metadata');
});

test('versioned save validation and reconstruction', () => {
  const p = new Progress(),
    w = new TileWorld(2);
  w.break(24, 0);
  w.reveal(980, 0);
  const d: SaveData = {
    version: 24, planetChart: LEGACY_PLANET_CHART,
    campaignSeed: 2,
    activeMap: 'mars-frontier',
    maps: { 'mars-frontier': {
      seed: 2, x: 980, y: 24, maxDepth: 120,
      destroyed: [...w.destroyed], discovered: [...w.discovered], drops: [], activeCharge: null, structures: [], warehouse: emptyCargo(),
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
    stasisModule: true, returnWinch: false, escapeSuit: false, pilotEscaping: true, grappleOwned: false,
  };
  d.cargo.copper = 0.5;
  assert.ok(validateSave(d));
  assert.ok(validateSave({ ...d, maps: { ...d.maps, 'mars-frontier': { ...d.maps['mars-frontier']!, y: -524 } } }),
    'the home-side sky deck remains saveable above the old surface-only limit');
  assert.equal(validateSave({ ...d, maps: { ...d.maps, 'mars-frontier': { ...d.maps['mars-frontier']!, y: -MAX_TOWN_ALTITUDE - 1 } } }), false,
    'save validation still rejects positions beyond the pod altitude clamp');
  const migratedV12 = migrateSave({ ...d, version: 12, returnWinch: undefined });
  assert.ok(migratedV12);
  assert.equal(migratedV12.version, 24);
  assert.equal(migratedV12.returnWinch, false, 'older campaigns receive the new optional module as unowned');
  const oldChargeSave = { ...d, maps: { ...d.maps, 'mars-frontier': { ...d.maps['mars-frontier']!, activeCharge: { x: 980, y: 280, fuse: 0.7 } } } };
  assert.ok(validateSave(oldChargeSave), 'existing active charges remain valid without a velocity field');
  assert.ok(validateSave({ ...oldChargeSave, maps: { ...oldChargeSave.maps, 'mars-frontier': { ...oldChargeSave.maps['mars-frontier']!, activeCharge: { ...oldChargeSave.maps['mars-frontier']!.activeCharge!, vy: 120 } } } }));
  assert.equal(validateSave({ ...oldChargeSave, maps: { ...oldChargeSave.maps, 'mars-frontier': { ...oldChargeSave.maps['mars-frontier']!, activeCharge: { ...oldChargeSave.maps['mars-frontier']!.activeCharge!, vy: CHARGE.maxFallSpeed + 1 } } } }), false);
  assert.equal(validateSave({ ...d, version: 3 }), false);
  const migratedV3 = migrateSave({ ...d, version: 3, routeFragments: undefined } as unknown as SaveData);
  assert.ok(migratedV3);
  assert.equal(migratedV3.version, 24);
  assert.deepEqual(migratedV3.routeFragments, []);
  assert.deepEqual(migratedV3.maps['mars-frontier']?.drops, []);
  assert.equal(migratedV3.charges, 0);
  assert.deepEqual(parseSaveFile(JSON.stringify({ ...d, version: 3, routeFragments: undefined }))?.routeFragments, []);
  const legacyV4 = { ...d, version: 4, charges: undefined, maps: { 'mars-frontier': { ...d.maps['mars-frontier']!, drops: undefined, activeCharge: undefined } } };
  const migratedV4 = migrateSave(legacyV4);
  assert.ok(migratedV4);
  assert.equal(migratedV4.version, 24);
  assert.deepEqual(migratedV4.maps['mars-frontier']?.drops, []);
  const legacyV7 = { ...d, version: 7, ownedSuits: undefined, selectedSuit: undefined };
  const migratedV7 = migrateSave(legacyV7);
  assert.ok(migratedV7);
  assert.equal(migratedV7.version, 24);
  assert.equal(migratedV7.selectedSuit, 'hab');
  assert.deepEqual(migratedV7.ownedSuits, ['hab']);
  const legacyV6 = { ...d, version: 6, salvageMagnet: undefined, ownedSuits: undefined, selectedSuit: undefined };
  const migratedV6 = migrateSave(legacyV6);
  assert.ok(migratedV6);
  assert.equal(migratedV6.version, 24);
  assert.equal(migratedV6.salvageMagnet, false);
  assert.equal(migratedV6.selectedSuit, 'hab');
  assert.deepEqual(migratedV6.ownedPaints, ['hab', 'polar']);
  const legacyV5 = { ...d, version: 5, ownedPaints: undefined, selectedPaint: undefined, salvageMagnet: undefined };
  const migratedV5 = migrateSave(legacyV5);
  assert.ok(migratedV5);
  assert.equal(migratedV5.version, 24);
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
  assert.equal(migrated.version, 24);
  assert.equal(migrated.activeMap, 'mars-frontier');
  assert.equal(migrated.maps['mars-frontier']?.x, 980);
  assert.deepEqual(migrated.shipComponents, []);
  assert.equal(validateSave({ ...d, fuel: NaN }), false);
  assert.equal(validateSave({ ...d, levels: { ...d.levels, drill: 7 } }), true, 'post-five upgrade levels remain save-compatible');
  assert.equal(validateSave({ ...d, activeMap: 'cinder-vale', maps: { 'cinder-vale': { ...d.maps['mars-frontier']! } } }), true, 'fifth-planet progress fits the existing save format');
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
  assert.equal(migratedV8.version, 24);
  assert.deepEqual(migratedV8.ownedDecals, ['standard']);
  assert.equal(migratedV8.selectedDecal, 'standard');
  assert.deepEqual(migratedV8.ownedProfiles, ['standard']);
  assert.equal(migratedV8.selectedProfile, 'standard');
  const legacyV9 = { ...d, version: 9, ownedProfiles: undefined, selectedProfile: undefined };
  const migratedV9 = migrateSave(legacyV9);
  assert.ok(migratedV9);
  assert.equal(migratedV9.version, 24);
  assert.deepEqual(migratedV9.ownedProfiles, ['standard']);
  assert.equal(migratedV9.specialization, 'balanced');
  const migratedV10 = migrateSave({ ...d, version: 10, specialization: undefined });
  assert.ok(migratedV10);
  assert.equal(migratedV10.version, 24);
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
