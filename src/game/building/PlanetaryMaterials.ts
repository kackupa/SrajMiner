import { ORE_KEYS, type Ore } from '../config';
import type { Cargo } from '../economy/Progress';

/** Only the active planet's store is supplied by callers. Cargo is spent first. */
export function planetaryMaterials(cargo: Cargo, storage: Cargo, ship?: Cargo): Cargo {
  return Object.fromEntries(ORE_KEYS.map(ore => [ore, cargo[ore] + (ship?.[ore] ?? 0) + storage[ore]])) as Cargo;
}
export function spendPlanetaryMaterials(cargo: Cargo, storage: Cargo, cost: Partial<Cargo>, ship?: Cargo) {
  const available = planetaryMaterials(cargo, storage, ship);
  if (Object.entries(cost).some(([ore, units]) => !ORE_KEYS.includes(ore as Ore) || !Number.isFinite(units) || units < 0 || !Number.isInteger(units * 2) || available[ore as Ore] < units)) return undefined;
  const nextCargo = { ...cargo }, nextStorage = { ...storage }, nextShip = ship ? { ...ship } : undefined;
  for (const [key, units] of Object.entries(cost)) {
    const ore = key as Ore, carried = Math.min(nextCargo[ore], units);
    nextCargo[ore] -= carried;
    const aboard = Math.min(nextShip?.[ore] ?? 0, units - carried);
    if (nextShip) nextShip[ore] -= aboard;
    nextStorage[ore] -= units - carried - aboard;
  }
  return { cargo: nextCargo, storage: nextStorage, ship: nextShip };
}
