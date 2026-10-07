export type ScreenPoint = { x: number; y: number };

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
