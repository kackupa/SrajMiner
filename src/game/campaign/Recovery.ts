import { coreWorldYFor, surfaceDockYAt, WORLD } from '../config';
import type { PlanetChartSize } from '../world/PlanetChart';

/** Emergency recovery keeps a charted expedition on the crust nearest its current position. */
export function emergencyRecoveryDock(x: number, y: number, chart?: PlanetChartSize) {
  const far = !!chart && y >= coreWorldYFor(chart);
  return {
    x,
    y: chart ? surfaceDockYAt(y, chart) : WORLD.spawnY,
    far,
  };
}
