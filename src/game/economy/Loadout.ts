import { RIG_ITEMS, CHARGE_MODES, type RigSlot, type Upgrade } from '../config';
import type { Progress, Cargo } from './Progress';
import { spendPlanetaryMaterials } from '../building/PlanetaryMaterials';
export const RIG_SLOTS: RigSlot[] = ['hull', 'drill', 'engine', 'battery', 'weapon', 'utility'];
export type Loadout = { version: 1; charge?: keyof typeof CHARGE_MODES; owned: string[]; fitted: Record<RigSlot, string> };
export function defaultLoadout(): Loadout {
  const fitted = { hull: 'standard-hull', drill: 'borer', engine: 'standard-engine', battery: 'standard-cell', weapon: 'unarmed', utility: 'empty-utility' };
  return { version: 1, owned: [...Object.values(fitted), 'scout'], fitted };
}
export const rigItem = (id: string) => RIG_ITEMS.find(item => item.id === id);
export const fittingPower = (loadout: Loadout) => Object.values(loadout.fitted).reduce((n, id) => n + (rigItem(id)?.power ?? 0), 0);
export const fittingCapacity = (loadout: Loadout) => rigItem(loadout.fitted.battery)?.capacity ?? 100;
export const rigMultiplier = (loadout: Loadout, key: Upgrade) => Object.values(loadout.fitted).reduce((n, id) => n * (rigItem(id)?.stats?.[key] ?? 1), 1);
export function validLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== 'object') return false;
  const l = value as Loadout;
  return l.version === 1 && (l.charge === undefined || Object.hasOwn(CHARGE_MODES,l.charge)) && Array.isArray(l.owned) && l.owned.length <= RIG_ITEMS.length && new Set(l.owned).size === l.owned.length &&
    l.owned.every(id => typeof id === 'string' && !!rigItem(id)) && !!l.fitted && Object.keys(l.fitted).length === RIG_SLOTS.length &&
    RIG_SLOTS.every(slot => typeof l.fitted[slot] === 'string' && l.owned.includes(l.fitted[slot]) && rigItem(l.fitted[slot])?.slot === slot) && fittingPower(l) <= fittingCapacity(l);
}
/** Preview and transactions never discard cargo or refill a rig by swapping parts. */
export function fitReason(p: Progress, id: string) {
  const item = rigItem(id); if (!item) return 'Unknown equipment';
  const next = { ...p.loadout, fitted: { ...p.loadout.fitted, [item.slot]: id } };
  if (fittingPower(next) > fittingCapacity(next)) return 'Not enough fitting power. Choose a larger battery.';
  const preview = Object.create(p) as Progress; preview.loadout = next;
  const limit = preview.max('cargo');
  if (p.count > limit) return 'Unload cargo before fitting this part.';
  return '';
}
export function purchaseOrFit(p: Progress, storage: Cargo, id: string, save: () => unknown): string {
  const item = rigItem(id); if (!item) return 'Unknown equipment';
  const owned = p.loadout.owned.includes(id);
  // Fit purchases immediately when compatible; retain over-budget purchases unfitted.
  if (owned) { const reason = fitReason(p, id); if (reason) return reason; }
  const payment = owned ? undefined : spendPlanetaryMaterials(p.cargo, storage, item.materials, p.shipCargo);
  if (!owned && !payment) return 'Collect the missing materials.';
  const before = { loadout: structuredClone(p.loadout), cargo: { ...p.cargo }, ship: { ...p.shipCargo }, storage: { ...storage }, fuel: p.fuel, hull: p.hull };
  if (payment) { Object.assign(p.cargo, payment.cargo); Object.assign(p.shipCargo, payment.ship); Object.assign(storage, payment.storage); p.loadout.owned.push(id); }
  const fittingIssue = fitReason(p, id);
  if (!fittingIssue) { p.loadout.fitted[item.slot] = id; p.fuel = Math.min(p.fuel, p.max('fuel')); p.hull = Math.min(p.hull, p.max('hull')); }
  let ok = false; try { ok = !!save(); } catch { /* rollback */ }
  if (!ok) { p.loadout = before.loadout; Object.assign(p.cargo, before.cargo); Object.assign(p.shipCargo, before.ship); Object.assign(storage, before.storage); p.fuel = before.fuel; p.hull = before.hull; return 'Save failed. Materials and equipment restored.'; }
  return owned ? `${item.name} fitted.` : fittingIssue ? `${item.name} purchased, not fitted. ${fittingIssue}` : `${item.name} purchased and fitted.`;
}
