import { FRONTIER, EXTRACTOR_TIERS, MAPS, ORE_KEYS, UNDERGROUND_BUILDING, type MapId, type Ore } from '../config';
import { warehouseCapacity, type UndergroundStructure } from '../building/UndergroundStructures';
import type { Cargo } from './Progress';
import { extractorStatus, type ExtractionLedger } from './ExtractionSeams';
import { emptyCargo } from './Progress';
import { cargoTotal } from './Freight';
export const localProductionRoom = (structures: UndergroundStructure[], warehouse: Cargo, ship: Cargo) =>
  Math.max(0, warehouseCapacity(structures) - cargoTotal(warehouse)) + Math.max(0, FRONTIER.shipCapacity - cargoTotal(ship));

/** Generate into a bounded temporary output buffer, then route ore into distinct stores. */
export function accumulateLocalProduction(structures: UndergroundStructure[], warehouse: Cargo, ship: Cargo, map: MapId, elapsed: number, extraction: ExtractionLedger, onDelivery?: (id: string, ore: Ore, units: number, destination: 'planet' | 'ship') => void) {
  const localRoom = Math.max(0, warehouseCapacity(structures) - cargoTotal(warehouse));
  const output = emptyCargo();
  // Subtract building capacity because the established producer adds it itself.
  const result = accumulateAutomatedProduction(structures, output, map, elapsed, localProductionRoom(structures, warehouse, ship) - warehouseCapacity(structures), extraction);
  let room = localRoom;
  for (const ore of ORE_KEYS) {
    const local = Math.min(room, output[ore]);
    warehouse[ore] += local; ship[ore] += output[ore] - local; room -= local;
    let planetRemaining = local;
    for (const batch of result.batches.filter(b => b.ore === ore)) {
      const toPlanet = Math.min(planetRemaining, batch.units);
      if (toPlanet > 0) onDelivery?.(batch.id, ore, toPlanet, 'planet');
      if (batch.units > toPlanet) onDelivery?.(batch.id, ore, batch.units - toPlanet, 'ship');
      planetRemaining -= toPlanet;
    }
  }
  return result.produced;
}

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
  structures: UndergroundStructure[], warehouse: Cargo, mapId: MapId, elapsedSeconds: number, extraCapacity = 0, extraction?: ExtractionLedger,
) {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.min(UNDERGROUND_BUILDING.automation.offlineCapSeconds, elapsedSeconds)) : 0,
    capacity = warehouseCapacity(structures) + extraCapacity, results: Record<string, number> = {}, batches: {id: string; ore: Ore; units: number}[] = [];
  if (capacity <= 0) {
    for (const facility of structures) if (facility.kind === 'extractor') facility.productionFraction = 0;
    return { warehouse, produced: results, batches };
  }
  for (const facility of structures) {
    if (facility.kind !== 'extractor') continue;
    if (extraction) {
      const status = extractorStatus(mapId, facility, extraction, ORE_KEYS.reduce((n, o) => n + warehouse[o], 0), capacity);
      if (status.state !== 'Mining') { facility.productionFraction = 0; continue; }
      const accumulated = (facility.productionFraction ?? 0) + elapsed / 3600 * status.rate,
        room = capacity - ORE_KEYS.reduce((n, o) => n + warehouse[o], 0),
        accepted = Math.floor(Math.min(accumulated, room, status.remaining) * 2 + 1e-8) / 2;
      if (accepted > 0) batches.push({id: facility.id, ore: status.ore, units: accepted});
      warehouse[status.ore] += accepted;
      extraction[status.key] = (extraction[status.key] ?? 0) + accepted;
      results[status.ore] = (results[status.ore] ?? 0) + accepted;
      facility.productionFraction = room - accepted < 0.5 || status.remaining - accepted <= 0 ? 0 : Math.min(.499999999, accumulated - accepted);
      continue;
    }
    const level = Math.max(1, Math.min(EXTRACTOR_TIERS.length, facility.level ?? 1)), tier = EXTRACTOR_TIERS[level - 1]!,
      eligible = tier.ores.filter((ore) => MAPS[mapId].oreFactors[ore] > 0),
      weights = eligible.map((ore) => MAPS[mapId].oreFactors[ore]), weightTotal = weights.reduce<number>((a, b) => a + b, 0);
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
    // Full storage pauses production; discard excess time instead of banking
    // nearly half an ore for the next withdrawal/reload.
    facility.productionFraction = room - accepted <= 1e-8 ? 0 : Math.min(0.499999999, Math.max(0, units));
  }
  return { warehouse, produced: results, batches };
}
