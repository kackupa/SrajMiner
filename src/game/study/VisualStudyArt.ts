import { studyOreVeins } from './StudyOreVeins';
import { STUDY_ROCK } from './StudyDrillEffects';
import { studyContourGeometry, type StudyEdge } from './StudyContours';
import type Phaser from 'phaser';
import { WORLD, ORES, MOTHERSHIP } from '../config';
import { random, keyOf, type TileWorld, type Tile } from '../world/TileWorld';
type Point = { x: number; y: number };
type Project = (x: number, y: number) => Point;

/** Authored access shaft and chamber in the throwaway study only. */
export function prepareStudy(world: TileWorld) {
  if (world.terrain) for (let i = 7; i < 37; i++) world.terrain.heights[i] = 0;
  // A disposable up/down walking course west of the ship, away from its supports.
  if (world.terrain) [0, 1, 2, 2, 1].forEach((height, i) => { world.terrain!.heights[i + 2] = height; });
  for (let y = 0; y < 14; y++)
    for (let x = 18; x < 35; x++) {
      const shaft = Math.abs(x - (23 + Math.sin(y * 0.6) * 0.65)) < 1.65 && y <= 8;
      const chamber = ((x - 27) / 5.2) ** 2 + ((y - 8) / 3.2) ** 2 < 1;
      if (shaft || chamber) world.destroyed.add(keyOf(x, y));
    }
  world.chunks.clear();
}

/** Continuous geological beds and metallic inclusions.
 * The separate contour pass softens the visible edge without changing physics. */
export function drawStudyRock(
  g: Phaser.GameObjects.Graphics,
  world: TileWorld,
  tile: Tile,
  x: number,
  y: number,
  c: Point[],
  light: number,
) {
  const at = (u: number, v: number): Point => ({
    x: c[0].x * (1 - u) * (1 - v) + c[1].x * u * (1 - v) + c[2].x * u * v + c[3].x * (1 - u) * v,
    y: c[0].y * (1 - u) * (1 - v) + c[1].y * u * (1 - v) + c[2].y * u * v + c[3].y * (1 - u) * v,
  });
  const poly = (p: number[][], color: number, a = 1) => {
    g.fillStyle(color, a);
    g.fillPoints(
      p.map(([u, v]) => at(u, v)),
      true,
    );
  };
  const line = (p: number[][], color: number, a: number, width = 1) => {
    g.lineStyle(width, color, a);
    g.strokePoints(
      p.map(([u, v]) => at(u, v)),
      false,
    );
  };
  const n = random(world.seed, tile.x, tile.y, 923);
  poly(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    STUDY_ROCK.body,
  );
  // Broad, irregular geological beds run across many cells. Clip each portion
  // to its tile so they cross seams without exposing rectangular tile borders.
  const clip = (points: number[][]) => {
    let out = points;
    for (const [axis, limit, greater] of [
      [0, 0, true],
      [0, 1, false],
      [1, 0, true],
      [1, 1, false],
    ] as const) {
      const input = out;
      out = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i],
          b = input[(i + 1) % input.length],
          insideA = greater ? a[axis] >= limit : a[axis] <= limit,
          insideB = greater ? b[axis] >= limit : b[axis] <= limit;
        if (insideA) out.push(a);
        if (insideA !== insideB) {
          const t = (limit - a[axis]) / (b[axis] - a[axis]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
    }
    return out;
  };
  for (let band = Math.floor((y - 2) / 2.3); band <= Math.ceil((y + 2) / 2.3); band++) {
    const row = (u: number) =>
      band * 2.3 +
      Math.sin((x + u) * 0.28 + band * 1.7) * 0.62 +
      Math.sin((x + u) * 0.89 + band) * 0.11 -
      y;
    const edge = Array.from({ length: 9 }, (_, i) => [i / 8, row(i / 8)]);
    const bed = clip([
      ...edge,
      ...edge
        .slice()
        .reverse()
        .map(([u, v]) => [u, v + 0.24 + Math.sin(band * 3) * 0.11]),
    ]);
    if (bed.length > 2)
      poly(bed, band % 2 === 0 ? 0x728a83 : 0x102a38, band % 2 === 0 ? 0.11 : 0.22);
  }
  // Mineral grain and hairline fractures, deterministic in world coordinates.
  for (let i = 0; i < 8; i++) {
    const u = 0.12 + random(51, x * 17 + i, y, 1) * 0.74,
      v = 0.12 + random(19, x, y * 17 + i, 2) * 0.74;
    line(
      [
        [u, v],
        [u + 0.02 + n * 0.025, v - 0.013],
      ],
      i % 3 ? 0xb7c3b4 : 0x071923,
      i % 3 ? 0.12 : 0.5,
      0.6,
    );
  }
  const crack = 0.2 + n * 0.5;
  if (n > 0.82) {
    line(
      [
        [crack, 0.1],
        [crack - 0.07, 0.28],
        [crack + 0.05, 0.39],
        [crack - 0.04, 0.65],
        [crack + 0.03, 0.88],
      ],
      0x091a25,
      0.25,
      1.3,
    );
    line(
      [
        [crack + 0.05, 0.39],
        [crack + 0.22, 0.43],
        [crack + 0.32, 0.59],
      ],
      0x091a25,
      0.2,
      0.8,
    );
  }
  if (tile.ore) {
    const color = ORES[tile.ore].color;
    const paths = studyOreVeins(world.seed, x, y, tile.ore, (nx, ny) => {
      const neighbor = world.get(nx, ny);
      // Keep the original vein running to a freshly cut face instead of
      // reshuffling neighbouring artwork when the player mines its continuation.
      return neighbor.type === 'empty' && world.destroyed.has(keyOf(neighbor.x, neighbor.y))
        ? world.generate(nx, ny).ore
        : neighbor.ore;
    });
    for (const path of paths) {
      const ribbon = (scale: number, offset = 0) => {
        const sides = [1, -1].map((side) =>
          path.map((p, i) => {
            const prev = path[Math.max(0, i - 1)],
              next = path[Math.min(path.length - 1, i + 1)];
            const dx = next.x - prev.x,
              dy = next.y - prev.y,
              length = Math.max(0.001, Math.hypot(dx, dy));
            const w = p.width * scale * side + offset;
            return [p.x - (dy / length) * w, p.y + (dx / length) * w];
          }),
        );
        return clip([...sides[0], ...sides[1].reverse()]);
      };
      const shadow = ribbon(1.45),
        body = ribbon(1),
        edge = ribbon(0.23, -0.013);
      if (shadow.length > 2) poly(shadow, 0x081822, 0.24);
      if (body.length > 2) poly(body, color, 0.52 + light * 0.3);
      if (edge.length > 2) poly(edge, 0xffe4c0, 0.08 + light * 0.13);
      // Broken crystalline glints follow the deposit, never the tile outline.
      for (let i = 2; i < path.length - 2; i += 4) {
        const p = path[i],
          q = path[i + 1];
        line(
          [
            [p.x, p.y],
            [q.x, q.y],
          ],
          color,
          0.3 + light * 0.35,
          0.7,
        );
      }
    }
  }
  poly(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    0x07131e,
    (1 - Math.max(0.25, light)) * 0.42,
  );
}

export function drawStudyCavity(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  c: Point[],
  time: number,
  reduced: boolean,
) {
  const at = (u: number, v: number) => ({
    x: c[0].x + (c[1].x - c[0].x) * u + (c[3].x - c[0].x) * v,
    y: c[0].y + (c[1].y - c[0].y) * u + (c[3].y - c[0].y) * v,
  });
  g.fillStyle(0x091a25);
  g.fillPoints(c, true);
  if (!reduced) {
    const a = at(0.2 + random(12, x, y) * 0.6, (time * 0.025 + random(7, x, y)) % 1);
    g.fillStyle(0xa1c9c6, 0.16);
    g.fillCircle(a.x, a.y, 0.8);
  }
}

/** Ground contact, service gantry, cables and work lights: all world anchored. */
export function drawStudySite(
  g: Phaser.GameObjects.Graphics,
  world: TileWorld,
  project: Project,
  time: number,
  reduced: boolean,
) {
  const poly = (points: number[][], color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      points.map(([x, y]) => project(x, y)),
      true,
    );
  };
  const line = (points: number[][], color: number, width = 1, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    g.strokePoints(
      points.map(([x, y]) => project(x, y)),
      false,
    );
  };
  // Follows the ground underneath the ship rather than a screen-space shadow.
  poly(
    [
      [MOTHERSHIP.x - 215, -1],
      [MOTHERSHIP.x + 215, -1],
      [MOTHERSHIP.x + 185, 8],
      [MOTHERSHIP.x - 180, 8],
    ],
    0x030e15,
    0.65,
  );
  // Mine mouth is an actual open shaft; markers sit on solid ground beside it.
  for (const x of [850, 1030]) {
    const y = world.surfaceHeight(x, 0);
    if (!world.solid(Math.floor(x / 40), Math.floor((y + 2) / 40))) continue;
    poly(
      [
        [x - 10, y],
        [x - 7, y - 7],
        [x + 7, y - 7],
        [x + 10, y],
      ],
      0x142b35,
    );
    line(
      [
        [x, y],
        [x, y - 48],
      ],
      0x233943,
      5,
    );
    line(
      [
        [x - 1, y - 45],
        [x - 1, y - 8],
      ],
      0x79989d,
      1.5,
    );
    poly(
      [
        [x - 8, y - 52],
        [x + 8, y - 52],
        [x + 8, y - 44],
        [x - 8, y - 44],
      ],
      0xe7bf7c,
    );
    for (let i = 5; i > 0; i--) {
      const p = project(x, y - 47);
      g.fillStyle(0xffd99c, 0.012);
      g.fillCircle(p.x, p.y, i * 9);
    }
    poly(
      [
        [x - 7, y - 44],
        [x + 7, y - 44],
        [x + 48, y],
        [x - 48, y],
      ],
      0xffd99c,
      0.035,
    );
  }
  line(
    [
      [690, -2],
      [740, -3],
      [790, -1],
      [845, -3],
    ],
    0x0b1820,
    4,
  );
  line(
    [
      [690, -3],
      [740, -4],
      [790, -2],
      [845, -4],
    ],
    0xc4a46e,
    1,
    0.7,
  );
  // Dust stirred along the apron, with no opaque layer over the player.
  if (!reduced)
    for (let i = 0; i < 18; i++) {
      const x = 350 + ((i * 41 + time * 9) % 480),
        y = -8 - Math.sin(i + time * 0.25) * 5;
      const p = project(x, y);
      g.fillStyle(0xc7d4c5, 0.035);
      g.fillEllipse(p.x, p.y, 14 + (i % 4) * 5, 3);
    }
}

/** Join exposed cell faces into one rounded, chipped cave silhouette. Rebuilt
 * from live excavation, so the edge changes immediately when a block breaks. */
export function drawStudyContours(
  g: Phaser.GameObjects.Graphics,
  world: TileWorld,
  project: Project,
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  const edges: StudyEdge[] = [];
  const open = (x: number, y: number) => {
    if (world.aboveTerrain((x + 0.5) * WORLD.tile, (y + 0.5) * WORLD.tile)) return true;
    const t = world.get(x, y);
    return t.type === 'empty' && world.discovered.has(keyOf(t.x, t.y));
  };
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      if (!world.solid(x, y)) continue;
      if (open(x, y - 1)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
      if (open(x + 1, y)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
      if (open(x, y + 1)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
      if (open(x - 1, y)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
    }
  const geometry = studyContourGeometry(edges),
    at = (p: Point) => project(p.x * WORLD.tile, p.y * WORLD.tile);
  const stroke = (p: Point[]) => {
    const screen = p.map(at);
    g.lineStyle(6, 0x061923, 0.65);
    g.strokePoints(screen, false);
    g.lineStyle(2.2, 0x587780, 0.7);
    g.strokePoints(screen, false);
    g.lineStyle(0.7, 0xb2c6c1, 0.35);
    g.strokePoints(screen, false);
  };
  for (const c of geometry.corners) {
    g.fillStyle(c.cut ? 0x091a25 : 0x293e48);
    g.fillPoints([c.vertex, ...c.curve].map(at), true);
    stroke(c.curve);
  }
  for (const { a, b } of geometry.segments) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy);
    const points = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6,
        noise =
          Math.sin(t * Math.PI) * (0.035 * Math.sin((a.x + dx * t) * 31 + (a.y + dy * t) * 19));
      return { x: a.x + dx * t - (dy / len) * noise, y: a.y + dy * t + (dx / len) * noise };
    });
    stroke(points);
  }
}
