import { planetChartToCartesian, type PlanetChartSize } from './PlanetChart';

export type ScreenPoint = { x: number; y: number };
export type Direction = { x: number; y: number };

/** Smallest gameplay zoom that fits the whole planet in a HUD-safe viewport. */
export function orbitalOverviewMinZoom(width: number, height: number, planetRadius: number): number {
  if (![width, height, planetRadius].every(Number.isFinite) || width <= 0 || height <= 0 || planetRadius <= 0)
    throw new RangeError('Orbital overview dimensions and radius must be finite and positive');
  const safeDiameter = Math.min(width * 0.28, height * 0.6);
  return Math.min(1.8, safeDiameter / (planetRadius * 2));
}

/** Camera rotation that keeps local outward (the miner's up) at screen-up on a round world. */
export function planetCameraFrameAngle(u: number, v: number, chart: PlanetChartSize, tileSize = 1): number | undefined {
  const point = planetChartToCartesian({ u, v }, chart.columns, chart.radiusRows, tileSize);
  if (Math.hypot(point.x, point.y) < 1e-6) return undefined;
  const angle = -Math.PI / 2 - Math.atan2(point.y, point.x);
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Shortest signed turn from one camera angle to another. */
export function cameraAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** A seam wrap can change chart latitude without representing a core passage. */
export function crossedPlanetCore(fromY: number, toY: number, coreY: number, seamCrossings = 0): boolean {
  return seamCrossings === 0 &&
    ((fromY < coreY && toY >= coreY) || (fromY > coreY && toY <= coreY));
}

export function cameraZoomPoint(point: ScreenPoint, width: number, height: number, zoom: number): ScreenPoint {
  return { x: width / 2 + (point.x - width / 2) * zoom, y: height / 2 + (point.y - height / 2) * zoom };
}

export function cameraUnzoomPoint(point: ScreenPoint, width: number, height: number, zoom: number): ScreenPoint {
  const safeZoom = Math.max(0.0001, zoom);
  return { x: width / 2 + (point.x - width / 2) / safeZoom, y: height / 2 + (point.y - height / 2) / safeZoom };
}

/** Map a screen-relative input vector into the rotating world's coordinates. */
export function screenDirectionToWorld(x: number, y: number, rotation: number): Direction {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return { x: x * cos + y * sin, y: -x * sin + y * cos };
}

/** Project a world-space direction through the camera turn for control checks and aim. */
export function worldDirectionToScreen(x: number, y: number, rotation: number): Direction {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** Keep camera look-ahead aligned with screen-down as the view turns through the core. */
export function cameraFocusY(podY: number, lookAhead: number, rotation: number) {
  return podY + Math.cos(rotation) * lookAhead;
}

export function worldToScreen(
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number,
  inverted = false,
): ScreenPoint {
  return inverted
    ? { x: width - (x - cameraX), y: height - (y - cameraY) }
    : { x: x - cameraX, y: y - cameraY };
}

export function screenToWorld(
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number,
  inverted = false,
): ScreenPoint {
  return inverted
    ? { x: cameraX + width - x, y: cameraY + height - y }
    : { x: cameraX + x, y: cameraY + y };
}
