import type Phaser from 'phaser';
import { WORLD, type MapId } from '../config';
import { random, type Tile, type TileWorld } from './TileWorld';

type Point = { x: number; y: number };
type Project = (x: number, y: number) => Point;

// Original material studies. All detail is derived from coordinates, never saved.
const MATERIALS: Record<MapId, { shadow: number; light: number; seam: number }> = {
  'mars-frontier': { shadow: 0x392730, light: 0xedb38a, seam: 0x80504a },
  'cryo-shelf': { shadow: 0x172d43, light: 0xbce9ea, seam: 0x578b9f },
  'hull-graveyard': { shadow: 0x212d31, light: 0xd4c3a0, seam: 0x866b54 },
  'prism-fault': { shadow: 0x28253f, light: 0xd9c9ec, seam: 0x86709b },
  'cinder-vale': { shadow: 0x261e2b, light: 0xd19c83, seam: 0x864d42 },
  'vesper-9': { shadow: 0x182e32, light: 0xc0e0c6, seam: 0x587e72 },
};

/** Detail stays inside the projected cell; only open faces receive a rim.
 * Broad strata share endpoints across neighboring cells, removing the brick grid.
 */
export function drawGeology(
  g: Phaser.GameObjects.Graphics, world: TileWorld, tile: Tile,
  x: number, y: number, project: Project, light: number,
) {
  const t = WORLD.tile, material = MATERIALS[world.mapId],
    corners = [project(x * t, y * t), project((x + 1) * t, y * t),
      project((x + 1) * t, (y + 1) * t), project(x * t, (y + 1) * t)],
    // Interpolate within the actual rendered quad: bounded geometry and no
    // repeated polar transforms for the small decorative strokes.
    at = (u: number, v: number): Point => ({
      x: corners[0].x * (1 - u) * (1 - v) + corners[1].x * u * (1 - v) + corners[2].x * u * v + corners[3].x * (1 - u) * v,
      y: corners[0].y * (1 - u) * (1 - v) + corners[1].y * u * (1 - v) + corners[2].y * u * v + corners[3].y * (1 - u) * v,
    }),
    polygon = (coords: [number, number][]) => coords.map(([u, v]) => at(u, v)),
    cell = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]),
    n = random(world.seed, tile.x, tile.y, 8101),
    band = (column: number) => 0.34 + Math.sin(column * 0.63 + y * 1.7) * 0.13;
  g.fillStyle(tile.tint);
  g.fillPoints(cell, true);
  g.fillStyle(material.shadow, 0.22);
  g.fillPoints(polygon([[0, band(x)], [0.5, band(x + 0.5)], [1, band(x + 1)], [1, 1], [0, 1]]), true);
  // Broad sediment bands connect across cells; avoid a bright top on every
  // tile, which made natural geology read as a wall of identical bricks.
  g.lineStyle(1, material.seam, 0.25);
  g.strokePoints(polygon([[0, band(x)], [0.5, band(x + 0.5)], [1, band(x + 1)]]), false);
  // Sparse facets rather than identical bevels around every tile.
  if (n > 0.64) {
    const u = 0.2 + n * 0.38;
    g.fillStyle(material.shadow, 0.28);
    g.fillPoints(polygon([[u, 0.3], [u + 0.2, 0.48], [u + 0.08, 0.84], [u - 0.13, 0.65]]), true);
    g.lineStyle(1, material.light, world.mapId === 'cryo-shelf' ? 0.32 : 0.16);
    g.strokePoints(polygon([[u - 0.13, 0.65], [u + 0.08, 0.84], [u + 0.2, 0.48]]), false);
  }
  for (let i = 0; i < 1; i++) {
    const u = 0.12 + random(world.seed, tile.x + i, tile.y, 8102) * 0.7,
      v = 0.12 + random(world.seed, tile.x, tile.y + i, 8103) * 0.7;
    g.lineStyle(1, material.light, 0.14);
    const a = at(u, v), b = at(u + 0.07, v - 0.02);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  // Only actual empty neighbors create an exposed edge. Never move the collider.
  const faces: [number, number, [number, number][]][] = [
    [0, -1, [[0, 0], [0.3, 0.045], [0.65, 0.018], [1, 0]]],
    [1, 0, [[1, 0], [0.955, 0.35], [0.98, 0.7], [1, 1]]],
    [0, 1, [[1, 1], [0.7, 0.95], [0.3, 0.98], [0, 1]]],
    [-1, 0, [[0, 1], [0.04, 0.7], [0.02, 0.3], [0, 0]]],
  ];
  for (const [dx, dy, edge] of faces) {
    if (world.solid(x + dx, y + dy)) continue;
    const points = polygon(edge);
    g.lineStyle(5, material.shadow, 0.9);
    g.strokePoints(points, false);
    g.lineStyle(1.4, material.light, dy === -1 ? 0.88 : 0.45);
    g.strokePoints(points, false);
  }
  g.fillStyle(0x0b1722, 1 - light);
  g.fillPoints(cell, true);
}
