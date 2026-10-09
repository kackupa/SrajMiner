/**
 * Pure coordinate helpers for a round planet represented as a half-turn strip.
 * Chart-aware world simulation and rendering geometry share these helpers.
 */
export type PlanetChartPoint = { u: number; v: number };
export type PlanetChartSize = { columns: number; radiusRows: number };
export type PlanetTileCoordinate = { x: number; y: number };
export type PlanetCartesianPoint = { x: number; y: number };
export type PlanetChartVector = { du: number; dv: number };
export type PlanetCartesianVector = { dx: number; dy: number };
export type PlanetWorldVector = { x: number; y: number };
export type PlanetCellCorners = {
  topLeft: PlanetCartesianPoint;
  topRight: PlanetCartesianPoint;
  bottomRight: PlanetCartesianPoint;
  bottomLeft: PlanetCartesianPoint;
};
export type PlanetSeamState = PlanetChartPoint & {
  dv: number;
  aimV: number;
  crossings: number;
};

/** Apply the planet's twisted side seam to a world-space strip position. */
export function wrapPlanetWorldX(
  x: number,
  y: number,
  vx: number,
  vy: number,
  aimX: number,
  aimY: number,
  width: number,
  surfaceY: number,
): PlanetCartesianPoint & { vx: number; vy: number; aimX: number; aimY: number; crossings: number } {
  if (![x, y, vx, vy, aimX, aimY, width, surfaceY].every(Number.isFinite) || width <= 0 || surfaceY <= 0)
    throw new RangeError('Planet seam values must be finite and world dimensions positive');
  const crossings = Math.floor(x / width);
  const crossedOddSeam = Math.abs(crossings % 2) === 1;
  return {
    x: x - crossings * width,
    y: crossedOddSeam ? surfaceY - y : y,
    vx,
    vy: crossedOddSeam ? -vy : vy,
    aimX,
    aimY: crossedOddSeam ? -aimY : aimY,
    crossings,
  };
}

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

/** Project one chart tile to its four polar cutaway corners. */
export function planetChartCellCorners(
  tile: PlanetTileCoordinate,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetCellCorners {
  if (!Number.isInteger(tile.x) || !Number.isInteger(tile.y)) throw new RangeError('Planet tile coordinates must be integers');
  return {
    topLeft: planetChartToCartesian({ u: tile.x, v: tile.y }, columns, radiusRows, tileSize),
    topRight: planetChartToCartesian({ u: tile.x + 1, v: tile.y }, columns, radiusRows, tileSize),
    bottomRight: planetChartToCartesian({ u: tile.x + 1, v: tile.y + 1 }, columns, radiusRows, tileSize),
    bottomLeft: planetChartToCartesian({ u: tile.x, v: tile.y + 1 }, columns, radiusRows, tileSize),
  };
}

/** True when a curved chart cell reaches within a physical distance of the core. */
export function planetChartCellIntersectsCoreRadius(
  tile: PlanetTileCoordinate,
  columns: number,
  radiusRows: number,
  radiusPixels: number,
  tileSize = 1,
): boolean {
  const { topLeft, topRight, bottomRight, bottomLeft } = planetChartCellCorners(tile, columns, radiusRows, tileSize),
    polygon = [topLeft, topRight, bottomRight, bottomLeft];
  if (polygon.some((point) => Math.hypot(point.x, point.y) <= radiusPixels)) return true;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y,
      t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1))),
      x = a.x + dx * t, y = a.y + dy * t;
    if (Math.hypot(x, y) <= radiusPixels) return true;
  }
  return false;
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

/** Offset a chart location in physical tangent/outward directions on the globe. */
export function planetChartLocalOffset(
  point: PlanetChartPoint,
  tangentPixels: number,
  outwardPixels: number,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetChartPoint {
  assertChart(columns, radiusRows);
  if (![point.u, point.v, tangentPixels, outwardPixels, tileSize].every(Number.isFinite) || tileSize <= 0)
    throw new RangeError('Planet local offset and tile size must be finite');
  const theta = Math.PI * point.u / columns;
  const signedRadius = radiusRows - point.v;
  const hemisphere = signedRadius < 0 ? -1 : 1;
  const origin = planetChartToCartesian(point, columns, radiusRows, tileSize);
  const tangentX = hemisphere * Math.cos(theta), tangentY = hemisphere * Math.sin(theta);
  const outwardX = hemisphere * Math.sin(theta), outwardY = -hemisphere * Math.cos(theta);
  return planetCartesianToChart({
    x: origin.x + tangentX * tangentPixels + outwardX * outwardPixels,
    y: origin.y + tangentY * tangentPixels + outwardY * outwardPixels,
  }, columns, radiusRows, tileSize);
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

/** Convert a physical cartesian direction into chart-space world-pixel velocity. */
export function planetCartesianVectorToWorld(
  point: PlanetChartPoint,
  vector: PlanetWorldVector,
  columns: number,
  radiusRows: number,
  tileSize = 1,
): PlanetWorldVector {
  assertChart(columns, radiusRows);
  if (![point.u, point.v, vector.x, vector.y, tileSize].every(Number.isFinite) || tileSize <= 0)
    throw new RangeError('Planet vector and tile size must be finite');
  const theta = Math.PI * point.u / columns;
  const radiusPixels = (radiusRows - point.v) * tileSize;
  const tangentScale = radiusPixels * Math.PI / columns;
  const radial = -Math.sin(theta) * vector.x + Math.cos(theta) * vector.y;
  const tangent = Math.cos(theta) * vector.x + Math.sin(theta) * vector.y;
  if (Math.abs(tangentScale) < tileSize * 0.025)
    return { x: 0, y: radial * tileSize };
  return { x: tangent * tileSize / tangentScale, y: radial };
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

/** Normalize integer tile coordinates across the planet's twisted side seam. */
export function wrapPlanetTile(tile: PlanetTileCoordinate, columns: number, radiusRows: number): PlanetTileCoordinate {
  assertChart(columns, radiusRows);
  if (!Number.isInteger(tile.x) || !Number.isInteger(tile.y)) throw new RangeError('Planet tile coordinates must be integers');
  const crossings = Math.floor(tile.x / columns), x = tile.x - crossings * columns;
  return { x, y: Math.abs(crossings % 2) === 1 ? radiusRows * 2 - tile.y - 1 : tile.y };
}
