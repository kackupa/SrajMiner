import { UNDERGROUND_BUILDING, SURFACE_RAID, WORLD, depthAtWorldY, type Ore } from '../config';
import type { TileWorld } from '../world/TileWorld';

export type StructureKind = 'platform' | 'service' | 'turret' | 'trade-post' | 'habitat' | 'warehouse' | 'wall' | 'gate';
export type SurfaceStructureKind = 'turret' | 'trade-post' | 'habitat' | 'warehouse' | 'wall' | 'gate';
export type UndergroundStructure = { id: string; kind: StructureKind; x: number; y: number; reload?: number; integrity?: number };

export function surfaceArcCoordinate(world: TileWorld, x: number, y: number) {
  const circumference = world.widthTiles * WORLD.tile,
    u = ((x / WORLD.tile) % world.widthTiles + world.widthTiles) % world.widthTiles;
  return y < world.coreWorldY
    ? u * WORLD.tile
    : circumference + u * WORLD.tile;
}

export function surfaceArcPoint(world: TileWorld, coordinate: number) {
  const half = world.widthTiles * WORLD.tile, full = half * 2,
    wrapped = ((coordinate % full) + full) % full,
    s = Math.round(wrapped / WORLD.tile - 0.5) * WORLD.tile + WORLD.tile / 2;
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
      (kind === 'wall' || kind === 'gate') && playerStructures.filter((entry) => entry.kind === kind).length >= rule.maxPerMap)
    return { valid: false, reason: 'LIMIT' };
  if (!canAffordStructure(kind, cargo, credits)) return { valid: false, reason: 'NEED MATERIALS / CREDITS' };
  const candidateArc = surfaceArcCoordinate(world, site.x, site.y), half = world.widthTiles * WORLD.tile,
    distanceOnGlobe = (a: number, b: number) => {
      const difference = Math.abs(a - b) % (half * 2);
      return Math.min(difference, half * 2 - difference);
    },
    candidateHalfWidth = rule.widthTiles * WORLD.tile / 2;
  for (const entry of existing) {
    const onSurface = Math.min(Math.abs(entry.y), Math.abs(entry.y - world.farSurfaceY)) <= WORLD.tile * 4;
    if (!onSurface) continue;
    const entryArc = surfaceArcCoordinate(world, entry.x, entry.y), entryHalfWidth = UNDERGROUND_BUILDING[entry.kind].widthTiles * WORLD.tile / 2;
    const normalDistance = distanceOnGlobe(candidateArc, entryArc), modularJoin = (kind === 'wall' || kind === 'gate') &&
      (entry.kind === 'wall' || entry.kind === 'gate');
    if (normalDistance < candidateHalfWidth + entryHalfWidth + (modularJoin ? -1 : 8))
      return { valid: false, reason: 'OCCUPIED' };
  }
  return { valid: true };
}

export function canAffordStructure(kind: StructureKind, cargo: Record<Ore, number>, credits: number) {
  const cost = UNDERGROUND_BUILDING[kind];
  return credits >= cost.credits && Object.entries(cost.materials).every(([ore, units]) => cargo[ore as Ore] >= units);
}

export function repairSurfaceStructure(structure: UndergroundStructure, credits: number) {
  if (!['habitat', 'turret', 'wall', 'gate'].includes(structure.kind) ||
      (structure.integrity ?? SURFACE_RAID.integrity) >= SURFACE_RAID.integrity || credits < SURFACE_RAID.repairCredits) return undefined;
  return { credits: credits - SURFACE_RAID.repairCredits, integrity: SURFACE_RAID.integrity };
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
    if (structure.kind === 'trade-post' || structure.kind === 'warehouse' || structure.kind === 'wall' || structure.kind === 'gate') continue;
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
