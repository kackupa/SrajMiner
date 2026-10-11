import { EXTRACTOR_TIERS, MAPS, UNDERGROUND_BUILDING, SURFACE_RAID, TURRET_TIERS, WAREHOUSE_CAPACITY_TIERS, WORLD, depthAtWorldY, type MapId, type Ore } from '../config';
import type { Cargo } from '../economy/Progress';
import type { TileWorld } from '../world/TileWorld';

export type StructureKind = 'platform' | 'service' | 'turret' | 'trade-post' | 'habitat' | 'warehouse' | 'extractor' | 'wall' | 'gate' | 'fort';
export type SurfaceStructureKind = Exclude<StructureKind, 'platform' | 'service'>;
export type UndergroundStructure = { id: string; kind: StructureKind; x: number; y: number; reload?: number; integrity?: number; level?: number; productionFraction?: number };

export const warehouseCapacity = (structures: readonly UndergroundStructure[]) => {
  const warehouse = structures.find((entry) => entry.kind === 'warehouse');
  return warehouse ? WAREHOUSE_CAPACITY_TIERS[Math.max(0, Math.min(WAREHOUSE_CAPACITY_TIERS.length - 1, (warehouse.level ?? 1) - 1))]! : 0;
};
export function upgradeWarehouse(structures: readonly UndergroundStructure[], credits: number) {
  const warehouse = structures.find((entry) => entry.kind === 'warehouse'), level = warehouse?.level ?? 1,
    cost = UNDERGROUND_BUILDING.warehouse.capacityUpgrade[level];
  if (!warehouse || cost === undefined || credits < cost) return undefined;
  return { credits: credits - cost, level: level + 1 };
}
export function upgradeExtractor(structure: UndergroundStructure, cargo: Cargo, credits: number) {
  const level = structure.level ?? 1, next = EXTRACTOR_TIERS[level - 1];
  if (structure.kind !== 'extractor' || !next || credits < next.upgradeCredits ||
      Object.entries(next.upgradeMaterials).some(([ore, units]) => cargo[ore as Ore] < units)) return undefined;
  const nextCargo = { ...cargo };
  for (const [ore, units] of Object.entries(next.upgradeMaterials)) nextCargo[ore as Ore] -= units;
  return { credits: credits - next.upgradeCredits, level: level + 1, cargo: nextCargo };
}
export function extractorOreEligibility(mapId: MapId, level: number): Ore[] {
  const ores = EXTRACTOR_TIERS[Math.max(0, Math.min(EXTRACTOR_TIERS.length - 1, level - 1))]!.ores;
  return [...ores].filter((ore) => MAP_ORE_FACTORS[mapId][ore] > 0);
}
const MAP_ORE_FACTORS = Object.fromEntries(Object.entries(MAPS).map(([id, map]) => [id, map.oreFactors])) as Record<MapId, Record<Ore, number>>;

export const structureIntegrity = (kind: StructureKind) => kind === 'fort' ? UNDERGROUND_BUILDING.fort.integrity : kind === 'extractor' ? 1 : SURFACE_RAID.integrity;
export const turretStats = (structure: UndergroundStructure) => TURRET_TIERS[Math.max(0, Math.min(TURRET_TIERS.length - 1, (structure.level ?? 1) - 1))]!;
export function upgradeTurret(structure: UndergroundStructure, credits: number) {
  const level = structure.level ?? 1, next = TURRET_TIERS[level];
  if (structure.kind !== 'turret' || !next || credits < next.upgradeCredits) return undefined;
  return { credits: credits - next.upgradeCredits, level: level + 1 };
}

export function linkedFort(world: TileWorld, structure: UndergroundStructure, structures: readonly UndergroundStructure[]) {
  if (Math.min(Math.abs(structure.y), Math.abs(structure.y - world.farSurfaceY)) > WORLD.tile * 4) return undefined;
  return structures.find(entry => entry.kind === 'fort' && globeSurfaceDistance(world, structure.x, structure.y, entry.x, entry.y) <= UNDERGROUND_BUILDING.fort.linkRadius);
}

export function surfaceTurretRange(world: TileWorld, turret: UndergroundStructure, structures: readonly UndergroundStructure[]) {
  return turretStats(turret).range + (linkedFort(world, turret, structures) ? UNDERGROUND_BUILDING.fort.rangeBonus : 0);
}

export function surfaceArcCoordinate(world: TileWorld, x: number, y: number) {
  const circumference = world.widthTiles * WORLD.tile,
    u = ((x / WORLD.tile) % world.widthTiles + world.widthTiles) % world.widthTiles;
  return y < world.coreWorldY
    ? u * WORLD.tile
    : circumference + u * WORLD.tile;
}

export function surfaceArcPoint(world: TileWorld, coordinate: number, snap = true) {
  const half = world.widthTiles * WORLD.tile, full = half * 2,
    wrapped = ((coordinate % full) + full) % full,
    s = snap ? Math.round(wrapped / WORLD.tile - 0.5) * WORLD.tile + WORLD.tile / 2 : wrapped;
  return s < half
    ? { x: s, y: 0 }
    : { x: s - half, y: world.farSurfaceY };
}

export function validateSurfaceStructureSite(
  world: TileWorld,
  kind: SurfaceStructureKind,
  site: { x: number; y: number },
  existing: readonly UndergroundStructure[],
  cargo: Record<Ore, number>,
  credits: number,
): { valid: true } | { valid: false; reason: 'LIMIT' | 'OCCUPIED' | 'NEED MATERIALS / CREDITS' } {
  const rule = UNDERGROUND_BUILDING[kind];
  const playerStructures = existing.filter((entry) => !entry.id.startsWith('station:'));
  if (playerStructures.length >= UNDERGROUND_BUILDING.maxStructuresPerMap ||
      kind === 'habitat' && playerStructures.filter((entry) => entry.kind === 'habitat').length >= rule.maxPerMap ||
      kind === 'turret' && playerStructures.filter((entry) => entry.kind === 'turret').length >= rule.maxPerMap ||
      kind === 'trade-post' && playerStructures.some((entry) => entry.kind === 'trade-post') ||
      kind === 'warehouse' && playerStructures.some((entry) => entry.kind === 'warehouse') ||
      kind === 'fort' && playerStructures.some((entry) => entry.kind === 'fort') ||
      kind === 'extractor' && playerStructures.filter((entry) => entry.kind === 'extractor').length >= rule.maxPerMap ||
      (kind === 'wall' || kind === 'gate') && playerStructures.filter((entry) => entry.kind === kind).length >= rule.maxPerMap)
    return { valid: false, reason: 'LIMIT' };
  if (!canAffordStructure(kind, cargo, credits)) return { valid: false, reason: 'NEED MATERIALS / CREDITS' };
  const candidateArc = surfaceArcCoordinate(world, site.x, site.y), half = world.widthTiles * WORLD.tile,
    candidateSurfaceY = site.y < world.coreWorldY ? 0 : world.farSurfaceY,
    candidateOutward = Math.abs(site.y - candidateSurfaceY),
    distanceOnGlobe = (a: number, b: number) => {
      const difference = Math.abs(a - b) % (half * 2);
      return Math.min(difference, half * 2 - difference);
    },
    candidateHalfWidth = rule.widthTiles * WORLD.tile / 2;
  let supportedWallLayer = candidateOutward === 0;
  for (const entry of existing) {
    if (kind === 'wall' && entry.kind === 'wall') {
      const entrySurfaceY = entry.y < world.coreWorldY ? 0 : world.farSurfaceY,
        entryArc = surfaceArcCoordinate(world, entry.x, entry.y), difference = Math.abs(candidateArc - entryArc),
        arcDistance = Math.min(difference, half * 2 - difference),
        radialDistance = Math.abs(candidateOutward - Math.abs(entry.y - entrySurfaceY)),
        wallHalfWidths = (UNDERGROUND_BUILDING.wall.widthTiles + UNDERGROUND_BUILDING.wall.widthTiles) * WORLD.tile / 2;
      if (arcDistance < wallHalfWidths - 1 && radialDistance < WORLD.tile - 1)
        return { valid: false, reason: 'OCCUPIED' };
      if (arcDistance < wallHalfWidths - 1 &&
          Math.abs(Math.abs(entry.y - entrySurfaceY) - (candidateOutward - WORLD.tile)) < 1)
        supportedWallLayer = true;
      continue;
    }
    const onSurface = Math.min(Math.abs(entry.y), Math.abs(entry.y - world.farSurfaceY)) <= WORLD.tile * 4;
    if (!onSurface) continue;
    if (kind === 'wall' && candidateOutward >= WORLD.tile * 4) continue;
    const entryArc = surfaceArcCoordinate(world, entry.x, entry.y), entryHalfWidth = UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2;
    const normalDistance = distanceOnGlobe(candidateArc, entryArc), modularJoin = ['wall', 'gate', 'fort'].includes(kind) &&
      ['wall', 'gate', 'fort'].includes(entry.kind);
    if (normalDistance < candidateHalfWidth + entryHalfWidth + (modularJoin ? -1 : 8))
      return { valid: false, reason: 'OCCUPIED' };
  }
  if (kind === 'wall' && !supportedWallLayer) return { valid: false, reason: 'OCCUPIED' };
  return { valid: true };
}

export function canAffordStructure(kind: StructureKind, cargo: Record<Ore, number>, credits: number) {
  const cost = UNDERGROUND_BUILDING[kind];
  return credits >= cost.credits && Object.entries(cost.materials).every(([ore, units]) => cargo[ore as Ore] >= units);
}

export function repairSurfaceStructure(structure: UndergroundStructure, credits: number) {
  const maximum = structureIntegrity(structure.kind);
  if (!['habitat', 'turret', 'wall', 'gate', 'fort'].includes(structure.kind) ||
      (structure.integrity ?? maximum) >= maximum || credits < SURFACE_RAID.repairCredits) return undefined;
  return { credits: credits - SURFACE_RAID.repairCredits, integrity: maximum };
}

export function findSurfaceTradePostSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
) {
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap || existing.some((entry) => entry.kind === 'trade-post')) return undefined;
  const siteX = Math.min(x + 430, world.widthTiles * WORLD.tile - 140);
  if (siteX < 100) return undefined;
  return { x: siteX, y: world.gravitySign(y) > 0 ? 0 : world.farSurfaceY };
}

/** Surface habitats are built beside the miner as durable colony waystations. */
export function findSurfaceHabitatSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
) {
  const rule = UNDERGROUND_BUILDING.habitat;
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap ||
      existing.filter((entry) => entry.kind === 'habitat').length >= rule.maxPerMap) return undefined;
  const surfaceY = world.gravitySign(y) > 0 ? 0 : world.farSurfaceY;
  const minX = 100, maxX = world.widthTiles * WORLD.tile - 100;
  const spacing = Math.ceil(rule.widthTiles * WORLD.tile / 2) + 80;
  const candidates = Array.from({ length: 16 }, (_, i) =>
    x + (i % 2 === 0 ? 1 : -1) * (140 + Math.floor(i / 2) * spacing));
  const siteX = candidates.find((candidate) => candidate >= minX && candidate <= maxX &&
    existing.every((entry) => Math.hypot(entry.x - candidate, entry.y - surfaceY) >= spacing));
  return siteX === undefined ? undefined : { x: siteX, y: surfaceY };
}

export function nearbySurfaceHabitat(structures: readonly UndergroundStructure[], x: number, y: number, circumference: number) {
  return structures.find((entry) => {
    if (entry.kind !== 'habitat') return false;
    const dx = Math.abs(entry.x - x), wrappedDx = Math.min(dx, Math.max(0, circumference - dx));
    return Math.hypot(wrappedDx, entry.y - y) <= UNDERGROUND_BUILDING.habitat.serviceRadius;
  });
}

export function nearbyGlobeSurfaceStructure(
  structures: readonly UndergroundStructure[],
  x: number,
  y: number,
  world: TileWorld,
  kind: 'habitat' | 'trade-post' | 'warehouse',
  radius = kind === 'habitat' ? UNDERGROUND_BUILDING.habitat.serviceRadius : kind === 'warehouse' ? 180 : 180,
) {
  const fullArc = world.widthTiles * WORLD.tile * 2, pointArc = surfaceArcCoordinate(world, x, y);
  return structures.find((entry) => {
    if (entry.kind !== kind) return false;
    const onSurface = Math.min(Math.abs(entry.y), Math.abs(entry.y - world.farSurfaceY)) <= WORLD.tile * 4;
    if (!onSurface) return false;
    const difference = Math.abs(pointArc - surfaceArcCoordinate(world, entry.x, entry.y));
    return Math.min(difference, fullArc - difference) <= radius;
  });
}

/** Place a single warehouse on clear crust near the miner. */
export function findSurfaceWarehouseSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
) {
  const rule = UNDERGROUND_BUILDING.warehouse;
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap || existing.some((entry) => entry.kind === 'warehouse')) return undefined;
  const surfaceY = world.gravitySign(y) > 0 ? 0 : world.farSurfaceY,
    minX = 100, maxX = world.widthTiles * WORLD.tile - 100,
    spacing = rule.widthTiles * WORLD.tile + 80,
    candidates = Array.from({ length: 16 }, (_, i) => x + (i % 2 === 0 ? 1 : -1) * (140 + Math.floor(i / 2) * spacing)),
    siteX = candidates.find((candidate) => candidate >= minX && candidate <= maxX && existing.every((entry) => {
      if (Math.abs(entry.y - surfaceY) > 140) return true;
      const dx = Math.abs(entry.x - candidate), wrappedDx = Math.min(dx, world.widthTiles * WORLD.tile - dx),
        existingHalfWidth = UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2;
      return wrappedDx >= existingHalfWidth + rule.widthTiles * WORLD.tile / 2 + 28;
    }));
  return siteX === undefined ? undefined : { x: siteX, y: surfaceY };
}

export function findSurfaceBarrierSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
  kind: 'wall' | 'gate',
) {
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap ||
      existing.filter((entry) => entry.kind === kind).length >= UNDERGROUND_BUILDING[kind].maxPerMap) return undefined;
  const rule = UNDERGROUND_BUILDING[kind], origin = surfaceArcCoordinate(world, x, y), full = world.widthTiles * WORLD.tile * 2;
  for (let step = 5; step <= 48; step++) for (const direction of [1, -1]) {
    const site = surfaceArcPoint(world, origin + direction * step * WORLD.tile), arc = surfaceArcCoordinate(world, site.x, site.y), halfWidth = rule.widthTiles * WORLD.tile / 2;
    const fits = existing.every((entry) => {
      if (Math.min(Math.abs(entry.y), Math.abs(entry.y - world.farSurfaceY)) > WORLD.tile * 4) return true;
      const entryArc = surfaceArcCoordinate(world, entry.x, entry.y), difference = Math.abs(arc - entryArc), distance = Math.min(difference, full - difference),
        otherHalfWidth = UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2,
        modularJoin = (entry.kind === 'wall' || entry.kind === 'gate');
      return distance >= halfWidth + otherHalfWidth + (modularJoin ? -1 : 8);
    });
    if (fits) return site;
  }
  return undefined;
}

export function globeSurfaceDistance(world: TileWorld, x: number, y: number, otherX: number, otherY: number) {
  const fullArc = world.widthTiles * WORLD.tile * 2,
    difference = Math.abs(surfaceArcCoordinate(world, x, y) - surfaceArcCoordinate(world, otherX, otherY));
  return Math.min(difference, fullArc - difference);
}

export function findSurfaceTurretSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
) {
  const rule = UNDERGROUND_BUILDING.turret;
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap ||
      existing.filter((entry) => entry.kind === 'turret').length >= rule.maxPerMap) return undefined;
  const surfaceY = world.gravitySign(y) > 0 ? 0 : world.farSurfaceY;
  const minX = 100, maxX = world.widthTiles * WORLD.tile - 100;
  const circumference = world.widthTiles * WORLD.tile;
  const candidates = Array.from({ length: 16 }, (_, i) =>
    x + (i % 2 === 0 ? 1 : -1) * (140 + Math.floor(i / 2) * 180));
  const siteX = candidates.find((candidate) => candidate >= minX && candidate <= maxX && existing.every((entry) => {
    if (Math.abs(entry.y - surfaceY) > 140) return true;
    const dx = Math.abs(entry.x - candidate), wrappedDx = Math.min(dx, circumference - dx);
    const existingHalfWidth = UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2;
    return wrappedDx >= existingHalfWidth + rule.widthTiles * WORLD.tile / 2 + 28;
  }));
  return siteX === undefined ? undefined : { x: siteX, y: surfaceY };
}

export function findBuildSite(
  world: TileWorld,
  x: number,
  y: number,
  gravitySign: number,
  kind: StructureKind,
  existing: readonly UndergroundStructure[],
): { x: number; y: number } | undefined {
  const localDepth = depthAtWorldY(y, world.planetChart);
  if (localDepth < UNDERGROUND_BUILDING.minimumDepthMeters || localDepth > world.coreDepthMeters - 200) return undefined;
  const centerX = Math.floor(x / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
  const deckY = Math.round((y + gravitySign * WORLD.tile * 2) / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
  const row = Math.floor(deckY / WORLD.tile), tileX = Math.floor(centerX / WORLD.tile);
  const halfSpan = Math.floor(UNDERGROUND_BUILDING[kind].widthTiles / 2);
  for (let dx = -halfSpan; dx <= halfSpan; dx++) {
    for (let dy = kind === 'service' || kind === 'turret' ? -2 : 0; dy <= (kind === 'service' || kind === 'turret' ? 2 : 0); dy++) {
      if (world.solid(tileX + dx, row + dy)) return undefined;
    }
  }
  if (existing.length >= UNDERGROUND_BUILDING.maxStructuresPerMap) return undefined;
  if (kind === 'platform' && existing.filter((entry) => entry.kind === 'platform').length >= 12) return undefined;
  if (kind === 'service' && existing.some((entry) => entry.kind === 'service')) return undefined;
  if (kind === 'turret' && existing.filter((entry) => entry.kind === 'turret').length >= UNDERGROUND_BUILDING.turret.maxPerMap) return undefined;
  if (existing.some((entry) => Math.hypot(entry.x - centerX, entry.y - deckY) < 240)) return undefined;
  return { x: centerX, y: deckY };
}

export function crossedStructureDeck(
  structures: readonly UndergroundStructure[],
  x: number,
  fromY: number,
  toY: number,
  gravitySign: number,
  halfHeight: number,
  dropThrough: boolean,
) {
  if (dropThrough || Math.abs(toY - fromY) < 0.00001) return undefined;
  for (const structure of structures) {
    if (structure.kind === 'trade-post' || structure.kind === 'warehouse' || structure.kind === 'wall' || structure.kind === 'gate' || structure.kind === 'fort') continue;
    const width = UNDERGROUND_BUILDING[structure.kind].widthTiles * WORLD.tile / 2;
    if (Math.abs(x - structure.x) > width) continue;
    const fromFeet = fromY + gravitySign * halfHeight - structure.y;
    const toFeet = toY + gravitySign * halfHeight - structure.y;
    if (fromFeet * gravitySign <= 0 && toFeet * gravitySign >= 0) return structure.y - gravitySign * halfHeight;
  }
  return undefined;
}

export function nearbyServiceStation(structures: readonly UndergroundStructure[], x: number, y: number) {
  const service = structures.find((entry) => entry.kind === 'service' &&
    Math.hypot(entry.x - x, entry.y - y) <= UNDERGROUND_BUILDING.serviceRadius);
  return service;
}
