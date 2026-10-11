import { MAPS, ORE_KEYS, type MapId, type Ore } from '../config';
import { warehouseCapacity, type UndergroundStructure } from '../building/UndergroundStructures';
import type { Cargo } from './Progress';

export type WarehouseDirection = 'store' | 'withdraw';

/** Move ore between one planet's warehouse and the miner without creating or losing fractional units. */
export function transferWarehouseOre(
  cargo: Cargo,
  warehouse: Cargo,
  ore: Ore,
  direction: WarehouseDirection,
  requested: number,
  cargoCapacity: number,
  storageCapacity = Number.POSITIVE_INFINITY,
) {
  if (!Number.isFinite(requested) && requested !== Number.MAX_SAFE_INTEGER || requested <= 0 || !Number.isFinite(cargoCapacity) || cargoCapacity < 0)
    return { moved: 0, cargo: { ...cargo }, warehouse: { ...warehouse } };
  const room = Math.max(0, cargoCapacity - ORE_KEYS.reduce((sum, key) => sum + cargo[key], 0)),
    storageRoom = Math.max(0, storageCapacity - ORE_KEYS.reduce((sum, key) => sum + warehouse[key], 0)),
    available = direction === 'store' ? Math.min(cargo[ore], storageRoom) : Math.min(warehouse[ore], room),
    moved = Math.floor(Math.min(available, requested) * 2 + 1e-8) / 2;
  if (!moved) return { moved: 0, cargo: { ...cargo }, warehouse: { ...warehouse } };
  const nextCargo = { ...cargo }, nextWarehouse = { ...warehouse };
  if (direction === 'store') {
    nextCargo[ore] -= moved;
    nextWarehouse[ore] += moved;
  } else {
    nextCargo[ore] += moved;
    nextWarehouse[ore] -= moved;
  }
  return { moved, cargo: nextCargo, warehouse: nextWarehouse };
}

export function accumulateAutomatedProduction(
  structures: UndergroundStructure[], warehouse: Cargo, mapId: MapId, elapsedSeconds: number,
) {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.min(43200, elapsedSeconds)) : 0,
    capacity = warehouseCapacity(structures), results: Record<string, number> = {};
  if (capacity <= 0) return { warehouse, produced: results };
  for (const facility of structures) {
    if (facility.kind !== 'extractor') continue;
    const level = Math.max(1, Math.min(3, facility.level ?? 1)), tier = [
      { rate: 2, ores: ['copper', 'iron'] as const },
      { rate: 6, ores: ['copper', 'iron', 'silver'] as const },
      { rate: 12, ores: ['silver', 'gold', 'diamond'] as const },
    ][level - 1]!, eligible = tier.ores.filter((ore) => MAPS[mapId].oreFactors[ore] > 0),
      weights = eligible.map((ore) => MAPS[mapId].oreFactors[ore]), weightTotal = weights.reduce((a, b) => a + b, 0);
    if (!weightTotal) continue;
    facility.productionFraction ??= 0;
    if (capacity <= 0 || ORE_KEYS.reduce((sum, key) => sum + warehouse[key], 0) >= capacity - 1e-8) {
      facility.productionFraction = 0;
      continue;
    }
    let units = facility.productionFraction + elapsed / 3600 * tier.rate;
    const room = Math.max(0, capacity - ORE_KEYS.reduce((sum, key) => sum + warehouse[key], 0)),
      accepted = Math.min(Math.floor(units * 2 + 1e-8) / 2, Math.floor(room * 2 + 1e-8) / 2);
    units -= accepted;
    const wholeHalfUnits = Math.round(accepted * 2), start = Math.abs([...facility.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % eligible.length;
    for (let i = 0; i < wholeHalfUnits; i++) {
      const ore = eligible[(start + i) % eligible.length]!;
      warehouse[ore] += 0.5; results[ore] = (results[ore] ?? 0) + 0.5;
    }
    facility.productionFraction = room <= 1e-8 ? 0 : Math.min(0.499999999, Math.max(0, units));
  }
  return { warehouse, produced: results };
}

