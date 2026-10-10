import { ORE_KEYS, type Ore } from '../config';
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
) {
  if (!Number.isFinite(requested) || requested <= 0 || !Number.isFinite(cargoCapacity) || cargoCapacity < 0)
    return { moved: 0, cargo: { ...cargo }, warehouse: { ...warehouse } };
  const room = Math.max(0, cargoCapacity - ORE_KEYS.reduce((sum, key) => sum + cargo[key], 0)),
    available = direction === 'store' ? cargo[ore] : Math.min(warehouse[ore], room),
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

