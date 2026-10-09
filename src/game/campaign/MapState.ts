import type { MapId } from '../config';
import type { PlanetChartSize } from '../world/PlanetChart';
import { TileWorld } from '../world/TileWorld';
import type { ActiveCharge, OreDrop, WorldSave } from '../save/SaveManager';
import type { UndergroundStructure } from '../building/UndergroundStructures';

export function snapshotMapState(
  previous: WorldSave | undefined,
  world: TileWorld,
  x: number,
  y: number,
  depth: number,
  drops: OreDrop[],
  activeCharge?: ActiveCharge,
  structures: UndergroundStructure[] = [],
): WorldSave {
  return {
    seed: world.seed,
    x,
    y,
    maxDepth: Math.max(previous?.maxDepth ?? 0, depth),
    destroyed: [...world.destroyed],
    discovered: [...world.discovered],
    drops: drops.map((drop) => ({ ...drop })),
    activeCharge: activeCharge ? { ...activeCharge } : null,
    structures: structures.map((structure) => ({ ...structure })),
    ...(world.planetChart ? { planetChart: { ...world.planetChart } } : previous?.planetChart ? { planetChart: { ...previous.planetChart } } : {}),
  };
}

export function restoreMapState(
  state: WorldSave | undefined,
  mapId: MapId,
  firstVisitSeed: number,
  firstVisitChart?: PlanetChartSize,
) {
  return {
    world: new TileWorld(state?.seed ?? firstVisitSeed, state?.destroyed, state?.discovered, mapId, state?.planetChart ?? firstVisitChart),
    drops: state?.drops.map((drop) => ({ ...drop })) ?? [],
    activeCharge: state?.activeCharge ? { ...state.activeCharge } : undefined,
    structures: state?.structures.map((structure) => ({ ...structure })) ?? [],
  };
}
