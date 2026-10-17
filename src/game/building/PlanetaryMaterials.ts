import { ORE_KEYS, type Ore } from '../config';
import type { Cargo } from '../economy/Progress';

/** Only the active planet's store is supplied by callers. Cargo is spent first. */
export function planetaryMaterials(cargo: Cargo, storage: Cargo): Cargo {
  return Object.fromEntries(ORE_KEYS.map(ore => [ore, cargo[ore] + storage[ore]])) as Cargo;
}
export function spendPlanetaryMaterials(cargo: Cargo, storage: Cargo, cost: Partial<Cargo>) {
  const available = planetaryMaterials(cargo, storage);
  if (Object.entries(cost).some(([ore, units]) => !Number.isFinite(units) || units < 0 || available[ore as Ore] < units)) return undefined;
  const nextCargo = { ...cargo }, nextStorage = { ...storage };
  for (const [key, units] of Object.entries(cost)) {
    const ore = key as Ore, carried = Math.min(nextCargo[ore], units);
    nextCargo[ore] -= carried;
    nextStorage[ore] -= units - carried;
  }
  return { cargo: nextCargo, storage: nextStorage };
}
