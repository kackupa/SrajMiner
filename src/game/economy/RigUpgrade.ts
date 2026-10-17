import { PREBUILD, rigMaterialCost, type Upgrade } from '../config';
import { spendPlanetaryMaterials } from '../building/PlanetaryMaterials';
import type { Progress, Cargo } from './Progress';
/** Atomic material installation. No credit payment, travel gate or save-schema changes. */
export function installRigUpgrade(p: Progress, storage: Cargo, key: Upgrade, save: () => boolean) {
 const level = p.levels[key];
 if (!Number.isInteger(level) || level < 1 || level >= PREBUILD.basicRigMaxLevel) return false;
 const payment = spendPlanetaryMaterials(p.cargo, storage, rigMaterialCost(key, level));
 if (!payment) return false;
 const before = { cargo: { ...p.cargo }, storage: { ...storage }, fuel: p.fuel, hull: p.hull, grapple: p.grappleOwned }, oldMax = p.max(key);
 p.levels[key]++; Object.assign(p.cargo, payment.cargo); Object.assign(storage, payment.storage);
 if (key === 'fuel') p.fuel += p.max(key) - oldMax;
 if (key === 'hull') p.hull += p.max(key) - oldMax;
 if (key === 'grapple') p.grappleOwned = true;
 let saved = false; try { saved = save(); } catch { saved = false; }
 if (!saved) { p.levels[key] = level; Object.assign(p.cargo, before.cargo); Object.assign(storage, before.storage); p.fuel=before.fuel; p.hull=before.hull; p.grappleOwned=before.grapple; return false; }
 return true;
}
