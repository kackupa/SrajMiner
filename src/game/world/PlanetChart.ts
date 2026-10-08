/**
 * Pure coordinate helpers for a round planet represented as a half-turn strip.
 * This module is intentionally not wired into the playable scene yet.
 */
export type PlanetChartPoint = { u: number; v: number };
export type PlanetCartesianPoint = { x: number; y: number };
export type PlanetChartVector = { du: number; dv: number };
export type PlanetCartesianVector = { dx: number; dy: number };
export type PlanetSeamState = PlanetChartPoint & {
  dv: number;
  aimV: number;
  crossings: number;
};

function assertChart(columns: number, radiusRows: number) {
  if (!Number.isFinite(columns) || columns <= 0 || !Number.isFinite(radiusRows) || radiusRows <= 0)
    throw new RangeError('Planet chart dimensions must be finite and positive');
}

/** Convert strip tile coordinates to a centered polar cutaway. */
export function planetChartToCartesian(
  point: PlanetChartPoint,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetCartesianPoint {
  assertChart(columns, radiusRows);
  if (!Number.isFinite(point.u) || !Number.isFinite(point.v) || !Number.isFinite(tileSize) || tileSize <= 0)
    throw new RangeError('Planet chart coordinates and tile size must be finite');
  const theta = Math.PI * point.u / columns;
  const radius = radiusRows - point.v;
  return {
    x: radius * Math.sin(theta) * tileSize,
    y: -radius * Math.cos(theta) * tileSize,
  };
}

/** Convert a centered cutaway point back to the canonical half-turn strip. */
export function planetCartesianToChart(
  point: PlanetCartesianPoint,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetChartPoint {
  assertChart(columns, radiusRows);
  if (![point.x, point.y, tileSize].every(Number.isFinite) || tileSize <= 0)
    throw new RangeError('Planet coordinates and tile size must be finite');
  const x = point.x / tileSize, y = point.y / tileSize;
  const magnitude = Math.hypot(x, y);
  if (magnitude < 1e-10) return { u: columns / 2, v: radiusRows };
  // Positive signed radius occupies the right half of the disc; negative
  // radius occupies the left. This chooses one strip representation per point.
  const signedRadius = x < 0 ? -magnitude : magnitude;
  const theta = x < 0 ? Math.atan2(-x, y) : Math.atan2(x, -y);
  return {
    u: Math.max(0, Math.min(columns, theta * columns / Math.PI)),
    v: radiusRows - signedRadius,
  };
}

/**
 * Convert a local strip-space velocity/aim vector to its world-space vector.
 * `du` is angular/tangent motion and `dv` is radial motion.
 */
export function planetChartVectorToCartesian(
  point: PlanetChartPoint,
  vector: PlanetChartVector,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetCartesianVector {
  assertChart(columns, radiusRows);
  if (![point.u, point.v, vector.du, vector.dv, tileSize].every(Number.isFinite) || tileSize <= 0)
    throw new RangeError('Planet chart vector and tile size must be finite');
  const theta = Math.PI * point.u / columns;
  const radius = radiusRows - point.v;
  const anglePerColumn = Math.PI / columns;
  return {
    dx: tileSize * (radius * Math.cos(theta) * anglePerColumn * vector.du - Math.sin(theta) * vector.dv),
    dy: tileSize * (radius * Math.sin(theta) * anglePerColumn * vector.du + Math.cos(theta) * vector.dv),
  };
}

/**
 * Wrap an unbounded strip coordinate into [0, columns), reflecting its radial
 * coordinate and radial directions at every twisted side seam. Crossing one
 * seam joins the near surface to the far surface; two seams make a full loop.
 */
export function wrapPlanetSeam(
  point: PlanetChartPoint,
  radialVelocity: number,
  radialAim: number,
  columns: number,
  radiusRows: number,
): PlanetSeamState {
  assertChart(columns, radiusRows);
  if (![point.u, point.v, radialVelocity, radialAim].every(Number.isFinite))
    throw new RangeError('Planet seam state must be finite');
  const crossings = Math.floor(point.u / columns);
  const u = point.u - crossings * columns;
  const oddCrossings = Math.abs(crossings % 2) === 1;
  return {
    u: Object.is(u, -0) ? 0 : u,
    v: oddCrossings ? radiusRows * 2 - point.v : point.v,
    dv: oddCrossings ? -radialVelocity : radialVelocity,
    aimV: oddCrossings ? -radialAim : radialAim,
    crossings,
  };
}
