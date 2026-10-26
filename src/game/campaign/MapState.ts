import { createSurfaceTerrain, expandSurfaceNests } from '../world/SurfaceTerrain';
import { OPENING_EXPEDITION, type MapId } from '../config';
import type { PlanetChartSize } from '../world/PlanetChart';
import { TileWorld } from '../world/TileWorld';
import type { ActiveCharge, OreDrop, MinerWreck, WorldSave } from '../save/SaveManager';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import { emptyCargo, type Cargo } from '../economy/Progress';

export function snapshotMapState(
  previous: WorldSave | undefined,
  world: TileWorld,
  x: number,
  y: number,
  depth: number,
  drops: OreDrop[],
  activeCharge?: ActiveCharge,
  structures: UndergroundStructure[] = [],
  warehouse: Cargo = previous?.warehouse ?? emptyCargo(),
  wrecks: MinerWreck[] = previous?.wrecks ?? [],
): WorldSave {
  return {
    wrecks: structuredClone(wrecks),
    seed: world.seed,
    openingLayout: world.openingLayout,
    terrain: world.terrain,
    clearedTerritories: [...world.clearedTerritories],
    x,
    y,
    maxDepth: Math.max(previous?.maxDepth ?? 0, depth),
    clearedCaves: [...world.clearedCaves],
    destroyed: [...world.destroyed],
    discovered: [...world.discovered],
    drops: drops.map((drop) => ({ ...drop })),
    activeCharge: activeCharge ? { ...activeCharge } : null,
    structures: structures.map((structure) => ({ ...structure })),
    warehouse: { ...warehouse },
    ...(world.planetChart ? { planetChart: { ...world.planetChart } } : previous?.planetChart ? { planetChart: { ...previous.planetChart } } : {}),
  };
}

export function restoreMapState(
  state: WorldSave | undefined,
  mapId: MapId,
  firstVisitSeed: number,
  firstVisitChart?: PlanetChartSize,
) {
  const world = new TileWorld(state?.seed ?? firstVisitSeed, state?.destroyed, state?.discovered, mapId, state?.planetChart ?? firstVisitChart);
  world.openingLayout = state ? state.openingLayout === true : mapId === 'cryo-shelf';
  world.terrain = state?.terrain ? structuredClone(state.terrain) : createSurfaceTerrain(world,state?.structures);
  if (!state && world.openingLayout) {
    world.terrain.caves = world.terrain.caves.filter(c => c < 25 || c > 48);
    world.terrain.caves.push(OPENING_EXPEDITION.caveColumn);
    world.terrain.nests = world.terrain.nests.filter(c => c < 25 || c > 48);
  }
  expandSurfaceNests(world,state?.structures);
  world.clearedTerritories = new Set(state?.clearedTerritories ?? []);
  world.clearedCaves = new Set(state?.clearedCaves ?? []);
  return {
    world,
    wrecks: structuredClone(state?.wrecks??[]),
    drops: state?.drops.map((drop) => ({ ...drop })) ?? [],
    activeCharge: state?.activeCharge ? { ...state.activeCharge } : undefined,
    structures: state?.structures.map((structure) => ({ ...structure })) ?? [],
    warehouse: state?.warehouse ? { ...state.warehouse } : emptyCargo(),
  };
}
