import { EXTRACTOR_TIERS, BUILD_PLACEMENT, MAPS, UNDERGROUND_BUILDING, SURFACE_RAID, TURRET_TIERS, WAREHOUSE_CAPACITY_TIERS, WORLD, depthAtWorldY, type MapId, type Ore } from '../config';
import type { Cargo } from '../economy/Progress';
import type { TileWorld } from '../world/TileWorld';

export type StructureKind = 'platform' | 'service' | 'light' | 'turret' | 'trade-post' | 'habitat' | 'warehouse' | 'extractor' | 'wall' | 'gate' | 'fort';
export type SurfaceStructureKind = Exclude<StructureKind, 'platform' | 'service' | 'light'>;
export type UndergroundStructure = { id: string; kind: StructureKind; x: number; y: number; reload?: number; integrity?: number; level?: number; productionFraction?: number };

export const warehouseCapacity = (structures: readonly UndergroundStructure[]) => {
  return structures.filter(entry => entry.kind === 'warehouse').reduce((total, warehouse) => total + WAREHOUSE_CAPACITY_TIERS[Math.max(0, Math.min(WAREHOUSE_CAPACITY_TIERS.length - 1, (warehouse.level ?? 1) - 1))]!, 0);
};
export function upgradeWarehouse(structures: readonly UndergroundStructure[], credits: number, id?: string) {
  const warehouse = structures.find((entry) => entry.kind === 'warehouse' && (!id || entry.id === id)), level = warehouse?.level ?? 1,
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
    ? { x: s, y: world.surfaceHeight(s,0) }
    : { x: s - half, y: world.surfaceHeight(s-half,world.farSurfaceY) };
}

/** New buildings use a level deck with feet on natural terrain. Existing coordinates stay untouched. */
export function surfaceFoundation(world: TileWorld, kind: SurfaceStructureKind, site: {x:number;y:number}) {
  const gravity=world.gravitySign(site.y), half=UNDERGROUND_BUILDING[kind].widthTiles*WORLD.tile/2;
  const feet=[-half+4,0,half-4].map(dx=>{const x=site.x+dx,y=world.surfaceHeight(x,site.y);return {x,y,solid:world.solid(Math.floor(x/WORLD.tile),Math.floor((y+gravity*2)/WORLD.tile))};});
  const y=gravity>0?Math.min(...feet.map(f=>f.y)):Math.max(...feet.map(f=>f.y));
  return {x:site.x,y,feet,valid:feet.every(f=>f.solid&&Math.abs(f.y-y)<=BUILD_PLACEMENT.maxSupportDrop)};
}

export function validateSurfaceStructureSite(
  world: TileWorld,
  kind: SurfaceStructureKind,
  site: { x: number; y: number },
  existing: readonly UndergroundStructure[],
  cargo: Record<Ore, number>,
  credits: number,
): { valid: true } | { valid: false; reason: 'OCCUPIED' | 'NEED MATERIALS / CREDITS' | 'NEEDS SOLID GROUND' } {
  const rule = UNDERGROUND_BUILDING[kind];
  if (!canAffordStructure(kind, cargo, credits)) return { valid: false, reason: 'NEED MATERIALS / CREDITS' };
  const candidateArc = surfaceArcCoordinate(world, site.x, site.y), half = world.widthTiles * WORLD.tile,
    candidateSurfaceY = world.surfaceHeight(site.x,site.y),
    candidateOutward = Math.abs(site.y - candidateSurfaceY),
    distanceOnGlobe = (a: number, b: number) => {
      const difference = Math.abs(a - b) % (half * 2);
      return Math.min(difference, half * 2 - difference);
    },
    candidateHalfWidth = rule.widthTiles * WORLD.tile / 2;
  if(world.terrain && kind!=='wall' && !surfaceFoundation(world,kind,site).valid)
    return {valid:false,reason:'NEEDS SOLID GROUND'};
  if(world.terrain && kind==='wall' && candidateOutward===0 && !world.solid(Math.floor(site.x/WORLD.tile),Math.floor((site.y+world.gravitySign(site.y)*2)/WORLD.tile)))
    return {valid:false,reason:'NEEDS SOLID GROUND'};
  let supportedWallLayer = candidateOutward === 0;
  for (const entry of existing) {
    if (kind === 'wall' && entry.kind === 'wall') {
      const entrySurfaceY = world.surfaceHeight(entry.x,entry.y),
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

/** Fill the first empty layer of a column; do not jump over missing supports. */
export function nextWallStackSite(world: TileWorld, site: { x: number; y: number }, structures: readonly UndergroundStructure[]) {
  const surfaceY = world.surfaceHeight(site.x,site.y);
  const gravity = world.gravitySign(surfaceY);
  const column = structures.filter(entry => entry.kind === 'wall' &&
    globeSurfaceDistance(world, site.x, surfaceY, entry.x, entry.y) <= WORLD.tile / 2)
    .sort((a, b) => globeSurfaceDistance(world, site.x, surfaceY, a.x, a.y) - globeSurfaceDistance(world, site.x, surfaceY, b.x, b.y))[0];
  const x = column?.x ?? site.x;
  let layer = 0;
  while (layer <= structures.length && structures.some(entry =>
    entry.kind === 'wall' && globeSurfaceDistance(world, x, surfaceY, entry.x, entry.y) < 1 &&
    Math.abs(entry.y - (surfaceY - gravity * layer * WORLD.tile)) < 1)) layer++;
  return { x, y: surfaceY - gravity * layer * WORLD.tile };
}

export function repairSurfaceStructure(structure: UndergroundStructure, credits: number) {
  const maximum = structureIntegrity(structure.kind);
  if ((structure.integrity ?? maximum) >= maximum || credits < SURFACE_RAID.repairCredits) return undefined;
  return { credits: credits - SURFACE_RAID.repairCredits, integrity: maximum };
}

export function findSurfaceTradePostSite(
  world: TileWorld,
  x: number,
  y: number,
  existing: readonly UndergroundStructure[],
) {
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
  if (localDepth < UNDERGROUND_BUILDING.minimumDepthMeters || localDepth > world.coreDepthMeters - 48) return undefined;
  // A compact lamp mounts on the cave's rear wall, without a collision deck.
  if (kind === 'light') {
    const column = Math.floor(x / WORLD.tile), row = Math.floor(y / WORLD.tile);
    const site = { x: (column + .5) * WORLD.tile, y: (row + .5) * WORLD.tile };
    if (site.x < 100 || site.x > world.widthTiles * WORLD.tile - 100 || world.solid(column, row) ||
      existing.some(entry => entry.kind === 'light' && Math.hypot(entry.x-site.x,entry.y-site.y)<WORLD.tile*2)) return undefined;
    return site;
  }
  const centerX = Math.floor(x / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
  const deckY = kind === 'service'
    ? (gravitySign > 0 ? Math.ceil((y + 16) / WORLD.tile) * WORLD.tile - 1 : Math.floor((y - 16) / WORLD.tile) * WORLD.tile + 1)
    : Math.round((y + gravitySign * WORLD.tile * 2) / WORLD.tile) * WORLD.tile + WORLD.tile / 2;
  const halfSpan = Math.floor(UNDERGROUND_BUILDING[kind].widthTiles / 2);
  // Prefer the old anchor, then nearby clear space in this same chamber.
  const offsets = [0, -1, 1, -2, 2];
  for (const dy of offsets) for (const dx of offsets) {
    const siteX = centerX + dx * WORLD.tile, siteY = deckY + dy * WORLD.tile;
    if (depthAtWorldY(siteY, world.planetChart) < UNDERGROUND_BUILDING.minimumDepthMeters || depthAtWorldY(siteY, world.planetChart) > world.coreDepthMeters - 48) continue;
    if (existing.some(entry => entry.kind !== 'light' && Math.hypot(entry.x - siteX, entry.y - siteY) < 240)) continue;
    const row = Math.floor(siteY / WORLD.tile), column = Math.floor(siteX / WORLD.tile);
    let clear = true;
    for (let xx = -halfSpan; xx <= halfSpan; xx++) for (let yy = kind === 'service' || kind === 'turret' ? -2 : 0; yy <= (kind === 'turret' ? 2 : 0); yy++) {
      if (world.solid(column + xx, row + yy * (kind === 'service' ? gravitySign : 1))) clear = false;
    }
    // Do not snap a shelter through an unmined wall into another cavity.
    const entranceY = siteY - gravitySign * 22;
    const steps = Math.ceil(Math.hypot(siteX - x, entranceY - y) / 10);
    for (let i = 1; clear && i <= steps; i++) {
      if (world.solid(Math.floor((x + (siteX - x) * i / steps) / WORLD.tile), Math.floor((y + (entranceY - y) * i / steps) / WORLD.tile))) clear = false;
    }
    if (clear) return { x: siteX, y: siteY };
  }
  return undefined;
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
    if (structure.kind === 'light' || structure.kind === 'trade-post' || structure.kind === 'warehouse' || structure.kind === 'wall' || structure.kind === 'gate' || structure.kind === 'fort') continue;
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
