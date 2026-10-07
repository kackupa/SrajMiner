import { UNDERGROUND_BUILDING, WORLD, depthAtWorldY, type Ore } from '../config';
import type { TileWorld } from '../world/TileWorld';

export type StructureKind = 'platform' | 'service' | 'turret';
export type UndergroundStructure = { id: string; kind: StructureKind; x: number; y: number; reload?: number };

export function canAffordStructure(kind: StructureKind, cargo: Record<Ore, number>, credits: number) {
  const cost = UNDERGROUND_BUILDING[kind];
  return credits >= cost.credits && Object.entries(cost.materials).every(([ore, units]) => cargo[ore as Ore] >= units);
}

export function findBuildSite(
  world: TileWorld,
  x: number,
  y: number,
  gravitySign: number,
  kind: StructureKind,
  existing: readonly UndergroundStructure[],
): { x: number; y: number } | undefined {
  const localDepth = depthAtWorldY(y);
  if (localDepth < UNDERGROUND_BUILDING.minimumDepthMeters || localDepth > 3400) return undefined;
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
