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
  drillAssistRadius: 220,
  drillAssistReach: 160,
  relicTargetRadius: 12,
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
  /** A narrow physical hull lets the visible pod glide past jagged and curved tile corners. */
  horizontalCollisionInset: 8,
};
export const UNDERGROUND_BUILDING = {
  minimumDepthMeters: 180,
  platform: { credits: 140, materials: { copper: 2, iron: 1 }, widthTiles: 5 },
  service: { credits: 420, materials: { iron: 3, silver: 2 }, widthTiles: 5, uniquePerMap: true },
  turret: { credits: 560, materials: { iron: 4, silver: 3 }, widthTiles: 3, range: 440, reloadSeconds: 1.4, maxPerMap: 3 },
  'trade-post': { credits: 0, materials: { copper: 4, iron: 4, silver: 2 }, widthTiles: 5, maxPerMap: 1 },
  habitat: { credits: 0, materials: { copper: 6, iron: 4 }, widthTiles: 7, maxPerMap: 3, serviceRadius: 220 },
  warehouse: { credits: 0, materials: { iron: 3, silver: 1 }, widthTiles: 5, maxPerMap: 1, baseCapacity: 40, capacityUpgrade: [0, 240, 520, 900] },
  extractor: { credits: 0, materials: { copper: 3, iron: 1 }, widthTiles: 4, maxPerMap: 4, ratesPerHour: [0, 24, 48, 96], upgradeCredits: [0, 0, 680, 1800] },
  automation: { offlineCapSeconds: 43200 },
  wall: { credits: 80, materials: { copper: 1 }, widthTiles: 1, maxPerMap: 12 },
  gate: { credits: 220, materials: { iron: 2 }, widthTiles: 3, maxPerMap: 3 },
  fort: { credits: 1400, materials: { iron: 8, silver: 5 }, widthTiles: 7, maxPerMap: 1, integrity: 4, linkRadius: 640, rangeBonus: 120 },
  maxStructuresPerMap: 20,
  serviceRadius: 100,
} as const;
export const EXTRACTOR_TIERS = [
  { name: 'Basic Excavator', rate: 24, ores: ['copper', 'iron'] as const, upgradeCredits: 680, upgradeMaterials: { iron: 6, silver: 2 } },
  { name: 'Industrial Drill', rate: 48, ores: ['copper', 'iron', 'silver'] as const, upgradeCredits: 1800, upgradeMaterials: { iron: 10, silver: 8 } },
  { name: 'Deep-Core Extractor', rate: 96, ores: ['silver', 'gold', 'diamond', 'nickel', 'titanium', 'cobalt', 'cryocrystal'] as const, upgradeCredits: 0, upgradeMaterials: {} },
] as const;
export const EXTRACTION_SEAMS = { width: 320, units: 60 } as const;
export const WAREHOUSE_CAPACITY_TIERS = [40, 100, 200, 360] as const;
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
  fortFirstWarningSeconds: 20,
  fortRepeatWarningSeconds: 45,
  arrivalDistance: 360,
  visibleColonyRadius: 900,
} as const;
export const TURRET_TIERS = [
  { range: 440, reloadSeconds: 1.4, upgradeCredits: 0 },
  { range: 560, reloadSeconds: 1.05, upgradeCredits: 420 },
  { range: 680, reloadSeconds: 0.8, upgradeCredits: 720 },
] as const;
export const TRADE_NETWORK = { saleBonusPerRemotePost: 0.1, maxSaleBonus: 0.4, relaySaleBonus: 0.05 } as const;
export function tradeNetworkPremium(saleValue: number, connectedPosts: number, hasLocalPost: boolean, relayOnline = false) {
  if (!Number.isFinite(saleValue) || !Number.isFinite(connectedPosts) || !hasLocalPost || connectedPosts < 2) return 0;
  const rate = Math.min(TRADE_NETWORK.maxSaleBonus + (relayOnline ? TRADE_NETWORK.relaySaleBonus : 0),
    (Math.floor(connectedPosts) - 1) * TRADE_NETWORK.saleBonusPerRemotePost + (relayOnline ? TRADE_NETWORK.relaySaleBonus : 0));
  return Math.floor(Math.max(0, saleValue) * rate);
}
// Leave enough speed margin for the pod's 980 px/s² thrust to cancel gravity
// before reaching the hard-impact threshold. Warn at 35% of the safe threshold.
export const DESCENT_WARNING_SPEED = PHYSICS.safeImpact * 0.35;
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
  nickel: { name: 'Nickel', value: 72, color: 0xb9c58c, hex: '#b9c58c', min: 180, max: 1800, rarity: 0.12 },
  titanium: { name: 'Titanium', value: 155, color: 0xa5bdf0, hex: '#a5bdf0', min: 600, max: Infinity, rarity: 0.095 },
  cobalt: { name: 'Cobalt', value: 125, color: 0x6e98ff, hex: '#6e98ff', min: 360, max: 2400, rarity: 0.09 },
  cryocrystal: { name: 'Cryocrystal', value: 210, color: 0xd5f8ff, hex: '#d5f8ff', min: 288, max: 600, rarity: 0.075 },
} as const;
export type Ore = keyof typeof ORES;
export const COMMON_ORES = ['copper', 'iron', 'silver'] as const;
export const PLANET_EXCLUSIVE_ORES = { 'mars-frontier': 'nickel', 'cryo-shelf': 'cryocrystal', 'hull-graveyard': 'titanium', 'prism-fault': 'diamond', 'cinder-vale': 'cobalt', 'vesper-9': 'gold' } as const;
export const ORE_KEYS = Object.keys(ORES) as Ore[];
export const ORE_SILHOUETTES = {
  copper: 'chips',
  iron: 'bars',
  silver: 'spires',
  gold: 'nuggets',
  diamond: 'facets', nickel: 'hexagons', titanium: 'needles', cobalt: 'crosses', cryocrystal: 'snowflakes',
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
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 1.5, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [0x17252c, 0x17252c, 0x8c6356, 0x8c6356], ground: 0xba805c, edge: 0xe0a776, mountains: [0x594f4e, 0x79594e, 0x9c6851], moon: 0xc6b4a2 },
  },
  'cryo-shelf': {
    name: 'Cryo Shelf',
    shortName: 'ICE MOON / CRYO SHELF',
    strata: ['CRYO DUST', 'FROZEN BASALT', 'BURIED HULL', 'DEEP ICE', 'CORE SHADOW'],
    palette: [0x527884, 0x415e70, 0x37495f, 0x293c54, 0x25344b],
    caveChance: 0.17,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 1.5 },
    surface: { sky: [0x101b29, 0x152c3b, 0x315564, 0x59838c], ground: 0x638995, edge: 0xa9d5d5, mountains: [0x293e50, 0x365669, 0x4a6d79], moon: 0xa4d1d3 },
  },
  'hull-graveyard': {
    name: 'Hull Graveyard',
    shortName: 'ARK REMAINS / HULL GRAVEYARD',
    strata: ['OUTER PLATING', 'BROKEN DECKS', 'ENGINE BULKHEAD', 'REACTOR VAULT', 'BLACK BOX'],
    palette: [0x596d68, 0x495b5c, 0x464b55, 0x373c48, 0x28353d],
    caveChance: 0.21,
    geodeChance: 0,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 1.5, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [0x101b21, 0x1d3035, 0x34464a, 0x647b77], ground: 0x596c69, edge: 0xa1b3a2, mountains: [0x25373a, 0x354647, 0x4e625c], moon: 0xb2c8c0 },
  },
  'prism-fault': {
    name: 'Prism Fault',
    shortName: 'CRYSTAL FAULT / PRISM VEIN',
    strata: ['GLASS CRUST', 'PRISM BED', 'SILVER FAULT', 'LUMEN VEIN', 'CORE GEODE'],
    palette: [0x645b80, 0x564f79, 0x43486f, 0x345569, 0x244f5c],
    caveChance: 0.09,
    geodeChance: 0.08,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 1.5, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [0x171629, 0x242344, 0x373764, 0x565480], ground: 0x655f82, edge: 0xb3b1ed, mountains: [0x2d2b4b, 0x3d3b62, 0x535273], moon: 0xc3c7ed },
  },
  'cinder-vale': {
    name: 'Cinder Vale',
    shortName: 'EMBER WORLD / CINDER VALE',
    strata: ['ASHGLASS COAST', 'OBSIDIAN RIFT', 'SULFUR VEIL', 'SEALED MAGMA', 'EMBER HEART'],
    palette: [0x79534c, 0x5d4548, 0x51414a, 0x453a42, 0x382d3c],
    caveChance: 0.16,
    geodeChance: 0.04,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 0, diamond: 0, nickel: 0, titanium: 0, cobalt: 1.5, cryocrystal: 0 },
    surface: { sky: [0x1c1720, 0x30212a, 0x59383a, 0x8e5140], ground: 0x694640, edge: 0xf08a58, mountains: [0x332a34, 0x4b3439, 0x70433c], moon: 0xe8a36c },
  },
  'vesper-9': {
    name: 'Vesper-9',
    shortName: 'RETURN WORLD / VESPER-9',
    strata: ['LANTERN GROVE', 'ROOTED SHELF', 'ECHO REEF', 'DUSK MANTLE', 'CRYSTAL CORE'],
    palette: [0x426f65, 0x375c5c, 0x344d59, 0x303e55, 0x27354a],
    caveChance: 0.23,
    geodeChance: 0.08,
    oreFactors: { copper: 1, iron: 1, silver: 1, gold: 1.5, diamond: 0, nickel: 0, titanium: 0, cobalt: 0, cryocrystal: 0 },
    surface: { sky: [0x101b27, 0x172c3a, 0x315957, 0x64836b], ground: 0x426d5d, edge: 0xb2dc9a, mountains: [0x243d42, 0x31534d, 0x476b55], moon: 0xc0dca5 },
  },
} as const;
// Region signature finds are generated from the map seed and tile coordinate, so
// cached chunks can be discarded without adding feature state to player saves.
export type MapId = keyof typeof MAPS;
export const CORE_RELICS = [
  { id: 'core-mars', mapId: 'mars-frontier', name: 'Mars core', tint: 0xffb66e, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
  { id: 'core-cryo', mapId: 'cryo-shelf', name: 'Cryo core', tint: 0x9bf1e2, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
  { id: 'core-hull', mapId: 'hull-graveyard', name: 'Iron core', tint: 0xa7d9bd, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
  { id: 'core-prism', mapId: 'prism-fault', name: 'Prism core', tint: 0xc5a7ff, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
  { id: 'core-cinder', mapId: 'cinder-vale', name: 'Cinder core', tint: 0xff9460, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
  { id: 'core-vesper', mapId: 'vesper-9', name: 'Vesper core', tint: 0xb2e98e, detail: 'Concentrated planetary material used by the mothership jump drive.', record: 'Core extracted. Fuel transferred to the mothership.', bounty: 0 },
] as const satisfies readonly { id: string; mapId: MapId; name: string; tint: number; detail: string; record: string; bounty: number }[];
/** A recovered planetary core powers several interplanetary jumps; this is separate from pod flight fuel. */
export const CORE_FUEL = { unitsPerCore: 4, jumpCost: 1, legacyReserve: 6, extractionSeconds: 10, renewableCeiling: 4 } as const;
export const CORE_SURVEY_CONCLUSION = {
  title: 'Six planetary cores extracted',
  transcript: 'All six planets are logged. Expand your mining camps and trade network.',
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
    name: 'Battery',
    description: 'Stay out a little longer.',
    values: [140, 190, 260, 350, 480],
    costs: [120, 320, 750, 1600],
    unit: ' charge capacity',
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
  { firstLevel: 6, label: 'FIRST PLANETARY CORE RECOVERED', requirement: 'first-core' },
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
  if (gate.requirement === 'first-core') return state.coreRelics.some((id) => CORE_RELICS.some((relic) => relic.id === id));
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
  enginePerLevel: 0.02, scannerPerLevel: 0.015, grapplePerLevel: 0.015, shipPartBonus: 0.035, maxScale: 1.84,
} as const;
export const podVisualScale = (levels: Pick<Levels, 'drill' | 'cargo' | 'fuel' | 'hull' | 'engine' | 'scanner' | 'grapple'>, shipParts = 0) => {
  const tierGrowth = (key: keyof typeof POD_SIZE, level: number) => Math.max(0, level - 1) * POD_SIZE[key];
  return Math.min(POD_SIZE.maxScale, 1 + tierGrowth('drillPerLevel', levels.drill) +
    tierGrowth('cargoPerLevel', levels.cargo) + tierGrowth('fuelPerLevel', levels.fuel) +
    tierGrowth('hullPerLevel', levels.hull) + tierGrowth('enginePerLevel', levels.engine) +
    tierGrowth('scannerPerLevel', levels.scanner) + tierGrowth('grapplePerLevel', levels.grapple) +
    Math.max(0, Math.min(Object.keys(SHIP_COMPONENTS).length, Math.floor(shipParts))) * POD_SIZE.shipPartBonus);
};
export const SERVICE = { fuelPrice: 0, hullPrice: 0.45 };

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
export const HULL_SCRAPPER = {
  hullDamage: 8,
  drillHitsToDefeat: 3,
  huntSpeed: 31,
  contactRadius: 31,
  armorFrontDot: 0.45,
} as const;
export const POD_PAINTS = {
  hab: { name: 'Hab Standard', description: 'The hard-wearing outpost finish.', cost: 0, hull: 0xeac781, trim: 0xffdfa0, light: 0xfff0bc },
  polar: { name: 'Polar White', description: 'High-visibility ice-runner enamel.', cost: 180, hull: 0x62c7c7, trim: 0xb0f1e4, light: 0xe1fff0 },
  ark: { name: 'Ark Salvage', description: 'Deep green, recovered from the old hull.', cost: 360, hull: 0x83b88e, trim: 0xc8e8ad, light: 0xe8ffd1 },
  prism: { name: 'Prism Bloom', description: 'Violet lacquer with a crystal-bright edge.', cost: 600, hull: 0xb59ae8, trim: 0xe1caff, light: 0xf2e8ff },
} as const;
export type PodPaint = keyof typeof POD_PAINTS;
export const POD_PAINT_KEYS = Object.keys(POD_PAINTS) as PodPaint[];
export const PILOT_SUITS = {
  hab: { name: 'Hab Issue', description: 'Standard insulated outpost suit.', cost: 0, body: 0xd9dfd0, trim: 0xeac781 },
  polar: { name: 'Polar Survey', description: 'Reflective ice-runner shell.', cost: 160, body: 0x55b8bd, trim: 0xcaf8ee },
  ark: { name: 'Ark Salvage', description: 'Field repairs stitched from mothership canvas.', cost: 320, body: 0x739a72, trim: 0xc8e8ad },
  prism: { name: 'Prism Runner', description: 'A violet suit with a bright helmet seal.', cost: 520, body: 0x9a79c9, trim: 0xe1caff },
} as const;
export type PilotSuit = keyof typeof PILOT_SUITS;
export const PILOT_SUIT_KEYS = Object.keys(PILOT_SUITS) as PilotSuit[];
export const POD_DECALS = {
  standard: { name: 'Hab Mark', description: 'Outpost identification stripe.', cost: 0, color: 0xeac781, style: 'stripe' },
  arrow: { name: 'Descent Arrow', description: 'A bold directional survey mark.', cost: 140, color: 0x72ddd0, style: 'arrow' },
  ark: { name: 'Mothership Crest', description: 'The lost ship’s recovery insignia.', cost: 280, color: 0xa4d6a3, style: 'crest' },
  prism: { name: 'Prism Trace', description: 'A luminous mark for deep runs.', cost: 440, color: 0xc3a2ff, style: 'prism' },
} as const;
export type PodDecal = keyof typeof POD_DECALS;
export const POD_DECAL_KEYS = Object.keys(POD_DECALS) as PodDecal[];
export const POD_PROFILES = {
  standard: { name: 'Hab Runner', description: 'Balanced outpost frame · warm cabin glow.', cost: 0, style: 'standard', cabin: 0x93d4cc },
  antenna: { name: 'Survey Scout', description: 'Beacon mast and sensor vane · mint cabin glow.', cost: 220, style: 'antenna', cabin: 0xa5f1d1 },
  stabilizers: { name: 'Cavern Surveyor', description: 'Twin landing fins · ice-blue cabin glow.', cost: 360, style: 'stabilizers', cabin: 0x94dfff },
  armor: { name: 'Ark Bulwark', description: 'Recovered side rails · amber cabin glow.', cost: 540, style: 'armor', cabin: 0xffca86 },
} as const;
export type PodProfile = keyof typeof POD_PROFILES;
export const POD_PROFILE_KEYS = Object.keys(POD_PROFILES) as PodProfile[];

export const CAMPAIGN_MILESTONES = [
  { id: 'first-core-sample', depth: 90, title: 'Shallow strata surveyed', detail: 'Copper and iron occur below the surface.' },
  { id: 'basalt-vein', depth: 300, title: 'Basalt vein mapped', detail: 'The survey reveals a sealed pocket below the iron shelf.' },
  { id: 'deep-scan', depth: 600, title: 'Deep scan recovered', detail: 'Harder rock lies beneath the upper mineral seams.' },
  { id: 'route-signal', depth: 1050, title: 'Deep strata surveyed', detail: 'The lower strata contain denser mineral deposits.' },
] as const;
export const ROUTE_FRAGMENTS = [
  { id: 'fragment-1', milestoneId: 'first-core-sample', row: 8, x: 24, title: 'Warm core sample', landmark: 'Thermal Observatory', chamber: { halfWidth: 4, halfHeight: 2 }, detail: 'A live thermal trace reveals a safe fracture through the shelf.' },
  { id: 'fragment-2', milestoneId: 'basalt-vein', row: 27, x: 24, title: 'Basalt sample', landmark: 'Basalt Engine Hall', chamber: { halfWidth: 5, halfHeight: 2 }, detail: 'A sample of iron-bearing basalt.' },
  { id: 'fragment-3', milestoneId: 'deep-scan', row: 52, x: 24, title: 'Deep mineral sample', landmark: 'Deep rock cavern', chamber: { halfWidth: 6, halfHeight: 3 }, detail: 'A mineral sample from a deep fracture.' },
  { id: 'fragment-4', milestoneId: 'route-signal', row: 90, x: 24, title: 'Lower strata sample', landmark: 'Lower rock cavern', chamber: { halfWidth: 7, halfHeight: 3 }, detail: 'A sample from the lower geological layer.' },
] as const;
// Optional, offline archive collectibles; these fictional hashes have no value or exchange path.
export const NAVIGATION_HASHES = [
  { id: 'hash-cryo', mapId: 'cryo-shelf', x: 12, row: 16, name: 'ICE SAMPLE', hash: '7C1A·09EF·B44D', crew: 'Asha Vale', role: 'Survey technician', transcript: 'Archived geological reading. This legacy record is kept with the expedition save.', detail: 'A shipyard checksum, signed before the mothership left orbit.' },
  { id: 'hash-hull', mapId: 'hull-graveyard', x: 12, row: 22, name: 'WRECK REGISTER', hash: 'A308·F11C·620B', crew: 'Orrin Bale', role: 'Flight Recorder', transcript: 'Archived geological reading. This legacy record is kept with the expedition save.', detail: 'A preserved survey record.' },
  { id: 'hash-prism', mapId: 'prism-fault', x: 36, row: 32, name: 'CRYSTAL SAMPLE', hash: 'D9E2·44A7·C015', crew: 'Imani Cho', role: 'Navigator', transcript: 'Archived geological reading. This legacy record is kept with the expedition save.', detail: 'An archived reading from the crystal strata.' },
  { id: 'hash-mars', mapId: 'mars-frontier', x: 9, row: 20, name: 'RED DUST INDEX', hash: '51B7·C82D·A903', crew: 'Sol Reyes', role: 'Surface Lead', transcript: 'Archived geological reading. This legacy record is kept with the expedition save.', detail: 'A checksum from the first surface team, preserved under the frontier.' },
] as const;
export const CREW_ARCHIVE_CONCLUSION = {
  title: 'LEGACY SURVEY RECORDS',
  author: 'Asha Vale',
  role: 'Survey technician · Final annotation',
  transcript: 'Archived geological reading. This legacy record is kept with the expedition save.',
} as const;
export type NavigationHashId = (typeof NAVIGATION_HASHES)[number]['id'];
export type RouteFragmentId = (typeof ROUTE_FRAGMENTS)[number]['id'];
export const SHIP_COMPONENTS = {
  frame: { name: 'Ship frame', description: 'The craft’s reinforced outer structure.' },
  propulsion: { name: 'Engine', description: 'The engine that carries the craft between worlds.' },
  navigation: { name: 'Navigation unit', description: 'The unit that charts routes between planets.' },
  'life-support': { name: 'Life-support unit', description: 'The system that keeps the craft and crew alive.' },
} as const;
export type ShipComponent = keyof typeof SHIP_COMPONENTS;
export const ROUTE_SHIP_COMPONENTS: Record<RouteFragmentId, ShipComponent> = {
  'fragment-1': 'frame',
  'fragment-2': 'propulsion',
  'fragment-3': 'navigation',
  'fragment-4': 'life-support',
};
export const ROUTE_PART_RECOVERY_BONUS = 200;

export const SOLAR_SYSTEM = {
  distancePerFuel: 400, landingRadius: 48,
  planets: {
    'cryo-shelf': { x: -420, y: -130 },
    'hull-graveyard': { x: -190, y: 125 },
    'prism-fault': { x: 130, y: -155 },
    'mars-frontier': { x: 320, y: 135 },
    'cinder-vale': { x: -40, y: 240 },
    'vesper-9': { x: 485, y: -215 },
  },
} as const;

export const MOTHERSHIP = { x: 555, serviceRadius: 190, storageCapacity: 50 };

export const STARTER_MATERIAL_SEAMS = [
  { ore: 'copper', left: 16, right: 19, top: 0, bottom: 2 },
  { ore: 'iron', left: 16, right: 19, top: 3, bottom: 4 },
  { ore: 'silver', left: 16, right: 19, top: 8, bottom: 9 },
] as const;

export const CIVILISATIONS = {
  helion: { name: 'Helion', title: 'The inhabited world', buyer: 'Helion Municipal Works', color: '#eac27d', kind: 'city', population: '8.4 billion',
    description: 'A planet of linked coastal cities. Its night side traces the old continental railways in amber light.',
    history: 'Helion grew around water, not mines. Its cities agreed to leave their watershed mountains intact and buy industrial metals from expedition crews. The Municipal Works charter still requires every shipment to name the district it serves.',
    projects: [{ name: 'Eastern power grid', ore: 'copper', units: 24 }, { name: 'Harbour rail extension', ore: 'iron', units: 32 }, { name: 'Stormproof substations', ore: 'cobalt', units: 12 }] },
  kepler: { name: 'Kepler Reach', title: 'The shipbuilding world', buyer: 'Kepler Orbital Yards', color: '#b2bce9', kind: 'shipyard', population: '640 million',
    description: 'Drydocks encircle a steel-blue ocean. Freighters wait above the terminator for their final hull plates.',
    history: 'Kepler began as a repair stop for vessels that could not make the next crossing. Dockworkers assembled the first permanent ring from abandoned freighter frames. Today the yards still reserve one berth for a stranded ship, regardless of its captain’s ability to pay.',
    projects: [{ name: 'Freighter repair berths', ore: 'nickel', units: 18 }, { name: 'Long-haul hull programme', ore: 'titanium', units: 16 }, { name: 'Navigation contacts', ore: 'gold', units: 10 }] },
  verdant: { name: 'Verdant', title: 'The garden world', buyer: 'Verdant Growers Cooperative', color: '#a4cf96', kind: 'garden', population: '1.2 billion',
    description: 'Greenhouse belts follow the warm latitudes. Reservoir mirrors flash between farms and small settlements.',
    history: 'The first harvest on Verdant fed three other colonies before it fed a city of its own. Growers built their cooperative around that obligation. Imported metal becomes pumps, rails and cold stores: the quiet machinery that keeps food moving between worlds.',
    projects: [{ name: 'Northern irrigation ring', ore: 'iron', units: 20 }, { name: 'Greenhouse distribution', ore: 'copper', units: 28 }, { name: 'Cold-store controls', ore: 'silver', units: 12 }] },
  lyra: { name: 'Lyra Station', title: 'The research world', buyer: 'Lyra Survey Institute', color: '#c9b4ee', kind: 'research', population: '38 million',
    description: 'Observatories occupy the high plateaus. Small laboratory cities shelter beneath pale atmospheric bands.',
    history: 'Lyra’s founders shared a telescope before they shared a government. Their institute treats field miners as collaborators: a labelled sample from a difficult seam can matter more than a polished instrument. The survey archive keeps the name of the expedition that supplied each new study.',
    projects: [{ name: 'Precision instrument array', ore: 'silver', units: 18 }, { name: 'Deep-pressure laboratory', ore: 'diamond', units: 8 }, { name: 'Cryogenic resonator study', ore: 'cryocrystal', units: 12 }] },
} as const;
export type CivilisationId = keyof typeof CIVILISATIONS;
export const CIVILISATION_KEYS = Object.keys(CIVILISATIONS) as CivilisationId[];
export const CIVILIAN_DEMAND = { premium: 0.35 } as const;

/** Pre-build release policy. Core collection is retained; interplanetary flight is not released. */
export const PREBUILD = { travelEnabled: false, basicRigMaxLevel: 5 } as const;
/** Verified starter workshop exposes only tracks already wired into server replay. */
export const ONLINE_BASIC_UPGRADES = ['drill','fuel','cargo','hull','engine'] as const;
export type OnlineBasicUpgrade = typeof ONLINE_BASIC_UPGRADES[number];
export const RIG_MATERIAL_BASE: Record<Upgrade, Partial<Record<Ore, number>>> = {
  drill: { iron: 3, copper: 2 }, fuel: { copper: 3, silver: 1 }, cargo: { iron: 3, copper: 3 },
  hull: { iron: 4, copper: 1 }, engine: { copper: 3, iron: 2 }, scanner: { copper: 2, silver: 2 }, grapple: { iron: 2, copper: 2 },
};
export function rigMaterialCost(key: Upgrade, fittedLevel: number): Partial<Record<Ore, number>> {
  return Object.fromEntries(Object.entries(RIG_MATERIAL_BASE[key]).map(([ore, units]) => [ore, units! * fittedLevel]));
}
export const RIG_SPECIALIST_PLANS = [
  { name: 'Reinforced hull', ore: 'nickel', world: 'mars-frontier', description: 'A tougher rig for demanding excavations.' },
  { name: 'Efficient cooling', ore: 'cryocrystal', world: 'cryo-shelf', description: 'A cooling-focused mining setup.' },
  { name: 'Lightweight cargo bay', ore: 'titanium', world: 'hull-graveyard', description: 'A specialist hauler built around carrying more ore.' },
  { name: 'Precision drill', ore: 'diamond', world: 'prism-fault', description: 'A cutting-focused rig for deep mining.' },
  { name: 'High-capacity battery', ore: 'cobalt', world: 'cinder-vale', description: 'An endurance-focused exploration rig.' },
  { name: 'Advanced scanner', ore: 'gold', world: 'vesper-9', description: 'A survey-focused rig for finding valuable seams.' },
] as const;

/** Optional local buyers. Quantities are paid once, independently of old sale bonuses. */
export const COLONY_ORDERS = [
  { key: 'bulk', name: 'Bulk delivery', ore: 'copper', units: 12, rewardMultiplier: 1.25 },
  { key: 'survey', name: 'Survey request', ore: 'exclusive', units: 2, rewardMultiplier: 1.5 },
  { key: 'construction', name: 'Construction supply', ore: 'iron', units: 8, rewardMultiplier: 1.25 },
] as const;

export const FRONTIER = { worlds: ['cryo-shelf', 'mars-frontier'] as readonly MapId[], shipCapacity: MOTHERSHIP.storageCapacity, transitMs: 2400 };
export const SPECIALIST_MODULES = {
  reinforcedHull: { name: 'Reinforced hull', materials: { nickel: 4, iron: 6 }, hullMultiplier: 1.2 },
  efficientCooling: { name: 'Efficient cooling', materials: { cryocrystal: 4, copper: 4 }, drillingMultiplier: 0.9 },
} as const;
export type SpecialistModule = keyof typeof SPECIALIST_MODULES;

/** Beta exchange limits. Server rules must use the same versioned values. */
export const ONLINE_RULESET = 'online-1' as const;
export const PLAYER_EXCHANGE_LIMITS = {
  activeListings: 10,
  minQuantityHalfUnits: 1,
  maxQuantityHalfUnits: 2_000,
  minPriceCreditsPerOre: 1,
  maxPriceCreditsPerOre: 100_000,
  maxListingTotalCreditMinor: 1_000_000_000,
} as const;
export const ONLINE_INPUT_LIMITS = {
  fixedStepMs: 20,
  maxSegmentMs: 240,
  maxSegmentsPerBatch: 20,
  maxBatchMs: 1_000,
} as const;
