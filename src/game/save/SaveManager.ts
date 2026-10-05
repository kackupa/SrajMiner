import { Progress, emptyCargo } from '../economy/Progress';
import { ORE_KEYS, UPGRADE_KEYS, WORLD } from '../config';
export const SAVE_KEY = 'mars-miner.v1';
export type SaveData = {
  version: 1;
  seed: number;
  money: number;
  levels: Progress['levels'];
  fuel: number;
  hull: number;
  cargo: Progress['cargo'];
  maxDepth: number;
  artifact: boolean;
  x: number;
  y: number;
  destroyed: string[];
  discovered: string[];
};
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function validateSave(s: unknown): s is SaveData {
  if (!s || typeof s !== 'object') return false;
  const d = s as SaveData;
  return (
    d.version === 1 &&
    Number.isInteger(d.seed) &&
    finite(d.money) &&
    d.money >= 0 &&
    finite(d.fuel) &&
    d.fuel >= 0 &&
    finite(d.hull) &&
    d.hull > 0 &&
    finite(d.maxDepth) &&
    d.maxDepth >= 0 &&
    typeof d.artifact === 'boolean' &&
    finite(d.x) &&
    d.x >= 13 &&
    d.x <= WORLD.width * WORLD.tile - 13 &&
    finite(d.y) &&
    d.y >= -180 &&
    d.y <= 1e7 &&
    !!d.levels &&
    UPGRADE_KEYS.every(
      (k) => Number.isInteger(d.levels[k]) && d.levels[k] >= 1 && d.levels[k] <= 5,
    ) &&
    !!d.cargo &&
    ORE_KEYS.every((k) => Number.isInteger(d.cargo[k]) && d.cargo[k] >= 0) &&
    [d.destroyed, d.discovered].every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 500000 &&
        a.every((v) => typeof v === 'string' && /^\d{1,2},\d{1,7}$/.test(v)),
    )
  );
}
export class SaveManager {
  warning = '';
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (validateSave(data)) return data;
      this.warning = 'Save could not be read. A new expedition is ready.';
    } catch {
      this.warning = 'Storage unavailable. This session may not be saved.';
    }
    return null;
  }
  write(data: SaveData) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      this.warning = 'Save failed: browser storage is full or unavailable.';
      return false;
    }
  }
  restore(p: Progress, d: SaveData) {
    p.money = d.money;
    p.levels = { ...d.levels };
    p.fuel = Math.min(d.fuel, p.max('fuel'));
    p.hull = Math.min(d.hull, p.max('hull'));
    p.cargo = { ...emptyCargo(), ...d.cargo };
    if (p.count > p.max('cargo')) p.cargo = emptyCargo();
    p.maxDepth = d.maxDepth;
    p.artifact = d.artifact;
  }
}
