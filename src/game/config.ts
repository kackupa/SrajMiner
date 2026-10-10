export const WORLD = { tile: 40, width: 48, homeColumn: 24, chunk: 16, meters: 12, spawnX: 980, spawnY: -22 };
export const CAVE_ATMOSPHERE = {
  maxParticles: 96,
  spawnAttemptsPerSecond: 100,
  wakePerSecond: 18,
  lightRadius: 260,
  colors: { 'cryo-shelf': 0xc8e9ef, 'hull-graveyard': 0xd5ad82, 'prism-fault': 0xcdb6ed, 'mars-frontier': 0xd49776, 'cinder-vale': 0xf08a58, 'vesper-9': 0xb2e98e },
} as const;
// Music follows the current local depth, with a shallower reset point to avoid
// restarting the transition when the pod moves around its trigger depth.
export const MUSIC_DEPTH = { transition: 600, returnToSignal: 350, deepOnLoad: 1300 } as const;
import type { PlanetChartSize } from './world/PlanetChart';

export const CORE = {
  depthMeters: 3600,
  passageRadius: 5,
  physicalPassageRadius: 72,
  firstCrossingReward: 2200,
};
export const CORE_WORLD_Y = CORE.depthMeters / WORLD.meters * WORLD.tile;
export const CORE_CROSSING_CLEARANCE = CORE.passageRadius * WORLD.tile;
export const FAR_SURFACE_Y = CORE_WORLD_Y * 2;
export const FAR_SURFACE_ROW = FAR_SURFACE_Y / WORLD.tile;
export const LEGACY_PLANET_CHART = { radiusRows: FAR_SURFACE_ROW / 2, columns: Math.round(Math.PI * FAR_SURFACE_ROW / 2) } as const;
export const PLANET_CHART = { radiusRows: 150, columns: Math.round(Math.PI * 150) } as const;
/** The first deployment is deliberately compact so new pilots can reach the core quickly. */
export const STARTER_PLANET_CHART = { radiusRows: 40, columns: Math.round(Math.PI * 40) } as const;
/** Preserve geometry for campaigns created before the compact starter revision. */
export const PREVIOUS_STARTER_PLANET_CHART = { radiusRows: 64, columns: Math.round(Math.PI * 64) } as const;
export const coreWorldYFor = (chart?: PlanetChartSize) => chart ? chart.radiusRows * WORLD.tile : CORE_WORLD_Y;
export const farSurfaceRowFor = (chart?: PlanetChartSize) => chart ? chart.radiusRows * 2 : FAR_SURFACE_ROW;
export const farSurfaceYFor = (chart?: PlanetChartSize) => farSurfaceRowFor(chart) * WORLD.tile;
export const coreDepthMetersFor = (chart?: PlanetChartSize) => chart ? chart.radiusRows * WORLD.meters : CORE.depthMeters;
export const gravityDirectionAt = (y: number, chart?: PlanetChartSize) => y < coreWorldYFor(chart) ? 1 : -1;
export const farHemisphereAfterCoreExit = (currentlyFar: boolean, y: number, chart?: PlanetChartSize) => {
  const coreY = coreWorldYFor(chart);
  return currentlyFar ? y > coreY - CORE_CROSSING_CLEARANCE : y >= coreY + CORE_CROSSING_CLEARANCE;
};
export const surfaceYAt = (y: number, chart?: PlanetChartSize) => y < coreWorldYFor(chart) ? 0 : farSurfaceYFor(chart);
export const surfaceDockYAt = (y: number, chart?: PlanetChartSize) => y < coreWorldYFor(chart) ? WORLD.spawnY : farSurfaceYFor(chart) - WORLD.spawnY;
export const depthAtWorldY = (y: number, chart?: PlanetChartSize) => {
  const coreY = coreWorldYFor(chart), farY = farSurfaceYFor(chart);
  return Math.max(0, Math.floor(((y < coreY ? y : farY - y) + 16) / WORLD.tile * WORLD.meters));
};
export const PHYSICS = {
  gravity: 430,
  acceleration: 650,
  thrust: 980,
  horizontal: 145,
  rise: 185,
  fall: 430,
  safeImpact: 280,
  damageScale: 0.2,
  halfWidth: 13,
  halfHeight: 16,
  /** Small horizontal collision inset keeps exposed block corners from snagging the miner. */
  horizontalCollisionInset: 3,
};
export const UNDERGROUND_BUILDING = {
  minimumDepthMeters: 180,
  platform: { credits: 140, materials: { copper: 2, iron: 1 }, widthTiles: 5 },
  service: { credits: 420, materials: { iron: 3, silver: 2 }, widthTiles: 5, uniquePerMap: true },
  turret: { credits: 560, materials: { iron: 2, silver: 2, gold: 1 }, widthTiles: 3, range: 440, reloadSeconds: 1.4, maxPerMap: 3 },
  'trade-post': { credits: 1100, materials: { copper: 4, iron: 4, gold: 2 }, widthTiles: 5, maxPerMap: 1 },
  habitat: { credits: 900, materials: { copper: 4, iron: 2, silver: 1 }, widthTiles: 7, maxPerMap: 3, serviceRadius: 220 },
  warehouse: { credits: 360, materials: { iron: 3, silver: 1 }, widthTiles: 5, maxPerMap: 1 },
  wall: { credits: 80, materials: { copper: 1 }, widthTiles: 1, maxPerMap: 12 },
  gate: { credits: 220, materials: { iron: 2 }, widthTiles: 3, maxPerMap: 3 },
  maxStructuresPerMap: 20,
  serviceRadius: 100,
} as const;
export const SURFACE_RAID = {
  firstWarningSeconds: 55,
  repeatWarningSeconds: 82,
  telegraphSeconds: 7,
  approachSpeed: 52,
  interceptRange: 440,
  integrity: 2,
  drillHitsToRepel: 2,
  drillHitRadius: 24,
  drillCooldownSeconds: 0.28,
  repairCredits: 180,
} as const;
export const TRADE_NETWORK = { saleBonusPerRemotePost: 0.1, maxSaleBonus: 0.4, relaySaleBonus: 0.05 } as const;
export function tradeNetworkPremium(saleValue: number, connectedPosts: number, hasLocalPost: boolean, relayOnline = false) {
  if (!Number.isFinite(saleValue) || !Number.isFinite(connectedPosts) || !hasLocalPost || connectedPosts < 2) return 0;
  const rate = Math.min(TRADE_NETWORK.maxSaleBonus + (relayOnline ? TRADE_NETWORK.relaySaleBonus : 0),
    (Math.floor(connectedPosts) - 1) * TRADE_NETWORK.saleBonusPerRemotePost + (relayOnline ? TRADE_NETWORK.relaySaleBonus : 0));
  return Math.floor(Math.max(0, saleValue) * rate);
}
// Warn early enough to brake before reaching the damaging landing threshold.
export const DESCENT_WARNING_SPEED = PHYSICS.safeImpact * 0.6;
export const FALL_CAMERA_LOOKAHEAD = 96;
export const fallMotionCueIntensity = (vy: number, gravitySign: number) =>
  Math.max(0, Math.min(1, (vy * gravitySign - DESCENT_WARNING_SPEED) / (PHYSICS.safeImpact - DESCENT_WARNING_SPEED)));
export const fallCameraLookAhead = (vy: number, gravitySign: number) => {
  const descentSpeed = vy * gravitySign;
  return FALL_CAMERA_LOOKAHEAD * Math.max(0, Math.min(1,
    (descentSpeed - DESCENT_WARNING_SPEED) / (PHYSICS.fall - DESCENT_WARNING_SPEED)));
};
export const FUEL = { moving: 0.55, thrust: 1.25, drilling: 1.4 };
export const estimateVerticalReturnFuel = (podY: number, engine: number, chart?: PlanetChartSize) => {
  const vertical = Math.abs(podY - surfaceDockYAt(podY, chart));
  if (!vertical) return 0;
  const conservativeRise = PHYSICS.rise * engine * 0.55;
  return Math.ceil((vertical / Math.max(1, conservativeRise)) * FUEL.thrust * 1.45 + 2);
};
export const ORES = {
  copper: {
    name: 'Copper',
    value: 18,
    color: 0xf0a16b,
    hex: '#f0a16b',
    min: 0,
    max: 230,
    rarity: 0.34,
  },
  iron: {
    name: 'Iron',
    value: 28,
    color: 0x9faeb5,
    hex: '#9faeb5',
    min: 24,
    max: 480,
    rarity: 0.26,
  },
  silver: {
    name: 'Silver',
    value: 55,
    color: 0xcce8de,
    hex: '#cce8de',
    min: 120,
    max: 850,
    rarity: 0.21,
  },
  gold: {
    name: 'Gold',
    value: 105,
    color: 0xf5ca62,
    hex: '#f5ca62',
    min: 312,
    max: 2000,
    rarity: 0.15,
  },
  diamond: {
    name: 'Diamond',
    value: 260,
    color: 0x80f5e9,
    hex: '#80f5e9',
    min: 612,
    max: Infinity,
    rarity: 0.085,
  },
} as const;
export type Ore = keyof typeof ORES;
export const ORE_KEYS = Object.keys(ORES) as Ore[];
export const ORE_SILHOUETTES = {
  copper: 'chips',
  iron: 'bars',
  silver: 'spires',
  gold: 'nuggets',
  diamond: 'facets',
} as const satisfies Record<Ore, string>;
export const BANDS = [
  {
    min: 0,
    name: 'RUST FIELDS',
    type: 'dirt',
    hardness: 0.3,
    colors: [0x855043, 0x945b49, 0x74483f],
  },
  {
    min: 100,
    name: 'BASALT SHELF',
    type: 'rock',
    hardness: 0.6,
    colors: [0x65504b, 0x70554d, 0x58453f],
  },
  {
    min: 300,
    name: 'IRON VEIL',
    type: 'hard',
    hardness: 1.05,
    colors: [0x51424a, 0x604a52, 0x473b44],
  },
  {
    min: 600,
    name: 'DEEP SILENCE',
    type: 'hard',
    hardness: 1.5,
    colors: [0x363e49, 0x444654, 0x303540],
  },
  {
    min: 1000,
    name: 'THE BELOW',
    type: 'hard',
    hardness: 1.9,
    colors: [0x273f42, 0x344b4d, 0x24383c],
  },
] as const;
export const bandAt = (depth: number) =>
  [...BANDS].reverse().find((b) => depth >= b.min) ?? BANDS[0];
export const MAPS = {
  'mars-frontier': {
    name: 'Mars Frontier',
    shortName: 'MARS / RUST FIELDS',
    strata: ['RUST FIELDS', 'BASALT SHELF', 'IRON VEIL', 'DEEP SILENCE', 'THE BELOW'],
    palette: [0x855043, 0x65504b, 0x51424a, 0x363e49, 0x273f42],
    caveChance: 0.12,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 1, diamond: 1 },
    surface: { sky: [0x17252c, 0x17252c, 0x8c6356, 0x8c6356], ground: 0xba805c, edge: 0xe0a776, mountains: [0x594f4e, 0x79594e, 0x9c6851], moon: 0xc6b4a2 },
  },
  'cryo-shelf': {
    name: 'Cryo Shelf',
    shortName: 'ICE MOON / CRYO SHELF',
    strata: ['CRYO DUST', 'FROZEN BASALT', 'BURIED HULL', 'DEEP ICE', 'CORE SHADOW'],
    palette: [0x527884, 0x415e70, 0x37495f, 0x293c54, 0x25344b],
    caveChance: 0.17,
    geodeChance: 0,
    oreFactors: { copper: 0.75, iron: 1.05, silver: 1.1, gold: 0.9, diamond: 1.05 },
    surface: { sky: [0x101b29, 0x152c3b, 0x315564, 0x59838c], ground: 0x638995, edge: 0xa9d5d5, mountains: [0x293e50, 0x365669, 0x4a6d79], moon: 0xa4d1d3 },
  },
  'hull-graveyard': {
    name: 'Hull Graveyard',
    shortName: 'ARK REMAINS / HULL GRAVEYARD',
    strata: ['OUTER PLATING', 'BROKEN DECKS', 'ENGINE BULKHEAD', 'REACTOR VAULT', 'BLACK BOX'],
    palette: [0x596d68, 0x495b5c, 0x464b55, 0x373c48, 0x28353d],
    caveChance: 0.21,
    geodeChance: 0,
    oreFactors: { copper: 0.65, iron: 1.5, silver: 0.9, gold: 0.8, diamond: 0.7 },
    surface: { sky: [0x101b21, 0x1d3035, 0x34464a, 0x647b77], ground: 0x596c69, edge: 0xa1b3a2, mountains: [0x25373a, 0x354647, 0x4e625c], moon: 0xb2c8c0 },
  },
  'prism-fault': {
    name: 'Prism Fault',
    shortName: 'CRYSTAL FAULT / PRISM VEIN',
    strata: ['GLASS CRUST', 'PRISM BED', 'SILVER FAULT', 'LUMEN VEIN', 'CORE GEODE'],
    palette: [0x645b80, 0x564f79, 0x43486f, 0x345569, 0x244f5c],
    caveChance: 0.09,
    geodeChance: 0.12,
    oreFactors: { copper: 0.6, iron: 0.8, silver: 1.5, gold: 1.25, diamond: 1.4 },
    surface: { sky: [0x171629, 0x242344, 0x373764, 0x565480], ground: 0x655f82, edge: 0xb3b1ed, mountains: [0x2d2b4b, 0x3d3b62, 0x535273], moon: 0xc3c7ed },
  },
  'cinder-vale': {
    name: 'Cinder Vale',
    shortName: 'EMBER WORLD / CINDER VALE',
    strata: ['ASHGLASS COAST', 'OBSIDIAN RIFT', 'SULFUR VEIL', 'SEALED MAGMA', 'EMBER HEART'],
    palette: [0x79534c, 0x5d4548, 0x51414a, 0x453a42, 0x382d3c],
    caveChance: 0.16,
    geodeChance: 0.04,
    oreFactors: { copper: 1.25, iron: 1.15, silver: 0.9, gold: 1.2, diamond: 1.1 },
    surface: { sky: [0x1c1720, 0x30212a, 0x59383a, 0x8e5140], ground: 0x694640, edge: 0xf08a58, mountains: [0x332a34, 0x4b3439, 0x70433c], moon: 0xe8a36c },
  },
  'vesper-9': {
    name: 'Vesper-9',
    shortName: 'RETURN WORLD / VESPER-9',
    strata: ['LANTERN GROVE', 'ROOTED SHELF', 'ECHO REEF', 'DUSK MANTLE', 'HANDSHAKE CORE'],
    palette: [0x426f65, 0x375c5c, 0x344d59, 0x303e55, 0x27354a],
    caveChance: 0.23,
    geodeChance: 0.08,
    oreFactors: { copper: 0.65, iron: 0.8, silver: 1.25, gold: 1.3, diamond: 1.55 },
    surface: { sky: [0x101b27, 0x172c3a, 0x315957, 0x64836b], ground: 0x426d5d, edge: 0xb2dc9a, mountains: [0x243d42, 0x31534d, 0x476b55], moon: 0xc0dca5 },
  },
} as const;
// Region signature finds are generated from the map seed and tile coordinate, so
// cached chunks can be discarded without adding feature state to player saves.
export type MapId = keyof typeof MAPS;
export const CORE_RELICS = [
  { id: 'core-mars', mapId: 'mars-frontier', name: 'Sunstone Heart', tint: 0xffb66e, detail: 'A thermal memory shard carrying the frontier’s magnetic pulse.', record: 'The pulse matches the Faraday’s abandoned launch telemetry. Its course was set for Vesper-9.', bounty: 600 },
  { id: 'core-cryo', mapId: 'cryo-shelf', name: 'Cryo Anchor Lens', tint: 0x9bf1e2, detail: 'An ice-grown lens preserves the first stable route through the shelf.', record: 'The buried signal answers the lens with a return handshake. The route was designed to be found from the other side.', bounty: 600 },
  { id: 'core-hull', mapId: 'hull-graveyard', name: 'Reactor Witness', tint: 0xa7d9bd, detail: 'A reactor witness crystal records the final ark-core discharge.', record: 'The wreck’s final discharge was a controlled separation, not a reactor failure. Its manifest was altered after the crew escaped.', bounty: 600 },
  { id: 'core-prism', mapId: 'prism-fault', name: 'Prism Seed', tint: 0xc5a7ff, detail: 'A living crystal seed refracts the fault’s deep-field signature.', record: 'The recovered pulses resolve to the same coordinate: the Faraday’s signal is a path home, not a distress call. One final key remains.', bounty: 600 },
  { id: 'core-cinder', mapId: 'cinder-vale', name: 'Ember Heart', tint: 0xff9460, detail: 'A glassy core filament stores the last pulse of a world that cooled from the outside in.', record: 'The final key resolves the crew’s scattered signal. They are alive beyond Vesper-9, and the Faraday can reach them.', bounty: 900 },
  { id: 'core-vesper', mapId: 'vesper-9', name: 'Return Bloom', tint: 0xb2e98e, detail: 'A living crystal opens around the exact handshake hidden in the crew’s scattered signals.', record: 'The crew survived on Vesper-9. They answer your signal from a settlement grown around the core, and the Faraday finally has a home port.', bounty: 1200 },
] as const satisfies readonly { id: string; mapId: MapId; name: string; tint: number; detail: string; record: string; bounty: number }[];
export const CORE_SURVEY_CONCLUSION = {
  title: 'A route home, carried through six worlds',
  transcript: 'The Faraday did not vanish beneath Vesper-9. The crew scattered its return key across five planetary cores, then built a living settlement around the final handshake. The signal has been waiting for the whole route.',
} as const;
export type CoreRelicId = (typeof CORE_RELICS)[number]['id'];
export const coreSurveyComplete = (milestones: readonly string[]) => CORE_RELICS.every((relic) => milestones.includes(relic.id));
/** Vesper-9 is the follow-up chapter unlocked after the original five-world ledger. */
export const VESPER_CHAPTER_CORE_IDS = CORE_RELICS.filter((relic) => relic.mapId !== 'vesper-9').map((relic) => relic.id);
export const vesperChapterUnlocked = (milestones: readonly string[]) => VESPER_CHAPTER_CORE_IDS.every((id) => milestones.includes(id));
export const REGION_FINDS = {
  'mars-frontier': { chance: 0.012, units: 2, tint: 0xffa66a, name: 'THERMAL SEAM', detail: 'WARM CORE VEIN · GUARANTEED 2 UNITS' },
  'hull-graveyard': { chance: 0.018, units: 2, tint: 0xa7d9bd, name: 'HULL SALVAGE', detail: 'ARK ALLOY CACHE · GUARANTEED 2 UNITS' },
  'cinder-vale': { chance: 0.016, units: 2, tint: 0xff9460, name: 'EMBER GEODE', detail: 'SEALED THERMAL CRYSTAL · GUARANTEED 2 UNITS' },
  'vesper-9': { chance: 0.02, units: 3, tint: 0xb2e98e, name: 'LANTERN BLOOM', detail: 'LIVING CRYSTAL CLUSTER · GUARANTEED 3 UNITS' },
} as const satisfies Partial<Record<MapId, { chance: number; units: number; tint: number; name: string; detail: string }>>;
export const stratumAt = (depth: number, mapId: MapId) => {
  const index = depth >= 1000 ? 4 : depth >= 600 ? 3 : depth >= 300 ? 2 : depth >= 100 ? 1 : 0;
  return MAPS[mapId].strata[index];
};
export const UPGRADES = {
  drill: {
    name: 'Drill',
    description: 'Cut faster, extend the drill beam, and widen each pass at higher levels.',
    values: [1, 1.5, 2.2, 3.1, 4.3],
    costs: [140, 360, 850, 1800],
    unit: '× cutting speed',
    icon: '↧',
  },
  fuel: {
    name: 'Fuel tank',
    description: 'Stay out a little longer.',
    values: [140, 190, 260, 350, 480],
    costs: [120, 320, 750, 1600],
    unit: ' L capacity',
    icon: '◒',
  },
  cargo: {
    name: 'Cargo bay',
    description: 'Bring more of the shelf home.',
    values: [16, 24, 34, 48, 64],
    costs: [150, 380, 900, 1900],
    unit: ' slots',
    icon: '▦',
  },
  hull: {
    name: 'Hull',
    description: 'Take the harder landing.',
    values: [100, 140, 195, 270, 380],
    costs: [130, 340, 800, 1700],
    unit: ' integrity',
    icon: '⬡',
  },
  engine: {
    name: 'Engine',
    description: 'Climb faster. Handle better.',
    values: [1, 1.18, 1.4, 1.65, 1.95],
    costs: [160, 400, 950, 2000],
    unit: '× thrust',
    icon: '↑',
  },
  scanner: {
    name: 'Survey scanner',
    description: 'Push back the fog. Level 5 surveys the full map width around you.',
    values: [4, 8, 13, 22, WORLD.width],
    costs: [180, 420, 950, 2200],
    unit: ' tile radius',
    icon: '⌕',
  },
  grapple: {
    name: 'Auto grapple',
    description: 'A safety hook fires during a dangerous fall and catches higher rock through a clear path.',
    values: [100, 135, 170, 205, 240],
    costs: [170, 410, 980, 2100],
    unit: ' px catch range',
    icon: '⌁',
  },
} as const;
export type Upgrade = keyof typeof UPGRADES;
export type Levels = Record<Upgrade, number>;
export const UPGRADE_KEYS = Object.keys(UPGRADES) as Upgrade[];
export const UPGRADE_MILESTONE_GATES = [
  { firstLevel: 6, label: 'FARADAY ASSEMBLED', requirement: 'ship' },
  { firstLevel: 11, label: '2 PLANETARY CORES LOGGED', requirement: 'two-cores' },
  { firstLevel: 16, label: 'ALL PLANETARY CORES LOGGED', requirement: 'all-cores' },
] as const;
export type UpgradeGateState = { shipComplete: boolean; coreRelics: readonly string[] };
export function upgradeGateForLevel(level: number) {
  return [...UPGRADE_MILESTONE_GATES].reverse().find((gate) => level >= gate.firstLevel);
}
export function upgradeGateMet(level: number, state: UpgradeGateState) {
  const gate = upgradeGateForLevel(level);
  if (!gate) return true;
  if (gate.requirement === 'ship') return state.shipComplete;
  if (gate.requirement === 'two-cores') return state.coreRelics.length >= 2;
  return CORE_RELICS.every((relic) => state.coreRelics.includes(relic.id));
}
export function upgradeGateLabel(level: number) {
  return upgradeGateForLevel(level)?.label;
}
export const SPECIALIZATIONS = {
  balanced: { name: 'Balanced', description: 'No bonus, no trade-off. Change paths freely while docked.', rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1 },
  seamCutter: { name: 'Seam Cutter', description: 'Cut hard rock 20% faster once the deep strata begin.', rockDrillMultiplier: 1.2, scanRadiusBonus: 0, cargoMultiplier: 1 },
  surveyor: { name: 'Surveyor', description: 'Survey two tiles farther around the pod; the map still reveals only explored ground.', rockDrillMultiplier: 1, scanRadiusBonus: 2, cargoMultiplier: 1 },
  hauler: { name: 'Hauler', description: 'Carry 25% more ore before the hold fills.', rockDrillMultiplier: 1, scanRadiusBonus: 0, cargoMultiplier: 1.25 },
} as const;
export type Specialization = keyof typeof SPECIALIZATIONS;
export const SPECIALIZATION_KEYS = Object.keys(SPECIALIZATIONS) as Specialization[];
export function upgradeValue(key: Upgrade, level: number) {
  const track = UPGRADES[key], values: readonly number[] = track.values;
  if (level <= values.length) return values[Math.max(1, level) - 1];
  const extra = level - values.length;
  switch (key) {
    case 'drill': return values[4] + Math.sqrt(extra) * 0.3;
    case 'fuel': return values[4] + Math.sqrt(extra) * 80;
    case 'cargo': return values[4] + Math.sqrt(extra) * 10;
    case 'hull': return values[4] + Math.sqrt(extra) * 55;
    case 'engine': return values[4] + Math.sqrt(extra) * 0.035;
    case 'scanner': return Math.min(WORLD.width * 2, WORLD.width + Math.sqrt(extra) * 8);
    case 'grapple': return values[4] + Math.sqrt(extra) * 14;
  }
}
export function upgradeCost(key: Upgrade, level: number) {
  const track = UPGRADES[key], costs: readonly number[] = track.costs;
  if (level <= costs.length) return costs[Math.max(1, level) - 1];
  const stepsBeyondLastPricedTier = level - costs.length;
  return Math.ceil(costs[costs.length - 1] * (1 + stepsBeyondLastPricedTier * 0.45));
}
export const value = (levels: Levels, key: Upgrade) => upgradeValue(key, levels[key]);
export const drillWidth = (level: number) => level <= 5 ? [1, 1, 2, 3, 4][Math.max(0, level - 1)] : Math.min(WORLD.width, 4 + Math.floor(Math.log2(level - 4)));
export const drillReachTiles = (level: number) => level <= 5
  ? [1.45, 2.1, 2.4, 2.8, 3.3][Math.max(0, level - 1)]
  : 3.3 + Math.log2(level - 4) * 0.35;
export const drillPreviewDimensions = (level: number) => ({
  length: Math.max(14, WORLD.tile * drillReachTiles(level) - 10),
  halfWidth: WORLD.tile * drillWidth(level) / 2,
});
export const drillVisualTier = (level: number) => Math.max(1, Math.min(5, Math.floor(level)));
export const DRILL_TIERS = [
  { name: 'Field Bit', module: 'CONTACT BIT' },
  { name: 'Extended Auger', module: 'AUGER RAILS' },
  { name: 'Resonance Lance', module: 'RESONANCE COIL' },
  { name: 'Survey Bore', module: 'STABILIZER FRAME' },
  { name: 'Laser Miner', module: 'LASER EMITTER' },
] as const;
export const LASER_THERMAL = { heatSeconds: 4.5, ventSeconds: 1.15, coolPerSecond: 0.42 } as const;
export const POD_SIZE = {
  drillPerLevel: 0.05, cargoPerLevel: 0.06, fuelPerLevel: 0.02, hullPerLevel: 0.02,
  enginePerLevel: 0.02, scannerPerLevel: 0.015, grapplePerLevel: 0.015, maxScale: 1.72,
} as const;
export const podVisualScale = (levels: Pick<Levels, 'drill' | 'cargo' | 'fuel' | 'hull' | 'engine' | 'scanner' | 'grapple'>) => {
  const tierGrowth = (key: keyof typeof POD_SIZE, level: number) => Math.max(0, level - 1) * POD_SIZE[key];
  return Math.min(POD_SIZE.maxScale, 1 + tierGrowth('drillPerLevel', levels.drill) +
    tierGrowth('cargoPerLevel', levels.cargo) + tierGrowth('fuelPerLevel', levels.fuel) +
    tierGrowth('hullPerLevel', levels.hull) + tierGrowth('enginePerLevel', levels.engine) +
    tierGrowth('scannerPerLevel', levels.scanner) + tierGrowth('grapplePerLevel', levels.grapple));
};
export const SERVICE = { fuelPrice: 0.3, hullPrice: 0.45 };

export const CHARGE = { packCost: 180, packSize: 3, fuseSeconds: 1.2, blastRadius: 2, pickupRadius: 28, gravity: 560, maxFallSpeed: 360, radius: 6 };
export const SALVAGE_MAGNET = { cost: 420, radius: 190, acceleration: 620, maxSpeed: 260 };
export const STASIS_MODULE = { cost: 760, fuelPerSecond: 1.8 };
export const ESCAPE_SUIT = { cost: 780, thrustMultiplier: 1.45, speedMultiplier: 1.25 } as const;
export const RETURN_WINCH = { cost: 880, pullMultiplier: 1.7, fuelMultiplier: 1.5 };
export const estimateWinchReturnFuel = (standardReturnEstimate: number) =>
  Math.ceil(Math.max(0, standardReturnEstimate) * RETURN_WINCH.fuelMultiplier / RETURN_WINCH.pullMultiplier);
export const AUTO_GRAPPLE = { fallSpeed: 205, impactWindowSeconds: 1.5, predictionStepSeconds: 1 / 30, minRise: 26, hangSeconds: 0.85, cooldownSeconds: [7, 6, 5, 4, 3] };
export const ROCK_SWIMMER = {
  firstDepth: 420,
  firstArrivalSeconds: 18,
  repeatSeconds: 58,
  swimSeconds: 24,
  speed: 48,
  warningRadius: 190,
  contactRadius: 27,
  hullDamage: 8,
  drillHitsToDefeat: 3,
  drillHitCooldownSeconds: 0.3,
  drillHitRadius: 18,
} as const;
export const SHARD_MANTA = {
  hullDamage: 8,
  drillHitsToDefeat: 2,
  huntSpeed: 34,
  windupDistance: 168,
  windupSeconds: 0.95,
  chargeSpeed: 138,
  chargeSeconds: 0.62,
  recoverSeconds: 1.05,
  contactRadius: 29,
} as const;
export const POD_PAINTS = {
  hab: { name: 'Hab Standard', description: 'The hard-wearing outpost finish.', cost: 0, hull: 0xeac781, trim: 0xffdfa0, light: 0xfff0bc },
  polar: { name: 'Polar Signal', description: 'High-visibility ice-runner enamel.', cost: 180, hull: 0x62c7c7, trim: 0xb0f1e4, light: 0xe1fff0 },
  ark: { name: 'Ark Salvage', description: 'Deep green, recovered from the old hull.', cost: 360, hull: 0x83b88e, trim: 0xc8e8ad, light: 0xe8ffd1 },
  prism: { name: 'Prism Bloom', description: 'Violet lacquer with a crystal-bright edge.', cost: 600, hull: 0xb59ae8, trim: 0xe1caff, light: 0xf2e8ff },
} as const;
export type PodPaint = keyof typeof POD_PAINTS;
export const POD_PAINT_KEYS = Object.keys(POD_PAINTS) as PodPaint[];
export const PILOT_SUITS = {
  hab: { name: 'Hab Issue', description: 'Standard insulated outpost suit.', cost: 0, body: 0xd9dfd0, trim: 0xeac781 },
  polar: { name: 'Polar Survey', description: 'Reflective ice-runner shell.', cost: 160, body: 0x55b8bd, trim: 0xcaf8ee },
  ark: { name: 'Ark Salvage', description: 'Field repairs stitched from Faraday canvas.', cost: 320, body: 0x739a72, trim: 0xc8e8ad },
  prism: { name: 'Prism Runner', description: 'A violet suit with a bright helmet seal.', cost: 520, body: 0x9a79c9, trim: 0xe1caff },
} as const;
export type PilotSuit = keyof typeof PILOT_SUITS;
export const PILOT_SUIT_KEYS = Object.keys(PILOT_SUITS) as PilotSuit[];
export const POD_DECALS = {
  standard: { name: 'Hab Mark', description: 'Outpost identification stripe.', cost: 0, color: 0xeac781, style: 'stripe' },
  arrow: { name: 'Descent Arrow', description: 'A bold directional survey mark.', cost: 140, color: 0x72ddd0, style: 'arrow' },
  ark: { name: 'Faraday Crest', description: 'The lost ship’s recovery insignia.', cost: 280, color: 0xa4d6a3, style: 'crest' },
  prism: { name: 'Prism Trace', description: 'A luminous mark for deep runs.', cost: 440, color: 0xc3a2ff, style: 'prism' },
} as const;
export type PodDecal = keyof typeof POD_DECALS;
export const POD_DECAL_KEYS = Object.keys(POD_DECALS) as PodDecal[];
export const POD_PROFILES = {
  standard: { name: 'Hab Runner', description: 'Balanced outpost frame · warm cabin glow.', cost: 0, style: 'standard', cabin: 0x93d4cc },
  antenna: { name: 'Signal Scout', description: 'Beacon mast and sensor vane · mint cabin glow.', cost: 220, style: 'antenna', cabin: 0xa5f1d1 },
  stabilizers: { name: 'Cavern Surveyor', description: 'Twin landing fins · ice-blue cabin glow.', cost: 360, style: 'stabilizers', cabin: 0x94dfff },
  armor: { name: 'Ark Bulwark', description: 'Recovered side rails · amber cabin glow.', cost: 540, style: 'armor', cabin: 0xffca86 },
} as const;
export type PodProfile = keyof typeof POD_PROFILES;
export const POD_PROFILE_KEYS = Object.keys(POD_PROFILES) as PodProfile[];

export const CAMPAIGN_MILESTONES = [
  { id: 'first-core-sample', depth: 90, title: 'First core sample', detail: 'A warm signal in the basalt points toward the buried strata.' },
  { id: 'basalt-vein', depth: 300, title: 'Basalt vein mapped', detail: 'The survey reveals a sealed pocket below the iron shelf.' },
  { id: 'deep-scan', depth: 600, title: 'Deep scan recovered', detail: 'An old navigation pulse repeats beneath the dark layer.' },
  { id: 'route-signal', depth: 1050, title: 'Unknown route signal', detail: 'The transmission carries fragments of a route beyond this world.' },
] as const;
export const ROUTE_FRAGMENTS = [
  { id: 'fragment-1', milestoneId: 'first-core-sample', row: 8, x: 24, title: 'Warm core sample', landmark: 'Thermal Observatory', chamber: { halfWidth: 4, halfHeight: 2 }, detail: 'A live thermal trace reveals a safe fracture through the shelf.' },
  { id: 'fragment-2', milestoneId: 'basalt-vein', row: 27, x: 24, title: 'Basalt route key', landmark: 'Basalt Engine Hall', chamber: { halfWidth: 5, halfHeight: 2 }, detail: 'The key maps a service passage through the iron veil.' },
  { id: 'fragment-3', milestoneId: 'deep-scan', row: 52, x: 24, title: 'Deep navigation shard', landmark: 'Ark Signal Gallery', chamber: { halfWidth: 6, halfHeight: 3 }, detail: 'A ship coordinate points into the old wreck field.' },
  { id: 'fragment-4', milestoneId: 'route-signal', row: 90, x: 24, title: 'Faraday route beacon', landmark: 'Faraday Beacon Vault', chamber: { halfWidth: 7, halfHeight: 3 }, detail: 'The final beacon reconstructs the long-range route.' },
] as const;
// Optional, offline archive collectibles; these fictional hashes have no value or exchange path.
export const NAVIGATION_HASHES = [
  { id: 'hash-cryo', mapId: 'cryo-shelf', x: 12, row: 16, name: 'ICEBOUND ECHO', hash: '7C1A·09EF·B44D', crew: 'Asha Vale', role: 'Signal Officer', transcript: 'The echo is not a beacon. It is a handshake waiting for our key. Someone below knows we are here.', detail: 'A shipyard checksum, signed before the Faraday left orbit.' },
  { id: 'hash-hull', mapId: 'hull-graveyard', x: 12, row: 22, name: 'WRECK REGISTER', hash: 'A308·F11C·620B', crew: 'Orrin Bale', role: 'Flight Recorder', transcript: 'The manifest says no survivors. I watched the landing crew walk away from the wreck. The record was changed after we split up.', detail: 'An ark manifest that lists a crew no surviving log remembers.' },
  { id: 'hash-prism', mapId: 'prism-fault', x: 36, row: 32, name: 'PRISM KEY', hash: 'D9E2·44A7·C015', crew: 'Imani Cho', role: 'Navigator', transcript: 'The beacon bends through the fault, but the coordinates resolve cleanly. This route points back to the first signal—not deeper into the ice.', detail: 'A navigation key refracted through an abandoned survey beacon.' },
  { id: 'hash-mars', mapId: 'mars-frontier', x: 9, row: 20, name: 'RED DUST INDEX', hash: '51B7·C82D·A903', crew: 'Sol Reyes', role: 'Surface Lead', transcript: 'We found the Faraday’s launch telemetry beneath this shelf. Its last destination was Vesper-9. The crew were not marked lost. They were marked passengers.', detail: 'A checksum from the first surface team, preserved under the frontier.' },
] as const;
export const CREW_ARCHIVE_CONCLUSION = {
  title: 'THE SIGNAL WAS A HANDSHAKE',
  author: 'Asha Vale',
  role: 'Signal Officer · Final annotation',
  transcript: 'The Faraday reached Vesper-9. We scattered the access keys across the survey beacons so the ship could not be followed. The signal below the shelf is the return handshake. Someone is waiting to be let home.',
} as const;
export type NavigationHashId = (typeof NAVIGATION_HASHES)[number]['id'];
export type RouteFragmentId = (typeof ROUTE_FRAGMENTS)[number]['id'];
export const SHIP_COMPONENTS = {
  frame: { name: 'Launch frame', description: 'A reinforced cradle for the inter-map craft.', cost: 420 },
  propulsion: { name: 'Ion propulsion', description: 'The thrust package for leaving this world.', cost: 720 },
  navigation: { name: 'Route computer', description: 'Reconstructs coordinates from recovered signal data.', cost: 980 },
  'life-support': { name: 'Habitat core', description: 'Keeps the ship and its destination workshop running.', cost: 680 },
} as const;
export type ShipComponent = keyof typeof SHIP_COMPONENTS;
export const ROUTE_SHIP_COMPONENTS: Record<RouteFragmentId, ShipComponent> = {
  'fragment-1': 'frame',
  'fragment-2': 'propulsion',
  'fragment-3': 'navigation',
  'fragment-4': 'life-support',
};
// Route-data claims form a predictable campaign path to the matching long-range ship parts.
export const ROUTE_SURVEY_REWARDS: Record<RouteFragmentId, number> = {
  'fragment-1': SHIP_COMPONENTS.frame.cost,
  'fragment-2': SHIP_COMPONENTS.propulsion.cost,
  'fragment-3': SHIP_COMPONENTS.navigation.cost,
  'fragment-4': SHIP_COMPONENTS['life-support'].cost,
};
