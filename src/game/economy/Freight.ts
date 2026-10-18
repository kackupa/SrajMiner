import { ORE_KEYS, type Ore } from '../config';
import type { Cargo } from './Progress';
export type InventorySource = 'miner' | 'ship' | 'planet';
export const cargoTotal = (cargo: Cargo) => ORE_KEYS.reduce((sum, ore) => sum + cargo[ore], 0);
export const validCargo = (cargo: unknown): cargo is Cargo => !!cargo && typeof cargo === 'object' && !Array.isArray(cargo) &&
  Object.keys(cargo).length === ORE_KEYS.length && ORE_KEYS.every(ore => {
    const units = (cargo as Cargo)[ore]; return Number.isFinite(units) && units >= 0 && Number.isInteger(units * 2);
  });
/** Local-only immutable quote. Legacy overflow may be withdrawn but adds no destination allowance. */
export function quoteFreight(source: Cargo, target: Cargo, ore: Ore, requested: number, capacity: number, local: boolean) {
  if (!local || !validCargo(source) || !validCargo(target) || !ORE_KEYS.includes(ore) || !Number.isFinite(requested) || requested <= 0 ||
    !Number.isFinite(capacity) || capacity < 0) return { moved: 0, source, target };
  const moved = Math.floor(Math.min(requested, source[ore], Math.max(0, capacity - cargoTotal(target))) * 2) / 2;
  return { moved, source: { ...source, [ore]: source[ore] - moved }, target: { ...target, [ore]: target[ore] + moved } };
}
export function transferFreight(source: Cargo, target: Cargo, ore: Ore, requested: number, capacity: number, local: boolean, save: () => boolean) {
  if (source === target) return 0;
  const quote = quoteFreight(source, target, ore, requested, capacity, local);
  if (!quote.moved) return 0;
  const beforeSource = { ...source }, beforeTarget = { ...target };
  Object.assign(source, quote.source); Object.assign(target, quote.target);
  let saved = false; try { saved = save(); } catch {}
  if (!saved) { Object.assign(source, beforeSource); Object.assign(target, beforeTarget); return 0; }
  return quote.moved;
}
