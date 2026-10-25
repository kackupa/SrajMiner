import { createSurfaceTerrain } from '../world/SurfaceTerrain';
import type { MapId } from '../config';
import type { PlanetChartSize } from '../world/PlanetChart';
import { TileWorld } from '../world/TileWorld';
import type { ActiveCharge, OreDrop, WorldSave } from '../save/SaveManager';
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
): WorldSave {
  return {
    seed: world.seed,
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
  world.terrain = state?.terrain ?? createSurfaceTerrain(world,state?.structures);
  world.clearedTerritories = new Set(state?.clearedTerritories ?? []);
  world.clearedCaves = new Set(state?.clearedCaves ?? []);
  return {
    world,
    drops: state?.drops.map((drop) => ({ ...drop })) ?? [],
    activeCharge: state?.activeCharge ? { ...state.activeCharge } : undefined,
    structures: state?.structures.map((structure) => ({ ...structure })) ?? [],
    warehouse: state?.warehouse ? { ...state.warehouse } : emptyCargo(),
  };
}
