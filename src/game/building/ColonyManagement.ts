import { ORE_KEYS, UNDERGROUND_BUILDING, WORLD, type Ore } from '../config';
import type { Cargo } from '../economy/Progress';
import { warehouseCapacity, type UndergroundStructure } from './UndergroundStructures';

/** Refund base construction materials only; upgrades are retained by moving instead. */
export function dismantleRefund(structure: UndergroundStructure): Partial<Cargo> {
  return Object.fromEntries(Object.entries(UNDERGROUND_BUILDING[structure.kind].materials)
    .map(([ore, units]) => [ore, Math.floor(units) / 2]));
}

export function supportsWall(structure: UndergroundStructure, structures: readonly UndergroundStructure[]) {
  return structure.kind === 'wall' && structures.some(s => s !== structure && s.kind === 'wall' &&
    Math.abs(s.x - structure.x) < 1 && Math.abs(s.y - structure.y) <= WORLD.tile + 1 &&
    (structure.y <= 0 ? s.y < structure.y : s.y > structure.y));
}

export function dismantleBuilding(structures: UndergroundStructure[], storage: Cargo, id: string, holdCapacity: number, save: () => boolean, ship?: Cargo) {
  const index = structures.findIndex(s => s.id === id);
  if (index < 0) return { ok: false, reason: 'Building no longer exists.' };
  const structure = structures[index], refund = dismantleRefund(structure),
    remaining = structures.filter(s => s !== structure), capacity = holdCapacity + warehouseCapacity(remaining),
    total = ORE_KEYS.reduce((n, ore) => n + storage[ore] + (refund[ore] ?? 0), 0),
    shipRoom = ship ? Math.max(0, holdCapacity - ORE_KEYS.reduce((n,o)=>n+ship[o],0)) : 0,
    localCapacity = ship ? warehouseCapacity(remaining) : capacity;
  if (ORE_KEYS.reduce((n,o)=>n+storage[o],0) > localCapacity || total > localCapacity + shipRoom) return { ok: false, reason: 'Make room in local storage or the ship for the refund first.' };
  // Removing a supporting wall would leave a floating stack.
  if (supportsWall(structure, remaining))
    return { ok: false, reason: 'Move or dismantle the wall layer above this one first.' };
  const previous = { ...storage }, previousShip = ship ? { ...ship } : undefined;
  structures.splice(index, 1);
  let room = Math.max(0, localCapacity - ORE_KEYS.reduce((n,o)=>n+storage[o],0));
  for (const [ore, units] of Object.entries(refund)) {
    const local = Math.min(room, units!); storage[ore as Ore] += local; room -= local;
    if (ship) ship[ore as Ore] += units! - local;
  }
  let saved = false;
  try { saved = save(); } catch { /* Restore the complete transaction below. */ }
  if (!saved) {
    structures.splice(index, 0, structure); Object.assign(storage, previous); if (ship) Object.assign(ship, previousShip);
    return { ok: false, reason: 'Save failed. Building and materials restored.' };
  }
  return { ok: true, reason: 'Building dismantled. Materials returned to Planet, then Ship.' };
}
