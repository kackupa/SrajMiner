import { random } from '../world/TileWorld';
import type { Ore } from '../config';
export type VeinPoint = { x: number; y: number; width: number };
export type OreAt = (x: number, y: number) => Ore | undefined;

/** Local, immutable geometry. Adjacent cells agree on their shared edge's
 * position and width. Ore ownership and yield still belong to the real tile. */
export function studyOreVeins(
  seed: number,
  x: number,
  y: number,
  ore: Ore,
  oreAt: OreAt,
): VeinPoint[][] {
  const same = (a: number, b: number) => oreAt(a, b) === ore;
  const center = { x: 0.3 + random(seed, x, y, 812) * 0.4, y: 0.3 + random(seed, x, y, 813) * 0.4 };
  const centerWidth = 0.035 + random(seed, x, y, 814) * 0.045;
  const ports: { x: number; y: number; dx: number; dy: number; width: number }[] = [];
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    if (!same(x + dx, y + dy)) continue;
    const ex = x + Math.max(dx, 0),
      ey = y + Math.max(dy, 0),
      salt = dx ? 815 : 816;
    // Horizontal runs dominate broad deposits. Sparse cross-fractures connect
    // rows without drawing a four-way grid through every ore-bearing tile.
    const verticalRun =
      (!same(x - 1, y) && !same(x + 1, y)) ||
      (!same(x + dx - 1, y + dy) && !same(x + dx + 1, y + dy));
    if (dy && !verticalRun && random(seed, ex, ey, salt) < 0.72) continue;
    const along = 0.2 + random(seed, ex, ey, salt + 10) * 0.6;
    ports.push({
      x: dx < 0 ? 0 : dx > 0 ? 1 : along,
      y: dy < 0 ? 0 : dy > 0 ? 1 : along,
      dx,
      dy,
      width: 0.032 + random(seed, ex, ey, salt + 20) * 0.03,
    });
  }
  if (!ports.length) {
    const slope = random(seed, x, y, 822) - 0.5;
    ports.push(
      { x: 0.12, y: 0.3 + slope * 0.3, dx: -1, dy: 0, width: 0 },
      { x: 0.89, y: 0.7 + slope * 0.3, dx: 1, dy: 0, width: 0 },
    );
  } else if (ports.length === 1) {
    const p = ports[0];
    ports.push({
      x: Math.max(0.12, Math.min(0.88, center.x - p.dx * 0.3)),
      y: Math.max(0.12, Math.min(0.88, center.y - p.dy * 0.3)),
      dx: -p.dx,
      dy: -p.dy,
      width: 0,
    });
  }
  const paths = ports.map((port) => {
    const a = {
      x: center.x + (port.x - center.x) * 0.35 + (port.dy ? 0.06 : 0),
      y: center.y + (port.y - center.y) * 0.35 + (port.dx ? 0.06 : 0),
    };
    const b = { x: port.x - port.dx * 0.23, y: port.y - port.dy * 0.23 };
    return Array.from({ length: 13 }, (_, i) => {
      const t = i / 12,
        s = 1 - t;
      return {
        x: s * s * s * center.x + 3 * s * s * t * a.x + 3 * s * t * t * b.x + t * t * t * port.x,
        y: s * s * s * center.y + 3 * s * s * t * a.y + 3 * s * t * t * b.y + t * t * t * port.y,
        width:
          (centerWidth * s + port.width * t) *
          (1 + Math.sin(t * Math.PI) * Math.sin(t * 23 + x * 3 + y) * 0.25),
      };
    });
  });
  // One fine, tapering branch off the main deposit, without nugget markers.
  const tip = {
    x: 0.16 + random(seed, x, y, 825) * 0.68,
    y: 0.12 + random(seed, x, y, 826) * 0.76,
  };
  paths.push(
    Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      return {
        x: center.x + (tip.x - center.x) * t + Math.sin(t * Math.PI) * 0.055,
        y: center.y + (tip.y - center.y) * t,
        width: centerWidth * 0.38 * (1 - t),
      };
    }),
  );
  return paths;
}
