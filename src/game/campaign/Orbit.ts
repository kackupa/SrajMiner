import type { PlanetChartSize } from '../world/PlanetChart';
import { WORLD, farSurfaceYFor } from '../config';

/** Orbit is high enough to clear the colony skyline and read clearly in the cutaway. */
export function orbitAltitude(chart: PlanetChartSize) {
  return Math.max(900, Math.round(chart.radiusRows * WORLD.tile * 0.72));
}

export function isInOrbit(y: number, chart?: PlanetChartSize) {
  if (!chart) return false;
  const altitude = orbitAltitude(chart);
  return y <= -altitude || y >= farSurfaceYFor(chart) + altitude;
}

/** Clamp outward flight to a stable parking point beyond either crust. */
export function orbitalParkingY(y: number, chart: PlanetChartSize) {
  const altitude = orbitAltitude(chart), farOrbit = farSurfaceYFor(chart) + altitude;
  return y <= -altitude ? -altitude : y >= farOrbit ? farOrbit : y;
}
