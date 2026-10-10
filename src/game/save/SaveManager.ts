import { Progress, emptyCargo, type Cargo } from '../economy/Progress';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import { CHARGE, ORE_KEYS, ORES, UPGRADE_KEYS, WORLD, PLANET_CHART, STARTER_PLANET_CHART, PREVIOUS_STARTER_PLANET_CHART, LEGACY_PLANET_CHART, MAPS, ROUTE_FRAGMENTS, ROUTE_SHIP_COMPONENTS, NAVIGATION_HASHES, CORE_RELICS, POD_PAINT_KEYS, PILOT_SUIT_KEYS, POD_DECAL_KEYS, POD_PROFILE_KEYS, SPECIALIZATIONS, UNDERGROUND_BUILDING, SURFACE_RAID, type MapId, type Ore, type PodPaint, type PilotSuit, type PodDecal, type PodProfile, type Specialization } from '../config';
import type { PlanetChartSize } from '../world/PlanetChart';
import { MARKET_CONTRACT_IDS, MARKET_DEMAND_IDS } from '../economy/MarketContracts';
import { SYSTEM_PROJECT_MILESTONES } from '../economy/SystemProjects';
import { MAX_TOWN_ALTITUDE } from '../surface/SurfaceStation';
export const SAVE_KEY = 'mars-miner.v1';
export type OreDrop = { id: string; ore: Ore; units: number; x: number; y: number; vx: number; vy: number };
export type ActiveCharge = { x: number; y: number; fuse: number; vy?: number };
export type SaveData = {
  version: 24;
  planetChart: PlanetChartSize;
  campaignSeed: number;
  activeMap: MapId;
  maps: Partial<Record<MapId, WorldSave>>;
  money: number;
  levels: Progress['levels'];
  fuel: number;
  hull: number;
  cargo: Progress['cargo'];
  maxDepth: number;
  artifact: boolean;
  milestones: string[];
  shipComponents: string[];
  routeFragments: string[];
  charges: number;
  ownedPaints: PodPaint[];
  selectedPaint: PodPaint;
  salvageMagnet: boolean;
  ownedSuits: PilotSuit[];
  selectedSuit: PilotSuit;
  ownedDecals: PodDecal[];
  selectedDecal: PodDecal;
  ownedProfiles: PodProfile[];
  selectedProfile: PodProfile;
  specialization: Specialization;
  stasisModule: boolean;
  returnWinch: boolean;
  escapeSuit: boolean;
  pilotEscaping: boolean;
  grappleOwned: boolean;
};
export type WorldSave = {
  seed: number;
  x: number;
  y: number;
  maxDepth: number;
  destroyed: string[];
  discovered: string[];
  drops: OreDrop[];
  activeCharge: ActiveCharge | null;
  structures: UndergroundStructure[];
  warehouse: Cargo;
  planetChart?: PlanetChartSize;
};
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const chartIsSupported = (chart: PlanetChartSize | undefined) => !!chart && [STARTER_PLANET_CHART, PREVIOUS_STARTER_PLANET_CHART, PLANET_CHART, LEGACY_PLANET_CHART].some(
  (supported) => chart.columns === supported.columns && chart.radiusRows === supported.radiusRows,
);
const mapColumns = (map: WorldSave, campaignChart?: PlanetChartSize) => map.planetChart?.columns ?? campaignChart?.columns ?? WORLD.width;
const validTileKey = (value: string, chart: PlanetChartSize | undefined) => {
  const match = /^(\d{1,3}),(\d{1,7})$/.exec(value);
  return !!match && (chart ? Number(match[1]) < chart.columns : match[1]!.length <= 2);
};
const validDrop = (drop: OreDrop, columns: number) =>
  !!drop && typeof drop.id === 'string' && drop.id.length > 0 && drop.id.length <= 80 &&
  Object.hasOwn(ORES, drop.ore) && finite(drop.units) && drop.units > 0 && drop.units <= 3 &&
  Number.isInteger(drop.units * 2) && finite(drop.x) && drop.x >= -100 && drop.x <= columns * WORLD.tile + 100 &&
  finite(drop.y) && drop.y >= -200 && drop.y <= 1e7 && finite(drop.vx) && Math.abs(drop.vx) <= 1000 &&
  finite(drop.vy) && Math.abs(drop.vy) <= 1000;
const dropMatchesMinedTile = (drop: OreDrop, seed: number, destroyed: string[], chart: PlanetChartSize | undefined) => {
  const match = /^(\d+):(\d{1,3}),(\d{1,7})$/.exec(drop.id);
  return !!match && Number(match[1]) === seed && (chart ? Number(match[2]) < chart.columns : match[2]!.length <= 2) &&
    destroyed.includes(`${match[2]},${match[3]}`);
};
const validCharge = (charge: ActiveCharge | null, columns: number) => charge === null || (
  !!charge && finite(charge.x) && charge.x >= 0 && charge.x <= columns * WORLD.tile &&
  finite(charge.y) && charge.y >= 0 && charge.y <= 1e7 && finite(charge.fuse) &&
  charge.fuse >= 0 && charge.fuse <= CHARGE.fuseSeconds &&
  (charge.vy === undefined || finite(charge.vy) && Math.abs(charge.vy) <= CHARGE.maxFallSpeed)
);
export function validateSave(s: unknown): s is SaveData {
  if (!s || typeof s !== 'object') return false;
  const d = s as SaveData;
  return (
    d.version === 24 && chartIsSupported(d.planetChart) &&
    Object.hasOwn(SPECIALIZATIONS, d.specialization) &&
    Number.isInteger(d.campaignSeed) &&
    Object.hasOwn(MAPS, d.activeMap) &&
    !!d.maps && Object.hasOwn(d.maps, d.activeMap) && Object.entries(d.maps).every(([id, m]) => {
      const chart = m?.planetChart ?? d.planetChart;
      const maxOrbitSaveAltitude = (chart?.radiusRows ?? PLANET_CHART.radiusRows) * WORLD.tile + MAX_TOWN_ALTITUDE;
      if (!Object.hasOwn(MAPS, id) || !m || !Number.isInteger(m.seed) || m.planetChart && !chartIsSupported(m.planetChart) || !finite(m.x) || m.x < 13 ||
        m.x > mapColumns(m, d.planetChart) * WORLD.tile - 13 || !finite(m.y) || m.y < -maxOrbitSaveAltitude || m.y > 1e7 ||
        !finite(m.maxDepth) || m.maxDepth < 0 || ![m.destroyed, m.discovered].every((a) =>
          Array.isArray(a) && a.length <= 500000 && a.every((v) => typeof v === 'string' && validTileKey(v, m.planetChart ?? d.planetChart))) ||
        !Array.isArray(m.drops) || m.drops.length > 500000 || !validCharge(m.activeCharge, mapColumns(m, d.planetChart)) ||
          !Array.isArray(m.structures) || m.structures.length > UNDERGROUND_BUILDING.maxStructuresPerMap ||
          !m.warehouse || ORE_KEYS.some((ore) => !finite(m.warehouse[ore]) || m.warehouse[ore] < 0 || !Number.isInteger(m.warehouse[ore] * 2)) || m.structures.some((structure) =>
          !structure || typeof structure.id !== 'string' || structure.id.length > 80 ||
          !['platform', 'service', 'turret', 'trade-post', 'habitat', 'warehouse', 'wall', 'gate'].includes(structure.kind) || !finite(structure.x) || structure.x < 100 || structure.x > mapColumns(m, d.planetChart) * WORLD.tile - 100 ||
          !finite(structure.y) || structure.y < 0 || structure.y > 1e7 ||
          (structure.reload !== undefined && (!finite(structure.reload) || structure.reload < 0 || structure.reload > UNDERGROUND_BUILDING.turret.reloadSeconds)) ||
          (structure.integrity !== undefined && (!Number.isInteger(structure.integrity) || structure.integrity < 1 || structure.integrity > SURFACE_RAID.integrity))) ||
        new Set(m.structures.map((structure) => structure.id)).size !== m.structures.length ||
        m.structures.filter((structure) => structure.kind === 'service').length > 1 ||
        m.structures.filter((structure) => structure.kind === 'platform').length > 12 ||
        m.structures.filter((structure) => structure.kind === 'turret').length > UNDERGROUND_BUILDING.turret.maxPerMap) return false;
      if (m.structures.filter((structure) => structure.kind === 'trade-post').length > UNDERGROUND_BUILDING['trade-post'].maxPerMap) return false;
      if (m.structures.filter((structure) => structure.kind === 'habitat').length > UNDERGROUND_BUILDING.habitat.maxPerMap) return false;
      if (m.structures.filter((structure) => structure.kind === 'warehouse').length > UNDERGROUND_BUILDING.warehouse.maxPerMap) return false;
      if (m.structures.filter((structure) => structure.kind === 'wall').length > UNDERGROUND_BUILDING.wall.maxPerMap) return false;
      if (m.structures.filter((structure) => structure.kind === 'gate').length > UNDERGROUND_BUILDING.gate.maxPerMap) return false;
      const ids = new Set<string>();
      return m.drops.every((drop) => {
        if (!validDrop(drop, mapColumns(m, d.planetChart)) || ids.has(drop.id) || !dropMatchesMinedTile(drop, m.seed, m.destroyed, m.planetChart ?? d.planetChart)) return false;
        ids.add(drop.id);
        return true;
      });
    }) &&
    finite(d.money) && d.money >= 0 && finite(d.charges) && Number.isInteger(d.charges) && d.charges >= 0 && d.charges <= 100000 &&
    Array.isArray(d.ownedPaints) && d.ownedPaints.includes('hab') && d.ownedPaints.every((v) => POD_PAINT_KEYS.includes(v)) && new Set(d.ownedPaints).size === d.ownedPaints.length && POD_PAINT_KEYS.includes(d.selectedPaint) && d.ownedPaints.includes(d.selectedPaint) &&
    typeof d.salvageMagnet === 'boolean' &&
    typeof d.stasisModule === 'boolean' &&
    typeof d.returnWinch === 'boolean' &&
    typeof d.escapeSuit === 'boolean' &&
    typeof d.pilotEscaping === 'boolean' &&
    typeof d.grappleOwned === 'boolean' &&
    !(d.escapeSuit && d.pilotEscaping) &&
    Array.isArray(d.ownedSuits) && d.ownedSuits.includes('hab') && d.ownedSuits.every((v) => PILOT_SUIT_KEYS.includes(v)) && new Set(d.ownedSuits).size === d.ownedSuits.length && PILOT_SUIT_KEYS.includes(d.selectedSuit) && d.ownedSuits.includes(d.selectedSuit) &&
    Array.isArray(d.ownedDecals) && d.ownedDecals.includes('standard') && d.ownedDecals.every((v) => POD_DECAL_KEYS.includes(v)) && new Set(d.ownedDecals).size === d.ownedDecals.length && POD_DECAL_KEYS.includes(d.selectedDecal) && d.ownedDecals.includes(d.selectedDecal) &&
    Array.isArray(d.ownedProfiles) && d.ownedProfiles.includes('standard') && d.ownedProfiles.every((v) => POD_PROFILE_KEYS.includes(v)) && new Set(d.ownedProfiles).size === d.ownedProfiles.length && POD_PROFILE_KEYS.includes(d.selectedProfile) && d.ownedProfiles.includes(d.selectedProfile) &&
    finite(d.fuel) && d.fuel >= 0 && finite(d.hull) && d.hull >= 0 && (d.hull > 0 || d.pilotEscaping) && finite(d.maxDepth) && d.maxDepth >= 0 &&
    typeof d.artifact === 'boolean' && !!d.levels && UPGRADE_KEYS.every(
      (k) => Number.isSafeInteger(d.levels[k]) && d.levels[k] >= 1,
    ) && !!d.cargo && ORE_KEYS.every((k) => finite(d.cargo[k]) && d.cargo[k] >= 0 && Number.isInteger(d.cargo[k] * 2)) &&
    Array.isArray(d.milestones) && d.milestones.every((v) => ['first-core-sample', 'basalt-vein', 'deep-scan', 'route-signal', 'core-crossing', ...MARKET_CONTRACT_IDS, ...MARKET_DEMAND_IDS, ...SYSTEM_PROJECT_MILESTONES, ...NAVIGATION_HASHES.map((entry) => entry.id), ...CORE_RELICS.map((entry) => entry.id)].includes(v)) &&
    Array.isArray(d.shipComponents) && d.shipComponents.every((v) => ['frame', 'propulsion', 'navigation', 'life-support'].includes(v)) &&
    Array.isArray(d.routeFragments) && d.routeFragments.every((v) => ROUTE_FRAGMENTS.some((fragment) => fragment.id === v))
  );
}
function addWorldToolState(maps: Record<string, Omit<WorldSave, 'drops' | 'activeCharge' | 'structures' | 'warehouse'> & Partial<Pick<WorldSave, 'drops' | 'activeCharge' | 'structures' | 'warehouse'>>>) {
  return Object.fromEntries(Object.entries(maps).map(([id, world]) => [id, {
    ...world,
    drops: world.drops ?? [],
    activeCharge: world.activeCharge ?? null,
    structures: world.structures ?? [],
    warehouse: world.warehouse ?? emptyCargo(),
  }]));
}
export function migrateSave(s: unknown): SaveData | null {
  if (validateSave(s)) return s;
  if (!s || typeof s !== 'object') return null;
  const version = (s as { version?: number }).version;
  if (version === 23) {
    const old = s as Record<string, unknown>;
    const maps = old.maps && typeof old.maps === 'object' ? old.maps as Record<string, unknown> : {};
    return migrateSave({ ...old, version: 24, maps: Object.fromEntries(Object.entries(maps).map(([id, value]) => {
      if (!value || typeof value !== 'object') return [id, value];
      const map = value as Record<string, unknown>;
      return [id, { ...map, warehouse: map.warehouse ?? emptyCargo() }];
    })) });
  }
  if (version === 22) {
    const old = s as Record<string, unknown>;
    const maps = old.maps && typeof old.maps === 'object' ? old.maps as Record<string, unknown> : {};
    return migrateSave({ ...old, version: 23, maps: Object.fromEntries(Object.entries(maps).map(([id, value]) => {
      if (!value || typeof value !== 'object') return [id, value];
      const map = value as Record<string, unknown>;
      const structures = Array.isArray(map.structures) ? map.structures.map((value) => {
        if (!value || typeof value !== 'object') return value;
        const structure = value as Record<string, unknown>;
        return { ...structure, integrity: structure.integrity ?? SURFACE_RAID.integrity };
      }) : map.structures;
      return [id, { ...map, structures }];
    })) });
  }
  if (version === 21) return migrateSave({ ...(s as Record<string, unknown>), version: 22 });
  if (version === 20) return migrateSave({ ...(s as Record<string, unknown>), version: 21 });
  if (version === 19) {
    const old = s as Record<string, unknown>, levels = old.levels as Record<string, number> | undefined;
    return migrateSave({ ...old, version: 20, grappleOwned: (levels?.grapple ?? 1) > 1 });
  }
  if (version === 18) return migrateSave({ ...(s as Record<string, unknown>), version: 19, planetChart: LEGACY_PLANET_CHART });
  if (version === 17) return migrateSave({ ...(s as Record<string, unknown>), version: 18 });
  if (version === 16) {
    return migrateSave({ ...(s as Record<string, unknown>), version: 17, escapeSuit: false, pilotEscaping: false });
  }
  if (version === 15) {
    return migrateSave({ ...(s as Record<string, unknown>), version: 16 });
  }
  if (version === 14) {
    const old = s as Record<string, unknown>;
    const maps = old.maps && typeof old.maps === 'object' ? old.maps as Record<string, Record<string, unknown>> : {};
    return migrateSave({ ...old, version: 15, maps: Object.fromEntries(Object.entries(maps).map(([id, state]) => [id, { ...state, structures: state.structures ?? [] }])) });
  }
  if (version === 13) {
    const old = s as Record<string, unknown>;
    const levels = old.levels && typeof old.levels === 'object' ? old.levels as Record<string, unknown> : {};
    return migrateSave({ ...old, version: 14, levels: { ...levels, grapple: levels.grapple ?? 1 } });
  }
  if (version === 12) {
    return migrateSave({ ...(s as Record<string, unknown>), version: 13, returnWinch: false });
  }
  if (version === 11) {
    const old = s as Record<string, unknown>;
    const levels = old.levels as Record<string, number>;
    return migrateSave({ ...old, version: 12, levels: { ...levels, scanner: levels.scanner ?? 1 }, stasisModule: false });
  }
  if (version === 10) {
    return migrateSave({ ...(s as Record<string, unknown>), version: 11, specialization: 'balanced' });
  }
  if (version === 9) {
    const old = s as Omit<SaveData, 'version' | 'ownedProfiles' | 'selectedProfile' | 'specialization'> & { version: 9 };
    const upgraded = { ...old, version: 10 as const, ownedProfiles: ['standard'], selectedProfile: 'standard' as const };
    return migrateSave(upgraded);
  }
  if (version === 8) {
    const old = s as Omit<SaveData, 'version' | 'ownedDecals' | 'selectedDecal'> & { version: 8 };
    return migrateSave({ ...old, version: 9, ownedDecals: ['standard'] as const, selectedDecal: 'standard' as const });
  }
  if (version === 7) {
    const old = s as Omit<SaveData, 'version' | 'ownedSuits' | 'selectedSuit'> & { version: 7 };
    const upgraded = { ...old, version: 8, ownedSuits: ['hab'] as const, selectedSuit: 'hab' as const };
    return migrateSave(upgraded);
  }
  if (version === 6) {
    const old = s as Omit<SaveData, 'version' | 'salvageMagnet' | 'ownedSuits' | 'selectedSuit'> & { version: 6 };
    return migrateSave({ ...old, version: 7, salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab' });
  }
  if (version === 5) {
    const old = s as Omit<SaveData, 'version' | 'ownedPaints' | 'selectedPaint' | 'salvageMagnet' | 'ownedSuits' | 'selectedSuit'> & { version: 5 };
    return migrateSave({ ...old, version: 6, ownedPaints: ['hab'], selectedPaint: 'hab', salvageMagnet: false, ownedSuits: ['hab'], selectedSuit: 'hab' });
  }
  if (version === 4) {
    const old = s as Omit<SaveData, 'version' | 'charges'> & { version: 4; maps: Record<string, Omit<WorldSave, 'drops' | 'activeCharge' | 'structures'> & Partial<Pick<WorldSave, 'drops' | 'activeCharge' | 'structures'>>> };
    const upgraded = { ...old, version: 5, charges: 0, maps: addWorldToolState(old.maps) };
    return migrateSave(upgraded);
  }
  if (version === 3) {
    const old = s as Omit<SaveData, 'version' | 'routeFragments' | 'charges'> & { version: 3; routeFragments?: string[] };
    return migrateSave({ ...old, version: 4, routeFragments: old.routeFragments ?? [] });
  }
  if (version !== 1 && version !== 2) return null;
  const old = s as {
    version: 1 | 2; seed: number; money: number; levels: Progress['levels']; fuel: number; hull: number;
    cargo: Progress['cargo']; maxDepth: number; artifact: boolean; x: number; y: number;
    destroyed: string[]; discovered: string[]; milestones?: string[]; shipComponents?: string[];
  };
  const milestones = [
    ...(old.maxDepth >= 90 ? ['first-core-sample'] : []),
    ...(old.maxDepth >= 300 ? ['basalt-vein'] : []),
    ...(old.maxDepth >= 600 ? ['deep-scan'] : []),
    ...(old.artifact ? ['route-signal'] : []),
  ];
  const upgraded = {
    version: 4 as const,
    campaignSeed: old.seed,
    activeMap: 'mars-frontier' as const,
    maps: { 'mars-frontier': { seed: old.seed, x: old.x, y: old.y, maxDepth: old.maxDepth, destroyed: old.destroyed, discovered: old.discovered } },
    money: old.money,
    levels: old.levels,
    fuel: old.fuel,
    hull: old.hull,
    cargo: old.cargo,
    maxDepth: old.maxDepth,
    artifact: old.artifact,
    milestones: old.milestones ?? milestones,
    shipComponents: old.shipComponents ?? [],
    routeFragments: [],
  };
  return migrateSave(upgraded);
}
export function parseSaveFile(contents: string): SaveData | null {
  try {
    return migrateSave(JSON.parse(contents));
  } catch {
    return null;
  }
}
export class SaveManager {
  warning = '';
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      const migrated = migrateSave(data);
      if (migrated) return migrated;
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
    p.grappleOwned = d.grappleOwned;
    p.specialization = d.specialization;
    p.fuel = Math.min(d.fuel, p.max('fuel'));
    p.hull = Math.min(d.hull, p.max('hull'));
    p.cargo = { ...emptyCargo(), ...d.cargo };
    if (p.count > p.max('cargo')) p.cargo = emptyCargo();
    p.maxDepth = d.maxDepth;
    p.artifact = d.artifact;
    p.milestones = [...d.milestones];
    p.routeFragments = [...d.routeFragments];
    // Older saves paid credits for parts after finding each signal. Keep their
    // progress while making every recovered signal an installed part now.
    p.shipComponents = [...new Set([
      ...d.shipComponents,
      ...d.routeFragments.map((id) => ROUTE_SHIP_COMPONENTS[id as keyof typeof ROUTE_SHIP_COMPONENTS]),
    ])];
    p.charges = d.charges;
    p.salvageMagnet = d.salvageMagnet;
    p.stasisModule = d.stasisModule;
    p.returnWinch = d.returnWinch;
    p.escapeSuit = d.escapeSuit;
    p.pilotEscaping = d.pilotEscaping;
    p.ownedSuits = [...d.ownedSuits];
    p.selectedSuit = d.selectedSuit;
    p.ownedDecals = [...d.ownedDecals];
    p.selectedDecal = d.selectedDecal;
    p.ownedProfiles = [...d.ownedProfiles];
    p.selectedProfile = d.selectedProfile;
    p.ownedPaints = [...d.ownedPaints];
    p.selectedPaint = d.selectedPaint;
  }
}
